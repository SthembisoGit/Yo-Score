import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { CheckCircle, XCircle, Clock, AlertTriangle, BarChart, Shield } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { submissionService } from '@/services/submissionService';
import { Button } from '@/components/ui/button';

export default function SubmissionResult() {
  const { id } = useParams<{ id: string }>();
  const [submission, setSubmission] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      loadSubmission();
    }
  }, [id]);

  const loadSubmission = async () => {
    try {
      setLoading(true);
      const result = await submissionService.getSubmissionWithProctoring(id!);
      setSubmission(result);
    } catch (err: any) {
      setError(err.message || 'Failed to load submission');
    } finally {
      setLoading(false);
    }
  };

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
            <h3 className="text-lg font-semibold mb-2">Submission Not Found</h3>
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
      
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Submission Results</h1>
          <p className="text-muted-foreground">
            Submission ID: {submission.submission_id}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Score */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-card border border-border rounded-xl p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-semibold">Score Breakdown</h2>
                  <p className="text-muted-foreground">Your performance on this challenge</p>
                </div>
                <div className="text-right">
                  <div className="text-4xl font-bold">{submission.score}/100</div>
                  <div className="text-sm text-muted-foreground">Total Score</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-muted/50 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <BarChart className="h-4 w-4 text-primary" />
                    <span className="font-medium">Code Quality</span>
                  </div>
                  <div className="text-2xl font-bold">{(submission.score * 0.7).toFixed(1)}</div>
                  <div className="text-xs text-muted-foreground">70% of total score</div>
                </div>

                <div className="bg-muted/50 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Shield className="h-4 w-4 text-amber-600" />
                    <span className="font-medium">Proctoring</span>
                  </div>
                  <div className="text-2xl font-bold">{submission.proctoring_score}/100</div>
                  <div className="text-xs text-muted-foreground">30% of total score</div>
                </div>
              </div>
            </div>

            {/* Proctoring Violations */}
            {submission.violations.length > 0 && (
              <div className="bg-card border border-border rounded-xl p-6">
                <div className="flex items-center gap-2 mb-4">
                  <AlertTriangle className="h-5 w-5 text-amber-600" />
                  <h3 className="text-lg font-semibold">Proctoring Alerts</h3>
                  <span className="bg-amber-100 text-amber-800 text-xs px-2 py-1 rounded-full">
                    {submission.violations.length} violation(s)
                  </span>
                </div>

                <div className="space-y-3">
                  {submission.violations.map((violation: any, index: number) => (
                    <div key={index} className="flex items-start gap-3 p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg">
                      <div className="mt-0.5">
                        {violation.severity === 'high' ? (
                          <XCircle className="h-4 w-4 text-red-600" />
                        ) : violation.severity === 'medium' ? (
                          <AlertTriangle className="h-4 w-4 text-amber-600" />
                        ) : (
                          <AlertTriangle className="h-4 w-4 text-blue-600" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium">{violation.type.replace(/_/g, ' ')}</p>
                            <p className="text-sm text-muted-foreground">{violation.description}</p>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-medium">-{violation.penalty} pts</div>
                            <div className="text-xs text-muted-foreground">
                              {new Date(violation.timestamp).toLocaleTimeString()}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Column - Trust & Actions */}
          <div className="space-y-6">
            {/* Trust Level Card */}
            <div className="bg-card border border-border rounded-xl p-6">
              <h3 className="text-lg font-semibold mb-4">Trust Level</h3>
              <div className="text-center mb-4">
                <div className={`inline-flex items-center justify-center w-20 h-20 rounded-full mb-3 ${
                  submission.trust_level === 'High' ? 'bg-green-100 dark:bg-green-900/20' :
                  submission.trust_level === 'Medium' ? 'bg-amber-100 dark:bg-amber-900/20' :
                  'bg-red-100 dark:bg-red-900/20'
                }`}>
                  <Shield className={`h-10 w-10 ${
                    submission.trust_level === 'High' ? 'text-green-600 dark:text-green-400' :
                    submission.trust_level === 'Medium' ? 'text-amber-600 dark:text-amber-400' :
                    'text-red-600 dark:text-red-400'
                  }`} />
                </div>
                <div className={`text-2xl font-bold ${
                  submission.trust_level === 'High' ? 'text-green-600' :
                  submission.trust_level === 'Medium' ? 'text-amber-600' :
                  'text-red-600'
                }`}>
                  {submission.trust_level}
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Based on code quality and proctoring
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="bg-card border border-border rounded-xl p-6">
              <h3 className="text-lg font-semibold mb-4">Actions</h3>
              <div className="space-y-3">
                <Link to="/challenges" className="block">
                  <Button variant="outline" className="w-full">
                    Try Another Challenge
                  </Button>
                </Link>
                
                <Link to={`/challenges/${submission.challenge_id}`} className="block">
                  <Button className="w-full">
                    Retry This Challenge
                  </Button>
                </Link>
                
                <Button variant="ghost" className="w-full">
                  View Full Code
                </Button>
                
                <Button variant="ghost" className="w-full">
                  Download Submission
                </Button>
              </div>
            </div>

            {/* Submission Info */}
            <div className="bg-card border border-border rounded-xl p-6">
              <h3 className="text-lg font-semibold mb-4">Submission Details</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Submitted</span>
                  <span>{new Date(submission.submitted_at).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <span className={`px-2 py-1 rounded text-xs ${
                    submission.status === 'graded' ? 'bg-green-100 text-green-800' :
                    submission.status === 'pending' ? 'bg-amber-100 text-amber-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {submission.status}
                  </span>
                </div>
                {submission.evaluated_at && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Evaluated</span>
                    <span>{new Date(submission.evaluated_at).toLocaleString()}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}