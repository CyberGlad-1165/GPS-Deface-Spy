from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import AnalysisResultViewSet

app_name = 'analysis'

router = DefaultRouter()
router.register(r'', AnalysisResultViewSet, basename='analysis')

urlpatterns = [
    path('', include(router.urls)),
]
