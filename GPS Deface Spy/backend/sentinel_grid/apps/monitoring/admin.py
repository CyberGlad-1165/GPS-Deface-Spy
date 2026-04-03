from django.contrib import admin
from .models import Website, Snapshot


@admin.register(Website)
class WebsiteAdmin(admin.ModelAdmin):
    """Admin configuration for Website model."""
    
    list_display = ['name', 'url', 'status', 'user', 'last_scan', 'created_at']
    list_filter = ['status', 'created_at', 'is_baseline_set']
    search_fields = ['name', 'url', 'user__email']
    ordering = ['-created_at']
    readonly_fields = ['created_at', 'updated_at']


@admin.register(Snapshot)
class SnapshotAdmin(admin.ModelAdmin):
    """Admin configuration for Snapshot model."""
    
    list_display = ['website', 'status', 'http_status_code', 'is_baseline', 'created_at']
    list_filter = ['status', 'is_baseline', 'created_at']
    search_fields = ['website__name', 'website__url']
    ordering = ['-created_at']
    readonly_fields = ['created_at']
