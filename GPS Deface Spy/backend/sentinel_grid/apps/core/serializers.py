from rest_framework import serializers
from .models import SystemSettings, UserSettings


class SystemSettingsSerializer(serializers.ModelSerializer):
    """Serializer for SystemSettings model."""
    
    class Meta:
        model = SystemSettings
        fields = [
            'id', 'default_monitoring_interval', 'max_snapshots_per_website',
            'auto_delete_old_snapshots', 'send_email_notifications',
            'alert_on_high_severity', 'alert_on_critical_severity',
            'defacement_threshold', 'min_confidence_score',
            'scheduler_enabled', 'scheduler_interval_minutes',
            'incident_retention_days', 'report_retention_days',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class UserSettingsSerializer(serializers.ModelSerializer):
    """Serializer for UserSettings model."""
    
    class Meta:
        model = UserSettings
        fields = [
            'id', 'email_notifications', 'notify_on_high',
            'notify_on_critical', 'notify_on_medium', 'notify_on_low',
            'dashboard_refresh_interval', 'timezone', 'date_format',
            'default_report_type', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class DashboardSerializer(serializers.Serializer):
    """Serializer for dashboard data."""
    
    total_websites = serializers.IntegerField()
    active_websites = serializers.IntegerField()
    total_incidents = serializers.IntegerField()
    open_incidents = serializers.IntegerField()
    total_alerts = serializers.IntegerField()
    active_alerts = serializers.IntegerField()
    severity_breakdown = serializers.DictField()
    recent_incidents = serializers.ListField()
    recent_alerts = serializers.ListField()


class HealthCheckSerializer(serializers.Serializer):
    """Serializer for health check response."""
    
    status = serializers.CharField()
    database = serializers.CharField()
    scheduler = serializers.CharField()
    timestamp = serializers.DateTimeField()
    version = serializers.CharField()
