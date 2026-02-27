import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProctoringModal } from './ProctoringModal';

const { getPrivacyNoticeMock } = vi.hoisted(() => ({
  getPrivacyNoticeMock: vi.fn(),
}));

vi.mock('@/services/proctoring.service', () => ({
  proctoringService: {
    getPrivacyNotice: getPrivacyNoticeMock,
  },
}));

const buildStream = (constraints: MediaStreamConstraints): MediaStream => {
  const videoTrack = constraints.video
    ? { readyState: 'live', enabled: true, muted: false, stop: vi.fn() }
    : null;
  const audioTrack = constraints.audio
    ? { readyState: 'live', enabled: true, muted: false, stop: vi.fn() }
    : null;

  return {
    getVideoTracks: () => (videoTrack ? [videoTrack] : []),
    getAudioTracks: () => (audioTrack ? [audioTrack] : []),
    getTracks: () => [videoTrack, audioTrack].filter(Boolean),
  } as unknown as MediaStream;
};

class MockAudioContext {
  async resume() {
    return undefined;
  }

  async close() {
    return undefined;
  }
}

describe('ProctoringModal', () => {
  beforeEach(() => {
    getPrivacyNoticeMock.mockResolvedValue({
      require_consent: true,
      policy_version: '2026-02-25',
      policy_url: null,
      retention_days: 7,
      capture_scope: ['camera_presence_signals'],
      snapshot_handling: {
        capture_triggers: ['high_risk_events'],
        processing_mode: 'metadata',
        stored_after_processing: false,
        deleted_after_processing: true,
      },
      submission_hold_policy: {
        wait_for_snapshot_processing: true,
        max_wait_seconds: 30,
      },
    });

    Object.defineProperty(window, 'AudioContext', {
      configurable: true,
      writable: true,
      value: MockAudioContext,
    });

    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: vi.fn((constraints: MediaStreamConstraints) =>
          Promise.resolve(buildStream(constraints)),
        ),
      },
    });
  });

  it('renders with responsive fixed layout and dedicated scroll body', async () => {
    render(
      <ProctoringModal
        isOpen
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    const container = await screen.findByTestId('proctoring-modal-container');
    const scrollBody = screen.getByTestId('proctoring-modal-scroll-body');

    expect(container.className).toContain('w-[min(92vw,820px)]');
    expect(container.className).toContain('max-h-[88dvh]');
    expect(container.className).not.toContain('cursor-move');
    expect(scrollBody.className).toContain('overflow-y-auto');
  });

  it('keeps start button gated until devices are ready and privacy consent is checked', async () => {
    const onConfirm = vi.fn();
    render(
      <ProctoringModal
        isOpen
        onClose={vi.fn()}
        onConfirm={onConfirm}
      />,
    );

    const startButton = await screen.findByRole('button', { name: 'Start Proctored Session' });
    expect(startButton).toBeDisabled();

    const recheckButton = screen.getByRole('button', { name: 'Re-check' });
    fireEvent.click(recheckButton);

    const privacyCheckbox = screen.getByRole('checkbox');
    fireEvent.click(privacyCheckbox);

    await waitFor(() => {
      expect(startButton).toBeEnabled();
    });

    fireEvent.click(startButton);

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledWith(
      expect.objectContaining({
        accepted: true,
        policy_version: '2026-02-25',
      }),
    );
  });
});
