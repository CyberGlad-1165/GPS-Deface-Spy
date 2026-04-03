"""
URL configuration for sentinel_grid project.
"""

from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from django.http import JsonResponse


def api_root(request):
    """Root endpoint returning API information."""
    return JsonResponse({
        'name': 'Sentinel Grid API',
        'version': '1.0.0',
        'description': 'Website Defacement Detection System',
        'endpoints': {
            'auth': '/api/auth/',
            'websites': '/api/websites/',
            'analysis': '/api/analysis/',
            'alerts': '/api/alerts/',
            'reports': '/api/reports/',
            'dashboard': '/api/dashboard/',
            'settings': '/api/settings/',
            'health': '/api/health/',
            'admin': '/admin/',
        }
    })


urlpatterns = [
    path('', api_root, name='api-root'),
    path('admin/', admin.site.urls),
    # API endpoints
    path('api/auth/', include('apps.accounts.urls')),
    path('api/websites/', include('apps.monitoring.urls')),
    path('api/analysis/', include('apps.analysis.urls')),
    path('api/alerts/', include('apps.alerts.urls')),
    path('api/reports/', include('apps.reports.urls')),
    path('api/', include('apps.core.urls')),
]

# Serve media files in development
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
