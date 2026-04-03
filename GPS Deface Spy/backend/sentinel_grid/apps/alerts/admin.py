from django.contrib import admin
from .models import Incident, Alert


@admin.register(Incident)
class IncidentAdmin(admin.ModelAdmin):
    """Admin configuration for Incident model."""
    
    list_display = [
        'title', 'website', 'severity', 'status',
        'change_percentage', 'created_at'
    ]
    list_filter = ['severity', 'status', 'created_at']
    search_fields = ['title', 'description', 'website__name']
    ordering = ['-created_at']
    readonly_fields = ['created_at', 'updated_at']


@admin.register(Alert)
class AlertAdmin(admin.ModelAdmin):
    """Admin configuration for Alert model."""
    
    list_display = [
        'title', 'website', 'severity', 'status',
        'is_email_sent', 'created_at'
    ]
    list_filter = ['severity', 'status', 'is_email_sent', 'created_at']
    search_fields = ['title', 'message', 'website__name']
    ordering = ['-created_at']
    readonly_fields = ['created_at', 'updated_at']
