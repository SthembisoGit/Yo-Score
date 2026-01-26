// lib/challengeMappers.ts

/**
 * Maps backend challenge data to frontend display values
 */

// Color classes for difficulty badges
export const difficultyColors = {
  Easy: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  Medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  Hard: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
};

// Convert backend difficulty string to frontend display
export const difficultyDisplayMap: Record<string, 'Easy' | 'Medium' | 'Hard'> = {
  'easy': 'Easy',
  'medium': 'Medium',
  'hard': 'Hard'
};

// Get duration and points based on difficulty
export const getDurationAndPoints = (difficulty: string) => {
  const normalized = difficulty.toLowerCase();
  
  if (normalized === 'easy') {
    return { duration: 30, points: 100 };
  }
  
  if (normalized === 'medium') {
    return { duration: 45, points: 150 };
  }
  
  if (normalized === 'hard') {
    return { duration: 60, points: 200 };
  }
  
  // Default values
  return { duration: 45, points: 150 };
};