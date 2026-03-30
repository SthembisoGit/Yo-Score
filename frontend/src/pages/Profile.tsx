import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { User, Mail, Save, MapPin, Link2, Github, Linkedin, Globe, Copy, RotateCcw, Printer } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { ScoreCard } from '@/components/ScoreCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Loader } from '@/components/Loader';
import { useAuth } from '@/context/AuthContext';
import { Link } from 'react-router-dom';
import { dashboardService, type DashboardData } from '@/services/dashboardService';
import { challengeService } from '@/services/challengeService';
import { buildCategoryScoresFromSubmissions, type CategoryScoreView } from '@/lib/categoryScores';
import { shareScoreService, type ShareScoreSettings } from '@/services/shareScoreService';
import { toast } from 'react-hot-toast';

const getErrorMessage = (error: unknown, fallback: string) => {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const response = (error as { response?: { data?: { message?: unknown } } }).response;
    if (typeof response?.data?.message === 'string' && response.data.message.trim()) {
      return response.data.message;
    }
  }
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return fallback;
};

const isValidUrl = (value: string) => {
  if (!value.trim()) return true;
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol);
  } catch {
    return false;
  }
};

const formatProfileDate = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Unavailable';
  return new Intl.DateTimeFormat('en-ZA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(parsed);
};

export default function Profile() {
  const { user, updateUser } = useAuth();
  const userId = user?.id ?? null;
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [dashboardSummary, setDashboardSummary] = useState<DashboardData | null>(null);
  const [categoryScores, setCategoryScores] = useState<CategoryScoreView[]>([]);
  const [isMetricsLoading, setIsMetricsLoading] = useState(false);
  const [shareSettings, setShareSettings] = useState<ShareScoreSettings | null>(null);
  const [isShareLoading, setIsShareLoading] = useState(false);
  const [isShareSaving, setIsShareSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    avatar_url: '',
    headline: '',
    bio: '',
    location: '',
    github_url: '',
    linkedin_url: '',
    portfolio_url: '',
  });

  useEffect(() => {
    if (!user || isEditing) return;

    setFormData({
      name: user.name || '',
      email: user.email || '',
      avatar_url: user.avatar || '',
      headline: user.headline || '',
      bio: user.bio || '',
      location: user.location || '',
      github_url: user.githubUrl || '',
      linkedin_url: user.linkedinUrl || '',
      portfolio_url: user.portfolioUrl || '',
    });
  }, [
    isEditing,
    user?.avatar,
    user?.bio,
    user?.email,
    user?.githubUrl,
    user?.headline,
    user?.linkedinUrl,
    user?.location,
    user?.name,
    user?.portfolioUrl,
  ]);

  const loadProfileMetrics = useCallback(async () => {
    if (!userId) return;

    setIsMetricsLoading(true);
    try {
      const [dashboard, submissions, challenges] = await Promise.all([
        dashboardService.getDashboardData(),
        dashboardService.getUserSubmissions(),
        challengeService.getAllChallenges(),
      ]);
      const mappedChallenges = challenges.map((challenge) => ({
        id: challenge.challenge_id,
        category: challenge.category,
      }));

      setDashboardSummary(dashboard);
      setCategoryScores(buildCategoryScoresFromSubmissions(submissions, mappedChallenges));
      updateUser({
        totalScore: dashboard.total_score,
        trustLevel: dashboard.trust_level,
        workExperienceMonths: dashboard.work_experience_summary?.trusted_months ?? 0,
        seniorityBand: dashboard.seniority_band,
      });
    } catch {
      setDashboardSummary(null);
      setCategoryScores([]);
    } finally {
      setIsMetricsLoading(false);
    }
  }, [updateUser, userId]);

  const loadShareSettings = useCallback(async () => {
    if (!userId) return;

    setIsShareLoading(true);
    try {
      const settings = await shareScoreService.getMyShareSettings();
      setShareSettings(settings);
    } catch {
      setShareSettings(null);
    } finally {
      setIsShareLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) return;

    void loadProfileMetrics();

    const handleFocus = () => {
      void loadProfileMetrics();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void loadProfileMetrics();
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [loadProfileMetrics, userId]);

  useEffect(() => {
    if (!userId) return;
    void loadShareSettings();
  }, [loadShareSettings, userId]);

  const initials = useMemo(() => {
    if (!user?.name) return 'YS';
    return user.name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('');
  }, [user?.name]);

  const totalScore = dashboardSummary?.total_score ?? user.totalScore;
  const trustLevel = dashboardSummary?.trust_level ?? user.trustLevel;
  const shareLastUpdated = shareSettings?.updated_at ? formatProfileDate(shareSettings.updated_at) : 'Not created yet';

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex items-center justify-center h-[60vh]">
          <div className="text-center">
            <p className="text-muted-foreground mb-4">Please log in to view your profile</p>
            <Link to="/login">
              <Button>Login</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const formErrors = [saveError].filter(
    (message): message is string => Boolean(message),
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData((previous) => ({ ...previous, [e.target.name]: e.target.value }));
    if (saveError) {
      setSaveError(null);
    }
  };

  const handleAvatarClick = () => {
    if (!isEditing) return;
    toast('Profile photo upload is temporarily disabled.');
  };

  const updateShareSettings = async (input: { enabled: boolean; regenerate?: boolean }) => {
    setIsShareSaving(true);
    try {
      const settings = await shareScoreService.updateMyShareSettings(input);
      setShareSettings(settings);
      toast.success(
        input.enabled
          ? input.regenerate
            ? 'Public score link regenerated'
            : 'Public score sharing enabled'
          : 'Public score sharing disabled',
      );
      return settings;
    } catch (error) {
      const message = getErrorMessage(error, 'Failed to update public score sharing.');
      toast.error(message);
      throw error;
    } finally {
      setIsShareSaving(false);
    }
  };

  const handleShareToggle = async (enabled: boolean) => {
    try {
      await updateShareSettings({ enabled });
    } catch {
      // toast handled in updateShareSettings
    }
  };

  const handleCopyShareLink = async () => {
    const link = shareSettings?.public_url;
    if (!link) return;

    try {
      await navigator.clipboard.writeText(link);
      toast.success('Public score link copied');
    } catch {
      toast.error('Could not copy the public score link.');
    }
  };

  const handleRegenerateLink = async () => {
    try {
      await updateShareSettings({ enabled: true, regenerate: true });
    } catch {
      // toast handled in updateShareSettings
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setSaveError(null);
    setFormData({
      name: user.name || '',
      email: user.email || '',
      avatar_url: user.avatar || '',
      headline: user.headline || '',
      bio: user.bio || '',
      location: user.location || '',
      github_url: user.githubUrl || '',
      linkedin_url: user.linkedinUrl || '',
      portfolio_url: user.portfolioUrl || '',
    });
  };

  const handleSave = async () => {
    const avatarUrl = formData.avatar_url.trim() || null;

    const payload = {
      name: formData.name.trim(),
      email: formData.email.trim(),
      avatar_url: avatarUrl,
      headline: formData.headline.trim() || null,
      bio: formData.bio.trim() || null,
      location: formData.location.trim() || null,
      github_url: formData.github_url.trim() || null,
      linkedin_url: formData.linkedin_url.trim() || null,
      portfolio_url: formData.portfolio_url.trim() || null,
    };

    if (!payload.name || !payload.email) {
      setSaveError('Name and email are required.');
      return;
    }

    const urlFields = [
      payload.avatar_url,
      payload.github_url,
      payload.linkedin_url,
      payload.portfolio_url,
    ];
    if (urlFields.some((value) => value && !isValidUrl(value))) {
      setSaveError('One or more profile URLs are invalid. Use full http/https links.');
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      const updatedProfile = await dashboardService.updateProfile(payload);
      updateUser({
        name: updatedProfile.name,
        email: updatedProfile.email,
        avatar: updatedProfile.avatar_url || undefined,
        headline: updatedProfile.headline || undefined,
        bio: updatedProfile.bio || undefined,
        location: updatedProfile.location || undefined,
        githubUrl: updatedProfile.github_url || undefined,
        linkedinUrl: updatedProfile.linkedin_url || undefined,
        portfolioUrl: updatedProfile.portfolio_url || undefined,
      });
      setIsEditing(false);
      toast.success('Profile updated');
    } catch (error: unknown) {
      const message = getErrorMessage(error, 'Failed to update profile.');
      setSaveError(message);
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-muted">
      <Navbar />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Profile Settings</h1>
          <p className="text-muted-foreground">
            Manage your account information, profile links, and identity details
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-card border border-border rounded-lg p-6">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                <h2 className="text-xl font-semibold">Account Information</h2>
                {!isEditing ? (
                  <Button variant="outline" onClick={() => setIsEditing(true)}>
                    Edit Profile
                  </Button>
                ) : (
                  <Button variant="ghost" onClick={handleCancel}>
                    Cancel
                  </Button>
                )}
              </div>

              {isEditing && formErrors.length > 0 && (
                <div
                  role="alert"
                  className="mb-4 rounded-md border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive"
                >
                  <p className="font-medium mb-1">Please fix the following:</p>
                  <ul className="list-disc pl-4 space-y-1">
                    {formErrors.map((message, index) => (
                      <li key={`${message}-${index}`}>{message}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex items-center gap-4 mb-6">
                <button
                  type="button"
                  onClick={handleAvatarClick}
                  className="group relative"
                  aria-label={isEditing ? 'Profile photo upload disabled' : 'Profile photo'}
                >
                  {formData.avatar_url ? (
                    <img
                      src={formData.avatar_url}
                      alt="Profile avatar"
                      className="h-16 w-16 rounded-full object-cover border border-border"
                      onError={(event) => {
                        (event.currentTarget as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="h-16 w-16 rounded-full bg-primary/10 border border-border flex items-center justify-center font-semibold">
                      {initials}
                    </div>
                  )}
                  {isEditing ? (
                    <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap text-[11px] text-muted-foreground">
                      Upload disabled for now
                    </span>
                  ) : null}
                </button>
                <div className="text-sm text-muted-foreground">
                  <p className="font-medium text-foreground">{user.name}</p>
                  <p>{user.role}</p>
                  {isEditing ? (
                    <p className="text-xs mt-1">Profile photo upload is temporarily disabled.</p>
                  ) : null}
                </div>
              </div>

              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="name" className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Full Name
                    </Label>
                    <Input
                      id="name"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      disabled={!isEditing || isSaving}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email" className="flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      Email Address
                    </Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      disabled={!isEditing || isSaving}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="headline">Headline</Label>
                  <Input
                    id="headline"
                    name="headline"
                    placeholder="Frontend Engineer | React | TypeScript"
                    value={formData.headline}
                    onChange={handleInputChange}
                    disabled={!isEditing || isSaving}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bio">Bio</Label>
                  <textarea
                    id="bio"
                    name="bio"
                    rows={4}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    placeholder="Tell recruiters and reviewers what you specialize in."
                    value={formData.bio}
                    onChange={handleInputChange}
                    disabled={!isEditing || isSaving}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="location" className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    Location
                  </Label>
                  <Input
                    id="location"
                    name="location"
                    placeholder="Johannesburg, South Africa"
                    value={formData.location}
                    onChange={handleInputChange}
                    disabled={!isEditing || isSaving}
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="github_url" className="flex items-center gap-2">
                      <Github className="h-4 w-4" />
                      GitHub URL
                    </Label>
                    <Input
                      id="github_url"
                      name="github_url"
                      placeholder="https://github.com/username"
                      value={formData.github_url}
                      onChange={handleInputChange}
                      disabled={!isEditing || isSaving}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="linkedin_url" className="flex items-center gap-2">
                      <Linkedin className="h-4 w-4" />
                      LinkedIn URL
                    </Label>
                    <Input
                      id="linkedin_url"
                      name="linkedin_url"
                      placeholder="https://linkedin.com/in/username"
                      value={formData.linkedin_url}
                      onChange={handleInputChange}
                      disabled={!isEditing || isSaving}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="portfolio_url" className="flex items-center gap-2">
                    <Globe className="h-4 w-4" />
                    Portfolio URL
                  </Label>
                  <Input
                    id="portfolio_url"
                    name="portfolio_url"
                    placeholder="https://your-portfolio.dev"
                    value={formData.portfolio_url}
                    onChange={handleInputChange}
                    disabled={!isEditing || isSaving}
                  />
                </div>

                {saveError && (
                  <p className="text-sm text-destructive" role="alert">
                    {saveError}
                  </p>
                )}

                {isEditing && (
                  <Button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="w-full gap-2"
                  >
                    {isSaving ? (
                      <Loader size="sm" className="border-primary-foreground" />
                    ) : (
                      <>
                        <Save className="h-4 w-4" />
                        Save Changes
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <ScoreCard
              title="Total Trust Score"
              score={totalScore}
              trustLevel={trustLevel}
              size="lg"
              colorVariant="primary"
            />

            <div className="bg-card border border-border rounded-lg p-6">
              <h3 className="font-semibold mb-4">Public Profile Links</h3>
              <div className="space-y-3 text-sm">
                <ProfileLink label="GitHub" value={user.githubUrl} icon={<Github className="h-4 w-4" />} />
                <ProfileLink label="LinkedIn" value={user.linkedinUrl} icon={<Linkedin className="h-4 w-4" />} />
                <ProfileLink label="Portfolio" value={user.portfolioUrl} icon={<Globe className="h-4 w-4" />} />
              </div>
            </div>

              <div className="bg-card border border-border rounded-lg p-5 space-y-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h3 className="font-semibold">Public Score Sharing</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Create a recruiter-friendly public score sheet that anyone with the link can open and print.
                    </p>
                </div>
                <Switch
                  checked={Boolean(shareSettings?.enabled)}
                  disabled={isShareLoading || isShareSaving}
                  onCheckedChange={(checked) => {
                    void handleShareToggle(checked);
                  }}
                  aria-label="Enable public score sharing"
                />
              </div>

              {isShareLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader size="sm" />
                  <span>Loading share settings...</span>
                </div>
                ) : (
                  <div className="space-y-4">
                    <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
                      <p className="leading-6">
                        {shareSettings?.enabled
                          ? 'Anyone with this secret link can view and print your score sheet. Disable sharing any time to stop access.'
                          : 'Sharing is off. Turn it on to generate a public link for your score sheet.'}
                      </p>
                      <p className="mt-2 text-xs uppercase tracking-[0.12em] text-muted-foreground/80">
                        Last updated
                        <span className="ml-2 text-sm font-medium normal-case tracking-normal text-foreground">
                          {shareLastUpdated}
                        </span>
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="public-score-link">Public share link</Label>
                      <Input
                        id="public-score-link"
                        value={shareSettings?.public_url ?? 'Enable sharing to generate a public link'}
                        readOnly
                        disabled
                        className="text-xs sm:text-sm"
                      />
                    </div>

                    <div className="flex flex-col gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full justify-center gap-2"
                        disabled={!shareSettings?.public_url || isShareSaving}
                        onClick={() => void handleCopyShareLink()}
                      >
                        <Copy className="h-4 w-4 shrink-0" />
                        <span>Copy Link</span>
                      </Button>

                      {shareSettings?.public_url && !isShareSaving ? (
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full justify-center gap-2"
                          asChild
                        >
                          <a href={shareSettings.public_url} target="_blank" rel="noreferrer">
                            <Printer className="h-4 w-4 shrink-0" />
                            <span>Preview Page</span>
                          </a>
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full justify-center gap-2"
                          disabled
                        >
                          <Printer className="h-4 w-4 shrink-0" />
                          <span>Preview Page</span>
                        </Button>
                      )}

                      <Button
                        type="button"
                        variant="outline"
                        className="w-full justify-center gap-2"
                        disabled={!shareSettings?.enabled || isShareSaving}
                        onClick={() => void handleRegenerateLink()}
                      >
                        <RotateCcw className="h-4 w-4 shrink-0" />
                        <span>Regenerate Link</span>
                      </Button>
                    </div>
                  </div>
                )}
              </div>

            <div className="bg-card border border-border rounded-lg p-6">
                <h3 className="font-semibold mb-4">Category Breakdown</h3>
                <div className="space-y-4">
                {isMetricsLoading && (
                  <p className="text-sm text-muted-foreground">Loading category scores...</p>
                )}
                {!isMetricsLoading && categoryScores.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    No scored categories yet. Complete challenges to build your category profile.
                  </p>
                )}
                {!isMetricsLoading && categoryScores.map((cat, index) => {
                  const colors = [
                    'bg-[hsl(210,80%,50%)]',
                    'bg-[hsl(270,60%,55%)]',
                    'bg-[hsl(25,90%,55%)]',
                    'bg-[hsl(175,70%,40%)]',
                    'bg-[hsl(330,70%,55%)]',
                  ];
                  return (
                    <div key={cat.category}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-muted-foreground text-sm">{cat.category}</span>
                        <span className="font-mono font-medium text-sm">{cat.score}</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${colors[index % colors.length]}`}
                          style={{ width: `${cat.score}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function ProfileLink({ label, value, icon }: { label: string; value?: string; icon: ReactNode }) {
  if (!value) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span>{label}: Not set</span>
      </div>
    );
  }

  return (
    <a
      href={value}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-2 text-primary hover:underline break-all"
    >
      {icon}
      <span>{label}</span>
      <Link2 className="h-3.5 w-3.5" />
    </a>
  );
}
