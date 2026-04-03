from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter

from .models import Website, Snapshot
from .serializers import (
    WebsiteSerializer,
    WebsiteCreateSerializer,
    WebsiteUpdateSerializer,
    SnapshotSerializer,
    TriggerScanSerializer,
)
from .services import CaptureService
from apps.analysis.services import AnalysisService


class WebsiteViewSet(viewsets.ModelViewSet):
    """ViewSet for Website CRUD operations.

    Admin   \u2013 full CRUD, scan, set_baseline. Sees only own websites.
    Analyst \u2013 read-only access to ALL websites (for investigation).
    """

    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['status']
    search_fields = ['name', 'url', 'description']
    ordering_fields = ['created_at', 'name', 'last_scan']
    ordering = ['-created_at']

    def get_queryset(self):
        if self.request.user.role == 'analyst':
            # Analysts can view ALL websites for investigation
            return Website.objects.all()
        return Website.objects.filter(user=self.request.user)

    def get_serializer_class(self):
        if self.action == 'create':
            return WebsiteCreateSerializer
        elif self.action in ['update', 'partial_update']:
            return WebsiteUpdateSerializer
        return WebsiteSerializer

    @action(detail=True, methods=['post'])
    def scan(self, request, pk=None):
        """Trigger a scan for the website."""
        website = self.get_object()
        serializer = TriggerScanSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        set_as_baseline = serializer.validated_data.get('set_as_baseline', False)
        
        # Create a new snapshot
        snapshot = Snapshot.objects.create(
            website=website,
            is_baseline=set_as_baseline
        )
        
        # Capture website content
        capture_service = CaptureService()
        
        try:
            capture_result = capture_service.capture_website(website.url, snapshot.id)
            
            if capture_result.get('error'):
                snapshot.status = 'failed'
                snapshot.error_message = capture_result['error']
                snapshot.save()
                return Response({
                    'error': f"Capture failed: {capture_result['error']}"
                }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            
            # Update snapshot with captured data
            snapshot.html_content = capture_result.get('html_content', '')
            snapshot.http_status_code = capture_result.get('http_status_code')
            snapshot.response_time = capture_result.get('response_time')
            if capture_result.get('screenshot'):
                snapshot.screenshot = capture_result['screenshot']
            snapshot.status = 'completed'
            snapshot.save()
            
            # Update website
            website.last_scan = timezone.now()
            
            if set_as_baseline:
                website.is_baseline_set = True
                if snapshot.screenshot:
                    website.baseline_screenshot = snapshot.screenshot
            
            website.save()
            
            # Run analysis if not baseline
            if not set_as_baseline and website.is_baseline_set:
                analysis_service = AnalysisService()
                analysis_service.analyze_snapshot(snapshot)
            elif set_as_baseline:
                # For baseline scans, also create an initial analysis
                # comparing baseline against itself (0% change = safe)
                analysis_service = AnalysisService()
                analysis_service.analyze_snapshot(snapshot)
            
            return Response({
                'message': 'Scan completed successfully',
                'snapshot': SnapshotSerializer(snapshot).data
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            snapshot.status = 'failed'
            snapshot.error_message = str(e)
            snapshot.save()
            
            return Response({
                'error': f'Scan failed: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['post'])
    def set_baseline(self, request, pk=None):
        """Set the latest snapshot as baseline."""
        website = self.get_object()
        latest_snapshot = website.snapshots.filter(status='completed').first()
        
        if not latest_snapshot:
            return Response({
                'error': 'No completed snapshot available to set as baseline'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Clear previous baselines
        website.snapshots.filter(is_baseline=True).update(is_baseline=False)
        
        # Set new baseline
        latest_snapshot.is_baseline = True
        latest_snapshot.save()
        
        website.is_baseline_set = True
        if latest_snapshot.screenshot:
            website.baseline_screenshot = latest_snapshot.screenshot
        website.save()
        
        return Response({
            'message': 'Baseline set successfully',
            'snapshot': SnapshotSerializer(latest_snapshot).data
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['get'])
    def snapshots(self, request, pk=None):
        """Get all snapshots for a website."""
        website = self.get_object()
        snapshots = website.snapshots.all()
        serializer = SnapshotSerializer(snapshots, many=True)
        return Response(serializer.data)


class SnapshotViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for Snapshot read operations."""
    
    permission_classes = [IsAuthenticated]
    serializer_class = SnapshotSerializer
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = ['status', 'is_baseline']
    ordering = ['-created_at']

    def get_queryset(self):
        if self.request.user.role == 'analyst':
            return Snapshot.objects.all()
        return Snapshot.objects.filter(website__user=self.request.user)

    @action(detail=True, methods=['get'])
    def html_content(self, request, pk=None):
        """Get the HTML content of a snapshot for live preview."""
        snapshot = self.get_object()
        return Response({
            'html_content': snapshot.html_content,
            'website_url': snapshot.website.url,
            'captured_at': snapshot.created_at,
            'status': snapshot.status,
        })


class ProxyViewSet(viewsets.ViewSet):
    """ViewSet for proxying website content."""
    
    permission_classes = [AllowAny]  # Allow unauthenticated access for fetching public websites

    def _fetch_html(self, url, strip_scripts=False):
        """Shared helper: fetch a URL and return (html_with_base, status_code).
        
        Args:
            url: Website URL to fetch.
            strip_scripts: If True, remove all <script> tags and inline JS
                           so the page renders as a static visual preview
                           without client-side errors.
        """
        import warnings
        warnings.filterwarnings('ignore', message='Unverified HTTPS request')
        
        from urllib.parse import urlparse
        import re
        
        parsed = urlparse(url)
        hostname = (parsed.hostname or '').lower()
        is_local_target = (
            hostname == 'localhost' or
            hostname.startswith('127.') or
            hostname.startswith('10.') or
            hostname.startswith('192.168.') or
            re.match(r'^172\.(1[6-9]|2\d|3[0-1])\.', hostname)
        )

        candidate_urls = [url]
        if is_local_target and parsed.scheme == 'https':
            # Local dev servers are typically HTTP only; try this first to
            # avoid waiting on TLS handshake/timeouts.
            candidate_urls.insert(0, url.replace('https://', 'http://', 1))

        last_error = None
        response = None
        html = ''
        status_code = None

        for candidate in candidate_urls:
            try:
                if not is_local_target:
                    # Use curl_cffi with Chrome impersonation to bypass CDN bot detection
                    # (Akamai, CloudFlare, etc. block based on TLS fingerprint)
                    from curl_cffi import requests as curl_req
                    response = curl_req.get(
                        candidate,
                        impersonate='chrome',
                        timeout=20,
                        allow_redirects=True,
                    )
                    html = response.text
                    status_code = response.status_code
                    url = candidate
                    break
            except Exception as e:
                last_error = e

            try:
                # Local targets: use direct requests path immediately (faster).
                import requests as req_lib
                headers = {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'Sec-Fetch-Dest': 'document',
                    'Sec-Fetch-Mode': 'navigate',
                    'Sec-Fetch-Site': 'none',
                    'Sec-Fetch-User': '?1',
                    'Sec-Ch-Ua': '"Chromium";v="131", "Not_A Brand";v="24"',
                    'Sec-Ch-Ua-Mobile': '?0',
                    'Sec-Ch-Ua-Platform': '"Windows"',
                    'Upgrade-Insecure-Requests': '1',
                }
                session = req_lib.Session()
                session.headers.update(headers)
                timeout = (3, 8) if is_local_target else (10, 20)
                response = session.get(candidate, timeout=timeout, verify=False, allow_redirects=True)
                html = response.text
                status_code = response.status_code
                url = candidate
                break
            except Exception as e:
                last_error = e

        if response is None:
            raise last_error or RuntimeError('Failed to fetch URL')
        
        parsed_final = urlparse(url)
        base_url = f"{parsed_final.scheme}://{parsed_final.netloc}"
        
        if strip_scripts:
            # Remove all <script> tags and their content
            html = re.sub(r'<script[^>]*>[\s\S]*?</script>', '', html, flags=re.IGNORECASE)
            # Remove <script ... /> self-closing tags
            html = re.sub(r'<script[^>]*/>', '', html, flags=re.IGNORECASE)
            # Remove inline event handlers (onclick, onerror, onload, etc.)
            html = re.sub(r'\s+on\w+\s*=\s*"[^"]*"', '', html, flags=re.IGNORECASE)
            html = re.sub(r"\s+on\w+\s*=\s*'[^']*'", '', html, flags=re.IGNORECASE)
            # Remove javascript: URLs in href attributes
            html = re.sub(r'href\s*=\s*"javascript:[^"]*"', 'href="#"', html, flags=re.IGNORECASE)
            html = re.sub(r"href\s*=\s*'javascript:[^']*'", "href='#'", html, flags=re.IGNORECASE)
            # Remove <noscript> tags AND their content (avoids "JavaScript disabled" warnings)
            html = re.sub(r'<noscript[^>]*>[\s\S]*?</noscript>', '', html, flags=re.IGNORECASE)
        
        # Always inject <base> tag for relative URLs
        head_lower = html.lower()
        if '<head>' in head_lower or '<head ' in head_lower:
            html = re.sub(
                r'(<head[^>]*>)',
                rf'\1<base href="{base_url}" target="_blank">',
                html, count=1, flags=re.IGNORECASE,
            )
        else:
            html = f'<base href="{base_url}" target="_blank">\n{html}'
        
        return html, status_code or response.status_code

    @action(detail=False, methods=['get'])
    def fetch(self, request):
        """Fetch a website's content through the server (bypasses CORS). Returns JSON."""
        url = request.query_params.get('url')
        if not url:
            return Response({'error': 'URL parameter required'}, status=400)
        
        try:
            html, status_code = self._fetch_html(url)
            return Response({
                'html': html,
                'status_code': status_code,
                'url': url,
            })
        except Exception as e:
            err = str(e).lower()
            if 'timeout' in err:
                return Response({'error': f'Timeout fetching {url} - site may be slow or unreachable'}, status=504)
            elif 'connect' in err or 'resolve' in err:
                return Response({'error': f'Cannot connect to {url} - check the URL and try again'}, status=502)
            return Response({'error': str(e)}, status=500)

    @action(detail=False, methods=['get'])
    def page(self, request):
        """
        Serve a website's HTML directly as a page (for iframe src embedding).
        Returns raw HTML with Content-Type: text/html so the browser renders it natively.
        The response is exempted from X-Frame-Options so it can be rendered inside an iframe.
        """
        from django.http import HttpResponse
        
        url = request.query_params.get('url')
        if not url:
            resp = HttpResponse(
                '<html><body style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;color:#888;">'
                '<p>No URL specified</p></body></html>',
                content_type='text/html', status=400,
            )
            resp['X-Frame-Options'] = 'ALLOWALL'
            return resp
        
        try:
            html, _ = self._fetch_html(url, strip_scripts=True)
            resp = HttpResponse(html, content_type='text/html; charset=utf-8')
            # Remove X-Frame-Options so iframe can render this page
            resp['X-Frame-Options'] = 'ALLOWALL'
            # Block any remaining inline scripts via CSP (visual-only preview)
            resp['Content-Security-Policy'] = "script-src 'none';"
            return resp
        except Exception as e:
            err = str(e).lower()
            if 'timeout' in err:
                resp = HttpResponse(
                    '<html><body style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;color:#c33;">'
                    f'<div style="text-align:center"><h2>Timeout</h2><p>{url} took too long to respond</p></div></body></html>',
                    content_type='text/html', status=504,
                )
                resp['X-Frame-Options'] = 'ALLOWALL'
                return resp
            if 'connect' in err or 'resolve' in err:
                resp = HttpResponse(
                    '<html><body style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;color:#c33;">'
                    f'<div style="text-align:center"><h2>Connection Failed</h2><p>Cannot reach {url}</p></div></body></html>',
                    content_type='text/html', status=502,
                )
                resp['X-Frame-Options'] = 'ALLOWALL'
                return resp
            resp = HttpResponse(
                '<html><body style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;color:#c33;">'
                f'<div style="text-align:center"><h2>Error</h2><p>{str(e)}</p></div></body></html>',
                content_type='text/html', status=500,
            )
            resp['X-Frame-Options'] = 'ALLOWALL'
            return resp
