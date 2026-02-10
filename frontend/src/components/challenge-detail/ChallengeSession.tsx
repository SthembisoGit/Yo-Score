// components/challenge-detail/ChallengeSession.tsx
import { useState, useEffect } from 'react';
import { FileText, Loader2, AlertCircle, Shield, Camera, Mic } from 'lucide-react';
import { CodeEditor } from '@/components/CodeEditor';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { DescriptionPanel } from './DescriptionPanel';
import { ReferenceDocsPanel } from './ReferenceDocsPanel';
import { LanguageSelector } from './LanguageSelector';
import { challengeService } from '@/services/challengeService';
import { proctoringService } from '@/services/proctoring.service';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

interface ChallengeSessionProps {
  challenge: any;
  referenceDocs: any[];
  selectedLanguage: string;
  availableLanguages: string[];
  onLanguageChange: (language: string) => void;
  challengeId: string;
  sessionId?: string | null;
  onViolation?: (type: string, data: any) => void;
  violationCount?: number;
  isSessionPaused?: boolean;
  pauseReason?: string;
}

export const ChallengeSession = ({
  challenge,
  referenceDocs,
  selectedLanguage,
  availableLanguages,
  onLanguageChange,
  challengeId,
  sessionId,
  onViolation,
  violationCount: propViolationCount = 0,
  isSessionPaused = false,
  pauseReason = ''
}: ChallengeSessionProps) => {
  const navigate = useNavigate();
  const [showDocs, setShowDocs] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [code, setCode] = useState<string>('// Write your solution here\n');
  const [proctoringReady, setProctoringReady] = useState(false);
  const [violationCount, setViolationCount] = useState(propViolationCount);
  const [isSessionEnded, setIsSessionEnded] = useState(false);

  // Initialize with language-specific template
  useEffect(() => {
    const templates: Record<string, string> = {
      'javascript': `function solution(input) {
  // Your code here
  return input;
}

// Test your solution
console.log(solution("test"));`,
      'python': `def solution(input):
    # Your code here
    return input

# Test your solution
print(solution("test"))`,
      'java': `public class Solution {
    public static String solution(String input) {
        // Your code here
        return input;
    }
    
    public static void main(String[] args) {
        System.out.println(solution("test"));
    }
}`,
      'cpp': `#include <iostream>
#include <string>

std::string solution(const std::string& input) {
    // Your code here
    return input;
}

int main() {
    std::cout << solution("test") << std::endl;
    return 0;
}`
    };

    if (selectedLanguage && templates[selectedLanguage.toLowerCase()]) {
      setCode(templates[selectedLanguage.toLowerCase()]);
    }
  }, [selectedLanguage]);

  // Check proctoring status
  useEffect(() => {
    if (sessionId) {
      setProctoringReady(true);
      toast.success('Proctoring session is active');
    }
  }, [sessionId]);

  // Update violation count from parent
  useEffect(() => {
    setViolationCount(propViolationCount);
    
    // Show warning after 3 violations
    if (propViolationCount >= 3) {
      toast(`Multiple proctoring violations (${propViolationCount}). Your trust score may be affected.`, {
        duration: 6000,
        icon: '⚠️'
      });
    }
  }, [propViolationCount]);

  const handleCodeChange = (newCode: string) => {
    setCode(newCode);
  };

  const handleSubmit = async () => {
    if (isSessionPaused) {
      setSubmissionError('Session is paused. Re-enable camera, microphone, and audio to continue.');
      return;
    }

    if (!selectedLanguage) {
      setSubmissionError('Please select a programming language before submitting.');
      return;
    }

    if (!code.trim() || code.trim().startsWith('// Write your solution here')) {
      setSubmissionError('Please write your solution before submitting.');
      return;
    }

    setIsSubmitting(true);
    setSubmissionError(null);

    try {
      const submission = await challengeService.submitChallenge(
        challengeId,
        code,
        sessionId || undefined
      );

      if (sessionId && proctoringReady) {
        try {
          await proctoringService.endSession(sessionId, submission.submission_id);
          toast.success('Proctoring session completed');
          setIsSessionEnded(true);
        } catch (error) {
          console.error('Failed to end proctoring session:', error);
        }
      }

      toast.success('Challenge submitted successfully!', {
        duration: 3000,
      });

      setTimeout(() => {
        navigate(`/submissions/${submission.submission_id}`);
      }, 1200);
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to submit challenge.';
      setSubmissionError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEndSessionEarly = async () => {
    if (!sessionId || !proctoringReady || isSessionEnded) return;

    if (window.confirm('Are you sure you want to end the session early? This will save your progress but may affect your trust score.')) {
      try {
        await proctoringService.endSession(sessionId);
        setIsSessionEnded(true);
        toast('Session ended early. You can continue working offline.');
      } catch (error) {
        console.error('Failed to end session:', error);
        toast.error('Failed to end session');
      }
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-180px)]">
      {/* Left Panel - Description & Docs */}
      <div className="lg:w-1/3 flex flex-col">
        <div className="bg-card border border-border rounded-xl overflow-hidden flex-1 flex flex-col shadow-sm">
          {/* Tabs */}
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
            </button>
          </div>

          <div className="flex-1 overflow-auto p-4">
            {!showDocs ? (
              <div className="space-y-6">
                <DescriptionPanel challenge={challenge} compact />
                
                {/* Proctoring Status */}
                {sessionId && (
                  <div className="pt-4 border-t border-border">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4 text-primary" />
                        <h4 className="font-medium text-sm">Proctoring Status</h4>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        proctoringReady ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400' : 'bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-400'
                      }`}>
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
                          {proctoringReady ? '✓ Monitoring' : 'Initializing'}
                        </span>
                      </div>
                      
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <Mic className="h-3 w-3" />
                          <span>Microphone</span>
                        </div>
                        <span className={proctoringReady ? 'text-green-600' : 'text-muted-foreground'}>
                          {proctoringReady ? '✓ Monitoring' : 'Initializing'}
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
                    
                    {violationCount > 0 && (
                      <div className="mt-3 p-2 bg-amber-50 dark:bg-amber-950/20 rounded text-xs text-amber-800 dark:text-amber-300">
                        <p className="font-medium">⚠️ {violationCount} violation(s) recorded</p>
                        <p className="mt-1">Multiple violations may reduce your trust score.</p>
                      </div>
                    )}
                    
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
              </div>
            ) : (
              <ReferenceDocsPanel docs={referenceDocs} />
            )}
          </div>
        </div>
      </div>

      {/* Right Panel - Code Editor */}
      <div className="lg:w-2/3 flex flex-col gap-4">
        {submissionError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{submissionError}</AlertDescription>
          </Alert>
        )}
        
        {!proctoringReady && sessionId && (
          <Alert variant="default" className="bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800">
            <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <AlertDescription className="text-amber-800 dark:text-amber-300">
              Proctoring is initializing. Please ensure your camera and microphone are enabled.
            </AlertDescription>
          </Alert>
        )}

        {isSessionPaused && (
          <Alert variant="default" className="bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800">
            <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
            <AlertDescription className="text-red-800 dark:text-red-300">
              Session paused by proctoring. {pauseReason || 'Restore required devices from the proctoring modal to continue.'}
            </AlertDescription>
          </Alert>
        )}
        
        <div className="bg-card border border-border rounded-xl overflow-hidden flex-1 shadow-sm">
          <CodeEditor 
            language={selectedLanguage.toLowerCase()}
            value={code}
            onChange={handleCodeChange}
            className="h-full"
            readOnly={isSubmitting || isSessionEnded || isSessionPaused}
          />
        </div>
        
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <p className="text-sm text-muted-foreground">
              Writing solution in {selectedLanguage}
            </p>
            
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
              onClick={handleSubmit}
              disabled={isSubmitting || !selectedLanguage || isSessionEnded || isSessionPaused}
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
