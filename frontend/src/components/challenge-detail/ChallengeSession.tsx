import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, Camera, FileText, Loader2, Mic, Shield, Sparkles } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { CodeEditor } from '@/components/CodeEditor';
import {
  challengeService,
  type Challenge,
  type ChallengeDocs,
  type CoachHintResponse,
  type RunCodeResponse,
} from '@/services/challengeService';
import { proctoringService } from '@/services/proctoring.service';
import { DescriptionPanel } from './DescriptionPanel';
import { LanguageSelector } from './LanguageSelector';
import { ReferenceDocsPanel } from './ReferenceDocsPanel';
import { normalizeLanguageCode, type SupportedLanguageCode } from '@/constants/languages';

interface ChallengeSessionProps {
  challenge: Challenge;
  referenceDocs: ChallengeDocs[];
  docsError?: string | null;
  onRetryDocs?: (() => void) | undefined;
  selectedLanguage: string;
  availableLanguages: string[];
  onLanguageChange: (language: string) => void;
  challengeId: string;
  sessionId?: string | null;
  onViolation?: (type: string, data: unknown) => void;
  violationCount?: number;
  isSessionPaused?: boolean;
  pauseReason?: string;
  deadlineAt?: string | null;
  durationSeconds?: number;
}

const AUTO_SAVE_INTERVAL_MS = 3000;
const DEFAULT_HINT_NOTICE =
  'AI Coach gives concepts and short examples only. Full solutions are blocked.';

const isCodePlaceholder = (value: string): boolean => {
  const text = value.trim();
  return (
    text.length === 0 ||
    text === '// Write your solution here' ||
    text === '# Write your solution here'
  );
};

const formatRemaining = (seconds: number): string => {
  const safe = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

const mapToSubmissionLanguage = (language: string): SupportedLanguageCode =>
  normalizeLanguageCode(language);

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
};

export const ChallengeSession = ({
  challenge,
  referenceDocs,
  docsError = null,
  onRetryDocs,
  selectedLanguage,
  availableLanguages,
  onLanguageChange,
  challengeId,
  sessionId,
  violationCount: propViolationCount = 0,
  isSessionPaused = false,
  pauseReason = '',
  deadlineAt = null,
  durationSeconds = 0,
}: ChallengeSessionProps) => {
  const navigate = useNavigate();
  const [showDocs, setShowDocs] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [code, setCode] = useState<string>('// Write your solution here\n');
  const [proctoringReady, setProctoringReady] = useState(false);
  const [violationCount, setViolationCount] = useState(propViolationCount);
  const [isSessionEnded, setIsSessionEnded] = useState(false);
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(durationSeconds || 0);
  const [timeExpired, setTimeExpired] = useState(false);
  const [pendingReconnectSubmit, setPendingReconnectSubmit] = useState(false);
  const [coachHints, setCoachHints] = useState<CoachHintResponse[]>([]);
  const [isLoadingHint, setIsLoadingHint] = useState(false);
  const [hintError, setHintError] = useState<string | null>(null);

  const expiryHandledRef = useRef(false);

  const draftKey = useMemo(() => {
    if (!sessionId) return null;
    return `yoscore:draft:${sessionId}:${challengeId}`;
  }, [challengeId, sessionId]);

  const templates: Record<SupportedLanguageCode, string> = useMemo(() => {
    const defaults: Record<SupportedLanguageCode, string> = {
      javascript: `function solve(input) {\n  // parse input and return output\n  return input.trim();\n}\n\nconst fs = require('fs');\nconst input = fs.readFileSync(0, 'utf8');\nprocess.stdout.write(String(solve(input)));`,
      python: `def solve(input_data):\n    # parse input and return output\n    return input_data.strip()\n\nif __name__ == "__main__":\n    import sys\n    data = sys.stdin.read()\n    print(solve(data))`,
      java: `import java.io.*;\n\npublic class Main {\n    static String solve(String input) {\n        // parse input and return output\n        return input.trim();\n    }\n\n    public static void main(String[] args) throws Exception {\n        String input = new String(System.in.readAllBytes());\n        System.out.print(solve(input));\n    }\n}`,
      cpp: `#include <bits/stdc++.h>\nusing namespace std;\n\nstring solve(const string& input) {\n    // parse input and return output\n    return input;\n}\n\nint main() {\n    ios::sync_with_stdio(false);\n    cin.tie(nullptr);\n    string input((istreambuf_iterator<char>(cin)), istreambuf_iterator<char>());\n    cout << solve(input);\n    return 0;\n}`,
      go: `package main\n\nimport (\n    "fmt"\n    "io"\n    "os"\n)\n\nfunc solve(input string) string {\n    // parse input and return output\n    return input\n}\n\nfunc main() {\n    data, _ := io.ReadAll(os.Stdin)\n    fmt.Print(solve(string(data)))\n}`,
      csharp: `using System;\nusing System.IO;\n\npublic class Program\n{\n    static string Solve(string input)\n    {\n        // parse input and return output\n        return input.Trim();\n    }\n\n    public static void Main()\n    {\n        string input = Console.In.ReadToEnd();\n        Console.Write(Solve(input));\n    }\n}`,
    };

    if (!challenge.starter_templates) return defaults;
    return {
      ...defaults,
      ...challenge.starter_templates,
    };
  }, [challenge.starter_templates]);

  const canRequestHint = coachHints.length < 3 && Boolean(sessionId) && !isSessionEnded;
  const readOnlyEditor = isSubmitting || isSessionEnded || isSessionPaused || timeExpired;
  const [lastClipboardWarningAt, setLastClipboardWarningAt] = useState<number>(0);

  const loadDraft = useCallback(() => {
    if (!draftKey) return;
    const raw = localStorage.getItem(draftKey);
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw) as { code?: string; language?: string };
      if (typeof parsed.code === 'string' && parsed.code.trim().length > 0) {
        setCode(parsed.code);
      }
      if (typeof parsed.language === 'string' && parsed.language !== selectedLanguage) {
        onLanguageChange(parsed.language);
      }
    } catch {
      // ignore corrupted local draft payload
    }
  }, [draftKey, onLanguageChange, selectedLanguage]);

  const persistDraft = useCallback(() => {
    if (!draftKey) return;
    localStorage.setItem(
      draftKey,
      JSON.stringify({
        code,
        language: selectedLanguage,
        updatedAt: new Date().toISOString(),
      }),
    );
  }, [code, draftKey, selectedLanguage]);

  const clearDraft = useCallback(() => {
    if (!draftKey) return;
    localStorage.removeItem(draftKey);
  }, [draftKey]);

  const handleSubmit = useCallback(
    async (auto = false) => {
      if (isSubmitting || isSessionEnded) return;

      if (!isOnline) {
        setSubmissionError('You are offline. Submission will continue when connection is restored.');
        setPendingReconnectSubmit(true);
        return;
      }

      if (isSessionPaused) {
        setSubmissionError(
          'Session is paused. Re-enable camera, microphone, and audio to continue.',
        );
        return;
      }

      if (!selectedLanguage) {
        setSubmissionError('Please select a programming language before submitting.');
        return;
      }

      if (!auto && isCodePlaceholder(code)) {
        setSubmissionError('Please write your solution before submitting.');
        return;
      }

      setIsSubmitting(true);
      setSubmissionError(null);

      try {
        const submission = await challengeService.submitChallenge(
          challengeId,
          code,
          mapToSubmissionLanguage(selectedLanguage),
          sessionId || undefined,
        );

        if (sessionId && proctoringReady) {
          try {
            await proctoringService.endSession(sessionId, submission.submission_id);
          } catch (error) {
            console.error('Failed to end proctoring session:', error);
          }
        }

        clearDraft();
        setIsSessionEnded(true);
        setPendingReconnectSubmit(false);
        toast.success('Challenge submitted successfully.');

        setTimeout(() => {
          navigate(`/submissions/${submission.submission_id}`);
        }, 1200);
      } catch (err: unknown) {
        const errorMessage = getErrorMessage(err, 'Failed to submit challenge.');
        setSubmissionError(errorMessage);
        toast.error(errorMessage);
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      challengeId,
      clearDraft,
      code,
      isOnline,
      isSessionEnded,
      isSessionPaused,
      isSubmitting,
      navigate,
      proctoringReady,
      selectedLanguage,
      sessionId,
    ],
  );

  const handleRequestHint = useCallback(async () => {
    if (!sessionId) {
      setHintError('AI Coach is available after proctoring starts.');
      return;
    }

    if (coachHints.length >= 3) {
      setHintError('AI hint limit reached for this challenge.');
      return;
    }

    setIsLoadingHint(true);
    setHintError(null);
    try {
      const nextHint = await challengeService.getCoachHint({
        challengeId,
        sessionId,
        language: mapToSubmissionLanguage(selectedLanguage),
        code,
        hintIndex: coachHints.length + 1,
      });
      setCoachHints((prev) => [...prev, nextHint]);
    } catch (error: unknown) {
      const message = getErrorMessage(error, 'Failed to request AI hint.');
      setHintError(message);
      toast.error(message);
    } finally {
      setIsLoadingHint(false);
    }
  }, [challengeId, code, coachHints.length, selectedLanguage, sessionId]);

  const handleEndSessionEarly = useCallback(async () => {
    if (!sessionId || !proctoringReady || isSessionEnded) return;

    if (
      window.confirm(
        'Are you sure you want to end the session early? This may affect your trust score.',
      )
    ) {
      try {
        await proctoringService.endSession(sessionId);
        setIsSessionEnded(true);
        toast('Session ended early.');
      } catch (error) {
        console.error('Failed to end session:', error);
        toast.error('Failed to end session');
      }
    }
  }, [isSessionEnded, proctoringReady, sessionId]);

  useEffect(() => {
    const nextTemplate = templates[mapToSubmissionLanguage(selectedLanguage)];
    if (nextTemplate) {
      setCode(nextTemplate);
    }
  }, [selectedLanguage, templates]);

  useEffect(() => {
    if (sessionId) {
      setProctoringReady(true);
      toast.success('Proctoring session is active.');
      loadDraft();
    }
  }, [loadDraft, sessionId]);

  useEffect(() => {
    setViolationCount(propViolationCount);
    if (propViolationCount >= 3) {
      toast(`Multiple proctoring violations (${propViolationCount}). Trust score may be affected.`, {
        duration: 5000,
      });
    }
  }, [propViolationCount]);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (durationSeconds > 0 && !deadlineAt) {
      setRemainingSeconds(durationSeconds);
    }
  }, [deadlineAt, durationSeconds]);

  useEffect(() => {
    if (!deadlineAt || isSessionEnded) return;

    const updateRemaining = () => {
      const endMs = new Date(deadlineAt).getTime();
      const now = Date.now();
      const nextRemaining = Math.max(0, Math.floor((endMs - now) / 1000));
      setRemainingSeconds(nextRemaining);

      if (nextRemaining <= 0 && !expiryHandledRef.current) {
        expiryHandledRef.current = true;
        setTimeExpired(true);
        if (!isOnline) {
          setPendingReconnectSubmit(true);
          setSubmissionError(
            'Time is up while offline. Editor is locked and auto-submit will run when connection returns.',
          );
        } else {
          void handleSubmit(true);
        }
      }
    };

    updateRemaining();
    const timer = window.setInterval(updateRemaining, 1000);
    return () => window.clearInterval(timer);
  }, [deadlineAt, handleSubmit, isOnline, isSessionEnded]);

  useEffect(() => {
    if (!draftKey || isSessionEnded || readOnlyEditor) return;
    const timer = window.setInterval(persistDraft, AUTO_SAVE_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [draftKey, isSessionEnded, persistDraft, readOnlyEditor]);

  useEffect(() => {
    if (!isOnline || !pendingReconnectSubmit || isSubmitting || isSessionEnded) return;
    void handleSubmit(true);
  }, [handleSubmit, isOnline, isSessionEnded, isSubmitting, pendingReconnectSubmit]);

  useEffect(() => {
    if (!timeExpired && !isSessionEnded) return;
    setShowDocs(false);
  }, [isSessionEnded, timeExpired]);

  const handleClipboardBlocked = useCallback(() => {
    const now = Date.now();
    if (now - lastClipboardWarningAt < 1200) return;
    setLastClipboardWarningAt(now);
    toast.error('Copy and paste are disabled during challenge solving.');
  }, [lastClipboardWarningAt]);

  return (
    <div className="flex flex-col lg:flex-row gap-6 min-h-[680px] lg:h-[calc(100vh-140px)]">
      <div className="lg:w-1/3 flex flex-col">
        <div className="bg-card border border-border rounded-xl overflow-hidden flex-1 flex flex-col shadow-sm">
          <div className="flex border-b border-border">
            <button
              onClick={() => setShowDocs(false)}
              className={`flex-1 px-4 py-3.5 text-sm font-medium transition-colors ${
                !showDocs
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-muted/50 text-muted-foreground hover:text-foreground'
              }`}
            >
              Description
            </button>
            <button
              onClick={() => setShowDocs(true)}
              className={`flex-1 px-4 py-3.5 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                showDocs
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-muted/50 text-muted-foreground hover:text-foreground'
              }`}
            >
              <FileText className="h-4 w-4" />
              Reference
              {referenceDocs.length > 0 && (
                <span className="bg-primary/20 text-primary text-xs px-1.5 py-0.5 rounded">
                  {referenceDocs.length}
                </span>
              )}
              {docsError && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-destructive/20 text-destructive">
                  unavailable
                </span>
              )}
            </button>
          </div>

          <div className="flex-1 overflow-auto p-4">
            {!showDocs ? (
              <div className="space-y-6">
                <DescriptionPanel challenge={challenge} compact />

                {sessionId && (
                  <div className="pt-4 border-t border-border">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4 text-primary" />
                        <h4 className="font-medium text-sm">Proctoring Status</h4>
                      </div>
                      <span
                        className={`text-xs px-2 py-1 rounded-full ${
                          proctoringReady
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                            : 'bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-400'
                        }`}
                      >
                        {proctoringReady ? 'Active' : 'Starting...'}
                      </span>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <Camera className="h-3 w-3" />
                          <span>Camera</span>
                        </div>
                        <span className={proctoringReady ? 'text-green-600' : 'text-muted-foreground'}>
                          {proctoringReady ? 'Monitoring' : 'Initializing'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <Mic className="h-3 w-3" />
                          <span>Microphone</span>
                        </div>
                        <span className={proctoringReady ? 'text-green-600' : 'text-muted-foreground'}>
                          {proctoringReady ? 'Monitoring' : 'Initializing'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <AlertCircle className="h-3 w-3" />
                          <span>Violations</span>
                        </div>
                        <span className={violationCount > 0 ? 'text-amber-600' : 'text-green-600'}>
                          {violationCount} detected
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={handleEndSessionEarly}
                      className="mt-3 w-full text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      End session early
                    </button>
                  </div>
                )}

                <div className="pt-4 border-t border-border">
                  <LanguageSelector
                    selectedLanguage={selectedLanguage}
                    onLanguageChange={onLanguageChange}
                    availableLanguages={availableLanguages}
                    label="Solution Language"
                    size="sm"
                  />
                </div>

                <div className="pt-4 border-t border-border">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium text-sm flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-primary" />
                      AI Coach
                    </h4>
                    <span className="text-xs text-muted-foreground">{coachHints.length}/3 used</span>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">{DEFAULT_HINT_NOTICE}</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!canRequestHint || isLoadingHint || isSubmitting || isSessionPaused}
                    onClick={() => void handleRequestHint()}
                  >
                    {isLoadingHint ? 'Requesting...' : 'Get AI Hint'}
                  </Button>
                  {hintError && <p className="text-xs text-destructive mt-2">{hintError}</p>}
                  {coachHints.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {coachHints.map((hint) => (
                        <div key={hint.hint_index} className="rounded-md border border-border p-2 bg-muted/30">
                          <p className="text-xs font-medium mb-1">Hint {hint.hint_index}</p>
                          <p className="text-xs text-muted-foreground">{hint.hint}</p>
                          {hint.snippet && (
                            <pre className="mt-2 p-2 rounded bg-background border text-[11px] overflow-x-auto">
                              <code>{hint.snippet}</code>
                            </pre>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <ReferenceDocsPanel docs={referenceDocs} error={docsError} onRetry={onRetryDocs} />
            )}
          </div>
        </div>
      </div>

      <div className="lg:w-2/3 flex flex-col gap-4">
        {submissionError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{submissionError}</AlertDescription>
          </Alert>
        )}

        {!isOnline && (
          <Alert className="bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800">
            <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <AlertDescription className="text-amber-800 dark:text-amber-300">
              Network offline. Timer continues and your code is saved locally every few seconds.
            </AlertDescription>
          </Alert>
        )}

        <Alert className={timeExpired ? 'border-red-200 bg-red-50 dark:bg-red-950/20' : ''}>
          <AlertCircle className={timeExpired ? 'h-4 w-4 text-red-600' : 'h-4 w-4'} />
          <AlertDescription className="flex items-center justify-between">
            <span>
              Challenge Timer
              {timeExpired ? ': Time expired.' : ':'}
            </span>
            <strong className={timeExpired ? 'text-red-600' : ''}>{formatRemaining(remainingSeconds)}</strong>
          </AlertDescription>
        </Alert>

        {!proctoringReady && sessionId && (
          <Alert className="bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800">
            <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <AlertDescription className="text-amber-800 dark:text-amber-300">
              Proctoring is initializing. Ensure camera and microphone are enabled.
            </AlertDescription>
          </Alert>
        )}

        {isSessionPaused && (
          <Alert className="bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800">
            <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
            <AlertDescription className="text-red-800 dark:text-red-300">
              Session paused by proctoring.{' '}
              {pauseReason || 'Restore required devices from the proctoring modal to continue.'}
            </AlertDescription>
          </Alert>
        )}

        {timeExpired && pendingReconnectSubmit && (
          <Alert className="bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800">
            <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
            <AlertDescription className="text-red-800 dark:text-red-300">
              Time expired while offline. Editor is locked and auto-submit will execute on reconnect.
            </AlertDescription>
          </Alert>
        )}

        <div className="bg-card border border-border rounded-xl overflow-hidden flex-1 shadow-sm">
          <CodeEditor
            language={mapToSubmissionLanguage(selectedLanguage)}
            value={code}
            onChange={setCode}
            onRun={async ({ language, code: sourceCode, stdin }): Promise<RunCodeResponse> =>
              challengeService.runCode({
                language,
                code: sourceCode,
                stdin,
                challenge_id: challengeId,
              })
            }
            className="h-full"
            readOnly={readOnlyEditor}
            disableClipboardActions
            onClipboardBlocked={handleClipboardBlocked}
          />
        </div>

        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <p className="text-sm text-muted-foreground">Writing solution in {selectedLanguage}</p>
            {violationCount > 0 && (
              <div className="flex items-center gap-1 text-sm">
                <Shield className="h-3 w-3 text-amber-600" />
                <span className="text-amber-600">{violationCount} violation(s)</span>
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={handleEndSessionEarly}
              disabled={!sessionId || isSessionEnded || isSubmitting || isSessionPaused}
              className="px-4"
            >
              End Session
            </Button>

            <Button
              onClick={() => void handleSubmit(false)}
              disabled={
                isSubmitting ||
                !selectedLanguage ||
                isSessionEnded ||
                isSessionPaused ||
                !isOnline ||
                timeExpired
              }
              className="px-8"
              size="lg"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Submitting...
                </>
              ) : (
                'Submit Solution'
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
