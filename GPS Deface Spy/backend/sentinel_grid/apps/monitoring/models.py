from django.db import models
from django.conf import settings


class Website(models.Model):
    """Model representing a monitored website."""
    
    STATUS_CHOICES = [
        ('active', 'Active'),
        ('paused', 'Paused'),
        ('error', 'Error'),
    ]
    
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='websites'
    )
    name = models.CharField(max_length=255)
    url = models.URLField(max_length=500)
    description = models.TextField(blank=True)
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='active'
    )
    monitoring_interval = models.IntegerField(
        default=60,
        help_text='Monitoring interval in minutes'
    )
    last_scan = models.DateTimeField(null=True, blank=True)
    next_scan = models.DateTimeField(null=True, blank=True)
    baseline_screenshot = models.ImageField(
        upload_to='screenshots/baselines/',
        null=True,
        blank=True
    )
    is_baseline_set = models.BooleanField(default=False)
    tags = models.JSONField(default=list, blank=True)
    notification_emails = models.JSONField(
        default=list,
        blank=True,
        help_text='Additional emails to notify on incidents'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'websites'
        ordering = ['-created_at']
        verbose_name = 'Website'
        verbose_name_plural = 'Websites'

    def __str__(self):
        return f"{self.name} ({self.url})"


class Snapshot(models.Model):
    """Model representing a website snapshot."""
    
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
    ]
    
    website = models.ForeignKey(
        Website,
        on_delete=models.CASCADE,
        related_name='snapshots'
    )
    screenshot = models.ImageField(
        upload_to='screenshots/snapshots/',
        null=True,
        blank=True
    )
    html_content = models.TextField(blank=True)
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='pending'
    )
    error_message = models.TextField(blank=True)
    response_time = models.FloatField(
        null=True,
        blank=True,
        help_text='Response time in milliseconds'
    )
    http_status_code = models.IntegerField(null=True, blank=True)
    is_baseline = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'snapshots'
        ordering = ['-created_at']
        verbose_name = 'Snapshot'
        verbose_name_plural = 'Snapshots'

    def __str__(self):
        return f"Snapshot of {self.website.name} at {self.created_at}"
