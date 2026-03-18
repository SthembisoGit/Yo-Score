import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Expand,
  Loader2,
  Shield,
  WifiOff,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { CodeEditor } from '@/components/CodeEditor';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable';
import {
  challengeService,
  type Challenge,
  type ChallengeDocs,
  type RunCodeResponse,
} from '@/services/challengeService';
import { proctoringService } from '@/services/proctoring.service';
import { assessSessionEnvironment } from '@/lib/sessionEnvironment';
import ProctoringMonitor from '@/components/proctoring/ProctoringMonitor';
import { DescriptionPanel } from './DescriptionPanel';
import { LanguageSelector } from './LanguageSelector';
import { ReferenceDocsPanel } from './ReferenceDocsPanel';
import { SessionCoachChat } from './SessionCoachChat';
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
  userId: string | null;
  onViolation?: (type: string, data: unknown) => void;
  violationCount?: number;
  isSessionPaused?: boolean;
  pauseReason?: string;
  deadlineAt?: string | null;
  durationSeconds?: number;
}

interface PauseStatePayload {
  isPaused: boolean;
  reason: string;
  missingDevices: {
    camera: boolean;
    microphone: boolean;
    audio: boolean;
  };
}

type LeftRailTab = 'task' | 'docs';
type RightDockTab = 'assistant' | 'integrity';
type SessionBannerState = 'info' | 'warning' | 'error' | 'success';

interface SessionBanner {
  key: string;
  state: SessionBannerState;
  message: string;
}

const AUTO_SAVE_INTERVAL_MS = 3000;
const MAX_AUTO_SUBMIT_RETRIES = 20;
const AUTO_SUBMIT_RETRY_MS = 1500;

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

const isSnapshotProcessingRetryable = (message: string): boolean => {
  const normalized = message.toLowerCase();
  return (
    normalized.includes('snapshot processing') ||
    normalized.includes('still in progress') ||
    normalized.includes('submission_retryable')
  );
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
  userId,
  onViolation,
  violationCount: propViolationCount = 0,
  isSessionPaused = false,
  pauseReason = '',
  deadlineAt = null,
  durationSeconds = 0,
}: ChallengeSessionProps) => {
  const navigate = useNavigate();
  const [activeLeftTab, setActiveLeftTab] = useState<LeftRailTab>('task');
  const [activeRightTab, setActiveRightTab] = useState<RightDockTab>('assistant');
  const [leftRailCollapsed, setLeftRailCollapsed] = useState(false);
  const [rightDockCollapsed, setRightDockCollapsed] = useState(false);
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
  const [lastClipboardWarningAt, setLastClipboardWarningAt] = useState<number>(0);
  const [lastRunResult, setLastRunResult] = useState<RunCodeResponse | null>(null);
  const [fullscreenActive, setFullscreenActive] = useState<boolean>(() => Boolean(document.fullscreenElement));
  const [environmentReasons, setEnvironmentReasons] = useState<string[]>([]);
  const [sessionPaused, setSessionPaused] = useState(isSessionPaused);
  const [sessionPauseReason, setSessionPauseReason] = useState(pauseReason);

  const expiryHandledRef = useRef(false);
  const tenMinuteWarningShownRef = useRef(false);
  const fiveMinuteWarningShownRef = useRef(false);
  const autoSubmitRetryCountRef = useRef(0);
  const autoSubmitRetryTimerRef = useRef<number | null>(null);

  const draftKey = useMemo(() => {
    if (!sessionId) return null;
    return `yoscore:draft:${sessionId}:${challengeId}`;
  }, [challengeId, sessionId]);

  const templates: Record<SupportedLanguageCode, string> = useMemo(() => {
    const defaults: Record<SupportedLanguageCode, string> = {
      javascript: `function solve(input) {
  // parse input and return output
  return input.trim();
}

const fs = require('fs');
const input = fs.readFileSync(0, 'utf8');
process.stdout.write(String(solve(input)));`,
      python: `def solve(input_data):
    # parse input and return output
    return input_data.strip()

if __name__ == "__main__":
    import sys
    data = sys.stdin.read()
    print(solve(data))`,
      java: `import java.io.*;

public class Main {
    static String solve(String input) {
        // parse input and return output
        return input.trim();
    }

    public static void main(String[] args) throws Exception {
        String input = new String(System.in.readAllBytes());
        System.out.print(solve(input));
    }
}`,
      cpp: `#include <bits/stdc++.h>
using namespace std;

string solve(const string& input) {
    // parse input and return output
    return input;
}

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);
    string input((istreambuf_iterator<char>(cin)), istreambuf_iterator<char>());
    cout << solve(input);
    return 0;
}`,
      go: `package main

import (
    "fmt"
    "io"
    "os"
)

func solve(input string) string {
    // parse input and return output
    return input
}

func main() {
    data, _ := io.ReadAll(os.Stdin)
    fmt.Print(solve(string(data)))
}`,
      csharp: `using System;
using System.IO;

public class Program
{
    static string Solve(string input)
    {
        // parse input and return output
        return input.Trim();
    }

    public static void Main()
    {
        string input = Console.In.ReadToEnd();
        Console.Write(Solve(input));
    }
}`,
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

  const readOnlyEditor = isSubmitting || isSessionEnded || sessionPaused || timeExpired;
  const sessionStateLabel = timeExpired
    ? 'Time Expired'
    : isSessionEnded
      ? 'Session Ended'
      : sessionPaused
        ? 'Paused'
        : 'Active';
  const sessionStateClass = timeExpired || sessionPaused
    ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
    : isSessionEnded
      ? 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200'
      : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300';
  const integrityActionRequired = sessionPaused || !fullscreenActive;
  const showAssistantPanel = activeRightTab === 'assistant' && !integrityActionRequired;
  const showIntegrityPanel = activeRightTab === 'integrity' || integrityActionRequired;

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
        message: 'Proctoring is initializing. Keep camera, microphone, and fullscreen ready.',
      });
    }

    if (sessionPaused) {
      banners.push({
        key: 'paused',
        state: 'error',
        message:
          sessionPauseReason || 'Session paused by proctoring. Restore required devices and fullscreen to continue.',
      });
    }

    if (!fullscreenActive) {
      banners.push({
        key: 'fullscreen-required',
        state: 'warning',
        message: 'Fullscreen is required for this challenge session. Restore fullscreen to continue.',
      });
    }

    if (environmentReasons.length > 0) {
      banners.push({
        key: 'environment',
        state: 'warning',
        message: environmentReasons[0],
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
    environmentReasons,
    fullscreenActive,
    isOnline,
    sessionPauseReason,
    sessionPaused,
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

  const handleRunCode = useCallback(
    async ({
      language,
      code: sourceCode,
      stdin,
    }: {
      language: SupportedLanguageCode;
      code: string;
      stdin: string;
    }): Promise<RunCodeResponse> =>
      challengeService.runCode({
        language,
        code: sourceCode,
        stdin,
        challenge_id: challengeId,
      }),
    [challengeId],
  );

  const requestFullscreen = useCallback(async () => {
    const root = document.documentElement as HTMLElement & {
      webkitRequestFullscreen?: () => Promise<void> | void;
    };

    if (document.fullscreenElement) {
      setFullscreenActive(true);
      return;
    }

    if (typeof root.requestFullscreen === 'function') {
      await root.requestFullscreen();
      setFullscreenActive(true);
      return;
    }

    if (typeof root.webkitRequestFullscreen === 'function') {
      await Promise.resolve(root.webkitRequestFullscreen());
      setFullscreenActive(true);
      return;
    }

    throw new Error('Fullscreen is not supported in this browser.');
  }, []);

  const exitFullscreen = useCallback(async () => {
    if (document.fullscreenElement) {
      await document.exitFullscreen().catch(() => undefined);
    }
    setFullscreenActive(false);
  }, []);

  const handleSubmit = useCallback(
    async (auto = false, forceTimeoutSubmit = false) => {
      if (isSubmitting || isSessionEnded) return;
      const isTimeoutAutoSubmit =
        forceTimeoutSubmit || (auto && (timeExpired || remainingSeconds <= 0));

      if (autoSubmitRetryTimerRef.current !== null) {
        window.clearTimeout(autoSubmitRetryTimerRef.current);
        autoSubmitRetryTimerRef.current = null;
      }

      if (!isOnline) {
        setSubmissionError('You are offline. Submission will continue when connection is restored.');
        setPendingReconnectSubmit(true);
        return;
      }

      if (sessionPaused && !isTimeoutAutoSubmit) {
        setSubmissionError(
          'Session is paused. Re-enable camera, microphone, and fullscreen to continue.',
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
          {
            timeoutSubmit: isTimeoutAutoSubmit,
          },
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
        autoSubmitRetryCountRef.current = 0;
        if (autoSubmitRetryTimerRef.current !== null) {
          window.clearTimeout(autoSubmitRetryTimerRef.current);
          autoSubmitRetryTimerRef.current = null;
        }
        await exitFullscreen();
        toast.success('Challenge submitted successfully.');

        setTimeout(() => {
          navigate(`/submissions/${submission.submission_id}`);
        }, 1200);
      } catch (err: unknown) {
        const errorMessage = getErrorMessage(err, 'Failed to submit challenge.');
        if (auto && isSnapshotProcessingRetryable(errorMessage)) {
          if (autoSubmitRetryCountRef.current < MAX_AUTO_SUBMIT_RETRIES) {
            autoSubmitRetryCountRef.current += 1;
            setSubmissionError(
              `Finishing proctoring checks before submission (${autoSubmitRetryCountRef.current}/${MAX_AUTO_SUBMIT_RETRIES})...`,
            );
            setPendingReconnectSubmit(false);
            autoSubmitRetryTimerRef.current = window.setTimeout(() => {
              setPendingReconnectSubmit(true);
            }, AUTO_SUBMIT_RETRY_MS);
            return;
          }
          setSubmissionError(
            'Automatic submission is taking longer due to proctoring checks. Please click Submit once to retry.',
          );
          toast.error('Submission delayed by proctoring checks. Please retry.');
          return;
        }
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
      exitFullscreen,
      isOnline,
      isSessionEnded,
      sessionPaused,
      isSubmitting,
      navigate,
      proctoringReady,
      remainingSeconds,
      selectedLanguage,
      sessionId,
      timeExpired,
    ],
  );

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
        await exitFullscreen();
        toast('Session ended early.');
        navigate('/challenges');
      } catch (error) {
        console.error('Failed to end session:', error);
        toast.error('Failed to end session');
      }
    }
  }, [exitFullscreen, isSessionEnded, navigate, proctoringReady, sessionId]);

  useEffect(() => {
    const nextTemplate = templates[mapToSubmissionLanguage(selectedLanguage)];
    if (nextTemplate) {
      setCode(nextTemplate);
    }
  }, [selectedLanguage, templates]);

  useEffect(() => {
    if (sessionId) {
      setProctoringReady(true);
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
    setSessionPaused(isSessionPaused);
  }, [isSessionPaused]);

  useEffect(() => {
    setSessionPauseReason(pauseReason);
  }, [pauseReason]);

  const handlePauseStateChange = useCallback((state: PauseStatePayload) => {
    setSessionPaused(state.isPaused);
    setSessionPauseReason(state.reason);
  }, []);

  useEffect(() => {
    if (!integrityActionRequired) return;
    setRightDockCollapsed(false);
    setActiveRightTab('integrity');
  }, [integrityActionRequired]);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    const handleFullscreenChange = () => {
      setFullscreenActive(Boolean(document.fullscreenElement));
    };
    const handleResize = () => {
      const assessment = assessSessionEnvironment();
      setEnvironmentReasons(assessment.supported ? [] : assessment.reasons);
    };

    const initialAssessment = assessSessionEnvironment();
    setEnvironmentReasons(initialAssessment.supported ? [] : initialAssessment.reasons);
    setFullscreenActive(Boolean(document.fullscreenElement));

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('resize', handleResize);
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  useEffect(() => {
    if (!deadlineAt) {
      setRemainingSeconds(challengeDurationSeconds);
    }
  }, [challengeDurationSeconds, deadlineAt]);

  useEffect(() => {
    expiryHandledRef.current = false;
    tenMinuteWarningShownRef.current = false;
    fiveMinuteWarningShownRef.current = false;
    autoSubmitRetryCountRef.current = 0;
    if (autoSubmitRetryTimerRef.current !== null) {
      window.clearTimeout(autoSubmitRetryTimerRef.current);
      autoSubmitRetryTimerRef.current = null;
    }
  }, [deadlineAt, sessionId]);

  useEffect(() => {
    return () => {
      if (autoSubmitRetryTimerRef.current !== null) {
        window.clearTimeout(autoSubmitRetryTimerRef.current);
        autoSubmitRetryTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!deadlineAt || isSessionEnded) return;

    const updateRemaining = () => {
      const endMs = new Date(deadlineAt).getTime();
      const now = Date.now();
      const fromDeadline = Math.max(0, Math.floor((endMs - now) / 1000));
      const nextRemaining = Math.min(fromDeadline, challengeDurationSeconds);
      setRemainingSeconds(nextRemaining);

      if (!tenMinuteWarningShownRef.current && nextRemaining <= 600 && nextRemaining > 300) {
        tenMinuteWarningShownRef.current = true;
        toast('10 minutes remaining. Wrap up and prepare to submit.', {
          duration: 5000,
        });
      }

      if (!fiveMinuteWarningShownRef.current && nextRemaining <= 300 && nextRemaining > 0) {
        fiveMinuteWarningShownRef.current = true;
        toast('5 minutes remaining. Finalize and submit soon.', {
          duration: 6000,
        });
      }

      if (nextRemaining <= 0 && !expiryHandledRef.current) {
        expiryHandledRef.current = true;
        setTimeExpired(true);
        if (!isOnline) {
          setPendingReconnectSubmit(true);
          setSubmissionError(
            'Time is up while offline. Editor is locked and auto-submit will run when connection returns.',
          );
        } else {
          void handleSubmit(true, true);
        }
      }
    };

    updateRemaining();
    const timer = window.setInterval(updateRemaining, 1000);
    return () => window.clearInterval(timer);
  }, [challengeDurationSeconds, deadlineAt, handleSubmit, isOnline, isSessionEnded]);

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
    <div className="flex h-full min-h-0 flex-col bg-background">
      <header className="border-b border-border bg-card/95 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              Challenge Workbench
            </p>
            <h1 className="truncate text-lg font-semibold sm:text-xl">{challenge.title}</h1>
            <p className="text-xs text-muted-foreground">
              {challenge.category} · {selectedLanguage} · {challenge.difficulty}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            {isOnline ? (
              <span className="rounded-full bg-green-100 px-2.5 py-1 text-green-700 dark:bg-green-900/30 dark:text-green-300">
                Online
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                <WifiOff className="h-3.5 w-3.5" />
                Offline
              </span>
            )}
            <span className={`rounded-full px-2.5 py-1 font-medium ${sessionStateClass}`}>
              {sessionStateLabel}
            </span>
            <span
              className={`rounded-full px-2.5 py-1 font-medium ${
                fullscreenActive
                  ? 'bg-primary/10 text-primary'
                  : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
              }`}
            >
              {fullscreenActive ? 'Fullscreen locked' : 'Fullscreen exited'}
            </span>
            <span className="rounded-full bg-muted px-2.5 py-1 text-muted-foreground">
              {violationCount} violation(s)
            </span>
            <div className="rounded-full border border-border px-3 py-1 font-mono text-sm text-foreground">
              {formatRemaining(remainingSeconds)}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={() => void requestFullscreen()} disabled={fullscreenActive}>
              <Expand className="mr-2 h-4 w-4" />
              Restore Fullscreen
            </Button>
            <Button
              variant="outline"
              onClick={handleEndSessionEarly}
              disabled={!sessionId || isSessionEnded || isSubmitting}
            >
              End Session
            </Button>
            <Button
              onClick={() => void handleSubmit(false)}
              disabled={
                isSubmitting ||
                !selectedLanguage ||
                isSessionEnded ||
                sessionPaused ||
                !isOnline ||
                timeExpired
              }
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                'Submit Solution'
              )}
            </Button>
          </div>
        </div>
      </header>
      {sessionBanners.length > 0 ? (
        <div className="space-y-3 border-b border-border bg-background/95 px-4 py-3 sm:px-6">
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
        </div>
      ) : null}

      <div className="min-h-0 flex-1 px-4 py-4 sm:px-6 sm:py-5">
        <ResizablePanelGroup direction="horizontal" className="min-h-0 rounded-3xl border border-border bg-card shadow-sm">
          {!leftRailCollapsed ? (
            <>
              <ResizablePanel defaultSize={23} minSize={18} maxSize={30} className="min-h-0">
                <div className="flex h-full min-h-0 flex-col border-r border-border bg-muted/10">
                  <div className="flex items-center justify-between border-b border-border px-4 py-3">
                    <div>
                      <h2 className="text-sm font-semibold">Task Rail</h2>
                      <p className="text-xs text-muted-foreground">Prompt, docs, and language</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setLeftRailCollapsed(true)}
                      className="rounded-md border border-border p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                      aria-label="Collapse task rail"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="border-b border-border px-4 py-3">
                    <LanguageSelector
                      selectedLanguage={selectedLanguage}
                      onLanguageChange={onLanguageChange}
                      availableLanguages={availableLanguages}
                      size="sm"
                    />
                  </div>

                  <div className="border-b border-border px-4 py-2">
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setActiveLeftTab('task')}
                        className={`rounded-xl px-3 py-2 text-sm font-medium ${
                          activeLeftTab === 'task'
                            ? 'bg-primary text-primary-foreground'
                            : 'text-muted-foreground hover:bg-muted'
                        }`}
                      >
                        Task
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveLeftTab('docs')}
                        className={`rounded-xl px-3 py-2 text-sm font-medium ${
                          activeLeftTab === 'docs'
                            ? 'bg-primary text-primary-foreground'
                            : 'text-muted-foreground hover:bg-muted'
                        }`}
                      >
                        Docs
                      </button>
                    </div>
                  </div>

                  <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
                    {activeLeftTab === 'task' ? (
                      <div className="space-y-4">
                        <DescriptionPanel challenge={challenge} compact />
                        <div className="rounded-2xl border border-border bg-background p-4 text-sm text-muted-foreground">
                          <p className="font-medium text-foreground">Session notes</p>
                          <ul className="mt-3 space-y-2">
                            <li>- Work entirely inside fullscreen during the attempt.</li>
                            <li>- Use Run to test ideas before the final submission.</li>
                            <li>- AI Coach can help with debugging, not full answers.</li>
                          </ul>
                        </div>
                      </div>
                    ) : (
                      <ReferenceDocsPanel docs={referenceDocs} error={docsError} onRetry={onRetryDocs} />
                    )}
                  </div>
                </div>
              </ResizablePanel>
              <ResizableHandle withHandle />
            </>
          ) : (
            <div className="flex w-[56px] flex-col items-center gap-3 border-r border-border bg-muted/10 py-4">
              <button
                type="button"
                onClick={() => setLeftRailCollapsed(false)}
                className="rounded-xl border border-border p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                aria-label="Expand task rail"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}

          <ResizablePanel defaultSize={leftRailCollapsed && rightDockCollapsed ? 100 : 54} minSize={40} className="min-h-0">
            <div className="flex h-full min-h-0 flex-col bg-background p-3 sm:p-4">
              <CodeEditor
                language={mapToSubmissionLanguage(selectedLanguage)}
                value={code}
                onChange={setCode}
                onRun={handleRunCode}
                onRunResult={(result) => setLastRunResult(result)}
                className="h-full"
                readOnly={readOnlyEditor}
                disableClipboardActions
                onClipboardBlocked={handleClipboardBlocked}
              />
            </div>
          </ResizablePanel>

          {!rightDockCollapsed ? (
            <>
              <ResizableHandle withHandle />
              <ResizablePanel defaultSize={23} minSize={18} maxSize={30} className="min-h-0">
                <div className="flex h-full min-h-0 flex-col border-l border-border bg-muted/10">
                  <div className="flex items-center justify-between border-b border-border px-4 py-3">
                    <div>
                      <h2 className="text-sm font-semibold">Session Dock</h2>
                      <p className="text-xs text-muted-foreground">AI Coach and integrity</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (integrityActionRequired) return;
                        setRightDockCollapsed(true);
                      }}
                      disabled={integrityActionRequired}
                      className="rounded-md border border-border p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                      aria-label="Collapse session dock"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="border-b border-border px-4 py-2">
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          if (integrityActionRequired) return;
                          setActiveRightTab('assistant');
                        }}
                        disabled={integrityActionRequired}
                        className={`rounded-xl px-3 py-2 text-sm font-medium ${
                          activeRightTab === 'assistant'
                            ? 'bg-primary text-primary-foreground'
                            : 'text-muted-foreground hover:bg-muted'
                        }`}
                      >
                        AI Chat
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveRightTab('integrity')}
                        className={`rounded-xl px-3 py-2 text-sm font-medium ${
                          activeRightTab === 'integrity'
                            ? 'bg-primary text-primary-foreground'
                            : 'text-muted-foreground hover:bg-muted'
                        }`}
                      >
                        Integrity
                      </button>
                    </div>
                  </div>

                  <div className="min-h-0 flex-1 overflow-hidden">
                    {showAssistantPanel ? (
                      <div className="h-full">
                        <SessionCoachChat
                          challengeId={challengeId}
                          sessionId={sessionId ?? null}
                          language={mapToSubmissionLanguage(selectedLanguage)}
                          code={code}
                          runContext={lastRunResult}
                          disabled={isSessionEnded || !isOnline}
                        />
                      </div>
                    ) : null}
                    {sessionId && userId ? (
                      showIntegrityPanel ? (
                        <div className="h-full">
                          <ProctoringMonitor
                            sessionId={sessionId}
                            userId={userId}
                            challengeId={challengeId}
                            onViolation={onViolation ?? (() => undefined)}
                            onPauseStateChange={handlePauseStateChange}
                            presentation="embedded"
                            fullscreenRequired
                            fullscreenActive={fullscreenActive}
                            onRequestFullscreen={requestFullscreen}
                          />
                        </div>
                      ) : null
                    ) : (
                      <div className="flex h-full items-center justify-center p-4 text-sm text-muted-foreground">
                        Integrity monitor unavailable.
                      </div>
                    )}
                  </div>
                </div>
              </ResizablePanel>
            </>
          ) : (
            <div className="flex w-[56px] flex-col items-center gap-3 border-l border-border bg-muted/10 py-4">
              <button
                type="button"
                onClick={() => setRightDockCollapsed(false)}
                className="rounded-xl border border-border p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                aria-label="Expand session dock"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setRightDockCollapsed(false);
                  setActiveRightTab('assistant');
                }}
                className="rounded-xl border border-border p-2 text-xs text-muted-foreground transition hover:bg-muted hover:text-foreground"
              >
                AI
              </button>
              <button
                type="button"
                onClick={() => {
                  setRightDockCollapsed(false);
                  setActiveRightTab('integrity');
                }}
                className="rounded-xl border border-border p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground"
              >
                <Shield className="h-4 w-4" />
              </button>
            </div>
          )}
        </ResizablePanelGroup>
        {rightDockCollapsed && sessionId && userId ? (
          <div className="hidden">
            <ProctoringMonitor
              sessionId={sessionId}
              userId={userId}
              challengeId={challengeId}
              onViolation={onViolation ?? (() => undefined)}
              onPauseStateChange={handlePauseStateChange}
              presentation="embedded"
              fullscreenRequired
              fullscreenActive={fullscreenActive}
              onRequestFullscreen={requestFullscreen}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
};
