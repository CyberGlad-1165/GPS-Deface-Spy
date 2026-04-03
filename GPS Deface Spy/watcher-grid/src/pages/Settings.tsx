import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Settings as SettingsIcon,
  Bell,
  Shield,
  Monitor,
  Palette,
  Info,
  Save,
  CheckCircle,
  Radar,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { MainLayout } from '@/components/layout/MainLayout';
import { toast } from '@/hooks/use-toast';
import { useHealth, useWebsites, useAnalyses, useDashboard } from '@/hooks/useApi';

export default function Settings() {
  const { data: health, isLoading: healthLoading } = useHealth();
  const { data: websites } = useWebsites();
  const { data: analyses } = useAnalyses();
  const { data: dashboard } = useDashboard();

  const [settings, setSettings] = useState({
    monitoringInterval: 5,
    alertSensitivity: 75,
    emailNotifications: true,
    pushNotifications: true,
    autoResolve: false,
    darkMode: true,
  });

  // Calculate last update from either latest analysis or latest website scan
  const getLastUpdate = () => {
    const dates: Date[] = [];
    
    // Check latest analysis
    if (analyses?.results?.[0]?.created_at) {
      dates.push(new Date(analyses.results[0].created_at));
    }
    
    // Check latest website scan
    if (websites?.results) {
      websites.results.forEach(website => {
        if (website.last_scan) {
          dates.push(new Date(website.last_scan));
        }
      });
    }
    
    if (dates.length === 0) return 'No activity yet';
    
    const latest = new Date(Math.max(...dates.map(d => d.getTime())));
    return latest.toLocaleDateString('en-US', { 
      month: 'long', 
      day: 'numeric', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // API status derived from health check
  const getApiStatus = () => {
    if (healthLoading) return { value: 'Checking...', status: 'loading' };
    if (!health) return { value: 'Unknown', status: 'unknown' };
    if (health.status === 'healthy') return { value: 'Operational', status: 'success' };
    return { value: health.status, status: 'error' };
  };

  const apiStatus = getApiStatus();

  const handleSave = () => {
    toast({ title: 'Settings Saved', description: 'Preferences updated.' });
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
  };

  return (
    <MainLayout>
      <motion.div variants={containerVariants} initial="hidden" animate="visible" className="max-w-4xl mx-auto space-y-6">
        <motion.div variants={itemVariants}>
          <div className="flex items-center gap-3">
            <SettingsIcon className="w-7 h-7 text-primary" />
            <div>
              <h1 className="text-2xl font-bold font-mono tracking-tight">SETTINGS</h1>
              <p className="text-xs font-mono text-muted-foreground tracking-wider">SYSTEM CONFIGURATION</p>
            </div>
          </div>
        </motion.div>

        {/* Monitoring */}
        <motion.div variants={itemVariants} className="glass-card p-6 space-y-6">
          <div className="flex items-center gap-3 pb-4 border-b border-border">
            <div className="p-2 rounded-lg bg-primary/10"><Monitor className="w-5 h-5 text-primary" /></div>
            <div>
              <h2 className="font-semibold">Monitoring Configuration</h2>
              <p className="text-xs font-mono text-muted-foreground">SCAN BEHAVIOR</p>
            </div>
          </div>
          <div className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-mono tracking-wider">DEFAULT INTERVAL</Label>
                <span className="text-sm text-primary font-mono font-bold">{settings.monitoringInterval}m</span>
              </div>
              <Slider value={[settings.monitoringInterval]} onValueChange={(v) => setSettings({ ...settings, monitoringInterval: v[0] })} min={1} max={60} step={1} />
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-mono tracking-wider">ALERT SENSITIVITY</Label>
                <span className="text-sm text-primary font-mono font-bold">{settings.alertSensitivity}%</span>
              </div>
              <Slider value={[settings.alertSensitivity]} onValueChange={(v) => setSettings({ ...settings, alertSensitivity: v[0] })} min={0} max={100} step={5} />
            </div>
          </div>
        </motion.div>

        {/* Notifications */}
        <motion.div variants={itemVariants} className="glass-card p-6 space-y-6">
          <div className="flex items-center gap-3 pb-4 border-b border-border">
            <div className="p-2 rounded-lg bg-primary/10"><Bell className="w-5 h-5 text-primary" /></div>
            <div>
              <h2 className="font-semibold">Notifications</h2>
              <p className="text-xs font-mono text-muted-foreground">ALERT DELIVERY</p>
            </div>
          </div>
          <div className="space-y-3">
            {[
              { key: 'emailNotifications', title: 'Email Notifications', desc: 'Receive alerts via email' },
              { key: 'pushNotifications', title: 'Push Notifications', desc: 'Browser push notifications' },
              { key: 'autoResolve', title: 'Auto-Resolve Low', desc: 'Auto-resolve low-severity alerts' },
            ].map((item) => (
              <div key={item.key} className="flex items-center justify-between p-3 rounded-md bg-secondary/50 hover:bg-secondary/70 transition-colors">
                <div>
                  <p className="text-sm font-medium">{item.title}</p>
                  <p className="text-[10px] font-mono text-muted-foreground">{item.desc}</p>
                </div>
                <Switch checked={settings[item.key as keyof typeof settings] as boolean} onCheckedChange={(checked) => setSettings({ ...settings, [item.key]: checked })} />
              </div>
            ))}
          </div>
        </motion.div>

        {/* System Info */}
        <motion.div variants={itemVariants} className="glass-card p-6 space-y-6">
          <div className="flex items-center gap-3 pb-4 border-b border-border">
            <div className="p-2 rounded-lg bg-primary/10"><Info className="w-5 h-5 text-primary" /></div>
            <div>
              <h2 className="font-semibold">System Information</h2>
              <p className="text-xs font-mono text-muted-foreground">LIVE STATUS</p>
            </div>
          </div>
          <div className="grid gap-3">
            {/* Version */}
            <div className="flex items-center justify-between p-3 rounded-md bg-secondary/30">
              <span className="text-xs font-mono text-muted-foreground tracking-wider">VERSION</span>
              <div className="flex items-center gap-2">
                <span className="text-sm font-mono font-medium">{health?.version || 'v1.0.0'}</span>
              </div>
            </div>
            
            {/* Database Status */}
            <div className="flex items-center justify-between p-3 rounded-md bg-secondary/30">
              <span className="text-xs font-mono text-muted-foreground tracking-wider">DATABASE</span>
              <div className="flex items-center gap-2">
                <span className="text-sm font-mono font-medium">{health?.database || 'Unknown'}</span>
                {health?.database === 'connected' && <CheckCircle className="w-4 h-4 text-primary" />}
                {health?.database === 'disconnected' && <AlertCircle className="w-4 h-4 text-destructive" />}
              </div>
            </div>
            
            {/* Scheduler Status */}
            <div className="flex items-center justify-between p-3 rounded-md bg-secondary/30">
              <span className="text-xs font-mono text-muted-foreground tracking-wider">SCHEDULER</span>
              <div className="flex items-center gap-2">
                <span className="text-sm font-mono font-medium">{health?.scheduler || 'Unknown'}</span>
                {health?.scheduler === 'running' && <CheckCircle className="w-4 h-4 text-primary" />}
              </div>
            </div>
            
            {/* Last Activity */}
            <div className="flex items-center justify-between p-3 rounded-md bg-secondary/30">
              <span className="text-xs font-mono text-muted-foreground tracking-wider">LAST ACTIVITY</span>
              <div className="flex items-center gap-2">
                <span className="text-sm font-mono font-medium">{getLastUpdate()}</span>
              </div>
            </div>
            
            {/* Monitored Sites */}
            <div className="flex items-center justify-between p-3 rounded-md bg-secondary/30">
              <span className="text-xs font-mono text-muted-foreground tracking-wider">MONITORED SITES</span>
              <div className="flex items-center gap-2">
                <span className="text-sm font-mono font-medium">{dashboard?.total_websites || websites?.results?.length || 0}</span>
              </div>
            </div>
            
            {/* API Status */}
            <div className="flex items-center justify-between p-3 rounded-md bg-secondary/30">
              <span className="text-xs font-mono text-muted-foreground tracking-wider">API STATUS</span>
              <div className="flex items-center gap-2">
                <span className="text-sm font-mono font-medium">{apiStatus.value}</span>
                {apiStatus.status === 'loading' && <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />}
                {apiStatus.status === 'success' && <CheckCircle className="w-4 h-4 text-primary" />}
                {apiStatus.status === 'error' && <AlertCircle className="w-4 h-4 text-destructive" />}
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div variants={itemVariants} className="flex justify-end">
          <Button variant="cyber" size="lg" onClick={handleSave} className="font-mono">
            <Save className="w-4 h-4" />
            Save Settings
          </Button>
        </motion.div>
      </motion.div>
    </MainLayout>
  );
}
