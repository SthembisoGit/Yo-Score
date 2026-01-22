import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export type Category = 
  | 'Frontend' 
  | 'Backend' 
  | 'Security' 
  | 'IT Support' 
  | 'DevOps' 
  | 'Cloud Engineering' 
  | 'Data Science' 
  | 'Mobile Development'
  | 'QA Testing';

export type ProgrammingLanguage = 
  | 'JavaScript' 
  | 'TypeScript' 
  | 'Python' 
  | 'Java' 
  | 'C#' 
  | 'Go' 
  | 'Rust' 
  | 'PHP'
  | 'Ruby'
  | 'Swift'
  | 'Kotlin';

export type Tool = 
  | 'VS Code' 
  | 'IntelliJ' 
  | 'Vim' 
  | 'Neovim' 
  | 'Sublime Text'
  | 'Atom'
  | 'WebStorm';

export interface CategoryScore {
  category: Category;
  score: number;
}

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  totalScore: number;
  trustLevel: 'Low' | 'Medium' | 'High';
  categoryScores: CategoryScore[];
  workExperienceMonths: number;
  preferredLanguage?: ProgrammingLanguage;
  preferredTool?: Tool;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  updateUser: (updates: Partial<User>) => void;
  setPreferredLanguage: (language: ProgrammingLanguage) => void;
  setPreferredTool: (tool: Tool) => void;
  availableLanguages: ProgrammingLanguage[];
  availableTools: Tool[];
  availableCategories: Category[];
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const availableLanguages: ProgrammingLanguage[] = [
  'JavaScript', 'TypeScript', 'Python', 'Java', 'C#', 'Go', 'Rust', 'PHP', 'Ruby', 'Swift', 'Kotlin'
];

const availableTools: Tool[] = [
  'VS Code', 'IntelliJ', 'Vim', 'Neovim', 'Sublime Text', 'Atom', 'WebStorm'
];

const availableCategories: Category[] = [
  'Frontend', 'Backend', 'Security', 'IT Support', 'DevOps', 'Cloud Engineering', 'Data Science', 'Mobile Development', 'QA Testing'
];

// Mock user for demo purposes
const mockUser: User = {
  id: '1',
  name: 'Alex Developer',
  email: 'alex@example.com',
  totalScore: 78,
  trustLevel: 'High',
  categoryScores: [
    { category: 'Frontend', score: 85 },
    { category: 'Backend', score: 72 },
    { category: 'Security', score: 68 },
    { category: 'DevOps', score: 55 },
    { category: 'Cloud Engineering', score: 60 },
  ],
  workExperienceMonths: 24,
  preferredLanguage: 'TypeScript',
  preferredTool: 'VS Code',
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const login = useCallback(async (email: string, password: string) => {
    setIsLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setUser(mockUser);
    setIsLoading(false);
  }, []);

  const signup = useCallback(async (name: string, email: string, password: string) => {
    setIsLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setUser({
      ...mockUser,
      name,
      email,
      totalScore: 0,
      trustLevel: 'Low',
      categoryScores: [],
      workExperienceMonths: 0,
    });
    setIsLoading(false);
  }, []);

  const logout = useCallback(() => {
    setUser(null);
  }, []);

  const updateUser = useCallback((updates: Partial<User>) => {
    setUser((prev) => (prev ? { ...prev, ...updates } : null));
  }, []);

  const setPreferredLanguage = useCallback((language: ProgrammingLanguage) => {
    setUser((prev) => (prev ? { ...prev, preferredLanguage: language } : null));
  }, []);

  const setPreferredTool = useCallback((tool: Tool) => {
    setUser((prev) => (prev ? { ...prev, preferredTool: tool } : null));
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        signup,
        logout,
        updateUser,
        setPreferredLanguage,
        setPreferredTool,
        availableLanguages,
        availableTools,
        availableCategories,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
