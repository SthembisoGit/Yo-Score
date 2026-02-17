import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { Category } from './AuthContext';
import { challengeService } from '@/services/challengeService';
import { dashboardService } from '@/services/dashboardService';

export type Difficulty = 'Easy' | 'Medium' | 'Hard';

export interface Challenge {
  id: string;
  title: string;
  category: Category;
  difficulty: Difficulty;
  targetSeniority?: 'graduate' | 'junior' | 'mid' | 'senior';
  description: string;
  duration: number;
  points: number;
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

// Helper function to map backend challenge to frontend format
const mapBackendChallenge = (backendChallenge: any, completedSubmissions: any[]): Challenge => {
  // Find if this challenge has a completed submission
  const submission = completedSubmissions.find(
    sub => sub.challenge_id === backendChallenge.challenge_id && sub.status === 'graded'
  );
  
  const isCompleted = !!submission;
  
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

  const duration = Number(backendChallenge.duration_minutes ?? (
    backendChallenge.difficulty === 'easy' ? 30 :
    backendChallenge.difficulty === 'medium' ? 45 : 60
  ));

  return {
    id: backendChallenge.challenge_id,
    title: backendChallenge.title,
    category: mappedCategory,
    difficulty: difficultyMap[backendChallenge.difficulty?.toLowerCase()] || 'Medium',
    targetSeniority: backendChallenge.target_seniority,
    description: backendChallenge.description || 'No description available.',
    duration: duration,
    points: points,
    completed: isCompleted,
    score: submission?.score
  };
};

export function ChallengeProvider({ children }: { children: ReactNode }) {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [selectedChallenge, setSelectedChallenge] = useState<Challenge | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCompletedSubmissions = async (): Promise<any[]> => {
    const token = localStorage.getItem('yoScore_auth_token');
    if (!token) {
      return [];
    }

    try {
      const submissions = await dashboardService.getUserSubmissions();
      return submissions.filter(sub => sub.status === 'graded');
    } catch (error) {
      console.error('Failed to fetch submissions:', error);
      return [];
    }
  };

  const fetchChallenges = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Fetch in parallel: challenges and completed submissions
      const [backendChallenges, completedSubmissions] = await Promise.all([
        challengeService.getAllChallenges(),
        fetchCompletedSubmissions()
      ]);
      
      // Transform backend challenges to frontend format
      const mappedChallenges = backendChallenges.map(challenge => 
        mapBackendChallenge(challenge, completedSubmissions)
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
      const completedSubmissions = await fetchCompletedSubmissions();
      const backendChallenge = await challengeService.getNextChallenge(category);
      return mapBackendChallenge(backendChallenge, completedSubmissions);
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
