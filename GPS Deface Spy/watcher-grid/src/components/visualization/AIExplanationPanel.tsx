import { motion } from 'framer-motion';
import { Brain, AlertTriangle, CheckCircle, Info, TrendingUp, Zap, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';

interface AIExplanationPanelProps {
  confidence: number;
  severity: 'safe' | 'low' | 'medium' | 'high' | 'critical';
  changedBlocks: number;
  totalBlocks: number;
  textChanges: number;
  findings: string[];
  className?: string;
}

const severityConfig = {
  safe: {
    label: 'Safe',
    color: 'text-success',
    bgColor: 'bg-success/10',
    borderColor: 'border-success/30',
    icon: CheckCircle,
    description: 'No defacement detected',
  },
  low: {
    label: 'Low Risk',
    color: 'text-primary',
    bgColor: 'bg-primary/10',
    borderColor: 'border-primary/30',
    icon: Info,
    description: 'Minor changes detected, likely authorized',
  },
  medium: {
    label: 'Medium Risk',
    color: 'text-warning',
    bgColor: 'bg-warning/10',
    borderColor: 'border-warning/30',
    icon: AlertTriangle,
    description: 'Moderate changes require review',
  },
  high: {
    label: 'High Risk',
    color: 'text-orange-500',
    bgColor: 'bg-orange-500/10',
    borderColor: 'border-orange-500/30',
    icon: AlertTriangle,
    description: 'Significant unauthorized changes detected',
  },
  critical: {
    label: 'Critical',
    color: 'text-destructive',
    bgColor: 'bg-destructive/10',
    borderColor: 'border-destructive/30',
    icon: AlertTriangle,
    description: 'Major defacement confirmed',
  },
};

export function AIExplanationPanel({
  confidence,
  severity,
  changedBlocks,
  totalBlocks,
  textChanges,
  findings,
  className,
}: AIExplanationPanelProps) {
  const config = severityConfig[severity];
  const SeverityIcon = config.icon;
  const changePercentage = ((changedBlocks / totalBlocks) * 100).toFixed(1);

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
      className={cn('glass-card p-6 space-y-6', className)}
    >
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-3 rounded-xl bg-primary/10">
          <Brain className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">AI Analysis Results</h2>
          <p className="text-sm text-muted-foreground">Explainable detection insights</p>
        </div>
      </div>

      {/* Severity Badge */}
      <motion.div
        initial={{ scale: 0.9 }}
        animate={{ scale: 1 }}
        className={cn(
          'p-4 rounded-xl border-2',
          config.bgColor,
          config.borderColor
        )}
      >
        <div className="flex items-center gap-3">
          <SeverityIcon className={cn('w-8 h-8', config.color)} />
          <div>
            <p className={cn('text-xl font-bold', config.color)}>{config.label}</p>
            <p className="text-sm text-muted-foreground">{config.description}</p>
          </div>
        </div>
      </motion.div>

      {/* Confidence Score */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium">Detection Confidence</span>
          </div>
          <span className="text-2xl font-bold text-primary">{confidence}%</span>
        </div>
        <Progress value={confidence} className="h-2" />
        <p className="text-xs text-muted-foreground">
          AI model certainty based on frame and matrix analysis
        </p>
      </div>

      {/* Analysis Metrics */}
      <div className="grid grid-cols-2 gap-4">
        <div className="p-4 rounded-lg bg-secondary/50">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Visual Changes</span>
          </div>
          <p className="text-2xl font-bold">{changePercentage}%</p>
          <p className="text-xs text-muted-foreground">
            {changedBlocks} of {totalBlocks} blocks
          </p>
        </div>
        <div className="p-4 rounded-lg bg-secondary/50">
          <div className="flex items-center gap-2 mb-2">
            <FileText className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Text Changes</span>
          </div>
          <p className="text-2xl font-bold">{textChanges}</p>
          <p className="text-xs text-muted-foreground">
            NLP detected modifications
          </p>
        </div>
      </div>

      {/* Key Findings */}
      <div>
        <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
          <Info className="w-4 h-4 text-primary" />
          Key Findings
        </h3>
        <ul className="space-y-2">
          {findings.map((finding, index) => (
            <motion.li
              key={index}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 + index * 0.1 }}
              className="flex items-start gap-2 text-sm"
            >
              <div className={cn(
                'w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0',
                severity === 'safe' ? 'bg-success' : 'bg-destructive'
              )} />
              <span className="text-muted-foreground">{finding}</span>
            </motion.li>
          ))}
        </ul>
      </div>

      {/* AI Explanation */}
      <div className="p-4 rounded-lg bg-muted/30 border border-border">
        <p className="text-sm text-muted-foreground">
          <span className="text-primary font-medium">AI Explanation: </span>
          {severity === 'safe' 
            ? 'The visual fingerprint of this website matches the baseline snapshot. No unauthorized modifications detected in frame analysis or matrix comparison.'
            : `Changes detected in ${changePercentage}% of visual frames and ${changedBlocks} high-intensity matrix regions. ${textChanges > 0 ? `NLP analysis identified ${textChanges} text modifications.` : ''} This pattern suggests ${severity === 'critical' ? 'intentional website defacement' : 'potential unauthorized changes'}.`
          }
        </p>
      </div>
    </motion.div>
  );
}
