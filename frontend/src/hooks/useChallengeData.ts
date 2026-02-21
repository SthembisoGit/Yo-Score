// hooks/useChallengeData.ts
import { useState, useEffect, useCallback } from 'react';
import {
  challengeService,
  type Challenge,
  type ChallengeDocs,
} from '@/services/challengeService';

/**
 * Custom hook to fetch and manage challenge data
 */
const getErrorMessage = (err: unknown, fallback: string): string => {
  if (err instanceof Error && err.message) {
    return err.message;
  }
  return fallback;
};

export const useChallengeData = (challengeId: string | undefined) => {
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [referenceDocs, setReferenceDocs] = useState<ChallengeDocs[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [docsError, setDocsError] = useState<string | null>(null);

  const loadReferenceDocs = useCallback(async (id: string) => {
    try {
      const docsData = await challengeService.getChallengeDocs(id);
      setReferenceDocs(docsData);
      setDocsError(null);
    } catch (docError: unknown) {
      setReferenceDocs([]);
      setDocsError(getErrorMessage(docError, 'Reference docs are currently unavailable.'));
    }
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      if (!challengeId) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        // Fetch challenge details first; docs load can fail independently.
        const challengeData = await challengeService.getChallengeById(challengeId);

        setChallenge(challengeData);
        await loadReferenceDocs(challengeId);
      } catch (err: unknown) {
        const errorMessage = getErrorMessage(err, 'Failed to load challenge data');
        setError(errorMessage);
        console.error('Error fetching challenge data:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [challengeId, loadReferenceDocs]);

  return {
    challenge,
    referenceDocs,
    docsError,
    isLoading,
    error,
    refetchDocs: challengeId ? () => loadReferenceDocs(challengeId) : undefined,
  };
};
