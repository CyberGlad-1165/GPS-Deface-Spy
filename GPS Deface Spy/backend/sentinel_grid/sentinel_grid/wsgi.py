"""
WSGI config for sentinel_grid project.
"""

import os

from django.core.wsgi import get_wsgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'sentinel_grid.settings')

application = get_wsgi_application()
