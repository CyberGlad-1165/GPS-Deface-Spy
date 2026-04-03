import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Globe, Clock, Shield, AlertTriangle, CheckCircle, Download,
  Eye, ScanLine, Layers, FileText, Activity, ExternalLink, Radar, Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { MainLayout } from '@/components/layout/MainLayout';
import { cn } from '@/lib/utils';
import { useWebsite, useWebsiteSnapshots, useScanWebsite, useAlerts } from '@/hooks/useApi';
import { getProxyUrl } from '@/services/api';
import { toast } from '@/hooks/use-toast';

const statusConfig = {
  active: { label: 'ACTIVE', color: 'bg-primary/10 text-primary border-primary/30', icon: CheckCircle },
  paused: { label: 'PAUSED', color: 'bg-warning/10 text-warning border-warning/30', icon: Clock },
  error: { label: 'ERROR', color: 'bg-destructive/10 text-destructive border-destructive/30', icon: AlertTriangle },
};

export default function WebsiteProfile() {
  const { id } = useParams<{ id: string }>();
  const websiteId = parseInt(id || '0');
  
  const { data: website, isLoading: websiteLoading } = useWebsite(websiteId);
  const { data: snapshots, isLoading: snapshotsLoading } = useWebsiteSnapshots(websiteId);
  const { data: alertsData } = useAlerts();
  const scanWebsite = useScanWebsite();

  const websiteAlerts = alertsData?.results?.filter(a => a.website === websiteId) || [];
  const isLoading = websiteLoading || snapshotsLoading;

  const handleScan = async () => {
    try {
      await scanWebsite.mutateAsync({ id: websiteId });
      toast({ title: 'Scan Complete', description: 'Website scanned successfully.' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <MainLayout>
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <Skeleton className="h-10 w-10" />
            <div className="space-y-2">
              <Skeleton className="h-8 w-64" />
              <Skeleton className="h-4 w-48" />
            </div>
          </div>
          <div className="grid grid-cols-4 gap-3">
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
          </div>
          <div className="grid lg:grid-cols-3 gap-6">
            <Skeleton className="h-64" />
            <Skeleton className="h-64 lg:col-span-2" />
          </div>
        </div>
      </MainLayout>
    );
  }

  // Not found
  if (!website) {
    return (
      <MainLayout>
        <div className="glass-card p-16 text-center">
          <Globe className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
          <h2 className="text-xl font-bold font-mono mb-2">WEBSITE NOT FOUND</h2>
          <p className="text-sm text-muted-foreground mb-6">The requested website could not be found.</p>
          <Link to="/add-website">
            <Button variant="cyber">Go to Monitor</Button>
          </Link>
        </div>
      </MainLayout>
    );
  }

  const StatusIcon = statusConfig[website.status]?.icon || CheckCircle;

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link to="/"><Button variant="ghost" size="icon"><ArrowLeft className="w-5 h-5" /></Button></Link>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold font-mono tracking-tight">{website.name.toUpperCase()}</h1>
                <Badge variant="outline" className={cn(statusConfig[website.status]?.color || 'bg-secondary', 'font-mono text-[10px]')}>
                  <StatusIcon className="w-3 h-3 mr-1" />
                  {statusConfig[website.status]?.label || website.status.toUpperCase()}
                </Badge>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <Globe className="w-3.5 h-3.5 text-muted-foreground" />
                <a href={website.url} target="_blank" rel="noopener noreferrer" className="text-xs font-mono text-muted-foreground hover:text-primary transition-colors">
                  {website.url}
                </a>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="cyber-outline" 
              onClick={handleScan} 
              disabled={scanWebsite.isPending}
              className="font-mono text-xs"
            >
              {scanWebsite.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ScanLine className="w-4 h-4" />
              )}
              {scanWebsite.isPending ? 'Scanning...' : 'Scan Now'}
            </Button>
            <Link to="/analysis">
              <Button variant="cyber" className="font-mono text-xs">
                <Eye className="w-4 h-4" />
                Analyze
              </Button>
            </Link>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { icon: Layers, label: 'SNAPSHOTS', value: website.snapshot_count || 0 },
            { icon: Clock, label: 'INTERVAL', value: `${website.monitoring_interval / 60}m` },
            { icon: AlertTriangle, label: 'ALERTS', value: websiteAlerts.length },
            { icon: Shield, label: 'BASELINE', value: website.is_baseline_set ? 'SET' : 'NONE' },
          ].map((s, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="glass-card p-3 flex items-center gap-3">
              <s.icon className="w-4 h-4 text-primary" />
              <div>
                <p className="text-[10px] font-mono text-muted-foreground tracking-wider">{s.label}</p>
                <p className="text-lg font-bold font-mono leading-tight">{s.value}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Live Preview */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="glass-card p-5">
          <h2 className="text-xs font-mono tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
            <Eye className="w-4 h-4 text-primary" />LIVE PREVIEW
          </h2>
          <div className="relative w-full aspect-[16/7] rounded-md border border-border overflow-hidden bg-secondary/50">
            <iframe
              src={getProxyUrl(website.url)}
              title={`Live preview of ${website.name}`}
              className="absolute inset-0 w-full h-full"
              loading="lazy"
            />
            <div className="absolute bottom-2 left-2 bg-background/80 backdrop-blur-sm rounded px-2 py-0.5">
              <span className="text-[9px] font-mono text-primary tracking-wider">LIVE</span>
            </div>
          </div>
        </motion.div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Config */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="glass-card p-5">
            <h2 className="text-xs font-mono tracking-wider text-muted-foreground mb-4 flex items-center gap-2">
              <ScanLine className="w-4 h-4 text-primary" />WEBSITE INFO
            </h2>
            <div className="space-y-3">
              <div className="pt-3 space-y-2 text-xs font-mono">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">URL</span>
                  <span className="truncate max-w-32">{website.url}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">STATUS</span>
                  <span>{website.status.toUpperCase()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">CREATED</span>
                  <span>{new Date(website.created_at).toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">LAST SCAN</span>
                  <span>{website.last_scan ? new Date(website.last_scan).toLocaleString() : 'Never'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">NEXT SCAN</span>
                  <span>{website.next_scan ? new Date(website.next_scan).toLocaleString() : 'N/A'}</span>
                </div>
              </div>
              {website.tags && website.tags.length > 0 && (
                <div className="pt-3 border-t border-border">
                  <p className="text-[10px] text-muted-foreground mb-2">TAGS</p>
                  <div className="flex flex-wrap gap-1">
                    {website.tags.map((tag, i) => (
                      <Badge key={i} variant="secondary" className="text-[9px]">{tag}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>

          {/* Snapshots Timeline */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="glass-card p-5 lg:col-span-2">
            <h2 className="text-xs font-mono tracking-wider text-muted-foreground mb-4 flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" />CAPTURE HISTORY
            </h2>
            <div className="space-y-3 max-h-72 overflow-y-auto pr-2">
              {snapshots && snapshots.length > 0 ? (
                snapshots.map((snapshot, index) => (
                  <div key={snapshot.id} className="flex items-start gap-3 relative">
                    {index < snapshots.length - 1 && <div className="absolute left-[9px] top-5 bottom-0 w-px bg-border" />}
                    <div className={cn('w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 relative z-10',
                      snapshot.status === 'completed' && 'bg-primary/20',
                      snapshot.status === 'failed' && 'bg-destructive/20',
                      snapshot.status === 'pending' && 'bg-warning/20',
                    )}>
                      <div className={cn('w-2 h-2 rounded-full',
                        snapshot.status === 'completed' && 'bg-primary',
                        snapshot.status === 'failed' && 'bg-destructive',
                        snapshot.status === 'pending' && 'bg-warning',
                      )} />
                    </div>
                    <div className="pb-3 flex-1">
                      <div className="flex items-center justify-between">
                        <p className="text-sm">
                          {snapshot.is_baseline ? 'Baseline captured' : 'Snapshot captured'}
                        </p>
                        {snapshot.is_baseline && (
                          <Badge variant="outline" className="text-[9px] bg-primary/10 text-primary">BASELINE</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[10px] font-mono text-muted-foreground">
                        <span>{new Date(snapshot.created_at).toLocaleString()}</span>
                        {snapshot.response_time && (
                          <span>• {snapshot.response_time.toFixed(0)}ms</span>
                        )}
                        {snapshot.http_status_code && (
                          <span>• HTTP {snapshot.http_status_code}</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center">
                  <Eye className="w-10 h-10 text-muted-foreground/20 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">No snapshots captured yet</p>
                  <Button variant="cyber" size="sm" onClick={handleScan} disabled={scanWebsite.isPending} className="mt-3">
                    Capture First Snapshot
                  </Button>
                </div>
              )}
            </div>
          </motion.div>
        </div>

        {/* Alerts */}
        {websiteAlerts.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="glass-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-mono tracking-wider text-muted-foreground flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-warning" />RELATED ALERTS
              </h2>
              <Link to="/alerts"><Button variant="ghost" size="sm" className="font-mono text-xs">View All</Button></Link>
            </div>
            <div className="space-y-2">
              {websiteAlerts.slice(0, 5).map((alert) => (
                <div key={alert.id} className={cn('p-3 rounded-md border flex items-center justify-between',
                  alert.status === 'resolved' ? 'bg-secondary/30 border-border' : 'bg-warning/5 border-warning/30'
                )}>
                  <div className="flex items-center gap-3">
                    <AlertTriangle className={cn('w-4 h-4', alert.status === 'resolved' ? 'text-muted-foreground' : 'text-warning')} />
                    <div>
                      <p className="text-sm">{alert.message}</p>
                      <p className="text-[10px] font-mono text-muted-foreground">{new Date(alert.created_at).toLocaleString()}</p>
                    </div>
                  </div>
                  <Badge variant={alert.status === 'resolved' ? 'secondary' : 'default'} className="font-mono text-[10px]">
                    {alert.status.toUpperCase()}
                  </Badge>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </MainLayout>
  );
}
