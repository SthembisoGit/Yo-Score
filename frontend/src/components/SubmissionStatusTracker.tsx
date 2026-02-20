import { useEffect, useRef } from 'react';
import { getPendingSubmissionIds } from '@/services/pendingSubmissionStore';
import { submissionService } from '@/services/submissionService';

const POLL_INTERVAL_MS = 12_000;
const MAX_CHECKS_PER_TICK = 5;

export function SubmissionStatusTracker() {
  const isCheckingRef = useRef(false);

  useEffect(() => {
    const checkPendingSubmissions = async () => {
      if (isCheckingRef.current || !navigator.onLine) return;

      const pendingIds = getPendingSubmissionIds().slice(0, MAX_CHECKS_PER_TICK);
      if (pendingIds.length === 0) return;

      isCheckingRef.current = true;
      try {
        for (const submissionId of pendingIds) {
          try {
            await submissionService.getSubmissionResult(submissionId);
          } catch {
            // keep pending id for retry on next interval/reconnect
          }
        }
      } finally {
        isCheckingRef.current = false;
      }
    };

    void checkPendingSubmissions();
    const interval = window.setInterval(() => {
      void checkPendingSubmissions();
    }, POLL_INTERVAL_MS);

    const handleOnline = () => {
      void checkPendingSubmissions();
    };

    window.addEventListener('online', handleOnline);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  return null;
}

