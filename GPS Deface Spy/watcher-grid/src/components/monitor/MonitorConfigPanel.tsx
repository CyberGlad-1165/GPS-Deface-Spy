import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Bell, 
  Clock, 
  Sparkles, 
  Mail, 
  Check, 
  Brain, 
  AlertTriangle, 
  TrendingUp, 
  FileText, 
  Image, 
  Code, 
  Palette, 
  Layout, 
  Shield,
  Send,
  Loader2,
  CheckCircle,
  XCircle,
  Zap,
  Lock,
  CreditCard,
  Link2,
  FormInput,
  Database,
  Video,
  Globe,
  Search,
  Navigation,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { reportsAPI } from '@/services/api';

// ==================== DYNAMIC ALERT CONDITION TYPES ====================

interface AlertCondition {
  id: string;
  label: string;
  icon: LucideIcon;
  severity: 'critical' | 'high' | 'medium' | 'low';
}

// ==================== WEBSITE HTML ANALYZER ====================

function analyzeWebsiteHtml(html: string, url: string): AlertCondition[] {
  if (!html) return [];

  const conditions: AlertCondition[] = [];
  const lowerHtml = html.toLowerCase();
  const hostname = (() => { try { return new URL(url).hostname; } catch { return url; } })();

  // --- Detect forms ---
  const formCount = (lowerHtml.match(/<form[\s>]/g) || []).length;
  const hasLoginForm = /type\s*=\s*["']password["']/i.test(html) || /login|sign.?in|log.?in/i.test(html);
  const hasSearchForm = /type\s*=\s*["']search["']/i.test(html) || /search/i.test(html);

  if (hasLoginForm) {
    conditions.push({
      id: 'login-form',
      label: `Login/auth form detected on ${hostname} — monitor for phishing modifications`,
      icon: Lock,
      severity: 'critical',
    });
  }

  if (formCount > 0 && !hasLoginForm) {
    conditions.push({
      id: 'form-tamper',
      label: `${formCount} form(s) found — watch for action URL or input field tampering`,
      icon: FormInput,
      severity: 'high',
    });
  }

  // --- Detect scripts ---
  const scriptTags = html.match(/<script[^>]*>/gi) || [];
  const externalScripts = scriptTags.filter(s => /src\s*=/i.test(s));
  const inlineScripts = scriptTags.length - externalScripts.length;

  if (externalScripts.length > 0) {
    conditions.push({
      id: 'ext-scripts',
      label: `${externalScripts.length} external script(s) loaded — alert on new script injection or source change`,
      icon: Code,
      severity: 'critical',
    });
  }

  if (inlineScripts > 0) {
    conditions.push({
      id: 'inline-scripts',
      label: `${inlineScripts} inline script block(s) — monitor for malicious code injection`,
      icon: Code,
      severity: 'high',
    });
  }

  // --- Detect iframes ---
  const iframeCount = (lowerHtml.match(/<iframe[\s>]/g) || []).length;
  if (iframeCount > 0) {
    conditions.push({
      id: 'iframe-inject',
      label: `${iframeCount} iframe(s) embedded — watch for hidden iframe injection or redirect`,
      icon: Layout,
      severity: 'critical',
    });
  }

  // --- Detect images / logos ---
  const imgTags = html.match(/<img[^>]*>/gi) || [];
  const logoImages = imgTags.filter(i => /logo|brand|icon|favicon/i.test(i));
  const totalImages = imgTags.length;

  if (logoImages.length > 0) {
    conditions.push({
      id: 'logo-brand',
      label: `${logoImages.length} logo/brand image(s) found — alert if branding elements are replaced`,
      icon: Shield,
      severity: 'critical',
    });
  }

  if (totalImages > logoImages.length) {
    conditions.push({
      id: 'image-change',
      label: `${totalImages - logoImages.length} content image(s) — monitor for visual defacement or swap`,
      icon: Image,
      severity: 'high',
    });
  }

  // --- Detect navigation / header / footer ---
  const hasNav = /<nav[\s>]/i.test(html);
  const hasHeader = /<header[\s>]/i.test(html);
  const hasFooter = /<footer[\s>]/i.test(html);

  if (hasNav || hasHeader) {
    conditions.push({
      id: 'nav-structure',
      label: `Navigation/header structure detected — alert on menu or link modifications`,
      icon: Navigation,
      severity: 'high',
    });
  }

  if (hasFooter) {
    conditions.push({
      id: 'footer-change',
      label: `Footer section found — monitor for unauthorized link additions or copyright changes`,
      icon: Layout,
      severity: 'medium',
    });
  }

  // --- Detect external links ---
  const allLinks = html.match(/href\s*=\s*["']https?:\/\/[^"']+["']/gi) || [];
  const externalLinks = allLinks.filter(l => {
    const match = l.match(/href\s*=\s*["'](https?:\/\/[^"']+)["']/i);
    if (!match) return false;
    try { return new URL(match[1]).hostname !== hostname; } catch { return false; }
  });

  if (externalLinks.length > 0) {
    conditions.push({
      id: 'ext-links',
      label: `${externalLinks.length} external link(s) — alert if new outbound links are injected`,
      icon: Link2,
      severity: 'medium',
    });
  }

  // --- Detect meta tags / SEO ---
  const hasMetaDesc = /meta[^>]*name\s*=\s*["']description["']/i.test(html);
  const hasOgTags = /property\s*=\s*["']og:/i.test(html);

  if (hasMetaDesc || hasOgTags) {
    conditions.push({
      id: 'meta-seo',
      label: `SEO/Open Graph meta tags present — monitor for SEO spam injection`,
      icon: Search,
      severity: 'medium',
    });
  }

  // --- Detect CSS / stylesheets ---
  const stylesheetLinks = (html.match(/<link[^>]*rel\s*=\s*["']stylesheet["'][^>]*>/gi) || []).length;

  if (stylesheetLinks > 0) {
    conditions.push({
      id: 'css-change',
      label: `${stylesheetLinks} stylesheet(s) linked — alert on visual theme or color palette changes`,
      icon: Palette,
      severity: 'medium',
    });
  }

  // --- Detect payment / sensitive data ---
  const hasPayment = /payment|checkout|credit.?card|billing|stripe|paypal|razorpay/i.test(html);
  if (hasPayment) {
    conditions.push({
      id: 'payment-page',
      label: `Payment/checkout elements detected — critical monitoring for financial data safety`,
      icon: CreditCard,
      severity: 'critical',
    });
  }

  // --- Detect video / media embeds ---
  const hasVideo = /<video[\s>]/i.test(html) || /youtube|vimeo|embed/i.test(html);
  if (hasVideo) {
    conditions.push({
      id: 'media-embed',
      label: `Video/media embeds found — watch for embed source hijacking`,
      icon: Video,
      severity: 'medium',
    });
  }

  // --- Detect data attributes / API endpoints ---
  const hasApiRefs = /api\/|\/graphql|data-endpoint|fetch\(|axios\.|XMLHttpRequest/i.test(html);
  if (hasApiRefs) {
    conditions.push({
      id: 'api-endpoint',
      label: `API endpoint references found — monitor for backend URL tampering`,
      icon: Database,
      severity: 'high',
    });
  }

  // --- Always add visual change threshold (universal) ---
  conditions.push({
    id: 'visual-change',
    label: `Visual change exceeds 15% of ${hostname} monitored area`,
    icon: Image,
    severity: 'high',
  });

  // --- Always add text content change (universal) ---
  conditions.push({
    id: 'text-change',
    label: `Text content on ${hostname} is modified or removed`,
    icon: FileText,
    severity: 'high',
  });

  return conditions;
}

// Fallback generic conditions when no HTML is available
const FALLBACK_ALERT_CONDITIONS: AlertCondition[] = [
  { id: 'visual-change', label: 'Visual change exceeds 15% of monitored area', icon: Image, severity: 'high' },
  { id: 'text-change', label: 'Text content is modified or removed', icon: FileText, severity: 'high' },
  { id: 'logo-swap', label: 'Logo or branding elements are replaced', icon: Shield, severity: 'critical' },
  { id: 'new-script', label: 'Unknown scripts or iframes are injected', icon: Code, severity: 'critical' },
  { id: 'layout-shift', label: 'Major layout structure changes detected', icon: Layout, severity: 'medium' },
  { id: 'color-shift', label: 'Color palette significantly altered', icon: Palette, severity: 'medium' },
];

const INTERVAL_OPTIONS = [
  { value: 0, label: 'Manual Only', description: 'Scan manually when needed' },
  { value: 30, label: '30 Seconds', description: 'High frequency monitoring' },
  { value: 60, label: '1 Minute', description: 'Real-time monitoring' },
  { value: 300, label: '5 Minutes', description: 'Active monitoring' },
  { value: 600, label: '10 Minutes', description: 'Standard monitoring' },
  { value: 1800, label: '30 Minutes', description: 'Periodic checks' },
  { value: 3600, label: '1 Hour', description: 'Light monitoring' },
];

// ==================== TYPES ====================

interface ChangeData {
  changedBlocks: number;
  totalBlocks: number;
  changePercent: number;
  htmlSize: number;
  scanCount: number;
}

interface AIDetection {
  id: string;
  type: string;
  message: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  confidence: number;
  timestamp: Date;
}

interface MonitorConfigPanelProps {
  monitoredUrl: string;
  onIntervalChange: (seconds: number) => void;
  changeData?: ChangeData;
  websiteId?: number | null;
  liveHtml?: string;
}

// ==================== AI DETECTION LOGIC ====================

function generateAIDetections(changeData?: ChangeData): AIDetection[] {
  if (!changeData) return [];
  
  const detections: AIDetection[] = [];
  const { changedBlocks, totalBlocks, changePercent, htmlSize } = changeData;
  
  // Visual change detection
  if (changePercent > 15) {
    detections.push({
      id: 'vis-1',
      type: 'Visual Change',
      message: `${changePercent.toFixed(1)}% of the page has changed - exceeds 15% threshold`,
      severity: changePercent > 50 ? 'critical' : changePercent > 30 ? 'high' : 'medium',
      confidence: Math.min(98, 70 + changePercent),
      timestamp: new Date(),
    });
  }
  
  // Block-level analysis
  if (changedBlocks > 0) {
    const blockPercent = (changedBlocks / totalBlocks) * 100;
    if (blockPercent > 10) {
      detections.push({
        id: 'blk-1',
        type: 'Layout Modification',
        message: `${changedBlocks} of ${totalBlocks} content blocks modified`,
        severity: blockPercent > 40 ? 'high' : 'medium',
        confidence: Math.min(95, 60 + blockPercent),
        timestamp: new Date(),
      });
    }
  }
  
  // HTML size change (simulate)
  if (htmlSize > 0) {
    const sizeKB = htmlSize / 1024;
    if (sizeKB > 100) {
      detections.push({
        id: 'html-1',
        type: 'Content Size',
        message: `HTML content is ${sizeKB.toFixed(1)} KB - monitoring for script injection`,
        severity: 'low',
        confidence: 65,
        timestamp: new Date(),
      });
    }
  }
  
  return detections;
}

// ==================== COMPONENT ====================

export default function MonitorConfigPanel({ 
  monitoredUrl, 
  onIntervalChange, 
  changeData,
  websiteId,
  liveHtml,
}: MonitorConfigPanelProps) {
  const { toast } = useToast();

  // Generate dynamic alert conditions based on actual website HTML
  const dynamicConditions = useMemo(() => {
    if (liveHtml && monitoredUrl) {
      return analyzeWebsiteHtml(liveHtml, monitoredUrl);
    }
    return FALLBACK_ALERT_CONDITIONS;
  }, [liveHtml, monitoredUrl]);

  // Auto-select critical and high severity conditions
  const defaultSelected = useMemo(() => {
    return dynamicConditions
      .filter(c => c.severity === 'critical' || c.severity === 'high')
      .map(c => c.id);
  }, [dynamicConditions]);

  const [selectedAlerts, setSelectedAlerts] = useState<string[]>([]);
  const [selectedInterval, setSelectedInterval] = useState(0);
  const [alertEmail, setAlertEmail] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [aiDetections, setAiDetections] = useState<AIDetection[]>([]);
  const [autoSendEnabled, setAutoSendEnabled] = useState(false);

  // Reset selected alerts when dynamic conditions change
  useEffect(() => {
    setSelectedAlerts(defaultSelected);
  }, [defaultSelected]);

  // Generate AI detections when change data updates
  useEffect(() => {
    const detections = generateAIDetections(changeData);
    setAiDetections(detections);
    
    // Auto-send email if enabled and critical detections found
    if (autoSendEnabled && alertEmail && detections.some(d => d.severity === 'critical')) {
      handleSendReport();
    }
  }, [changeData]);

  const toggleAlert = (id: string) => {
    setSelectedAlerts(prev =>
      prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]
    );
  };

  const handleIntervalChange = (value: number) => {
    setSelectedInterval(value);
    onIntervalChange(value);
    if (value > 0) {
      const option = INTERVAL_OPTIONS.find(o => o.value === value);
      toast({ 
        title: 'Scanning Interval Set', 
        description: `Auto-scanning every ${option?.label}` 
      });
    }
  };

  const handleSendReport = async () => {
    if (!alertEmail.trim()) {
      toast({ title: 'Email Required', description: 'Enter an email address to receive reports.', variant: 'destructive' });
      return;
    }
    
    if (!alertEmail.includes('@')) {
      toast({ title: 'Invalid Email', description: 'Please enter a valid email address.', variant: 'destructive' });
      return;
    }

    setIsSending(true);
    
    try {
      await reportsAPI.sendEmail(alertEmail, websiteId);
      
      setEmailSent(true);
      setIsSending(false);
      
      toast({ 
        title: 'Report Sent', 
        description: `Monitoring report sent to ${alertEmail}` 
      });
      
      setTimeout(() => setEmailSent(false), 5000);
    } catch (err: any) {
      setIsSending(false);
      toast({ title: 'Send Failed', description: err.message || 'Failed to send report', variant: 'destructive' });
    }
  };

  const handleSaveConfig = () => {
    if (!alertEmail.trim()) {
      toast({ title: 'Email Required', description: 'Enter an email to receive alerts.', variant: 'destructive' });
      return;
    }
    if (selectedAlerts.length === 0) {
      toast({ title: 'Select Alerts', description: 'Choose at least one alert condition.', variant: 'destructive' });
      return;
    }
    
    setAutoSendEnabled(true);
    toast({
      title: 'Auto-Alert Enabled',
      description: `Reports will be sent to ${alertEmail} when conditions are triggered.`,
    });
  };

  const overallRiskScore = aiDetections.length > 0 
    ? Math.min(100, aiDetections.reduce((acc, d) => acc + d.confidence, 0) / aiDetections.length)
    : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="space-y-4"
    >
      {/* ==================== AI SUGGESTIONS PANEL ==================== */}
      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <Brain className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-mono font-bold tracking-wider">AI MONITORING INSIGHTS</h3>
              <p className="text-[10px] text-muted-foreground">Real-time change detection analysis</p>
            </div>
          </div>
          {aiDetections.length > 0 && (
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary animate-pulse" />
              <span className="text-xs font-mono text-primary">{aiDetections.length} DETECTIONS</span>
            </div>
          )}
        </div>

        {/* AI Risk Score */}
        {changeData && changeData.scanCount > 0 && (
          <div className="mb-4 p-4 rounded-lg bg-secondary/50 border border-border/50">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-mono text-muted-foreground">AI Risk Assessment</span>
              <span className={cn(
                "text-lg font-bold font-mono",
                overallRiskScore < 30 ? "text-success" : overallRiskScore < 60 ? "text-warning" : "text-destructive"
              )}>
                {overallRiskScore.toFixed(0)}%
              </span>
            </div>
            <Progress 
              value={overallRiskScore} 
              className={cn(
                "h-2",
                overallRiskScore < 30 && "[&>div]:bg-success",
                overallRiskScore >= 30 && overallRiskScore < 60 && "[&>div]:bg-warning",
                overallRiskScore >= 60 && "[&>div]:bg-destructive"
              )} 
            />
          </div>
        )}

        {/* AI Detections List */}
        <AnimatePresence mode="popLayout">
          {aiDetections.length > 0 ? (
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {aiDetections.map((detection, i) => (
                <motion.div
                  key={detection.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  transition={{ delay: i * 0.05 }}
                  className={cn(
                    "p-3 rounded-lg border-l-4 bg-secondary/50",
                    detection.severity === 'critical' && 'border-l-destructive',
                    detection.severity === 'high' && 'border-l-orange-500',
                    detection.severity === 'medium' && 'border-l-warning',
                    detection.severity === 'low' && 'border-l-primary',
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-bold">{detection.type}</span>
                        <span className={cn(
                          "text-[9px] font-mono px-1.5 py-0.5 rounded uppercase",
                          detection.severity === 'critical' && 'bg-destructive/10 text-destructive',
                          detection.severity === 'high' && 'bg-orange-500/10 text-orange-500',
                          detection.severity === 'medium' && 'bg-warning/10 text-warning',
                          detection.severity === 'low' && 'bg-primary/10 text-primary',
                        )}>
                          {detection.severity}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">{detection.message}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="flex items-center gap-1">
                        <Zap className="w-3 h-3 text-primary" />
                        <span className="text-xs font-mono text-primary">{detection.confidence}%</span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center">
              <CheckCircle className="w-10 h-10 text-success/30 mx-auto mb-3" />
              <p className="text-xs font-mono text-muted-foreground">No anomalies detected</p>
              <p className="text-[10px] text-muted-foreground/60 mt-1">Website appears stable</p>
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* ==================== ALERT CONDITIONS ==================== */}
      <div className="glass-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Bell className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-mono font-bold tracking-wider text-primary">ALERT ME WHEN</h3>
          <div className="flex items-center gap-1.5 ml-auto">
            <Sparkles className="w-3.5 h-3.5 text-primary/70" />
            <span className="text-[10px] font-mono text-primary/70">
              {liveHtml ? 'SITE-SPECIFIC' : 'AI SUGGESTED'}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {dynamicConditions.map((condition) => {
            const isSelected = selectedAlerts.includes(condition.id);
            const Icon = condition.icon;
            return (
              <button
                key={condition.id}
                onClick={() => toggleAlert(condition.id)}
                className={cn(
                  "flex items-start gap-3 p-3 rounded-lg border text-left transition-all text-xs font-mono",
                  isSelected
                    ? "bg-primary/10 border-primary/30 text-foreground"
                    : "bg-secondary/30 border-border/50 text-muted-foreground hover:border-primary/20"
                )}
              >
                <div className={cn(
                  "w-5 h-5 rounded border flex-shrink-0 flex items-center justify-center transition-colors",
                  isSelected ? "bg-primary border-primary" : "border-muted-foreground/30"
                )}>
                  {isSelected ? <Check className="w-3 h-3 text-primary-foreground" /> : <Icon className="w-3 h-3" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="leading-relaxed">{condition.label}</p>
                  <span className={cn(
                    "text-[9px] font-bold tracking-wider mt-1 inline-block",
                    condition.severity === 'critical' && "text-destructive",
                    condition.severity === 'high' && "text-orange-500",
                    condition.severity === 'medium' && "text-warning",
                  )}>
                    {condition.severity.toUpperCase()}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ==================== SCANNING INTERVAL ==================== */}
      <div className="glass-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-mono font-bold tracking-wider text-primary">SCANNING INTERVAL</h3>
          {selectedInterval > 0 && (
            <div className="ml-auto flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
              </span>
              <span className="text-[10px] font-mono text-success">ACTIVE</span>
            </div>
          )}
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
          {INTERVAL_OPTIONS.slice(0, 4).map((option) => (
            <button
              key={option.value}
              onClick={() => handleIntervalChange(option.value)}
              className={cn(
                "p-3 rounded-lg border text-center transition-all",
                selectedInterval === option.value
                  ? "bg-primary/15 border-primary/40 text-primary"
                  : "bg-secondary/30 border-border/50 text-muted-foreground hover:border-primary/20 hover:text-foreground"
              )}
            >
              <p className="text-sm font-bold font-mono">{option.label}</p>
              <p className="text-[9px] text-muted-foreground mt-0.5">{option.description}</p>
            </button>
          ))}
        </div>
        
        <div className="grid grid-cols-3 gap-2">
          {INTERVAL_OPTIONS.slice(4).map((option) => (
            <button
              key={option.value}
              onClick={() => handleIntervalChange(option.value)}
              className={cn(
                "p-3 rounded-lg border text-center transition-all",
                selectedInterval === option.value
                  ? "bg-primary/15 border-primary/40 text-primary"
                  : "bg-secondary/30 border-border/50 text-muted-foreground hover:border-primary/20 hover:text-foreground"
              )}
            >
              <p className="text-sm font-bold font-mono">{option.label}</p>
              <p className="text-[9px] text-muted-foreground mt-0.5">{option.description}</p>
            </button>
          ))}
        </div>

        <p className="text-[10px] font-mono text-muted-foreground mt-3 flex items-center gap-2">
          <TrendingUp className="w-3 h-3" />
          Automatic rescans will update the matrix and trigger alerts when conditions are met
        </p>
      </div>

      {/* ==================== SEND REPORTS TO ==================== */}
      <div className="glass-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Mail className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-mono font-bold tracking-wider text-primary">SEND REPORTS TO</h3>
          {autoSendEnabled && (
            <div className="ml-auto flex items-center gap-1.5">
              <CheckCircle className="w-3.5 h-3.5 text-success" />
              <span className="text-[10px] font-mono text-success">AUTO-SEND ENABLED</span>
            </div>
          )}
        </div>
        
        <div className="flex gap-3 mb-3">
          <div className="relative flex-1">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="email"
              placeholder="your@email.com"
              value={alertEmail}
              onChange={(e) => setAlertEmail(e.target.value)}
              className="pl-10 bg-secondary/50 font-mono text-sm h-11"
            />
          </div>
          <Button 
            variant="cyber-outline" 
            onClick={handleSendReport} 
            disabled={isSending || !alertEmail.trim()}
            className="font-mono text-xs h-11 min-w-[120px]"
          >
            {isSending ? (
              <><Loader2 className="w-4 h-4 animate-spin" />Sending...</>
            ) : emailSent ? (
              <><CheckCircle className="w-4 h-4 text-success" />Sent!</>
            ) : (
              <><Send className="w-4 h-4" />Send Now</>
            )}
          </Button>
        </div>

        <div className="flex items-center justify-between gap-4">
          <p className="text-[10px] font-mono text-muted-foreground">
            Reports include screenshots, matrix analysis, and AI insights
          </p>
          <Button 
            variant={autoSendEnabled ? "outline" : "cyber"} 
            size="sm"
            onClick={handleSaveConfig}
            className="font-mono text-[10px] h-8"
          >
            {autoSendEnabled ? (
              <><XCircle className="w-3 h-3" />Disable Auto</>
            ) : (
              <><Sparkles className="w-3 h-3" />Enable Auto-Send</>
            )}
          </Button>
        </div>

        {autoSendEnabled && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mt-3 p-3 rounded-lg bg-success/10 border border-success/20"
          >
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-success" />
              <p className="text-xs text-success">
                Auto-send enabled: Reports will be emailed to <strong>{alertEmail}</strong> when critical alerts trigger
              </p>
            </div>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
