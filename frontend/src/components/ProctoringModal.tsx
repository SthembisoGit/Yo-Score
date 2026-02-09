import { useState, useCallback, useEffect } from 'react';
import { Camera, Mic, AlertTriangle, Shield } from 'lucide-react';

interface ProctoringModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isLoading?: boolean;
}

interface DeviceReadiness {
  camera: boolean;
  microphone: boolean;
  audio: boolean;
}

const defaultDeviceReadiness: DeviceReadiness = {
  camera: false,
  microphone: false,
  audio: false,
};

export const ProctoringModal = ({
  isOpen,
  onClose,
  onConfirm,
  isLoading = false,
}: ProctoringModalProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isCheckingDevices, setIsCheckingDevices] = useState(false);
  const [deviceError, setDeviceError] = useState<string | null>(null);
  const [deviceReadiness, setDeviceReadiness] =
    useState<DeviceReadiness>(defaultDeviceReadiness);

  const allDevicesReady =
    deviceReadiness.camera && deviceReadiness.microphone && deviceReadiness.audio;

  const checkDeviceReadiness = useCallback(async () => {
    setIsCheckingDevices(true);
    setDeviceError(null);
    setDeviceReadiness(defaultDeviceReadiness);

    let stream: MediaStream | null = null;

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Your browser does not support camera/microphone checks.');
      }

      stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      const videoTrack = stream.getVideoTracks()[0];
      const audioTrack = stream.getAudioTracks()[0];
      const audioContextSupported = Boolean(
        window.AudioContext ||
          (window as Window & { webkitAudioContext?: typeof AudioContext })
            .webkitAudioContext,
      );

      const readiness: DeviceReadiness = {
        camera:
          Boolean(videoTrack) &&
          videoTrack.readyState === 'live' &&
          videoTrack.enabled,
        microphone:
          Boolean(audioTrack) &&
          audioTrack.readyState === 'live' &&
          audioTrack.enabled,
        audio: audioContextSupported,
      };

      setDeviceReadiness(readiness);

      if (!readiness.camera || !readiness.microphone || !readiness.audio) {
        setDeviceError(
          'Camera, microphone, and audio support are required. Enable permissions and re-check.',
        );
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unable to access camera/microphone. Check browser permissions.';
      setDeviceError(message);
      setDeviceReadiness(defaultDeviceReadiness);
    } finally {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
      setIsCheckingDevices(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      setPosition({
        x: (window.innerWidth - 448) / 2,
        y: (window.innerHeight - 560) / 2,
      });
      void checkDeviceReadiness();
    }
  }, [isOpen, checkDeviceReadiness]);

  const handleDragStart = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    setIsDragging(true);
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    });
  };

  const handleDrag = useCallback(
    (e: MouseEvent) => {
      if (!isDragging) return;
      setPosition({
        x: Math.max(0, Math.min(e.clientX - dragStart.x, window.innerWidth - 448)),
        y: Math.max(0, Math.min(e.clientY - dragStart.y, window.innerHeight - 560)),
      });
    },
    [isDragging, dragStart],
  );

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (!isDragging) return;
    document.addEventListener('mousemove', handleDrag);
    document.addEventListener('mouseup', handleDragEnd);
    return () => {
      document.removeEventListener('mousemove', handleDrag);
      document.removeEventListener('mouseup', handleDragEnd);
    };
  }, [isDragging, handleDrag, handleDragEnd]);

  if (!isOpen) return null;

  const statusClass = (ready: boolean) =>
    ready
      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
      : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div
        className="bg-card rounded-lg shadow-xl max-w-md w-full p-6 cursor-move select-none"
        style={{
          position: 'absolute',
          left: `${position.x}px`,
          top: `${position.y}px`,
          cursor: isDragging ? 'grabbing' : 'default',
        }}
        onMouseDown={handleDragStart}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Shield className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-lg">Proctoring Required</h3>
            <p className="text-sm text-muted-foreground">
              Camera, mic, and audio are mandatory
            </p>
          </div>
        </div>

        <div className="space-y-4 mb-6">
          <div className="p-3 bg-muted rounded-lg">
            <p className="text-sm">
              You cannot start this challenge until all required devices are ready.
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Camera className="h-4 w-4" />
                <span className="text-sm font-medium">Camera</span>
              </div>
              <span className={`text-xs px-2 py-1 rounded-full ${statusClass(deviceReadiness.camera)}`}>
                {deviceReadiness.camera ? 'Ready' : 'Not ready'}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Mic className="h-4 w-4" />
                <span className="text-sm font-medium">Microphone</span>
              </div>
              <span className={`text-xs px-2 py-1 rounded-full ${statusClass(deviceReadiness.microphone)}`}>
                {deviceReadiness.microphone ? 'Ready' : 'Not ready'}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                <span className="text-sm font-medium">Audio Support</span>
              </div>
              <span className={`text-xs px-2 py-1 rounded-full ${statusClass(deviceReadiness.audio)}`}>
                {deviceReadiness.audio ? 'Ready' : 'Not ready'}
              </span>
            </div>
          </div>

          {deviceError && (
            <div className="p-3 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-800">
              <p className="text-sm text-red-800 dark:text-red-300">{deviceError}</p>
            </div>
          )}

          <div className="p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800">
            <p className="text-sm text-amber-800 dark:text-amber-300">
              Keep camera and microphone on during the whole session. Violations affect your trust score.
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
            onClick={() => void checkDeviceReadiness()}
            disabled={isLoading || isCheckingDevices}
            className="px-4 py-2.5 rounded-lg border border-border hover:bg-muted transition-colors text-sm font-medium disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isCheckingDevices ? 'Checking...' : 'Re-check'}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading || isCheckingDevices || !allDevicesReady}
            className="flex-1 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-sm font-medium disabled:opacity-70 disabled:cursor-not-allowed"
            title={allDevicesReady ? 'Start session' : 'Enable camera, mic, and audio first'}
          >
            {isLoading ? 'Starting...' : 'Start Proctored Session'}
          </button>
        </div>
      </div>
    </div>
  );
};
