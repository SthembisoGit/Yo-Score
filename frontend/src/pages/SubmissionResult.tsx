import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle, Clock, XCircle } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { submissionService, type SubmissionResult as SubmissionResultData } from '@/services/submissionService';
import { Button } from '@/components/ui/button';

const trustLevelClass: Record<'Low' | 'Medium' | 'High', string> = {
  Low: 'text-red-600',
  Medium: 'text-amber-600',
  High: 'text-green-600'
};

export default function SubmissionResult() {
  const { id } = useParams<{ id: string }>();
  const [submission, setSubmission] = useState<SubmissionResultData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadSubmission = async () => {
      if (!id) {
        setLoading(false);
        setError('Missing submission id');
        return;
      }

      try {
        const result = await submissionService.getSubmissionResult(id);
        setSubmission(result);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load submission';
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    void loadSubmission();
  }, [id]);

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

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Submission Results</h1>
          <p className="text-muted-foreground">
            {submission.challenge_title}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-card border border-border rounded-xl p-6">
              <h2 className="text-xl font-semibold mb-4">Score</h2>
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-5xl font-bold">{submission.score ?? 0}</p>
                  <p className="text-muted-foreground">Submission score</p>
                </div>
                <div className={`text-2xl font-semibold ${trustLevelClass[submission.trust_level]}`}>
                  {submission.trust_level}
                </div>
              </div>
            </div>

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
                    <div key={`${violation.type}-${index}`} className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
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
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-card border border-border rounded-xl p-6">
              <h3 className="text-lg font-semibold mb-4">Submission Details</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <span className="font-medium capitalize">{submission.status}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Submitted</span>
                  <span className="font-medium">{new Date(submission.submitted_at).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Submission ID</span>
                  <span className="font-mono text-xs">{submission.submission_id.slice(0, 8)}...</span>
                </div>
              </div>
            </div>

            <div className="bg-card border border-border rounded-xl p-6 space-y-3">
              <Link to="/challenges" className="block">
                <Button className="w-full">Take Another Challenge</Button>
              </Link>
              <Link to={`/challenges/${submission.challenge_id}`} className="block">
                <Button variant="outline" className="w-full">Retry This Challenge</Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
