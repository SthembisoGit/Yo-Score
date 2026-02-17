import { test, expect } from '@playwright/test';

const queuedSubmission = {
  submission_id: 'sub-1',
  challenge_id: 'challenge-1',
  challenge_title: 'Two Sum',
  language: 'javascript',
  status: 'pending',
  judge_status: 'running',
  judge_error: null,
  judge_run_id: 'run-1',
  submitted_at: new Date().toISOString(),
  score: 0,
  score_breakdown: {
    components: {
      correctness: 0,
      efficiency: 0,
      style: 0,
      skill: 0,
      behavior: 0,
      work_experience: 0,
    },
    penalty: 0,
    scoring_version: 'v3.0',
  },
  penalties: { total: 0, violation_count: 0 },
  run_summary: { run_id: 'run-1', status: 'running', started_at: new Date().toISOString() },
  tests_summary: null,
  total_score: 0,
  trust_level: 'Low',
  violations: [],
};

const completedSubmission = {
  ...queuedSubmission,
  status: 'graded',
  judge_status: 'completed',
  score: 61,
  score_breakdown: {
    components: {
      correctness: 35,
      efficiency: 14,
      style: 4,
      skill: 53,
      behavior: 8,
      work_experience: 2,
    },
    penalty: 12,
    scoring_version: 'v3.0',
  },
  penalties: { total: 12, violation_count: 2 },
  tests_summary: { passed: 4, total: 5, runtime_ms: 124, memory_mb: 32 },
  total_score: 51,
  trust_level: 'Medium',
};

test('developer submission result progresses from running to completed', async ({ page }) => {
  let submissionCalls = 0;

  await page.addInitScript(() => {
    localStorage.setItem('yoScore_auth_token', 'dev-token');
  });

  await page.route('**/api/auth/validate', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        message: 'Token valid',
        data: {
          valid: true,
          user: {
            user_id: 'u-dev-1',
            name: 'Dev User',
            email: 'dev@example.com',
            role: 'developer',
          },
        },
      }),
    });
  });

  await page.route('**/api/submissions/sub-1', async (route) => {
    submissionCalls += 1;
    const data = submissionCalls === 1 ? queuedSubmission : completedSubmission;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        message: 'Submission fetched',
        data,
      }),
    });
  });

  await page.goto('/submissions/sub-1');

  await expect(page.getByRole('heading', { name: /submission results/i })).toBeVisible();
  await expect(page.getByText(/judge status:/i)).toContainText(/completed/i, {
    timeout: 15_000,
  });
  await expect(page.getByText(/tests passed/i)).toBeVisible();
  await expect(page.getByText('61')).toBeVisible();
});
