from django.db import models
from apps.monitoring.models import Website, Snapshot


class AnalysisResult(models.Model):
    """Model representing analysis results from matrix comparison."""
    
    SEVERITY_CHOICES = [
        ('low', 'Low'),
        ('medium', 'Medium'),
        ('high', 'High'),
        ('critical', 'Critical'),
    ]
    
    snapshot = models.OneToOneField(
        Snapshot,
        on_delete=models.CASCADE,
        related_name='analysis_result'
    )
    baseline_snapshot = models.ForeignKey(
        Snapshot,
        on_delete=models.SET_NULL,
        null=True,
        related_name='compared_analyses'
    )
    
    # 8x8 Matrix data
    matrix_data = models.JSONField(
        default=dict,
        help_text='8x8 matrix comparison data'
    )
    changed_blocks = models.IntegerField(default=0)
    total_blocks = models.IntegerField(default=64)
    change_percentage = models.FloatField(default=0.0)
    
    # Analysis scores
    confidence_score = models.FloatField(
        default=0.0,
        help_text='Confidence score (0-100)'
    )
    similarity_score = models.FloatField(
        default=100.0,
        help_text='Similarity score (0-100)'
    )
    
    # Classification
    severity = models.CharField(
        max_length=20,
        choices=SEVERITY_CHOICES,
        default='low'
    )
    is_defacement_detected = models.BooleanField(default=False)
    
    # AI explanation
    ai_explanation = models.TextField(
        blank=True,
        help_text='AI-generated explanation of changes'
    )
    
    # Detailed changes
    visual_changes = models.JSONField(
        default=list,
        help_text='List of detected visual changes'
    )
    content_changes = models.JSONField(
        default=list,
        help_text='List of detected content changes'
    )
    
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'analysis_results'
        ordering = ['-created_at']
        verbose_name = 'Analysis Result'
        verbose_name_plural = 'Analysis Results'

    def __str__(self):
        return f"Analysis for {self.snapshot.website.name} - {self.severity}"

    def calculate_severity(self):
        """Calculate severity based on change percentage and confidence."""
        if self.change_percentage <= 5:
            return 'low'
        elif self.change_percentage <= 20:
            return 'medium'
        elif self.change_percentage <= 50:
            return 'high'
        else:
            return 'critical'
