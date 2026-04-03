from django.contrib import admin
from .models import Report


@admin.register(Report)
class ReportAdmin(admin.ModelAdmin):
    """Admin configuration for Report model."""
    
    list_display = [
        'title', 'user', 'report_type', 'status',
        'file_size', 'generated_at', 'created_at'
    ]
    list_filter = ['report_type', 'status', 'created_at']
    search_fields = ['title', 'user__email']
    ordering = ['-created_at']
    readonly_fields = ['created_at', 'updated_at', 'generated_at']
    filter_horizontal = ['websites']
