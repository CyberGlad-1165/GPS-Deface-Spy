from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import OrderingFilter

from .models import AnalysisResult
from .serializers import AnalysisResultSerializer, AnalysisResultSummarySerializer
from .services import AnalysisService
from apps.monitoring.models import Snapshot


class AnalysisResultViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for viewing analysis results."""
    
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = ['severity', 'is_defacement_detected']
    ordering_fields = ['created_at', 'change_percentage', 'severity']
    ordering = ['-created_at']

    def get_queryset(self):
        if self.request.user.role == 'analyst':
            # Analysts see ALL analysis results for investigation
            return AnalysisResult.objects.all().select_related(
                'snapshot', 'snapshot__website', 'baseline_snapshot'
            )
        return AnalysisResult.objects.filter(
            snapshot__website__user=self.request.user
        ).select_related('snapshot', 'snapshot__website', 'baseline_snapshot')

    def get_serializer_class(self):
        return AnalysisResultSerializer

    @action(detail=True, methods=['get'])
    def matrix(self, request, pk=None):
        """Get the matrix comparison data for an analysis."""
        analysis = self.get_object()
        return Response({
            'matrix_data': analysis.matrix_data,
            'changed_blocks': analysis.changed_blocks,
            'total_blocks': analysis.total_blocks,
            'change_percentage': analysis.change_percentage,
        })

    @action(detail=False, methods=['post'])
    def compare(self, request):
        """Manually trigger analysis comparison between two snapshots.
        
        If the snapshot already has an analysis, a FRESH re-scan is
        performed: a new snapshot is captured (with screenshot) and
        analysed against the website's baseline snapshot.
        """
        from apps.monitoring.services import CaptureService
        from django.utils import timezone

        snapshot_id = request.data.get('snapshot_id')
        
        if not snapshot_id:
            return Response({
                'error': 'snapshot_id is required'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            if request.user.role == 'analyst':
                snapshot = Snapshot.objects.get(id=snapshot_id)
            else:
                snapshot = Snapshot.objects.get(
                    id=snapshot_id,
                    website__user=request.user
                )
        except Snapshot.DoesNotExist:
            return Response({
                'error': 'Snapshot not found'
            }, status=status.HTTP_404_NOT_FOUND)
        
        website = snapshot.website

        # Always perform a fresh re-scan: capture new snapshot with screenshot
        capture_service = CaptureService()
        new_snapshot = Snapshot.objects.create(website=website, is_baseline=False)
        cap = capture_service.capture_website(website.url, new_snapshot.id)
        if not cap.get('error') and not cap.get('screenshot'):
            # One retry for screenshot capture to avoid returning a stale-looking
            # "current" view when the first Playwright run misses rendering.
            retry_cap = capture_service.capture_website(website.url, new_snapshot.id)
            if retry_cap.get('screenshot'):
                cap['screenshot'] = retry_cap['screenshot']
            if not cap.get('html_content') and retry_cap.get('html_content'):
                cap['html_content'] = retry_cap['html_content']
            if not cap.get('http_status_code') and retry_cap.get('http_status_code'):
                cap['http_status_code'] = retry_cap['http_status_code']
            if not cap.get('response_time') and retry_cap.get('response_time'):
                cap['response_time'] = retry_cap['response_time']

        if cap.get('error'):
            new_snapshot.status = 'failed'
            new_snapshot.error_message = cap['error']
            new_snapshot.save()
            return Response({
                'error': f"Re-scan capture failed: {cap['error']}"
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        screenshot_warning = None
        if not cap.get('screenshot'):
            fallback_current = website.snapshots.filter(
                is_baseline=False,
                status='completed',
            ).exclude(id=new_snapshot.id).exclude(screenshot='').exclude(screenshot__isnull=True).first()
            if fallback_current and fallback_current.screenshot:
                cap['screenshot'] = str(fallback_current.screenshot)
                screenshot_warning = 'Live screenshot capture missed; reused latest current snapshot image.'
            else:
                screenshot_warning = 'Screenshot unavailable for this re-scan; analysis used HTML-only comparison.'

        new_snapshot.html_content = cap.get('html_content', '')
        new_snapshot.http_status_code = cap.get('http_status_code')
        new_snapshot.response_time = cap.get('response_time')
        if cap.get('screenshot'):
            new_snapshot.screenshot = cap['screenshot']
        new_snapshot.status = 'completed'
        new_snapshot.save()
        website.last_scan = timezone.now()
        website.save()

        # Ensure baseline snapshot also has a screenshot
        baseline = website.snapshots.filter(is_baseline=True, status='completed').first()
        if baseline and not baseline.screenshot:
            base_cap = capture_service.capture_website(website.url, baseline.id)
            if base_cap.get('screenshot'):
                baseline.screenshot = base_cap['screenshot']
                baseline.save()
                website.baseline_screenshot = baseline.screenshot
                website.save()
            else:
                backup_baseline = website.snapshots.filter(
                    is_baseline=True,
                    status='completed',
                ).exclude(id=baseline.id).exclude(screenshot='').exclude(screenshot__isnull=True).first()
                if backup_baseline and backup_baseline.screenshot:
                    baseline.screenshot = backup_baseline.screenshot
                    baseline.save()
                    website.baseline_screenshot = baseline.screenshot
                    website.save()

        # Run analysis on the fresh snapshot
        service = AnalysisService()
        result = service.analyze_snapshot(new_snapshot)
        
        payload = {
            'message': 'Re-scan analysis completed',
            'analysis': AnalysisResultSerializer(result).data
        }
        if screenshot_warning:
            payload['warning'] = screenshot_warning
        return Response(payload, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['get'])
    def statistics(self, request):
        """Get analysis statistics for the current user."""
        queryset = self.get_queryset()
        
        total = queryset.count()
        defacements = queryset.filter(is_defacement_detected=True).count()
        
        severity_counts = {
            'low': queryset.filter(severity='low').count(),
            'medium': queryset.filter(severity='medium').count(),
            'high': queryset.filter(severity='high').count(),
            'critical': queryset.filter(severity='critical').count(),
        }
        
        # Calculate average scores
        from django.db.models import Avg
        averages = queryset.aggregate(
            avg_confidence=Avg('confidence_score'),
            avg_similarity=Avg('similarity_score'),
            avg_change=Avg('change_percentage'),
        )
        
        return Response({
            'total_analyses': total,
            'defacements_detected': defacements,
            'severity_breakdown': severity_counts,
            'averages': {
                'confidence': round(averages['avg_confidence'] or 0, 2),
                'similarity': round(averages['avg_similarity'] or 0, 2),
                'change_percentage': round(averages['avg_change'] or 0, 2),
            }
        })

    @action(detail=False, methods=['post'])
    def seed_baselines(self, request):
        """
        Seed baseline data for all user websites **in parallel**.

        For each website the worker thread will:
        1. Ensure a baseline snapshot exists (with screenshot).
        2. Create a current snapshot (fast HTML-only fetch + screenshot copy).
        3. Run matrix analysis comparing current vs baseline.

        Parallelism is provided by ``concurrent.futures.ThreadPoolExecutor``
        with a capped number of workers so we don't exhaust memory or
        file-descriptor limits (Playwright launches a full browser per call).

        Django ORM safety: every worker calls ``django.db.close_old_connections``
        before touching the database so that each thread gets its own DB
        connection from the pool — this is the officially recommended pattern
        for using the ORM inside manually-managed threads.
        """
        from apps.monitoring.models import Website
        import logging

        logger = logging.getLogger(__name__)
        websites = list(Website.objects.filter(user=request.user))

        if not websites:
            return Response(
                {'error': 'No websites found. Add websites first on the Visual Monitor page.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # ── Run the threaded seeding and collect results ──
        results = _seed_baselines_parallel(websites, max_workers=5, logger=logger)

        successful = sum(1 for r in results if r['status'] == 'success')
        failed = len(results) - successful

        return Response({
            'message': (
                f'Baseline seeding complete for {len(results)} website(s) — '
                f'{successful} succeeded, {failed} failed'
            ),
            'total': len(results),
            'successful': successful,
            'failed': failed,
            'results': results,
        })


# ─────────────────────────────────────────────────────────────────────
# Threaded baseline-seeding helpers (module-level so they are picklable
# and clearly separated from the ViewSet class).
# ─────────────────────────────────────────────────────────────────────

def _capture_baseline_for_site(website, logger) -> dict:
    """
    Worker function executed inside a ``ThreadPoolExecutor`` thread.

    Performs the full baseline-seeding pipeline for a **single** website:
    1. Ensure a completed baseline snapshot (with screenshot) exists.
    2. Create a fresh current snapshot (HTML + screenshot capture).
    3. Run the ``AnalysisService`` comparison between current and baseline.

    Returns a dict describing the outcome (always — never raises).

    **Django ORM thread-safety**: we call ``close_old_connections()`` at
    the start *and* end of every worker invocation so that:
    - The thread gets a fresh DB connection (not one left over from
      the main thread or a prior task).
    - The connection is returned to the pool when we are done so we
      don't leak file descriptors.
    """
    import time as _time
    import warnings as _warnings
    from django.db import close_old_connections
    from django.utils import timezone
    from apps.monitoring.models import Snapshot
    from apps.monitoring.services import CaptureService
    from apps.analysis.services import AnalysisService

    _warnings.filterwarnings('ignore', message='Unverified HTTPS request')

    # ── Ensure this thread has its own clean DB connection ──
    close_old_connections()

    try:
        logger.info(f"[Thread] Starting baseline seed for: {website.name} ({website.url})")
        t_start = _time.time()

        capture_service = CaptureService()
        analysis_service = AnalysisService()
        baseline_warning = None

        # ──────────────────────────────────────────────────────────
        # STEP 1 — Ensure a baseline snapshot exists (with screenshot)
        # ──────────────────────────────────────────────────────────
        baseline = website.snapshots.filter(is_baseline=True, status='completed').first()
        if not baseline:
            # No baseline at all — capture one from scratch
            baseline = Snapshot.objects.create(website=website, is_baseline=True)
            cap = capture_service.capture_website(website.url, baseline.id)

            if cap.get('error'):
                baseline.status = 'failed'
                baseline.error_message = cap['error']
                baseline.save()
                logger.warning(f"[Thread] Baseline capture FAILED for {website.name}: {cap['error']}")
                return {
                    'website': website.name,
                    'status': 'baseline_failed',
                    'error': cap['error'],
                }

            baseline.html_content = cap.get('html_content', '')
            baseline.http_status_code = cap.get('http_status_code')
            baseline.response_time = cap.get('response_time')
            if cap.get('screenshot'):
                baseline.screenshot = cap['screenshot']
            elif not cap.get('error'):
                retry_cap = capture_service.capture_website(website.url, baseline.id)
                if retry_cap.get('screenshot'):
                    baseline.screenshot = retry_cap['screenshot']

            baseline_warning = None
            if not baseline.screenshot:
                fallback_baseline = website.snapshots.filter(
                    is_baseline=True,
                    status='completed',
                ).exclude(id=baseline.id).exclude(screenshot='').exclude(screenshot__isnull=True).first()
                if fallback_baseline and fallback_baseline.screenshot:
                    baseline.screenshot = fallback_baseline.screenshot
                    baseline_warning = 'Baseline capture missed image; reused previous baseline screenshot.'
                elif website.baseline_screenshot:
                    baseline.screenshot = website.baseline_screenshot
                    baseline_warning = 'Baseline capture missed image; reused website baseline screenshot.'
                else:
                    baseline_warning = 'Baseline screenshot unavailable; seeded using HTML baseline.'

            baseline.status = 'completed'
            baseline.save()

            website.is_baseline_set = True
            if baseline.screenshot:
                website.baseline_screenshot = baseline.screenshot
            website.save()
            logger.info(f"[Thread] New baseline created for {website.name}")

        elif not baseline.screenshot:
            # Baseline exists but is missing its screenshot — re-capture
            cap = capture_service.capture_website(website.url, baseline.id)
            if cap.get('screenshot'):
                baseline.screenshot = cap['screenshot']
                baseline.save()
                website.baseline_screenshot = baseline.screenshot
                website.save()
                logger.info(f"[Thread] Re-captured missing baseline screenshot for {website.name}")
            else:
                fallback_baseline = website.snapshots.filter(
                    is_baseline=True,
                    status='completed',
                ).exclude(id=baseline.id).exclude(screenshot='').exclude(screenshot__isnull=True).first()
                if fallback_baseline and fallback_baseline.screenshot:
                    baseline.screenshot = fallback_baseline.screenshot
                    baseline.save()
                    website.baseline_screenshot = baseline.screenshot
                    website.save()
                    baseline_warning = 'Baseline screenshot re-capture failed; reused previous baseline screenshot.'
                elif website.baseline_screenshot:
                    baseline.screenshot = website.baseline_screenshot
                    baseline.save()
                    baseline_warning = 'Baseline screenshot re-capture failed; reused website baseline screenshot.'
                else:
                    baseline_warning = 'Baseline screenshot missing; re-capture failed, continuing with HTML baseline.'

        # ──────────────────────────────────────────────────────────
        # STEP 2 — Create a current snapshot (fresh capture)
        # ──────────────────────────────────────────────────────────
        current = Snapshot.objects.create(website=website, is_baseline=False)

        current_cap = capture_service.capture_website(website.url, current.id)
        if not current_cap.get('error') and not current_cap.get('screenshot'):
            retry_cap = capture_service.capture_website(website.url, current.id)
            if retry_cap.get('screenshot'):
                current_cap['screenshot'] = retry_cap['screenshot']
            if not current_cap.get('html_content') and retry_cap.get('html_content'):
                current_cap['html_content'] = retry_cap['html_content']

        if current_cap.get('error'):
            current.status = 'failed'
            current.error_message = current_cap['error']
            current.save()
            logger.warning(f"[Thread] Current snapshot capture FAILED for {website.name}: {current_cap['error']}")
            return {
                'website': website.name,
                'status': 'current_capture_failed',
                'error': current_cap['error'],
            }

        current_warning = None
        if not current_cap.get('screenshot'):
            fallback_current = website.snapshots.filter(
                is_baseline=False,
                status='completed',
            ).exclude(id=current.id).exclude(screenshot='').exclude(screenshot__isnull=True).first()
            if fallback_current and fallback_current.screenshot:
                current_cap['screenshot'] = str(fallback_current.screenshot)
                current_warning = 'Current capture missed image; reused latest current snapshot screenshot.'
            else:
                current_warning = 'Current screenshot unavailable; analysis used HTML-only comparison.'
            logger.warning(f"[Thread] Current snapshot missing screenshot for {website.name}")

        current.html_content = current_cap.get('html_content', '')
        current.http_status_code = current_cap.get('http_status_code')
        current.response_time = current_cap.get('response_time')
        if current_cap.get('screenshot'):
            current.screenshot = current_cap['screenshot']

        current.status = 'completed'
        current.save()

        website.last_scan = timezone.now()
        website.save()

        # ──────────────────────────────────────────────────────────
        # STEP 3 — Run matrix analysis (current vs baseline)
        # ──────────────────────────────────────────────────────────
        analysis = analysis_service.analyze_snapshot(current)

        elapsed = round(_time.time() - t_start, 1)
        logger.info(
            f"[Thread] Completed {website.name} in {elapsed}s — "
            f"severity={analysis.severity}, changed={analysis.changed_blocks}"
        )
        warning_parts = [w for w in [locals().get('baseline_warning'), current_warning] if w]
        result_payload = {
            'website': website.name,
            'status': 'success',
            'analysis_id': analysis.id,
            'severity': analysis.severity,
            'changed_blocks': analysis.changed_blocks,
            'elapsed_seconds': elapsed,
        }
        if warning_parts:
            result_payload['warning'] = ' '.join(warning_parts)
        return result_payload

    except Exception as exc:
        logger.exception(f"[Thread] seed_baselines error for {website.name}")
        return {
            'website': website.name,
            'status': 'error',
            'error': str(exc),
        }

    finally:
        # ── Release the DB connection back to the pool ──
        close_old_connections()


def _seed_baselines_parallel(websites: list, max_workers: int = 5, logger=None) -> list:
    """
    Process a list of Website instances through ``_capture_baseline_for_site``
    using a thread pool.

    Args:
        websites:    Pre-fetched list of ``Website`` model instances.
        max_workers: Maximum concurrent threads (default 5).  Keep this
                     moderate — each Playwright capture launches a full
                     Chromium process which uses ~150-300 MB RAM.
        logger:      Python logger instance.

    Returns:
        A list of result dicts (one per website), in the same order as
        the input list.  Every dict contains at least ``website`` (name)
        and ``status`` ('success' | 'baseline_failed' | 'error').
    """
    import time as _time
    from concurrent.futures import ThreadPoolExecutor, as_completed

    if logger is None:
        import logging
        logger = logging.getLogger(__name__)

    total = len(websites)
    logger.info(
        f"[Seeder] Starting parallel baseline seeding — "
        f"{total} website(s), {max_workers} workers"
    )
    t_global = _time.time()

    # Map Future → website so we can attach results in order
    results_map: dict = {}           # website.id → result dict
    futures_map: dict = {}           # Future  → website.id

    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        for website in websites:
            future = executor.submit(_capture_baseline_for_site, website, logger)
            futures_map[future] = website.id

        # Collect results as they complete (order doesn't matter here)
        for future in as_completed(futures_map):
            wid = futures_map[future]
            try:
                result = future.result()       # already a dict, never raises
            except Exception as exc:
                # Belt-and-suspenders: should not happen because the worker
                # catches everything, but just in case…
                result = {'website': f'id={wid}', 'status': 'error', 'error': str(exc)}
            results_map[wid] = result

    # Return results in the same order as the input list
    ordered_results = [results_map[w.id] for w in websites]

    elapsed = round(_time.time() - t_global, 1)
    success_count = sum(1 for r in ordered_results if r['status'] == 'success')
    logger.info(
        f"[Seeder] Parallel seeding finished in {elapsed}s — "
        f"{success_count}/{total} succeeded"
    )
    return ordered_results
