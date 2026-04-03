import { motion } from 'framer-motion';
import { ExternalLink, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Website } from '@/data/mockData';
import { Link } from 'react-router-dom';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import { getProxyUrl } from '@/services/api';

interface MonitorCardProps {
  website: Website;
  delay?: number;
}

// Generate mock sparkline data
const generateSparkline = (status: string) => {
  const base = status === 'defaced' ? 60 : status === 'warning' ? 30 : 5;
  return Array.from({ length: 12 }, (_, i) => ({
    v: base + Math.random() * (status === 'safe' ? 10 : 40) - (status === 'safe' ? 5 : 20),
  }));
};

const statusConfig = {
  safe: {
    label: 'SECURE',
    dotClass: 'bg-primary',
    borderClass: 'border-primary/20 hover:border-primary/50',
    glowClass: 'hover:shadow-[0_0_15px_hsl(var(--primary)/0.2)]',
    lineColor: 'hsl(160, 84%, 39%)',
  },
  warning: {
    label: 'SUSPICIOUS',
    dotClass: 'bg-warning',
    borderClass: 'border-warning/20 hover:border-warning/50',
    glowClass: 'hover:shadow-[0_0_15px_hsl(var(--warning)/0.2)]',
    lineColor: 'hsl(32, 95%, 52%)',
  },
  defaced: {
    label: 'CRITICAL',
    dotClass: 'bg-destructive',
    borderClass: 'border-destructive/30 hover:border-destructive/60',
    glowClass: 'hover:shadow-[0_0_20px_hsl(var(--destructive)/0.3)]',
    lineColor: 'hsl(0, 84%, 60%)',
  },
  monitoring: {
    label: 'SCANNING',
    dotClass: 'bg-[hsl(185,80%,50%)]',
    borderClass: 'border-[hsl(185,80%,50%)]/20 hover:border-[hsl(185,80%,50%)]/50',
    glowClass: 'hover:shadow-[0_0_15px_hsl(185,80%,50%,0.2)]',
    lineColor: 'hsl(185, 80%, 50%)',
  },
};

export function MonitorCard({ website, delay = 0 }: MonitorCardProps) {
  const config = statusConfig[website.status];
  const sparkData = generateSparkline(website.status);

  return (
    <Link to={`/website/${website.id}`}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay }}
        whileHover={{ y: -4, transition: { duration: 0.2 } }}
        className={cn(
          'glass-card p-4 transition-all duration-300 cursor-pointer group',
          config.borderClass,
          config.glowClass
        )}
      >
        {/* Header: Status + Name */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2 min-w-0">
            {/* Pulsing status dot */}
            <div className="relative flex-shrink-0">
              <span className={cn(
                "block w-2.5 h-2.5 rounded-full",
                config.dotClass,
                website.status === 'defaced' && 'animate-pulse'
              )} />
              {(website.status === 'defaced' || website.status === 'warning') && (
                <span className={cn(
                  "absolute inset-0 rounded-full animate-ping",
                  config.dotClass,
                  'opacity-40'
                )} />
              )}
            </div>
            <h3 className="font-semibold text-sm truncate group-hover:text-primary transition-colors">
              {website.name}
            </h3>
          </div>
          <span className={cn(
            "text-[10px] font-mono tracking-wider px-2 py-0.5 rounded border",
            website.status === 'safe' && 'text-primary border-primary/30 bg-primary/5',
            website.status === 'warning' && 'text-warning border-warning/30 bg-warning/5',
            website.status === 'defaced' && 'text-destructive border-destructive/30 bg-destructive/5',
            website.status === 'monitoring' && 'text-[hsl(185,80%,50%)] border-[hsl(185,80%,50%)]/30 bg-[hsl(185,80%,50%)]/5',
          )}>
            {config.label}
          </span>
        </div>

        {/* Live Preview via proxy iframe */}
        <div className="relative aspect-[16/10] rounded-md bg-secondary/80 border border-border overflow-hidden mb-3">
          <iframe
            src={getProxyUrl(website.url)}
            title={`Live preview of ${website.name}`}
            className="absolute inset-0 w-full h-full pointer-events-none"
            style={{ transform: 'scale(0.5)', transformOrigin: 'top left', width: '200%', height: '200%' }}
            loading="lazy"
          />
          <div className="absolute bottom-1 left-1 bg-background/80 backdrop-blur-sm rounded px-1.5 py-0.5">
            <span className="text-[8px] font-mono text-primary tracking-wider">LIVE</span>
          </div>
          {/* Scan line for defaced */}
          {website.status === 'defaced' && (
            <div className="absolute inset-x-0 h-px bg-gradient-to-r from-transparent via-destructive/60 to-transparent animate-scan-line" />
          )}
        </div>

        {/* Sparkline */}
        <div className="h-8 mb-3">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={sparkData}>
              <Line
                type="monotone"
                dataKey="v"
                stroke={config.lineColor}
                strokeWidth={1.5}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 text-muted-foreground">
            <Clock className="w-3 h-3" />
            <span className="text-[10px] font-mono">
              {new Date(website.lastChecked).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
          <div className="flex items-center gap-1 text-muted-foreground">
            <span className="text-[10px] font-mono">{website.framesAnalyzed.toLocaleString()} frames</span>
            <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </div>
      </motion.div>
    </Link>
  );
}
