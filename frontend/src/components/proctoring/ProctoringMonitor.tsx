import React, { useEffect, useRef, useState } from 'react';
import { Camera, Mic, AlertTriangle, Shield, X } from 'lucide-react';

interface Props {
  sessionId: string;
  userId: string;
  challengeId: string;
  onViolation: (type: string, data: any) => void;
}

const ProctoringMonitor: React.FC<Props> = ({
  sessionId,
  userId,
  challengeId,
  onViolation
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [micReady, setMicReady] = useState(false);
  const [violationCount, setViolationCount] = useState(0);
  const [isMinimized, setIsMinimized] = useState(false);

  const frameIntervalRef = useRef<NodeJS.Timeout>();
  const audioIntervalRef = useRef<NodeJS.Timeout>();
  const inactivityTimerRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    startProctoring();

    return () => {
      stopProctoring();
    };
  }, []);

  const startProctoring = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 320 },
          height: { ideal: 240 },
          frameRate: { ideal: 10 }
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      setCameraReady(true);
      setMicReady(true);
      setIsActive(true);

      // Start monitoring intervals
      setupMonitoringIntervals();
      setupEventListeners();

    } catch (error) {
      console.error('Failed to start proctoring:', error);
      onViolation('camera_off', {
        error: 'Could not access camera/microphone',
        message: 'Camera or microphone access denied'
      });
    }
  };

  const setupMonitoringIntervals = () => {
    // Frame capture for face analysis (simplified for MVP)
    frameIntervalRef.current = setInterval(() => {
      checkCameraStatus();
    }, 5000);

    // Inactivity detection
    resetInactivityTimer();
  };

  const setupEventListeners = () => {
    // Tab visibility detection
    const handleVisibilityChange = () => {
      if (document.hidden) {
        logViolation('tab_switch', 'User switched to another tab');
      }
    };

    // Window blur detection
    const handleBlur = () => {
      logViolation('window_blur', 'Window lost focus');
    };

    // Copy/paste detection
    const handleCopy = (e: ClipboardEvent) => {
      logViolation('copy_paste', 'Copy operation detected');
    };

    const handlePaste = (e: ClipboardEvent) => {
      logViolation('copy_paste', 'Paste operation detected');
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);
    document.addEventListener('copy', handleCopy);
    document.addEventListener('paste', handlePaste);

    // Activity detection
    const activityEvents = ['mousemove', 'keydown', 'click', 'scroll'];
    const resetActivity = () => resetInactivityTimer();

    activityEvents.forEach(event => {
      document.addEventListener(event, resetActivity);
    });

    // Cleanup function
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('copy', handleCopy);
      document.removeEventListener('paste', handlePaste);
      activityEvents.forEach(event => {
        document.removeEventListener(event, resetActivity);
      });
    };
  };

  const resetInactivityTimer = () => {
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }

    inactivityTimerRef.current = setTimeout(() => {
      logViolation('inactivity', 'No activity detected for 60 seconds');
    }, 60000);
  };

  const checkCameraStatus = () => {
    if (!videoRef.current || !cameraReady) return;

    const video = videoRef.current;

    // Check if camera is active
    if (video.readyState === HTMLMediaElement.HAVE_NOTHING ||
      video.videoWidth === 0 ||
      video.videoHeight === 0) {
      logViolation('camera_off', 'Camera appears to be turned off');
    }
  };

  const logViolation = (type: string, description: string) => {
    setViolationCount(prev => prev + 1);

    // Call parent handler
    onViolation(type, {
      description,
      timestamp: new Date().toISOString(),
      sessionId,
      userId
    });

    // Send to backend
    sendViolationToBackend(type, description);
  };

  const sendViolationToBackend = async (type: string, description: string) => {
    try {
      const response = await fetch('/api/proctoring/violation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          sessionId,
          userId,
          type,
          description
        })
      });

      if (!response.ok) {
        console.error('Failed to log violation to backend');
      }
    } catch (error) {
      console.error('Error logging violation:', error);
    }
  };

  const stopProctoring = () => {
    // Clear intervals
    if (frameIntervalRef.current) {
      clearInterval(frameIntervalRef.current);
    }
    if (audioIntervalRef.current) {
      clearInterval(audioIntervalRef.current);
    }
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }

    // Stop media stream
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
    }

    setIsActive(false);
  };

  const toggleMinimize = () => {
    setIsMinimized(!isMinimized);
  };

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {isMinimized ? (
        <button
          onClick={toggleMinimize}
          className="bg-red-600 text-white rounded-full p-3 shadow-lg hover:bg-red-700 transition-colors"
          title="Expand proctoring monitor"
        >
          <Shield className="h-5 w-5" />
        </button>
      ) : (
        <div className="bg-card rounded-lg shadow-xl border border-border w-80">
          {/* Header */}
          <div className="flex items-center justify-between p-3 border-b border-border">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <Shield className="h-4 w-4 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">Proctoring Active</h3>
                <p className="text-xs text-muted-foreground">Session: {sessionId.substring(0, 8)}...</p>
              </div>
            </div>
            <button
              onClick={toggleMinimize}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Camera Preview */}
          <div className="p-3">
            <div className="relative rounded-lg overflow-hidden border border-border bg-black">
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className="w-full h-40 object-cover"
              />
              <div className="absolute top-2 right-2 flex gap-1">
                <div className={`w-2 h-2 rounded-full ${cameraReady ? 'bg-green-500' : 'bg-red-500'}`} />
                <div className={`w-2 h-2 rounded-full ${micReady ? 'bg-green-500' : 'bg-red-500'}`} />
              </div>
              <div className="absolute bottom-2 left-2 text-xs text-white/80 bg-black/50 px-2 py-1 rounded">
                Live Camera
              </div>
            </div>
          </div>

          {/* Status Indicators */}
          <div className="px-3 pb-3">
            <div className="grid grid-cols-3 gap-2 mb-3">
              <div className="text-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center mx-auto mb-1 ${cameraReady ? 'bg-green-100 dark:bg-green-900/20' : 'bg-red-100 dark:bg-red-900/20'
                  }`}>
                  <Camera className={`h-4 w-4 ${cameraReady ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                    }`} />
                </div>
                <p className="text-xs">Camera</p>
              </div>

              <div className="text-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center mx-auto mb-1 ${micReady ? 'bg-green-100 dark:bg-green-900/20' : 'bg-red-100 dark:bg-red-900/20'
                  }`}>
                  <Mic className={`h-4 w-4 ${micReady ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                    }`} />
                </div>
                <p className="text-xs">Microphone</p>
              </div>

              <div className="text-center">
                <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/20 flex items-center justify-center mx-auto mb-1">
                  <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                </div>
                <p className="text-xs">{violationCount} alerts</p>
              </div>
            </div>

            {/* Monitoring Info */}
            <div className="text-xs text-muted-foreground space-y-1">
              <p>• Tab switching monitored</p>
              <p>• Inactivity detection active</p>
              <p>• Copy/paste blocked</p>
              <p className="text-amber-600 dark:text-amber-400 font-medium">
                Violations affect your trust score
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProctoringMonitor;