import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { Category } from './AuthContext';
import { challengeService, type Challenge as BackendChallenge } from '@/services/challengeService';
import { dashboardService } from '@/services/dashboardService';

export type Difficulty = 'Easy' | 'Medium' | 'Hard';
export type ChallengeStatus = 'completed' | 'in_progress' | 'not_started';

interface UserSubmissionSnapshot {
  challenge_id: string;
  status: 'pending' | 'graded' | 'failed';
  score: number | null;
  judge_status?: 'queued' | 'running' | 'completed' | 'failed';
  submitted_at: string;
}

export interface Challenge {
  id: string;
  title: string;
  category: Category;
  difficulty: Difficulty;
  targetSeniority?: 'graduate' | 'junior' | 'mid' | 'senior';
  description: string;
  duration: number;
  points: number;
  status: ChallengeStatus;
  completed?: boolean;
  score?: number;
}

interface ChallengeContextType {
  challenges: Challenge[];
  selectedChallenge: Challenge | null;
  isLoading: boolean;
  error: string | null;
  selectChallenge: (challenge: Challenge | null) => void;
  filterByCategory: (category: Category | 'All') => Challenge[];
  filterByDifficulty: (difficulty: Difficulty | 'All') => Challenge[];
  fetchChallenges: () => Promise<void>;
  getAssignedChallenge: (category?: Category) => Promise<Challenge>;
}

const ChallengeContext = createContext<ChallengeContextType | undefined>(undefined);

const sanitizeDurationMinutes = (rawDuration: unknown, fallback: number): number => {
  let duration = Number(rawDuration ?? fallback);
  if (!Number.isFinite(duration) || duration <= 0) {
    duration = fallback;
  }
  if (duration > 300) {
    duration = Math.round(duration / 60);
  }
  return Math.round(Math.min(300, Math.max(5, duration)));
};

// Helper function to map backend challenge to frontend format
const mapBackendChallenge = (
  backendChallenge: BackendChallenge,
  submissions: UserSubmissionSnapshot[],
): Challenge => {
  const challengeSubmissions = submissions
    .filter((sub) => sub.challenge_id === backendChallenge.challenge_id)
    .sort(
      (a, b) =>
        new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime(),
    );

  const latestGraded = challengeSubmissions.find((sub) => sub.status === 'graded');
  const latestSubmission = challengeSubmissions[0];
  const status: ChallengeStatus = latestGraded
    ? 'completed'
    : latestSubmission
      ? 'in_progress'
      : 'not_started';

  // Map backend difficulty to frontend format
  const difficultyMap: Record<string, Difficulty> = {
    'easy': 'Easy',
    'medium': 'Medium', 
    'hard': 'Hard'
  };

  // Map backend category (case-insensitive)
  const categoryMap: Record<string, Category> = {
    'frontend': 'Frontend',
    'backend': 'Backend',
    'security': 'Security',
    'it support': 'IT Support',
    'devops': 'DevOps',
    'cloud engineering': 'Cloud Engineering',
    'data science': 'Data Science',
    'mobile development': 'Mobile Development',
    'qa testing': 'QA Testing',
    // Add any other categories from your backend
  };

  const backendCategory = (backendChallenge.category || '').toLowerCase().trim();
  const mappedCategory = categoryMap[backendCategory] || 'Frontend'; // Default to Frontend

  // Calculate points based on difficulty
  const points = backendChallenge.difficulty === 'easy' ? 100 : 
                 backendChallenge.difficulty === 'medium' ? 150 : 200;

  const duration = sanitizeDurationMinutes(
    backendChallenge.duration_minutes,
    backendChallenge.difficulty === 'easy' ? 30 :
    backendChallenge.difficulty === 'medium' ? 45 : 60,
  );

  return {
    id: backendChallenge.challenge_id,
    title: backendChallenge.title,
    category: mappedCategory,
    difficulty: difficultyMap[backendChallenge.difficulty?.toLowerCase()] || 'Medium',
    targetSeniority: backendChallenge.target_seniority,
    description: backendChallenge.description || 'No description available.',
    duration: duration,
    points: points,
    status,
    completed: status === 'completed',
    score: latestGraded?.score ?? undefined,
  };
};

export function ChallengeProvider({ children }: { children: ReactNode }) {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [selectedChallenge, setSelectedChallenge] = useState<Challenge | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUserSubmissions = async (): Promise<UserSubmissionSnapshot[]> => {
    const token = localStorage.getItem('yoScore_auth_token');
    if (!token) {
      return [];
    }

    try {
      const submissions = await dashboardService.getUserSubmissions();
      return submissions;
    } catch (error) {
      console.error('Failed to fetch submissions:', error);
      return [];
    }
  };

  const fetchChallenges = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Fetch in parallel: challenges and submission history.
      const [backendChallenges, submissions] = await Promise.all([
        challengeService.getAllChallenges(),
        fetchUserSubmissions()
      ]);
      
      // Transform backend challenges to frontend format
      const mappedChallenges = backendChallenges.map(challenge => 
        mapBackendChallenge(challenge, submissions)
      );
      
      setChallenges(mappedChallenges);
    } catch (err) {
      console.error('Failed to fetch challenges:', err);
      setError('Failed to load challenges. Please try again.');
      setChallenges([]); // Set empty array instead of mock data
    } finally {
      setIsLoading(false);
    }
  }, []);

  const getAssignedChallenge = useCallback(async (category?: Category): Promise<Challenge> => {
    try {
      const submissions = await fetchUserSubmissions();
      const backendChallenge = await challengeService.getNextChallenge(category);
      return mapBackendChallenge(backendChallenge, submissions);
    } catch (err) {
      console.error('Failed to get next challenge:', err);
      throw err;
    }
  }, []);

  const selectChallenge = (challenge: Challenge | null) => {
    setSelectedChallenge(challenge);
  };

  const filterByCategory = (category: Category | 'All') => {
    if (category === 'All') return challenges;
    return challenges.filter((c) => c.category === category);
  };

  const filterByDifficulty = (difficulty: Difficulty | 'All') => {
    if (difficulty === 'All') return challenges;
    return challenges.filter((c) => c.difficulty === difficulty);
  };

  // Fetch challenges on mount
  useEffect(() => {
    fetchChallenges();
  }, [fetchChallenges]);

  return (
    <ChallengeContext.Provider
      value={{
        challenges,
        selectedChallenge,
        isLoading,
        error,
        selectChallenge,
        filterByCategory,
        filterByDifficulty,
        fetchChallenges,
        getAssignedChallenge,
      }}
    >
      {children}
    </ChallengeContext.Provider>
  );
}

export function useChallenges() {
  const context = useContext(ChallengeContext);
  if (context === undefined) {
    throw new Error('useChallenges must be used within a ChallengeProvider');
  }
  return context;
}
