import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChallengeSession } from './ChallengeSession';

const {
  toastMock,
  submitChallengeMock,
  runCodeMock,
  getCoachHintMock,
  endSessionMock,
  navigateMock,
} = vi.hoisted(() => ({
  toastMock: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
  }),
  submitChallengeMock: vi.fn(),
  runCodeMock: vi.fn(),
  getCoachHintMock: vi.fn(),
  endSessionMock: vi.fn(),
  navigateMock: vi.fn(),
}));

vi.mock('react-hot-toast', () => ({
  toast: toastMock,
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock('@/components/CodeEditor', () => ({
  CodeEditor: ({ value = '' }: { value?: string }) => (
    <div data-testid="mock-code-editor">{String(value).slice(0, 20)}</div>
  ),
}));

vi.mock('./DescriptionPanel', () => ({
  DescriptionPanel: () => <div data-testid="description-panel" />,
}));

vi.mock('./LanguageSelector', () => ({
  LanguageSelector: () => <div data-testid="language-selector" />,
}));

vi.mock('./ReferenceDocsPanel', () => ({
  ReferenceDocsPanel: () => <div data-testid="reference-docs-panel" />,
}));

vi.mock('@/services/challengeService', () => ({
  challengeService: {
    submitChallenge: submitChallengeMock,
    runCode: runCodeMock,
    getCoachHint: getCoachHintMock,
  },
}));

vi.mock('@/services/proctoring.service', () => ({
  proctoringService: {
    endSession: endSessionMock,
  },
}));

const baseChallenge = {
  challenge_id: '11111111-1111-1111-1111-111111111111',
  title: 'Timer Challenge',
  description: 'A timed challenge',
  category: 'Backend',
  difficulty: 'medium' as const,
  duration_minutes: 40,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const flushPromises = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

describe('ChallengeSession timer warnings and timeout submit', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-25T10:00:00.000Z'));
    Object.defineProperty(window.navigator, 'onLine', { configurable: true, value: true });

    toastMock.mockClear();
    toastMock.success.mockClear();
    toastMock.error.mockClear();
    submitChallengeMock.mockReset();
    runCodeMock.mockReset();
    getCoachHintMock.mockReset();
    endSessionMock.mockReset();
    navigateMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows one-time 10-minute and 5-minute warnings', async () => {
    const deadlineAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    render(
      <ChallengeSession
        challenge={baseChallenge}
        referenceDocs={[]}
        selectedLanguage="python"
        availableLanguages={['python']}
        onLanguageChange={vi.fn()}
        challengeId={baseChallenge.challenge_id}
        sessionId="22222222-2222-2222-2222-222222222222"
        deadlineAt={deadlineAt}
        durationSeconds={40 * 60}
      />,
    );

    await act(async () => {
      await flushPromises();
    });

    expect(toastMock).toHaveBeenCalledWith(
      '10 minutes remaining. Wrap up and prepare to submit.',
      { duration: 5000 },
    );

    await act(async () => {
      vi.advanceTimersByTime(5 * 60 * 1000);
      await flushPromises();
    });

    expect(toastMock).toHaveBeenCalledWith('5 minutes remaining. Finalize and submit soon.', {
      duration: 6000,
    });

    const tenMinuteCalls = toastMock.mock.calls.filter(
      (entry) => entry[0] === '10 minutes remaining. Wrap up and prepare to submit.',
    ).length;
    const fiveMinuteCalls = toastMock.mock.calls.filter(
      (entry) => entry[0] === '5 minutes remaining. Finalize and submit soon.',
    ).length;

    expect(tenMinuteCalls).toBe(1);
    expect(fiveMinuteCalls).toBe(1);
  });

  it('auto-submits on timeout with timeoutSubmit=true and retries once on snapshot-processing delay', async () => {
    submitChallengeMock
      .mockRejectedValueOnce(
        new Error('Proctoring snapshot processing is still in progress. Please retry.'),
      )
      .mockResolvedValueOnce({
        submission_id: '33333333-3333-3333-3333-333333333333',
        status: 'pending',
        judge_status: 'queued',
        message: 'queued',
      });
    endSessionMock.mockResolvedValue(undefined);

    const deadlineAt = new Date(Date.now() + 1000).toISOString();

    render(
      <ChallengeSession
        challenge={baseChallenge}
        referenceDocs={[]}
        selectedLanguage="python"
        availableLanguages={['python']}
        onLanguageChange={vi.fn()}
        challengeId={baseChallenge.challenge_id}
        sessionId="44444444-4444-4444-4444-444444444444"
        isSessionPaused
        pauseReason="paused for test"
        deadlineAt={deadlineAt}
        durationSeconds={40 * 60}
      />,
    );

    await act(async () => {
      vi.advanceTimersByTime(1500);
      await flushPromises();
    });

    expect(submitChallengeMock).toHaveBeenCalledTimes(1);
    expect(submitChallengeMock.mock.calls[0]?.[4]).toEqual({ timeoutSubmit: true });

    await act(async () => {
      vi.advanceTimersByTime(2000);
      await flushPromises();
    });

    expect(submitChallengeMock).toHaveBeenCalledTimes(2);
    expect(submitChallengeMock.mock.calls[1]?.[4]).toEqual({ timeoutSubmit: true });
  });
});
