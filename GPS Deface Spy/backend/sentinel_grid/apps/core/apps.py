from django.apps import AppConfig


class CoreConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.core'
    verbose_name = 'Core (Dashboard, Settings, Health)'

    def ready(self):
        """Start scheduler when Django starts."""
        import sys
        
        # Only start scheduler for runserver command, not for migrations
        if 'runserver' in sys.argv:
            from .scheduler import start_scheduler
            try:
                start_scheduler()
            except Exception as e:
                import logging
                logger = logging.getLogger(__name__)
                logger.warning(f"Could not start scheduler: {e}")
