import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ChevronRight, Loader2, AlertCircle, FileText } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { ProctoringModal } from '@/components/ProctoringModal';
import { Button } from '@/components/ui/button';
import { ChallengeOverview } from '@/components/challenge-detail/ChallengeOverview';
import { ChallengeSession } from '@/components/challenge-detail/ChallengeSession';
import { useChallengeData } from '@/hooks/useChallengeData';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'react-hot-toast';
import ProctoringMonitor from '@/components/proctoring/ProctoringMonitor';
import { useProctoring } from '@/hooks/useProctoring';

export default function ChallengeDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, setPreferredLanguage, availableLanguages } = useAuth();
  
  const { challenge, referenceDocs, isLoading, error } = useChallengeData(id);
  const [showProctoringModal, setShowProctoringModal] = useState(false);
  const [sessionStarted, setSessionStarted] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState<string>('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [violations, setViolations] = useState<any[]>([]);
  const [violationCount, setViolationCount] = useState(0);
  const [isStartingProctoring, setIsStartingProctoring] = useState(false);

  const { startSession, endSession, logViolation, isActive } = useProctoring();

  // Initialize language from user preference
  useState(() => {
    if (user?.preferredLanguage) {
      setSelectedLanguage(user.preferredLanguage);
    } else if (availableLanguages.length > 0) {
      setSelectedLanguage(availableLanguages[0]);
    }
  });

  const handleLanguageChange = (language: string) => {
    setSelectedLanguage(language);
    if (user) {
      setPreferredLanguage(language as any);
    }
  };

  const handleStartSession = () => {
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
      const newSessionId = await startSession(id, user.id);
      setSessionId(newSessionId);
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

  const handleViolationDetected = (type: string, data: any) => {
    setViolations(prev => {
      const newViolations = [...prev, { type, timestamp: new Date(), data }];
      setViolationCount(newViolations.length);
      return newViolations;
    });
    
    // Log to backend
    if (sessionId) {
      logViolation(sessionId, type, data.description || `Violation: ${type}`);
    }
    
    // Show warning
    toast(`Proctoring alert: ${type}`, {
      duration: 5000,
      icon: '⚠️'
    });
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
            availableLanguages={availableLanguages}
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
              />
            )}
            
            <ChallengeSession
              challenge={challenge}
              referenceDocs={referenceDocs}
              selectedLanguage={selectedLanguage}
              availableLanguages={availableLanguages}
              onLanguageChange={handleLanguageChange}
              challengeId={id!}
              sessionId={sessionId}
              onViolation={handleViolationDetected}
              violationCount={violationCount}
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