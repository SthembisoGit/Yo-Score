import { useState, useCallback, useEffect } from 'react';
import { Camera, Mic, AlertTriangle, Shield } from 'lucide-react';
import {
  proctoringService,
  type ProctoringConsentPayload,
  type ProctoringPrivacyNotice,
} from '@/services/proctoring.service';

interface ProctoringModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (consent: ProctoringConsentPayload) => void;
  isLoading?: boolean;
}

type DeviceKey = 'camera' | 'microphone' | 'audio';

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

const fallbackPrivacyNotice: ProctoringPrivacyNotice = {
  require_consent: true,
  policy_version: '2026-02-25',
  policy_url: null,
  retention_days: 7,
  capture_scope: [
    'camera_presence_signals',
    'microphone_device_state',
    'proctoring_events',
    'limited_snapshots_on_triggers',
  ],
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
  const [checkingDevice, setCheckingDevice] = useState<DeviceKey | 'all' | null>(null);
  const [deviceError, setDeviceError] = useState<string | null>(null);
  const [deviceReadiness, setDeviceReadiness] =
    useState<DeviceReadiness>(defaultDeviceReadiness);
  const [privacyNotice, setPrivacyNotice] = useState<ProctoringPrivacyNotice>(fallbackPrivacyNotice);
  const [privacyChecked, setPrivacyChecked] = useState(false);
  const [privacyError, setPrivacyError] = useState<string | null>(null);

  const allDevicesReady =
    deviceReadiness.camera && deviceReadiness.microphone && deviceReadiness.audio;

  const checkAudioSupport = useCallback(async (): Promise<boolean> => {
    const audioContextClass =
      window.AudioContext ||
      (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

    if (!audioContextClass) {
      setDeviceReadiness((prev) => ({ ...prev, audio: false }));
      setDeviceError('Your browser does not support audio checks.');
      return false;
    }

    const context = new audioContextClass();
    try {
      await context.resume().catch(() => undefined);
      setDeviceReadiness((prev) => ({ ...prev, audio: true }));
      return true;
    } catch {
      setDeviceReadiness((prev) => ({ ...prev, audio: false }));
      setDeviceError('Audio support is blocked. Allow audio and try again.');
      return false;
    } finally {
      await context.close().catch(() => undefined);
    }
  }, []);

  const requestDevicePermission = useCallback(async (device: 'camera' | 'microphone') => {
    setCheckingDevice(device);
    setDeviceError(null);

    let stream: MediaStream | null = null;
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Your browser does not support camera/microphone permissions.');
      }

      stream = await navigator.mediaDevices.getUserMedia({
        video: device === 'camera',
        audio: device === 'microphone',
      });

      const track =
        device === 'camera' ? stream.getVideoTracks()[0] : stream.getAudioTracks()[0];
      const ready =
        Boolean(track) &&
        track.readyState === 'live' &&
        track.enabled &&
        !track.muted;

      setDeviceReadiness((prev) => ({ ...prev, [device]: ready }));

      if (!ready) {
        setDeviceError(
          device === 'camera'
            ? 'Camera was not enabled. Please allow camera permission.'
            : 'Microphone was not enabled. Please allow microphone permission.',
        );
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : `Unable to access ${device}. Check browser permissions.`;
      setDeviceError(message);
      setDeviceReadiness((prev) => ({ ...prev, [device]: false }));
    } finally {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
      setCheckingDevice(null);
    }
  }, []);

  const recheckAllDevices = useCallback(async () => {
    setCheckingDevice('all');
    setDeviceError(null);
    await requestDevicePermission('camera');
    await requestDevicePermission('microphone');
    await checkAudioSupport();
    setCheckingDevice(null);
  }, [checkAudioSupport, requestDevicePermission]);

  useEffect(() => {
    if (!isOpen) return;
    setPosition({
      x: (window.innerWidth - 448) / 2,
      y: (window.innerHeight - 580) / 2,
    });
    setDeviceReadiness(defaultDeviceReadiness);
    setDeviceError(null);
    setPrivacyChecked(false);
    setPrivacyError(null);
    void checkAudioSupport();

    let cancelled = false;
    void proctoringService
      .getPrivacyNotice()
      .then((notice) => {
        if (!cancelled) {
          setPrivacyNotice(notice);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPrivacyNotice(fallbackPrivacyNotice);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, checkAudioSupport]);

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
        y: Math.max(0, Math.min(e.clientY - dragStart.y, window.innerHeight - 580)),
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

  const isBusy = isLoading || checkingDevice !== null;

  const handleConfirm = () => {
    if (!privacyChecked) {
      setPrivacyError('Please accept the proctoring privacy notice before starting.');
      return;
    }

    setPrivacyError(null);
    onConfirm({
      accepted: true,
      accepted_at: new Date().toISOString(),
      policy_version: privacyNotice.policy_version,
      locale: typeof navigator?.language === 'string' ? navigator.language : 'en-US',
      scope: privacyNotice.capture_scope,
    });
  };

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
              Enable camera, microphone, and audio before starting
            </p>
          </div>
        </div>

        <div className="space-y-4 mb-6">
          <div className="p-3 bg-muted rounded-lg">
            <p className="text-sm">
              Use the buttons below to turn on each required device.
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Camera className="h-4 w-4" />
                <span className="text-sm font-medium">Camera</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2 py-1 rounded-full ${statusClass(deviceReadiness.camera)}`}>
                  {deviceReadiness.camera ? 'Ready' : 'Not ready'}
                </span>
                <button
                  type="button"
                  onClick={() => void requestDevicePermission('camera')}
                  disabled={isBusy}
                  className="px-3 py-1.5 rounded-md border border-border hover:bg-muted text-xs font-medium disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {checkingDevice === 'camera' ? 'Enabling...' : 'Turn on'}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Mic className="h-4 w-4" />
                <span className="text-sm font-medium">Microphone</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2 py-1 rounded-full ${statusClass(deviceReadiness.microphone)}`}>
                  {deviceReadiness.microphone ? 'Ready' : 'Not ready'}
                </span>
                <button
                  type="button"
                  onClick={() => void requestDevicePermission('microphone')}
                  disabled={isBusy}
                  className="px-3 py-1.5 rounded-md border border-border hover:bg-muted text-xs font-medium disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {checkingDevice === 'microphone' ? 'Enabling...' : 'Turn on'}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                <span className="text-sm font-medium">Audio Support</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2 py-1 rounded-full ${statusClass(deviceReadiness.audio)}`}>
                  {deviceReadiness.audio ? 'Ready' : 'Not ready'}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setCheckingDevice('audio');
                    void checkAudioSupport().finally(() => setCheckingDevice(null));
                  }}
                  disabled={isBusy}
                  className="px-3 py-1.5 rounded-md border border-border hover:bg-muted text-xs font-medium disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {checkingDevice === 'audio' ? 'Checking...' : 'Enable'}
                </button>
              </div>
            </div>
          </div>

          {deviceError && (
            <div className="p-3 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-800">
              <p className="text-sm text-red-800 dark:text-red-300">{deviceError}</p>
            </div>
          )}

          <div className="p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800">
            <p className="text-sm text-amber-800 dark:text-amber-300">
              If camera, microphone, or audio is turned off during the challenge, the session will pause.
            </p>
          </div>

          <div className="p-3 bg-muted rounded-lg border border-border space-y-2">
            <p className="text-sm font-medium">Privacy notice</p>
            <p className="text-xs text-muted-foreground">
              Proctoring captures device state, event logs, and limited snapshots when risk triggers occur.
              Evidence is retained for {privacyNotice.retention_days} days.
            </p>
            <p className="text-xs text-muted-foreground">
              Policy version: <span className="font-medium">{privacyNotice.policy_version}</span>
              {privacyNotice.policy_url ? (
                <>
                  {' '}
                  -{' '}
                  <a
                    href={privacyNotice.policy_url}
                    target="_blank"
                    rel="noreferrer"
                    className="underline"
                  >
                    View policy
                  </a>
                </>
              ) : null}
            </p>
            <label className="flex items-start gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={privacyChecked}
                onChange={(event) => {
                  setPrivacyChecked(event.target.checked);
                  if (event.target.checked) setPrivacyError(null);
                }}
                className="mt-0.5"
                disabled={isBusy}
              />
              <span>
                I understand and consent to proctoring capture and retention for assessment integrity.
              </span>
            </label>
            {privacyError ? (
              <p className="text-xs text-red-700 dark:text-red-400">{privacyError}</p>
            ) : null}
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
            onClick={() => void recheckAllDevices()}
            disabled={isBusy}
            className="px-4 py-2.5 rounded-lg border border-border hover:bg-muted transition-colors text-sm font-medium disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {checkingDevice === 'all' ? 'Checking...' : 'Re-check'}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isBusy || !allDevicesReady || !privacyChecked}
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
