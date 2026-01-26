import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import { authService } from '@/services/authService';
import { dashboardService } from '@/services/dashboardService';

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
  role: string;
  avatar?: string;
  totalScore: number;
  trustLevel: 'Low' | 'Medium' | 'High';
  categoryScores: CategoryScore[];
  workExperienceMonths: number;
  preferredLanguage?: ProgrammingLanguage;
  preferredTool?: Tool;
  createdAt?: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string, role: string) => Promise<void>;
  logout: () => Promise<void>;
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true); // Start with loading to check token

  // Check for existing token on mount
 useEffect(() => {
  const checkAuth = async () => {
    const token = localStorage.getItem('yoScore_auth_token');
    
    if (token) {
      try {
        // Validate token with backend
        const response = await fetch('http://localhost:3000/api/auth/validate', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.ok) {
          const data = await response.json();
          
          // Transform backend user data to frontend User interface
          const userData: User = {
            id: data.user.user_id,
            name: data.user.name,
            email: data.user.email,
            role: data.user.role,
            totalScore: 0, 
            trustLevel: 'Low',
            categoryScores:[],
            workExperienceMonths: 0
          };
          
          setUser(userData);
        } else {
          // Token is invalid, remove it
          localStorage.removeItem('yoScore_auth_token');
        }
      } catch (error) {
        console.error('Token validation failed:', error);
        localStorage.removeItem('yoScore_auth_token');
      }
    }
    
    setIsLoading(false);
  };

  checkAuth();
}, []);


// In your AuthContext.tsx, update the login function:
const login = useCallback(async (email: string, password: string) => {
  setIsLoading(true);
  try {
    const response = await authService.login({ email, password });
    
    // Fetch dashboard data after successful login
    const dashboardData = await dashboardService.getDashboardData();
    const userProfile = await dashboardService.getUserProfile();
    const workExperience = await dashboardService.getWorkExperience();
    
    // Calculate total work experience months
    const totalWorkExperienceMonths = workExperience.reduce(
      (total, exp) => total + exp.duration_months, 
      0
    );
    
    // Convert category_scores object to array
    const categoryScoresArray = Object.entries(dashboardData.category_scores || {}).map(
      ([category, score]) => ({ category: category as any, score: score as number })
    );

    const userData: User = {
      id: userProfile.user_id,
      name: userProfile.name,
      email: userProfile.email,
      role: userProfile.role,
      totalScore: dashboardData.total_score,
      trustLevel: dashboardData.trust_level,
      categoryScores: categoryScoresArray,
      workExperienceMonths: totalWorkExperienceMonths,
      createdAt: userProfile.created_at
    };
    
    setUser(userData);
  } catch (error) {
    console.error('Login failed:', error);
    throw error;
  } finally {
    setIsLoading(false);
  }
}, []);

  const signup = useCallback(async (name: string, email: string, password: string, role: string = 'developer') => {
    setIsLoading(true);
    try {
      await authService.signup({ name, email, password, role });
      
      // After successful signup, automatically login
      await login(email, password);
    } catch (error) {
      console.error('Signup failed:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [login]);

  const logout = useCallback(async () => {
    setIsLoading(true);
    try {
      await authService.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setUser(null);
      setIsLoading(false);
    }
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