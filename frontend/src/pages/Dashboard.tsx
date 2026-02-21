import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Clock, Target, Award, Layers } from 'lucide-react';

import { Navbar } from '@/components/Navbar';
import { ScoreCard } from '@/components/ScoreCard';
import { ChallengeCard } from '@/components/ChallengeCard';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'react-hot-toast';

import { useAuth } from '@/context/AuthContext';
import {
  useChallenges,
  type Challenge as ChallengeModel,
  type ChallengeStatus,
} from '@/context/ChallengeContext';
import {
  dashboardService,
  type DashboardData as ServiceDashboardData,
  type Submission as DashboardSubmission,
} from '@/services/dashboardService';
import { challengeService } from '@/services/challengeService';
import { buildCategoryScoresFromSubmissions } from '@/lib/categoryScores';

const CATEGORY_COLORS = [
  'blue',
  'purple',
  'orange',
  'teal',
  'pink',
  'indigo',
  'amber',
  'rose',
] as const;

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
};

export default function Dashboard() {
  const { user, availableCategories } = useAuth();
  const navigate = useNavigate();
  const { challenges } = useChallenges();

  const [isLoading, setIsLoading] = useState(false);
  type DashboardViewData = ServiceDashboardData & { monthly_progress?: number };
  const [dashboardData, setDashboardData] = useState<DashboardViewData | null>(null);
  const [recentSubmissions, setRecentSubmissions] = useState<DashboardSubmission[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>(
    availableCategories[0] ?? 'Frontend',
  );
  const [isAssigning, setIsAssigning] = useState(false);

  useEffect(() => {
    if (!user) return;
    loadDashboardData();
  }, [user]);

  const loadDashboardData = async () => {
    setIsLoading(true);
    try {
      const [dashboard, submissions] = await Promise.all([
        dashboardService.getDashboardData(),
        dashboardService.getUserSubmissions(),
      ]);
      setDashboardData(dashboard);
      setRecentSubmissions(submissions);
    } catch (error) {
      console.error('Dashboard data fetch failed', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartMatchedChallenge = async () => {
    setIsAssigning(true);
    try {
      const next = await challengeService.getNextChallenge(selectedCategory);
      navigate(
        `/challenges/${next.challenge_id}?assigned=1&assignmentCategory=${encodeURIComponent(
          selectedCategory,
        )}`,
        {
        state: {
          assignedFromMatcher: true,
          assignmentCategory: selectedCategory,
        },
        },
      );
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'No matching challenge available for this category and seniority.'));
    } finally {
      setIsAssigning(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex h-[60vh] items-center justify-center">
          <div className="text-center">
            <p className="mb-4 text-muted-foreground">Please log in to view your dashboard</p>
            <Link to="/login">
              <Button>Login</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const completedChallengesCount =
    dashboardData?.challenge_progress?.filter(
      (c) => c.status === 'completed' || c.status === 'graded'
    ).length ?? 0;

  const recentChallenges = recentSubmissions
    .slice(0, 3)
    .map((submission): ChallengeModel | null => {
      const match = challenges.find((challenge) => challenge.id === submission.challenge_id);
      if (!match) return null;
      const status: ChallengeStatus =
        submission.status === 'graded'
          ? 'completed'
          : submission.status === 'pending'
            ? 'in_progress'
            : 'not_started';
      return {
        ...match,
        status,
        completed: status === 'completed',
        score: submission.score ?? match.score,
      };
    })
    .filter((challenge): challenge is NonNullable<typeof challenge> => Boolean(challenge));

  const pendingChallenges = challenges
    .filter((c) => c.status !== 'completed')
    .slice(0, 2);

  const totalScore = dashboardData?.total_score ?? user.totalScore ?? 0;
  const trustLevel = dashboardData?.trust_level ?? user.trustLevel;
  const trustScorePercentage = Math.min(Math.round(totalScore), 100);

  const monthlyProgress = dashboardData?.monthly_progress ?? 0;
  const seniorityBand = dashboardData?.seniority_band ?? 'graduate';
  const workExperienceScore = dashboardData?.work_experience_score ?? 0;
  const trustedMonths = dashboardData?.work_experience_summary?.trusted_months ?? user.workExperienceMonths;
  const categoryScores = buildCategoryScoresFromSubmissions(recentSubmissions, challenges);

  return (
    <div className="min-h-screen bg-muted">
      <Navbar />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-8">
          <h1 className="mb-2 text-3xl font-bold">
            Welcome back, {user.name.split(' ')[0]}
          </h1>
          <p className="text-muted-foreground">
            Here is your skill overview and recent activity
          </p>
        </header>

        <section className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div>
            <ScoreCard
              title="Total Trust Score"
              score={totalScore}
              trustLevel={trustLevel}
              size="hero"
              colorVariant="primary"
            />
          </div>

          <div className="rounded-xl border border-border bg-card p-6 shadow-md lg:col-span-2">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Trust Score Insights</h2>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{trustLevel}</Badge>
                <Badge variant="outline">{seniorityBand.toUpperCase()}</Badge>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Score Progress</span>
                  <span className="font-medium">{trustScorePercentage}%</span>
                </div>
                <Progress value={trustScorePercentage} />
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Monthly Progress</span>
                <span className="font-medium">+{monthlyProgress} pts</span>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Trusted Experience Score</span>
                <span className="font-medium">{workExperienceScore}/20</span>
              </div>

              <div className="flex gap-3 pt-2">
                <Link to="/challenges" className="flex-1">
                  <Button className="w-full" disabled={isLoading}>
                    Take Challenge
                  </Button>
                </Link>

                <Link to="/work-experience" className="flex-1">
                  <Button variant="outline" className="w-full" disabled={isLoading}>
                    Add Experience
                  </Button>
                </Link>
              </div>
            </div>

            <div className="mt-4 border-t border-border pt-4">
              <p className="text-sm font-medium mb-2">Start Seniority-Matched Challenge</p>
              <div className="flex flex-col sm:flex-row gap-2">
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger className="sm:w-[220px]">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableCategories.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={() => void handleStartMatchedChallenge()} disabled={isAssigning || isLoading}>
                  {isAssigning ? 'Assigning...' : 'Start Matched Challenge'}
                </Button>
              </div>
            </div>
          </div>
        </section>

        <section className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex items-center gap-4 rounded-lg border border-border bg-card p-5">
            <Target className="h-6 w-6 text-primary" />
            <div>
              <p className="font-mono text-2xl font-bold">
                {completedChallengesCount}
              </p>
              <p className="text-sm text-muted-foreground">Completed Challenges</p>
            </div>
          </div>

          <div className="flex items-center gap-4 rounded-lg border border-border bg-card p-5">
            <Award className="h-6 w-6 text-[hsl(142,70%,45%)]" />
            <div>
                  <p className="font-mono text-2xl font-bold">{totalScore}</p>
              <p className="text-sm text-muted-foreground">Trust Score</p>
            </div>
          </div>

          <div className="flex items-center gap-4 rounded-lg border border-border bg-card p-5">
            <Clock className="h-6 w-6 text-[hsl(40,90%,50%)]" />
            <div>
              <p className="font-mono text-2xl font-bold">
                {trustedMonths}mo
              </p>
              <p className="text-sm text-muted-foreground">Experience</p>
            </div>
          </div>

          <div className="flex items-center gap-4 rounded-lg border border-border bg-card p-5">
            <Layers className="h-6 w-6 text-muted-foreground" />
            <div>
              <p className="font-mono text-2xl font-bold">
                {categoryScores.length}
              </p>
              <p className="text-sm text-muted-foreground">Categories</p>
            </div>
          </div>
        </section>

        <section className="mb-8">
          <h2 className="mb-4 text-lg font-semibold">Category Scores</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {categoryScores.map((category, index) => (
              <ScoreCard
                key={category.category}
                title={category.category}
                score={category.score}
                size="sm"
                colorVariant={CATEGORY_COLORS[index % CATEGORY_COLORS.length]}
              />
            ))}
          </div>
        </section>

        <section className="grid gap-8 lg:grid-cols-2">
          <div className="rounded-lg border border-border bg-card p-6">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-xl font-semibold">Recent Challenges</h2>
              <Link
                to="/challenges"
                className="flex items-center gap-1 text-sm text-primary hover:underline"
              >
                View all <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            {recentChallenges.length > 0 ? (
              <div className="space-y-4">
                {recentChallenges.map((challenge) => (
                  <ChallengeCard key={challenge.id} challenge={challenge} />
                ))}
              </div>
            ) : (
              <p className="py-8 text-center text-muted-foreground">
                No completed challenges yet
              </p>
            )}
          </div>

          <div className="rounded-lg border border-border bg-card p-6">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-xl font-semibold">Recommended for You</h2>
              <Link
                to="/challenges"
                className="flex items-center gap-1 text-sm text-primary hover:underline"
              >
                Browse all <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            {pendingChallenges.length > 0 ? (
              <div className="space-y-4">
                {pendingChallenges.map((challenge) => (
                  <ChallengeCard key={challenge.id} challenge={challenge} />
                ))}
              </div>
            ) : (
              <p className="py-8 text-center text-muted-foreground">
                You have completed all available challenges
              </p>
            )}

            <Link to="/challenges" className="mt-6 block">
              <Button className="w-full gap-2" disabled={isLoading}>
                Take a Challenge
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
