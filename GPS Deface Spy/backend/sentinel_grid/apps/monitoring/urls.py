from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import WebsiteViewSet, SnapshotViewSet, ProxyViewSet

app_name = 'monitoring'

router = DefaultRouter()
router.register(r'', WebsiteViewSet, basename='website')

urlpatterns = [
    path('snapshots/', SnapshotViewSet.as_view({'get': 'list'}), name='snapshot-list'),
    path('snapshots/<int:pk>/', SnapshotViewSet.as_view({'get': 'retrieve'}), name='snapshot-detail'),
    path('snapshots/<int:pk>/html/', SnapshotViewSet.as_view({'get': 'html_content'}), name='snapshot-html'),
    path('proxy/fetch/', ProxyViewSet.as_view({'get': 'fetch'}), name='proxy-fetch'),
    path('proxy/page/', ProxyViewSet.as_view({'get': 'page'}), name='proxy-page'),
    path('', include(router.urls)),
]
