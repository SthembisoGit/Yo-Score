import { cn } from '@/lib/utils';

type ColorVariant = 'primary' | 'blue' | 'purple' | 'orange' | 'teal' | 'pink' | 'indigo' | 'amber' | 'rose';

interface ScoreCardProps {
  title: string;
  score: number;
  maxScore?: number;
  trustLevel?: 'Low' | 'Medium' | 'High';
  size?: 'sm' | 'md' | 'lg' | 'hero';
  colorVariant?: ColorVariant;
  className?: string;
}

const colorStyles: Record<ColorVariant, { ring: string; text: string; bg: string }> = {
  primary: { ring: 'stroke-primary', text: 'text-primary', bg: 'bg-primary/10' },
  blue: { ring: 'stroke-[hsl(210,80%,50%)]', text: 'text-[hsl(210,80%,50%)]', bg: 'bg-[hsl(210,80%,50%)]/10' },
  purple: { ring: 'stroke-[hsl(270,60%,55%)]', text: 'text-[hsl(270,60%,55%)]', bg: 'bg-[hsl(270,60%,55%)]/10' },
  orange: { ring: 'stroke-[hsl(25,90%,55%)]', text: 'text-[hsl(25,90%,55%)]', bg: 'bg-[hsl(25,90%,55%)]/10' },
  teal: { ring: 'stroke-[hsl(175,70%,40%)]', text: 'text-[hsl(175,70%,40%)]', bg: 'bg-[hsl(175,70%,40%)]/10' },
  pink: { ring: 'stroke-[hsl(330,70%,55%)]', text: 'text-[hsl(330,70%,55%)]', bg: 'bg-[hsl(330,70%,55%)]/10' },
  indigo: { ring: 'stroke-[hsl(240,60%,55%)]', text: 'text-[hsl(240,60%,55%)]', bg: 'bg-[hsl(240,60%,55%)]/10' },
  amber: { ring: 'stroke-[hsl(40,90%,50%)]', text: 'text-[hsl(40,90%,50%)]', bg: 'bg-[hsl(40,90%,50%)]/10' },
  rose: { ring: 'stroke-[hsl(350,80%,55%)]', text: 'text-[hsl(350,80%,55%)]', bg: 'bg-[hsl(350,80%,55%)]/10' },
};

export function ScoreCard({
  title,
  score,
  maxScore = 100,
  trustLevel,
  size = 'md',
  colorVariant = 'primary',
  className,
}: ScoreCardProps) {
  const percentage = Math.min((score / maxScore) * 100, 100);
  const colors = colorStyles[colorVariant];
  
  const sizeStyles = {
    sm: { container: 'p-3', circle: 64, stroke: 4, text: 'text-lg', label: 'text-xs', title: 'text-xs mb-2' },
    md: { container: 'p-4', circle: 80, stroke: 5, text: 'text-2xl', label: 'text-xs', title: 'text-sm mb-3' },
    lg: { container: 'p-6', circle: 112, stroke: 6, text: 'text-3xl', label: 'text-sm', title: 'text-base mb-4' },
    hero: { container: 'p-8', circle: 160, stroke: 8, text: 'text-5xl', label: 'text-base', title: 'text-lg mb-4' },
  };

  const config = sizeStyles[size];
  const radius = (config.circle - config.stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  const getTrustBadgeClass = (level?: string) => {
    switch (level) {
      case 'Low':
        return 'trust-badge trust-low';
      case 'Medium':
        return 'trust-badge trust-medium';
      case 'High':
        return 'trust-badge trust-high';
      default:
        return '';
    }
  };

  return (
    <div
      className={cn(
        'bg-card rounded-xl shadow-md border border-border',
        size === 'hero' && 'shadow-lg ring-2 ring-primary/20',
        config.container,
        className
      )}
    >
      <h3 className={cn('text-muted-foreground font-medium', config.title)}>{title}</h3>
      
      <div className="flex flex-col items-center">
        <div className="relative">
          <svg
            width={config.circle}
            height={config.circle}
            className="transform -rotate-90"
          >
            <circle
              cx={config.circle / 2}
              cy={config.circle / 2}
              r={radius}
              stroke="currentColor"
              strokeWidth={config.stroke}
              fill="none"
              className="text-muted/20"
            />
            <circle
              cx={config.circle / 2}
              cy={config.circle / 2}
              r={radius}
              strokeWidth={config.stroke}
              fill="none"
              strokeLinecap="round"
              className={cn(colors.ring, 'transition-all duration-700')}
              style={{
                strokeDasharray: circumference,
                strokeDashoffset,
              }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className={cn('font-mono font-bold', colors.text, config.text)}>
              {score}
            </span>
          </div>
        </div>
        
        <span className={cn('text-muted-foreground mt-2', config.label)}>
          out of {maxScore}
        </span>
        
        {trustLevel && (
          <div className={cn('mt-4', getTrustBadgeClass(trustLevel))}>
            {trustLevel} Trust
          </div>
        )}
      </div>
    </div>
  );
}
