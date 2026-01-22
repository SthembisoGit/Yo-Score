import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Clock, Award, FileText, ChevronRight } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { CodeEditor } from '@/components/CodeEditor';
import { ProctoringModal } from '@/components/ProctoringModal';
import { Button } from '@/components/ui/button';
import { useChallenges } from '@/context/ChallengeContext';
import { cn } from '@/lib/utils';

const difficultyColors = {
  Easy: 'bg-success/10 text-success',
  Medium: 'bg-warning/10 text-warning',
  Hard: 'bg-destructive/10 text-destructive',
};

// Mock reference docs
const referenceDocs = [
  { title: 'Getting Started', content: 'This section covers the basics of the challenge...' },
  { title: 'API Reference', content: 'Available functions and methods you can use...' },
  { title: 'Examples', content: 'Sample code snippets to help you get started...' },
];

export default function ChallengeDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { challenges } = useChallenges();
  const [showProctoringModal, setShowProctoringModal] = useState(false);
  const [sessionStarted, setSessionStarted] = useState(false);
  const [activeDoc, setActiveDoc] = useState(0);
  const [showDocs, setShowDocs] = useState(false);

  const challenge = challenges.find((c) => c.id === id);

  if (!challenge) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex items-center justify-center h-[60vh]">
          <div className="text-center">
            <p className="text-muted-foreground mb-4">Challenge not found</p>
            <Link to="/challenges">
              <Button>Back to Challenges</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const handleStartSession = () => {
    setShowProctoringModal(true);
  };

  const handleProctoringConfirm = () => {
    setShowProctoringModal(false);
    setSessionStarted(true);
  };

  const handleSubmit = (code: string) => {
    // In a real app, this would submit to the backend
    console.log('Submitting code:', code);
    navigate('/challenges');
  };

  return (
    <div className="min-h-screen bg-muted flex flex-col">
      <Navbar />

      {/* Breadcrumb */}
      <div className="bg-card border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center gap-2 text-sm">
            <Link to="/challenges" className="text-muted-foreground hover:text-foreground">
              Challenges
            </Link>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium truncate">{challenge.title}</span>
          </div>
        </div>
      </div>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6">
        {!sessionStarted ? (
          /* Challenge Overview */
          <div className="max-w-3xl mx-auto">
            <button
              onClick={() => navigate('/challenges')}
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Challenges
            </button>

            <div className="bg-card border border-border rounded-lg overflow-hidden">
              <div className="p-6 lg:p-8">
                <div className="flex flex-wrap items-center gap-3 mb-4">
                  <span className="text-sm font-medium px-2 py-1 bg-muted rounded">
                    {challenge.category}
                  </span>
                  <span
                    className={cn(
                      'text-sm font-medium px-2 py-1 rounded',
                      difficultyColors[challenge.difficulty]
                    )}
                  >
                    {challenge.difficulty}
                  </span>
                </div>

                <h1 className="text-2xl lg:text-3xl font-bold mb-4">{challenge.title}</h1>
                <p className="text-muted-foreground mb-6">{challenge.description}</p>

                <div className="flex flex-wrap items-center gap-6 mb-8 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span>{challenge.duration} minutes</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Award className="h-4 w-4" />
                    <span>{challenge.points} points</span>
                  </div>
                </div>

                <div className="bg-accent border border-border rounded-lg p-4 mb-6">
                  <h3 className="font-medium mb-2">Before you start:</h3>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>Ensure you have a working webcam</li>
                    <li>Find a quiet environment with good lighting</li>
                    <li>Close all unnecessary browser tabs</li>
                    <li>Reference documentation will be available during the challenge</li>
                  </ul>
                </div>

                <Button size="lg" onClick={handleStartSession} className="w-full sm:w-auto">
                  Start Challenge
                </Button>
              </div>
            </div>
          </div>
        ) : (
          /* Active Challenge Session */
          <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-180px)]">
            {/* Left Panel - Description & Docs */}
            <div className="lg:w-1/3 flex flex-col">
              <div className="bg-card border border-border rounded-lg overflow-hidden flex-1 flex flex-col">
                {/* Tabs */}
                <div className="flex border-b border-border">
                  <button
                    onClick={() => setShowDocs(false)}
                    className={cn(
                      'flex-1 px-4 py-3 text-sm font-medium transition-colors',
                      !showDocs ? 'bg-muted border-b-2 border-primary' : 'hover:bg-muted/50'
                    )}
                  >
                    Description
                  </button>
                  <button
                    onClick={() => setShowDocs(true)}
                    className={cn(
                      'flex-1 px-4 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-2',
                      showDocs ? 'bg-muted border-b-2 border-primary' : 'hover:bg-muted/50'
                    )}
                  >
                    <FileText className="h-4 w-4" />
                    Reference
                  </button>
                </div>

                <div className="flex-1 overflow-auto p-4">
                  {!showDocs ? (
                    <div>
                      <h2 className="text-xl font-bold mb-3">{challenge.title}</h2>
                      <div className="flex items-center gap-3 mb-4">
                        <span className="text-xs font-medium px-2 py-1 bg-muted rounded">
                          {challenge.category}
                        </span>
                        <span
                          className={cn(
                            'text-xs font-medium px-2 py-1 rounded',
                            difficultyColors[challenge.difficulty]
                          )}
                        >
                          {challenge.difficulty}
                        </span>
                      </div>
                      <p className="text-muted-foreground text-sm">{challenge.description}</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Doc Navigation */}
                      <div className="flex flex-wrap gap-2">
                        {referenceDocs.map((doc, index) => (
                          <button
                            key={doc.title}
                            onClick={() => setActiveDoc(index)}
                            className={cn(
                              'px-3 py-1.5 text-sm rounded-md transition-colors',
                              activeDoc === index
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-muted hover:bg-muted/80'
                            )}
                          >
                            {doc.title}
                          </button>
                        ))}
                      </div>

                      {/* Doc Content */}
                      <div className="prose prose-sm">
                        <h3 className="font-semibold">{referenceDocs[activeDoc].title}</h3>
                        <p className="text-muted-foreground">
                          {referenceDocs[activeDoc].content}
                        </p>
                        <pre className="bg-muted p-3 rounded text-xs overflow-auto">
                          {`// Example code\nfunction example() {\n  return "Hello World";\n}`}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right Panel - Code Editor */}
            <div className="lg:w-2/3 flex-1">
              <CodeEditor onSubmit={handleSubmit} className="h-full" />
            </div>
          </div>
        )}
      </main>

      {/* Proctoring Modal */}
      <ProctoringModal
        isOpen={showProctoringModal}
        onClose={() => setShowProctoringModal(false)}
        onConfirm={handleProctoringConfirm}
      />
    </div>
  );
}
