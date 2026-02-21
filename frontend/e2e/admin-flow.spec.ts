import { test, expect } from '@playwright/test';

test('admin can open dashboard and publish a ready challenge', async ({ page }) => {
  let publishCalls = 0;

  await page.addInitScript(() => {
    localStorage.setItem('yoScore_auth_token', 'admin-token');
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
            user_id: 'u-admin-1',
            name: 'Admin User',
            email: 'admin@example.com',
            role: 'admin',
          },
        },
      }),
    });
  });

  await page.route('**/api/auth/rotate', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        message: 'Rotated',
        data: {
          token: 'admin-token-rotated',
        },
      }),
    });
  });

  await page.route('**/api/challenges', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        message: 'Challenges',
        data: [],
      }),
    });
  });

  await page.route('**/api/submissions', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        message: 'Submissions',
        data: [],
      }),
    });
  });

  await page.route('**/api/dashboard/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        message: 'Dashboard',
        data: {
          total_score: 42,
          trust_level: 'Medium',
          seniority_band: 'junior',
          category_scores: {},
          challenge_progress: [],
        },
      }),
    });
  });

  await page.route('**/api/users/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        message: 'Profile',
        data: {
          user_id: 'u-admin-1',
          name: 'Admin User',
          email: 'admin@example.com',
          role: 'admin',
          created_at: new Date().toISOString(),
        },
      }),
    });
  });

  await page.route('**/api/users/me/work-experience', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        message: 'Work experience',
        data: [],
      }),
    });
  });

  await page.route('**/api/admin/dashboard', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        message: 'Dashboard',
        data: {
          users_total: 4,
          challenges_total: 2,
          submissions_total: 7,
          judge_pending: 1,
          judge_failed: 0,
          queue: { waiting: 1, active: 0, completed: 10, failed: 0 },
        },
      }),
    });
  });

  await page.route('**/api/admin/challenges**', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          message: 'Challenges',
          data: [
            {
              challenge_id: 'challenge-1',
              title: 'Two Sum',
              description: 'Solve two sum',
              category: 'Backend',
              difficulty: 'Easy',
              target_seniority: 'junior',
              duration_minutes: 45,
              publish_status: 'draft',
              supported_languages: ['javascript', 'python'],
              readiness: {
                has_tests: true,
                baseline_languages: ['javascript', 'python'],
                missing_languages: [],
                is_ready: true,
              },
            },
          ],
        }),
      });
      return;
    }

    await route.continue();
  });

  await page.route('**/api/admin/challenges/challenge-1/publish', async (route) => {
    publishCalls += 1;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        message: 'Publish updated',
        data: {
          challenge_id: 'challenge-1',
          publish_status: 'published',
        },
      }),
    });
  });

  await page.route('**/api/admin/work-experience/flagged?*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        message: 'Flagged',
        data: [],
      }),
    });
  });

  await page.route('**/api/admin/judge/runs?*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        message: 'Runs',
        data: [],
      }),
    });
  });

  await page.route('**/api/admin/users', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        message: 'Users',
        data: [
          {
            user_id: 'u-dev-1',
            name: 'Dev User',
            email: 'dev@example.com',
            role: 'developer',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ],
      }),
    });
  });

  await page.route('**/api/admin/proctoring/sessions?*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        message: 'Sessions',
        data: [],
      }),
    });
  });

  await page.route('**/api/admin/proctoring/summary', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        message: 'Summary',
        data: {
          totalViolations: 0,
          totalPenalty: 0,
          byType: {},
          bySeverity: {},
        },
      }),
    });
  });

  await page.route('**/api/admin/proctoring/settings', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          message: 'Settings',
          data: {
            requireCamera: true,
            requireMicrophone: true,
            requireAudio: true,
            strictMode: false,
            allowedViolationsBeforeWarning: 3,
            autoPauseOnViolation: false,
          },
        }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        message: 'Updated',
        data: {
          requireCamera: true,
          requireMicrophone: true,
          requireAudio: true,
          strictMode: false,
          allowedViolationsBeforeWarning: 3,
          autoPauseOnViolation: false,
        },
      }),
    });
  });

  await page.route('**/api/admin/audit-logs?*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        message: 'Logs',
        data: [],
      }),
    });
  });

  await page.goto('/admin');

  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByText('Loading admin data...')).toBeHidden({ timeout: 20_000 });
  await expect(page.getByText('Two Sum')).toBeVisible();
  await page.getByRole('button', { name: 'Publish' }).first().click();
  await expect.poll(() => publishCalls).toBe(1);
});
