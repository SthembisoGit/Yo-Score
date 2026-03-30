import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom';
import { ChevronRight, Loader2, AlertCircle, FileText, Info } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { ProctoringModal } from '@/components/ProctoringModal';
import { Button } from '@/components/ui/button';
import { ChallengeOverview } from '@/components/challenge-detail/ChallengeOverview';
import { ChallengeSession } from '@/components/challenge-detail/ChallengeSession';
import { DesktopRequiredPanel } from '@/components/challenge-detail/DesktopRequiredPanel';
import { useChallengeData } from '@/hooks/useChallengeData';
import { useAuth } from '@/context/AuthContext';
import type { ProgrammingLanguage } from '@/context/AuthContext';
import { toast } from 'react-hot-toast';
import { useProctoring } from '@/hooks/useProctoring';
import { challengeService } from '@/services/challengeService';
import { CODE_TO_DISPLAY, normalizeLanguageCode } from '@/constants/languages';
import type { ProctoringConsentPayload } from '@/services/proctoring.service';
import { assessSessionEnvironment, getSessionClientContext } from '@/lib/sessionEnvironment';

const CHALLENGE_START_HELP_KEY = 'yoscore_challenge_start_help_seen';

export default function ChallengeDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, setPreferredLanguage, availableLanguages } = useAuth();
  const { challenge, referenceDocs, docsError, refetchDocs, isLoading, error } = useChallengeData(id);
  const supportedLanguages = useMemo(() => {
    const challengeSupportedLanguages = challenge?.supported_languages ?? [];
    const preferredDisplayOrder = ['JavaScript', 'Python', 'Java', 'C++', 'Go', 'C#'];
    if (challengeSupportedLanguages.length > 0) {
      const display = challengeSupportedLanguages.map((language) => CODE_TO_DISPLAY[language]);
      return display.sort((a, b) => {
        const ai = preferredDisplayOrder.indexOf(a);
        const bi = preferredDisplayOrder.indexOf(b);
        const ao = ai === -1 ? Number.MAX_SAFE_INTEGER : ai;
        const bo = bi === -1 ? Number.MAX_SAFE_INTEGER : bi;
        if (ao !== bo) return ao - bo;
        return a.localeCompare(b);
      });
    }
    return availableLanguages;
  }, [availableLanguages, challenge?.supported_languages]);
  const [showProctoringModal, setShowProctoringModal] = useState(false);
  const [sessionStarted, setSessionStarted] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState<string>('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [deadlineAt, setDeadlineAt] = useState<string | null>(null);
  const [durationSeconds, setDurationSeconds] = useState<number>(0);
  const [violationCount, setViolationCount] = useState(0);
  const [isPreparingStart, setIsPreparingStart] = useState(false);
  const [isStartingProctoring, setIsStartingProctoring] = useState(false);
  const [isSessionPaused, setIsSessionPaused] = useState(false);
  const [pauseReason, setPauseReason] = useState('');
  const [showStartHelp, setShowStartHelp] = useState(false);
  const [desktopBlockReasons, setDesktopBlockReasons] = useState<string[]>([]);
  const [assignmentValidated, setAssignmentValidated] = useState(false);
  const lastChallengeIdRef = useRef<string | undefined>(id);

  const { startSession } = useProctoring();
  const locationState = location.state as
    | { assignedFromMatcher?: boolean; assignmentCategory?: string }
    | null;
  const params = new URLSearchParams(location.search);
  const assignedFromMatcher =
    Boolean(locationState?.assignedFromMatcher) || params.get('assigned') === '1';
  const assignmentCategory =
    locationState?.assignmentCategory || params.get('assignmentCategory');
  const canStartAssignedFlow = assignedFromMatcher && Boolean(assignmentCategory);

  const verifyAssignedChallenge = useCallback(async (category: string, challengeId: string) => {
    const assigned = await challengeService.getNextChallenge(category);
    return {
      assigned,
      matchesCurrent: assigned.challenge_id === challengeId,
    };
  }, []);

  // Initialize language from user preference
  useEffect(() => {
    if (user?.preferredLanguage && supportedLanguages.includes(user.preferredLanguage)) {
      setSelectedLanguage(user.preferredLanguage);
    } else if (supportedLanguages.includes('JavaScript')) {
      setSelectedLanguage('JavaScript');
    } else if (supportedLanguages.length > 0) {
      setSelectedLanguage(supportedLanguages[0]);
    }
  }, [supportedLanguages, user?.preferredLanguage]);

  const handleLanguageChange = (language: string) => {
    setSelectedLanguage(language);
    if (user) {
      const display = CODE_TO_DISPLAY[normalizeLanguageCode(language)];
      setPreferredLanguage(display as ProgrammingLanguage);
    }
  };

  useEffect(() => {
    let cancelled = false;

    const prepareAssignedStart = async () => {
      if (!canStartAssignedFlow || !assignmentCategory || !id || !challenge) {
        setAssignmentValidated(false);
        setIsPreparingStart(false);
        return;
      }

      setIsPreparingStart(true);
      try {
        const verification = await verifyAssignedChallenge(assignmentCategory, id);
        if (cancelled) return;

        if (!verification.matchesCurrent) {
          toast('You were redirected to your assigned challenge for this category and seniority.');
          navigate(
            `/challenges/${verification.assigned.challenge_id}?assigned=1&assignmentCategory=${encodeURIComponent(
              assignmentCategory,
            )}`,
            {
              replace: true,
              state: {
                assignedFromMatcher: true,
                assignmentCategory,
              },
            },
          );
          return;
        }

        setAssignmentValidated(true);
      } catch {
        if (cancelled) return;
        setAssignmentValidated(false);
      } finally {
        if (!cancelled) {
          setIsPreparingStart(false);
        }
      }
    };

    void prepareAssignedStart();

    return () => {
      cancelled = true;
    };
  }, [assignmentCategory, canStartAssignedFlow, challenge, id, navigate, verifyAssignedChallenge]);

  const handleStartSession = async () => {
    if (!id || !challenge) return;
    if (isPreparingStart || isStartingProctoring) return;

    if (!canStartAssignedFlow || !assignmentCategory) {
      toast.error('Use "Start Matched Challenge" to begin a seniority-assigned attempt.');
      navigate('/challenges');
      return;
    }
    if (!assignmentValidated) {
      toast.error('Preparing your matched challenge. Please wait a moment and try again.');
      return;
    }

    const assessment = assessSessionEnvironment();
    if (!assessment.supported) {
      setDesktopBlockReasons(assessment.reasons);
      return;
    }

    setDesktopBlockReasons([]);
    setShowProctoringModal(true);
  };

  const requestFullscreenForSession = async () => {
    const root = document.documentElement as HTMLElement & {
      webkitRequestFullscreen?: () => Promise<void> | void;
    };

    if (document.fullscreenElement) {
      return;
    }

    if (typeof root.requestFullscreen === 'function') {
      await root.requestFullscreen();
      return;
    }

    if (typeof root.webkitRequestFullscreen === 'function') {
      await Promise.resolve(root.webkitRequestFullscreen());
      return;
    }

    throw new Error('Fullscreen is not supported in this browser.');
  };

  const waitForFullscreenActivation = async (timeoutMs: number = 2000) => {
    if (document.fullscreenElement) {
      return true;
    }

    await new Promise<void>((resolve) => {
      let settled = false;

      const finish = () => {
        if (settled) return;
        settled = true;
        document.removeEventListener('fullscreenchange', handleChange);
        clearTimeout(timer);
        resolve();
      };

      const handleChange = () => {
        if (document.fullscreenElement) {
          finish();
        }
      };

      const timer = window.setTimeout(finish, timeoutMs);
      document.addEventListener('fullscreenchange', handleChange);
      window.setTimeout(() => {
        if (document.fullscreenElement) {
          finish();
        }
      }, 50);
    });

    return Boolean(document.fullscreenElement);
  };

  const handleProctoringConfirm = async (consent: ProctoringConsentPayload) => {
    if (!id || !user?.id) {
      toast.error('Missing challenge or user information. Please ensure you are logged in.');
      return;
    }

    const assessment = assessSessionEnvironment();
    if (!assessment.supported) {
      setDesktopBlockReasons(assessment.reasons);
      toast.error(assessment.reasons[0] ?? 'Desktop environment is required to start this challenge.');
      return;
    }

    setIsStartingProctoring(true);

    try {
      await requestFullscreenForSession();
      const fullscreenActive = await waitForFullscreenActivation();
      const clientContext = getSessionClientContext();
      if (!fullscreenActive || !clientContext.fullscreen_active) {
        throw new Error('You must stay in fullscreen mode to start the challenge.');
      }

      const sessionMeta = await startSession(id, user.id, consent, clientContext);
      setSessionId(sessionMeta.sessionId);
      setDeadlineAt(sessionMeta.deadlineAt);
      setDurationSeconds(sessionMeta.durationSeconds);
      setSessionStarted(true);
      setShowProctoringModal(false);
      toast.success('Proctoring session started. Camera and microphone are now active.');
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to start proctoring session';
      toast.error(message);
      console.error(error);
      if (document.fullscreenElement) {
        void document.exitFullscreen().catch(() => undefined);
      }
      setShowProctoringModal(true);
    } finally {
      setIsStartingProctoring(false);
    }
  };

  const handleViolationDetected = (_type: string, _data: unknown) => {
    setViolationCount((previous) => previous + 1);
  };

  useEffect(() => {
    try {
      if (!localStorage.getItem(CHALLENGE_START_HELP_KEY)) {
        setShowStartHelp(true);
      }
    } catch {
      setShowStartHelp(true);
    }
  }, []);

  const dismissStartHelp = () => {
    setShowStartHelp(false);
    try {
      localStorage.setItem(CHALLENGE_START_HELP_KEY, '1');
    } catch {
      // ignore storage errors
    }
  };

  useEffect(() => {
    if (lastChallengeIdRef.current === id) {
      return;
    }

    const previousSessionId = sessionId;
    if (previousSessionId && sessionStarted) {
      void proctoringService.endSession(previousSessionId);
    }

    setShowProctoringModal(false);
    setSessionStarted(false);
    setSessionId(null);
    setDeadlineAt(null);
    setDurationSeconds(0);
    setViolationCount(0);
    setIsPreparingStart(false);
    setIsSessionPaused(false);
    setPauseReason('');
    setDesktopBlockReasons([]);
    setAssignmentValidated(false);
    lastChallengeIdRef.current = id;
  }, [id, sessionId, sessionStarted]);

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex flex-col items-center justify-center h-[60vh] px-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
          <p className="text-muted-foreground">Loading challenge details...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error && !challenge) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex flex-col items-center justify-center h-[60vh] px-4">
          <div className="text-center max-w-md">
            <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="h-6 w-6 text-destructive" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Failed to load challenge</h3>
            <p className="text-muted-foreground mb-6">{error}</p>
            <div className="flex gap-3 justify-center">
              <Link to="/challenges">
                <Button variant="outline">Back to Challenges</Button>
              </Link>
              <Button onClick={() => window.location.reload()}>Try Again</Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Not found state
  if (!challenge) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex flex-col items-center justify-center h-[60vh] px-4">
          <div className="text-center max-w-md">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
              <FileText className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Challenge not found</h3>
            <p className="text-muted-foreground mb-6">
              The requested challenge does not exist or has been removed.
            </p>
            <Link to="/challenges">
              <Button>Browse Challenges</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {!sessionStarted && <Navbar />}

      {!sessionStarted && (
        <div className="bg-card border-b border-border">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
            <div className="flex items-center gap-2 text-sm">
              <Link 
                to="/challenges" 
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                Challenges
              </Link>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium truncate">{challenge.title}</span>
            </div>
          </div>
        </div>
      )}

      <main
        className={
          sessionStarted
            ? 'fixed inset-0 z-40 h-screen overflow-hidden bg-background'
            : 'flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6'
        }
      >
        {!sessionStarted ? (
          <>
            {desktopBlockReasons.length > 0 ? (
              <DesktopRequiredPanel
                reasons={desktopBlockReasons}
                onBack={() => {
                  setDesktopBlockReasons([]);
                  navigate('/challenges');
                }}
              />
            ) : (
              <>
            {showStartHelp && (
              <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/20 p-4 flex items-start justify-between gap-3">
                <div className="flex gap-2 text-sm">
                  <Info className="h-4 w-4 mt-0.5 text-blue-600" />
                  <p className="text-muted-foreground">
                    You are taking a matched challenge. Start the session to begin timer + proctoring,
                    then submit once your solution passes your own run checks.
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={dismissStartHelp}>
                  Got it
                </Button>
              </div>
            )}
            <ChallengeOverview
              challenge={challenge}
              selectedLanguage={selectedLanguage}
              availableLanguages={supportedLanguages}
              onLanguageChange={handleLanguageChange}
              onStartSession={handleStartSession}
              onBack={() => navigate('/challenges')}
              startDisabled={isPreparingStart}
              startLoading={isPreparingStart}
              startLabel={
                isPreparingStart
                  ? 'Preparing Challenge Session...'
                  : canStartAssignedFlow
                    ? 'Start Challenge Session'
                    : 'Start From Matched Assignment'
              }
            />
              </>
            )}
          </>
        ) : (
            <ChallengeSession
              challenge={challenge}
              referenceDocs={referenceDocs}
              selectedLanguage={selectedLanguage}
              availableLanguages={supportedLanguages}
              onLanguageChange={handleLanguageChange}
              challengeId={id!}
              sessionId={sessionId}
              onViolation={handleViolationDetected}
              violationCount={violationCount}
              isSessionPaused={isSessionPaused}
              pauseReason={pauseReason}
              deadlineAt={deadlineAt}
              durationSeconds={durationSeconds}
              docsError={docsError}
              onRetryDocs={refetchDocs}
              userId={user?.id ?? null}
            />
        )}
      </main>

      <ProctoringModal
        isOpen={showProctoringModal}
        onClose={() => setShowProctoringModal(false)}
        onConfirm={handleProctoringConfirm}
        isLoading={isStartingProctoring}
      />
    </div>
  );
}
