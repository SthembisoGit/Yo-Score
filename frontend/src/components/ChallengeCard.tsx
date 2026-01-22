import { Link } from 'react-router-dom';
import { Clock, Award, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Challenge } from '@/context/ChallengeContext';

interface ChallengeCardProps {
  challenge: Challenge;
  className?: string;
}

const difficultyColors = {
  Easy: 'bg-success/10 text-success',
  Medium: 'bg-warning/10 text-warning',
  Hard: 'bg-destructive/10 text-destructive',
};

const categoryColors = {
  Frontend: 'border-l-primary',
  Backend: 'border-l-foreground',
  Security: 'border-l-destructive',
};

export function ChallengeCard({ challenge, className }: ChallengeCardProps) {
  return (
    <Link
      to={`/challenges/${challenge.id}`}
      className={cn(
        'block bg-card rounded-lg border border-border shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden group',
        className
      )}
    >
      <div className={cn('border-l-4', categoryColors[challenge.category])}>
        <div className="p-5">
          <div className="flex items-start justify-between gap-4 mb-3">
            <h3 className="font-semibold text-lg group-hover:text-primary transition-colors">
              {challenge.title}
            </h3>
            {challenge.completed && (
              <CheckCircle className="h-5 w-5 text-success flex-shrink-0" />
            )}
          </div>

          <p className="text-muted-foreground text-sm mb-4 line-clamp-2">
            {challenge.description}
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs font-medium px-2 py-1 bg-muted rounded">
              {challenge.category}
            </span>
            <span
              className={cn(
                'text-xs font-medium px-2 py-1 rounded',
                difficultyColors[challenge.difficulty]
              )}
            >
              {challenge.difficulty}
            </span>
          </div>

          <div className="flex items-center gap-4 mt-4 pt-4 border-t border-border text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              <span>{challenge.duration} min</span>
            </div>
            <div className="flex items-center gap-1">
              <Award className="h-4 w-4" />
              <span>{challenge.points} pts</span>
            </div>
            {challenge.score !== undefined && (
              <div className="ml-auto font-mono font-medium text-primary">
                Score: {challenge.score}
              </div>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
