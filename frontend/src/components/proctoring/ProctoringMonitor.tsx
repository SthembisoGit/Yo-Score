import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Camera, Mic, Minimize2, RefreshCw, Shield, X } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { proctoringService, type FaceMonitorResult } from '@/services/proctoring.service';

interface Props {
  sessionId: string;
  userId: string;
  challengeId: string;
  onViolation: (type: string, data: unknown) => void;
  onPauseStateChange?: (state: PauseStatePayload) => void;
}

interface ViolationAlert {
  id: string;
  message: string;
  timestamp: Date;
  severity: 'low' | 'medium' | 'high';
}

interface MissingDevices {
  camera: boolean;
  microphone: boolean;
  audio: boolean;
}

interface PauseStatePayload {
  isPaused: boolean;
  reason: string;
  missingDevices: MissingDevices;
}

const FRAME_CAPTURE_INTERVAL = 3000;
const AUDIO_CHUNK_DURATION = 10000;
const CAMERA_CHECK_INTERVAL = 1000;
const HEARTBEAT_INTERVAL = 5000;
const ALERT_TIMEOUT_MS = 30000;
const DEFAULT_COOLDOWN_MS = 10000;
const CAMERA_COOLDOWN_MS = 15000;
const LOOK_AWAY_CONTINUOUS_MS = 60000;
const LOOK_AWAY_WINDOW_MS = 60000;
const LOOK_AWAY_THRESHOLD = 3;
const NO_FACE_STREAK_THRESHOLD = 4;
const EMPTY_MISSING: MissingDevices = { camera: false, microphone: false, audio: false };
const isSameMissingState = (a: MissingDevices, b: MissingDevices) =>
  a.camera === b.camera &&
  a.microphone === b.microphone &&
  a.audio === b.audio;

const ProctoringMonitor: React.FC<Props> = ({
  sessionId,
  userId,
  challengeId,
  onViolation,
  onPauseStateChange,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const cooldownRef = useRef<Record<string, number>>({});
  const noFaceStreakRef = useRef(0);
  const lookAwayEventsRef = useRef<number[]>([]);
  const lookAwayStartRef = useRef<number | null>(null);
  const lastAudioChunkTimeRef = useRef(Date.now());
  const alertTimeoutsRef = useRef<Record<string, NodeJS.Timeout>>({});
  const pausedRef = useRef(false);
  const missingDevicesRef = useRef<MissingDevices>(EMPTY_MISSING);
  const cameraReadyRef = useRef(false);
  const micReadyRef = useRef(false);
  const audioReadyRef = useRef(false);

  const frameIntervalRef = useRef<NodeJS.Timeout>();
  const audioIntervalRef = useRef<NodeJS.Timeout>();
  const cameraCheckIntervalRef = useRef<NodeJS.Timeout>();
  const heartbeatIntervalRef = useRef<NodeJS.Timeout>();

  const [cameraReady, setCameraReady] = useState(false);
  const [micReady, setMicReady] = useState(false);
  const [audioReady, setAudioReady] = useState(false);
  const [violationCount, setViolationCount] = useState(0);
  const [isMinimized, setIsMinimized] = useState(false);
  const [alerts, setAlerts] = useState<ViolationAlert[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const [pauseReason, setPauseReason] = useState('');
  const [missingDevices, setMissingDevices] = useState<MissingDevices>(EMPTY_MISSING);
  const [isRecovering, setIsRecovering] = useState<null | 'camera' | 'microphone' | 'audio' | 'all'>(null);
  const [faceGuidance, setFaceGuidance] = useState(
    'Align your face in view. Slight left/right/up/down movement is fine.',
  );
  const [position, setPosition] = useState({ x: window.innerWidth - 340, y: 20 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const getSupportedRecorderOptions = useCallback((): MediaRecorderOptions | undefined => {
    if (typeof MediaRecorder === 'undefined') return undefined;
    const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
    for (const mimeType of candidates) {
      if (typeof MediaRecorder.isTypeSupported === 'function' && MediaRecorder.isTypeSupported(mimeType)) {
        return { mimeType };
      }
    }
    return undefined;
  }, []);

  useEffect(() => {
    pausedRef.current = isPaused;
  }, [isPaused]);

  useEffect(() => {
    missingDevicesRef.current = missingDevices;
  }, [missingDevices]);

  useEffect(() => {
    cameraReadyRef.current = cameraReady;
  }, [cameraReady]);

  useEffect(() => {
    micReadyRef.current = micReady;
  }, [micReady]);

  useEffect(() => {
    audioReadyRef.current = audioReady;
  }, [audioReady]);

  const clearAlertTimer = useCallback((id: string) => {
    const timer = alertTimeoutsRef.current[id];
    if (timer) {
      clearTimeout(timer);
      delete alertTimeoutsRef.current[id];
    }
  }, []);

  const dismissAlert = useCallback(
    (id: string) => {
      clearAlertTimer(id);
      setAlerts((prev) => prev.filter((a) => a.id !== id));
    },
    [clearAlertTimer],
  );

  const addAlert = useCallback(
    (message: string, severity: 'low' | 'medium' | 'high') => {
      const alert: ViolationAlert = {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        message,
        timestamp: new Date(),
        severity,
      };
      setAlerts((prev) => {
        const next = [...prev, alert];
        return next.length > 5 ? next.slice(-5) : next;
      });
      alertTimeoutsRef.current[alert.id] = setTimeout(
        () => dismissAlert(alert.id),
        ALERT_TIMEOUT_MS,
      );

      toast.error(message, {
        duration: severity === 'high' ? 8000 : 5000,
      });
    },
    [dismissAlert],
  );

  const canTrigger = useCallback((type: string, cooldownMs = DEFAULT_COOLDOWN_MS) => {
    const now = Date.now();
    const last = cooldownRef.current[type] ?? 0;
    if (now - last < cooldownMs) return false;
    cooldownRef.current[type] = now;
    return true;
  }, []);

  const logViolation = useCallback(
    async (type: string, description: string) => {
      setViolationCount((prev) => prev + 1);
      onViolation(type, {
        description,
        timestamp: new Date().toISOString(),
        sessionId,
        userId,
        challengeId,
      });
      try {
        await proctoringService.logViolation(sessionId, type, description);
      } catch (error) {
        console.error('Error logging violation:', error);
      }
    },
    [challengeId, onViolation, sessionId, userId],
  );

  const triggerViolation = useCallback(
    (type: string, description: string, message: string, severity: 'low' | 'medium' | 'high', cooldownMs = DEFAULT_COOLDOWN_MS) => {
      if (!canTrigger(type, cooldownMs)) return;
      void logViolation(type, description);
      addAlert(message, severity);
    },
    [addAlert, canTrigger, logViolation],
  );

  const buildMissingDevices = useCallback(
    (camera: boolean, microphone: boolean, audio: boolean): MissingDevices => ({
      camera: !camera,
      microphone: !microphone,
      audio: !audio,
    }),
    [],
  );

  const applyPauseState = useCallback(
    async (
      paused: boolean,
      reason: string,
      missing: MissingDevices,
      syncWithBackend = true,
    ) => {
      setIsPaused(paused);
      setPauseReason(reason);
      setMissingDevices(missing);
      onPauseStateChange?.({ isPaused: paused, reason, missingDevices: missing });

      if (!syncWithBackend) return;
      try {
        if (paused) {
          await proctoringService.pauseSession(sessionId, reason);
        } else {
          await proctoringService.resumeSession(sessionId);
        }
      } catch (error) {
        console.error('Failed syncing pause state with backend:', error);
      }
    },
    [onPauseStateChange, sessionId],
  );

  const checkAudioSupport = useCallback(async () => {
    const audioContextClass =
      window.AudioContext ||
      (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!audioContextClass) {
      setAudioReady(false);
      return false;
    }

    const context = new audioContextClass();
    try {
      await context.resume().catch(() => undefined);
      setAudioReady(true);
      return true;
    } catch {
      setAudioReady(false);
      return false;
    } finally {
      await context.close().catch(() => undefined);
    }
  }, []);

  const updateFaceGuidance = useCallback((result: FaceMonitorResult) => {
    if (result.face_count === 0) {
      setFaceGuidance('Face not detected. Move slightly left/right/up/down or sit a bit closer.');
      return;
    }
    if (result.face_count > 1) {
      setFaceGuidance('Multiple faces detected. Ensure only your face is visible.');
      return;
    }
    const box = result.face_box;
    if (box?.x_center !== undefined) {
      if (box.x_center < 0.28) {
        setFaceGuidance('Move a little to your right.');
        return;
      }
      if (box.x_center > 0.72) {
        setFaceGuidance('Move a little to your left.');
        return;
      }
    }
    if (box?.y_center !== undefined) {
      if (box.y_center < 0.24) {
        setFaceGuidance('Move slightly down in the camera frame.');
        return;
      }
      if (box.y_center > 0.76) {
        setFaceGuidance('Move slightly up in the camera frame.');
        return;
      }
    }
    if (box?.width !== undefined) {
      if (box.width < 0.18) {
        setFaceGuidance('Move slightly closer so your face is clearer.');
        return;
      }
      if (box.width > 0.68) {
        setFaceGuidance('Move slightly back so your full face stays in frame.');
        return;
      }
    }
    setFaceGuidance('Face detected. Keep your face visible; natural movement is okay.');
  }, []);

  const setupAudioRecorder = useCallback(
    (stream: MediaStream) => {
      if (stream.getAudioTracks().length === 0 || typeof MediaRecorder === 'undefined') {
        mediaRecorderRef.current = null;
        return;
      }

      try {
        const recorderOptions = getSupportedRecorderOptions();
        const recorder = recorderOptions
          ? new MediaRecorder(stream, recorderOptions)
          : new MediaRecorder(stream);

        mediaRecorderRef.current = recorder;
        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) audioChunksRef.current.push(event.data);
        };
        recorder.onstop = async () => {
          if (pausedRef.current) {
            audioChunksRef.current = [];
            return;
          }
          if (audioChunksRef.current.length === 0) return;
          const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          audioChunksRef.current = [];
          const durationMs = Date.now() - lastAudioChunkTimeRef.current;
          lastAudioChunkTimeRef.current = Date.now();
          const result = await proctoringService.analyzeAudio(sessionId, blob, durationMs);
          if (!result) return;
          if (result.has_speech) {
            triggerViolation(
              'speech_detected',
              'Speech detected during session',
              'Speech detected. Please work in silence.',
              'medium',
              15000,
            );
          }
          if (result.voice_count > 1) {
            triggerViolation(
              'multiple_voices',
              `Multiple voices detected (${result.voice_count})`,
              `Multiple voices detected (${result.voice_count}).`,
              'high',
              20000,
            );
          }
          if (result.suspicious_keywords.length > 0) {
            triggerViolation(
              'suspicious_conversation',
              `Suspicious keywords: ${result.suspicious_keywords.join(', ')}`,
              'Suspicious conversation detected.',
              'high',
              20000,
            );
          }
        };
        recorder.start();
      } catch (error) {
        mediaRecorderRef.current = null;
        console.error('Audio recorder unavailable:', error);
        addAlert(
          'Audio recording unsupported in this browser. Speech checks are limited.',
          'medium',
        );
      }
    },
    [addAlert, getSupportedRecorderOptions, sessionId, triggerViolation],
  );

  const restartStream = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 15 } },
      audio: true,
    });
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
    }
    mediaStreamRef.current = stream;
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      await videoRef.current.play().catch(() => undefined);
    }
    setupAudioRecorder(stream);
    setCameraReady(true);
    setMicReady(stream.getAudioTracks().length > 0);
    await checkAudioSupport();
  }, [checkAudioSupport, setupAudioRecorder]);

  const checkRequiredDevices = useCallback(async () => {
    const stream = mediaStreamRef.current;
    const video = videoRef.current;
    const videoTrack = stream?.getVideoTracks()[0];
    const audioTrack = stream?.getAudioTracks()[0];
    const cameraOn = Boolean(
      video &&
      videoTrack &&
      videoTrack.readyState === 'live' &&
      videoTrack.enabled &&
      !videoTrack.muted &&
      video.videoWidth > 0 &&
      video.videoHeight > 0,
    );
    const micOn = Boolean(audioTrack && audioTrack.readyState === 'live' && audioTrack.enabled && !audioTrack.muted);
    const audioOn = audioReadyRef.current;

    setCameraReady(cameraOn);
    setMicReady(micOn);

    const missing = buildMissingDevices(cameraOn, micOn, audioOn);
    const hasMissing = missing.camera || missing.microphone || missing.audio;
    if (!hasMissing) {
      if (pausedRef.current) {
        await applyPauseState(false, '', EMPTY_MISSING);
      }
      return;
    }

    if (pausedRef.current && isSameMissingState(missingDevicesRef.current, missing)) {
      return;
    }

    if (missing.camera) {
      triggerViolation('camera_off', 'Camera unavailable', 'Camera is off. Session paused.', 'high', CAMERA_COOLDOWN_MS);
    }
    if (missing.microphone) {
      triggerViolation('camera_off', 'Microphone unavailable', 'Microphone is off. Session paused.', 'high', CAMERA_COOLDOWN_MS);
    }
    if (missing.audio) {
      triggerViolation('camera_off', 'Audio support unavailable', 'Audio support is required. Session paused.', 'high', CAMERA_COOLDOWN_MS);
    }
    const reason = `Required device unavailable: ${[
      missing.camera ? 'camera' : '',
      missing.microphone ? 'microphone' : '',
      missing.audio ? 'audio' : '',
    ]
      .filter(Boolean)
      .join(', ')}`;
    await applyPauseState(true, reason, missing);
  }, [applyPauseState, buildMissingDevices, isSameMissingState, triggerViolation]);

  const captureAndAnalyzeFrame = useCallback(async () => {
    if (pausedRef.current || !videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    if (video.videoWidth === 0 || video.videoHeight === 0) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      const result = await proctoringService.analyzeFrame(sessionId, blob);
      if (!result) {
        setFaceGuidance('Face analysis unavailable. Keep your face visible.');
        return;
      }

      updateFaceGuidance(result);
      if (result.face_count === 0) {
        noFaceStreakRef.current += 1;
        if (noFaceStreakRef.current >= NO_FACE_STREAK_THRESHOLD) {
          triggerViolation('no_face', 'No face detected in consecutive frames', 'No face detected. Keep your face visible.', 'medium', 12000);
        }
      } else {
        noFaceStreakRef.current = 0;
      }
      if (result.face_count > 1) {
        triggerViolation('multiple_faces', `Multiple faces detected (${result.face_count})`, `Multiple faces detected (${result.face_count}).`, 'high', 15000);
      }

      const now = Date.now();
      if (result.gaze_direction?.looking_away) {
        if (!lookAwayStartRef.current) lookAwayStartRef.current = now;
        lookAwayEventsRef.current = [...lookAwayEventsRef.current, now].filter((ts) => now - ts <= LOOK_AWAY_WINDOW_MS);
        if (lookAwayEventsRef.current.length >= LOOK_AWAY_THRESHOLD) {
          triggerViolation('looking_away', 'Looked away repeatedly within one minute', 'You are looking away too frequently.', 'medium', 30000);
          lookAwayEventsRef.current = [];
        }
        if (lookAwayStartRef.current && now - lookAwayStartRef.current >= LOOK_AWAY_CONTINUOUS_MS) {
          triggerViolation('looking_away', 'Looked away continuously for over one minute', 'You looked away for too long.', 'high', 60000);
          lookAwayStartRef.current = now;
        }
      } else {
        lookAwayStartRef.current = null;
      }
    }, 'image/jpeg', 0.85);
  }, [sessionId, triggerViolation, updateFaceGuidance]);

  const sendHeartbeat = useCallback(async () => {
    try {
      const status = await proctoringService.sendHeartbeat(sessionId, {
        cameraReady: cameraReadyRef.current,
        microphoneReady: micReadyRef.current,
        audioReady: audioReadyRef.current,
        isPaused: pausedRef.current,
        windowFocused: document.hasFocus() && !document.hidden,
        timestamp: new Date().toISOString(),
      });
      if (status.status === 'paused' && !pausedRef.current) {
        await applyPauseState(true, status.pauseReason || 'Session paused by server', buildMissingDevices(cameraReadyRef.current, micReadyRef.current, audioReadyRef.current), false);
      }
    } catch (error) {
      console.error('Failed to send heartbeat:', error);
    }
  }, [applyPauseState, buildMissingDevices, sessionId]);

  const startProctoring = useCallback(async () => {
    await restartStream();
    const unregister = () => {
      const handleVisibilityChange = () => {
        if (document.hidden) {
          triggerViolation('tab_switch', 'User switched tabs', 'Please return to the challenge tab.', 'medium');
        }
      };
      const handleWindowBlur = () => {
        triggerViolation('window_blur', 'Window lost focus', 'Window out of focus. Return to the challenge.', 'low', 8000);
      };
      const handleCopy = (event: ClipboardEvent) => {
        event.preventDefault();
        triggerViolation('copy_paste', 'Copy attempted', 'Copy/paste is disabled.', 'high');
      };
      const handlePaste = (event: ClipboardEvent) => {
        event.preventDefault();
        triggerViolation('copy_paste', 'Paste attempted', 'Copy/paste is disabled.', 'high');
      };
      document.addEventListener('visibilitychange', handleVisibilityChange);
      window.addEventListener('blur', handleWindowBlur);
      document.addEventListener('copy', handleCopy);
      document.addEventListener('paste', handlePaste);
      return () => {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        window.removeEventListener('blur', handleWindowBlur);
        document.removeEventListener('copy', handleCopy);
        document.removeEventListener('paste', handlePaste);
      };
    };

    const removeEvents = unregister();
    frameIntervalRef.current = setInterval(() => void captureAndAnalyzeFrame(), FRAME_CAPTURE_INTERVAL);
    audioIntervalRef.current = setInterval(() => {
      const recorder = mediaRecorderRef.current;
      if (!recorder) return;
      if (recorder.state === 'recording') {
        recorder.stop();
        setTimeout(() => {
          if (mediaRecorderRef.current && mediaStreamRef.current) {
            try {
              mediaRecorderRef.current.start();
            } catch (error) {
              console.error('Failed to restart audio recorder:', error);
            }
          }
        }, 100);
      }
    }, AUDIO_CHUNK_DURATION);
    cameraCheckIntervalRef.current = setInterval(() => void checkRequiredDevices(), CAMERA_CHECK_INTERVAL);
    heartbeatIntervalRef.current = setInterval(() => void sendHeartbeat(), HEARTBEAT_INTERVAL);
    return removeEvents;
  }, [captureAndAnalyzeFrame, checkRequiredDevices, restartStream, sendHeartbeat, triggerViolation]);

  useEffect(() => {
    let removeEvents: (() => void) | undefined;
    void startProctoring()
      .then((cleanup) => {
        removeEvents = cleanup;
      })
      .catch((error) => {
        console.error('Failed to start proctoring:', error);
        addAlert('Camera/microphone access denied. Enable permissions to continue.', 'high');
      });

    return () => {
      if (frameIntervalRef.current) clearInterval(frameIntervalRef.current);
      if (audioIntervalRef.current) clearInterval(audioIntervalRef.current);
      if (cameraCheckIntervalRef.current) clearInterval(cameraCheckIntervalRef.current);
      if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
      removeEvents?.();
      if (mediaRecorderRef.current?.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      Object.keys(alertTimeoutsRef.current).forEach((id) => clearAlertTimer(id));
    };
  }, [addAlert, clearAlertTimer, startProctoring]);

  const requestRecovery = useCallback(async (target: 'camera' | 'microphone' | 'audio' | 'all') => {
    setIsRecovering(target);
    try {
      if (target === 'camera' || target === 'all') {
        const cameraStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        cameraStream.getTracks().forEach((track) => track.stop());
      }
      if (target === 'microphone' || target === 'all') {
        const micStream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
        micStream.getTracks().forEach((track) => track.stop());
      }
      if (target === 'audio' || target === 'all') {
        await checkAudioSupport();
      }
      if (target !== 'audio') {
        await restartStream();
      }
      await checkRequiredDevices();
      void sendHeartbeat();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to recover required device.';
      addAlert(message, 'high');
    } finally {
      setIsRecovering(null);
    }
  }, [addAlert, checkAudioSupport, checkRequiredDevices, restartStream, sendHeartbeat]);

  const handleDragStart = (event: React.MouseEvent) => {
    if ((event.target as HTMLElement).closest('button')) return;
    setIsDragging(true);
    setDragStart({ x: event.clientX - position.x, y: event.clientY - position.y });
  };

  const handleDrag = useCallback(
    (event: MouseEvent) => {
      if (!isDragging) return;
      setPosition({
        x: Math.max(0, Math.min(event.clientX - dragStart.x, window.innerWidth - 320)),
        y: Math.max(0, Math.min(event.clientY - dragStart.y, window.innerHeight - 200)),
      });
    },
    [dragStart, isDragging],
  );

  const handleDragEnd = useCallback(() => setIsDragging(false), []);

  useEffect(() => {
    if (!isDragging) return;
    document.addEventListener('mousemove', handleDrag);
    document.addEventListener('mouseup', handleDragEnd);
    return () => {
      document.removeEventListener('mousemove', handleDrag);
      document.removeEventListener('mouseup', handleDragEnd);
    };
  }, [handleDrag, handleDragEnd, isDragging]);

  const canResume = !missingDevices.camera && !missingDevices.microphone && !missingDevices.audio;

  return (
    <>
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {alerts.length > 0 && !isMinimized && (
        <div className="fixed top-4 left-4 z-[60] space-y-2 max-w-md">
          {alerts.slice(-3).map((alert) => (
            <div key={alert.id} className="bg-card border-l-4 border-amber-500 rounded-lg shadow-lg p-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 mt-0.5 text-amber-500" />
                <div className="flex-1">
                  <p className="text-sm font-medium">{alert.message}</p>
                  <p className="text-xs text-muted-foreground mt-1">{alert.timestamp.toLocaleTimeString()}</p>
                </div>
                <button onClick={() => dismissAlert(alert.id)} className="p-1 rounded hover:bg-muted" aria-label="Dismiss alert">
                  <X className="h-3 w-3 text-muted-foreground" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {isPaused && (
        <div className="fixed inset-0 z-[80] bg-black/65 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-card border border-border rounded-xl shadow-xl p-5 space-y-4">
            <h3 className="text-lg font-semibold">Session Paused</h3>
            <p className="text-sm text-muted-foreground">{pauseReason || 'Required proctoring device is missing.'}</p>
            <div className="space-y-2">
              <button onClick={() => void requestRecovery('camera')} disabled={!missingDevices.camera || isRecovering !== null} className="w-full px-3 py-2 rounded border border-border text-sm hover:bg-muted disabled:opacity-60">Turn on camera</button>
              <button onClick={() => void requestRecovery('microphone')} disabled={!missingDevices.microphone || isRecovering !== null} className="w-full px-3 py-2 rounded border border-border text-sm hover:bg-muted disabled:opacity-60">Turn on microphone</button>
              <button onClick={() => void requestRecovery('audio')} disabled={!missingDevices.audio || isRecovering !== null} className="w-full px-3 py-2 rounded border border-border text-sm hover:bg-muted disabled:opacity-60">Enable audio</button>
            </div>
            <div className="flex gap-2">
              <button onClick={() => void requestRecovery('all')} disabled={isRecovering !== null} className="px-3 py-2 rounded border border-border text-sm hover:bg-muted disabled:opacity-60 flex items-center gap-2">
                <RefreshCw className={`h-4 w-4 ${isRecovering ? 'animate-spin' : ''}`} />
                Re-check all
              </button>
              <button onClick={() => void applyPauseState(false, '', EMPTY_MISSING)} disabled={!canResume || isRecovering !== null} className="flex-1 px-3 py-2 rounded bg-primary text-primary-foreground text-sm disabled:opacity-60">
                Resume session
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="fixed z-50" style={{ left: `${position.x}px`, top: `${position.y}px`, cursor: isDragging ? 'grabbing' : 'default' }}>
        {isMinimized ? (
          <button onClick={() => setIsMinimized(false)} className="bg-red-600 text-white rounded-full p-3 shadow-lg hover:bg-red-700 transition-colors flex items-center gap-2">
            <Shield className="h-5 w-5" />
          </button>
        ) : (
          <div className="bg-card rounded-lg shadow-xl border border-border w-80 select-none" onMouseDown={handleDragStart}>
            <div className="flex items-center justify-between p-3 border-b border-border cursor-move">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary" />
                <div>
                  <h3 className="font-semibold text-sm">{isPaused ? 'Proctoring Paused' : 'Proctoring Active'}</h3>
                  <p className="text-xs text-muted-foreground">Session: {sessionId.substring(0, 8)}...</p>
                </div>
              </div>
              <button onClick={() => setIsMinimized(true)} className="text-muted-foreground hover:text-foreground p-1">
                <Minimize2 className="h-4 w-4" />
              </button>
            </div>
            <div className="p-3">
              <div className="relative rounded-lg overflow-hidden border border-border bg-black">
                <video ref={videoRef} autoPlay muted playsInline className="w-full h-40 object-cover" />
                <div className="absolute top-2 right-2 flex gap-1">
                  <div className={`w-2 h-2 rounded-full ${cameraReady ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                  <div className={`w-2 h-2 rounded-full ${micReady ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                </div>
                <div className="absolute top-2 left-2 text-[11px] px-2 py-1 rounded bg-amber-600/85 text-white max-w-[78%]">
                  {faceGuidance}
                </div>
              </div>
            </div>
            <div className="px-3 pb-3 text-xs text-muted-foreground space-y-1">
              <p>- Camera and microphone must stay on</p>
              <p>- Session pauses automatically on device-off</p>
              <p>- Face and audio analysis active</p>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default ProctoringMonitor;
