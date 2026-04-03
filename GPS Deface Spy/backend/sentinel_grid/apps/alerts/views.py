from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.http import FileResponse
from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter

from .models import Incident, Alert
from .serializers import (
    IncidentSerializer,
    IncidentUpdateSerializer,
    AlertSerializer,
    AlertResolveSerializer,
    AlertClassifySerializer,
)
from .services import AlertService
from .ml_predictor import predict_alert
from .soc_report import SOCReportGenerator


class IncidentViewSet(viewsets.ModelViewSet):
    """ViewSet for Incident management.

    Admin   – sees incidents for own websites only.
    Analyst – sees ALL incidents across every website so they can investigate.
    Resolve / mark_false_positive restricted to analyst role.
    """

    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['severity', 'status', 'website']
    search_fields = ['title', 'description', 'website__name']
    ordering_fields = ['created_at', 'severity', 'status']
    ordering = ['-created_at']

    def get_queryset(self):
        if self.request.user.role == 'analyst':
            return Incident.objects.all().select_related(
                'website', 'snapshot', 'analysis_result', 'resolved_by'
            )
        return Incident.objects.filter(
            website__user=self.request.user
        ).select_related('website', 'snapshot', 'analysis_result', 'resolved_by')

    def get_serializer_class(self):
        if self.action in ['update', 'partial_update']:
            return IncidentUpdateSerializer
        return IncidentSerializer

    @action(detail=True, methods=['patch'])
    def resolve(self, request, pk=None):
        """Resolve an incident."""
        incident = self.get_object()
        
        incident.status = 'resolved'
        incident.resolved_by = request.user
        from django.utils import timezone
        incident.resolved_at = timezone.now()
        incident.resolution_notes = request.data.get('resolution_notes', '')
        incident.save()
        
        # Also resolve related alerts
        incident.alerts.filter(status='active').update(
            status='resolved',
            resolved_at=timezone.now()
        )
        
        return Response({
            'message': 'Incident resolved successfully',
            'incident': IncidentSerializer(incident).data
        })

    @action(detail=True, methods=['patch'])
    def mark_false_positive(self, request, pk=None):
        """Mark incident as false positive."""
        incident = self.get_object()
        
        incident.status = 'false_positive'
        incident.save()
        
        # Dismiss related alerts
        incident.alerts.filter(status='active').update(status='dismissed')
        
        return Response({
            'message': 'Incident marked as false positive',
            'incident': IncidentSerializer(incident).data
        })


class AlertViewSet(viewsets.ModelViewSet):
    """ViewSet for Alert management.

    Admin   – sees alerts for own websites.
    Analyst – sees ALL alerts across every website.
    Resolve / acknowledge / dismiss available to analyst role.
    """

    permission_classes = [IsAuthenticated]
    serializer_class = AlertSerializer
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['severity', 'status', 'website', 'is_email_sent']
    search_fields = ['title', 'message', 'website__name']
    ordering_fields = ['created_at', 'severity', 'status']
    ordering = ['-created_at']

    def get_queryset(self):
        if self.request.user.role == 'analyst':
            return Alert.objects.all().select_related(
                'website', 'incident', 'acknowledged_by'
            )
        return Alert.objects.filter(
            website__user=self.request.user
        ).select_related('website', 'incident', 'acknowledged_by')

    @action(detail=True, methods=['patch'])
    def resolve(self, request, pk=None):
        """Resolve an alert."""
        alert = self.get_object()
        
        service = AlertService()
        alert = service.resolve_alert(alert, request.user)
        
        return Response({
            'message': 'Alert resolved successfully',
            'alert': AlertSerializer(alert).data
        })

    @action(detail=True, methods=['patch'])
    def acknowledge(self, request, pk=None):
        """Acknowledge an alert."""
        alert = self.get_object()
        
        service = AlertService()
        alert = service.acknowledge_alert(alert, request.user)
        
        return Response({
            'message': 'Alert acknowledged',
            'alert': AlertSerializer(alert).data
        })

    @action(detail=True, methods=['patch'])
    def dismiss(self, request, pk=None):
        """Dismiss an alert (mark as false positive)."""
        alert = self.get_object()
        
        service = AlertService()
        alert = service.dismiss_alert(alert)
        
        return Response({
            'message': 'Alert dismissed',
            'alert': AlertSerializer(alert).data
        })

    @action(detail=False, methods=['get'])
    def active(self, request):
        """Get all active alerts."""
        alerts = self.get_queryset().filter(status='active')
        serializer = AlertSerializer(alerts, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def statistics(self, request):
        """Get alert statistics."""
        queryset = self.get_queryset()
        
        return Response({
            'total': queryset.count(),
            'active': queryset.filter(status='active').count(),
            'acknowledged': queryset.filter(status='acknowledged').count(),
            'resolved': queryset.filter(status='resolved').count(),
            'dismissed': queryset.filter(status='dismissed').count(),
            'severity_breakdown': {
                'low': queryset.filter(severity='low').count(),
                'medium': queryset.filter(severity='medium').count(),
                'high': queryset.filter(severity='high').count(),
                'critical': queryset.filter(severity='critical').count(),
            }
        })

    # ── SOC Investigation endpoints ─────────────────────────────

    @action(detail=True, methods=['post'])
    def predict(self, request, pk=None):
        """Run AI/ML prediction for True Positive / False Positive."""
        alert = self.get_object()

        result = predict_alert(alert)

        alert.ai_prediction = result['prediction']
        alert.ai_prediction_confidence = result['confidence']
        alert.ai_prediction_details = result['details']
        alert.save(update_fields=[
            'ai_prediction', 'ai_prediction_confidence', 'ai_prediction_details',
        ])

        return Response({
            'message': f"AI predicts {result['prediction'].replace('_', ' ').upper()} "
                       f"with {result['confidence']}% confidence",
            'prediction': result['prediction'],
            'confidence': result['confidence'],
            'details': result['details'],
            'alert': AlertSerializer(alert).data,
        })

    @action(detail=True, methods=['patch'])
    def classify(self, request, pk=None):
        """Analyst manually classifies alert as TP or FP."""
        alert = self.get_object()
        serializer = AlertClassifySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        alert.classification = serializer.validated_data['classification']
        alert.investigation_notes = serializer.validated_data.get(
            'investigation_notes', alert.investigation_notes
        )
        alert.classified_by = request.user
        alert.classified_at = timezone.now()
        alert.save(update_fields=[
            'classification', 'investigation_notes',
            'classified_by', 'classified_at',
        ])

        # If classified as false positive, also dismiss the alert
        if alert.classification == 'false_positive':
            service = AlertService()
            service.dismiss_alert(alert)

        return Response({
            'message': f"Alert classified as "
                       f"{alert.classification.replace('_', ' ').upper()}",
            'alert': AlertSerializer(alert).data,
        })

    @action(detail=True, methods=['post'])
    def notify_owner(self, request, pk=None):
        """Send notification to the website owner about a confirmed threat."""
        alert = self.get_object()

        service = AlertService()
        sent = service.send_notification(alert)

        if sent:
            alert.owner_notified = True
            alert.owner_notified_at = timezone.now()
            alert.save(update_fields=['owner_notified', 'owner_notified_at'])

            return Response({
                'message': 'Website owner has been notified via email',
                'alert': AlertSerializer(alert).data,
            })

        return Response(
            {'error': 'Failed to send owner notification. Check SMTP settings.'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    @action(detail=True, methods=['get'])
    def soc_report(self, request, pk=None):
        """Download SOC Investigation Report as PDF."""
        alert = self.get_object()

        try:
            generator = SOCReportGenerator()
            filepath = generator.generate(alert)
            return FileResponse(
                open(filepath, 'rb'),
                content_type='application/pdf',
                as_attachment=True,
                filename=f'SOC_Report_Alert_{alert.id}.pdf',
            )
        except Exception as e:
            return Response(
                {'error': f'Failed to generate SOC report: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
