export const SUPPORTED_LANGUAGE_CODES = [
  'javascript',
  'python',
  'java',
  'cpp',
  'go',
  'csharp',
] as const;

export type SupportedLanguageCode = (typeof SUPPORTED_LANGUAGE_CODES)[number];

export const LANGUAGE_LABELS: Record<SupportedLanguageCode, string> = {
  javascript: 'JavaScript',
  python: 'Python',
  java: 'Java',
  cpp: 'C++',
  go: 'Go',
  csharp: 'C#',
};

export const LANGUAGE_ALIASES: Record<string, SupportedLanguageCode> = {
  javascript: 'javascript',
  js: 'javascript',
  node: 'javascript',
  python: 'python',
  py: 'python',
  java: 'java',
  cpp: 'cpp',
  'c++': 'cpp',
  csharp: 'csharp',
  'c#': 'csharp',
  cs: 'csharp',
  go: 'go',
  golang: 'go',
};

export const DISPLAY_TO_CODE: Record<string, SupportedLanguageCode> = {
  JavaScript: 'javascript',
  Python: 'python',
  Java: 'java',
  'C++': 'cpp',
  Go: 'go',
  'C#': 'csharp',
};

export const CODE_TO_DISPLAY: Record<SupportedLanguageCode, string> = {
  javascript: 'JavaScript',
  python: 'Python',
  java: 'Java',
  cpp: 'C++',
  go: 'Go',
  csharp: 'C#',
};

export const MONACO_LANGUAGE_IDS: Record<SupportedLanguageCode, string> = {
  javascript: 'javascript',
  python: 'python',
  java: 'java',
  cpp: 'cpp',
  go: 'go',
  csharp: 'csharp',
};

export const DEFAULT_LANGUAGE_BY_DISPLAY = 'JavaScript';

export function normalizeLanguageCode(input: string): SupportedLanguageCode {
  const normalized = String(input ?? '').trim();
  if (DISPLAY_TO_CODE[normalized]) return DISPLAY_TO_CODE[normalized];
  const lower = normalized.toLowerCase();
  const alias = LANGUAGE_ALIASES[lower];
  if (!alias) {
    return 'javascript';
  }
  return alias;
}
