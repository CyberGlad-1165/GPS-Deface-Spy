from django.db import models
from django.conf import settings
from apps.monitoring.models import Website, Snapshot
from apps.analysis.models import AnalysisResult


class Incident(models.Model):
    """Model representing a defacement incident."""
    
    STATUS_CHOICES = [
        ('open', 'Open'),
        ('investigating', 'Investigating'),
        ('resolved', 'Resolved'),
        ('false_positive', 'False Positive'),
    ]
    
    SEVERITY_CHOICES = [
        ('low', 'Low'),
        ('medium', 'Medium'),
        ('high', 'High'),
        ('critical', 'Critical'),
    ]
    
    website = models.ForeignKey(
        Website,
        on_delete=models.CASCADE,
        related_name='incidents'
    )
    snapshot = models.ForeignKey(
        Snapshot,
        on_delete=models.CASCADE,
        related_name='incidents'
    )
    analysis_result = models.ForeignKey(
        AnalysisResult,
        on_delete=models.CASCADE,
        related_name='incidents',
        null=True,
        blank=True
    )
    
    title = models.CharField(max_length=500)
    description = models.TextField(blank=True)
    severity = models.CharField(
        max_length=20,
        choices=SEVERITY_CHOICES,
        default='low'
    )
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='open'
    )
    
    # Analysis details
    change_percentage = models.FloatField(default=0.0)
    affected_blocks = models.IntegerField(default=0)
    
    # Resolution details
    resolved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='resolved_incidents'
    )
    resolved_at = models.DateTimeField(null=True, blank=True)
    resolution_notes = models.TextField(blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'incidents'
        ordering = ['-created_at']
        verbose_name = 'Incident'
        verbose_name_plural = 'Incidents'

    def __str__(self):
        return f"{self.title} - {self.severity}"


class Alert(models.Model):
    """Model representing an alert notification."""
    
    STATUS_CHOICES = [
        ('active', 'Active'),
        ('acknowledged', 'Acknowledged'),
        ('resolved', 'Resolved'),
        ('dismissed', 'Dismissed'),
    ]
    
    SEVERITY_CHOICES = [
        ('low', 'Low'),
        ('medium', 'Medium'),
        ('high', 'High'),
        ('critical', 'Critical'),
    ]
    
    incident = models.ForeignKey(
        Incident,
        on_delete=models.CASCADE,
        related_name='alerts',
        null=True,
        blank=True
    )
    website = models.ForeignKey(
        Website,
        on_delete=models.CASCADE,
        related_name='alerts'
    )
    
    title = models.CharField(max_length=500)
    message = models.TextField()
    severity = models.CharField(
        max_length=20,
        choices=SEVERITY_CHOICES,
        default='low'
    )
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='active'
    )
    
    # Notification tracking
    is_email_sent = models.BooleanField(default=False)
    email_sent_at = models.DateTimeField(null=True, blank=True)
    
    # Resolution tracking
    acknowledged_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='acknowledged_alerts'
    )
    acknowledged_at = models.DateTimeField(null=True, blank=True)
    resolved_at = models.DateTimeField(null=True, blank=True)
    resolution_notes = models.TextField(blank=True)

    # ── SOC Classification ──────────────────────────────────────
    CLASSIFICATION_CHOICES = [
        ('pending', 'Pending'),
        ('true_positive', 'True Positive'),
        ('false_positive', 'False Positive'),
    ]

    classification = models.CharField(
        max_length=20,
        choices=CLASSIFICATION_CHOICES,
        default='pending',
    )
    classified_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='classified_alerts',
    )
    classified_at = models.DateTimeField(null=True, blank=True)
    investigation_notes = models.TextField(
        blank=True,
        help_text='Analyst investigation findings',
    )

    # AI / ML prediction
    ai_prediction = models.CharField(
        max_length=20,
        choices=CLASSIFICATION_CHOICES,
        default='pending',
    )
    ai_prediction_confidence = models.FloatField(
        default=0.0,
        help_text='AI model confidence 0-100',
    )
    ai_prediction_details = models.JSONField(
        default=dict,
        blank=True,
        help_text='Detailed feature scores from the ML model',
    )

    # Owner notification
    owner_notified = models.BooleanField(default=False)
    owner_notified_at = models.DateTimeField(null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'alerts'
        ordering = ['-created_at']
        verbose_name = 'Alert'
        verbose_name_plural = 'Alerts'

    def __str__(self):
        return f"{self.title} - {self.status}"
