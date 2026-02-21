import type { Submission as DashboardSubmission } from '@/services/dashboardService';

interface ChallengeLike {
  id: string;
  category: string;
}

export interface CategoryScoreView {
  category: string;
  score: number;
}

const CATEGORY_ALIASES: Record<string, string> = {
  frontend: 'Frontend',
  backend: 'Backend',
  security: 'Security',
  devops: 'DevOps',
  'it support': 'IT Support',
  'cloud engineering': 'Cloud Engineering',
  'data science': 'Data Science',
  'mobile development': 'Mobile Development',
  'qa testing': 'QA Testing',
};

const normalizeCategoryKey = (value: string): string => value.trim().toLowerCase();

const toDisplayCategory = (rawCategory: string): string => {
  const key = normalizeCategoryKey(rawCategory);
  if (CATEGORY_ALIASES[key]) {
    return CATEGORY_ALIASES[key];
  }
  if (!key) return 'Unknown';
  return key
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(' ');
};

export const buildCategoryScoresFromSubmissions = (
  submissions: DashboardSubmission[],
  challenges: ChallengeLike[],
): CategoryScoreView[] => {
  const challengeCategoryById = new Map<string, string>(
    challenges.map((challenge) => [challenge.id, challenge.category]),
  );
  const groups = new Map<string, { label: string; total: number; count: number }>();

  submissions.forEach((submission) => {
    if (submission.status !== 'graded') return;
    if (typeof submission.score !== 'number' || Number.isNaN(submission.score)) return;

    const category = challengeCategoryById.get(submission.challenge_id);
    if (!category) return;

    const key = normalizeCategoryKey(category);
    const prev = groups.get(key) ?? {
      label: toDisplayCategory(category),
      total: 0,
      count: 0,
    };
    groups.set(key, {
      label: prev.label,
      total: prev.total + submission.score,
      count: prev.count + 1,
    });
  });

  return Array.from(groups.values())
    .map((group) => ({
      category: group.label,
      score: Math.round(group.total / Math.max(1, group.count)),
    }))
    .sort((a, b) => b.score - a.score);
};
