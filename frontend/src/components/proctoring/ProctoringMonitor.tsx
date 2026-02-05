import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Camera, Mic, AlertTriangle, Shield, X, Minimize2, Maximize2 } from 'lucide-react';
import { proctoringService } from '@/services/proctoring.service';
import { toast } from 'react-hot-toast';

interface Props {
  sessionId: string;
  userId: string;
  challengeId: string;
  onViolation: (type: string, data: any) => void;
}

interface ViolationAlert {
  id: string;
  type: string;
  message: string;
  timestamp: Date;
  severity: 'low' | 'medium' | 'high';
}

const ProctoringMonitor: React.FC<Props> = ({
  sessionId,
  userId,
  challengeId,
  onViolation
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  
  const [isActive, setIsActive] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [micReady, setMicReady] = useState(false);
  const [violationCount, setViolationCount] = useState(0);
  const [isMinimized, setIsMinimized] = useState(false);
  const [alerts, setAlerts] = useState<ViolationAlert[]>([]);
  const [position, setPosition] = useState({ x: window.innerWidth - 340, y: 20 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  
  const frameIntervalRef = useRef<NodeJS.Timeout>();
  const audioIntervalRef = useRef<NodeJS.Timeout>();
  const inactivityTimerRef = useRef<NodeJS.Timeout>();
  const violationCheckIntervalRef = useRef<NodeJS.Timeout>();
  const cameraOffCheckRef = useRef<NodeJS.Timeout>();
  const lastCameraCheckRef = useRef<number>(Date.now());
  const consecutiveCameraOffRef = useRef<number>(0);
  const lastAudioChunkTimeRef = useRef<number>(Date.now());

  // Frame capture interval (every 3 seconds for ML analysis)
  const FRAME_CAPTURE_INTERVAL = 3000;
  // Audio chunk duration (10 seconds)
  const AUDIO_CHUNK_DURATION = 10000;
  // Camera health check interval (every 1 second - very aggressive)
  const CAMERA_CHECK_INTERVAL = 1000;
  // Violation status check interval (every 5 seconds)
  const VIOLATION_CHECK_INTERVAL = 5000;

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
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 15 }
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100
        }
      });

      mediaStreamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(console.error);
      }

      // Setup audio recording
      setupAudioRecording(stream);

      setCameraReady(true);
      setMicReady(true);
      setIsActive(true);

      // Start monitoring intervals
      setupMonitoringIntervals();
      setupEventListeners();
      startViolationStatusPolling();

      toast.success('Proctoring session active. Camera and microphone are monitoring.', {
        duration: 3000,
      });

    } catch (error: any) {
      console.error('Failed to start proctoring:', error);
      const message = error.message || 'Camera or microphone access denied';
      showViolationAlert('camera_off', 'Camera or microphone access denied. Please enable permissions.', 'high');
      onViolation('camera_off', {
        error: 'Could not access camera/microphone',
        message
      });
    }
  };

  const setupAudioRecording = (stream: MediaStream) => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = audioContext;

      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length > 0) {
        const mediaRecorder = new MediaRecorder(stream, {
          mimeType: 'audio/webm;codecs=opus'
        });
        mediaRecorderRef.current = mediaRecorder;

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };

        mediaRecorder.onstop = async () => {
          if (audioChunksRef.current.length > 0) {
            const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
            await analyzeAudioChunk(audioBlob);
            audioChunksRef.current = [];
          }
        };

        // Start recording in chunks
        mediaRecorder.start();
        setTimeout(() => {
          if (mediaRecorder.state === 'recording') {
            mediaRecorder.stop();
            mediaRecorder.start();
          }
        }, AUDIO_CHUNK_DURATION);
      }
    } catch (error) {
      console.error('Failed to setup audio recording:', error);
    }
  };

  const setupMonitoringIntervals = () => {
    // Frame capture for ML face analysis
    frameIntervalRef.current = setInterval(() => {
      captureAndAnalyzeFrame();
    }, FRAME_CAPTURE_INTERVAL);

    // Camera health check (more frequent)
    cameraOffCheckRef.current = setInterval(() => {
      checkCameraStatus();
    }, CAMERA_CHECK_INTERVAL);

    // Inactivity detection
    resetInactivityTimer();

    // Audio chunk recording
    audioIntervalRef.current = setInterval(() => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
        setTimeout(() => {
          if (mediaRecorderRef.current && mediaStreamRef.current) {
            mediaRecorderRef.current.start();
          }
        }, 100);
      }
    }, AUDIO_CHUNK_DURATION);
  };

  const setupEventListeners = () => {
    // Tab visibility detection
    const handleVisibilityChange = () => {
      if (document.hidden) {
        logViolation('tab_switch', 'User switched to another tab');
        showViolationAlert('tab_switch', 'Please return to the challenge tab. Tab switching is being monitored.', 'medium');
      }
    };

    // Window blur detection
    const handleBlur = () => {
      logViolation('window_blur', 'Window lost focus');
      showViolationAlert('window_blur', 'Window focus lost. Please keep the challenge window active.', 'low');
    };

    // Copy/paste detection
    const handleCopy = (e: ClipboardEvent) => {
      e.preventDefault();
      logViolation('copy_paste', 'Copy operation detected');
      showViolationAlert('copy_paste', 'Copy/paste is disabled during proctored sessions. Your score is being affected.', 'high');
      toast.error('Copy/paste is disabled during proctored sessions', { duration: 5000 });
    };

    const handlePaste = (e: ClipboardEvent) => {
      e.preventDefault();
      logViolation('copy_paste', 'Paste operation detected');
      showViolationAlert('copy_paste', 'Copy/paste is disabled during proctored sessions. Your score is being affected.', 'high');
      toast.error('Copy/paste is disabled during proctored sessions', { duration: 5000 });
    };

    // Prevent right-click context menu (common cheating method)
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      logViolation('dev_tools', 'Right-click context menu attempted');
    };

    // Prevent keyboard shortcuts for dev tools
    const handleKeyDown = (e: KeyboardEvent) => {
      // F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+U
      if (
        e.key === 'F12' ||
        (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J')) ||
        (e.ctrlKey && e.key === 'U')
      ) {
        e.preventDefault();
        logViolation('dev_tools', 'Developer tools shortcut attempted');
        showViolationAlert('dev_tools', 'Developer tools are disabled during proctored sessions.', 'high');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);
    document.addEventListener('copy', handleCopy);
    document.addEventListener('paste', handlePaste);
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('keydown', handleKeyDown);

    // Activity detection
    const activityEvents = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    const resetActivity = () => resetInactivityTimer();

    activityEvents.forEach(event => {
      document.addEventListener(event, resetActivity, { passive: true });
    });

    // Prevent stream from being stopped
    const video = videoRef.current;
    if (video) {
      video.addEventListener('loadedmetadata', () => {
        const stream = video.srcObject as MediaStream;
        if (stream) {
          stream.getVideoTracks().forEach(track => {
            track.addEventListener('ended', () => {
              logViolation('camera_off', 'Camera track ended unexpectedly');
              showViolationAlert('camera_off', 'Camera disconnected. Please reconnect your camera immediately.', 'high');
              // Try to restart
              restartCamera();
            });
          });
        }
      });
    }

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('copy', handleCopy);
      document.removeEventListener('paste', handlePaste);
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('keydown', handleKeyDown);
      activityEvents.forEach(event => {
        document.removeEventListener(event, resetActivity);
      });
    };
  };

  const restartCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 15 } },
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
      });
      
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
      }
      
      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      
      setupAudioRecording(stream);
      setCameraReady(true);
      consecutiveCameraOffRef.current = 0;
    } catch (error) {
      console.error('Failed to restart camera:', error);
    }
  };

  const resetInactivityTimer = () => {
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }

    inactivityTimerRef.current = setTimeout(() => {
      logViolation('inactivity', 'No activity detected for 60 seconds');
      showViolationAlert('inactivity', 'No activity detected. Please continue working on the challenge.', 'low');
    }, 60000);
  };

  const checkCameraStatus = () => {
    if (!videoRef.current || !cameraReady) return;

    const video = videoRef.current;
    const stream = mediaStreamRef.current;
    const now = Date.now();

    // Aggressive camera check - multiple conditions
    const videoTrack = stream?.getVideoTracks()[0];
    const audioTrack = stream?.getAudioTracks()[0];
    
    const cameraOff = 
      !videoTrack ||
      videoTrack.readyState === 'ended' ||
      !videoTrack.enabled ||
      videoTrack.muted ||
      video.readyState === HTMLMediaElement.HAVE_NOTHING ||
      video.videoWidth === 0 ||
      video.videoHeight === 0 ||
      video.paused ||
      video.ended;

    const micOff =
      !audioTrack ||
      audioTrack.readyState === 'ended' ||
      !audioTrack.enabled ||
      audioTrack.muted;

    // Prevent tracks from being stopped
    if (videoTrack && videoTrack.readyState === 'live') {
      // Override stop method to prevent disabling
      const originalStop = videoTrack.stop.bind(videoTrack);
      videoTrack.stop = () => {
        logViolation('camera_off', 'Attempted to stop camera track');
        showViolationAlert(
          'camera_off',
          'Camera cannot be turned off during proctored session. Your score is being affected.',
          'high'
        );
        // Don't actually stop - re-enable instead
        if (!videoTrack.enabled) {
          videoTrack.enabled = true;
        }
      };
    }

    if (audioTrack && audioTrack.readyState === 'live') {
      const originalStop = audioTrack.stop.bind(audioTrack);
      audioTrack.stop = () => {
        logViolation('camera_off', 'Attempted to stop microphone track');
        showViolationAlert(
          'camera_off',
          'Microphone cannot be turned off during proctored session. Your score is being affected.',
          'high'
        );
        if (!audioTrack.enabled) {
          audioTrack.enabled = true;
        }
      };
    }

    if (cameraOff) {
      consecutiveCameraOffRef.current++;
      lastCameraCheckRef.current = now;

      if (consecutiveCameraOffRef.current >= 1) {
        logViolation('camera_off', 'Camera appears to be turned off or disconnected');
        showViolationAlert(
          'camera_off',
          `Camera is off. Please open your camera immediately. The longer it's closed, the more your score is being affected.`,
          'high'
        );
        // Try to restart immediately
        restartCamera();
      }
    } else {
      consecutiveCameraOffRef.current = 0;
    }

    if (micOff) {
      logViolation('camera_off', 'Microphone appears to be turned off');
      showViolationAlert(
        'camera_off',
        'Microphone is off. Please enable your microphone immediately.',
        'high'
      );
      // Try to restart
      restartCamera();
    }

    // Update UI state
    setCameraReady(!cameraOff);
    setMicReady(!micOff);
  };

  const captureAndAnalyzeFrame = async () => {
    if (!videoRef.current || !canvasRef.current || !cameraReady) return;

    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');

      if (!ctx) return;

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0);

      // Convert to blob
      canvas.toBlob(async (blob) => {
        if (!blob) return;

        try {
          // Send to backend for ML analysis
          const result = await proctoringService.analyzeFrame(sessionId, blob);
          
          if (result) {
            // Handle ML-detected violations
            if (result.face_count === 0) {
              logViolation('no_face', 'No face detected in frame');
              showViolationAlert('no_face', 'No face detected. Please ensure your face is visible to the camera.', 'medium');
            } else             if (result.face_count > 1) {
              logViolation('multiple_faces', `Multiple faces detected (${result.face_count})`);
              showViolationAlert(
                'multiple_faces', 
                `Multiple faces detected (${result.face_count}). Only you should be visible during the session. Your score is being affected.`, 
                'high'
              );
            }

            if (result.gaze_direction?.looking_away) {
              logViolation('looking_away', `User looking ${result.gaze_direction.direction}`);
              showViolationAlert('looking_away', 'Please keep your focus on the screen.', 'medium');
            }

            if (result.eyes_closed) {
              logViolation('eyes_closed', 'Eyes detected as closed');
            }

            if (result.face_coverage > 0.3) {
              logViolation('face_covered', `Face partially covered (${Math.round(result.face_coverage * 100)}%)`);
              showViolationAlert('face_covered', 'Please ensure your face is fully visible and not covered.', 'medium');
            }
          }
        } catch (error) {
          console.error('Frame analysis failed:', error);
        }
      }, 'image/jpeg', 0.85);
    } catch (error) {
      console.error('Frame capture failed:', error);
    }
  };

  const analyzeAudioChunk = async (audioBlob: Blob) => {
    try {
      const durationMs = Date.now() - lastAudioChunkTimeRef.current;
      lastAudioChunkTimeRef.current = Date.now();

      const result = await proctoringService.analyzeAudio(sessionId, audioBlob, durationMs);

      if (result) {
            if (result.has_speech) {
              logViolation('speech_detected', 'Speech detected during session');
              showViolationAlert(
                'speech_detected', 
                'Speech detected. Please work in silence. Talking may indicate receiving help. Your score is being affected.', 
                'medium'
              );
            }

            if (result.voice_count > 1) {
              logViolation('multiple_voices', `Multiple voices detected (${result.voice_count})`);
              showViolationAlert(
                'multiple_voices', 
                `Multiple voices detected (${result.voice_count}). Only you should be speaking during the session. Your score is being affected.`, 
                'high'
              );
            }

        if (result.suspicious_keywords && result.suspicious_keywords.length > 0) {
          logViolation('suspicious_conversation', `Suspicious keywords detected: ${result.suspicious_keywords.join(', ')}`);
          showViolationAlert('suspicious_conversation', 'Suspicious conversation detected. Please work independently.', 'high');
        }
      }
    } catch (error) {
      console.error('Audio analysis failed:', error);
    }
  };

  const logViolation = async (type: string, description: string) => {
    setViolationCount(prev => prev + 1);

    const violationData = {
      description,
      timestamp: new Date().toISOString(),
      sessionId,
      userId
    };

    onViolation(type, violationData);

    try {
      await proctoringService.logViolation(sessionId, type, description);
    } catch (error) {
      console.error('Error logging violation:', error);
    }
  };

  const showViolationAlert = (type: string, message: string, severity: 'low' | 'medium' | 'high' = 'medium') => {
    const alert: ViolationAlert = {
      id: `${type}-${Date.now()}`,
      type,
      message,
      timestamp: new Date(),
      severity
    };

    setAlerts(prev => [...prev.slice(-4), alert]); // Keep last 5 alerts

    // Show toast notification
    const toastOptions = {
      duration: severity === 'high' ? 8000 : 5000,
      icon: '⚠️',
      className: severity === 'high' ? 'border-l-4 border-red-500' : severity === 'medium' ? 'border-l-4 border-amber-500' : 'border-l-4 border-blue-500'
    };

    toast.error(message, toastOptions);
  };

  const startViolationStatusPolling = () => {
    violationCheckIntervalRef.current = setInterval(async () => {
      try {
        const status = await proctoringService.getSessionStatus(sessionId);
        if (status.violationsSinceLastCheck > violationCount) {
          // Violations updated on backend, refresh count
          // The count will be updated when violations are logged
        }
      } catch (error) {
        console.error('Failed to check violation status:', error);
      }
    }, VIOLATION_CHECK_INTERVAL);
  };

  const stopProctoring = () => {
    // Clear intervals
    if (frameIntervalRef.current) clearInterval(frameIntervalRef.current);
    if (audioIntervalRef.current) clearInterval(audioIntervalRef.current);
    if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    if (violationCheckIntervalRef.current) clearInterval(violationCheckIntervalRef.current);
    if (cameraOffCheckRef.current) clearInterval(cameraOffCheckRef.current);

    // Stop media recorder
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }

    // Stop audio context
    if (audioContextRef.current) {
      audioContextRef.current.close();
    }

    // Stop media stream (only when session truly ends)
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }

    setIsActive(false);
  };

  const handleDragStart = (e: React.MouseEvent) => {
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
      x: Math.max(0, Math.min(e.clientX - dragStart.x, window.innerWidth - 320)),
      y: Math.max(0, Math.min(e.clientY - dragStart.y, window.innerHeight - 200))
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

  const toggleMinimize = () => {
    setIsMinimized(!isMinimized);
  };

  return (
    <>
      {/* Hidden canvas for frame capture */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />
      
      {/* Violation Alerts */}
      {alerts.length > 0 && !isMinimized && (
        <div className="fixed top-4 left-4 z-[60] space-y-2 max-w-md">
          {alerts.slice(-3).map(alert => (
            <div
              key={alert.id}
              className={`bg-card border-l-4 rounded-lg shadow-lg p-3 ${
                alert.severity === 'high' ? 'border-red-500' :
                alert.severity === 'medium' ? 'border-amber-500' : 'border-blue-500'
              }`}
            >
              <div className="flex items-start gap-2">
                <AlertTriangle className={`h-4 w-4 mt-0.5 ${
                  alert.severity === 'high' ? 'text-red-500' :
                  alert.severity === 'medium' ? 'text-amber-500' : 'text-blue-500'
                }`} />
                <div className="flex-1">
                  <p className="text-sm font-medium">{alert.message}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {alert.timestamp.toLocaleTimeString()}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Proctoring Monitor Widget */}
      <div
        className="fixed z-50"
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
          cursor: isDragging ? 'grabbing' : 'default'
        }}
      >
        {isMinimized ? (
          <button
            onClick={toggleMinimize}
            className="bg-red-600 text-white rounded-full p-3 shadow-lg hover:bg-red-700 transition-colors flex items-center gap-2"
            title="Expand proctoring monitor"
          >
            <Shield className="h-5 w-5" />
            {violationCount > 0 && (
              <span className="bg-white text-red-600 rounded-full px-2 py-0.5 text-xs font-bold">
                {violationCount}
              </span>
            )}
          </button>
        ) : (
          <div
            className="bg-card rounded-lg shadow-xl border border-border w-80 select-none"
            onMouseDown={handleDragStart}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-3 border-b border-border cursor-move">
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
                className="text-muted-foreground hover:text-foreground transition-colors p-1"
                title="Minimize"
              >
                <Minimize2 className="h-4 w-4" />
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
                  <div className={`w-2 h-2 rounded-full ${cameraReady ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} title={cameraReady ? 'Camera active' : 'Camera off'} />
                  <div className={`w-2 h-2 rounded-full ${micReady ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} title={micReady ? 'Microphone active' : 'Microphone off'} />
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
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center mx-auto mb-1 ${
                    cameraReady ? 'bg-green-100 dark:bg-green-900/20' : 'bg-red-100 dark:bg-red-900/20'
                  }`}>
                    <Camera className={`h-4 w-4 ${
                      cameraReady ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                    }`} />
                  </div>
                  <p className="text-xs">Camera</p>
                </div>

                <div className="text-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center mx-auto mb-1 ${
                    micReady ? 'bg-green-100 dark:bg-green-900/20' : 'bg-red-100 dark:bg-red-900/20'
                  }`}>
                    <Mic className={`h-4 w-4 ${
                      micReady ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                    }`} />
                  </div>
                  <p className="text-xs">Microphone</p>
                </div>

                <div className="text-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center mx-auto mb-1 ${
                    violationCount > 0 ? 'bg-amber-100 dark:bg-amber-900/20' : 'bg-green-100 dark:bg-green-900/20'
                  }`}>
                    <AlertTriangle className={`h-4 w-4 ${
                      violationCount > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-green-600 dark:text-green-400'
                    }`} />
                  </div>
                  <p className="text-xs">{violationCount} alerts</p>
                </div>
              </div>

              {/* Monitoring Info */}
              <div className="text-xs text-muted-foreground space-y-1">
                <p>• Tab switching monitored</p>
                <p>• Inactivity detection active</p>
                <p>• Copy/paste blocked</p>
                <p>• ML analysis active</p>
                <p className="text-amber-600 dark:text-amber-400 font-medium mt-2">
                  ⚠️ Violations affect your trust score
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default ProctoringMonitor;
