// components/challenge-detail/ChallengeOverview.tsx
import { ArrowLeft, Monitor } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DescriptionPanel } from './DescriptionPanel';
import { LanguageSelector } from './LanguageSelector';

interface ChallengeOverviewProps {
  challenge: any;
  selectedLanguage: string;
  availableLanguages: string[];
  onLanguageChange: (language: string) => void;
  onStartSession: () => void;
  onBack: () => void;
}

export const ChallengeOverview = ({
  challenge,
  selectedLanguage,
  availableLanguages,
  onLanguageChange,
  onStartSession,
  onBack
}: ChallengeOverviewProps) => {
  return (
    <div className="max-w-3xl mx-auto">
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Challenges
      </button>

      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
        <div className="p-6 lg:p-8">
          <DescriptionPanel challenge={challenge} />
          
          <div className="bg-muted/50 border border-border rounded-lg p-4 mt-6 mb-6">
            <div className="flex items-start gap-3">
              <Monitor className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <h3 className="font-medium mb-2">Proctoring Requirements</h3>
                <ul className="text-sm text-muted-foreground space-y-1.5">
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary"></div>
                    Webcam access required for verification
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary"></div>
                    Browser tab monitoring enabled
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary"></div>
                    Reference documentation provided
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary"></div>
                    Screen recording for quality assurance
                  </li>
                </ul>
              </div>
            </div>
          </div>

          <LanguageSelector
            selectedLanguage={selectedLanguage}
            onLanguageChange={onLanguageChange}
            availableLanguages={availableLanguages}
            className="mb-6"
            size="lg"
          />

          <Button 
            size="lg" 
            onClick={onStartSession} 
            className="w-full sm:w-auto px-8"
          >
            Start Challenge Session
          </Button>
        </div>
      </div>
    </div>
  );
};