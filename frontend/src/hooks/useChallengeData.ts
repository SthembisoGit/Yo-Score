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

  useEffect(() => {
    const fetchData = async () => {
      if (!challengeId) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        // Fetch challenge details and reference docs in parallel
        const [challengeData, docsData] = await Promise.all([
          challengeService.getChallengeById(challengeId),
          challengeService.getChallengeDocs(challengeId).catch(() => [])
        ]);

        setChallenge(challengeData);
        setReferenceDocs(docsData);
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
    isLoading,
    error,
    // Optional: Add refetch function if needed
    refetch: () => {
      if (challengeId) {
        setIsLoading(true);
        setError(null);
      }
    }
  };
};