import { useState, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { GripVertical, Eye, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ComparisonSliderProps {
  baselineUrl?: string;
  currentUrl?: string;
  baselineDate?: string;
  currentDate?: string;
  websiteName?: string;
  hasChanges?: boolean;
  className?: string;
}

export function ComparisonSlider({
  baselineUrl,
  currentUrl,
  baselineDate = 'Jan 1, 2024',
  currentDate = 'Now',
  websiteName = 'Website',
  hasChanges = true,
  className,
}: ComparisonSliderProps) {
  const [sliderPosition, setSliderPosition] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMove = useCallback(
    (clientX: number) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
      const percentage = (x / rect.width) * 100;
      setSliderPosition(Math.max(5, Math.min(95, percentage)));
    },
    []
  );

  const handleMouseDown = () => setIsDragging(true);
  const handleMouseUp = () => setIsDragging(false);
  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) handleMove(e.clientX);
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    if (isDragging) handleMove(e.touches[0].clientX);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className={cn('glass-card p-6', className)}
    >
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Visual Comparison</h2>
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-success" />
            <span className="text-muted-foreground">Baseline</span>
          </div>
          <div className="flex items-center gap-2">
            <div className={cn(
              "w-3 h-3 rounded-full",
              hasChanges ? "bg-destructive animate-pulse" : "bg-success"
            )} />
            <span className="text-muted-foreground">Current</span>
          </div>
        </div>
      </div>

      <div
        ref={containerRef}
        className="relative aspect-video rounded-xl overflow-hidden cursor-ew-resize select-none bg-muted/30 border border-border"
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onMouseMove={handleMouseMove}
        onTouchStart={handleMouseDown}
        onTouchEnd={handleMouseUp}
        onTouchMove={handleTouchMove}
      >
        {/* Baseline (Left) */}
        <div className="absolute inset-0">
          <div className="absolute inset-0 cyber-grid opacity-20" />
          {baselineUrl ? (
            <img
              src={baselineUrl}
              alt="Baseline"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <div className="text-center">
                <Eye className="w-16 h-16 text-success/30 mx-auto mb-3" />
                <p className="text-sm font-medium text-foreground/70">Baseline Snapshot</p>
                <p className="text-xs text-muted-foreground mt-1">{baselineDate}</p>
              </div>
            </div>
          )}
          {/* Baseline label */}
          <div className="absolute top-4 left-4 px-3 py-1.5 rounded-lg bg-success/20 border border-success/30 backdrop-blur-sm">
            <span className="text-xs font-medium text-success">BASELINE</span>
          </div>
        </div>

        {/* Current (Right) - Clipped */}
        <div
          className="absolute inset-0"
          style={{ clipPath: `inset(0 0 0 ${sliderPosition}%)` }}
        >
          <div className="absolute inset-0 cyber-grid opacity-20" />
          {currentUrl ? (
            <img
              src={currentUrl}
              alt="Current"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-muted/50">
              <div className="text-center">
                {hasChanges ? (
                  <>
                    <AlertTriangle className="w-16 h-16 text-destructive/50 mx-auto mb-3 animate-pulse" />
                    <p className="text-sm font-medium text-destructive">Changes Detected</p>
                  </>
                ) : (
                  <>
                    <Eye className="w-16 h-16 text-primary/30 mx-auto mb-3" />
                    <p className="text-sm font-medium text-foreground/70">Current State</p>
                  </>
                )}
                <p className="text-xs text-muted-foreground mt-1">{currentDate}</p>
              </div>
            </div>
          )}
          {/* Current label */}
          <div className={cn(
            "absolute top-4 right-4 px-3 py-1.5 rounded-lg backdrop-blur-sm border",
            hasChanges 
              ? "bg-destructive/20 border-destructive/30" 
              : "bg-primary/20 border-primary/30"
          )}>
            <span className={cn(
              "text-xs font-medium",
              hasChanges ? "text-destructive" : "text-primary"
            )}>CURRENT</span>
          </div>
          
          {/* Scan line effect for current */}
          {hasChanges && (
            <div className="absolute inset-x-0 h-1 bg-gradient-to-b from-transparent via-destructive/50 to-transparent animate-scan-line" />
          )}
        </div>

        {/* Slider Handle */}
        <motion.div
          className="absolute top-0 bottom-0 w-1 bg-primary shadow-lg cursor-ew-resize"
          style={{ left: `${sliderPosition}%` }}
          animate={{ 
            boxShadow: isDragging 
              ? '0 0 20px hsl(var(--primary) / 0.8)' 
              : '0 0 10px hsl(var(--primary) / 0.4)' 
          }}
        >
          {/* Handle grip */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-primary flex items-center justify-center shadow-lg">
            <GripVertical className="w-5 h-5 text-primary-foreground" />
          </div>
          
          {/* Percentage indicator */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: isDragging ? 1 : 0, y: isDragging ? 0 : 10 }}
            className="absolute -bottom-10 left-1/2 -translate-x-1/2 px-2 py-1 rounded bg-primary text-primary-foreground text-xs font-medium whitespace-nowrap"
          >
            {Math.round(sliderPosition)}%
          </motion.div>
        </motion.div>

        {/* Instructions */}
        <motion.div
          initial={{ opacity: 1 }}
          animate={{ opacity: isDragging ? 0 : 0.8 }}
          className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg bg-background/80 backdrop-blur-sm border border-border"
        >
          <span className="text-xs text-muted-foreground">
            Drag to compare • {websiteName}
          </span>
        </motion.div>
      </div>
    </motion.div>
  );
}
