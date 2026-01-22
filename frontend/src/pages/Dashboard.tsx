import { Link } from 'react-router-dom';
import { ArrowRight, TrendingUp, Clock, Target, Code, Wrench } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { ScoreCard } from '@/components/ScoreCard';
import { ChallengeCard } from '@/components/ChallengeCard';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/context/AuthContext';
import { useChallenges } from '@/context/ChallengeContext';

const categoryColors = [
  'blue', 'purple', 'orange', 'teal', 'pink', 'indigo', 'amber', 'rose'
] as const;

export default function Dashboard() {
  const { user, setPreferredLanguage, setPreferredTool, availableLanguages, availableTools } = useAuth();
  const { challenges } = useChallenges();

  const recentChallenges = challenges.filter((c) => c.completed).slice(0, 3);
  const pendingChallenges = challenges.filter((c) => !c.completed).slice(0, 2);

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex items-center justify-center h-[60vh]">
          <div className="text-center">
            <p className="text-muted-foreground mb-4">Please log in to view your dashboard</p>
            <Link to="/login">
              <Button>Login</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Welcome back, {user.name.split(' ')[0]}</h1>
          <p className="text-muted-foreground">
            Here is your skill overview and recent activity
          </p>
        </div>

        {/* Hero Total Trust Score */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-1">
            <ScoreCard
              title="Total Trust Score"
              score={user.totalScore}
              trustLevel={user.trustLevel}
              size="hero"
              colorVariant="primary"
            />
          </div>

          {/* Preferences Card */}
          <div className="lg:col-span-2 bg-card border border-border rounded-xl p-6 shadow-md">
            <h2 className="text-lg font-semibold mb-4">Your Preferences</h2>
            <div className="grid sm:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm text-muted-foreground flex items-center gap-2">
                  <Code className="h-4 w-4" />
                  Preferred Language
                </label>
                <Select
                  value={user.preferredLanguage}
                  onValueChange={(value) => setPreferredLanguage(value as any)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select language" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableLanguages.map((lang) => (
                      <SelectItem key={lang} value={lang}>
                        {lang}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm text-muted-foreground flex items-center gap-2">
                  <Wrench className="h-4 w-4" />
                  Preferred Tool
                </label>
                <Select
                  value={user.preferredTool}
                  onValueChange={(value) => setPreferredTool(value as any)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select tool" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableTools.map((tool) => (
                      <SelectItem key={tool} value={tool}>
                        {tool}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-border">
              <p className="text-sm text-muted-foreground">
                Your challenges will be tailored to {user.preferredLanguage || 'your language'} using {user.preferredTool || 'your preferred editor'}.
              </p>
            </div>
          </div>
        </div>

        {/* Category Scores */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-4">Category Scores</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {user.categoryScores.map((cat, index) => (
              <ScoreCard
                key={cat.category}
                title={cat.category}
                score={cat.score}
                size="sm"
                colorVariant={categoryColors[index % categoryColors.length]}
              />
            ))}
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="bg-card border border-border rounded-lg p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <Target className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold font-mono">{recentChallenges.length}</p>
              <p className="text-sm text-muted-foreground">Completed Challenges</p>
            </div>
          </div>

          <div className="bg-card border border-border rounded-lg p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-[hsl(142,70%,45%)]/10 flex items-center justify-center">
              <TrendingUp className="h-6 w-6 text-[hsl(142,70%,45%)]" />
            </div>
            <div>
              <p className="text-2xl font-bold font-mono">+12%</p>
              <p className="text-sm text-muted-foreground">Score Improvement</p>
            </div>
          </div>

          <div className="bg-card border border-border rounded-lg p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-[hsl(40,90%,50%)]/10 flex items-center justify-center">
              <Clock className="h-6 w-6 text-[hsl(40,90%,50%)]" />
            </div>
            <div>
              <p className="text-2xl font-bold font-mono">{user.workExperienceMonths}mo</p>
              <p className="text-sm text-muted-foreground">Work Experience</p>
            </div>
          </div>
        </div>

        {/* Two Column Layout */}
        <div className="grid lg:grid-cols-2 gap-8">
          {/* Recent Challenges */}
          <div className="bg-card border border-border rounded-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold">Recent Challenges</h2>
              <Link
                to="/challenges"
                className="text-sm text-primary hover:underline flex items-center gap-1"
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
              <p className="text-muted-foreground text-center py-8">
                No completed challenges yet
              </p>
            )}
          </div>

          {/* Recommended Challenges */}
          <div className="bg-card border border-border rounded-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold">Recommended for You</h2>
              <Link
                to="/challenges"
                className="text-sm text-primary hover:underline flex items-center gap-1"
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
              <p className="text-muted-foreground text-center py-8">
                You have completed all available challenges
              </p>
            )}

            <Link to="/challenges" className="block mt-6">
              <Button className="w-full gap-2">
                Take a Challenge
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
