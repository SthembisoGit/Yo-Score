export const SUPPORTED_LANGUAGES = [
  'javascript',
  'python',
  'java',
  'cpp',
  'go',
  'csharp',
] as const;

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const LOCAL_LANGUAGES: SupportedLanguage[] = ['javascript', 'python'];
export const REMOTE_EXEC_LANGUAGES: SupportedLanguage[] = ['java', 'cpp', 'go', 'csharp'];

export const LANGUAGE_ALIASES: Record<string, SupportedLanguage> = {
  javascript: 'javascript',
  js: 'javascript',
  node: 'javascript',
  nodejs: 'javascript',
  python: 'python',
  py: 'python',
  java: 'java',
  cpp: 'cpp',
  cplusplus: 'cpp',
  'c++': 'cpp',
  cc: 'cpp',
  go: 'go',
  golang: 'go',
  csharp: 'csharp',
  cs: 'csharp',
  'c#': 'csharp',
};

export const LANGUAGE_DISPLAY_NAMES: Record<SupportedLanguage, string> = {
  javascript: 'JavaScript',
  python: 'Python',
  java: 'Java',
  cpp: 'C++',
  go: 'Go',
  csharp: 'C#',
};

export const LANGUAGE_FILE_NAMES: Record<SupportedLanguage, string> = {
  javascript: 'solution.js',
  python: 'solution.py',
  java: 'Main.java',
  cpp: 'main.cpp',
  go: 'main.go',
  csharp: 'Program.cs',
};

export const DEFAULT_CHALLENGE_LANGUAGES: SupportedLanguage[] = [...SUPPORTED_LANGUAGES];

export function isSupportedLanguage(value: string): value is SupportedLanguage {
  return Object.prototype.hasOwnProperty.call(LANGUAGE_ALIASES, value.toLowerCase());
}

export function normalizeLanguage(value: string): SupportedLanguage {
  const normalized = String(value ?? '').toLowerCase().trim();
  const mapped = LANGUAGE_ALIASES[normalized];
  if (!mapped) {
    throw new Error(
      `Unsupported language. Allowed: ${SUPPORTED_LANGUAGES.join(', ')}`,
    );
  }
  return mapped;
}

export function isLocalLanguage(language: SupportedLanguage): boolean {
  return LOCAL_LANGUAGES.includes(language);
}

export function isRemoteExecutionLanguage(language: SupportedLanguage): boolean {
  return REMOTE_EXEC_LANGUAGES.includes(language);
}
