"""
Role-based permission classes for Sentinel Grid.

Roles:
  - admin:   Add websites, set monitoring config, change system settings,
             receives monitoring status and reports.
  - analyst: Receives alerts, incident reports, alert notifications.
             Investigates, updates results, resolves alerts.
"""

from rest_framework.permissions import BasePermission


class IsAdmin(BasePermission):
    """Allow access only to users with the 'admin' role."""

    message = "Administrator access required."

    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and request.user.role == "admin"
        )


class IsAnalyst(BasePermission):
    """Allow access only to users with the 'analyst' role."""

    message = "Security Analyst access required."

    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and request.user.role == "analyst"
        )


class IsAdminOrAnalyst(BasePermission):
    """Allow access to both admin and analyst roles."""

    message = "Administrator or Security Analyst access required."

    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and request.user.role in ("admin", "analyst")
        )
