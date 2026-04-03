from django.contrib import admin
from .models import AnalysisResult


@admin.register(AnalysisResult)
class AnalysisResultAdmin(admin.ModelAdmin):
    """Admin configuration for AnalysisResult model."""
    
    list_display = [
        'id', 'get_website', 'severity', 'changed_blocks',
        'change_percentage', 'is_defacement_detected', 'created_at'
    ]
    list_filter = ['severity', 'is_defacement_detected', 'created_at']
    search_fields = ['snapshot__website__name', 'snapshot__website__url']
    ordering = ['-created_at']
    readonly_fields = ['created_at']

    def get_website(self, obj):
        return obj.snapshot.website.name
    get_website.short_description = 'Website'
