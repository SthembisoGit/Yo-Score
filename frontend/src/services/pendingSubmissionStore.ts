const PENDING_SUBMISSIONS_KEY = 'yoscore:pending-submissions';
const SUBMISSION_SNAPSHOT_PREFIX = 'yoscore:submission-snapshot:';

type PendingStatus = 'pending' | 'graded' | 'failed';
type PendingJudgeStatus = 'queued' | 'running' | 'completed' | 'failed';

function readPendingIds(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(PENDING_SUBMISSIONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item) => typeof item === 'string' && item.length > 0);
  } catch {
    return [];
  }
}

function writePendingIds(ids: string[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(PENDING_SUBMISSIONS_KEY, JSON.stringify(Array.from(new Set(ids))));
}

export function isTerminalSubmissionState(
  status: PendingStatus | string,
  judgeStatus: PendingJudgeStatus | string,
): boolean {
  if (status === 'failed') return true;
  if (status === 'graded') return true;
  return judgeStatus === 'completed' || judgeStatus === 'failed';
}

export function trackPendingSubmission(submissionId: string) {
  if (!submissionId) return;
  const ids = readPendingIds();
  if (ids.includes(submissionId)) return;
  ids.push(submissionId);
  writePendingIds(ids);
}

export function untrackPendingSubmission(submissionId: string) {
  if (!submissionId) return;
  const ids = readPendingIds().filter((id) => id !== submissionId);
  writePendingIds(ids);
}

export function getPendingSubmissionIds(): string[] {
  return readPendingIds();
}

export function cacheSubmissionSnapshot(submissionId: string, payload: unknown) {
  if (typeof window === 'undefined' || !submissionId) return;
  try {
    window.localStorage.setItem(
      `${SUBMISSION_SNAPSHOT_PREFIX}${submissionId}`,
      JSON.stringify(payload),
    );
  } catch {
    // ignore storage quota issues
  }
}

export function getCachedSubmissionSnapshot<T>(submissionId: string): T | null {
  if (typeof window === 'undefined' || !submissionId) return null;
  try {
    const raw = window.localStorage.getItem(`${SUBMISSION_SNAPSHOT_PREFIX}${submissionId}`);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}
