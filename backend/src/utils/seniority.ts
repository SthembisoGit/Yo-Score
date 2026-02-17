export type SeniorityBand = 'graduate' | 'junior' | 'mid' | 'senior';

export const SENIORITY_ORDER: SeniorityBand[] = ['graduate', 'junior', 'mid', 'senior'];

export function getSeniorityBandFromMonths(totalMonths: number): SeniorityBand {
  const months = Number.isFinite(totalMonths) ? Math.max(0, Math.floor(totalMonths)) : 0;
  if (months <= 6) return 'graduate';
  if (months <= 24) return 'junior';
  if (months <= 60) return 'mid';
  return 'senior';
}

export function getFallbackBands(targetBand: SeniorityBand): SeniorityBand[] {
  const index = SENIORITY_ORDER.indexOf(targetBand);
  if (index <= 0) return [targetBand];

  const bands: SeniorityBand[] = [targetBand];
  for (let i = index - 1; i >= 0; i -= 1) {
    bands.push(SENIORITY_ORDER[i]);
  }
  return bands;
}
