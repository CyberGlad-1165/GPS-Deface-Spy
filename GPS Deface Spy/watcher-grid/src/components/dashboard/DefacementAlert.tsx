import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, X, ExternalLink, Shield } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface DefacementAlertProps {
  websiteName: string;
  websiteUrl: string;
  severity: 'warning' | 'critical';
  confidence: number;
  description: string;
  onDismiss?: () => void;
  onViewDetails?: () => void;
}

export function DefacementAlert({
  websiteName,
  websiteUrl,
  severity,
  confidence,
  description,
  onDismiss,
  onViewDetails,
}: DefacementAlertProps) {
  const [visible, setVisible] = useState(true);

  const handleDismiss = () => {
    setVisible(false);
    setTimeout(() => onDismiss?.(), 300);
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ x: 400, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 400, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className={cn(
            "fixed top-20 right-6 z-50 w-96 rounded-lg border backdrop-blur-xl overflow-hidden",
            severity === 'critical'
              ? "bg-destructive/10 border-destructive/40"
              : "bg-warning/10 border-warning/40"
          )}
          style={{
            boxShadow: severity === 'critical'
              ? '0 0 30px hsl(0 84% 60% / 0.3), 0 0 60px hsl(0 84% 60% / 0.1)'
              : '0 0 30px hsl(32 95% 52% / 0.3)',
          }}
        >
          {/* Scan line */}
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-destructive to-transparent animate-shimmer" />

          <div className="p-4">
            {/* Header */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <motion.div
                  animate={{ rotate: [0, -10, 10, 0] }}
                  transition={{ repeat: Infinity, duration: 1.5 }}
                >
                  <AlertTriangle className={cn(
                    "w-5 h-5",
                    severity === 'critical' ? "text-destructive" : "text-warning"
                  )} />
                </motion.div>
                <div>
                  <p className={cn(
                    "text-xs font-mono tracking-wider",
                    severity === 'critical' ? "text-destructive" : "text-warning"
                  )}>
                    {severity === 'critical' ? '⚠ CRITICAL DEFACEMENT' : '⚠ SUSPICIOUS ACTIVITY'}
                  </p>
                  <p className="text-sm font-semibold mt-0.5">{websiteName}</p>
                </div>
              </div>
              <button onClick={handleDismiss} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content */}
            <p className="text-xs text-muted-foreground mb-3">{description}</p>

            {/* Stats */}
            <div className="flex items-center gap-4 mb-3">
              <div className="flex items-center gap-1">
                <Shield className="w-3 h-3 text-muted-foreground" />
                <span className="text-xs font-mono text-muted-foreground">
                  {confidence}% confidence
                </span>
              </div>
              <div className="flex items-center gap-1">
                <ExternalLink className="w-3 h-3 text-muted-foreground" />
                <span className="text-xs font-mono text-muted-foreground truncate max-w-[150px]">
                  {websiteUrl}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <Button
                variant={severity === 'critical' ? 'destructive' : 'warning'}
                size="sm"
                className="flex-1 text-xs"
                onClick={onViewDetails}
              >
                View Incident
              </Button>
              <Button variant="outline" size="sm" className="text-xs" onClick={handleDismiss}>
                Dismiss
              </Button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Demo component that triggers alerts periodically
export function DefacementAlertDemo() {
  const [showAlert, setShowAlert] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShowAlert(true), 3000);
    return () => clearTimeout(timer);
  }, []);

  if (!showAlert) return null;

  return (
    <DefacementAlert
      websiteName="E-Commerce Store"
      websiteUrl="https://ecommerce-store.io"
      severity="critical"
      confidence={98.5}
      description="Major visual changes detected. Homepage content replaced with unauthorized content. Immediate action required."
      onDismiss={() => setShowAlert(false)}
    />
  );
}
