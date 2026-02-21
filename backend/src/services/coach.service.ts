import { query } from '../db';
import { normalizeLanguage, type SupportedLanguage } from '../constants/languages';

export interface CoachHintInput {
  session_id?: string;
  language: SupportedLanguage;
  code: string;
  hint_index?: number;
}

export interface CoachHintResult {
  hint_index: number;
  remaining_hints: number;
  hint: string;
  snippet: string | null;
  policy: {
    max_hints: number;
    full_solution_blocked: boolean;
    snippet_limited: boolean;
    mode: 'concept_with_snippets';
  };
}

const MAX_HINTS = 3;
const MAX_SNIPPET_LINES = 6;

function getSnippet(language: SupportedLanguage, hintIndex: number): string | null {
  if (language !== 'python' && language !== 'javascript') {
    if (hintIndex === 1) {
      return `// Keep your solution modular:\n// 1) parse input\n// 2) compute result\n// 3) print output`;
    }
    if (hintIndex === 2) {
      return `// Add edge-case checks before main logic.\n// Validate empty and boundary input first.`;
    }
    return null;
  }

  if (hintIndex === 1) {
    return language === 'python'
      ? `def solve(input_data):\n    # 1) parse input\n    # 2) compute result\n    return result`
      : `function solve(inputData) {\n  // 1) parse input\n  // 2) compute result\n  return result;\n}`;
  }

  if (hintIndex === 2) {
    return language === 'python'
      ? `# Edge-case checks\nif not input_data:\n    return default_value`
      : `// Edge-case checks\nif (!inputData || inputData.length === 0) {\n  return defaultValue;\n}`;
  }

  return null;
}

function sanitizeSnippet(snippet: string | null): string | null {
  if (!snippet) return null;
  const lines = snippet.split('\n').slice(0, MAX_SNIPPET_LINES);
  const compact = lines.join('\n').trim();
  if (!compact) return null;
  return compact;
}

function buildHintText(
  challengeTitle: string,
  challengeDescription: string,
  code: string,
  hintIndex: number,
): string {
  const hasLoop = /\b(for|while)\b/.test(code);
  const hasCondition = /\b(if|else|switch|case)\b/.test(code);
  const hasFunction = /\b(function|def)\b/.test(code);
  const shortDesc = challengeDescription.slice(0, 180).trim();

  if (hintIndex === 1) {
    return [
      `Focus on the core objective in "${challengeTitle}".`,
      shortDesc ? `Restate the goal in one sentence: ${shortDesc}.` : null,
      hasFunction
        ? 'You already have a function shape. Keep responsibilities separate: parse input, compute, return.'
        : 'Start by creating one pure function that takes input and returns output.',
    ]
      .filter(Boolean)
      .join(' ');
  }

  if (hintIndex === 2) {
    return [
      'Now harden your approach with edge cases.',
      hasCondition
        ? 'You already use conditions; verify they cover empty input, boundary values, and malformed cases.'
        : 'Add explicit condition checks for empty input, boundary values, and malformed cases.',
      hasLoop
        ? 'Review loop bounds carefully to avoid off-by-one errors.'
        : 'If iteration is needed, define loop bounds from problem constraints before coding.',
    ].join(' ');
  }

  return [
    'Final hint: validate correctness before performance tuning.',
    'Create 3 quick manual tests: normal case, edge case, and failure-prone case.',
    'Then check time complexity and simplify any repeated work.',
  ].join(' ');
}

export class CoachService {
  async getHintForChallenge(
    userId: string,
    challengeId: string,
    input: CoachHintInput,
  ): Promise<CoachHintResult> {
    const language = normalizeLanguage(input.language);
    const code = String(input.code ?? '');
    const sessionId = input.session_id ?? null;

    const challengeResult = await query(
      `SELECT id, title, description
       FROM challenges
       WHERE id = $1`,
      [challengeId],
    );
    if (challengeResult.rows.length === 0) {
      throw new Error('Challenge not found');
    }

    if (sessionId) {
      const sessionResult = await query(
        `SELECT id
         FROM proctoring_sessions
         WHERE id = $1 AND user_id = $2 AND challenge_id = $3`,
        [sessionId, userId, challengeId],
      );
      if (sessionResult.rows.length === 0) {
        throw new Error('Invalid session for AI coach hint');
      }
    }

    const hintCountResult = await query(
      `SELECT COUNT(*)::int as count
       FROM ai_hint_events
       WHERE user_id = $1
         AND challenge_id = $2
         AND ($3::uuid IS NULL OR session_id = $3::uuid)`,
      [userId, challengeId, sessionId],
    );

    const currentCount = Number(hintCountResult.rows[0]?.count ?? 0);
    if (currentCount >= MAX_HINTS) {
      throw new Error('AI hint limit reached for this challenge session');
    }

    const hintIndex = currentCount + 1;
    const challenge = challengeResult.rows[0];
    const hint = buildHintText(
      String(challenge.title),
      String(challenge.description ?? ''),
      code,
      hintIndex,
    );
    const snippet = sanitizeSnippet(getSnippet(language, hintIndex));
    const containsCode = Boolean(snippet);

    await query(
      `INSERT INTO ai_hint_events (session_id, challenge_id, user_id, hint_index, contains_code)
       VALUES ($1, $2, $3, $4, $5)`,
      [sessionId, challengeId, userId, hintIndex, containsCode],
    );

    return {
      hint_index: hintIndex,
      remaining_hints: Math.max(0, MAX_HINTS - hintIndex),
      hint,
      snippet,
      policy: {
        max_hints: MAX_HINTS,
        full_solution_blocked: true,
        snippet_limited: true,
        mode: 'concept_with_snippets',
      },
    };
  }
}

export const coachService = new CoachService();
