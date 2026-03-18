export type SessionDeviceClass = 'desktop' | 'laptop' | 'tablet' | 'mobile' | 'unknown';

export interface SessionClientContext {
  device_class: SessionDeviceClass;
  viewport: {
    width: number;
    height: number;
  };
  fullscreen_supported: boolean;
  fullscreen_active: boolean;
  camera_supported: boolean;
  microphone_supported: boolean;
}

export interface SessionEnvironmentAssessment {
  supported: boolean;
  reasons: string[];
  clientContext: SessionClientContext;
}

const MOBILE_USER_AGENT_PATTERN =
  /android|iphone|ipod|blackberry|iemobile|opera mini|mobile/i;
const TABLET_USER_AGENT_PATTERN = /ipad|tablet|kindle|playbook|silk/i;

const hasMediaSupport = (): boolean =>
  typeof navigator !== 'undefined' &&
  Boolean(navigator.mediaDevices?.getUserMedia);

const hasFullscreenSupport = (): boolean => {
  if (typeof document === 'undefined') return false;
  const root = document.documentElement as HTMLElement & {
    webkitRequestFullscreen?: () => Promise<void> | void;
  };
  return Boolean(
    document.fullscreenEnabled ||
      typeof root.requestFullscreen === 'function' ||
      typeof root.webkitRequestFullscreen === 'function',
  );
};

export const detectSessionDeviceClass = (
  userAgent: string,
  viewportWidth: number,
): SessionDeviceClass => {
  const normalized = String(userAgent ?? '').toLowerCase();
  if (TABLET_USER_AGENT_PATTERN.test(normalized)) return 'tablet';
  if (MOBILE_USER_AGENT_PATTERN.test(normalized)) return 'mobile';
  if (viewportWidth >= 1440) return 'desktop';
  if (viewportWidth >= 1024) return 'laptop';
  return 'unknown';
};

export const getSessionClientContext = (): SessionClientContext => {
  const width = typeof window !== 'undefined' ? window.innerWidth : 0;
  const height = typeof window !== 'undefined' ? window.innerHeight : 0;
  const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  return {
    device_class: detectSessionDeviceClass(userAgent, width),
    viewport: {
      width,
      height,
    },
    fullscreen_supported: hasFullscreenSupport(),
    fullscreen_active:
      typeof document !== 'undefined' ? Boolean(document.fullscreenElement) : false,
    camera_supported: hasMediaSupport(),
    microphone_supported: hasMediaSupport(),
  };
};

export const assessSessionEnvironment = (): SessionEnvironmentAssessment => {
  const clientContext = getSessionClientContext();
  const reasons: string[] = [];

  if (clientContext.device_class === 'mobile' || clientContext.device_class === 'tablet') {
    reasons.push('Use a desktop or laptop browser to take this challenge.');
  }

  if (clientContext.viewport.width < 1024) {
    reasons.push('Challenge sessions require a viewport at least 1024px wide.');
  }

  if (!clientContext.fullscreen_supported) {
    reasons.push('Your browser must support fullscreen mode for proctored sessions.');
  }

  if (!clientContext.camera_supported || !clientContext.microphone_supported) {
    reasons.push('Camera and microphone browser support are required.');
  }

  return {
    supported: reasons.length === 0,
    reasons,
    clientContext,
  };
};

