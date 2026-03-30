import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import PublicShareScore from './PublicShareScore';

const { getPublicShareScoreMock } = vi.hoisted(() => ({
  getPublicShareScoreMock: vi.fn(),
}));

vi.mock('@/services/shareScoreService', () => ({
  shareScoreService: {
    getPublicShareScore: getPublicShareScoreMock,
  },
}));

describe('PublicShareScore', () => {
  beforeEach(() => {
    getPublicShareScoreMock.mockReset();
    Object.defineProperty(window, 'print', {
      configurable: true,
      value: vi.fn(),
    });
  });

  it('renders the public score sheet without requiring auth-only fields', async () => {
    getPublicShareScoreMock.mockResolvedValue({
      name: 'Share Tester',
      avatar_url: null,
      headline: 'Frontend Engineer',
      location: 'Johannesburg',
      total_score: 84,
      trust_level: 'High',
      seniority_band: 'mid',
      monthly_progress: 12,
      category_scores: {
        Frontend: 88,
        Backend: 74,
      },
      top_recent_results: [
        {
          challenge_title: 'Inclusive Counter',
          category: 'Frontend',
          language: 'javascript',
          score: 91,
          submitted_at: '2026-03-30T09:00:00.000Z',
        },
      ],
      public_links: {
        github_url: 'https://github.com/share-tester',
      },
      last_updated_at: '2026-03-30T10:00:00.000Z',
    });

    render(
      <MemoryRouter initialEntries={['/share/11111111-1111-1111-1111-111111111111']}>
        <Routes>
          <Route path="/share/:token" element={<PublicShareScore />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText('Share Tester')).toBeVisible();
    expect(screen.getByText(/Print \/ Save as PDF/i)).toBeVisible();
    expect(screen.getByText('Inclusive Counter')).toBeVisible();
    expect(screen.queryByText(/@example\.com/i)).not.toBeInTheDocument();
  }, 15_000);

  it('shows a safe unavailable state when the token cannot be loaded', async () => {
    getPublicShareScoreMock.mockRejectedValue(new Error('Shared score not available'));

    render(
      <MemoryRouter initialEntries={['/share/11111111-1111-1111-1111-111111111111']}>
        <Routes>
          <Route path="/share/:token" element={<PublicShareScore />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText(/This score sheet is unavailable/i)).toBeVisible();
    });
  });
});
