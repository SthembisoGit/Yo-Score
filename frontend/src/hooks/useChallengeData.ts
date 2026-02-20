// hooks/useChallengeData.ts
import { useState, useEffect } from 'react';
import { challengeService } from '@/services/challengeService';

/**
 * Custom hook to fetch and manage challenge data
 */
export const useChallengeData = (challengeId: string | undefined) => {
  const [challenge, setChallenge] = useState<any>(null);
  const [referenceDocs, setReferenceDocs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [docsError, setDocsError] = useState<string | null>(null);

  const loadReferenceDocs = async (id: string) => {
    try {
      const docsData = await challengeService.getChallengeDocs(id);
      setReferenceDocs(docsData);
      setDocsError(null);
    } catch (docError: any) {
      setReferenceDocs([]);
      setDocsError(docError?.message || 'Reference docs are currently unavailable.');
    }
  };

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
      } catch (err: any) {
        const errorMessage = err.message || 'Failed to load challenge data';
        setError(errorMessage);
        console.error('Error fetching challenge data:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [challengeId]);

  return {
    challenge,
    referenceDocs,
    docsError,
    isLoading,
    error,
    refetchDocs: challengeId ? () => loadReferenceDocs(challengeId) : undefined,
  };
};
