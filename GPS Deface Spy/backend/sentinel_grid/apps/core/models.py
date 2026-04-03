from django.db import models
from django.conf import settings


class SystemSettings(models.Model):
    """Singleton model for system-wide settings."""
    
    # Monitoring settings
    default_monitoring_interval = models.IntegerField(
        default=60,
        help_text='Default monitoring interval in minutes'
    )
    max_snapshots_per_website = models.IntegerField(
        default=100,
        help_text='Maximum snapshots to keep per website'
    )
    auto_delete_old_snapshots = models.BooleanField(default=True)
    
    # Alert settings
    send_email_notifications = models.BooleanField(default=True)
    alert_on_high_severity = models.BooleanField(default=True)
    alert_on_critical_severity = models.BooleanField(default=True)
    
    # Analysis settings
    defacement_threshold = models.FloatField(
        default=10.0,
        help_text='Change percentage threshold for defacement detection'
    )
    min_confidence_score = models.FloatField(
        default=80.0,
        help_text='Minimum confidence score for valid analysis'
    )
    
    # Scheduler settings
    scheduler_enabled = models.BooleanField(default=True)
    scheduler_interval_minutes = models.IntegerField(default=5)
    
    # Retention settings
    incident_retention_days = models.IntegerField(default=90)
    report_retention_days = models.IntegerField(default=365)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'system_settings'
        verbose_name = 'System Settings'
        verbose_name_plural = 'System Settings'

    def __str__(self):
        return "System Settings"

    def save(self, *args, **kwargs):
        """Ensure only one instance exists."""
        if not self.pk and SystemSettings.objects.exists():
            # Update existing instance instead
            existing = SystemSettings.objects.first()
            for field in self._meta.fields:
                if field.name not in ['id', 'created_at']:
                    setattr(existing, field.name, getattr(self, field.name))
            existing.save()
            return existing
        return super().save(*args, **kwargs)

    @classmethod
    def get_settings(cls):
        """Get or create the settings instance."""
        settings_obj, created = cls.objects.get_or_create(pk=1)
        return settings_obj


class UserSettings(models.Model):
    """Per-user settings."""
    
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='settings'
    )
    
    # Notification preferences
    email_notifications = models.BooleanField(default=True)
    notify_on_high = models.BooleanField(default=True)
    notify_on_critical = models.BooleanField(default=True)
    notify_on_medium = models.BooleanField(default=False)
    notify_on_low = models.BooleanField(default=False)
    
    # Display preferences
    dashboard_refresh_interval = models.IntegerField(
        default=30,
        help_text='Dashboard auto-refresh interval in seconds'
    )
    timezone = models.CharField(max_length=50, default='UTC')
    date_format = models.CharField(max_length=20, default='YYYY-MM-DD')
    
    # Report preferences
    default_report_type = models.CharField(
        max_length=20,
        default='summary',
        choices=[
            ('summary', 'Summary'),
            ('detailed', 'Detailed'),
            ('incident', 'Incident'),
        ]
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'user_settings'
        verbose_name = 'User Settings'
        verbose_name_plural = 'User Settings'

    def __str__(self):
        return f"Settings for {self.user.email}"
