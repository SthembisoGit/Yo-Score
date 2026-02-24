import { useCallback, useEffect, useMemo, useState } from 'react';
import { BadgeCheck, Briefcase, Calendar, ExternalLink, Plus, ShieldAlert } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/context/AuthContext';
import { Link } from 'react-router-dom';
import {
  dashboardService,
  type WorkExperience as WorkExperienceRecord,
} from '@/services/dashboardService';
import { toast } from 'react-hot-toast';

interface ExperienceFormData {
  company_name: string;
  role: string;
  duration_months: string;
  evidence_links: string;
}

const calculateTotalMonths = (experiences: WorkExperienceRecord[]) =>
  experiences.reduce((total, experience) => total + experience.duration_months, 0);

const getVerificationTone = (status: WorkExperienceRecord['verification_status']) => {
  if (status === 'verified') {
    return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300';
  }
  if (status === 'flagged' || status === 'rejected') {
    return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300';
  }
  return 'bg-muted text-muted-foreground';
};

const formatAddedDate = (dateValue: string | null | undefined) => {
  if (!dateValue) return null;
  const parsed = new Date(dateValue);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString();
};

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

export default function WorkExperience() {
  const { user, updateUser } = useAuth();
  const [experiences, setExperiences] = useState<WorkExperienceRecord[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [formData, setFormData] = useState<ExperienceFormData>({
    company_name: '',
    role: '',
    duration_months: '',
    evidence_links: '',
  });

  const loadExperiences = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setLoadError(null);

    try {
      const rows = await dashboardService.getWorkExperience();
      setExperiences(rows);
      updateUser({ workExperienceMonths: calculateTotalMonths(rows) });
    } catch (error: unknown) {
      const message = getErrorMessage(error, 'Failed to load work experience.');
      setLoadError(message);
    } finally {
      setIsLoading(false);
    }
  }, [updateUser, user]);

  useEffect(() => {
    void loadExperiences();
  }, [loadExperiences]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((previous) => ({ ...previous, [e.target.name]: e.target.value }));
    if (formError) setFormError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const durationMonths = Number(formData.duration_months);
    if (!Number.isFinite(durationMonths) || durationMonths <= 0) {
      setFormError('Duration must be greater than 0 months.');
      toast.error('Duration must be greater than 0 months.');
      return;
    }
    if (!formData.company_name.trim() || !formData.role.trim()) {
      setFormError('Company name and role are required.');
      return;
    }

    setIsSaving(true);
    setFormError(null);
    try {
      await dashboardService.addWorkExperience({
        company_name: formData.company_name.trim(),
        role: formData.role.trim(),
        duration_months: durationMonths,
        evidence_links: formData.evidence_links
          .split('\n')
          .map((link) => link.trim())
          .filter((link) => link.length > 0),
      });
      await loadExperiences();
      setFormData({ company_name: '', role: '', duration_months: '', evidence_links: '' });
      setShowForm(false);
      toast.success('Work experience added');
    } catch (error: unknown) {
      const message = getErrorMessage(error, 'Failed to save work experience.');
      setFormError(message);
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  const summary = useMemo(() => {
    const totalMonths = calculateTotalMonths(experiences);
    const flaggedEntries = experiences.filter(
      (experience) =>
        experience.verification_status === 'flagged' ||
        experience.verification_status === 'rejected',
    ).length;

    return {
      totalEntries: experiences.length,
      totalMonths,
      trustContribution: Math.min(20, Math.floor(totalMonths / 1.2)),
      flaggedEntries,
    };
  }, [experiences]);

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex items-center justify-center h-[60vh]">
          <div className="text-center">
            <p className="text-muted-foreground mb-4">Please log in to manage work experience</p>
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

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">Work Experience</h1>
            <p className="text-muted-foreground">
              Add your professional history to strengthen trust scoring and seniority mapping.
            </p>
          </div>
          <Button
            onClick={() => {
              setShowForm((previous) => !previous);
              setFormError(null);
            }}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            Add Experience
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
          <article className="bg-card border border-border rounded-lg p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Total Entries</p>
            <p className="text-2xl font-semibold mt-2">{summary.totalEntries}</p>
          </article>
          <article className="bg-card border border-border rounded-lg p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Total Months</p>
            <p className="text-2xl font-semibold mt-2">{summary.totalMonths}</p>
          </article>
          <article className="bg-card border border-border rounded-lg p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Trust Contribution</p>
            <p className="text-2xl font-semibold mt-2">{summary.trustContribution}/20</p>
          </article>
          <article className="bg-card border border-border rounded-lg p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Flagged Entries</p>
            <p className="text-2xl font-semibold mt-2">{summary.flaggedEntries}</p>
          </article>
        </div>

        {showForm && (
          <div className="bg-card border border-border rounded-lg p-6 mb-8">
            <h2 className="text-xl font-semibold mb-4">Add Work Experience</h2>
            {formError && (
              <div
                role="alert"
                className="mb-4 rounded-md border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive"
              >
                <p className="font-medium mb-1">Please fix the following:</p>
                <p>{formError}</p>
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="company_name">Company Name</Label>
                  <Input
                    id="company_name"
                    name="company_name"
                    value={formData.company_name}
                    onChange={handleInputChange}
                    placeholder="Company name"
                    required
                    disabled={isSaving}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">Role / Position</Label>
                  <Input
                    id="role"
                    name="role"
                    value={formData.role}
                    onChange={handleInputChange}
                    placeholder="Your role"
                    required
                    disabled={isSaving}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="duration_months">Duration (months)</Label>
                <Input
                  id="duration_months"
                  name="duration_months"
                  type="number"
                  min={1}
                  step={1}
                  value={formData.duration_months}
                  onChange={handleInputChange}
                  placeholder="e.g. 12"
                  required
                  disabled={isSaving}
                />
                <p className="text-xs text-muted-foreground">
                  Use whole months only, for example: 12.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="evidence_links">Evidence Links (optional)</Label>
                <textarea
                  id="evidence_links"
                  name="evidence_links"
                  rows={4}
                  value={formData.evidence_links}
                  onChange={(e) => {
                    setFormData((previous) => ({ ...previous, evidence_links: e.target.value }));
                    if (formError) setFormError(null);
                  }}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="https://linkedin.com/in/your-profile"
                  disabled={isSaving}
                />
                <p className="text-xs text-muted-foreground">
                  Add one link per line, for example LinkedIn, GitHub, or company profile links.
                </p>
              </div>

              <div className="flex gap-3 justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowForm(false);
                    setFormError(null);
                  }}
                  disabled={isSaving}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSaving}>
                  {isSaving ? 'Saving...' : 'Save Experience'}
                </Button>
              </div>
            </form>
          </div>
        )}

        {loadError && (
          <div className="mb-6 rounded-md border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive space-y-2">
            <p>{loadError}</p>
            <Button type="button" variant="outline" size="sm" onClick={() => void loadExperiences()}>
              Retry Loading History
            </Button>
          </div>
        )}

        {isLoading && (
          <div className="bg-card border border-border rounded-lg p-6 text-sm text-muted-foreground">
            Loading work experience records...
          </div>
        )}

        <div className="space-y-4">
          {!isLoading && experiences.length > 0 ? (
            experiences.map((experience) => (
              <div
                key={
                  experience.experience_id ||
                  `${experience.company_name}-${experience.role}-${experience.added_at || 'unknown'}`
                }
                className="bg-card border border-border rounded-lg p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex gap-3 min-w-0">
                    <div className="w-11 h-11 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                      <Briefcase className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-lg font-semibold truncate">{experience.role}</p>
                      <p className="text-muted-foreground truncate">{experience.company_name}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          {experience.duration_months} months
                        </span>
                        {formatAddedDate(experience.added_at) ? (
                          <span>Added {formatAddedDate(experience.added_at)}</span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`text-xs rounded-full px-2 py-1 ${getVerificationTone(
                        experience.verification_status,
                      )}`}
                    >
                      {(experience.verification_status || 'pending').toUpperCase()}
                    </span>
                    <span className="text-xs rounded-full px-2 py-1 bg-muted text-muted-foreground">
                      Risk {experience.risk_score ?? 0}
                    </span>
                    <span className="text-xs rounded-full px-2 py-1 bg-muted text-muted-foreground inline-flex items-center gap-1">
                      <BadgeCheck className="h-3.5 w-3.5" />
                      {experience.verified ? 'Verified flag set' : 'Awaiting review'}
                    </span>
                  </div>
                </div>
                {experience.evidence_links && experience.evidence_links.length > 0 && (
                  <details className="mt-4 rounded border border-border bg-muted/20 p-3">
                    <summary className="cursor-pointer text-sm font-medium">
                      Evidence links ({experience.evidence_links.length})
                    </summary>
                    <ul className="mt-2 space-y-1 text-sm">
                      {experience.evidence_links.map((link) => (
                        <li key={link} className="truncate">
                          <a
                            href={link}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-primary hover:underline"
                          >
                            {link}
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            ))
          ) : null}

          {!isLoading && experiences.length === 0 ? (
            <div className="text-center py-12 bg-card border border-border rounded-lg">
              <ShieldAlert className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">No work experience added yet</p>
              <Button onClick={() => setShowForm(true)} className="gap-2">
                <Plus className="h-4 w-4" />
                Add Your First Experience
              </Button>
            </div>
          ) : null}
        </div>
      </main>
    </div>
  );
}
