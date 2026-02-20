import { useCallback, useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle, Clock, XCircle } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import {
  submissionService,
  type SubmissionResult as SubmissionResultData,
} from '@/services/submissionService';
import { Button } from '@/components/ui/button';
import { getCachedSubmissionSnapshot } from '@/services/pendingSubmissionStore';

const trustLevelClass: Record<'Low' | 'Medium' | 'High', string> = {
  Low: 'text-red-600',
  Medium: 'text-amber-600',
  High: 'text-green-600',
};

export default function SubmissionResult() {
  const { id } = useParams<{ id: string }>();
  const [submission, setSubmission] = useState<SubmissionResultData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [pollTimedOut, setPollTimedOut] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const [pollNotice, setPollNotice] = useState<string | null>(null);

  const loadSubmission = useCallback(
    async (enablePolling: boolean) => {
      if (!id) {
        setLoading(false);
        setError('Missing submission id');
        return;
      }

      const cached = getCachedSubmissionSnapshot<SubmissionResultData>(id);
      if (cached) {
        setSubmission(cached);
        setLoading(false);
        setError(null);
      }

      let initial: SubmissionResultData | null = null;
      try {
        setError(null);
        initial = await submissionService.getSubmissionResult(id);
        setSubmission(initial);
        setLastUpdatedAt(new Date().toISOString());
        setLoading(false);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load submission';
        if (!cached) {
          setError(message);
          setLoading(false);
          setIsPolling(false);
          return;
        }
        setPollNotice('Using cached result while waiting for network recovery.');
      }

      const seed = initial ?? cached;
      if (!seed) return;

      const isPending =
        seed.status === 'pending' ||
        seed.judge_status === 'queued' ||
        seed.judge_status === 'running';

      if (!enablePolling || !isPending) {
        setIsPolling(false);
        return;
      }

      setIsPolling(true);
      setPollTimedOut(false);
      setPollNotice(null);

      let latest = seed;
      for (let attempt = 0; attempt < 180; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        try {
          latest = await submissionService.getSubmissionResult(id);
          setSubmission(latest);
          setLastUpdatedAt(new Date().toISOString());
          setPollNotice(null);
        } catch {
          setPollNotice(
            navigator.onLine
              ? 'Temporary network/server issue. Retrying...'
              : 'You are offline. Waiting to reconnect and continue checking.',
          );
          continue;
        }

        const stillPending =
          latest.status === 'pending' ||
          latest.judge_status === 'queued' ||
          latest.judge_status === 'running';
        if (!stillPending) {
          setIsPolling(false);
          return;
        }
      }

      setPollTimedOut(true);
      setIsPolling(false);
    },
    [id],
  );

  useEffect(() => {
    setLoading(true);
    void loadSubmission(true);
  }, [loadSubmission]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <Clock className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
            <p>Loading submission results...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !submission) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <XCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Submission not found</h3>
            <p className="text-muted-foreground mb-4">{error}</p>
            <Link to="/challenges">
              <Button>Back to Challenges</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const scoreBreakdown = submission.score_breakdown;
  const components = scoreBreakdown?.components ?? {
    correctness: 0,
    efficiency: 0,
    style: 0,
    skill: 0,
    behavior: 0,
    work_experience: 0,
  };
  const totalPenalty =
    scoreBreakdown?.penalty ??
    submission.penalties?.total ??
    submission.violations.reduce((sum, violation) => sum + Number(violation.penalty ?? 0), 0);
  const violationCount = submission.penalties?.violation_count ?? submission.violations.length;

  const isJudgePending =
    submission.status === 'pending' ||
    submission.judge_status === 'queued' ||
    submission.judge_status === 'running';

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Submission Results</h1>
          <p className="text-muted-foreground">{submission.challenge_title}</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {(isJudgePending || pollTimedOut) && (
              <div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium">
                    {submission.judge_status === 'queued'
                      ? 'Submission queued for judging'
                      : submission.judge_status === 'running'
                        ? 'Judge is evaluating your code'
                        : 'Submission is still processing'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {pollTimedOut
                      ? 'This is taking longer than expected. You can refresh status manually.'
                      : 'Status updates automatically while this page is open.'}
                  </p>
                  {lastUpdatedAt && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Last checked: {new Date(lastUpdatedAt).toLocaleTimeString()}
                    </p>
                  )}
                  {pollNotice && <p className="text-xs text-muted-foreground mt-1">{pollNotice}</p>}
                </div>
                <Button
                  variant="outline"
                  onClick={() => void loadSubmission(false)}
                  disabled={isPolling}
                >
                  {isPolling ? 'Checking...' : 'Refresh Status'}
                </Button>
              </div>
            )}

            <div className="bg-card border border-border rounded-xl p-6">
              <h2 className="text-xl font-semibold mb-4">Score</h2>
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-5xl font-bold">{submission.score ?? 0}</p>
                  <p className="text-muted-foreground">
                    {isJudgePending ? 'Scoring in progress' : 'Submission score'}
                  </p>
                </div>
                {!isJudgePending && submission.trust_level && (
                  <div className={`text-2xl font-semibold ${trustLevelClass[submission.trust_level]}`}>
                    {submission.trust_level}
                  </div>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-3">
                Judge status: <span className="font-medium capitalize">{submission.judge_status}</span>
              </p>
              {submission.judge_error && (
                <p className="text-sm text-destructive mt-2">{submission.judge_error}</p>
              )}
              {typeof submission.total_score === 'number' && (
                <p className="text-sm text-muted-foreground mt-3">
                  Overall trust score:{' '}
                  <span className="font-medium text-foreground">{submission.total_score}</span>
                </p>
              )}
            </div>

            <div className="bg-card border border-border rounded-xl p-6">
              <h3 className="text-lg font-semibold mb-4">Score Breakdown</h3>
              {scoreBreakdown ? (
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Correctness</span>
                    <span className="font-medium">{components.correctness}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Efficiency</span>
                    <span className="font-medium">{components.efficiency}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Style</span>
                    <span className="font-medium">{components.style}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Skill component</span>
                    <span className="font-medium">{components.skill}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Behavior component</span>
                    <span className="font-medium">{components.behavior}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Work experience component</span>
                    <span className="font-medium">{components.work_experience}</span>
                  </div>
                  <div className="flex justify-between border-t border-border pt-3">
                    <span className="text-muted-foreground">Penalty applied</span>
                    <span className="font-medium">-{totalPenalty}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Scoring version: {scoreBreakdown.scoring_version}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Detailed breakdown is unavailable for this submission.
                </p>
              )}
            </div>

            {submission.practice_feedback && submission.practice_feedback.length > 0 && (
              <div className="bg-card border border-border rounded-xl p-6">
                <h3 className="text-lg font-semibold mb-4">What To Practice Next</h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  {submission.practice_feedback.map((item, index) => (
                    <li key={`${index}-${item}`} className="rounded-md border border-border p-2">
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {submission.tests_summary && (
              <div className="bg-card border border-border rounded-xl p-6">
                <h3 className="text-lg font-semibold mb-4">Judge Summary</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tests passed</span>
                    <span className="font-medium">
                      {submission.tests_summary.passed}/{submission.tests_summary.total}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Runtime</span>
                    <span className="font-medium">{submission.tests_summary.runtime_ms} ms</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Memory</span>
                    <span className="font-medium">{submission.tests_summary.memory_mb} MB</span>
                  </div>
                </div>
              </div>
            )}

            <div className="bg-card border border-border rounded-xl p-6">
              <h3 className="text-lg font-semibold mb-4">Proctoring Violations</h3>

              {submission.violations.length === 0 ? (
                <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
                  <CheckCircle className="h-5 w-5" />
                  <span>No violations recorded.</span>
                </div>
              ) : (
                <div className="space-y-3">
                  {submission.violations.map((violation, index) => (
                    <div
                      key={`${violation.type}-${index}`}
                      className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-amber-600" />
                          <span className="font-medium">{violation.type.replace(/_/g, ' ')}</span>
                        </div>
                        <span className="text-sm font-medium">-{violation.penalty}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(violation.timestamp).toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-4 pt-4 border-t border-border text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Violation count</span>
                  <span className="font-medium">{violationCount}</span>
                </div>
                <div className="flex justify-between mt-2">
                  <span className="text-muted-foreground">Total penalty</span>
                  <span className="font-medium">-{totalPenalty}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-card border border-border rounded-xl p-6">
              <h3 className="text-lg font-semibold mb-4">Submission Details</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <span className="font-medium capitalize">
                    {submission.status} / {submission.judge_status}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Language</span>
                  <span className="font-medium capitalize">{submission.language}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Submitted</span>
                  <span className="font-medium">{new Date(submission.submitted_at).toLocaleString()}</span>
                </div>
                {submission.run_summary?.run_id && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Run ID</span>
                    <span className="font-mono text-xs">{submission.run_summary.run_id.slice(0, 8)}...</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Submission ID</span>
                  <span className="font-mono text-xs">{submission.submission_id.slice(0, 8)}...</span>
                </div>
                {submission.score_breakdown?.scoring_version && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Scoring version</span>
                    <span className="font-medium">{submission.score_breakdown.scoring_version}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-card border border-border rounded-xl p-6 space-y-3">
              <Link to="/challenges" className="block">
                <Button className="w-full">Take Another Challenge</Button>
              </Link>
              <Link to={`/challenges/${submission.challenge_id}`} className="block">
                <Button variant="outline" className="w-full">
                  Retry This Challenge
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
