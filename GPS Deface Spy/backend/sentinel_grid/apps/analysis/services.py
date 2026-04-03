import random
import logging
import math
import difflib
import re
from typing import Dict, List, Tuple
from django.utils import timezone

from .models import AnalysisResult
from apps.monitoring.models import Snapshot

logger = logging.getLogger(__name__)


class AnalysisService:
    """Service for performing website defacement analysis using 8x8 matrix."""
    
    GRID_SIZE = 8
    TOTAL_BLOCKS = 64
    
    # Severity thresholds
    SEVERITY_THRESHOLDS = {
        'low': (0, 5),
        'medium': (5, 20),
        'high': (20, 50),
        'critical': (50, 100),
    }

    # ─── Known defacement signatures / IOCs ──────────────────────────────
    DEFACEMENT_KEYWORDS = [
        'hacked by', 'defaced by', 'owned by', 'pwned',
        'greetz', 'greetings', 'cyber army', 'hacktivist',
        'we are', 'team', 'security breach', 'security warning',
        'your site has been', 'this website has been',
        'index of /', 'directory listing',
        'shell', 'c99', 'r57', 'wso', 'b374k',
        'mafia', 'anonymous', 'legion',
        'muslim', 'palestine', 'free palestine', 'islam',
        '政治', 'propaganda',
    ]

    SUSPICIOUS_PATTERNS = [
        r'<marquee[^>]*>',                       # Classic defacement scrolling text
        r'<bgsound[^>]*>',                       # Background sound
        r'background\s*:\s*url\([^)]*\)',         # Injected backgrounds
        r'document\.write\s*\(',                  # JS injection
        r'eval\s*\(',                             # Eval injection
        r'base64[,;]',                            # Base64 payloads
        r'data:text/html',                        # Data URI injection
        r'<iframe[^>]+src\s*=\s*["\'](?!about:)', # Injected iframes
    ]

    def analyze_snapshot(self, snapshot: Snapshot) -> AnalysisResult:
        """
        Analyze a snapshot against its baseline.
        
        Args:
            snapshot: The snapshot to analyze
            
        Returns:
            AnalysisResult object with analysis data
        """
        website = snapshot.website
        
        # Get baseline snapshot
        baseline = website.snapshots.filter(is_baseline=True).first()
        
        if not baseline:
            logger.warning(f"No baseline found for website {website.id}")
            return self._create_empty_result(snapshot)
        
        # Perform matrix comparison
        matrix_data, changed_blocks = self._compare_matrices(baseline, snapshot)
        
        # Calculate metrics
        change_percentage = (changed_blocks / self.TOTAL_BLOCKS) * 100
        similarity_score = 100 - change_percentage
        confidence_score = self._calculate_confidence(
            matrix_data, changed_blocks,
            baseline.html_content or '', snapshot.html_content or '',
        )
        
        # Determine severity
        severity = self._classify_severity(change_percentage)
        
        # Detect defacement using multi-signal approach.
        # Pure quantity thresholds produce false positives on dynamic sites
        # (news tickers, rotating ads, live scores). We require a combination
        # of: scale of change + block magnitude + keyword/pattern evidence.
        block_details = matrix_data.get('block_details', [])
        high_mag_blocks = sum(
            1 for b in block_details
            if b.get('changed') and b.get('magnitude', 0) > 0.35
        )
        keyword_hits = self._detect_defacement_keywords(snapshot.html_content or '')
        pattern_hits = self._detect_suspicious_patterns(snapshot.html_content or '')

        is_defacement = (
            (change_percentage > 25) or              # 25%+ of page area changed
            (changed_blocks > 15) or                 # 15+ grid blocks flagged
            (high_mag_blocks >= 3) or               # 3+ heavily-changed blocks (>35%)
            (keyword_hits > 0 and changed_blocks >= 1) or  # defacement keywords + visual
            (pattern_hits >= 2)                      # multiple suspicious code patterns
        )
        
        # Generate AI explanation
        ai_explanation = self._generate_explanation(
            changed_blocks, change_percentage, severity, matrix_data
        )
        
        # Identify specific changes
        visual_changes = self._identify_visual_changes(matrix_data)
        content_changes = self._identify_content_changes(matrix_data)
        
        # Create analysis result
        result = AnalysisResult.objects.create(
            snapshot=snapshot,
            baseline_snapshot=baseline,
            matrix_data=matrix_data,
            changed_blocks=changed_blocks,
            total_blocks=self.TOTAL_BLOCKS,
            change_percentage=round(change_percentage, 2),
            confidence_score=round(confidence_score, 2),
            similarity_score=round(similarity_score, 2),
            severity=severity,
            is_defacement_detected=is_defacement,
            ai_explanation=ai_explanation,
            visual_changes=visual_changes,
            content_changes=content_changes,
        )
        
        # Create incident and alert if defacement detected
        if is_defacement:
            self._create_incident_and_alert(result)
        
        return result

    def _compare_matrices(
        self, baseline: Snapshot, current: Snapshot
    ) -> Tuple[Dict, int]:
        """
        Compare two snapshots using 8×8 matrix grid.

        The page HTML is divided into 64 equal-length text blocks.  Each
        block is compared via SequenceMatcher to produce a real change
        magnitude.  If screenshot images exist, pixel-level comparison
        is layered on top for higher fidelity.
        """
        matrix_data: Dict = {
            'grid': [],
            'block_details': [],
        }
        changed_blocks = 0

        # If comparing the same snapshot (baseline scan), everything is safe
        same_snapshot = (baseline.id == current.id)

        if same_snapshot:
            for row in range(self.GRID_SIZE):
                row_data = []
                for col in range(self.GRID_SIZE):
                    block_id = row * self.GRID_SIZE + col
                    row_data.append(0)
                    matrix_data['block_details'].append({
                        'id': block_id, 'row': row, 'col': col,
                        'changed': False, 'magnitude': 0.0, 'type': None,
                    })
                matrix_data['grid'].append(row_data)
            return matrix_data, 0

        # ── Real comparison ──────────────────────────────────────────
        base_html = (baseline.html_content or '').strip()
        curr_html = (current.html_content or '').strip()

        # Extract visible text content (strip scripts, styles, tags, timestamps).
        # Comparing visible text rather than raw HTML avoids false positives from
        # JS changes, HTML attribute updates, and dynamic timestamp values.
        base_norm = self._extract_visible_text_for_comparison(base_html)
        curr_norm = self._extract_visible_text_for_comparison(curr_html)

        # Split into 64 equal-length text chunks
        base_chunks = self._split_into_chunks(base_norm, self.TOTAL_BLOCKS)
        curr_chunks = self._split_into_chunks(curr_norm, self.TOTAL_BLOCKS)

        # ── Optional: pixel-level screenshot comparison ──────────────
        pixel_magnitudes = self._compare_screenshots(baseline, current)

        for row in range(self.GRID_SIZE):
            row_data = []
            for col in range(self.GRID_SIZE):
                block_id = row * self.GRID_SIZE + col

                # Text-based change magnitude
                b_chunk = base_chunks[block_id] if block_id < len(base_chunks) else ''
                c_chunk = curr_chunks[block_id] if block_id < len(curr_chunks) else ''
                text_ratio = difflib.SequenceMatcher(None, b_chunk, c_chunk).ratio()
                text_magnitude = 1.0 - text_ratio  # 0 = identical, 1 = fully changed

                # Blend with pixel magnitude if available.
                # Require corroborating signals: both text AND pixel must agree
                # (or one must be very strong alone) to avoid flagging dynamic
                # content like ads, score tickers, rotating banners.
                if pixel_magnitudes:
                    pixel_mag = pixel_magnitudes[block_id]
                    magnitude = 0.4 * text_magnitude + 0.6 * pixel_mag
                    is_changed = (
                        (pixel_mag > 0.20 and text_magnitude > 0.08) or  # both agree
                        magnitude > 0.22 or                               # strong combined
                        text_magnitude > 0.40                             # major text-only
                    )
                else:
                    magnitude = text_magnitude
                    is_changed = magnitude > 0.25  # text-only: require clear structural change
                change_type = self._get_change_type(magnitude) if is_changed else None

                row_data.append(1 if is_changed else 0)
                matrix_data['block_details'].append({
                    'id': block_id,
                    'row': row,
                    'col': col,
                    'changed': is_changed,
                    'magnitude': round(magnitude, 3),
                    'type': change_type,
                })
                if is_changed:
                    changed_blocks += 1

            matrix_data['grid'].append(row_data)

        return matrix_data, changed_blocks

    # ── Helpers ──────────────────────────────────────────────────────
    def _extract_visible_text_for_comparison(self, html: str) -> str:
        """
        Extract meaningful visible text content from HTML for defacement
        comparison.  Strips <script>/<style> blocks, all HTML tags,
        and common dynamic values (timestamps, dates) so the
        SequenceMatcher focuses on changes that a human visitor would
        actually see rather than back-end markup / JS churn.
        """
        # Remove script and style blocks entirely
        text = re.sub(r'<(script|style)[^>]*>.*?</\1>', '', html,
                      flags=re.DOTALL | re.IGNORECASE)
        # Remove HTML comments
        text = re.sub(r'<!--.*?-->', '', text, flags=re.DOTALL)
        # Strip all remaining HTML tags — keep only visible text content
        text = re.sub(r'<[^>]+>', ' ', text)
        # Normalize dynamic temporal values that change every render
        text = re.sub(r'\b\d{1,2}:\d{2}(:\d{2})?\s*(am|pm)?\b', '', text,
                      flags=re.IGNORECASE)
        text = re.sub(r'\b\d{1,2}[/\-]\d{1,2}[/\-]\d{2,4}\b', '', text)
        # Normalize whitespace
        text = re.sub(r'\s+', ' ', text).strip()
        return text

    @staticmethod
    def _split_into_chunks(text: str, n: int) -> List[str]:
        """Split *text* into *n* roughly equal chunks."""
        if not text:
            return [''] * n
        chunk_size = max(len(text) // n, 1)
        chunks = [text[i * chunk_size:(i + 1) * chunk_size] for i in range(n)]
        # Append any remainder to the last chunk
        remainder = text[n * chunk_size:]
        if remainder and chunks:
            chunks[-1] += remainder
        return chunks

    def _compare_screenshots(self, baseline: Snapshot, current: Snapshot) -> List[float] | None:
        """
        If both snapshots have screenshots, divide them into an 8×8 grid
        and compute per-block pixel difference.  Returns a list of 64
        magnitudes (0-1) or None if comparison is unavailable.
        """
        from PIL import Image as PILImage
        import os, numpy as np
        from django.conf import settings

        if not baseline.screenshot or not current.screenshot:
            return None

        try:
            base_path = os.path.join(settings.MEDIA_ROOT, str(baseline.screenshot))
            curr_path = os.path.join(settings.MEDIA_ROOT, str(current.screenshot))
            if not os.path.isfile(base_path) or not os.path.isfile(curr_path):
                return None

            base_img = PILImage.open(base_path).convert('RGB')
            curr_img = PILImage.open(curr_path).convert('RGB')

            # Resize both to a common resolution for fair comparison
            target = (960, 540)
            base_img = base_img.resize(target, PILImage.Resampling.LANCZOS)
            curr_img = curr_img.resize(target, PILImage.Resampling.LANCZOS)

            # Apply Gaussian blur before comparison to eliminate rendering noise:
            # JPEG compression artifacts, anti-aliasing differences, sub-pixel
            # rendering variations between browser renders would otherwise
            # trigger false positives at low thresholds.
            from PIL import ImageFilter
            base_img = base_img.filter(ImageFilter.GaussianBlur(radius=2))
            curr_img = curr_img.filter(ImageFilter.GaussianBlur(radius=2))

            base_arr = np.array(base_img, dtype=np.float32) / 255.0
            curr_arr = np.array(curr_img, dtype=np.float32) / 255.0

            h, w, _ = base_arr.shape
            bh, bw = h // self.GRID_SIZE, w // self.GRID_SIZE

            magnitudes: List[float] = []
            for row in range(self.GRID_SIZE):
                for col in range(self.GRID_SIZE):
                    b_block = base_arr[row * bh:(row + 1) * bh, col * bw:(col + 1) * bw]
                    c_block = curr_arr[row * bh:(row + 1) * bh, col * bw:(col + 1) * bw]
                    diff = np.mean(np.abs(b_block - c_block))
                    # Non-linear scaling with noise floor:
                    # Diffs below 2.5% mean are rendering noise → output zero.
                    # Beyond the floor, scale aggressively so real content
                    # changes (defacement overlays, replaced images) register
                    # clearly while tiny natural variations stay invisible.
                    noise_floor = 0.025
                    magnitudes.append(float(min(max(0.0, diff - noise_floor) * 10.0, 1.0)))

            return magnitudes
        except Exception as e:
            logger.warning(f"Screenshot comparison failed: {e}")
            return None

    def _get_change_type(self, magnitude: float) -> str:
        """Classify the type of change based on magnitude."""
        if magnitude < 0.3:
            return 'minor_visual'
        elif magnitude < 0.6:
            return 'content_modification'
        else:
            return 'major_structural'

    def _calculate_confidence(self, matrix_data: Dict, changed_blocks: int,
                              baseline_html: str = '', current_html: str = '') -> float:
        """
        Calculate confidence score using multi-signal analysis:
        - Change pattern spatial distribution
        - Defacement keyword signals
        - Structural pattern anomalies
        """
        # Base confidence from change block count
        if changed_blocks == 0:
            confidence = 99.0
        elif changed_blocks <= 2:
            confidence = 92.0
        elif changed_blocks <= 5:
            confidence = 88.0
        elif changed_blocks <= 10:
            confidence = 85.0
        elif changed_blocks <= 25:
            confidence = 82.0
        else:
            confidence = 78.0

        # Boost: check spatial clustering (clustered changes = higher confidence)
        block_details = matrix_data.get('block_details', [])
        changed_positions = [(b['row'], b['col']) for b in block_details if b.get('changed')]
        if len(changed_positions) >= 2:
            cluster_bonus = self._spatial_cluster_score(changed_positions)
            confidence += cluster_bonus * 5.0  # up to +5 pts

        # Boost: defacement keyword detection in current HTML
        if current_html:
            keyword_hits = self._detect_defacement_keywords(current_html)
            pattern_hits = self._detect_suspicious_patterns(current_html)
            confidence += min(keyword_hits * 3.0, 8.0)   # up to +8 pts
            confidence += min(pattern_hits * 2.0, 6.0)    # up to +6 pts

        # Boost: magnitude variance analysis
        magnitudes = [b['magnitude'] for b in block_details if b.get('changed')]
        if magnitudes:
            avg_mag = sum(magnitudes) / len(magnitudes)
            if avg_mag > 0.6:
                confidence += 4.0
            elif avg_mag > 0.3:
                confidence += 2.0

        return min(confidence, 99.5)

    @staticmethod
    def _spatial_cluster_score(positions: List[Tuple[int, int]]) -> float:
        """Score how spatially clustered the changed blocks are (0-1).
        Clustered = likely real defacement; scattered = likely noise."""
        if len(positions) < 2:
            return 0.0
        total_dist, count = 0.0, 0
        for i in range(len(positions)):
            for j in range(i + 1, len(positions)):
                d = math.sqrt((positions[i][0] - positions[j][0]) ** 2 +
                              (positions[i][1] - positions[j][1]) ** 2)
                total_dist += d
                count += 1
        avg_dist = total_dist / max(count, 1)
        max_possible = math.sqrt(7 ** 2 + 7 ** 2)  # diagonal of 8x8 grid
        return 1.0 - min(avg_dist / max_possible, 1.0)

    def _detect_defacement_keywords(self, html: str) -> int:
        """Count how many defacement keywords appear in the HTML."""
        lower = html.lower()
        return sum(1 for kw in self.DEFACEMENT_KEYWORDS if kw in lower)

    def _detect_suspicious_patterns(self, html: str) -> int:
        """Count suspicious regex patterns in the HTML."""
        count = 0
        for pat in self.SUSPICIOUS_PATTERNS:
            if re.search(pat, html, re.IGNORECASE):
                count += 1
        return count

    def _classify_severity(self, change_percentage: float) -> str:
        """Classify severity based on change percentage."""
        for severity, (low, high) in self.SEVERITY_THRESHOLDS.items():
            if low <= change_percentage < high:
                return severity
        return 'critical'

    def _generate_explanation(
        self,
        changed_blocks: int,
        change_percentage: float,
        severity: str,
        matrix_data: Dict
    ) -> str:
        """Generate AI-like explanation of the analysis."""
        if changed_blocks == 0:
            return "No significant changes detected. The website appears identical to the baseline."
        
        severity_descriptions = {
            'low': 'Minor changes detected that are likely normal updates.',
            'medium': 'Moderate changes detected that warrant review.',
            'high': 'Significant changes detected that may indicate tampering.',
            'critical': 'Critical changes detected! Immediate investigation required.',
        }
        
        explanation = f"""Analysis Summary:
- {changed_blocks} out of {self.TOTAL_BLOCKS} grid blocks show changes ({change_percentage:.1f}%)
- Severity Level: {severity.upper()}
- {severity_descriptions.get(severity, '')}

The 8x8 matrix analysis divided the page into 64 equal sections and compared each section 
against the baseline. Changes were detected in multiple regions of the page."""
        
        return explanation

    def _identify_visual_changes(self, matrix_data: Dict) -> List[Dict]:
        """Identify visual changes from matrix data."""
        changes = []
        for block in matrix_data.get('block_details', []):
            if block['changed'] and block['type'] in ['minor_visual', 'major_structural']:
                changes.append({
                    'block_id': block['id'],
                    'location': f"Row {block['row'] + 1}, Column {block['col'] + 1}",
                    'type': block['type'],
                    'magnitude': block['magnitude'],
                })
        return changes

    def _identify_content_changes(self, matrix_data: Dict) -> List[Dict]:
        """Identify content changes from matrix data."""
        changes = []
        for block in matrix_data.get('block_details', []):
            if block['changed'] and block['type'] == 'content_modification':
                changes.append({
                    'block_id': block['id'],
                    'location': f"Row {block['row'] + 1}, Column {block['col'] + 1}",
                    'type': block['type'],
                    'magnitude': block['magnitude'],
                })
        return changes

    def _create_empty_result(self, snapshot: Snapshot) -> AnalysisResult:
        """Create an empty analysis result when baseline is missing."""
        return AnalysisResult.objects.create(
            snapshot=snapshot,
            baseline_snapshot=None,
            matrix_data={'grid': [], 'block_details': []},
            changed_blocks=0,
            total_blocks=self.TOTAL_BLOCKS,
            change_percentage=0.0,
            confidence_score=0.0,
            similarity_score=100.0,
            severity='low',
            is_defacement_detected=False,
            ai_explanation='No baseline available for comparison.',
            visual_changes=[],
            content_changes=[],
        )

    def _create_incident_and_alert(self, analysis_result: AnalysisResult):
        """Create incident and alert for detected defacement."""
        from apps.alerts.models import Incident, Alert
        from apps.alerts.services import AlertService
        
        snapshot = analysis_result.snapshot
        website = snapshot.website
        
        # Create incident
        incident = Incident.objects.create(
            website=website,
            snapshot=snapshot,
            analysis_result=analysis_result,
            severity=analysis_result.severity,
            title=f"Defacement detected on {website.name}",
            description=analysis_result.ai_explanation,
            change_percentage=analysis_result.change_percentage,
            affected_blocks=analysis_result.changed_blocks,
        )
        
        # Create alert
        alert = Alert.objects.create(
            incident=incident,
            website=website,
            severity=analysis_result.severity,
            title=f"Alert: {analysis_result.severity.upper()} severity defacement",
            message=f"Defacement detected on {website.name}. {analysis_result.changed_blocks} blocks changed ({analysis_result.change_percentage}%).",
        )
        
        # Send notification for high/critical severity
        if analysis_result.severity in ['high', 'critical']:
            alert_service = AlertService()
            alert_service.send_notification(alert)
        
        return incident, alert
