import React, { createContext, useContext, useState, ReactNode } from 'react';
import { Category } from './AuthContext';

export type Difficulty = 'Easy' | 'Medium' | 'Hard';

export interface Challenge {
  id: string;
  title: string;
  category: Category;
  difficulty: Difficulty;
  description: string;
  duration: number;
  points: number;
  completed?: boolean;
  score?: number;
}

interface ChallengeContextType {
  challenges: Challenge[];
  selectedChallenge: Challenge | null;
  selectChallenge: (challenge: Challenge | null) => void;
  filterByCategory: (category: Category | 'All') => Challenge[];
  filterByDifficulty: (difficulty: Difficulty | 'All') => Challenge[];
}

const ChallengeContext = createContext<ChallengeContextType | undefined>(undefined);

const mockChallenges: Challenge[] = [
  {
    id: '1',
    title: 'Build a Responsive Navigation',
    category: 'Frontend',
    difficulty: 'Easy',
    description: 'Create a responsive navigation component that collapses to a hamburger menu on mobile devices.',
    duration: 30,
    points: 100,
    completed: true,
    score: 85,
  },
  {
    id: '2',
    title: 'REST API Authentication',
    category: 'Backend',
    difficulty: 'Medium',
    description: 'Implement JWT-based authentication for a REST API with login, register, and token refresh endpoints.',
    duration: 45,
    points: 150,
    completed: true,
    score: 72,
  },
  {
    id: '3',
    title: 'SQL Injection Prevention',
    category: 'Security',
    difficulty: 'Hard',
    description: 'Identify and fix SQL injection vulnerabilities in a given codebase. Implement parameterized queries.',
    duration: 60,
    points: 200,
  },
  {
    id: '4',
    title: 'React State Management',
    category: 'Frontend',
    difficulty: 'Medium',
    description: 'Build a shopping cart using React Context API with add, remove, and quantity update functionality.',
    duration: 45,
    points: 150,
  },
  {
    id: '5',
    title: 'Database Schema Design',
    category: 'Backend',
    difficulty: 'Hard',
    description: 'Design an efficient database schema for an e-commerce platform with proper relationships and indexes.',
    duration: 60,
    points: 200,
  },
  {
    id: '6',
    title: 'XSS Attack Prevention',
    category: 'Security',
    difficulty: 'Medium',
    description: 'Sanitize user input to prevent cross-site scripting attacks in a web application.',
    duration: 40,
    points: 150,
  },
  {
    id: '7',
    title: 'Troubleshoot Network Issues',
    category: 'IT Support',
    difficulty: 'Easy',
    description: 'Diagnose and resolve common network connectivity problems using command-line tools.',
    duration: 25,
    points: 80,
  },
  {
    id: '8',
    title: 'CI/CD Pipeline Setup',
    category: 'DevOps',
    difficulty: 'Hard',
    description: 'Configure a complete CI/CD pipeline with automated testing, building, and deployment.',
    duration: 75,
    points: 250,
  },
  {
    id: '9',
    title: 'AWS S3 & Lambda Integration',
    category: 'Cloud Engineering',
    difficulty: 'Medium',
    description: 'Set up an S3 bucket with Lambda triggers for automatic image processing.',
    duration: 50,
    points: 175,
  },
  {
    id: '10',
    title: 'Data Visualization Dashboard',
    category: 'Data Science',
    difficulty: 'Medium',
    description: 'Create interactive charts and graphs to visualize large datasets with filtering capabilities.',
    duration: 55,
    points: 160,
  },
  {
    id: '11',
    title: 'Mobile App Navigation',
    category: 'Mobile Development',
    difficulty: 'Easy',
    description: 'Implement stack and tab navigation patterns in a React Native application.',
    duration: 35,
    points: 100,
  },
  {
    id: '12',
    title: 'Automated Test Suite',
    category: 'QA Testing',
    difficulty: 'Medium',
    description: 'Write comprehensive unit and integration tests for a web application using Jest and Cypress.',
    duration: 45,
    points: 140,
  },
];

export function ChallengeProvider({ children }: { children: ReactNode }) {
  const [challenges] = useState<Challenge[]>(mockChallenges);
  const [selectedChallenge, setSelectedChallenge] = useState<Challenge | null>(null);

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

  return (
    <ChallengeContext.Provider
      value={{
        challenges,
        selectedChallenge,
        selectChallenge,
        filterByCategory,
        filterByDifficulty,
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
