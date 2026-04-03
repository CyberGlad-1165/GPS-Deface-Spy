import { motion, HTMLMotionProps } from 'framer-motion';
import { cn } from '@/lib/utils';

interface AnimatedCardProps extends HTMLMotionProps<'div'> {
  delay?: number;
  hover?: boolean;
  glow?: boolean;
  children: React.ReactNode;
  className?: string;
}

export function AnimatedCard({
  delay = 0,
  hover = true,
  glow = false,
  children,
  className,
  ...props
}: AnimatedCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.4,
        delay,
        type: 'spring',
        stiffness: 100,
      }}
      whileHover={hover ? { y: -4, transition: { duration: 0.2 } } : undefined}
      className={cn(
        'glass-card p-6 transition-all duration-300',
        hover && 'hover:border-primary/30',
        glow && 'hover:shadow-[0_0_20px_hsl(var(--primary)/0.3)]',
        className
      )}
      {...props}
    >
      {children}
    </motion.div>
  );
}
