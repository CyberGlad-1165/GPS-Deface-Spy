from django.contrib import admin
from .models import SystemSettings, UserSettings


@admin.register(SystemSettings)
class SystemSettingsAdmin(admin.ModelAdmin):
    """Admin configuration for SystemSettings model."""
    
    list_display = [
        'id', 'default_monitoring_interval', 'scheduler_enabled',
        'send_email_notifications', 'updated_at'
    ]
    readonly_fields = ['created_at', 'updated_at']

    def has_add_permission(self, request):
        # Only allow one instance
        return not SystemSettings.objects.exists()

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(UserSettings)
class UserSettingsAdmin(admin.ModelAdmin):
    """Admin configuration for UserSettings model."""
    
    list_display = [
        'user', 'email_notifications', 'timezone',
        'dashboard_refresh_interval', 'updated_at'
    ]
    list_filter = ['email_notifications', 'timezone']
    search_fields = ['user__email']
    readonly_fields = ['created_at', 'updated_at']
