from rest_framework import serializers
from .models import Website, Snapshot


class SnapshotSerializer(serializers.ModelSerializer):
    """Serializer for Snapshot model."""
    
    screenshot = serializers.SerializerMethodField()

    class Meta:
        model = Snapshot
        fields = [
            'id', 'website', 'screenshot', 'html_content', 'status',
            'error_message', 'response_time', 'http_status_code',
            'is_baseline', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']

    def get_screenshot(self, obj):
        if obj.screenshot:
            return str(obj.screenshot)
        return None


class WebsiteSerializer(serializers.ModelSerializer):
    """Serializer for Website model."""
    
    latest_snapshot = serializers.SerializerMethodField()
    snapshot_count = serializers.SerializerMethodField()
    baseline_screenshot = serializers.SerializerMethodField()
    
    class Meta:
        model = Website
        fields = [
            'id', 'name', 'url', 'description', 'status',
            'monitoring_interval', 'last_scan', 'next_scan',
            'baseline_screenshot', 'is_baseline_set', 'tags',
            'notification_emails', 'created_at', 'updated_at',
            'latest_snapshot', 'snapshot_count'
        ]
        read_only_fields = [
            'id', 'user', 'last_scan', 'next_scan',
            'is_baseline_set', 'created_at', 'updated_at'
        ]

    def get_baseline_screenshot(self, obj):
        if obj.baseline_screenshot:
            return str(obj.baseline_screenshot)
        # Auto-detect from snapshots if website-level field is out of sync
        baseline = obj.snapshots.filter(is_baseline=True, status='completed').first()
        if baseline and baseline.screenshot:
            # Self-heal: sync the website record for future requests
            obj.baseline_screenshot = baseline.screenshot
            obj.is_baseline_set = True
            obj.save(update_fields=['baseline_screenshot', 'is_baseline_set'])
            return str(baseline.screenshot)
        return None

    def get_latest_snapshot(self, obj):
        snapshot = obj.snapshots.first()
        if snapshot:
            return SnapshotSerializer(snapshot).data
        return None

    def get_snapshot_count(self, obj):
        return obj.snapshots.count()


class WebsiteCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating a Website."""
    
    class Meta:
        model = Website
        fields = [
            'name', 'url', 'description', 'monitoring_interval',
            'tags', 'notification_emails'
        ]

    def create(self, validated_data):
        validated_data['user'] = self.context['request'].user
        return super().create(validated_data)


class WebsiteUpdateSerializer(serializers.ModelSerializer):
    """Serializer for updating a Website."""
    
    class Meta:
        model = Website
        fields = [
            'name', 'url', 'description', 'status', 'monitoring_interval',
            'tags', 'notification_emails'
        ]


class TriggerScanSerializer(serializers.Serializer):
    """Serializer for triggering a scan."""
    
    set_as_baseline = serializers.BooleanField(default=False)
