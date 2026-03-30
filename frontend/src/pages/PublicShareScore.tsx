import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowUpRight, Download, ExternalLink, Link2, MapPin } from 'lucide-react';

import { Loader } from '@/components/Loader';
import { ScoreCard } from '@/components/ScoreCard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { shareScoreService, type PublicShareScoreData } from '@/services/shareScoreService';

const formatDate = (value: string | null) => {
  if (!value) return 'Unavailable';
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

const formatMonthlyProgress = (value: number) => {
  if (value > 0) return `+${value} pts`;
  if (value < 0) return `${value} pts`;
  return '0 pts';
};

export default function PublicShareScore() {
  const { token } = useParams<{ token: string }>();
  const [scoreSheet, setScoreSheet] = useState<PublicShareScoreData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!token) {
        setErrorMessage('This shared score link is invalid.');
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setErrorMessage(null);

      try {
        const response = await shareScoreService.getPublicShareScore(token);
        if (cancelled) return;
        setScoreSheet(response);
      } catch (error) {
        if (cancelled) return;
        const message =
          error instanceof Error && error.message.trim()
            ? error.message
            : 'This shared score is unavailable.';
        setErrorMessage(message);
        setScoreSheet(null);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    const previousTitle = document.title;
    const existing = document.querySelector('meta[name="robots"]') as HTMLMetaElement | null;
    const previousRobots = existing?.content ?? '';
    const meta = existing ?? document.createElement('meta');

    if (!existing) {
      meta.setAttribute('name', 'robots');
      document.head.appendChild(meta);
    }

    meta.setAttribute('content', 'noindex, nofollow');
    document.title = scoreSheet ? `${scoreSheet.name} | YoScore Shared Score` : 'YoScore Shared Score';

    return () => {
      document.title = previousTitle;
      if (existing) {
        existing.setAttribute('content', previousRobots);
      } else {
        meta.remove();
      }
    };
  }, [scoreSheet]);

  const categoryEntries = useMemo(
    () =>
      Object.entries(scoreSheet?.category_scores ?? {}).sort((a, b) => Number(b[1]) - Number(a[1])),
    [scoreSheet],
  );

  const initials = useMemo(() => {
    if (!scoreSheet?.name) return 'YS';
    return scoreSheet.name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('');
  }, [scoreSheet?.name]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-100 text-slate-900 flex items-center justify-center px-4">
        <div className="rounded-2xl border border-slate-200 bg-white px-8 py-10 shadow-sm text-center">
          <Loader className="mx-auto mb-4" />
          <p className="text-sm text-slate-600">Loading shared score sheet...</p>
        </div>
      </div>
    );
  }

  if (!scoreSheet) {
    return (
      <div className="min-h-screen bg-slate-100 text-slate-900 flex items-center justify-center px-4">
        <div className="max-w-xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 mb-3">
            Shared Score
          </p>
          <h1 className="text-3xl font-semibold mb-3">This score sheet is unavailable</h1>
          <p className="text-slate-600 mb-6">
            {errorMessage || 'The link may be invalid, disabled, or expired.'}
          </p>
          <Link to="/" className="inline-flex">
            <Button>Back to YoScore</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 py-10 px-4">
      <style>{`
        @media print {
          body {
            background: #ffffff !important;
          }

          .share-screen-only {
            display: none !important;
          }

          .share-sheet {
            box-shadow: none !important;
            border: 0 !important;
            margin: 0 !important;
            max-width: none !important;
          }
        }
      `}</style>

      <main className="share-sheet mx-auto max-w-5xl rounded-3xl border border-slate-200 bg-white shadow-xl overflow-hidden">
        <div className="border-b border-slate-200 bg-gradient-to-r from-emerald-800 via-emerald-700 to-emerald-600 px-8 py-8 text-white">
          <div className="share-screen-only mb-6 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-100">
                YoScore Shared Score
              </p>
              <p className="mt-1 text-sm text-emerald-50/90">
                Recruiter-friendly view. Anyone with this link can read and print it.
              </p>
            </div>
            <Button variant="secondary" className="gap-2" onClick={() => window.print()}>
              <Download className="h-4 w-4" />
              Print / Save as PDF
            </Button>
          </div>

          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex items-start gap-5">
              {scoreSheet.avatar_url ? (
                <img
                  src={scoreSheet.avatar_url}
                  alt={`${scoreSheet.name} avatar`}
                  className="h-20 w-20 rounded-2xl border border-white/20 object-cover"
                />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-white/20 bg-white/10 text-2xl font-semibold">
                  {initials}
                </div>
              )}

              <div>
                <h1 className="text-3xl font-semibold">{scoreSheet.name}</h1>
                {scoreSheet.headline ? (
                  <p className="mt-2 text-base text-emerald-50">{scoreSheet.headline}</p>
                ) : null}
                {scoreSheet.location ? (
                  <div className="mt-3 inline-flex items-center gap-2 text-sm text-emerald-50/90">
                    <MapPin className="h-4 w-4" />
                    <span>{scoreSheet.location}</span>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Badge className="bg-white/15 text-white hover:bg-white/15">
                Trust {scoreSheet.trust_level}
              </Badge>
              <Badge className="bg-white/15 text-white hover:bg-white/15">
                {scoreSheet.seniority_band}
              </Badge>
              <Badge className="bg-white/15 text-white hover:bg-white/15">
                Monthly {formatMonthlyProgress(scoreSheet.monthly_progress)}
              </Badge>
            </div>
          </div>
        </div>

        <div className="space-y-8 px-8 py-8">
          <section className="grid gap-6 lg:grid-cols-[280px,1fr]">
            <ScoreCard
              title="Total Trust Score"
              score={scoreSheet.total_score}
              trustLevel={scoreSheet.trust_level}
              size="hero"
              colorVariant="primary"
              className="border border-slate-200 shadow-none"
            />

            <div className="grid gap-4 sm:grid-cols-3">
              <SummaryStat
                label="Seniority"
                value={scoreSheet.seniority_band}
                note="Current matched band"
              />
              <SummaryStat
                label="Monthly Progress"
                value={formatMonthlyProgress(scoreSheet.monthly_progress)}
                note="Current month vs previous"
              />
              <SummaryStat
                label="Last Updated"
                value={formatDate(scoreSheet.last_updated_at)}
                note="Latest public score refresh"
              />
            </div>
          </section>

          <section className="grid gap-8 lg:grid-cols-[1.4fr,1fr]">
            <div className="rounded-2xl border border-slate-200 p-6">
              <div className="mb-5 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold">Category Breakdown</h2>
                  <p className="text-sm text-slate-600">
                    Strongest categories based on graded challenge performance.
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                {categoryEntries.length === 0 ? (
                  <p className="text-sm text-slate-500">No category scores available yet.</p>
                ) : (
                  categoryEntries.map(([category, value]) => (
                    <div key={category}>
                      <div className="mb-2 flex items-center justify-between text-sm">
                        <span className="font-medium text-slate-800">{category}</span>
                        <span className="font-mono text-slate-600">{value}</span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-emerald-600 transition-all"
                          style={{ width: `${Math.max(0, Math.min(100, Number(value)))}%` }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 p-6">
              <h2 className="text-xl font-semibold">Public Links</h2>
              <p className="mt-1 text-sm text-slate-600">
                Optional links the developer chose to share publicly.
              </p>

              <div className="mt-5 space-y-3">
                {Object.entries(scoreSheet.public_links).length === 0 ? (
                  <p className="text-sm text-slate-500">No public links shared.</p>
                ) : (
                  Object.entries(scoreSheet.public_links).map(([key, value]) => (
                    <a
                      key={key}
                      href={value}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-800 hover:border-emerald-300 hover:bg-emerald-50"
                    >
                      <span className="flex items-center gap-2 capitalize">
                        <Link2 className="h-4 w-4 text-emerald-700" />
                        {key.replace('_url', '')}
                      </span>
                      <ExternalLink className="h-4 w-4 text-slate-500" />
                    </a>
                  ))
                )}
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 p-6">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold">Recent Graded Results</h2>
                <p className="text-sm text-slate-600">
                  Latest public challenge results included in this share link.
                </p>
              </div>
              <Badge variant="secondary">{scoreSheet.top_recent_results.length} shown</Badge>
            </div>

            {scoreSheet.top_recent_results.length === 0 ? (
              <p className="text-sm text-slate-500">No graded results available for public sharing yet.</p>
            ) : (
              <div className="space-y-4">
                {scoreSheet.top_recent_results.map((result) => (
                  <article
                    key={`${result.challenge_title}-${result.submitted_at}`}
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <h3 className="font-semibold text-slate-900">{result.challenge_title}</h3>
                        <p className="mt-1 text-sm text-slate-600">
                          {result.category} · {result.language}
                        </p>
                      </div>
                      <div className="text-left sm:text-right">
                        <p className="font-mono text-2xl font-semibold text-emerald-700">{result.score}</p>
                        <p className="text-xs uppercase tracking-wide text-slate-500">
                          scored on {formatDate(result.submitted_at)}
                        </p>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <div className="share-screen-only flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-sm text-slate-600">
            <p>This page is read-only and designed for browser sharing and printing.</p>
            <Link to="/" className="inline-flex items-center gap-2 font-medium text-emerald-700 hover:text-emerald-800">
              Open YoScore
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}

function SummaryStat({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-3 text-lg font-semibold text-slate-900">{value}</p>
      <p className="mt-2 text-sm text-slate-600">{note}</p>
    </div>
  );
}
