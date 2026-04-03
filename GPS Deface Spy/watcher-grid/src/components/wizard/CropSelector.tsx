import { useState, useRef } from 'react';
import ReactCrop, { type Crop, type PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { motion } from 'framer-motion';
import { Crosshair, Move } from 'lucide-react';

interface CropSelectorProps {
  imageUrl: string;
  onCropChange?: (crop: PixelCrop | null) => void;
  className?: string;
}

export function CropSelector({ imageUrl, onCropChange, className }: CropSelectorProps) {
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const handleCropChange = (c: Crop) => {
    setCrop(c);
  };

  const handleCropComplete = (c: PixelCrop) => {
    setCompletedCrop(c);
    onCropChange?.(c);
  };

  return (
    <div className={className}>
      {/* Coordinate Display */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-4 mb-3 p-3 rounded-lg bg-secondary/80 border border-border font-mono text-xs"
      >
        <div className="flex items-center gap-2">
          <Crosshair className="w-3.5 h-3.5 text-primary" />
          <span className="text-muted-foreground">POSITION:</span>
          <span className="text-foreground">
            X:{completedCrop?.x?.toFixed(0) ?? '—'} Y:{completedCrop?.y?.toFixed(0) ?? '—'}
          </span>
        </div>
        <div className="h-4 w-px bg-border" />
        <div className="flex items-center gap-2">
          <Move className="w-3.5 h-3.5 text-primary" />
          <span className="text-muted-foreground">SIZE:</span>
          <span className="text-foreground">
            {completedCrop?.width?.toFixed(0) ?? '—'} × {completedCrop?.height?.toFixed(0) ?? '—'}px
          </span>
        </div>
      </motion.div>

      {/* Crop Area */}
      <div className="rounded-lg border border-border overflow-hidden bg-secondary/30">
        <ReactCrop
          crop={crop}
          onChange={handleCropChange}
          onComplete={handleCropComplete}
          className="max-w-full"
        >
          <img
            ref={imgRef}
            src={imageUrl}
            alt="Website screenshot for region selection"
            className="max-w-full h-auto"
            crossOrigin="anonymous"
          />
        </ReactCrop>
      </div>

      {/* Help text */}
      <p className="text-[10px] font-mono text-muted-foreground mt-2 text-center tracking-wider">
        DRAW A BOX OVER THE REGION YOU WANT TO MONITOR
      </p>
    </div>
  );
}
