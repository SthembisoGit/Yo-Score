// components/challenge-detail/DescriptionPanel.tsx
import { Clock, Award } from 'lucide-react';
import { cn } from '@/lib/utils';
import { difficultyColors, getDurationAndPoints, difficultyDisplayMap } from '@/lib/challengeMappers';

interface DescriptionPanelProps {
  challenge: {
    title: string;
    description: string;
    category: string;
    difficulty: string;
  };
  compact?: boolean;
}

export const DescriptionPanel = ({ challenge, compact = false }: DescriptionPanelProps) => {
  const { duration, points } = getDurationAndPoints(challenge.difficulty);
  const displayDifficulty = difficultyDisplayMap[challenge.difficulty.toLowerCase()] || 'Medium';

  if (compact) {
    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-bold mb-2">{challenge.title}</h2>
          <div className="flex items-center gap-3 mb-3">
            <span className="text-xs font-medium px-2.5 py-1 bg-primary/10 text-primary rounded-full">
              {challenge.category}
            </span>
            <span className={cn(
              'text-xs font-medium px-2.5 py-1 rounded-full',
              difficultyColors[displayDifficulty]
            )}>
              {displayDifficulty}
            </span>
          </div>
          <p className="text-muted-foreground text-sm leading-relaxed">
            {challenge.description}
          </p>
        </div>
        
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>{duration} min</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Award className="h-4 w-4" />
            <span>{points} pts</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium px-3 py-1.5 bg-primary/10 text-primary rounded-full">
          {challenge.category}
        </span>
        <span className={cn(
          'text-sm font-medium px-3 py-1.5 rounded-full',
          difficultyColors[displayDifficulty]
        )}>
          {displayDifficulty}
        </span>
      </div>

      <h1 className="text-2xl lg:text-3xl font-bold">{challenge.title}</h1>
      
      <p className="text-muted-foreground text-lg leading-relaxed">
        {challenge.description}
      </p>

      <div className="flex items-center gap-6 text-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Clock className="h-4 w-4" />
          <span>{duration} minutes estimated</span>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Award className="h-4 w-4" />
          <span>{points} trust points</span>
        </div>
      </div>
    </div>
  );
};