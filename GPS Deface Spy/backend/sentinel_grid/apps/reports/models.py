from django.db import models
from django.conf import settings
from apps.monitoring.models import Website


class Report(models.Model):
    """Model representing a generated report."""
    
    TYPE_CHOICES = [
        ('summary', 'Summary Report'),
        ('detailed', 'Detailed Report'),
        ('incident', 'Incident Report'),
        ('weekly', 'Weekly Report'),
        ('monthly', 'Monthly Report'),
    ]
    
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('generating', 'Generating'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
    ]
    
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='reports'
    )
    title = models.CharField(max_length=255)
    report_type = models.CharField(
        max_length=20,
        choices=TYPE_CHOICES,
        default='summary'
    )
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='pending'
    )
    
    # Report parameters
    websites = models.ManyToManyField(
        Website,
        blank=True,
        related_name='reports'
    )
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    
    # Generated file
    file = models.FileField(
        upload_to='reports/',
        null=True,
        blank=True
    )
    file_size = models.IntegerField(null=True, blank=True)
    
    # Report data (JSON summary)
    data = models.JSONField(default=dict, blank=True)
    
    # Timestamps
    generated_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'reports'
        ordering = ['-created_at']
        verbose_name = 'Report'
        verbose_name_plural = 'Reports'

    def __str__(self):
        return f"{self.title} - {self.report_type}"
