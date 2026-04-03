import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  trend?: string;
  trendDirection?: 'up' | 'down' | 'neutral';
  color?: 'primary' | 'success' | 'warning' | 'destructive';
  delay?: number;
  className?: string;
}

const colorStyles = {
  primary: {
    bg: 'bg-primary/10',
    text: 'text-primary',
    glow: 'group-hover:shadow-[0_0_15px_hsl(var(--primary)/0.3)]',
  },
  success: {
    bg: 'bg-success/10',
    text: 'text-success',
    glow: 'group-hover:shadow-[0_0_15px_hsl(var(--success)/0.3)]',
  },
  warning: {
    bg: 'bg-warning/10',
    text: 'text-warning',
    glow: 'group-hover:shadow-[0_0_15px_hsl(var(--warning)/0.3)]',
  },
  destructive: {
    bg: 'bg-destructive/10',
    text: 'text-destructive',
    glow: 'group-hover:shadow-[0_0_15px_hsl(var(--destructive)/0.3)]',
  },
};

export function StatCard({
  icon: Icon,
  label,
  value,
  trend,
  trendDirection = 'up',
  color = 'primary',
  delay = 0,
  className,
}: StatCardProps) {
  const styles = colorStyles[color];

  const TrendIcon = trendDirection === 'up' 
    ? TrendingUp 
    : trendDirection === 'down' 
      ? TrendingDown 
      : Minus;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      whileHover={{ y: -4 }}
      className={cn(
        'glass-card p-6 group transition-all duration-300 hover:border-primary/30',
        styles.glow,
        className
      )}
    >
      <div className="flex items-start justify-between">
        <motion.div
          whileHover={{ rotate: [0, -10, 10, 0] }}
          transition={{ duration: 0.5 }}
          className={cn('p-3 rounded-xl transition-colors', styles.bg)}
        >
          <Icon className={cn('w-6 h-6', styles.text)} />
        </motion.div>
        {trend && (
          <div className={cn(
            'flex items-center gap-1 text-xs',
            trendDirection === 'up' && 'text-success',
            trendDirection === 'down' && 'text-destructive',
            trendDirection === 'neutral' && 'text-muted-foreground'
          )}>
            <TrendIcon className="w-3 h-3" />
            <span>{trend}</span>
          </div>
        )}
      </div>
      <div className="mt-4">
        <motion.p
          initial={{ scale: 0.5 }}
          animate={{ scale: 1 }}
          transition={{ delay: delay + 0.2, type: 'spring' }}
          className="text-3xl font-bold"
        >
          {value}
        </motion.p>
        <p className="text-sm text-muted-foreground mt-1">{label}</p>
      </div>
    </motion.div>
  );
}
