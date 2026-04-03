from rest_framework import serializers
from .models import Incident, Alert


class IncidentSerializer(serializers.ModelSerializer):
    """Serializer for Incident model."""
    
    website_name = serializers.CharField(source='website.name', read_only=True)
    website_url = serializers.CharField(source='website.url', read_only=True)
    resolved_by_name = serializers.CharField(
        source='resolved_by.email', 
        read_only=True,
        default=None
    )
    
    class Meta:
        model = Incident
        fields = [
            'id', 'website', 'website_name', 'website_url', 'snapshot',
            'analysis_result', 'title', 'description', 'severity', 'status',
            'change_percentage', 'affected_blocks', 'resolved_by',
            'resolved_by_name', 'resolved_at', 'resolution_notes',
            'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'website', 'snapshot', 'analysis_result',
            'resolved_by', 'resolved_at', 'created_at', 'updated_at'
        ]


class IncidentUpdateSerializer(serializers.ModelSerializer):
    """Serializer for updating an Incident."""
    
    class Meta:
        model = Incident
        fields = ['status', 'resolution_notes']


class AlertSerializer(serializers.ModelSerializer):
    """Serializer for Alert model."""
    
    website_name = serializers.CharField(source='website.name', read_only=True)
    website_url = serializers.CharField(source='website.url', read_only=True)
    incident_id = serializers.IntegerField(source='incident.id', read_only=True, default=None)
    acknowledged_by_name = serializers.CharField(
        source='acknowledged_by.email',
        read_only=True,
        default=None
    )
    
    classified_by_name = serializers.CharField(
        source='classified_by.email',
        read_only=True,
        default=None,
    )

    class Meta:
        model = Alert
        fields = [
            'id', 'incident', 'incident_id', 'website', 'website_name',
            'website_url', 'title', 'message', 'severity', 'status',
            'is_email_sent', 'email_sent_at', 'acknowledged_by',
            'acknowledged_by_name', 'acknowledged_at', 'resolved_at',
            'resolution_notes',
            # SOC classification fields
            'classification', 'classified_by', 'classified_by_name',
            'classified_at', 'investigation_notes',
            'ai_prediction', 'ai_prediction_confidence', 'ai_prediction_details',
            'owner_notified', 'owner_notified_at',
            'created_at', 'updated_at',
        ]
        read_only_fields = [
            'id', 'incident', 'website', 'is_email_sent', 'email_sent_at',
            'acknowledged_by', 'acknowledged_at', 'resolved_at',
            'classified_by', 'classified_at',
            'ai_prediction', 'ai_prediction_confidence', 'ai_prediction_details',
            'owner_notified', 'owner_notified_at',
            'created_at', 'updated_at',
        ]


class AlertResolveSerializer(serializers.Serializer):
    """Serializer for resolving an alert."""
    
    resolution_notes = serializers.CharField(required=False, allow_blank=True)


class AlertAcknowledgeSerializer(serializers.Serializer):
    """Serializer for acknowledging an alert."""
    pass


class AlertClassifySerializer(serializers.Serializer):
    """Serializer for TP/FP classification by analyst."""
    classification = serializers.ChoiceField(
        choices=['true_positive', 'false_positive'],
    )
    investigation_notes = serializers.CharField(required=False, allow_blank=True)
