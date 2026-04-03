import { useEffect, useRef, useCallback } from 'react';
import './HackerEyes.css';

interface HackerEyesProps {
  imageSrc?: string;
  /** Max shift in px — keep small so only pupils appear to move (default: 3) */
  maxShift?: number;
}

export default function HackerEyes({
  imageSrc = '/assets/red eyes.png',
  maxShift = 3,
}: HackerEyesProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      const frame = frameRef.current;
      const img = imgRef.current;
      if (!frame || !img) return;

      const rect = frame.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;

      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const maxDist = Math.max(window.innerWidth, window.innerHeight) * 0.5;
      const factor = Math.min(dist / maxDist, 1);
      const angle = Math.atan2(dy, dx);

      const moveX = Math.cos(angle) * factor * maxShift;
      const moveY = Math.sin(angle) * factor * (maxShift * 0.4);

      // scale(1.2) keeps edges hidden; translate moves the pupils
      img.style.transform = `scale(1.2) translate(${moveX}px, ${moveY}px)`;
    },
    [maxShift],
  );

  const handleMouseLeave = useCallback(() => {
    if (imgRef.current) imgRef.current.style.transform = 'scale(1.2) translate(0px, 0px)';
  }, []);

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseleave', handleMouseLeave);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [handleMouseMove, handleMouseLeave]);

  return (
    <div className="sentinel-eyes">
      <div className="sentinel-eyes-frame" ref={frameRef}>
        <img
          ref={imgRef}
          src={imageSrc}
          alt="Sentinel Eyes"
          className="sentinel-eyes-img"
          draggable={false}
        />
      </div>
    </div>
  );
}
