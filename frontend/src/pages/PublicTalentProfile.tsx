import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { 
  BadgeCheck, 
  Target, 
  Award, 
  ShieldCheck, 
  ExternalLink,
  ChevronLeft,
  ArrowRight
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Navbar } from '@/components/Navbar';
import { ScoreCard } from '@/components/ScoreCard';
import { dashboardService } from '@/services/dashboardService';

// Mock/Simplified public profile data for the hackathon
interface PublicProfile {
  name: string;
  seniorityBand: string;
  totalScore: number;
  trustLevel: string;
  categoryScores: Array<{ category: string; score: number }>;
  isInclusiveVerified: boolean;
  assessmentDate: string;
}

export default function PublicTalentProfile() {
  const { userId } = useParams<{ userId: string }>();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // In a real app, this would use publicProfileService.get(userId)
    // For now, we simulate fetching data
    const fetchProfile = async () => {
      setLoading(true);
      try {
        // We reuse dashboard service for now, but in reality we'd need a public endpoint
        const data = await dashboardService.getDashboardData();
        setProfile({
          name: "Verified Developer", // Placeholder name
          seniorityBand: data.seniority_band || 'Graduate',
          totalScore: data.total_score || 0,
          trustLevel: data.trust_level || 'Low',
          categoryScores: [
            { category: 'Frontend', score: 85 },
            { category: 'Backend', score: 72 },
            { category: 'Problem Solving', score: 90 },
          ],
          isInclusiveVerified: true,
          assessmentDate: new Date().toLocaleDateString(),
        });
      } catch (error) {
        console.error('Failed to load public profile', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [userId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex h-[60vh] items-center justify-center">
          <p className="text-muted-foreground animate-pulse">Scanning Talent Pipeline...</p>
        </div>
      </div>
    );
  }

  if (!profile) return <div>Profile not found</div>;

  return (
    <div className="min-h-screen bg-muted/30">
      <Navbar />
      
      <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-6">
          <Link to="/dashboard" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors">
            <ChevronLeft className="h-4 w-4" />
            Back to Dashboard
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Left Column: Summary */}
          <div className="md:col-span-1 space-y-6">
            <Card className="border-none shadow-xl bg-gradient-to-br from-primary/10 via-background to-background">
              <CardContent className="pt-6 text-center">
                <div className="inline-flex items-center justify-center p-3 rounded-full bg-primary/20 mb-4">
                  <BadgeCheck className="h-10 w-10 text-primary" />
                </div>
                <h1 className="text-2xl font-bold mb-1">{profile.name}</h1>
                <Badge variant="outline" className="mb-4 uppercase tracking-wider">{profile.seniorityBand}</Badge>
                
                <div className="py-6 border-y border-border/50 my-4">
                  <p className="text-sm text-muted-foreground mb-1 uppercase tracking-tighter font-semibold">Verified Trust Score</p>
                  <div className="text-5xl font-black text-primary">{Math.round(profile.totalScore)}</div>
                  <Badge variant="secondary" className="mt-2 text-xs">{profile.trustLevel} Trust</Badge>
                </div>

                <div className="text-xs text-muted-foreground bg-muted p-2 rounded-lg">
                  Assessment Date: {profile.assessmentDate}
                </div>
              </CardContent>
            </Card>

            <Card className="border-primary/20 bg-primary/5">
              <CardHeader className="pb-2 text-center">
                <CardTitle className="text-sm font-bold flex items-center justify-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  Inclusive-Verified
                </CardTitle>
              </CardHeader>
              <CardContent className="text-center">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  This candidate's skills were verified using **Accessibility-Aware Proctoring**, 
                  normalizing behavior signals for a bias-free assessment.
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Skills & Details */}
          <div className="md:col-span-2 space-y-8">
            <div>
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Target className="h-5 w-5 text-primary" />
                Verified Skill Matrix
              </h2>
              <div className="grid grid-cols-1 gap-4">
                {profile.categoryScores.map((skill) => (
                  <Card key={skill.category} className="border-none shadow-sm hover:shadow-md transition-all">
                    <CardContent className="pt-5">
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-semibold">{skill.category}</span>
                        <span className="text-primary font-bold">{skill.score}%</span>
                      </div>
                      <Progress value={skill.score} className="h-2" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            <Card className="bg-card/50 border-dashed border-2">
              <CardHeader>
                <CardTitle className="text-lg">Recruiter Action</CardTitle>
                <CardDescription>
                  This candidate has bypassed the technical screening phase.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-3">
                  <div className="p-2 rounded-lg bg-green-500/10 text-green-600">
                    < Award className="h-5 w-5" />
                  </div>
                  <div className="text-sm">
                    <p className="font-semibold text-green-700">Seniority Certified</p>
                    <p className="text-muted-foreground">This score represents a developer capable of {profile.seniorityBand === 'Senior' ? 'leading systems' : 'autonomous feature work'}.</p>
                  </div>
                </div>
                
                <div className="pt-4 flex flex-col sm:flex-row gap-3">
                  <Button className="flex-1 gap-2">
                    Open Direct Chat
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" className="flex-1 gap-2">
                    View Verified Github
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="text-[11px] text-muted-foreground text-center pt-8 border-t border-border">
              Secure Talent Verification by **InclusiveScore** &bull; Powered by YoScore AI
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
