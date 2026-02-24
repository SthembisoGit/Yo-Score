import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Camera, Mic, Minimize2, RefreshCw, Shield, X } from 'lucide-react';
import { toast } from 'react-hot-toast';
import {
  proctoringService,
  type FaceMonitorResult,
  type ProctoringEventInput,
} from '@/services/proctoring.service';

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

interface LivenessChallengeState {
  challengeId: string;
  prompt: string;
  expiresAt: string;
  expectedAction: 'turn_left' | 'turn_right' | 'look_up' | 'look_down' | 'blink_once';
}

type NativeFaceDetection = { boundingBox?: DOMRectReadOnly };
type NativeFaceDetectorConstructor = new (options: {
  fastMode?: boolean;
  maxDetectedFaces?: number;
}) => {
  detect: (canvas: HTMLCanvasElement) => Promise<NativeFaceDetection[]>;
};

const FRAME_CAPTURE_INTERVAL = 3000;
const AUDIO_CHUNK_DURATION = 10000;
const AUDIO_SAMPLE_INTERVAL = 600;
const CAMERA_CHECK_INTERVAL = 1000;
const HEARTBEAT_INTERVAL = 8000;
const RISK_POLL_INTERVAL = 8000;
const EVENT_FLUSH_INTERVAL = 8000;
const ALERT_TIMEOUT_MS = 30000;
const DEFAULT_COOLDOWN_MS = 10000;
const CAMERA_COOLDOWN_MS = 15000;
const LOOK_AWAY_CONTINUOUS_MS = 60000;
const LOOK_AWAY_WINDOW_MS = 60000;
const LOOK_AWAY_THRESHOLD = 3;
const NO_FACE_STREAK_THRESHOLD = 4;
const DEVICE_MISSING_STREAK_THRESHOLD = 2;
const DEVICE_READY_STREAK_THRESHOLD = 2;
const MAX_EVENT_BUFFER = 100;
const SNAPSHOT_INTERVAL_MS = 25000;
const SNAPSHOT_SAMPLE_RATE = 0.18;
const MODEL_VERSION = 'browser-v2-consensus';
const EMPTY_MISSING: MissingDevices = { camera: false, microphone: false, audio: false };
type PauseSource = 'device' | 'risk' | 'server' | 'manual';

const ProctoringMonitor: React.FC<Props> = ({
  sessionId,
  userId,
  challengeId,
  onViolation,
  onPauseStateChange,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioAnalyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const audioSampleBufferRef = useRef<Uint8Array | null>(null);
  const nativeFaceDetectorRef = useRef<InstanceType<NativeFaceDetectorConstructor> | null>(null);
  const cooldownRef = useRef<Record<string, number>>({});
  const noFaceStreakRef = useRef(0);
  const lookAwayEventsRef = useRef<number[]>([]);
  const lookAwayStartRef = useRef<number | null>(null);
  const lastAudioChunkTimeRef = useRef(Date.now());
  const alertTimeoutsRef = useRef<Record<string, NodeJS.Timeout>>({});
  const pausedRef = useRef(false);
  const pauseReasonRef = useRef('');
  const pauseTransitionInFlightRef = useRef<'pause' | 'resume' | null>(null);
  const pauseTransitionVersionRef = useRef(0);
  const lastPauseSourceRef = useRef<PauseSource | null>(null);
  const missingDevicesRef = useRef<MissingDevices>(EMPTY_MISSING);
  const livenessChallengeRef = useRef<LivenessChallengeState | null>(null);
  const livenessRequiredRef = useRef(false);
  const livenessIssueInFlightRef = useRef(false);
  const lastLivenessIssuedAtRef = useRef(0);
  const deviceMissingStreakRef = useRef(0);
  const deviceReadyStreakRef = useRef(0);
  const cameraReadyRef = useRef(false);
  const micReadyRef = useRef(false);
  const audioReadyRef = useRef(false);
  const mlDegradedRef = useRef(false);
  const eventBufferRef = useRef<ProctoringEventInput[]>([]);
  const eventSequenceRef = useRef(0);
  const speechStreakMsRef = useRef(0);
  const lastSnapshotAtRef = useRef(0);
  const lastRiskPauseReasonRef = useRef('');
  const audioRecorderUnsupportedRef = useRef(false);
  const connectionIssueAlertShownRef = useRef(false);
  const audioCapabilityAlertShownRef = useRef(false);
  const audioCapabilityEventLoggedRef = useRef(false);
  const mlHealthFailureStreakRef = useRef(0);
  const mlHealthAlertShownRef = useRef(false);

  const frameIntervalRef = useRef<NodeJS.Timeout>();
  const cameraCheckIntervalRef = useRef<NodeJS.Timeout>();
  const heartbeatIntervalRef = useRef<NodeJS.Timeout>();
  const riskPollIntervalRef = useRef<NodeJS.Timeout>();
  const audioSampleIntervalRef = useRef<NodeJS.Timeout>();
  const eventsFlushIntervalRef = useRef<NodeJS.Timeout>();

  const [cameraReady, setCameraReady] = useState(false);
  const [micReady, setMicReady] = useState(false);
  const [audioReady, setAudioReady] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [alerts, setAlerts] = useState<ViolationAlert[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const [pauseReason, setPauseReason] = useState('');
  const [missingDevices, setMissingDevices] = useState<MissingDevices>(EMPTY_MISSING);
  const [isResumingSession, setIsResumingSession] = useState(false);
  const [isRecovering, setIsRecovering] = useState<null | 'camera' | 'microphone' | 'audio' | 'all'>(null);
  const [faceGuidance, setFaceGuidance] = useState(
    'Align your face in view. Slight left/right/up/down movement is fine.',
  );
  const [mlDegraded, setMlDegraded] = useState(false);
  const [riskState, setRiskState] = useState<'observe' | 'warn' | 'elevated' | 'paused'>('observe');
  const [livenessChallenge, setLivenessChallenge] = useState<LivenessChallengeState | null>(null);
  const [isLivenessRequired, setIsLivenessRequired] = useState(false);
  const [livenessAction, setLivenessAction] = useState<'turn_left' | 'turn_right' | 'look_up' | 'look_down' | 'blink_once'>('turn_left');
  const [isVerifyingLiveness, setIsVerifyingLiveness] = useState(false);
  const [position, setPosition] = useState({ x: window.innerWidth - 340, y: 20 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [showGuidance, setShowGuidance] = useState(false);

  const getSupportedRecorderOptions = useCallback((): MediaRecorderOptions | undefined => {
    if (typeof MediaRecorder === 'undefined') return undefined;
    const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/ogg'];
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

  useEffect(() => {
    mlDegradedRef.current = mlDegraded;
  }, [mlDegraded]);

  useEffect(() => {
    livenessChallengeRef.current = livenessChallenge;
  }, [livenessChallenge]);

  useEffect(() => {
    livenessRequiredRef.current = isLivenessRequired;
  }, [isLivenessRequired]);

  useEffect(() => {
    if (isMinimized) return;
    if (!previewVideoRef.current || !mediaStreamRef.current) return;
    previewVideoRef.current.srcObject = mediaStreamRef.current;
    void previewVideoRef.current.play().catch(() => undefined);
  }, [isMinimized]);

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

      if (severity !== 'low') {
        toast.error(message, {
          duration: severity === 'high' ? 8000 : 5000,
        });
      }
    },
    [dismissAlert],
  );

  const queueEvent = useCallback((event: ProctoringEventInput) => {
    eventSequenceRef.current += 1;
    const sequenceId = event.sequence_id ?? eventSequenceRef.current;
    const next = [
      ...eventBufferRef.current,
      {
        ...event,
        sequence_id: sequenceId,
        client_ts: event.client_ts || new Date().toISOString(),
        confidence:
          typeof event.confidence === 'number'
            ? Math.max(0, Math.min(1, event.confidence))
            : 0.5,
        duration_ms:
          typeof event.duration_ms === 'number' && Number.isFinite(event.duration_ms)
            ? Math.max(0, Math.floor(event.duration_ms))
            : 0,
        model_version: event.model_version || MODEL_VERSION,
        timestamp: event.timestamp || new Date().toISOString(),
      },
    ];
    eventBufferRef.current = next.slice(-MAX_EVENT_BUFFER);
  }, []);

  const uploadSnapshot = useCallback(
    async (triggerType: string, metadata: Record<string, unknown>) => {
      if (!videoRef.current || !canvasRef.current || pausedRef.current) return;
      const now = Date.now();
      if (now - lastSnapshotAtRef.current < SNAPSHOT_INTERVAL_MS) return;
      if (Math.random() > SNAPSHOT_SAMPLE_RATE) return;

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
        try {
          await proctoringService.uploadSnapshot(sessionId, blob, triggerType, metadata);
          lastSnapshotAtRef.current = Date.now();
        } catch (error) {
          console.error('Snapshot upload failed:', error);
        }
      }, 'image/jpeg', 0.65);
    },
    [sessionId],
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
      try {
        await proctoringService.logViolation(sessionId, type, description);
      } catch (error) {
        console.error('Error logging violation:', error);
      }
    },
    [sessionId],
  );

  const triggerViolation = useCallback(
    (
      type: string,
      description: string,
      message: string,
      severity: 'low' | 'medium' | 'high',
      cooldownMs = DEFAULT_COOLDOWN_MS,
      options?: { persist?: boolean; confidence?: number; durationMs?: number },
    ) => {
      if (!canTrigger(type, cooldownMs)) return;
      const confidence =
        typeof options?.confidence === 'number'
          ? Math.max(0, Math.min(1, options.confidence))
          : severity === 'high'
            ? 0.9
            : severity === 'medium'
              ? 0.7
              : 0.5;
      const durationMs =
        typeof options?.durationMs === 'number' && Number.isFinite(options.durationMs)
          ? Math.max(0, Math.floor(options.durationMs))
          : 0;
      queueEvent({
        event_type: type,
        severity,
        payload: {
          description,
          source: 'frontend-live',
        },
        confidence,
        duration_ms: durationMs,
      });
      onViolation(type, {
        type,
        description,
        severity,
        confidence,
        duration_ms: durationMs,
        sessionId,
        userId,
        challengeId,
        source: 'frontend-live',
        persisted: options?.persist !== false,
        timestamp: new Date().toISOString(),
      });
      if (severity === 'high') {
        void uploadSnapshot(type, { description, severity, confidence, duration_ms: durationMs, risk_state: riskState });
      }
      if (options?.persist !== false) {
        void logViolation(type, description);
      }
      addAlert(message, severity);
    },
    [addAlert, canTrigger, challengeId, logViolation, onViolation, queueEvent, riskState, sessionId, uploadSnapshot, userId],
  );

  const buildMissingDevices = useCallback(
    (camera: boolean, microphone: boolean, audio: boolean): MissingDevices => ({
      camera: !camera,
      microphone: !microphone,
      audio: !audio,
    }),
    [],
  );

  const equalMissingDevices = useCallback((left: MissingDevices, right: MissingDevices) => {
    return (
      left.camera === right.camera &&
      left.microphone === right.microphone &&
      left.audio === right.audio
    );
  }, []);

  const commitPauseState = useCallback(
    (paused: boolean, reason: string, missing: MissingDevices, source: PauseSource) => {
      setIsPaused(paused);
      setPauseReason(reason);
      setMissingDevices(missing);
      pauseReasonRef.current = reason;
      lastPauseSourceRef.current = source;
      onPauseStateChange?.({ isPaused: paused, reason, missingDevices: missing });
    },
    [onPauseStateChange],
  );

  const applyPauseState = useCallback(
    async (
      options: {
        paused: boolean;
        reason: string;
        missing: MissingDevices;
        source: PauseSource;
        syncWithBackend?: boolean;
      },
    ) => {
      const { paused, reason, missing, source, syncWithBackend = true } = options;
      const normalizedReason = reason.trim();
      const stateAlreadyApplied =
        pausedRef.current === paused &&
        pauseReasonRef.current === normalizedReason &&
        equalMissingDevices(missingDevicesRef.current, missing) &&
        lastPauseSourceRef.current === source;

      if (stateAlreadyApplied) return;

      const direction: 'pause' | 'resume' = paused ? 'pause' : 'resume';
      if (pauseTransitionInFlightRef.current === direction) return;

      const transitionVersion = ++pauseTransitionVersionRef.current;
      pauseTransitionInFlightRef.current = direction;

      if (!paused) {
        setIsResumingSession(true);
      } else {
        commitPauseState(true, normalizedReason, missing, source);
      }

      if (!syncWithBackend) {
        if (!paused) {
          commitPauseState(false, '', EMPTY_MISSING, source);
        }
        pauseTransitionInFlightRef.current = null;
        setIsResumingSession(false);
        return;
      }

      try {
        if (paused) {
          await proctoringService.pauseSession(sessionId, normalizedReason || 'Session paused');
        } else {
          await proctoringService.resumeSession(sessionId);
          if (transitionVersion !== pauseTransitionVersionRef.current) {
            return;
          }
          commitPauseState(false, '', EMPTY_MISSING, source);
        }
      } catch (error) {
        console.error('Failed syncing pause state with backend:', error);
        if (!paused && error instanceof Error && error.message.toLowerCase().includes('liveness')) {
          addAlert('Complete liveness verification before resuming.', 'medium');
        } else if (!paused) {
          addAlert('Unable to resume session right now. Confirm devices and try again.', 'medium');
        }
      } finally {
        if (transitionVersion === pauseTransitionVersionRef.current) {
          pauseTransitionInFlightRef.current = null;
          setIsResumingSession(false);
        }
      }
    },
    [addAlert, commitPauseState, equalMissingDevices, sessionId],
  );

  const flushEventBuffer = useCallback(async () => {
    if (eventBufferRef.current.length === 0) return;
    const payload = [...eventBufferRef.current];
    eventBufferRef.current = [];
    try {
      const sequenceStart =
        typeof payload[0]?.sequence_id === 'number' ? payload[0].sequence_id : undefined;
      await proctoringService.batchEvents(sessionId, payload, sequenceStart);
      const response = await proctoringService.getSessionRisk(sessionId).catch(() => null);
      if (!response) return;

      setRiskState(response.risk_state);
      const livenessRequiredNow = Boolean(response.liveness_required);
      setIsLivenessRequired(livenessRequiredNow);
      if (!livenessRequiredNow && livenessChallengeRef.current) {
        setLivenessChallenge(null);
      }
      if (
        response.pause_recommended &&
        response.risk_state === 'paused'
      ) {
        const reasonDetail =
          response.reasons?.[0] || 'high-risk behavior detected by consensus policy.';
        const reason = `Consensus risk pause: ${reasonDetail}`;
        lastRiskPauseReasonRef.current = reason;
        await applyPauseState({
          paused: true,
          reason,
          missing: missingDevicesRef.current,
          source: 'risk',
        });
      }
    } catch (error) {
      console.error('Failed to flush proctoring event buffer:', error);
      eventBufferRef.current = [...payload, ...eventBufferRef.current].slice(-MAX_EVENT_BUFFER);
    }
  }, [applyPauseState, sessionId]);

  const issueLivenessChallenge = useCallback(
    async (force: boolean = false) => {
      if (!force && livenessChallengeRef.current) return;
      if (livenessIssueInFlightRef.current) return;

      const now = Date.now();
      if (!force && now - lastLivenessIssuedAtRef.current < 5000) return;
      lastLivenessIssuedAtRef.current = now;
      livenessIssueInFlightRef.current = true;

      try {
        const issued = await proctoringService.livenessCheck(sessionId).catch(() => null);
        if (issued?.challenge_id && issued.prompt && issued.expires_at) {
          const action = issued.expected_action || 'turn_left';
          setLivenessAction(action);
          setLivenessChallenge({
            challengeId: issued.challenge_id,
            prompt: issued.prompt,
            expiresAt: issued.expires_at,
            expectedAction: action,
          });
          setIsLivenessRequired(true);
        }
      } finally {
        livenessIssueInFlightRef.current = false;
      }
    },
    [sessionId],
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

  const estimateSpeechFromAudio = useCallback(async (blob: Blob) => {
    const audioContextClass =
      window.AudioContext ||
      (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!audioContextClass) return false;

    const context = new audioContextClass();
    try {
      const arrayBuffer = await blob.arrayBuffer();
      const decoded = await context.decodeAudioData(arrayBuffer.slice(0));
      const channel = decoded.getChannelData(0);
      if (!channel.length) return false;

      let peak = 0;
      let sum = 0;
      const step = Math.max(1, Math.floor(channel.length / 4000));
      for (let i = 0; i < channel.length; i += step) {
        const value = Math.abs(channel[i]);
        peak = Math.max(peak, value);
        sum += value;
      }

      const avg = sum / Math.ceil(channel.length / step);
      return peak > 0.08 && avg > 0.015;
    } catch {
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

  const initializeNativeFaceDetector = useCallback(() => {
    const Detector = (window as Window & { FaceDetector?: NativeFaceDetectorConstructor })
      .FaceDetector;
    if (!Detector) {
      nativeFaceDetectorRef.current = null;
      return false;
    }

    try {
      nativeFaceDetectorRef.current = new Detector({
        fastMode: true,
        maxDetectedFaces: 2,
      });
      return true;
    } catch {
      nativeFaceDetectorRef.current = null;
      return false;
    }
  }, []);

  const detectFacesLocally = useCallback(async (): Promise<FaceMonitorResult | null> => {
    if (!videoRef.current || !canvasRef.current || !nativeFaceDetectorRef.current) return null;
    const video = videoRef.current;
    if (video.videoWidth === 0 || video.videoHeight === 0) return null;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);

    try {
      const detected = await nativeFaceDetectorRef.current.detect(canvas);
      const faceCount = Array.isArray(detected) ? detected.length : 0;
      const largest = Array.isArray(detected)
        ? detected.reduce<{ boundingBox?: DOMRectReadOnly } | null>((best, face) => {
            if (!face?.boundingBox) return best;
            if (!best?.boundingBox) return face;
            const currentArea = face.boundingBox.width * face.boundingBox.height;
            const bestArea = best.boundingBox.width * best.boundingBox.height;
            return currentArea > bestArea ? face : best;
          }, null)
        : null;

      const box = largest?.boundingBox;
      const normalizedBox = box
        ? {
            x_center: (box.x + box.width / 2) / canvas.width,
            y_center: (box.y + box.height / 2) / canvas.height,
            width: box.width / canvas.width,
            height: box.height / canvas.height,
          }
        : undefined;

      return {
        face_count: faceCount,
        face_box: normalizedBox,
        gaze_direction: normalizedBox
          ? {
              looking_away: Math.abs(normalizedBox.x_center - 0.5) > 0.18,
              direction:
                normalizedBox.x_center < 0.42
                  ? 'left'
                  : normalizedBox.x_center > 0.58
                    ? 'right'
                    : 'center',
              confidence: 0.72,
            }
          : undefined,
        eyes_closed: false,
        face_coverage: 0,
        confidence: faceCount > 0 ? 0.8 : 0.5,
        has_face: faceCount > 0,
      };
    } catch {
      return null;
    }
  }, []);

  const setupAudioEnergySampler = useCallback(
    (stream: MediaStream) => {
      const AudioContextCtor =
        window.AudioContext ||
        (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextCtor) return;

      audioContextRef.current?.close().catch(() => undefined);
      const context = new AudioContextCtor();
      audioContextRef.current = context;
      const source = context.createMediaStreamSource(stream);
      audioSourceRef.current = source;
      const analyser = context.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.2;
      source.connect(analyser);
      audioAnalyserRef.current = analyser;
      audioSampleBufferRef.current = new Uint8Array(analyser.fftSize);

      if (audioSampleIntervalRef.current) clearInterval(audioSampleIntervalRef.current);
      audioSampleIntervalRef.current = setInterval(() => {
        if (pausedRef.current || !audioAnalyserRef.current || !audioSampleBufferRef.current) return;
        audioAnalyserRef.current.getByteTimeDomainData(audioSampleBufferRef.current);
        let sumSquares = 0;
        for (let i = 0; i < audioSampleBufferRef.current.length; i += 1) {
          const centered = (audioSampleBufferRef.current[i] - 128) / 128;
          sumSquares += centered * centered;
        }
        const rms = Math.sqrt(sumSquares / audioSampleBufferRef.current.length);
        if (rms >= 0.055) {
          speechStreakMsRef.current += AUDIO_SAMPLE_INTERVAL;
        } else {
          speechStreakMsRef.current = Math.max(0, speechStreakMsRef.current - AUDIO_SAMPLE_INTERVAL);
        }

        if (speechStreakMsRef.current >= 2200) {
          triggerViolation(
            'speech_detected',
            'Sustained speech energy detected by browser VAD',
            'Speech detected. Please work in silence.',
            'medium',
            15000,
            {
              persist: false,
              confidence: Math.min(0.95, 0.5 + rms * 5),
              durationMs: speechStreakMsRef.current,
            },
          );
          speechStreakMsRef.current = 0;
        }
      }, AUDIO_SAMPLE_INTERVAL);
    },
    [triggerViolation],
  );

  const stopRecorderSafely = useCallback((context: string) => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || typeof recorder.stop !== 'function') {
      mediaRecorderRef.current = null;
      return;
    }
    if (recorder.state === 'inactive') return;
    try {
      recorder.stop();
    } catch (error) {
      console.error(`Failed to stop media recorder (${context}):`, error);
    }
  }, []);

  const setupAudioRecorder = useCallback(
    (stream: MediaStream) => {
      if (audioRecorderUnsupportedRef.current) {
        mediaRecorderRef.current = null;
        setAudioReady(false);
        return;
      }
      if (stream.getAudioTracks().length === 0 || typeof MediaRecorder === 'undefined') {
        mediaRecorderRef.current = null;
        setAudioReady(false);
        return;
      }

      try {
        const recorderOptions = getSupportedRecorderOptions();
        if (!recorderOptions) {
          mediaRecorderRef.current = null;
          if (!audioRecorderUnsupportedRef.current) {
            audioRecorderUnsupportedRef.current = true;
            if (!audioCapabilityAlertShownRef.current) {
              audioCapabilityAlertShownRef.current = true;
              addAlert(
                'Audio recording unsupported in this browser. Speech checks are limited.',
                'low',
              );
            }
            if (!audioCapabilityEventLoggedRef.current) {
              audioCapabilityEventLoggedRef.current = true;
              queueEvent({
                event_type: 'audio_capability_limited',
                severity: 'low',
                payload: {
                  reason: 'media_recorder_not_supported',
                  source: 'frontend-live',
                },
                confidence: 1,
                duration_ms: 0,
              });
            }
          }
          setAudioReady(false);
          return;
        }

        const recorder = new MediaRecorder(stream, recorderOptions);
        mediaRecorderRef.current = recorder;
        setAudioReady(true);
        audioCapabilityAlertShownRef.current = false;
        audioCapabilityEventLoggedRef.current = false;

        recorder.ondataavailable = async (event) => {
          if (!event.data || event.data.size <= 0 || pausedRef.current) return;

          const blob = event.data;
          const durationMs = Date.now() - lastAudioChunkTimeRef.current;
          lastAudioChunkTimeRef.current = Date.now();
          const localSpeechDetected = await estimateSpeechFromAudio(blob);
          let remoteResult = null as Awaited<
            ReturnType<typeof proctoringService.analyzeAudio>
          > | null;

          if (localSpeechDetected) {
            triggerViolation(
              'speech_detected',
              'Speech detected by browser VAD during session',
              'Speech detected. Please work in silence.',
              'medium',
              15000,
              {
                persist: false,
                confidence: 0.72,
                durationMs,
              },
            );

            if (!mlDegradedRef.current) {
              remoteResult = await proctoringService.analyzeAudio(sessionId, blob, durationMs);
            }
          }

          if (!remoteResult) return;
          if (remoteResult.voice_count > 1) {
            triggerViolation(
              'multiple_voices',
              `Multiple voices detected (${remoteResult.voice_count})`,
              `Multiple voices detected (${remoteResult.voice_count}).`,
              'high',
              20000,
              {
                persist: false,
                confidence: Math.max(0.75, Number(remoteResult.speech_confidence || 0.75)),
                durationMs,
              },
            );
          }
          if (remoteResult.suspicious_keywords.length > 0) {
            triggerViolation(
              'suspicious_conversation',
              `Suspicious keywords: ${remoteResult.suspicious_keywords.join(', ')}`,
              'Suspicious conversation detected.',
              'high',
              20000,
              {
                persist: false,
                confidence: 0.82,
                durationMs,
              },
            );
          }
        };

        recorder.onerror = () => {
          mediaRecorderRef.current = null;
          if (!audioRecorderUnsupportedRef.current) {
            audioRecorderUnsupportedRef.current = true;
            if (!audioCapabilityAlertShownRef.current) {
              audioCapabilityAlertShownRef.current = true;
              addAlert(
                'Audio recording unavailable in this browser. Speech checks are limited.',
                'low',
              );
            }
            if (!audioCapabilityEventLoggedRef.current) {
              audioCapabilityEventLoggedRef.current = true;
              queueEvent({
                event_type: 'audio_capability_limited',
                severity: 'low',
                payload: {
                  reason: 'media_recorder_error',
                  source: 'frontend-live',
                },
                confidence: 1,
                duration_ms: 0,
              });
            }
          }
          setAudioReady(false);
        };

        recorder.start(AUDIO_CHUNK_DURATION);
      } catch (error) {
        mediaRecorderRef.current = null;
        console.error('Audio recorder unavailable:', error);
        if (!audioRecorderUnsupportedRef.current) {
          audioRecorderUnsupportedRef.current = true;
          if (!audioCapabilityAlertShownRef.current) {
            audioCapabilityAlertShownRef.current = true;
            addAlert(
              'Audio recording unsupported in this browser. Speech checks are limited.',
              'low',
            );
          }
          if (!audioCapabilityEventLoggedRef.current) {
            audioCapabilityEventLoggedRef.current = true;
            queueEvent({
              event_type: 'audio_capability_limited',
              severity: 'low',
              payload: {
                reason: 'media_recorder_exception',
                source: 'frontend-live',
              },
              confidence: 1,
              duration_ms: 0,
            });
          }
        }
        setAudioReady(false);
      }
    },
    [addAlert, estimateSpeechFromAudio, getSupportedRecorderOptions, queueEvent, sessionId, triggerViolation],
  );

  const restartStream = useCallback(async () => {
    stopRecorderSafely('restart-before-track-swap');
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
    if (previewVideoRef.current) {
      previewVideoRef.current.srcObject = stream;
      await previewVideoRef.current.play().catch(() => undefined);
    }
    initializeNativeFaceDetector();
    setupAudioEnergySampler(stream);
    setupAudioRecorder(stream);
    setCameraReady(true);
    setMicReady(stream.getAudioTracks().length > 0);
    await checkAudioSupport();
  }, [checkAudioSupport, initializeNativeFaceDetector, setupAudioEnergySampler, setupAudioRecorder, stopRecorderSafely]);

  const checkRequiredDevices = useCallback(async () => {
    const stream = mediaStreamRef.current;
    const videoTrack = stream?.getVideoTracks()[0];
    const audioTrack = stream?.getAudioTracks()[0];
    const cameraOn = Boolean(
      videoTrack &&
      videoTrack.readyState === 'live' &&
      videoTrack.enabled &&
      !videoTrack.muted &&
      stream?.active,
    );
    const micOn = Boolean(audioTrack && audioTrack.readyState === 'live' && audioTrack.enabled && !audioTrack.muted);
    const audioOn = audioReadyRef.current;

    setCameraReady(cameraOn);
    setMicReady(micOn);

    const missing = buildMissingDevices(cameraOn, micOn, audioOn);
    const hasBlockingMissing = missing.camera || missing.microphone;
    const blockedByRiskPause = livenessRequiredRef.current || Boolean(livenessChallengeRef.current);

    if (hasBlockingMissing) {
      deviceMissingStreakRef.current += 1;
      deviceReadyStreakRef.current = 0;
    } else {
      deviceReadyStreakRef.current += 1;
      deviceMissingStreakRef.current = 0;
    }

    if (missing.audio) {
      if (!audioCapabilityAlertShownRef.current) {
        audioCapabilityAlertShownRef.current = true;
        addAlert('Audio capability is limited. Session continues with reduced speech checks.', 'low');
      }
      if (!audioCapabilityEventLoggedRef.current) {
        audioCapabilityEventLoggedRef.current = true;
        queueEvent({
          event_type: 'audio_capability_limited',
          severity: 'low',
          payload: {
            reason: 'audio_support_unavailable',
            source: 'frontend-live',
          },
          confidence: 1,
          duration_ms: 0,
        });
      }
    } else {
      audioCapabilityAlertShownRef.current = false;
      audioCapabilityEventLoggedRef.current = false;
    }

    if (!hasBlockingMissing) {
      if (
        pausedRef.current &&
        !blockedByRiskPause &&
        deviceReadyStreakRef.current >= DEVICE_READY_STREAK_THRESHOLD
      ) {
        const shouldMarkReadyToResume =
          missingDevicesRef.current.camera ||
          missingDevicesRef.current.microphone ||
          lastPauseSourceRef.current === 'device';

        if (shouldMarkReadyToResume) {
          await applyPauseState({
            paused: true,
            reason: 'All required devices are detected. Click "Resume session" to continue.',
            missing: EMPTY_MISSING,
            source: 'device',
            syncWithBackend: false,
          });
        }
      }
      return;
    }

    if (deviceMissingStreakRef.current < DEVICE_MISSING_STREAK_THRESHOLD) {
      return;
    }

    if (
      pausedRef.current &&
      missingDevicesRef.current.camera === missing.camera &&
      missingDevicesRef.current.microphone === missing.microphone &&
      lastPauseSourceRef.current === 'device'
    ) {
      return;
    }

    if (missing.camera) {
      triggerViolation('camera_off', 'Camera unavailable', 'Camera is off. Session paused.', 'high', CAMERA_COOLDOWN_MS);
    }
    if (missing.microphone) {
      triggerViolation('microphone_off', 'Microphone unavailable', 'Microphone is off. Session paused.', 'high', CAMERA_COOLDOWN_MS);
    }
    const reason = `Required device unavailable: ${[
      missing.camera ? 'camera' : '',
      missing.microphone ? 'microphone' : '',
    ]
      .filter(Boolean)
      .join(', ')}`;
    queueEvent({
      event_type: 'session_paused',
      severity: 'high',
      payload: { reason, missing },
    });
    await applyPauseState({
      paused: true,
      reason,
      missing,
      source: 'device',
    });
  }, [addAlert, applyPauseState, buildMissingDevices, queueEvent, triggerViolation]);

  const applyFaceSignal = useCallback(
    (result: FaceMonitorResult, source: 'browser' | 'ml') => {
      updateFaceGuidance(result);
      if (result.face_count === 0) {
        noFaceStreakRef.current += 1;
        if (noFaceStreakRef.current >= NO_FACE_STREAK_THRESHOLD) {
          triggerViolation(
            'no_face',
            `No face detected in consecutive frames (${source})`,
            'No face detected. Keep your face visible.',
            'medium',
            12000,
            {
              persist: false,
              confidence: Math.max(0.65, Number(result.confidence || 0.65)),
              durationMs: noFaceStreakRef.current * FRAME_CAPTURE_INTERVAL,
            },
          );
        }
      } else {
        noFaceStreakRef.current = 0;
      }

      if (result.face_count > 1) {
        triggerViolation(
          'multiple_faces',
          `Multiple faces detected (${result.face_count})`,
          `Multiple faces detected (${result.face_count}).`,
          'high',
          15000,
          {
            persist: false,
            confidence: Math.max(0.78, Number(result.confidence || 0.78)),
            durationMs: FRAME_CAPTURE_INTERVAL,
          },
        );
      }

      const now = Date.now();
      if (result.gaze_direction?.looking_away) {
        if (!lookAwayStartRef.current) lookAwayStartRef.current = now;
        lookAwayEventsRef.current = [...lookAwayEventsRef.current, now].filter((ts) => now - ts <= LOOK_AWAY_WINDOW_MS);
        if (lookAwayEventsRef.current.length >= LOOK_AWAY_THRESHOLD) {
          triggerViolation(
            'looking_away',
            'Looked away repeatedly within one minute',
            'You are looking away too frequently.',
            'medium',
            30000,
            {
              persist: false,
              confidence: Math.max(0.65, Number(result.gaze_direction?.confidence || 0.65)),
              durationMs: LOOK_AWAY_WINDOW_MS,
            },
          );
          lookAwayEventsRef.current = [];
        }
        if (lookAwayStartRef.current && now - lookAwayStartRef.current >= LOOK_AWAY_CONTINUOUS_MS) {
          triggerViolation(
            'looking_away',
            'Looked away continuously for over one minute',
            'You looked away for too long.',
            'high',
            60000,
            {
              persist: false,
              confidence: Math.max(0.72, Number(result.gaze_direction?.confidence || 0.72)),
              durationMs: now - lookAwayStartRef.current,
            },
          );
          lookAwayStartRef.current = now;
        }
      } else {
        lookAwayStartRef.current = null;
      }
    },
    [triggerViolation, updateFaceGuidance],
  );

  const captureAndAnalyzeFrame = useCallback(async () => {
    if (pausedRef.current || !videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    if (video.videoWidth === 0 || video.videoHeight === 0) return;
    const local = await detectFacesLocally();
    if (local) {
      applyFaceSignal(local, 'browser');
      return;
    }

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
      applyFaceSignal(result, 'ml');
    }, 'image/jpeg', 0.82);
  }, [applyFaceSignal, detectFacesLocally, sessionId]);

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
      if (status.riskState) {
        setRiskState(status.riskState);
      }
      if (status.status === 'paused') {
        const reason = status.pauseReason || 'Session paused by server';
        if (reason.startsWith('Consensus risk pause:')) {
          lastRiskPauseReasonRef.current = reason;
        }
        await applyPauseState({
          paused: true,
          reason,
          missing: buildMissingDevices(
            cameraReadyRef.current,
            micReadyRef.current,
            audioReadyRef.current,
          ),
          source: 'server',
          syncWithBackend: false,
        });
      } else if (status.status === 'active' && pausedRef.current) {
        commitPauseState(false, '', EMPTY_MISSING, 'server');
      }
      if (status.status === 'active') {
        setIsLivenessRequired(false);
        if (!livenessChallengeRef.current) {
          lastRiskPauseReasonRef.current = '';
        }
      }
      connectionIssueAlertShownRef.current = false;
    } catch (error) {
      console.error('Failed to send heartbeat:', error);
      if (!connectionIssueAlertShownRef.current) {
        connectionIssueAlertShownRef.current = true;
        addAlert(
          'Connection to proctoring server is unstable. Local checks continue while sync retries.',
          'medium',
        );
      }
    }
  }, [addAlert, applyPauseState, buildMissingDevices, commitPauseState, sessionId]);

  const pollRiskState = useCallback(async () => {
    try {
      const risk = await proctoringService.getSessionRisk(sessionId);
      setRiskState(risk.risk_state);
      const livenessRequiredNow = Boolean(risk.liveness_required);
      setIsLivenessRequired(livenessRequiredNow);
      if (!livenessRequiredNow && livenessChallengeRef.current) {
        setLivenessChallenge(null);
      }

      if (risk.risk_state === 'paused' && risk.pause_recommended) {
        const reasonDetail = risk.reasons?.[0] || 'session paused by consensus proctoring policy';
        const reason = `Consensus risk pause: ${reasonDetail}`;
        lastRiskPauseReasonRef.current = reason;
        await applyPauseState({
          paused: true,
          reason,
          missing: missingDevicesRef.current,
          source: 'risk',
        });
      }

      if (livenessRequiredNow) {
        await issueLivenessChallenge(false);
      }
    } catch (error) {
      console.error('Failed to poll session risk:', error);
      if (!connectionIssueAlertShownRef.current) {
        connectionIssueAlertShownRef.current = true;
        addAlert(
          'Could not sync live risk state with server. Monitoring will keep retrying.',
          'medium',
        );
      }
    }
  }, [addAlert, applyPauseState, issueLivenessChallenge, sessionId]);

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
    cameraCheckIntervalRef.current = setInterval(() => void checkRequiredDevices(), CAMERA_CHECK_INTERVAL);
    heartbeatIntervalRef.current = setInterval(() => void sendHeartbeat(), HEARTBEAT_INTERVAL);
    riskPollIntervalRef.current = setInterval(() => void pollRiskState(), RISK_POLL_INTERVAL);
    eventsFlushIntervalRef.current = setInterval(() => void flushEventBuffer(), EVENT_FLUSH_INTERVAL);
    return removeEvents;
  }, [captureAndAnalyzeFrame, checkRequiredDevices, flushEventBuffer, pollRiskState, restartStream, sendHeartbeat, triggerViolation]);

  useEffect(() => {
    let cancelled = false;
    let retryTimer: NodeJS.Timeout | null = null;
    let periodicTimer: NodeJS.Timeout | null = null;

    const scheduleRetry = () => {
      if (retryTimer) {
        clearTimeout(retryTimer);
      }
      retryTimer = setTimeout(() => {
        void runHealthCheck(true);
      }, 6000);
    };

    const runHealthCheck = async (isRetry: boolean) => {
      const markDegraded = () => {
        mlHealthFailureStreakRef.current += 1;
        if (mlHealthFailureStreakRef.current < 2) {
          if (!isRetry) {
            scheduleRetry();
          }
          return;
        }

        setMlDegraded(true);
        if (!mlHealthAlertShownRef.current) {
          mlHealthAlertShownRef.current = true;
          addAlert(
            'ML analysis degraded. Core proctoring checks continue, and the developer is still improving this component.',
            'medium',
          );
        }
      };

      try {
        const health = await proctoringService.healthCheck();
        if (cancelled) return;
        const degradedReasons = Array.isArray(health.degraded_reasons)
          ? health.degraded_reasons
          : [];
        const isAudioOnlyDegraded =
          degradedReasons.length > 0 &&
          degradedReasons.every((reason) => reason === 'audio_detector_unavailable');

        if (health.degraded && !isAudioOnlyDegraded) {
          markDegraded();
          return;
        }

        mlHealthFailureStreakRef.current = 0;
        mlHealthAlertShownRef.current = false;
        setMlDegraded(false);
      } catch {
        if (cancelled) return;
        markDegraded();
      }
    };

    void runHealthCheck(false);
    periodicTimer = setInterval(() => {
      void runHealthCheck(false);
    }, 45000);

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      if (periodicTimer) clearInterval(periodicTimer);
    };
  }, [addAlert]);

  useEffect(() => {
    let removeEvents: (() => void) | undefined;
    const activeAlertTimeouts = alertTimeoutsRef.current;
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
      if (cameraCheckIntervalRef.current) clearInterval(cameraCheckIntervalRef.current);
      if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
      if (riskPollIntervalRef.current) clearInterval(riskPollIntervalRef.current);
      if (audioSampleIntervalRef.current) clearInterval(audioSampleIntervalRef.current);
      if (eventsFlushIntervalRef.current) clearInterval(eventsFlushIntervalRef.current);
      removeEvents?.();
      stopRecorderSafely('component-cleanup');
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      mediaRecorderRef.current = null;
      audioSourceRef.current?.disconnect();
      audioSourceRef.current = null;
      audioAnalyserRef.current = null;
      audioSampleBufferRef.current = null;
      void audioContextRef.current?.close().catch(() => undefined);
      audioContextRef.current = null;
      void flushEventBuffer();
      Object.keys(activeAlertTimeouts).forEach((id) => clearAlertTimer(id));
    };
  }, [addAlert, clearAlertTimer, flushEventBuffer, startProctoring, stopRecorderSafely]);

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
      queueEvent({
        event_type: 'device_recovery',
        severity: 'low',
        payload: { target },
      });
      void sendHeartbeat();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to recover required device.';
      addAlert(message, 'high');
    } finally {
      setIsRecovering(null);
    }
  }, [addAlert, checkAudioSupport, checkRequiredDevices, queueEvent, restartStream, sendHeartbeat]);

  const requestLivenessChallenge = useCallback(async () => {
    try {
      await issueLivenessChallenge(true);
    } catch (error) {
      console.error('Failed to request liveness challenge:', error);
      addAlert('Unable to start liveness challenge. Try again.', 'medium');
    }
  }, [addAlert, issueLivenessChallenge]);

  const verifyLiveness = useCallback(async () => {
    if (!livenessChallenge) return;
    setIsVerifyingLiveness(true);
    try {
      const result = await proctoringService.livenessCheck(sessionId, {
        response_action: livenessAction,
      });
      if (result.verified) {
        setLivenessChallenge(null);
        setIsLivenessRequired(Boolean(result.liveness_required));
        setRiskState(result.risk_state || 'observe');
        const currentMissing = buildMissingDevices(
          cameraReadyRef.current,
          micReadyRef.current,
          audioReadyRef.current,
        );
        if (pausedRef.current && !currentMissing.camera && !currentMissing.microphone) {
          await applyPauseState({
            paused: true,
            reason: 'Liveness verified. Click "Resume session" to continue.',
            missing: currentMissing,
            source: 'risk',
            syncWithBackend: false,
          });
        }
        toast.success('Liveness verified. You can resume the session.');
      } else {
        setIsLivenessRequired(true);
        addAlert(result.message || 'Liveness check failed.', 'medium');
      }
    } catch (error) {
      console.error('Failed to verify liveness challenge:', error);
      addAlert('Liveness verification failed. Try again.', 'medium');
    } finally {
      setIsVerifyingLiveness(false);
    }
  }, [addAlert, applyPauseState, buildMissingDevices, livenessAction, livenessChallenge, sessionId]);

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

  const requiresLiveness = Boolean(livenessChallenge) || isLivenessRequired;
  const canResume =
    !missingDevices.camera &&
    !missingDevices.microphone &&
    !requiresLiveness &&
    !isResumingSession;

  return (
    <>
      <canvas ref={canvasRef} style={{ display: 'none' }} />
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        className="fixed -left-[9999px] top-0 h-px w-px opacity-0 pointer-events-none"
      />

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
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Session Paused</h3>
              <span className="text-xs px-2 py-1 rounded bg-muted text-foreground">
                Risk: {riskState}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">{pauseReason || 'Required proctoring device is missing.'}</p>
            <div className="space-y-2">
              <button onClick={() => void requestRecovery('camera')} disabled={!missingDevices.camera || isRecovering !== null} className="w-full px-3 py-2 rounded border border-border text-sm hover:bg-muted disabled:opacity-60">Turn on camera</button>
              <button onClick={() => void requestRecovery('microphone')} disabled={!missingDevices.microphone || isRecovering !== null} className="w-full px-3 py-2 rounded border border-border text-sm hover:bg-muted disabled:opacity-60">Turn on microphone</button>
              <button onClick={() => void requestRecovery('audio')} disabled={!missingDevices.audio || isRecovering !== null} className="w-full px-3 py-2 rounded border border-border text-sm hover:bg-muted disabled:opacity-60">Enable audio</button>
            </div>
            {(requiresLiveness || livenessChallenge) && (
              <div className="rounded-lg border border-border p-3 space-y-2 bg-muted/30">
                <p className="text-sm font-medium">Liveness verification required</p>
                {livenessChallenge ? (
                  <>
                    <p className="text-xs text-muted-foreground">{livenessChallenge.prompt}</p>
                    <select
                      value={livenessAction}
                      onChange={(event) => setLivenessAction(event.target.value as typeof livenessAction)}
                      className="w-full rounded border border-border bg-background px-2 py-1 text-sm"
                    >
                      <option value="turn_left">Turn left</option>
                      <option value="turn_right">Turn right</option>
                      <option value="look_up">Look up</option>
                      <option value="look_down">Look down</option>
                      <option value="blink_once">Blink once</option>
                    </select>
                    <div className="flex gap-2">
                      <button
                        onClick={() => void verifyLiveness()}
                        disabled={isVerifyingLiveness}
                        className="flex-1 px-3 py-2 rounded bg-primary text-primary-foreground text-sm disabled:opacity-60"
                      >
                        {isVerifyingLiveness ? 'Verifying...' : 'Verify liveness'}
                      </button>
                      <button
                        onClick={() => void requestLivenessChallenge()}
                        disabled={isVerifyingLiveness}
                        className="px-3 py-2 rounded border border-border text-sm hover:bg-muted disabled:opacity-60"
                      >
                        New challenge
                      </button>
                    </div>
                  </>
                ) : (
                  <button
                    onClick={() => void requestLivenessChallenge()}
                    className="w-full px-3 py-2 rounded border border-border text-sm hover:bg-muted"
                  >
                    Start liveness check
                  </button>
                )}
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={() => void requestRecovery('all')} disabled={isRecovering !== null} className="px-3 py-2 rounded border border-border text-sm hover:bg-muted disabled:opacity-60 flex items-center gap-2">
                <RefreshCw className={`h-4 w-4 ${isRecovering ? 'animate-spin' : ''}`} />
                Re-check all
              </button>
              <button
                onClick={() =>
                  void applyPauseState({
                    paused: false,
                    reason: '',
                    missing: missingDevicesRef.current,
                    source: 'manual',
                  })
                }
                disabled={!canResume || isRecovering !== null}
                className="flex-1 px-3 py-2 rounded bg-primary text-primary-foreground text-sm disabled:opacity-60"
              >
                {isResumingSession ? 'Resuming...' : 'Resume session'}
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
              <span className="text-[10px] px-2 py-0.5 rounded bg-muted text-foreground capitalize">
                {riskState}
              </span>
              <button onClick={() => setIsMinimized(true)} className="text-muted-foreground hover:text-foreground p-1">
                <Minimize2 className="h-4 w-4" />
              </button>
            </div>
            <div className="p-3">
              <div className="relative rounded-lg overflow-hidden border border-border bg-black">
                <video
                  ref={previewVideoRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-full h-40 object-cover"
                />
                <div className="absolute top-2 right-2 flex gap-1">
                  <div className={`w-2 h-2 rounded-full ${cameraReady ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                  <div className={`w-2 h-2 rounded-full ${micReady ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                </div>
                <div className="absolute top-2 left-2 text-[11px] px-2 py-1 rounded bg-amber-600/85 text-white max-w-[78%]">
                  {faceGuidance}
                </div>
              </div>
            </div>
            <div className="px-3 pb-3">
              <button
                type="button"
                onClick={() => setShowGuidance((previous) => !previous)}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                {showGuidance ? 'Hide guidance' : 'Show guidance'}
              </button>
              {showGuidance && (
                <div className="mt-2 text-xs text-muted-foreground space-y-1">
                  <p>- Camera and microphone must stay on</p>
                  <p>- Session pauses automatically on device-off</p>
                  <p>- Browser-first face/audio checks with consensus policy</p>
                  {mlDegraded && (
                    <p>- ML analysis currently degraded. Core checks continue; the developer is still improving this component.</p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default ProctoringMonitor;
