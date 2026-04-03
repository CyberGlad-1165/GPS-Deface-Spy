import os
from django.http import FileResponse, Http404
from django.conf import settings
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import OrderingFilter
from rest_framework_simplejwt.tokens import AccessToken
from django.contrib.auth import get_user_model

from .models import Report
from .serializers import ReportSerializer, ReportCreateSerializer, ReportListSerializer
from .services import PDFReportGenerator

User = get_user_model()


class ReportViewSet(viewsets.ModelViewSet):
    """ViewSet for Report management."""

    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = ['report_type', 'status']
    ordering_fields = ['created_at', 'generated_at']
    ordering = ['-created_at']

    def get_queryset(self):
        return Report.objects.filter(user=self.request.user).prefetch_related('websites')

    def get_serializer_class(self):
        if self.action == 'create':
            return ReportCreateSerializer
        elif self.action == 'list':
            return ReportListSerializer
        return ReportSerializer

    def perform_create(self, serializer):
        report = serializer.save()
        # Generate PDF
        generator = PDFReportGenerator()
        generator.generate_report(report)

    @action(detail=True, methods=['get'], permission_classes=[AllowAny])
    def download(self, request, pk=None):
        """Download the generated PDF report. Accepts JWT via query param or header."""
        # If not authenticated via header, try query-param token
        if not request.user or not request.user.is_authenticated:
            token_str = request.query_params.get('token')
            if token_str:
                try:
                    token = AccessToken(token_str)
                    user = User.objects.get(id=token['user_id'])
                    request.user = user
                except Exception:
                    return Response({'error': 'Invalid or expired token'}, status=status.HTTP_401_UNAUTHORIZED)
            else:
                return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)

        report = self.get_object()
        
        if not report.file:
            return Response({
                'error': 'Report file not available'
            }, status=status.HTTP_404_NOT_FOUND)
        
        if report.status != 'completed':
            return Response({
                'error': 'Report is not ready yet'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        filepath = os.path.join(settings.MEDIA_ROOT, str(report.file))
        
        if not os.path.exists(filepath):
            return Response({
                'error': 'Report file not found'
            }, status=status.HTTP_404_NOT_FOUND)
        
        response = FileResponse(
            open(filepath, 'rb'),
            content_type='application/pdf'
        )
        response['Content-Disposition'] = f'attachment; filename="{os.path.basename(filepath)}"'
        return response

    @action(detail=True, methods=['post'])
    def regenerate(self, request, pk=None):
        """Regenerate a report."""
        report = self.get_object()
        
        # Delete old file if exists
        if report.file:
            old_path = os.path.join(settings.MEDIA_ROOT, str(report.file))
            if os.path.exists(old_path):
                os.remove(old_path)
        
        # Reset status
        report.status = 'pending'
        report.file = None
        report.file_size = None
        report.generated_at = None
        report.save()
        
        # Generate new PDF
        generator = PDFReportGenerator()
        generator.generate_report(report)
        
        return Response({
            'message': 'Report regenerated successfully',
            'report': ReportSerializer(report).data
        })

    @action(detail=False, methods=['post'])
    def send_email(self, request):
        """Send a monitoring report via email, with PDF attachment if available."""
        email = request.data.get('email')
        website_id = request.data.get('website_id')
        report_type = request.data.get('report_type', 'incident')
        
        if not email:
            return Response({'error': 'Email address required'}, status=status.HTTP_400_BAD_REQUEST)
        
        from apps.monitoring.models import Website
        from django.core.mail import EmailMessage
        from django.utils import timezone
        
        try:
            website = Website.objects.get(id=website_id, user=request.user, status='active') if website_id else None
            
            # Get latest analysis if available
            analysis_data = None
            if website:
                from apps.analysis.models import AnalysisResult
                analysis = AnalysisResult.objects.filter(
                    snapshot__website=website
                ).order_by('-created_at').first()
                if analysis:
                    analysis_data = {
                        'changed_blocks': analysis.changed_blocks,
                        'total_blocks': getattr(analysis, 'total_blocks', 96),
                        'change_percentage': analysis.change_percentage,
                        'severity': analysis.severity,
                        'confidence_score': analysis.confidence_score,
                        'ai_explanation': analysis.ai_explanation or 'No AI analysis available.',
                    }
            
            # Compose email content
            site_name = website.name if website else 'All Websites'
            site_url = website.url if website else 'N/A'
            subject = f"[Deface Spy] Monitoring Report - {site_name}"
            
            message = f"""
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    DEFACE SPY - MONITORING REPORT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Report Type: {report_type.upper()}
Generated:   {timezone.now().strftime('%Y-%m-%d %H:%M:%S UTC')}
Website:     {site_name}
URL:         {site_url}

"""
            if analysis_data:
                message += f"""
╔══════════════════════════════════════╗
║         ANALYSIS SUMMARY            ║
╚══════════════════════════════════════╝

  Changed Blocks:   {analysis_data['changed_blocks']} / {analysis_data['total_blocks']}
  Change %:         {analysis_data['change_percentage']:.1f}%
  Severity:         {analysis_data['severity'].upper()}
  Confidence:       {analysis_data['confidence_score']:.1f}%

  AI Analysis:
  {analysis_data['ai_explanation']}

"""
            else:
                message += """
  No analysis data available yet.
  Start monitoring to generate analysis reports.

"""
            
            message += """
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
This report was automatically generated by
Deface Spy - Website Defacement Monitor
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"""
            
            # Try to find or generate PDF attachment
            pdf_path = None
            if website:
                # First, check for existing completed report
                latest_report = Report.objects.filter(
                    user=request.user,
                    websites=website,
                    status='completed',
                    file__isnull=False,
                ).order_by('-generated_at').first()
                
                if latest_report and latest_report.file:
                    candidate = os.path.join(settings.MEDIA_ROOT, str(latest_report.file))
                    if os.path.exists(candidate):
                        pdf_path = candidate
                
                # If no existing PDF, generate one on the fly
                if not pdf_path:
                    try:
                        report = Report.objects.create(
                            user=request.user,
                            report_type=report_type,
                            title=f"{report_type.title()} Report - {site_name}",
                        )
                        report.websites.add(website)
                        generator = PDFReportGenerator()
                        generator.generate_report(report)
                        report.refresh_from_db()
                        if report.file:
                            candidate = os.path.join(settings.MEDIA_ROOT, str(report.file))
                            if os.path.exists(candidate):
                                pdf_path = candidate
                    except Exception as gen_err:
                        import logging
                        logging.getLogger(__name__).warning(f"PDF generation failed: {gen_err}")
            
            # Build email with optional PDF attachment
            email_msg = EmailMessage(
                subject=subject,
                body=message,
                from_email=settings.DEFAULT_FROM_EMAIL,
                to=[email],
            )
            
            if pdf_path:
                email_msg.attach_file(pdf_path)
            
            # Send via Django's configured email backend
            email_msg.send(fail_silently=False)
            
            return Response({
                'message': f'Report sent successfully to {email}',
                'email': email,
                'website': site_name,
                'pdf_attached': pdf_path is not None,
            })
            
        except Website.DoesNotExist:
            return Response({'error': 'Website not found'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            import traceback
            error_detail = str(e)
            if 'Authentication' in error_detail or 'SMTP' in error_detail or 'auth' in error_detail.lower():
                error_detail += ' - Check EMAIL_HOST_USER and EMAIL_HOST_PASSWORD in .env (Gmail requires App Password)'
            return Response({
                'error': f'Email sending failed: {error_detail}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['get'])
    def templates(self, request):
        """Get available report templates."""
        return Response({
            'templates': [
                {'id': 'summary', 'name': 'Summary Report', 'description': 'Overview of all monitoring data'},
                {'id': 'detailed', 'name': 'Detailed Report', 'description': 'Comprehensive analysis report'},
                {'id': 'incident', 'name': 'Incident Report', 'description': 'Focus on incidents and alerts'},
                {'id': 'weekly', 'name': 'Weekly Report', 'description': 'Weekly monitoring summary'},
                {'id': 'monthly', 'name': 'Monthly Report', 'description': 'Monthly monitoring summary'},
            ]
        })
