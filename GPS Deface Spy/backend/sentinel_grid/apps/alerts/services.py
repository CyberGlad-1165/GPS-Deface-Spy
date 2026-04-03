import logging
from django.core.mail import send_mail
from django.conf import settings
from django.utils import timezone
from django.template.loader import render_to_string

from .models import Alert, Incident

logger = logging.getLogger(__name__)


class AlertService:
    """Service for managing alerts and sending notifications."""

    def send_notification(self, alert: Alert) -> bool:
        """
        Send email notification for an alert.
        
        Args:
            alert: The alert to notify about
            
        Returns:
            True if notification sent successfully
        """
        try:
            website = alert.website
            user = website.user
            
            # Collect notification emails
            recipients = [user.email]
            
            # Add additional notification emails from website settings
            if website.notification_emails:
                recipients.extend(website.notification_emails)
            
            # Remove duplicates
            recipients = list(set(recipients))
            
            # Prepare email content
            subject = f"[Deface Spy] {alert.severity.upper()}: {alert.title}"
            
            message = self._build_email_message(alert)
            
            # Send email
            send_mail(
                subject=subject,
                message=message,
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=recipients,
                fail_silently=False,
            )
            
            # Update alert status
            alert.is_email_sent = True
            alert.email_sent_at = timezone.now()
            alert.save()
            
            logger.info(f"Alert notification sent for alert {alert.id}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to send alert notification: {str(e)}")
            return False

    def _build_email_message(self, alert: Alert) -> str:
        """Build the email message content."""
        website = alert.website
        incident = alert.incident
        
        message = f"""
DEFACE SPY - DEFACEMENT ALERT
================================

Alert: {alert.title}
Severity: {alert.severity.upper()}
Website: {website.name}
URL: {website.url}

Message:
{alert.message}

"""
        
        if incident:
            message += f"""
Incident Details:
- Change Percentage: {incident.change_percentage}%
- Affected Blocks: {incident.affected_blocks}
- Status: {incident.status}

"""
        
        message += f"""
Time Detected: {alert.created_at.strftime('%Y-%m-%d %H:%M:%S UTC')}

Action Required:
Please log in to your Deface Spy dashboard to review this alert and take appropriate action.

---
This is an automated message from Deface Spy.
"""
        
        return message

    def resolve_alert(self, alert: Alert, user=None) -> Alert:
        """
        Resolve an alert.
        
        Args:
            alert: The alert to resolve
            user: The user resolving the alert
            
        Returns:
            The updated alert
        """
        alert.status = 'resolved'
        alert.resolved_at = timezone.now()
        alert.save()
        
        # Also resolve the associated incident if exists
        if alert.incident:
            alert.incident.status = 'resolved'
            alert.incident.resolved_at = timezone.now()
            alert.incident.resolved_by = user
            alert.incident.save()
        
        return alert

    def acknowledge_alert(self, alert: Alert, user) -> Alert:
        """
        Acknowledge an alert.
        
        Args:
            alert: The alert to acknowledge
            user: The user acknowledging the alert
            
        Returns:
            The updated alert
        """
        alert.status = 'acknowledged'
        alert.acknowledged_by = user
        alert.acknowledged_at = timezone.now()
        alert.save()
        
        # Update incident status
        if alert.incident:
            alert.incident.status = 'investigating'
            alert.incident.save()
        
        return alert

    def dismiss_alert(self, alert: Alert) -> Alert:
        """
        Dismiss an alert (mark as false positive).
        
        Args:
            alert: The alert to dismiss
            
        Returns:
            The updated alert
        """
        alert.status = 'dismissed'
        alert.save()
        
        # Mark incident as false positive
        if alert.incident:
            alert.incident.status = 'false_positive'
            alert.incident.save()
        
        return alert
