from django.db import connection
from django.utils import timezone
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny

from .models import SystemSettings, UserSettings
from .serializers import (
    SystemSettingsSerializer,
    UserSettingsSerializer,
    DashboardSerializer,
    HealthCheckSerializer,
)
from .scheduler import get_scheduler
from apps.monitoring.models import Website
from apps.alerts.models import Incident, Alert
from apps.alerts.serializers import IncidentSerializer, AlertSerializer


class DashboardView(APIView):
    """Dashboard data endpoint.

    Admin  – sees only their own websites, incidents, alerts.
    Analyst – sees ALL incidents and alerts across every website so they
             can investigate and resolve them.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        is_analyst = user.role == 'analyst'

        # --- Querysets scoped by role ---
        if is_analyst:
            # Analysts see ALL websites / incidents / alerts
            websites_qs = Website.objects.all()
            incidents_qs = Incident.objects.all()
            alerts_qs = Alert.objects.all()
        else:
            # Admin sees only their own data
            websites_qs = Website.objects.filter(user=user)
            incidents_qs = Incident.objects.filter(website__user=user)
            alerts_qs = Alert.objects.filter(website__user=user)

        # Website counts
        total_websites = websites_qs.count()
        active_websites = websites_qs.filter(status='active').count()

        # Incident counts
        total_incidents = incidents_qs.count()
        open_incidents = incidents_qs.filter(
            status__in=['open', 'investigating']
        ).count()

        # Alert counts
        total_alerts = alerts_qs.count()
        active_alerts = alerts_qs.filter(status='active').count()

        # Severity breakdown
        severity_breakdown = {
            'low': incidents_qs.filter(severity='low').count(),
            'medium': incidents_qs.filter(severity='medium').count(),
            'high': incidents_qs.filter(severity='high').count(),
            'critical': incidents_qs.filter(severity='critical').count(),
        }

        # Recent incidents
        recent_incidents = incidents_qs.order_by('-created_at')[:5]

        # Recent alerts
        recent_alerts = alerts_qs.order_by('-created_at')[:5]

        return Response({
            'total_websites': total_websites,
            'active_websites': active_websites,
            'total_incidents': total_incidents,
            'open_incidents': open_incidents,
            'total_alerts': total_alerts,
            'active_alerts': active_alerts,
            'severity_breakdown': severity_breakdown,
            'recent_incidents': IncidentSerializer(recent_incidents, many=True).data,
            'recent_alerts': AlertSerializer(recent_alerts, many=True).data,
        })


class SystemSettingsView(APIView):
    """System settings endpoint."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        settings_obj = SystemSettings.get_settings()
        serializer = SystemSettingsSerializer(settings_obj)
        return Response(serializer.data)

    def put(self, request):
        settings_obj = SystemSettings.get_settings()
        serializer = SystemSettingsSerializer(
            settings_obj,
            data=request.data,
            partial=True
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()

        return Response({
            'message': 'Settings updated successfully',
            'settings': serializer.data
        })


class UserSettingsView(APIView):
    """User settings endpoint."""
    
    permission_classes = [IsAuthenticated]

    def get(self, request):
        settings_obj, created = UserSettings.objects.get_or_create(
            user=request.user
        )
        serializer = UserSettingsSerializer(settings_obj)
        return Response(serializer.data)

    def put(self, request):
        settings_obj, created = UserSettings.objects.get_or_create(
            user=request.user
        )
        serializer = UserSettingsSerializer(
            settings_obj,
            data=request.data,
            partial=True
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        
        return Response({
            'message': 'Settings updated successfully',
            'settings': serializer.data
        })


class HealthCheckView(APIView):
    """Health check endpoint."""
    
    permission_classes = [AllowAny]

    def get(self, request):
        # Check database
        try:
            connection.ensure_connection()
            db_status = 'healthy'
        except Exception:
            db_status = 'unhealthy'
        
        # Check scheduler
        try:
            sched = get_scheduler()
            scheduler_status = 'running' if sched.running else 'stopped'
        except Exception:
            scheduler_status = 'error'
        
        # Overall status
        overall_status = 'healthy' if db_status == 'healthy' else 'unhealthy'
        
        return Response({
            'status': overall_status,
            'database': db_status,
            'scheduler': scheduler_status,
            'timestamp': timezone.now(),
            'version': '1.0.0',
        })


class SchedulerControlView(APIView):
    """Scheduler control endpoint."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Get scheduler status."""
        try:
            sched = get_scheduler()
            jobs = []
            for job in sched.get_jobs():
                jobs.append({
                    'id': job.id,
                    'name': job.name,
                    'next_run': job.next_run_time,
                })

            return Response({
                'running': sched.running,
                'jobs': jobs,
            })
        except Exception as e:
            return Response({
                'error': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def post(self, request):
        """Start or stop scheduler."""
        action = request.data.get('action')

        if action == 'start':
            from .scheduler import start_scheduler
            start_scheduler()
            return Response({'message': 'Scheduler started'})
        elif action == 'stop':
            from .scheduler import stop_scheduler
            stop_scheduler()
            return Response({'message': 'Scheduler stopped'})
        else:
            return Response({
                'error': 'Invalid action. Use "start" or "stop"'
            }, status=status.HTTP_400_BAD_REQUEST)
