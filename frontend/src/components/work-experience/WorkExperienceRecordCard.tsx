import { BadgeCheck, Briefcase, Calendar, ExternalLink } from 'lucide-react';
import type { WorkExperience as WorkExperienceRecord } from '@/services/dashboardService';

const formatAddedDate = (dateValue: string | null | undefined) => {
  if (!dateValue) return null;
  const parsed = new Date(dateValue);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString();
};

const getVerificationTone = (status: WorkExperienceRecord['verification_status']) => {
  if (status === 'verified') {
    return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300';
  }
  if (status === 'flagged' || status === 'rejected') {
    return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300';
  }
  return 'bg-muted text-muted-foreground';
};

const getRiskTone = (riskScore: number) => {
  if (riskScore >= 70) return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300';
  if (riskScore >= 40) return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300';
  return 'bg-muted text-muted-foreground';
};

interface WorkExperienceRecordCardProps {
  experience: WorkExperienceRecord;
}

export function WorkExperienceRecordCard({ experience }: WorkExperienceRecordCardProps) {
  const addedDate = formatAddedDate(experience.added_at);
  const riskScore = Number(experience.risk_score ?? 0);

  return (
    <article className="relative overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div className="absolute inset-y-0 left-0 w-1.5 bg-primary" aria-hidden="true" />

      <div className="p-5 pl-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
              <Briefcase className="h-4 w-4" />
              Work Record
            </div>
            <h3 className="mt-2 text-lg font-semibold break-words">{experience.role}</h3>
            <p className="text-muted-foreground break-words">{experience.company_name}</p>

            <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                {experience.duration_months} months
              </span>
              {addedDate ? <span>Added {addedDate}</span> : null}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`text-xs rounded-full px-2 py-1 font-medium ${getVerificationTone(
                experience.verification_status,
              )}`}
            >
              {(experience.verification_status || 'pending').toUpperCase()}
            </span>
            <span className={`text-xs rounded-full px-2 py-1 font-medium ${getRiskTone(riskScore)}`}>
              Risk {riskScore}
            </span>
            <span className="text-xs rounded-full px-2 py-1 bg-muted text-muted-foreground inline-flex items-center gap-1">
              <BadgeCheck className="h-3.5 w-3.5" />
              {experience.verified ? 'Verified flag set' : 'Awaiting review'}
            </span>
          </div>
        </div>

        {experience.evidence_links && experience.evidence_links.length > 0 ? (
          <details className="mt-4 rounded-md border border-border bg-muted/30 p-3">
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
        ) : null}
      </div>
    </article>
  );
}
