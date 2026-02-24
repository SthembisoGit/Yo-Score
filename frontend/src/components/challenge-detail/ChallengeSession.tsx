import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Camera,
  FileText,
  Loader2,
  Mic,
  PanelLeftClose,
  PanelLeftOpen,
  Shield,
  Sparkles,
  WifiOff,
} from 'lucide-react';
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

type SessionRailTab = 'task' | 'assist' | 'integrity';
type SessionBannerState = 'info' | 'warning' | 'error' | 'success';

interface SessionBanner {
  key: string;
  state: SessionBannerState;
  message: string;
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

const sanitizeDurationSeconds = (rawSeconds: number | undefined, fallbackMinutes: number): number => {
  const fallbackSeconds = Math.max(300, Math.round(fallbackMinutes * 60));
  if (!Number.isFinite(rawSeconds) || (rawSeconds ?? 0) <= 0) {
    return fallbackSeconds;
  }
  let value = Number(rawSeconds);
  if (value > 300 * 60) {
    value = Math.round(value / 60);
  }
  return Math.min(300 * 60, Math.max(300, Math.round(value)));
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
  const [activeRailTab, setActiveRailTab] = useState<SessionRailTab>('task');
  const [isRailCollapsed, setIsRailCollapsed] = useState(false);
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

  const challengeDurationSeconds = useMemo(() => {
    const fallbackMinutes =
      challenge.difficulty === 'easy' ? 30 : challenge.difficulty === 'hard' ? 60 : 45;
    return sanitizeDurationSeconds(
      durationSeconds,
      Number(challenge.duration_minutes ?? fallbackMinutes),
    );
  }, [challenge.difficulty, challenge.duration_minutes, durationSeconds]);

  const canRequestHint = coachHints.length < 3 && Boolean(sessionId) && !isSessionEnded;
  const readOnlyEditor = isSubmitting || isSessionEnded || isSessionPaused || timeExpired;
  const [lastClipboardWarningAt, setLastClipboardWarningAt] = useState<number>(0);
  const sessionStateLabel = timeExpired
    ? 'Time Expired'
    : isSessionEnded
      ? 'Session Ended'
      : isSessionPaused
        ? 'Paused'
        : 'Active';
  const sessionStateClass = timeExpired || isSessionPaused
    ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
    : isSessionEnded
      ? 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200'
      : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300';

  const sessionBanners = useMemo<SessionBanner[]>(() => {
    const banners: SessionBanner[] = [];

    if (submissionError) {
      banners.push({
        key: 'submission-error',
        state: 'error',
        message: submissionError,
      });
    }

    if (!isOnline) {
      banners.push({
        key: 'offline',
        state: 'warning',
        message: 'Network offline. Timer continues and your draft autosaves locally.',
      });
    }

    if (!proctoringReady && sessionId) {
      banners.push({
        key: 'proctoring-init',
        state: 'info',
        message: 'Proctoring is initializing. Ensure camera and microphone are enabled.',
      });
    }

    if (isSessionPaused) {
      banners.push({
        key: 'paused',
        state: 'error',
        message:
          pauseReason || 'Session paused by proctoring. Restore required devices to continue.',
      });
    }

    if (timeExpired && pendingReconnectSubmit) {
      banners.push({
        key: 'time-expired-offline',
        state: 'error',
        message: 'Time expired while offline. Auto-submit will run when connection returns.',
      });
    }

    return banners;
  }, [
    isOnline,
    isSessionPaused,
    pauseReason,
    pendingReconnectSubmit,
    proctoringReady,
    sessionId,
    submissionError,
    timeExpired,
  ]);

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
    if (!deadlineAt) {
      setRemainingSeconds(challengeDurationSeconds);
    }
  }, [challengeDurationSeconds, deadlineAt]);

  useEffect(() => {
    if (!deadlineAt || isSessionEnded) return;

    const updateRemaining = () => {
      const endMs = new Date(deadlineAt).getTime();
      const now = Date.now();
      const fromDeadline = Math.max(0, Math.floor((endMs - now) / 1000));
      const nextRemaining = Math.min(fromDeadline, challengeDurationSeconds);
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

  const handleClipboardBlocked = useCallback(() => {
    const now = Date.now();
    if (now - lastClipboardWarningAt < 1200) return;
    setLastClipboardWarningAt(now);
    toast.error('Copy and paste are disabled during challenge solving.');
  }, [lastClipboardWarningAt]);

  return (
    <div className="flex flex-col gap-4 min-h-[680px]">
      <section className="sticky top-20 z-20 rounded-xl border border-border bg-card/95 backdrop-blur-sm p-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-2 justify-between">
          <div className="flex items-center gap-2 text-sm">
            {isOnline ? (
              <span className="rounded-full bg-green-100 px-2 py-1 text-green-700 dark:bg-green-900/30 dark:text-green-300">
                Online
              </span>
            ) : (
              <span className="rounded-full bg-amber-100 px-2 py-1 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 inline-flex items-center gap-1">
                <WifiOff className="h-3.5 w-3.5" />
                Offline
              </span>
            )}
            <span className={`rounded-full px-2 py-1 text-xs font-medium ${sessionStateClass}`}>
              {sessionStateLabel}
            </span>
            <span className="rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground">
              {violationCount} violation(s)
            </span>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Challenge Timer</p>
            <strong className={`font-mono text-base ${timeExpired ? 'text-red-600' : ''}`}>
              {formatRemaining(remainingSeconds)}
            </strong>
          </div>
        </div>
      </section>

      {sessionBanners.map((banner) => {
        const tone =
          banner.state === 'error'
            ? 'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/20'
            : banner.state === 'warning'
              ? 'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/20'
              : banner.state === 'success'
                ? 'border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/20'
                : 'border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/20';
        return (
          <Alert key={banner.key} className={tone}>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{banner.message}</AlertDescription>
          </Alert>
        );
      })}

      <div className="flex flex-col xl:flex-row gap-4">
        <section className="min-w-0 flex-1 flex flex-col gap-4">
          <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
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

          <div className="sticky bottom-2 rounded-xl border border-border bg-card/95 backdrop-blur-sm p-3 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                Writing solution in <span className="font-medium text-foreground">{selectedLanguage}</span>
              </p>
              <div className="flex flex-col-reverse sm:flex-row gap-2 sm:items-center">
                <Button
                  variant="outline"
                  onClick={handleEndSessionEarly}
                  disabled={!sessionId || isSessionEnded || isSubmitting || isSessionPaused}
                  className="sm:px-4"
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
                  className="sm:px-8"
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
        </section>

        <aside
          className={`bg-card border border-border rounded-xl overflow-hidden shadow-sm transition-all ${
            isRailCollapsed ? 'xl:w-[72px]' : 'xl:w-[360px]'
          }`}
          aria-label="Session assist rail"
        >
          <div className="border-b border-border p-2 flex items-center justify-between">
            {!isRailCollapsed && (
              <div className="grid grid-cols-3 gap-1 flex-1">
                <button
                  type="button"
                  onClick={() => setActiveRailTab('task')}
                  className={`rounded-md px-2 py-2 text-xs font-medium ${
                    activeRailTab === 'task'
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-muted'
                  }`}
                >
                  Task
                </button>
                <button
                  type="button"
                  onClick={() => setActiveRailTab('assist')}
                  className={`rounded-md px-2 py-2 text-xs font-medium ${
                    activeRailTab === 'assist'
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-muted'
                  }`}
                >
                  Assist
                </button>
                <button
                  type="button"
                  onClick={() => setActiveRailTab('integrity')}
                  className={`rounded-md px-2 py-2 text-xs font-medium ${
                    activeRailTab === 'integrity'
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-muted'
                  }`}
                >
                  Integrity
                </button>
              </div>
            )}
            <button
              type="button"
              onClick={() => setIsRailCollapsed((prev) => !prev)}
              className="ml-2 inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-muted"
              aria-label={isRailCollapsed ? 'Expand assist rail' : 'Collapse assist rail'}
            >
              {isRailCollapsed ? (
                <PanelLeftOpen className="h-4 w-4" />
              ) : (
                <PanelLeftClose className="h-4 w-4" />
              )}
            </button>
          </div>

          <div className={`${isRailCollapsed ? 'hidden' : 'block'} p-4 max-h-[68vh] overflow-auto`}>
            {activeRailTab === 'task' && (
              <div className="space-y-4">
                <DescriptionPanel challenge={challenge} compact />
                <div className="pt-3 border-t border-border">
                  <LanguageSelector
                    selectedLanguage={selectedLanguage}
                    onLanguageChange={onLanguageChange}
                    availableLanguages={availableLanguages}
                    label="Solution Language"
                    size="sm"
                  />
                </div>
              </div>
            )}

            {activeRailTab === 'assist' && (
              <div className="space-y-4">
                <section className="rounded-lg border border-border bg-muted/20 p-3">
                  <h4 className="font-medium text-sm flex items-center gap-2 mb-2">
                    <FileText className="h-4 w-4 text-primary" />
                    Reference Docs
                  </h4>
                  <ReferenceDocsPanel docs={referenceDocs} error={docsError} onRetry={onRetryDocs} />
                </section>

                <section className="rounded-lg border border-border bg-muted/20 p-3">
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
                        <div key={hint.hint_index} className="rounded-md border border-border p-2 bg-background">
                          <p className="text-xs font-medium mb-1">Hint {hint.hint_index}</p>
                          <p className="text-xs text-muted-foreground">{hint.hint}</p>
                          {hint.snippet && (
                            <pre className="mt-2 p-2 rounded bg-muted border text-[11px] overflow-x-auto">
                              <code>{hint.snippet}</code>
                            </pre>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </div>
            )}

            {activeRailTab === 'integrity' && (
              <div className="space-y-4">
                <section className="rounded-lg border border-border bg-muted/20 p-3">
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

                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Camera className="h-3 w-3" />
                        <span>Camera</span>
                      </div>
                      <span className={proctoringReady ? 'text-green-600' : 'text-muted-foreground'}>
                        {proctoringReady ? 'Monitoring' : 'Initializing'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Mic className="h-3 w-3" />
                        <span>Microphone</span>
                      </div>
                      <span className={proctoringReady ? 'text-green-600' : 'text-muted-foreground'}>
                        {proctoringReady ? 'Monitoring' : 'Initializing'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="h-3 w-3" />
                        <span>Violations</span>
                      </div>
                      <span className={violationCount > 0 ? 'text-amber-600' : 'text-green-600'}>
                        {violationCount} detected
                      </span>
                    </div>
                  </div>
                </section>
              </div>
            )}
          </div>

          {isRailCollapsed && (
            <div className="p-2 flex flex-col gap-2 items-center">
              <button
                type="button"
                onClick={() => {
                  setActiveRailTab('task');
                  setIsRailCollapsed(false);
                }}
                className="w-10 h-10 rounded-md border border-border hover:bg-muted text-muted-foreground hover:text-foreground"
                aria-label="Open task panel"
              >
                <FileText className="h-4 w-4 mx-auto" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveRailTab('assist');
                  setIsRailCollapsed(false);
                }}
                className="w-10 h-10 rounded-md border border-border hover:bg-muted text-muted-foreground hover:text-foreground"
                aria-label="Open assist panel"
              >
                <Sparkles className="h-4 w-4 mx-auto" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveRailTab('integrity');
                  setIsRailCollapsed(false);
                }}
                className="w-10 h-10 rounded-md border border-border hover:bg-muted text-muted-foreground hover:text-foreground"
                aria-label="Open integrity panel"
              >
                <Shield className="h-4 w-4 mx-auto" />
              </button>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
};
