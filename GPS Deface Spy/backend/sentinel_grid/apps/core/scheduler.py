import logging
from datetime import timedelta
from django.utils import timezone
from django.conf import settings
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger

logger = logging.getLogger(__name__)

# Global scheduler instance
scheduler = None


def get_scheduler():
    """Get or create the scheduler instance."""
    global scheduler
    if scheduler is None:
        scheduler = BackgroundScheduler()
    return scheduler


def scan_websites_job():
    """Job to scan all active websites that are due for scanning."""
    from apps.monitoring.models import Website, Snapshot
    from apps.monitoring.services import CaptureService
    from apps.analysis.services import AnalysisService
    
    logger.info("Running scheduled website scan job...")
    
    now = timezone.now()
    
    # Get websites due for scanning
    websites = Website.objects.filter(
        status='active'
    ).exclude(
        last_scan__gte=now - timedelta(minutes=1)  # Prevent duplicate scans
    )
    
    scanned_count = 0
    capture_service = CaptureService()
    
    for website in websites:
        # Check if it's time to scan based on monitoring_interval
        if website.last_scan:
            next_scan_time = website.last_scan + timedelta(
                minutes=website.monitoring_interval
            )
            if now < next_scan_time:
                continue
        
        try:
            logger.info(f"Scanning website: {website.name} ({website.url})")
            
            # Create snapshot
            snapshot = Snapshot.objects.create(
                website=website
            )
            
            # Actually capture the website content
            capture_result = capture_service.capture_website(website.url, snapshot.id)
            
            if capture_result.get('error'):
                snapshot.status = 'failed'
                snapshot.error_message = capture_result['error']
                snapshot.save()
                logger.warning(f"Capture failed for {website.name}: {capture_result['error']}")
                continue
            
            # Update snapshot with real captured data
            snapshot.html_content = capture_result.get('html_content', '')
            snapshot.http_status_code = capture_result.get('http_status_code')
            snapshot.response_time = capture_result.get('response_time')
            if capture_result.get('screenshot'):
                snapshot.screenshot = capture_result['screenshot']
            snapshot.status = 'completed'
            snapshot.save()
            
            # Update website
            website.last_scan = now
            website.next_scan = now + timedelta(minutes=website.monitoring_interval)
            website.save()
            
            # Run analysis if a baseline snapshot exists
            # (check actual snapshot, not just the flag, to self-heal inconsistencies)
            has_baseline = website.is_baseline_set or website.snapshots.filter(
                is_baseline=True, status='completed'
            ).exists()
            if has_baseline:
                if not website.is_baseline_set:
                    website.is_baseline_set = True
                    website.save(update_fields=['is_baseline_set'])
                    logger.info(f"Auto-synced is_baseline_set=True for {website.name}")
                try:
                    analysis_service = AnalysisService()
                    analysis_service.analyze_snapshot(snapshot)
                except Exception as e:
                    logger.error(f"Analysis failed for {website.name}: {str(e)}")
            
            scanned_count += 1
            
        except Exception as e:
            logger.error(f"Error scanning website {website.id}: {str(e)}")
            website.status = 'error'
            website.save()
    
    logger.info(f"Scheduled scan completed. Scanned {scanned_count} websites.")


def cleanup_old_data_job():
    """Job to clean up old snapshots and data."""
    from apps.monitoring.models import Snapshot
    from apps.core.models import SystemSettings
    
    logger.info("Running cleanup job...")
    
    try:
        settings_obj = SystemSettings.get_settings()
        
        if not settings_obj.auto_delete_old_snapshots:
            return
        
        # Keep only max_snapshots_per_website per website
        from apps.monitoring.models import Website
        
        for website in Website.objects.all():
            snapshot_count = website.snapshots.count()
            max_snapshots = settings_obj.max_snapshots_per_website
            
            if snapshot_count > max_snapshots:
                # Delete oldest snapshots, keeping baseline
                to_delete = website.snapshots.filter(
                    is_baseline=False
                ).order_by('created_at')[:snapshot_count - max_snapshots]
                
                deleted_count = to_delete.count()
                to_delete.delete()
                
                logger.info(
                    f"Deleted {deleted_count} old snapshots for {website.name}"
                )
        
        logger.info("Cleanup job completed.")
        
    except Exception as e:
        logger.error(f"Error in cleanup job: {str(e)}")


def auto_report_job():
    """Job to auto-generate and email daily reports to users who have it enabled."""
    from apps.monitoring.models import Website
    from apps.reports.models import Report
    from apps.reports.services import PDFReportGenerator
    from django.core.mail import EmailMessage
    from django.contrib.auth import get_user_model
    
    User = get_user_model()
    logger.info("Running auto-report job...")
    
    try:
        # Get all users with active websites
        users_with_websites = User.objects.filter(
            websites__status='active'
        ).distinct()
        
        generator = PDFReportGenerator()
        
        for user in users_with_websites:
            try:
                # Check if user has email
                if not user.email:
                    continue
                
                # Check notification settings
                try:
                    from apps.core.models import UserSettings
                    user_settings = UserSettings.objects.get(user=user)
                    if not getattr(user_settings, 'email_notifications', True):
                        continue
                except Exception:
                    pass  # Default to sending if no settings found
                
                # Get user's active websites
                websites = Website.objects.filter(user=user, status='active')
                if not websites.exists():
                    continue
                
                # Create a summary report
                report = Report.objects.create(
                    user=user,
                    title=f"Daily Monitoring Report - {timezone.now().strftime('%Y-%m-%d')}",
                    report_type='summary',
                    status='pending',
                )
                report.websites.set(websites)
                
                # Generate PDF
                generator.generate_report(report)
                
                if report.status != 'completed':
                    logger.warning(f"Report generation failed for user {user.email}")
                    continue
                
                # Build email
                subject = f"[Deface Spy] Daily Report - {timezone.now().strftime('%b %d, %Y')}"
                body = f"""
Deface Spy - Daily Monitoring Report
========================================

Hi {user.first_name or user.username},

Your daily website monitoring report is attached.

Summary:
- Websites Monitored: {websites.count()}
- Report Generated: {timezone.now().strftime('%Y-%m-%d %H:%M UTC')}

Please review the attached PDF for detailed analysis.

---
Deface Spy - Website Defacement Monitor
"""
                email_msg = EmailMessage(
                    subject=subject,
                    body=body,
                    from_email=settings.DEFAULT_FROM_EMAIL,
                    to=[user.email],
                )
                
                # Attach PDF
                if report.file:
                    import os as os_mod
                    filepath = os_mod.path.join(settings.MEDIA_ROOT, str(report.file))
                    if os_mod.path.exists(filepath):
                        email_msg.attach_file(filepath)
                
                email_msg.send(fail_silently=True)
                logger.info(f"Auto-report sent to {user.email}")
                
            except Exception as e:
                logger.error(f"Failed to send auto-report to {user.email}: {str(e)}")
        
        logger.info("Auto-report job completed.")
        
    except Exception as e:
        logger.error(f"Error in auto-report job: {str(e)}")


def start_scheduler():
    """Start the background scheduler."""
    if not getattr(settings, 'SCHEDULER_ENABLED', True):
        logger.info("Scheduler is disabled in settings.")
        return
    
    sched = get_scheduler()
    
    if sched.running:
        logger.info("Scheduler is already running.")
        return
    
    interval_minutes = getattr(settings, 'SCHEDULER_INTERVAL_MINUTES', 5)
    
    # Add scan job
    sched.add_job(
        scan_websites_job,
        trigger=IntervalTrigger(minutes=interval_minutes),
        id='scan_websites_job',
        name='Scan Active Websites',
        replace_existing=True,
    )
    
    # Add cleanup job (runs daily)
    sched.add_job(
        cleanup_old_data_job,
        trigger=IntervalTrigger(hours=24),
        id='cleanup_old_data_job',
        name='Cleanup Old Data',
        replace_existing=True,
    )
    
    # Add auto-report job (runs daily)
    sched.add_job(
        auto_report_job,
        trigger=IntervalTrigger(hours=24),
        id='auto_report_job',
        name='Auto Email Reports',
        replace_existing=True,
    )
    
    sched.start()
    logger.info(f"Scheduler started with {interval_minutes} minute interval.")


def stop_scheduler():
    """Stop the background scheduler."""
    sched = get_scheduler()
    if sched.running:
        sched.shutdown()
        logger.info("Scheduler stopped.")
