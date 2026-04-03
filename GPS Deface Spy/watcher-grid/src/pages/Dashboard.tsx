import { motion } from 'framer-motion';
import {
  Globe,
  Eye,
  ArrowRight,
  Radar,
  Grid3X3,
  Search,
  AlertTriangle,
  Shield,
  Activity,
  Bell,
  Trash2,
} from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { useDashboard, useWebsites, useActiveAlerts, useDeleteWebsite } from '@/hooks/useApi';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/hooks/use-toast';

export default function Dashboard() {
  const { data: dashboard, isLoading: dashboardLoading } = useDashboard();
  const { data: websites, isLoading: websitesLoading } = useWebsites();
  const { data: alerts } = useActiveAlerts();
  const deleteWebsite = useDeleteWebsite();

  const isLoading = dashboardLoading || websitesLoading;
  const hasWebsites = websites && websites.results && websites.results.length > 0;

  // Show stats view if there are websites
  if (hasWebsites && dashboard) {
    return (
      <MainLayout>
        <div className="space-y-6">
          {/* Header */}
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Radar className="w-8 h-8 text-primary" />
                <div>
                  <h1 className="text-2xl font-bold font-mono tracking-tight">COMMAND CENTER</h1>
                  <p className="text-xs font-mono text-muted-foreground tracking-wider">REAL-TIME MONITORING DASHBOARD</p>
                </div>
              </div>
              <Link to="/add-website">
                <Button variant="cyber" size="sm" className="font-mono">
                  <Eye className="w-4 h-4" />
                  Add Website
                </Button>
              </Link>
            </div>
          </motion.div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Monitored Sites', value: dashboard.total_websites, icon: Globe, color: 'text-primary' },
              { label: 'Active', value: dashboard.active_websites, icon: Activity, color: 'text-green-500' },
              { label: 'Open Incidents', value: dashboard.open_incidents, icon: AlertTriangle, color: dashboard.open_incidents > 0 ? 'text-red-500' : 'text-muted-foreground' },
              { label: 'Active Alerts', value: dashboard.active_alerts, icon: Bell, color: dashboard.active_alerts > 0 ? 'text-yellow-500' : 'text-muted-foreground' },
            ].map((stat, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="glass-card p-4"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-secondary/50 flex items-center justify-center">
                    <stat.icon className={`w-5 h-5 ${stat.color}`} />
                  </div>
                  <div>
                    <div className="text-2xl font-bold font-mono">{stat.value}</div>
                    <div className="text-xs text-muted-foreground font-mono">{stat.label}</div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Severity Breakdown */}
          {dashboard.severity_breakdown && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="glass-card p-4"
            >
              <h3 className="text-sm font-mono font-bold mb-4 text-muted-foreground">SEVERITY BREAKDOWN</h3>
              <div className="grid grid-cols-4 gap-4">
                {[
                  { label: 'Critical', value: dashboard.severity_breakdown.critical, color: 'bg-red-500' },
                  { label: 'High', value: dashboard.severity_breakdown.high, color: 'bg-orange-500' },
                  { label: 'Medium', value: dashboard.severity_breakdown.medium, color: 'bg-yellow-500' },
                  { label: 'Low', value: dashboard.severity_breakdown.low, color: 'bg-green-500' },
                ].map((item, i) => (
                  <div key={i} className="text-center">
                    <div className={`w-full h-2 rounded-full bg-secondary mb-2 overflow-hidden`}>
                      <div className={`h-full ${item.color}`} style={{ width: `${Math.min(item.value * 10, 100)}%` }} />
                    </div>
                    <div className="text-lg font-bold font-mono">{item.value}</div>
                    <div className="text-xs text-muted-foreground">{item.label}</div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Monitored Websites List */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="glass-card p-4"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-mono font-bold text-muted-foreground">MONITORED WEBSITES</h3>
              <Link to="/add-website" className="text-xs text-primary hover:underline font-mono">View All</Link>
            </div>
            <div className="space-y-2">
              {websites.results.slice(0, 5).map((site) => (
                <div key={site.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${site.status === 'active' ? 'bg-green-500' : site.status === 'error' ? 'bg-red-500' : 'bg-yellow-500'}`} />
                    <div>
                      <div className="font-mono text-sm">{site.name}</div>
                      <div className="text-xs text-muted-foreground">{site.url}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-xs text-muted-foreground font-mono">
                      {site.last_scan ? new Date(site.last_scan).toLocaleTimeString() : 'Never scanned'}
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`Delete ${site.name}?`)) {
                          deleteWebsite.mutate(site.id, {
                            onSuccess: () => {
                              toast({ title: 'Deleted', description: `${site.name} has been removed` });
                            },
                            onError: (error: any) => {
                              toast({ title: 'Delete Failed', description: error.message || 'Could not delete website', variant: 'destructive' });
                            }
                          });
                        }
                      }}
                      disabled={deleteWebsite.isPending}
                      className="p-1.5 rounded hover:bg-red-500/20 text-muted-foreground hover:text-red-500 transition-colors disabled:opacity-50"
                      title="Delete website"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Recent Alerts */}
          {alerts && alerts.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="glass-card p-4"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-mono font-bold text-muted-foreground">RECENT ALERTS</h3>
                <Link to="/alerts" className="text-xs text-primary hover:underline font-mono">View All</Link>
              </div>
              <div className="space-y-2">
                {alerts.slice(0, 3).map((alert) => (
                  <div key={alert.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/30">
                    <div className="flex items-center gap-3">
                      <AlertTriangle className={`w-4 h-4 ${
                        alert.severity === 'critical' ? 'text-red-500' :
                        alert.severity === 'high' ? 'text-orange-500' :
                        alert.severity === 'medium' ? 'text-yellow-500' : 'text-green-500'
                      }`} />
                      <div>
                        <div className="font-mono text-sm">{alert.title}</div>
                        <div className="text-xs text-muted-foreground">{alert.website_name}</div>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground font-mono">
                      {new Date(alert.created_at).toLocaleTimeString()}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </div>
      </MainLayout>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <MainLayout>
        <div className="space-y-6">
          <Skeleton className="h-12 w-64" />
          <Skeleton className="h-64 w-full" />
          <div className="grid md:grid-cols-3 gap-4">
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
          </div>
        </div>
      </MainLayout>
    );
  }
  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
          <div className="flex items-center gap-3">
            <Radar className="w-8 h-8 text-primary" />
            <div>
              <h1 className="text-2xl font-bold font-mono tracking-tight">COMMAND CENTER</h1>
              <p className="text-xs font-mono text-muted-foreground tracking-wider">REAL-TIME MONITORING DASHBOARD</p>
            </div>
          </div>
        </motion.div>

        {/* Empty State - Direct to Monitor */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass-card p-16 text-center"
        >
          <div className="w-24 h-24 mx-auto mb-8 rounded-2xl bg-primary/5 border border-primary/20 flex items-center justify-center">
            <Grid3X3 className="w-12 h-12 text-primary/50" />
          </div>
          <h2 className="text-2xl font-bold font-mono mb-3">START MONITORING</h2>
          <p className="text-sm text-muted-foreground font-mono max-w-lg mx-auto mb-8">
            Enter any website URL to begin real-time visual monitoring with live matrix-by-matrix change detection
          </p>
          <Link to="/add-website">
            <Button variant="cyber" size="lg" className="group font-mono">
              <Search className="w-5 h-5" />
              Start Visual Monitor
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Button>
          </Link>
        </motion.div>

        {/* Feature Cards */}
        <div className="grid md:grid-cols-3 gap-4">
          {[
            {
              icon: Eye,
              title: 'Live Preview',
              desc: 'View your monitored website in real-time with an embedded preview',
            },
            {
              icon: Grid3X3,
              title: 'Matrix Analysis',
              desc: 'Visual grid overlay showing change intensity across all regions',
            },
            {
              icon: Globe,
              title: 'Any Website',
              desc: 'Monitor any publicly accessible website by entering its URL',
            },
          ].map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + i * 0.1 }}
              className="glass-card p-6 group hover:border-primary/30 transition-all"
            >
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/15 transition-colors">
                <item.icon className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-semibold mb-2">{item.title}</h3>
              <p className="text-sm text-muted-foreground">{item.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </MainLayout>
  );
}
