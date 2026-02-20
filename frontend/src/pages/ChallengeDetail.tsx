import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom';
import { ChevronRight, Loader2, AlertCircle, FileText } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { ProctoringModal } from '@/components/ProctoringModal';
import { Button } from '@/components/ui/button';
import { ChallengeOverview } from '@/components/challenge-detail/ChallengeOverview';
import { ChallengeSession } from '@/components/challenge-detail/ChallengeSession';
import { useChallengeData } from '@/hooks/useChallengeData';
import { useAuth } from '@/context/AuthContext';
import type { ProgrammingLanguage } from '@/context/AuthContext';
import { toast } from 'react-hot-toast';
import ProctoringMonitor from '@/components/proctoring/ProctoringMonitor';
import { useProctoring } from '@/hooks/useProctoring';
import { challengeService } from '@/services/challengeService';

interface ViolationEvent {
  type: string;
  timestamp: Date;
  data: unknown;
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

export default function ChallengeDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, setPreferredLanguage, availableLanguages } = useAuth();
  
  const supportedLanguages = availableLanguages.filter(
    (lang) => ['JavaScript', 'Python'].includes(lang),
  );

  const { challenge, referenceDocs, docsError, refetchDocs, isLoading, error } = useChallengeData(id);
  const [showProctoringModal, setShowProctoringModal] = useState(false);
  const [sessionStarted, setSessionStarted] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState<string>('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [deadlineAt, setDeadlineAt] = useState<string | null>(null);
  const [durationSeconds, setDurationSeconds] = useState<number>(0);
  const [violations, setViolations] = useState<ViolationEvent[]>([]);
  const [violationCount, setViolationCount] = useState(0);
  const [isStartingProctoring, setIsStartingProctoring] = useState(false);
  const [isSessionPaused, setIsSessionPaused] = useState(false);
  const [pauseReason, setPauseReason] = useState('');

  const { startSession } = useProctoring();

  // Initialize language from user preference
  useEffect(() => {
    if (user?.preferredLanguage && supportedLanguages.includes(user.preferredLanguage)) {
      setSelectedLanguage(user.preferredLanguage);
    } else if (supportedLanguages.length > 0) {
      setSelectedLanguage(supportedLanguages[0]);
    }
  }, [supportedLanguages, user?.preferredLanguage]);

  const handleLanguageChange = (language: string) => {
    setSelectedLanguage(language);
    if (user) {
      setPreferredLanguage(language as ProgrammingLanguage);
    }
  };

  const handleStartSession = async () => {
    if (!id || !challenge) return;

    const forcedCategory = (location.state as { assignmentCategory?: string } | null)?.assignmentCategory;
    const category = forcedCategory || challenge.category;

    try {
      const assigned = await challengeService.getNextChallenge(category);
      if (assigned.challenge_id !== id) {
        toast('You were redirected to your assigned challenge for this category and seniority.');
        navigate(`/challenges/${assigned.challenge_id}`, {
          replace: true,
          state: {
            assignedFromMatcher: true,
            assignmentCategory: category,
          },
        });
        return;
      }
    } catch (assignmentError) {
      console.warn('Assignment check failed, continuing with current challenge:', assignmentError);
    }

    setShowProctoringModal(true);
  };

  const handleProctoringConfirm = async () => {
    if (!id || !user?.id) {
      toast.error('Missing challenge or user information. Please ensure you are logged in.');
      return;
    }

    setIsStartingProctoring(true);
    setShowProctoringModal(false);

    try {
      const sessionMeta = await startSession(id, user.id);
      setSessionId(sessionMeta.sessionId);
      setDeadlineAt(sessionMeta.deadlineAt);
      setDurationSeconds(sessionMeta.durationSeconds);
      setSessionStarted(true);
      toast.success('Proctoring session started. Camera and microphone are now active.');
    } catch (error) {
      toast.error('Failed to start proctoring session');
      console.error(error);
      setShowProctoringModal(true); // Re-open modal so user can try again
    } finally {
      setIsStartingProctoring(false);
    }
  };

  const handleViolationDetected = (type: string, data: unknown) => {
    setViolations(prev => {
      const newViolations = [...prev, { type, timestamp: new Date(), data }];
      setViolationCount(newViolations.length);
      return newViolations;
    });
  };

  const handlePauseStateChange = (state: PauseStatePayload) => {
    setIsSessionPaused(state.isPaused);
    setPauseReason(state.reason);
  };

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
      <Navbar />

      {/* Breadcrumb */}
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

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6">
        {!sessionStarted ? (
          <ChallengeOverview
            challenge={challenge}
            selectedLanguage={selectedLanguage}
            availableLanguages={supportedLanguages}
            onLanguageChange={handleLanguageChange}
            onStartSession={handleStartSession}
            onBack={() => navigate('/challenges')}
          />
        ) : (
          <>
            {/* Proctoring Monitor */}
            {sessionId && user && (
              <ProctoringMonitor
                sessionId={sessionId}
                userId={user.id}
                challengeId={id!}
                onViolation={handleViolationDetected}
                onPauseStateChange={handlePauseStateChange}
              />
            )}
            
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
            />
          </>
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
