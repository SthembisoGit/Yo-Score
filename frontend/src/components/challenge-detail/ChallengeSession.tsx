// components/challenge-detail/ChallengeSession.tsx
import { useState } from 'react';
import { FileText, Loader2, AlertCircle } from 'lucide-react';
import { CodeEditor } from '@/components/CodeEditor';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { DescriptionPanel } from './DescriptionPanel';
import { ReferenceDocsPanel } from './ReferenceDocsPanel';
import { LanguageSelector } from './LanguageSelector';
import { challengeService } from '@/services/challengeService';

interface ChallengeSessionProps {
  challenge: any;
  referenceDocs: any[];
  selectedLanguage: string;
  availableLanguages: string[];
  onLanguageChange: (language: string) => void;
  challengeId: string;
}

export const ChallengeSession = ({
  challenge,
  referenceDocs,
  selectedLanguage,
  availableLanguages,
  onLanguageChange,
  challengeId
}: ChallengeSessionProps) => {
  const [showDocs, setShowDocs] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [code, setCode] = useState<string>('// Write your solution here\n');

  const handleCodeChange = (newCode: string) => {
    setCode(newCode);
  };

  const handleSubmit = async () => {
    if (!selectedLanguage) {
      setSubmissionError('Please select a programming language before submitting.');
      return;
    }

    if (!code.trim() || code.trim() === '// Write your solution here\n') {
      setSubmissionError('Please write some code before submitting.');
      return;
    }

    setIsSubmitting(true);
    setSubmissionError(null);

    try {
      const submission = await challengeService.submitChallenge(challengeId, code);
      // In a real app, you would navigate to submission results
      console.log('Submission successful:', submission);
      alert('Challenge submitted successfully! Your solution is being evaluated.');
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to submit challenge. Please try again.';
      setSubmissionError(errorMessage);
      console.error('Submission error:', err);
    } finally {
      setIsSubmitting(false);
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
        
        <div className="bg-card border border-border rounded-xl overflow-hidden flex-1 shadow-sm">
          <CodeEditor 
            language={selectedLanguage.toLowerCase()}
            value={code}
            onChange={handleCodeChange}
            className="h-full"
            readOnly={isSubmitting}
          />
        </div>
        
        <div className="flex justify-between items-center">
          <p className="text-sm text-muted-foreground">
            Writing solution in {selectedLanguage}
          </p>
          
          <Button 
            onClick={handleSubmit}
            disabled={isSubmitting || !selectedLanguage}
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
  );
};