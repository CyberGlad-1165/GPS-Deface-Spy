import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface MatrixCell {
  id: number;
  value: number;
  status: 'safe' | 'changed';
  changePercent?: number;
}

interface MatrixHeatmapProps {
  data: MatrixCell[];
  gridSize?: number;
  title?: string;
  subtitle?: string;
  className?: string;
}

export function MatrixHeatmap({
  data,
  gridSize = 8,
  title = 'Matrix Analysis Grid',
  subtitle = 'Pixel-block comparison heatmap',
  className,
}: MatrixHeatmapProps) {
  const changedCells = data.filter(c => c.status === 'changed').length;
  const changePercentage = ((changedCells / data.length) * 100).toFixed(1);

  const getIntensityColor = (cell: MatrixCell) => {
    if (cell.status !== 'changed') return 'bg-success/20 hover:bg-success/30';
    
    const percent = cell.changePercent || 0;
    if (percent >= 80) return 'bg-destructive';
    if (percent >= 60) return 'bg-destructive/80';
    if (percent >= 40) return 'bg-warning';
    if (percent >= 20) return 'bg-warning/60';
    return 'bg-amber-500/40';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className={cn('glass-card p-6', className)}
    >
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-success/30" />
            <span className="text-xs text-muted-foreground">No Change</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-warning" />
            <span className="text-xs text-muted-foreground">Modified</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-destructive" />
            <span className="text-xs text-muted-foreground">Significant</span>
          </div>
        </div>
      </div>

      {/* Matrix Grid */}
      <div 
        className="grid gap-1.5 max-w-2xl mx-auto mb-6"
        style={{ gridTemplateColumns: `repeat(${gridSize}, 1fr)` }}
      >
        {data.map((cell, index) => (
          <Tooltip key={cell.id}>
            <TooltipTrigger asChild>
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ 
                  duration: 0.3, 
                  delay: index * 0.01,
                  type: 'spring',
                  stiffness: 200
                }}
                whileHover={{ scale: 1.1, zIndex: 10 }}
                className={cn(
                  "aspect-square rounded-md cursor-pointer transition-all duration-200 relative overflow-hidden",
                  getIntensityColor(cell),
                  cell.status === 'changed' && "ring-1 ring-destructive/50"
                )}
              >
                {cell.status === 'changed' && (
                  <>
                    <motion.div
                      className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent"
                      animate={{ opacity: [0.3, 0.6, 0.3] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-[10px] font-bold text-white drop-shadow-lg">
                        {cell.changePercent?.toFixed(0)}%
                      </span>
                    </div>
                  </>
                )}
              </motion.div>
            </TooltipTrigger>
            <TooltipContent side="top" className="bg-card border-border">
              <div className="text-xs">
                <p className="font-medium">
                  Block {Math.floor(cell.id / gridSize) + 1},{(cell.id % gridSize) + 1}
                </p>
                <p className={cn(
                  "mt-1",
                  cell.status === 'changed' ? 'text-destructive' : 'text-success'
                )}>
                  {cell.status === 'changed' 
                    ? `${cell.changePercent?.toFixed(1)}% change detected` 
                    : 'No significant changes'}
                </p>
              </div>
            </TooltipContent>
          </Tooltip>
        ))}
      </div>

      {/* Summary Stats */}
      <div className="flex items-center justify-between pt-4 border-t border-border">
        <div className="flex items-center gap-6">
          <div>
            <span className="text-2xl font-bold text-foreground">{changedCells}</span>
            <span className="text-sm text-muted-foreground ml-1">/ {data.length} blocks changed</span>
          </div>
          <div className="h-8 w-px bg-border" />
          <div>
            <span className="text-2xl font-bold text-destructive">{changePercentage}%</span>
            <span className="text-sm text-muted-foreground ml-1">total area affected</span>
          </div>
        </div>
        
        {/* Change intensity bar */}
        <div className="w-48">
          <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
            <span>Low</span>
            <span>High</span>
          </div>
          <div className="h-2 rounded-full bg-gradient-to-r from-success via-warning to-destructive" />
        </div>
      </div>
    </motion.div>
  );
}
