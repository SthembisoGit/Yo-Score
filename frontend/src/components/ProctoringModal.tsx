// components/ProctoringModal.tsx
import { useState, useCallback, useEffect } from 'react';
import { Camera, Mic, AlertTriangle, Shield, X } from 'lucide-react';

interface ProctoringModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isLoading?: boolean;
}

export const ProctoringModal = ({ isOpen, onClose, onConfirm, isLoading = false }: ProctoringModalProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (isOpen) {
      // Center modal on open
      setPosition({
        x: (window.innerWidth - 448) / 2,
        y: (window.innerHeight - 500) / 2
      });
    }
  }, [isOpen]);

  const handleDragStart = (e: React.MouseEvent) => {
    // Don't drag if clicking on buttons or interactive elements
    if ((e.target as HTMLElement).closest('button')) return;
    setIsDragging(true);
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    });
  };

  const handleDrag = useCallback((e: MouseEvent) => {
    if (!isDragging) return;
    setPosition({
      x: Math.max(0, Math.min(e.clientX - dragStart.x, window.innerWidth - 448)),
      y: Math.max(0, Math.min(e.clientY - dragStart.y, window.innerHeight - 500))
    });
  }, [isDragging, dragStart]);

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleDrag);
      document.addEventListener('mouseup', handleDragEnd);
      return () => {
        document.removeEventListener('mousemove', handleDrag);
        document.removeEventListener('mouseup', handleDragEnd);
      };
    }
  }, [isDragging, handleDrag, handleDragEnd]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div
        className="bg-card rounded-lg shadow-xl max-w-md w-full p-6 cursor-move select-none"
        style={{
          position: 'absolute',
          left: `${position.x}px`,
          top: `${position.y}px`,
          cursor: isDragging ? 'grabbing' : 'default'
        }}
        onMouseDown={handleDragStart}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Shield className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-lg">Proctoring Required</h3>
            <p className="text-sm text-muted-foreground">Secure testing environment</p>
          </div>
          {/* Note: No close button - modal cannot be dismissed */}
        </div>

        <div className="space-y-4 mb-6">
          <div className="p-3 bg-muted rounded-lg">
            <p className="text-sm">
              To ensure fair evaluation, we'll monitor your session with:
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center">
                <Camera className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="font-medium text-sm">Camera Access</p>
                <p className="text-xs text-muted-foreground">Face detection and focus monitoring</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
                <Mic className="h-4 w-4 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="font-medium text-sm">Microphone Access</p>
                <p className="text-xs text-muted-foreground">Speech and background noise detection</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/20 flex items-center justify-center">
                <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="font-medium text-sm">Activity Monitoring</p>
                <p className="text-xs text-muted-foreground">Tab switching, copy/paste, and inactivity</p>
              </div>
            </div>
          </div>

          <div className="p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800">
            <p className="text-sm text-amber-800 dark:text-amber-300">
              <span className="font-medium">Important:</span> Your camera and microphone will remain active throughout the entire session. 
              Violations may affect your trust score. Ensure you're in a quiet, well-lit environment.
            </p>
          </div>

          <div className="p-3 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-800">
            <p className="text-sm text-red-800 dark:text-red-300">
              <span className="font-medium">Strict Mode:</span> This is a proctored session. 
              Any attempts to cheat, receive help, or use unauthorized resources will be detected and penalized.
            </p>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-lg border border-border hover:bg-muted transition-colors text-sm font-medium opacity-50 cursor-not-allowed"
            disabled
            title="Cannot cancel - proctoring is required"
          >
            Cancel (Disabled)
          </button>
          <button
            type="button"
            onClick={() => onConfirm()}
            disabled={isLoading}
            className="flex-1 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-sm font-medium disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Starting...' : 'Start Proctored Session'}
          </button>
        </div>
      </div>
    </div>
  );
};
