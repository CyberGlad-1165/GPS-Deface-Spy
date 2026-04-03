from rest_framework import serializers
from .models import Report


class ReportSerializer(serializers.ModelSerializer):
    """Serializer for Report model."""
    
    user_email = serializers.CharField(source='user.email', read_only=True)
    websites_list = serializers.SerializerMethodField()
    download_url = serializers.SerializerMethodField()
    
    class Meta:
        model = Report
        fields = [
            'id', 'user', 'user_email', 'title', 'report_type', 'status',
            'websites', 'websites_list', 'start_date', 'end_date',
            'file', 'file_size', 'data', 'download_url',
            'generated_at', 'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'user', 'status', 'file', 'file_size', 'data',
            'generated_at', 'created_at', 'updated_at'
        ]

    def get_websites_list(self, obj):
        return [{'id': w.id, 'name': w.name} for w in obj.websites.all()]

    def get_download_url(self, obj):
        if obj.file:
            return f'/api/reports/{obj.id}/download/'
        return None


class ReportCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating a Report."""
    
    class Meta:
        model = Report
        fields = ['title', 'report_type', 'websites', 'start_date', 'end_date']

    def create(self, validated_data):
        websites = validated_data.pop('websites', [])
        validated_data['user'] = self.context['request'].user
        report = Report.objects.create(**validated_data)
        report.websites.set(websites)
        return report


class ReportListSerializer(serializers.ModelSerializer):
    """Summary serializer for listing reports."""
    
    class Meta:
        model = Report
        fields = [
            'id', 'title', 'report_type', 'status',
            'file', 'file_size', 'generated_at', 'created_at'
        ]
