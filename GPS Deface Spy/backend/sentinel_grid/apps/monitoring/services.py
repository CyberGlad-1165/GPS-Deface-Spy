"""
Website capture service for taking screenshots and capturing HTML content.
Uses Playwright (headless Chromium) with stealth settings for real,
pixel-perfect screenshots that match what the user sees in a browser.
"""
import requests
import io
import os
import hashlib
import logging
import re
from datetime import datetime
from PIL import Image
from django.conf import settings
from django.core.files.base import ContentFile
from urllib.parse import urlparse, parse_qsl, urlencode, urlunparse

logger = logging.getLogger(__name__)

# Phrases that indicate the page did NOT load correctly
_BLOCKED_TITLES = [
    'access denied', 'just a moment', 'attention required',
    'checking your browser', 'security check', 'blocked',
    'please wait', 'error', '403 forbidden', '404 not found',
    'are you a robot', 'captcha',
]


class CaptureService:
    """Service for capturing website screenshots and content."""
    
    def __init__(self):
        self.screenshot_dir = os.path.join(settings.MEDIA_ROOT, 'screenshots')
        os.makedirs(self.screenshot_dir, exist_ok=True)
        self.timeout = 30
        self.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate, br',
            'DNT': '1',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
        }

    def capture_website(self, url: str, snapshot_id: int) -> dict:
        """
        Capture website content and a real screenshot.
        Returns dict with html_content, response_time, http_status_code, screenshot_path
        """
        result = {
            'html_content': '',
            'response_time': None,
            'http_status_code': None,
            'screenshot': None,
            'error': None,
        }
        
        parsed = urlparse(url)
        hostname = (parsed.hostname or '').lower()
        is_local_target = (
            hostname == 'localhost' or
            hostname.startswith('127.') or
            hostname.startswith('10.') or
            hostname.startswith('192.168.') or
            re.match(r'^172\.(1[6-9]|2\d|3[0-1])\.', hostname)
        )

        nav_url = url
        if is_local_target:
            # Prevent stale local cache/service-worker responses by forcing
            # a unique URL per capture.
            query_pairs = dict(parse_qsl(parsed.query, keep_blank_values=True))
            query_pairs['_ds_ts'] = str(int(datetime.now().timestamp() * 1000))
            nav_url = urlunparse(parsed._replace(query=urlencode(query_pairs)))

        candidate_urls = [url]
        if is_local_target and parsed.scheme == 'https':
            # Local dev servers are commonly HTTP-only
            candidate_urls.insert(0, url.replace('https://', 'http://', 1))

        capture_url = url
        last_error = None

        # ── 1. Fetch HTML content ────────────────────────────────────
        for candidate in candidate_urls:
            try:
                start_time = datetime.now()
                timeout = (3, 8) if is_local_target else self.timeout
                response = requests.get(candidate, headers=self.headers, timeout=timeout, verify=False)
                end_time = datetime.now()

                result['response_time'] = (end_time - start_time).total_seconds() * 1000
                result['http_status_code'] = response.status_code
                result['html_content'] = response.text[:50000]
                capture_url = candidate
                break
            except requests.RequestException as e:
                last_error = e

            # Fallback: curl impersonation is mainly useful for public/CDN sites,
            # not localhost. Skip for local targets to avoid extra delay.
            if is_local_target:
                continue

            try:
                from curl_cffi import requests as curl_req
                start_time = datetime.now()
                resp = curl_req.get(candidate, impersonate='chrome', timeout=20, allow_redirects=True)
                end_time = datetime.now()
                result['response_time'] = (end_time - start_time).total_seconds() * 1000
                result['http_status_code'] = resp.status_code
                result['html_content'] = resp.text[:50000]
                capture_url = candidate
                last_error = None
                break
            except Exception as e2:
                last_error = e2

        if not result['html_content'] and last_error:
            result['error'] = str(last_error)

        # ── 2. Capture screenshot ────────────────────────────────────
        try:
            screenshot = self._capture_screenshot_playwright(capture_url, snapshot_id)
            # External screenshot APIs cannot access localhost/private network targets.
            # Skipping them prevents long timeout chains during seed/re-scan.
            if not screenshot and not is_local_target:
                screenshot = self._capture_screenshot_api(capture_url, snapshot_id)
            if screenshot:
                result['screenshot'] = screenshot
        except Exception:
            pass
            
        return result

    def _capture_screenshot_playwright(self, url: str, snapshot_id: int) -> str | None:
        """
        Capture a real screenshot using Playwright headless Chromium.

        Strategy:
        1. Fast direct navigation with stealth flags.  Check for
           bot-detection blocks immediately after DOMContentLoaded
           (no unnecessary waits).  If the page is rich enough, use it.
        2. If blocked or unstyled, proxy ALL HTTP resources through
           curl_cffi with Chrome TLS-fingerprint impersonation.
        """
        try:
            from playwright.sync_api import sync_playwright
        except ImportError:
            logger.info("Playwright not installed — skipping real screenshot capture")
            return None

        parsed = urlparse(url)
        hostname = (parsed.hostname or '').lower()
        is_local_target = (
            hostname == 'localhost' or
            hostname.startswith('127.') or
            hostname.startswith('10.') or
            hostname.startswith('192.168.') or
            re.match(r'^172\.(1[6-9]|2\d|3[0-1])\.', hostname)
        )

        # Build cache-busting nav URL for local targets to avoid stale
        # service-worker responses (same logic as capture_website).
        nav_url = url
        if is_local_target:
            _parsed = urlparse(url)
            _qpairs = dict(parse_qsl(_parsed.query, keep_blank_values=True))
            _qpairs['_ds_ts'] = str(int(datetime.now().timestamp() * 1000))
            nav_url = urlunparse(_parsed._replace(query=urlencode(_qpairs)))

        filename = f"snapshot_{snapshot_id}_{hashlib.md5(url.encode()).hexdigest()[:8]}.png"
        filepath = os.path.join('screenshots', filename)
        full_path = os.path.join(settings.MEDIA_ROOT, filepath)
        os.makedirs(os.path.dirname(full_path), exist_ok=True)

        ua = (
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
            'AppleWebKit/537.36 (KHTML, like Gecko) '
            'Chrome/131.0.0.0 Safari/537.36'
        )

        def _launch_context(pw):
            browser = pw.chromium.launch(
                headless=True,
                args=[
                    '--disable-blink-features=AutomationControlled',
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-gpu',
                ],
            )
            ctx = browser.new_context(
                viewport={'width': 1920, 'height': 1080},
                user_agent=ua,
                locale='en-US',
                timezone_id='America/New_York',
                color_scheme='light',
            )
            return browser, ctx

        def _apply_stealth(page):
            page.add_init_script("""
                Object.defineProperty(navigator, 'webdriver', {get: () => undefined});
                Object.defineProperty(navigator, 'plugins', {get: () => [1,2,3,4,5]});
                Object.defineProperty(navigator, 'languages', {get: () => ['en-US','en']});
                window.chrome = {runtime: {}};
            """)

        def _is_blocked(page) -> bool:
            title = (page.title() or '').strip().lower()
            return any(phrase in title for phrase in _BLOCKED_TITLES)

        try:
            with sync_playwright() as pw:
                # ── Attempt 1: fast direct navigation ──
                browser, ctx = _launch_context(pw)
                page = ctx.new_page()
                _apply_stealth(page)
                _attempt1_ok = False

                try:
                    page.goto(
                        nav_url,
                        wait_until='domcontentloaded',
                        timeout=12000 if is_local_target else 15000,
                    )
                    # Check for blocking IMMEDIATELY — no reason to wait
                    # for networkidle if Cloudflare already returned a
                    # block page (title arrives with domcontentloaded).
                    if _is_blocked(page):
                        logger.info(f"Blocked by bot-detection (Attempt 1): {url}")
                    else:
                        # Ensure SPA hydration is complete before screenshot.
                        try:
                            page.wait_for_function(
                                "() => document.readyState === 'complete'",
                                timeout=6000 if is_local_target else 4000,
                            )
                        except Exception:
                            pass

                        # Page looks OK — give it a brief moment to paint
                        try:
                            page.wait_for_load_state(
                                'networkidle',
                                timeout=8000 if is_local_target else 8000,
                            )
                        except Exception:
                            pass
                        # For local targets, wait longer so that any async
                        # fetch-based state (e.g. defacement status from API)
                        # has time to resolve and update the DOM.
                        page.wait_for_timeout(3000 if is_local_target else 1500)
                        page.screenshot(path=full_path, full_page=False)
                        # For local/dev or dark defacement pages, strict color-richness
                        # checks can reject valid screenshots. Use a relaxed path first,
                        # then fallback to basic file validation.
                        min_colors = 300 if is_local_target else 2000
                        if self._validate_screenshot(full_path, filepath, min_colors=min_colors):
                            _attempt1_ok = True
                        elif self._validate_screenshot(full_path, filepath, min_colors=0):
                            logger.info(
                                f"Accepted screenshot with relaxed validation for {url}"
                            )
                            _attempt1_ok = True
                        else:
                            # One more attempt: full-page capture can succeed on
                            # certain SPA layouts where initial viewport capture
                            # is too sparse/blank during first paint.
                            page.wait_for_timeout(600 if is_local_target else 300)
                            page.screenshot(path=full_path, full_page=True)
                            if self._validate_screenshot(full_path, filepath, min_colors=0):
                                logger.info(f"Accepted full-page fallback screenshot for {url}")
                                _attempt1_ok = True
                except Exception as nav_err:
                    logger.info(f"Direct navigation failed: {nav_err}")

                browser.close()

                if _attempt1_ok:
                    return filepath

                # Local/dev targets should not enter the heavy proxy pipeline.
                if is_local_target:
                    return None

                # ── Attempt 2: full curl_cffi proxy ──
                logger.info(f"Using full curl_cffi proxy for {url}")
                try:
                    from curl_cffi import requests as curl_req
                    session = curl_req.Session(impersonate='chrome')
                except ImportError:
                    logger.info("curl_cffi not available for proxy fallback")
                    return None

                _skip_headers = frozenset({
                    'content-encoding', 'transfer-encoding', 'content-length',
                })
                # Abort non-essential resource types to speed up loading
                _abort_types = frozenset({
                    'media', 'websocket', 'manifest', 'other',
                })
                _abort_domains = frozenset({
                    'google-analytics.com', 'googletagmanager.com',
                    'facebook.net', 'doubleclick.net', 'adservice.google',
                    'analytics.', 'tracker.', 'pixel.',
                })

                def _proxy_intercept(route):
                    """Proxy essential requests through curl_cffi; abort junk."""
                    req = route.request
                    req_url = req.url

                    # Abort non-essential resource types
                    if req.resource_type in _abort_types:
                        route.abort()
                        return

                    # Abort known tracking / ad domains
                    if any(d in req_url for d in _abort_domains):
                        route.abort()
                        return

                    try:
                        resp = session.get(
                            req_url, timeout=10,
                            allow_redirects=True,
                        )
                        hdrs = {
                            k: v for k, v in resp.headers.items()
                            if k.lower() not in _skip_headers
                        }
                        route.fulfill(
                            status=resp.status_code,
                            headers=hdrs,
                            body=resp.content,
                        )
                    except Exception:
                        try:
                            route.continue_()
                        except Exception:
                            route.abort()

                browser2, ctx2 = _launch_context(pw)
                page2 = ctx2.new_page()
                _apply_stealth(page2)
                page2.route("**/*", _proxy_intercept)

                page2.goto(url, wait_until='domcontentloaded', timeout=30000)
                try:
                    page2.wait_for_load_state('networkidle', timeout=12000)
                except Exception:
                    pass
                page2.wait_for_timeout(2000)
                page2.screenshot(path=full_path, full_page=False)
                browser2.close()

                if self._validate_screenshot(full_path, filepath):
                    return filepath
                return None

        except Exception as e:
            logger.warning(f"Playwright screenshot failed for {url}: {e}", exc_info=True)
            if os.path.exists(full_path):
                os.remove(full_path)
            return None

    def _fetch_html_curl(self, url: str) -> str | None:
        """Fetch page HTML using curl_cffi with Chrome TLS impersonation."""
        try:
            from curl_cffi import requests as curl_req
            resp = curl_req.get(url, impersonate='chrome', timeout=20, allow_redirects=True)
            if resp.status_code == 200 and len(resp.text) > 200:
                return resp.text
        except ImportError:
            logger.info("curl_cffi not installed — cannot bypass TLS fingerprint checks")
        except Exception as e:
            logger.warning(f"curl_cffi fetch failed for {url}: {e}")
        return None

    def _validate_screenshot(self, full_path: str, filepath: str, min_colors: int = 0) -> bool:
        """Check that a screenshot file is a valid, non-tiny image.
        
        Args:
            full_path: Absolute path to the image file
            filepath: Relative path (for logging)
            min_colors: Minimum unique colours required (0 = skip check).
                        Useful to reject unstyled / plain-text renders.
        """
        try:
            img = Image.open(full_path)
            img.verify()
            file_size = os.path.getsize(full_path)
            if file_size < 5000:
                logger.warning(f"Screenshot too small ({file_size}B) — likely blank")
                os.remove(full_path)
                return False

            # Optional colour-richness check
            if min_colors > 0:
                img2 = Image.open(full_path).convert('RGB')
                sampled = img2.resize((480, 270), Image.Resampling.LANCZOS)
                unique = len(set(sampled.getdata()))
                if unique < min_colors:
                    logger.warning(
                        f"Screenshot only has {unique} unique colours "
                        f"(need {min_colors}) — likely unstyled"
                    )
                    os.remove(full_path)
                    return False

            logger.info(f"Screenshot captured: {filepath} ({file_size:,}B)")
            return True
        except Exception:
            if os.path.exists(full_path):
                os.remove(full_path)
            return False

    def _capture_screenshot_api(self, url: str, snapshot_id: int) -> str | None:
        """
        Capture screenshot using external API services as fallback.
        Used when Playwright is blocked by Cloudflare or fails.
        """
        filename = f"snapshot_{snapshot_id}_{hashlib.md5(url.encode()).hexdigest()[:8]}.png"
        filepath = os.path.join('screenshots', filename)
        full_path = os.path.join(settings.MEDIA_ROOT, filepath)
        os.makedirs(os.path.dirname(full_path), exist_ok=True)

        screenshot_apis = [
            f"https://image.thum.io/get/width/1920/crop/1080/noanimate/{url}",
            f"https://api.screenshotone.com/take?url={url}&viewport_width=1920&viewport_height=1080&format=png&access_key=free",
            f"https://shot.screenshotapi.net/screenshot?url={url}&output=image&file_type=png&wait_for_event=load",
        ]
        
        for api_url in screenshot_apis:
            try:
                logger.info(f"Trying screenshot API: {api_url[:80]}...")
                response = requests.get(api_url, timeout=45, headers=self.headers)
                
                content_type = response.headers.get('Content-Type', '')
                if response.status_code == 200 and ('image' in content_type or len(response.content) > 10000):
                    # Validate it's actually an image
                    try:
                        img = Image.open(io.BytesIO(response.content))
                        img.verify()
                    except Exception:
                        continue
                    
                    with open(full_path, 'wb') as f:
                        f.write(response.content)
                    
                    file_size = os.path.getsize(full_path)
                    logger.info(f"API screenshot captured: {filepath} ({file_size:,}B)")
                    return filepath
                    
            except Exception as e:
                logger.warning(f"Screenshot API failed ({api_url[:60]}): {e}")
                continue
            
        return None

    def compute_visual_hash(self, image_path: str) -> str:
        """Compute a perceptual hash for visual comparison."""
        try:
            full_path = os.path.join(settings.MEDIA_ROOT, image_path)
            img = Image.open(full_path)
            img = img.convert('L').resize((8, 8), Image.Resampling.LANCZOS)
            pixels = list(img.getdata())
            avg = sum(pixels) / len(pixels)
            bits = ''.join('1' if p > avg else '0' for p in pixels)
            return hex(int(bits, 2))[2:].zfill(16)
        except Exception:
            return ''

    def compare_hashes(self, hash1: str, hash2: str) -> float:
        """Compare two perceptual hashes. Returns similarity 0-1."""
        if not hash1 or not hash2 or len(hash1) != len(hash2):
            return 0.0
        
        # Convert hex to binary and compare
        try:
            bin1 = bin(int(hash1, 16))[2:].zfill(64)
            bin2 = bin(int(hash2, 16))[2:].zfill(64)
            matching = sum(1 for a, b in zip(bin1, bin2) if a == b)
            return matching / 64.0
        except ValueError:
            return 0.0
