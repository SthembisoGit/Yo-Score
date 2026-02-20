import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { User, Mail, Save, MapPin, Link2, Github, Linkedin, Globe } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { ScoreCard } from '@/components/ScoreCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader } from '@/components/Loader';
import { useAuth } from '@/context/AuthContext';
import { Link } from 'react-router-dom';
import { dashboardService } from '@/services/dashboardService';
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

export default function Profile() {
  const { user, updateUser } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
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
    if (user) {
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
    }
  }, [user]);

  const initials = useMemo(() => {
    if (!user?.name) return 'YS';
    return user.name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('');
  }, [user?.name]);

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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData((previous) => ({ ...previous, [e.target.name]: e.target.value }));
    if (saveError) {
      setSaveError(null);
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
    const payload = {
      name: formData.name.trim(),
      email: formData.email.trim(),
      avatar_url: formData.avatar_url.trim() || null,
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

              <div className="flex items-center gap-4 mb-6">
                {formData.avatar_url ? (
                  <img
                    src={formData.avatar_url}
                    alt="Profile avatar"
                    className="h-16 w-16 rounded-full object-cover border border-border"
                    onError={(event) => {
                      (event.currentTarget as HTMLImageElement).style.display = 'none';
                    }}
                  />
                ) : null}
                {!formData.avatar_url && (
                  <div className="h-16 w-16 rounded-full bg-primary/10 border border-border flex items-center justify-center font-semibold">
                    {initials}
                  </div>
                )}
                <div className="text-sm text-muted-foreground">
                  <p className="font-medium text-foreground">{user.name}</p>
                  <p>{user.role}</p>
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
                  <Label htmlFor="avatar_url">Profile Photo URL</Label>
                  <Input
                    id="avatar_url"
                    name="avatar_url"
                    placeholder="https://example.com/avatar.jpg"
                    value={formData.avatar_url}
                    onChange={handleInputChange}
                    disabled={!isEditing || isSaving}
                  />
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
                  <Button onClick={handleSave} disabled={isSaving} className="w-full gap-2">
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
              score={user.totalScore}
              trustLevel={user.trustLevel}
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

            <div className="bg-card border border-border rounded-lg p-6">
              <h3 className="font-semibold mb-4">Category Breakdown</h3>
              <div className="space-y-4">
                {user.categoryScores.map((cat, index) => {
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
