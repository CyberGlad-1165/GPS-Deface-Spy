from rest_framework import serializers
from .models import AnalysisResult
from apps.monitoring.models import Snapshot


class AnalysisSnapshotSerializer(serializers.ModelSerializer):
    """Lightweight snapshot serializer for analysis responses.
    
    Excludes html_content to keep analysis list responses small.
    Includes the screenshot path needed for visual comparison.
    """

    screenshot = serializers.SerializerMethodField()

    class Meta:
        model = Snapshot
        fields = [
            'id', 'website', 'screenshot', 'status',
            'response_time', 'http_status_code',
            'is_baseline', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']

    def get_screenshot(self, obj):
        if obj.screenshot:
            return str(obj.screenshot)
        return None


class AnalysisResultSerializer(serializers.ModelSerializer):
    """Serializer for AnalysisResult model."""
    
    snapshot = AnalysisSnapshotSerializer(read_only=True)
    baseline_snapshot = AnalysisSnapshotSerializer(read_only=True)
    website_name = serializers.CharField(source='snapshot.website.name', read_only=True)
    website_url = serializers.CharField(source='snapshot.website.url', read_only=True)
    
    class Meta:
        model = AnalysisResult
        fields = [
            'id', 'snapshot', 'baseline_snapshot', 'website_name', 'website_url',
            'matrix_data', 'changed_blocks', 'total_blocks', 'change_percentage',
            'confidence_score', 'similarity_score', 'severity',
            'is_defacement_detected', 'ai_explanation',
            'visual_changes', 'content_changes', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']


class AnalysisResultSummarySerializer(serializers.ModelSerializer):
    """Summary serializer for AnalysisResult model."""
    
    website_name = serializers.CharField(source='snapshot.website.name', read_only=True)
    
    class Meta:
        model = AnalysisResult
        fields = [
            'id', 'website_name', 'changed_blocks', 'change_percentage',
            'severity', 'is_defacement_detected', 'created_at'
        ]


class MatrixComparisonSerializer(serializers.Serializer):
    """Serializer for matrix comparison data."""
    
    grid = serializers.ListField(
        child=serializers.ListField(child=serializers.IntegerField())
    )
    block_details = serializers.ListField()
    changed_blocks = serializers.IntegerField()
    total_blocks = serializers.IntegerField()
    change_percentage = serializers.FloatField()
