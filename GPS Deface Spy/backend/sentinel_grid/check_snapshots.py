#!/usr/bin/env python
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'sentinel_grid.settings')
django.setup()

from sentinel_grid.apps.monitoring.models import Snapshot, Website

print(f"\n=== SNAPSHOT AND WEBSITE CHECK ===\n")
print(f"Total snapshots: {Snapshot.objects.count()}")
print(f"Total websites: {Website.objects.count()}\n")

print("Recent snapshots (last 10):")
for s in Snapshot.objects.all().order_by('-created_at')[:10]:
    print(f"  ID: {s.id}, Website: {s.website_id} ({s.website.name if s.website else 'N/A'}), Status: {s.status}, Screenshot: '{s.screenshot}', IsBaseline: {s.is_baseline}, Created: {s.created_at}")

print("\n\nWebsites:")
for w in Website.objects.all():
    snap_count = w.snapshots.count()
    baseline_snap = w.snapshots.filter(is_baseline=True, status='completed').first()
    print(f"  ID: {w.id}, Name: {w.name}, URL: {w.url}, BaselineScreenshot: '{w.baseline_screenshot}', Snapshots: {snap_count}, Has baseline snapshot: {baseline_snap is not None}")
    
    if baseline_snap:
        print(f"    Baseline snapshot screenshot: '{baseline_snap.screenshot}'")
        
print("\n")
