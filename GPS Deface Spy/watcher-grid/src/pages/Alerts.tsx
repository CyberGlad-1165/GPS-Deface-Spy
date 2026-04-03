import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle,
  Shield,
  Clock,
  ExternalLink,
  CheckCircle,
  XCircle,
  Filter,
  Bell,
  Eye,
  Radar,
  Loader2,
  Search,
  FileText,
  ChevronUp,
  Send,
  BrainCircuit,
  ShieldCheck,
  ShieldX,
  Download,
  Mail,
  Activity,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MainLayout } from '@/components/layout/MainLayout';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import {
  useAlerts, useResolveAlert, useAcknowledgeAlert, useDismissAlert,
  usePredictAlert, useClassifyAlert, useNotifyOwner,
} from '@/hooks/useApi';
import { alertsAPI } from '@/services/api';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

const severityConfig = {
  low: { color: 'bg-primary/10 text-primary border-primary/20', icon: Shield },
  medium: { color: 'bg-warning/10 text-warning border-warning/20', icon: AlertTriangle },
  high: { color: 'bg-warning/10 text-warning border-warning/20', icon: AlertTriangle },
  critical: { color: 'bg-destructive/10 text-destructive border-destructive/20', icon: XCircle },
};

export default function Alerts() {
  const [filter, setFilter] = useState<'all' | 'active' | 'resolved'>('all');
  const [investigatingId, setInvestigatingId] = useState<number | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState<string>('');
  const [downloadingReport, setDownloadingReport] = useState<number | null>(null);
  const [resolvingId, setResolvingId] = useState<number | null>(null);
  const [resolveStep, setResolveStep] = useState<'classify' | 'tp_actions'>('classify');
  const [reportEmail, setReportEmail] = useState<string>('');
  const [tpProcessing, setTpProcessing] = useState(false);
  
  const { data: alertsData, isLoading, refetch } = useAlerts(
    filter === 'all' ? undefined : { status: filter }
  );
  
  const resolveAlert = useResolveAlert();
  const acknowledgeAlert = useAcknowledgeAlert();
  const dismissAlert = useDismissAlert();
  const predictAlert = usePredictAlert();
  const classifyAlert = useClassifyAlert();
  const notifyOwner = useNotifyOwner();

  const alerts = alertsData?.results || [];
  const activeCount = alerts.filter(a => a.status === 'active').length;
  const resolvedCount = alerts.filter(a => a.status === 'resolved').length;

  const handleResolve = async (alertId: number, notes?: string) => {
    try {
      await resolveAlert.mutateAsync({ id: alertId, resolutionNotes: notes });
      toast({ title: 'Alert Resolved', description: 'Threat marked as resolved.' });
      setInvestigatingId(null);
      setResolutionNotes('');
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const handleAcknowledge = async (alertId: number) => {
    try {
      await acknowledgeAlert.mutateAsync(alertId);
      toast({ title: 'Alert Acknowledged', description: 'Alert has been acknowledged.' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const handlePredict = async (alertId: number) => {
    try {
      const result = await predictAlert.mutateAsync(alertId);
      toast({
        title: 'AI Prediction Complete',
        description: result.message,
      });
    } catch (err: any) {
      toast({ title: 'Prediction Failed', description: err.message, variant: 'destructive' });
    }
  };

  const handleClassify = async (alertId: number, classification: 'true_positive' | 'false_positive') => {
    try {
      await classifyAlert.mutateAsync({
        id: alertId,
        classification,
        investigationNotes: resolutionNotes,
      });
      toast({
        title: 'Alert Classified',
        description: `Marked as ${classification.replace('_', ' ').toUpperCase()}`,
      });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const handleNotifyOwner = async (alertId: number) => {
    try {
      await notifyOwner.mutateAsync(alertId);
      toast({ title: 'Owner Notified', description: 'Website owner has been notified via email.' });
    } catch (err: any) {
      toast({ title: 'Notification Failed', description: err.message, variant: 'destructive' });
    }
  };

  const handleDownloadSOC = async (alertId: number) => {
    setDownloadingReport(alertId);
    try {
      await alertsAPI.downloadSocReport(alertId);
      toast({ title: 'SOC Report Downloaded', description: 'Investigation report saved as PDF.' });
    } catch (err: any) {
      toast({ title: 'Download Failed', description: err.message, variant: 'destructive' });
    } finally {
      setDownloadingReport(null);
    }
  };

  const handleFalsePositiveResolve = async (alertId: number) => {
    try {
      await classifyAlert.mutateAsync({
        id: alertId,
        classification: 'false_positive',
        investigationNotes: 'Classified as False Positive during resolution checking phase.',
      });
      await resolveAlert.mutateAsync({
        id: alertId,
        resolutionNotes: 'Resolved as False Positive — no real threat detected.',
      });
      toast({
        title: 'Alert Resolved',
        description: 'Classified as FALSE POSITIVE and resolved automatically.',
      });
      setResolvingId(null);
      setResolveStep('classify');
      setReportEmail('');
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const handleTruePositiveResolve = async (alertId: number) => {
    setTpProcessing(true);
    try {
      // Step 1: Classify as True Positive
      await classifyAlert.mutateAsync({
        id: alertId,
        classification: 'true_positive',
        investigationNotes: resolutionNotes || 'Confirmed True Positive during resolution checking phase.',
      });
      // Step 2: Generate SOC Report
      await alertsAPI.downloadSocReport(alertId);
      // Step 3: Send email notification
      await notifyOwner.mutateAsync(alertId);
      // Step 4: Mark as resolved
      await resolveAlert.mutateAsync({
        id: alertId,
        resolutionNotes: resolutionNotes || 'Resolved after True Positive confirmation. SOC report generated and email notification sent.',
      });
      toast({
        title: 'Alert Resolved',
        description: 'TRUE POSITIVE confirmed. SOC report generated and notification email sent.',
      });
      setResolvingId(null);
      setResolveStep('classify');
      setReportEmail('');
      setResolutionNotes('');
    } catch (err: any) {
      toast({ title: 'Resolution Failed', description: err.message, variant: 'destructive' });
    } finally {
      setTpProcessing(false);
    }
  };

  // Empty state when no alerts
  if (!isLoading && alerts.length === 0) {
    return (
      <MainLayout>
        <div className="space-y-6">
          {/* Header */}
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
            <div className="flex items-center gap-3">
              <Bell className="w-7 h-7 text-primary" />
              <div>
                <h1 className="text-2xl font-bold font-mono tracking-tight">THREAT ALERTS</h1>
                <p className="text-xs font-mono text-muted-foreground tracking-wider">INCIDENT MANAGEMENT</p>
              </div>
            </div>
          </motion.div>

          {/* Empty State */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card p-16 text-center"
          >
            <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-primary/5 border border-primary/20 flex items-center justify-center">
              <Shield className="w-10 h-10 text-primary/40" />
            </div>
            <h2 className="text-lg font-bold font-mono mb-2 text-muted-foreground">NO ALERTS</h2>
            <p className="text-sm text-muted-foreground/70 font-mono max-w-md mx-auto">
              All systems are operating normally. Alerts will appear here when threats are detected.
            </p>
          </motion.div>
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
          <div className="flex gap-2">
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-8 w-24" />
          </div>
          <div className="space-y-3">
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
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
            <div className="flex items-center gap-3">
              <Bell className="w-7 h-7 text-primary" />
              <div>
                <h1 className="text-2xl font-bold font-mono tracking-tight">THREAT ALERTS</h1>
                <p className="text-xs font-mono text-muted-foreground tracking-wider">INCIDENT MANAGEMENT</p>
              </div>
            </div>
          </motion.div>
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
            <div className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-md border",
              activeCount > 0
                ? "bg-destructive/10 border-destructive/20"
                : "bg-primary/10 border-primary/20"
            )}>
              <Radar className={cn("w-4 h-4", activeCount > 0 ? "text-destructive" : "text-primary")} />
              <span className={cn("text-xs font-mono tracking-wider", activeCount > 0 ? "text-destructive" : "text-primary")}>
                {activeCount} ACTIVE THREATS
              </span>
            </div>
          </motion.div>
        </div>

        {/* Filter */}
        <div className="flex items-center gap-2">
          {[
            { key: 'all', label: `ALL (${alerts.length})`, icon: Filter },
            { key: 'active', label: `ACTIVE (${activeCount})`, icon: AlertTriangle },
            { key: 'resolved', label: `RESOLVED (${resolvedCount})`, icon: CheckCircle },
          ].map((tab) => (
            <Button
              key={tab.key}
              variant={filter === tab.key ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setFilter(tab.key as typeof filter)}
              className="font-mono text-xs tracking-wider"
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
            </Button>
          ))}
        </div>

        {/* Alerts */}
        <AnimatePresence mode="popLayout">
          <div className="space-y-3">
            {alerts.map((alert, i) => {
              const SeverityIcon = severityConfig[alert.severity].icon;
              const isResolved = alert.status === 'resolved' || alert.status === 'dismissed';

              return (
                <motion.div
                  key={alert.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -100 }}
                  transition={{ delay: i * 0.05 }}
                  className={cn(
                    "glass-card p-5 border-l-2",
                    isResolved ? "opacity-60 border-l-muted" : cn(
                      alert.severity === 'critical' && "border-l-destructive",
                      alert.severity === 'high' && "border-l-warning",
                      alert.severity === 'medium' && "border-l-warning",
                      alert.severity === 'low' && "border-l-primary",
                    )
                  )}
                >
                  <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className={cn("p-2 rounded-lg", severityConfig[alert.severity].color)}>
                        <SeverityIcon className="w-5 h-5" />
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold">{alert.website_name}</h3>
                          <Badge variant="outline" className={cn(severityConfig[alert.severity].color, 'text-[10px] font-mono')}>
                            {alert.severity.toUpperCase()}
                          </Badge>
                          <Badge variant="outline" className="bg-secondary text-[10px] font-mono">
                            {alert.status.toUpperCase()}
                          </Badge>
                          {isResolved && (
                            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-[10px] font-mono">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              RESOLVED
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{alert.message}</p>
                        <div className="flex items-center gap-4 text-xs font-mono text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(alert.created_at).toLocaleString()}
                          </span>
                          {alert.website_url && (
                            <a href={alert.website_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-primary transition-colors">
                              <ExternalLink className="w-3 h-3" />
                              {alert.website_url}
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                    {!isResolved && (
                      <div className="flex items-center gap-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setInvestigatingId(investigatingId === alert.id ? null : alert.id);
                              setResolutionNotes('');
                              if (investigatingId !== alert.id) setResolvingId(null);
                            }}
                            className="font-mono text-xs text-chart-4"
                          >
                            {investigatingId === alert.id ? (
                              <ChevronUp className="w-3.5 h-3.5" />
                            ) : (
                              <Search className="w-3.5 h-3.5" />
                            )}
                            Investigate
                          </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleAcknowledge(alert.id)}
                          disabled={acknowledgeAlert.isPending}
                          className="font-mono text-xs"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Acknowledge
                        </Button>
                        <Button
                          variant="cyber"
                          size="sm"
                          onClick={() => {
                            if (resolvingId === alert.id) {
                              setResolvingId(null);
                              setResolveStep('classify');
                            } else {
                              setResolvingId(alert.id);
                              setResolveStep('classify');
                              setReportEmail('');
                              setInvestigatingId(null);
                            }
                          }}
                          className="font-mono text-xs"
                        >
                          {resolvingId === alert.id ? (
                            <ChevronUp className="w-3.5 h-3.5" />
                          ) : (
                            <CheckCircle className="w-3.5 h-3.5" />
                          )}
                          Resolve
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Investigation Panel */}
                  <AnimatePresence>
                    {investigatingId === alert.id && !isResolved && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="overflow-hidden"
                      >
                        <div className="mt-4 pt-4 border-t border-border/50 space-y-5">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-xs font-mono text-chart-4 tracking-wider">
                              <Search className="w-4 h-4" />
                              SOC THREAT INVESTIGATION PANEL
                            </div>
                            {alert.classification !== 'pending' && (
                              <Badge
                                variant="outline"
                                className={cn(
                                  'text-[10px] font-mono',
                                  alert.classification === 'true_positive'
                                    ? 'bg-destructive/10 text-destructive border-destructive/20'
                                    : 'bg-primary/10 text-primary border-primary/20'
                                )}
                              >
                                {alert.classification === 'true_positive' ? (
                                  <ShieldX className="w-3 h-3 mr-1" />
                                ) : (
                                  <ShieldCheck className="w-3 h-3 mr-1" />
                                )}
                                {alert.classification.replace('_', ' ').toUpperCase()}
                              </Badge>
                            )}
                          </div>

                          {/* Threat Summary Cards */}
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <div className="rounded-lg bg-muted/30 p-3 border border-border/30">
                              <p className="text-[10px] font-mono text-muted-foreground mb-1">SEVERITY</p>
                              <p className="text-sm font-semibold capitalize">{alert.severity}</p>
                            </div>
                            <div className="rounded-lg bg-muted/30 p-3 border border-border/30">
                              <p className="text-[10px] font-mono text-muted-foreground mb-1">TARGET</p>
                              <p className="text-sm font-semibold truncate">{alert.website_name}</p>
                            </div>
                            <div className="rounded-lg bg-muted/30 p-3 border border-border/30">
                              <p className="text-[10px] font-mono text-muted-foreground mb-1">DETECTED</p>
                              <p className="text-sm font-semibold">{new Date(alert.created_at).toLocaleString()}</p>
                            </div>
                            <div className="rounded-lg bg-muted/30 p-3 border border-border/30">
                              <p className="text-[10px] font-mono text-muted-foreground mb-1">STATUS</p>
                              <p className="text-sm font-semibold uppercase">{alert.status}</p>
                            </div>
                          </div>

                          {/* ── AI / ML Prediction Section ── */}
                          <div className="rounded-lg border border-chart-4/20 bg-chart-4/5 p-4 space-y-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 text-xs font-mono tracking-wider text-chart-4">
                                <BrainCircuit className="w-4 h-4" />
                                AI THREAT PREDICTION ENGINE
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handlePredict(alert.id)}
                                disabled={predictAlert.isPending}
                                className="font-mono text-xs border-chart-4/30 text-chart-4 hover:bg-chart-4/10"
                              >
                                {predictAlert.isPending ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Activity className="w-3.5 h-3.5" />
                                )}
                                {alert.ai_prediction !== 'pending' ? 'RE-ANALYZE' : 'RUN PREDICTION'}
                              </Button>
                            </div>

                            {alert.ai_prediction !== 'pending' ? (
                              <>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                  <div className="rounded-lg bg-background/60 p-3 border border-border/30">
                                    <p className="text-[10px] font-mono text-muted-foreground mb-2">PREDICTION</p>
                                    <div className="flex items-center gap-2">
                                      {alert.ai_prediction === 'true_positive' ? (
                                        <ShieldX className="w-5 h-5 text-destructive" />
                                      ) : (
                                        <ShieldCheck className="w-5 h-5 text-primary" />
                                      )}
                                      <span className={cn(
                                        'font-bold font-mono text-sm',
                                        alert.ai_prediction === 'true_positive'
                                          ? 'text-destructive'
                                          : 'text-primary'
                                      )}>
                                        {alert.ai_prediction.replace('_', ' ').toUpperCase()}
                                      </span>
                                    </div>
                                  </div>
                                  <div className="rounded-lg bg-background/60 p-3 border border-border/30">
                                    <p className="text-[10px] font-mono text-muted-foreground mb-2">CONFIDENCE</p>
                                    <div className="space-y-1.5">
                                      <span className="font-bold font-mono text-sm">
                                        {alert.ai_prediction_confidence.toFixed(1)}%
                                      </span>
                                      <Progress
                                        value={alert.ai_prediction_confidence}
                                        className="h-2"
                                      />
                                    </div>
                                  </div>
                                </div>

                                {/* Component Score Breakdown — 4-engine display */}
                                {alert.ai_prediction_details?.component_scores && (
                                  <div className="space-y-2">
                                    <p className="text-[10px] font-mono text-muted-foreground tracking-wider">ENGINE COMPONENT SCORES</p>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                      {Object.entries(alert.ai_prediction_details.component_scores)
                                        .filter(([key]) => key !== 'ensemble')
                                        .map(([key, val]) => (
                                        <div key={key} className="rounded-lg bg-background/40 p-2.5 border border-border/20">
                                          <p className="text-[9px] font-mono text-muted-foreground uppercase mb-1.5">
                                            {key.replace(/_/g, ' ')}
                                          </p>
                                          <p className="text-xs font-bold font-mono mb-1">{String(val)}%</p>
                                          <Progress value={Number(val)} className="h-1.5" />
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Forensics detail if keyword/pattern hits found */}
                                {alert.ai_prediction_details?.features?.keyword_hits > 0 && (
                                  <div className="rounded bg-destructive/5 border border-destructive/20 p-2.5">
                                    <p className="text-[9px] font-mono text-destructive">
                                      ⚠ DEFACEMENT SIGNATURES DETECTED: {alert.ai_prediction_details.features.keyword_hits} keyword match(es), {alert.ai_prediction_details.features.pattern_hits || 0} pattern match(es)
                                    </p>
                                  </div>
                                )}

                                <p className="text-[9px] font-mono text-muted-foreground">
                                  Model: {alert.ai_prediction_details?.model || 'Ensemble v2.0'}
                                </p>
                              </>
                            ) : (
                              <p className="text-xs text-muted-foreground font-mono">
                                Click "RUN PREDICTION" to analyze this alert with the AI engine.
                                The model runs a 4-component ensemble: Gradient Heuristic scoring,
                                Statistical Anomaly detection, Content Forensics (defacement keyword &amp;
                                pattern matching), and Magnitude Consistency analysis for high-confidence
                                True Positive / False Positive classification.
                              </p>
                            )}
                          </div>

                          {/* ── Manual Classification ── */}
                          <div className="rounded-lg border border-border/30 bg-muted/20 p-4 space-y-3">
                            <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground tracking-wider">
                              <Shield className="w-4 h-4" />
                              ADMIN CLASSIFICATION
                            </div>
                            <div className="flex items-center gap-3">
                              <Button
                                variant={alert.classification === 'true_positive' ? 'destructive' : 'outline'}
                                size="sm"
                                onClick={() => handleClassify(alert.id, 'true_positive')}
                                disabled={classifyAlert.isPending}
                                className="font-mono text-xs flex-1"
                              >
                                {classifyAlert.isPending ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <ShieldX className="w-3.5 h-3.5" />
                                )}
                                TRUE POSITIVE
                              </Button>
                              <Button
                                variant={alert.classification === 'false_positive' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => handleClassify(alert.id, 'false_positive')}
                                disabled={classifyAlert.isPending}
                                className="font-mono text-xs flex-1"
                              >
                                {classifyAlert.isPending ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <ShieldCheck className="w-3.5 h-3.5" />
                                )}
                                FALSE POSITIVE
                              </Button>
                            </div>
                            {alert.classified_at && (
                              <p className="text-[10px] font-mono text-muted-foreground">
                                Classified by {alert.classified_by_name} on{' '}
                                {new Date(alert.classified_at).toLocaleString()}
                              </p>
                            )}
                          </div>

                          {/* ── Investigation Notes ── */}
                          <div className="space-y-2">
                            <label className="text-xs font-mono text-muted-foreground tracking-wider flex items-center gap-2">
                              <FileText className="w-3.5 h-3.5" />
                              INVESTIGATION NOTES
                            </label>
                            <Textarea
                              value={resolutionNotes}
                              onChange={(e) => setResolutionNotes(e.target.value)}
                              placeholder="Document your investigation findings, root cause analysis, IOCs, and remediation steps..."
                              className="font-mono text-xs min-h-[100px] bg-background/50 border-border/50 resize-none"
                            />
                          </div>

                          {/* ── Action Buttons ── */}
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              {alert.website_url && (
                                <Button variant="outline" size="sm" asChild className="font-mono text-xs">
                                  <a href={alert.website_url} target="_blank" rel="noopener noreferrer">
                                    <ExternalLink className="w-3.5 h-3.5" />
                                    View Site
                                  </a>
                                </Button>
                              )}
                              {alert.classification === 'true_positive' && !alert.owner_notified && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleNotifyOwner(alert.id)}
                                  disabled={notifyOwner.isPending}
                                  className="font-mono text-xs border-warning/30 text-warning hover:bg-warning/10"
                                >
                                  {notifyOwner.isPending ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <Mail className="w-3.5 h-3.5" />
                                  )}
                                  Notify Website Owner
                                </Button>
                              )}
                              {alert.owner_notified && (
                                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-[10px] font-mono">
                                  <Mail className="w-3 h-3 mr-1" />
                                  OWNER NOTIFIED
                                </Badge>
                              )}
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDownloadSOC(alert.id)}
                                disabled={downloadingReport === alert.id}
                                className="font-mono text-xs"
                              >
                                {downloadingReport === alert.id ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Download className="w-3.5 h-3.5" />
                                )}
                                SOC Report PDF
                              </Button>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setInvestigatingId(null);
                                  setResolutionNotes('');
                                }}
                                className="font-mono text-xs"
                              >
                                Close
                              </Button>
                              <Button
                                variant="cyber"
                                size="sm"
                                onClick={() => {
                                  setInvestigatingId(null);
                                  setResolvingId(alert.id);
                                  setResolveStep('classify');
                                  setReportEmail('');
                                }}
                                className="font-mono text-xs"
                              >
                                <CheckCircle className="w-3.5 h-3.5" />
                                PROCEED TO RESOLVE
                              </Button>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Resolution Checking Phase */}
                  <AnimatePresence>
                    {resolvingId === alert.id && !isResolved && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="overflow-hidden"
                      >
                        <div className="mt-4 pt-4 border-t border-primary/30 space-y-5">
                          {/* Header */}
                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-2 text-xs font-mono text-primary tracking-wider">
                              <Shield className="w-4 h-4 animate-pulse" />
                              RESOLUTION CHECKING PHASE
                            </div>
                            <div className="flex-1 h-px bg-gradient-to-r from-primary/30 to-transparent" />
                          </div>

                          {/* Step Progress */}
                          <div className="flex items-center gap-2 px-1">
                            <div className={cn(
                              "flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold font-mono border-2 transition-colors",
                              resolveStep === 'classify'
                                ? "bg-primary text-primary-foreground border-primary"
                                : "bg-primary/20 text-primary border-primary/50"
                            )}>
                              1
                            </div>
                            <div className={cn(
                              "flex-1 h-0.5 rounded transition-colors",
                              resolveStep === 'tp_actions' ? "bg-primary" : "bg-border"
                            )} />
                            <div className={cn(
                              "flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold font-mono border-2 transition-colors",
                              resolveStep === 'tp_actions'
                                ? "bg-destructive text-destructive-foreground border-destructive"
                                : "bg-muted text-muted-foreground border-border"
                            )}>
                              2
                            </div>
                          </div>

                          {/* Step 1: Classification */}
                          {resolveStep === 'classify' && (
                            <motion.div
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="space-y-4"
                            >
                              <div>
                                <p className="text-sm font-semibold font-mono">STEP 1 — CLASSIFY THIS THREAT</p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  Determine whether this is a genuine threat or a false alarm before resolving.
                                </p>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* True Positive Card */}
                                <motion.button
                                  whileHover={{ scale: 1.02 }}
                                  whileTap={{ scale: 0.98 }}
                                  onClick={() => {
                                    setResolveStep('tp_actions');
                                  }}
                                  disabled={classifyAlert.isPending}
                                  className="rounded-lg border-2 border-destructive/30 bg-destructive/5 p-5 text-left hover:border-destructive/60 hover:bg-destructive/10 transition-all group cursor-pointer"
                                >
                                  <div className="flex items-center gap-3 mb-3">
                                    <div className="p-2 rounded-lg bg-destructive/10">
                                      <ShieldX className="w-6 h-6 text-destructive group-hover:scale-110 transition-transform" />
                                    </div>
                                    <p className="text-sm font-bold font-mono text-destructive">TRUE POSITIVE</p>
                                  </div>
                                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                                    This is a real threat. A SOC report will be generated and an email notification will be sent to the website owner.
                                  </p>
                                </motion.button>

                                {/* False Positive Card */}
                                <motion.button
                                  whileHover={{ scale: 1.02 }}
                                  whileTap={{ scale: 0.98 }}
                                  onClick={() => handleFalsePositiveResolve(alert.id)}
                                  disabled={classifyAlert.isPending || resolveAlert.isPending}
                                  className="rounded-lg border-2 border-primary/30 bg-primary/5 p-5 text-left hover:border-primary/60 hover:bg-primary/10 transition-all group cursor-pointer"
                                >
                                  <div className="flex items-center gap-3 mb-3">
                                    <div className="p-2 rounded-lg bg-primary/10">
                                      <ShieldCheck className="w-6 h-6 text-primary group-hover:scale-110 transition-transform" />
                                    </div>
                                    <p className="text-sm font-bold font-mono text-primary">FALSE POSITIVE</p>
                                  </div>
                                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                                    This is a false alarm. The alert will be classified as False Positive and resolved automatically.
                                  </p>
                                  {(classifyAlert.isPending || resolveAlert.isPending) && (
                                    <div className="mt-3 flex items-center gap-2 text-[10px] font-mono text-primary">
                                      <Loader2 className="w-3 h-3 animate-spin" />
                                      RESOLVING...
                                    </div>
                                  )}
                                </motion.button>
                              </div>

                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setResolvingId(null);
                                  setResolveStep('classify');
                                }}
                                className="font-mono text-xs"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                                Cancel
                              </Button>
                            </motion.div>
                          )}

                          {/* Step 2: True Positive Actions */}
                          {resolveStep === 'tp_actions' && (
                            <motion.div
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="space-y-4"
                            >
                              <div>
                                <p className="text-sm font-semibold font-mono text-destructive">
                                  STEP 2 — TRUE POSITIVE RESPONSE
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  Generate a SOC investigation report and send an email alert to the website owner.
                                </p>
                              </div>

                              {/* Threat Confirmed Banner */}
                              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
                                <div className="flex items-center gap-3">
                                  <div className="p-2 rounded-lg bg-destructive/20">
                                    <AlertTriangle className="w-5 h-5 text-destructive" />
                                  </div>
                                  <div>
                                    <p className="text-xs font-bold font-mono text-destructive">
                                      THREAT CONFIRMED — {alert.website_name}
                                    </p>
                                    <p className="text-[10px] text-muted-foreground mt-0.5">
                                      SOC report will be generated and email notification sent upon confirmation.
                                    </p>
                                  </div>
                                </div>
                              </div>

                              {/* Email Input */}
                              <div className="space-y-2">
                                <label className="text-xs font-mono text-muted-foreground tracking-wider flex items-center gap-2">
                                  <Mail className="w-3.5 h-3.5" />
                                  NOTIFICATION EMAIL
                                </label>
                                <Input
                                  type="email"
                                  value={reportEmail}
                                  onChange={(e) => setReportEmail(e.target.value)}
                                  placeholder="Enter email address for report delivery..."
                                  className="font-mono text-xs bg-background/50 border-border/50"
                                />
                                <p className="text-[10px] text-muted-foreground font-mono">
                                  The alert report will be sent to the website owner's registered email.
                                </p>
                              </div>

                              {/* Resolution Notes */}
                              <div className="space-y-2">
                                <label className="text-xs font-mono text-muted-foreground tracking-wider flex items-center gap-2">
                                  <FileText className="w-3.5 h-3.5" />
                                  RESOLUTION NOTES (OPTIONAL)
                                </label>
                                <Textarea
                                  value={resolutionNotes}
                                  onChange={(e) => setResolutionNotes(e.target.value)}
                                  placeholder="Document findings, root cause, IOCs, and remediation steps..."
                                  className="font-mono text-xs min-h-[80px] bg-background/50 border-border/50 resize-none"
                                />
                              </div>

                              {/* Action Buttons */}
                              <div className="flex items-center justify-between gap-2 pt-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setResolveStep('classify')}
                                  className="font-mono text-xs"
                                >
                                  Back
                                </Button>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => handleTruePositiveResolve(alert.id)}
                                  disabled={tpProcessing}
                                  className="font-mono text-xs gap-2"
                                >
                                  {tpProcessing ? (
                                    <>
                                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                      PROCESSING...
                                    </>
                                  ) : (
                                    <>
                                      <Send className="w-3.5 h-3.5" />
                                      GENERATE REPORT & RESOLVE
                                    </>
                                  )}
                                </Button>
                              </div>
                            </motion.div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        </AnimatePresence>
      </div>
    </MainLayout>
  );
}
