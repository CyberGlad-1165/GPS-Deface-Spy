from django.urls import path
from .views import (
    DashboardView,
    SystemSettingsView,
    UserSettingsView,
    HealthCheckView,
    SchedulerControlView,
)

app_name = 'core'

urlpatterns = [
    path('dashboard/', DashboardView.as_view(), name='dashboard'),
    path('settings/', UserSettingsView.as_view(), name='user_settings'),
    path('settings/system/', SystemSettingsView.as_view(), name='system_settings'),
    path('health/', HealthCheckView.as_view(), name='health_check'),
    path('scheduler/', SchedulerControlView.as_view(), name='scheduler_control'),
]
