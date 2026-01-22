import { useState, useEffect } from 'react';
import { Camera, AlertTriangle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ProctoringModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function ProctoringModal({ isOpen, onClose, onConfirm }: ProctoringModalProps) {
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [focusLost, setFocusLost] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        setFocusLost(true);
      }
    };

    const handleBlur = () => {
      setFocusLost(true);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-foreground/50" onClick={onClose} />
      
      {/* Modal */}
      <div className="relative bg-accent rounded-lg shadow-lg max-w-md w-full mx-4 border-2 border-primary overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-primary text-primary-foreground">
          <h2 className="text-lg font-semibold">Proctoring Session</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-primary-foreground/20 rounded transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Camera Preview Placeholder */}
          <div className="aspect-video bg-foreground/10 rounded-lg flex items-center justify-center border border-border">
            {cameraEnabled ? (
              <div className="text-center">
                <Camera className="h-12 w-12 mx-auto text-primary mb-2" />
                <p className="text-sm text-muted-foreground">Camera Active</p>
              </div>
            ) : (
              <div className="text-center">
                <Camera className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">Camera Disabled</p>
              </div>
            )}
          </div>

          {/* Focus Warning */}
          {focusLost && (
            <div className="flex items-start gap-3 p-4 bg-destructive/10 rounded-lg border border-destructive/20">
              <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-destructive">Focus Lost Detected</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Please keep this window focused during the challenge.
                </p>
              </div>
            </div>
          )}

          {/* Instructions */}
          <div className="space-y-2 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Proctoring Requirements:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Keep camera enabled throughout the session</li>
              <li>Do not switch tabs or windows</li>
              <li>No external assistance allowed</li>
              <li>Reference panel is available within the platform</li>
            </ul>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => setCameraEnabled(!cameraEnabled)}
              className={cn(
                'flex-1 gap-2',
                cameraEnabled && 'bg-primary text-primary-foreground hover:bg-primary/90'
              )}
            >
              <Camera className="h-4 w-4" />
              {cameraEnabled ? 'Camera On' : 'Enable Camera'}
            </Button>
            <Button
              onClick={onConfirm}
              disabled={!cameraEnabled}
              className="flex-1"
            >
              Start Challenge
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
