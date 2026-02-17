import { useCallback, useEffect, useState } from 'react';
import { Plus, Briefcase, Calendar } from 'lucide-react';
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
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const durationMonths = Number(formData.duration_months);
    if (!Number.isFinite(durationMonths) || durationMonths <= 0) {
      toast.error('Duration must be greater than 0 months.');
      return;
    }

    setIsSaving(true);
    try {
      const created = await dashboardService.addWorkExperience({
        company_name: formData.company_name.trim(),
        role: formData.role.trim(),
        duration_months: durationMonths,
        evidence_links: formData.evidence_links
          .split('\n')
          .map((link) => link.trim())
          .filter((link) => link.length > 0),
      });

      const updated = [created, ...experiences];
      setExperiences(updated);
      updateUser({ workExperienceMonths: calculateTotalMonths(updated) });
      setFormData({ company_name: '', role: '', duration_months: '', evidence_links: '' });
      setShowForm(false);
      toast.success('Work experience added');
    } catch (error: unknown) {
      const message = getErrorMessage(error, 'Failed to save work experience.');
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  const totalMonths = calculateTotalMonths(experiences);

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
              Add verified experience that contributes to your trust score
            </p>
          </div>
          <Button onClick={() => setShowForm(!showForm)} className="gap-2" disabled={isLoading}>
            <Plus className="h-4 w-4" />
            Add Experience
          </Button>
        </div>

        <div className="bg-primary text-primary-foreground rounded-lg p-6 mb-8">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-primary-foreground/80 text-sm mb-1">Experience Score Contribution</p>
              <p className="text-3xl font-bold font-mono">
                {Math.min(20, Math.floor(totalMonths / 1.2))}/20
              </p>
            </div>
            <div className="text-right">
              <p className="text-primary-foreground/80 text-sm mb-1">Total Experience</p>
              <p className="text-2xl font-bold font-mono">{totalMonths} months</p>
            </div>
          </div>
        </div>

        {showForm && (
          <div className="bg-card border border-border rounded-lg p-6 mb-8">
            <h2 className="text-xl font-semibold mb-4">Add Work Experience</h2>
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
              </div>

              <div className="space-y-2">
                <Label htmlFor="evidence_links">
                  Evidence Links (optional, one URL per line)
                </Label>
                <textarea
                  id="evidence_links"
                  name="evidence_links"
                  rows={4}
                  value={formData.evidence_links}
                  onChange={(e) =>
                    setFormData((previous) => ({ ...previous, evidence_links: e.target.value }))
                  }
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="https://linkedin.com/in/your-profile"
                  disabled={isSaving}
                />
              </div>

              <div className="flex gap-3 justify-end">
                <Button type="button" variant="outline" onClick={() => setShowForm(false)} disabled={isSaving}>
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
          <div className="mb-6 rounded-md border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
            {loadError}
          </div>
        )}

        <div className="space-y-4">
          {!isLoading && experiences.length > 0 ? (
            experiences.map((experience) => (
              <div
                key={experience.experience_id}
                className="bg-card border border-border rounded-lg p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex gap-4">
                    <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                      <Briefcase className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">{experience.role}</h3>
                      <p className="text-muted-foreground">{experience.company_name}</p>
                      <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                        <Calendar className="h-4 w-4" />
                        <span>{experience.duration_months} months</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span
                      className={`text-xs rounded-full px-2 py-1 ${
                        experience.verification_status === 'verified'
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                          : experience.verification_status === 'flagged'
                            ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                            : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {(experience.verification_status || 'pending').toUpperCase()}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Risk Score: {experience.risk_score ?? 0}
                    </span>
                  </div>
                </div>
                {experience.evidence_links && experience.evidence_links.length > 0 && (
                  <div className="mt-3 text-xs text-muted-foreground">
                    <p className="font-medium mb-1">Evidence links</p>
                    <ul className="space-y-1">
                      {experience.evidence_links.map((link) => (
                        <li key={link} className="truncate">
                          <a
                            href={link}
                            target="_blank"
                            rel="noreferrer"
                            className="text-primary hover:underline"
                          >
                            {link}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))
          ) : null}

          {!isLoading && experiences.length === 0 ? (
            <div className="text-center py-12 bg-card border border-border rounded-lg">
              <Briefcase className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
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
