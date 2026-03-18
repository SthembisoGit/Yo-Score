import axios from 'axios';
import { query } from '../db';
import { config } from '../config';
import { normalizeLanguage, type SupportedLanguage } from '../constants/languages';

export interface CoachChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface CoachChatInput {
  session_id: string;
  language: SupportedLanguage;
  code: string;
  messages: CoachChatMessage[];
  run_context?: {
    stdout?: string;
    stderr?: string;
    exit_code?: number;
    timed_out?: boolean;
    runtime_ms?: number;
    memory_kb?: number;
    provider?: string;
  };
}

export interface CoachChatResponse {
  assistant_message: string;
  remaining_messages: number;
  policy: {
    max_messages: number;
    full_solution_blocked: boolean;
    snippet_limited: boolean;
    mode: 'guided_chat';
  };
  snippet: string | null;
}

type PersistedChatRole = 'user' | 'assistant';

const MAX_ASSISTANT_REPLIES = 12;
const MAX_HISTORY_MESSAGES = 10;
const MAX_MESSAGE_CHARS = 1_500;
const MAX_CODE_CHARS = 12_000;
const MAX_SNIPPET_LINES = 8;
const MAX_SNIPPET_CHARS = 800;
const MAX_RUN_CONTEXT_CHARS = 2_500;

const aiClient = axios.create({
  baseURL: config.OPENAI_BASE_URL.replace(/\/$/, ''),
  timeout: config.OPENAI_TIMEOUT_MS,
});

const trimText = (value: unknown, maxChars: number): string => {
  const text = String(value ?? '').trim();
  if (!text) return '';
  return text.slice(0, maxChars);
};

const sanitizeHistory = (messages: CoachChatMessage[]): CoachChatMessage[] =>
  messages
    .filter(
      (message) =>
        (message.role === 'user' || message.role === 'assistant') &&
        typeof message.content === 'string' &&
        message.content.trim().length > 0,
    )
    .slice(-MAX_HISTORY_MESSAGES)
    .map((message) => ({
      role: message.role,
      content: trimText(message.content, MAX_MESSAGE_CHARS),
    }));

export const isExplicitSolutionRequest = (message: string): boolean => {
  const normalized = trimText(message, MAX_MESSAGE_CHARS).toLowerCase();
  if (!normalized) return false;
  return [
    'give me the answer',
    'full solution',
    'write the full code',
    'complete the code',
    'solve it for me',
    'just give me the code',
    'entire solution',
  ].some((phrase) => normalized.includes(phrase));
};

const extractJsonBlock = (input: string): string => {
  const fencedMatch = input.match(/```json\s*([\s\S]*?)```/i);
  if (fencedMatch?.[1]) {
    return fencedMatch[1].trim();
  }

  const objectMatch = input.match(/\{[\s\S]*\}/);
  return objectMatch?.[0]?.trim() ?? input.trim();
};

const sanitizeSnippet = (snippet: unknown): string | null => {
  const text = trimText(snippet, MAX_SNIPPET_CHARS);
  if (!text) return null;
  const lines = text
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0)
    .slice(0, MAX_SNIPPET_LINES);
  return lines.length > 0 ? lines.join('\n') : null;
};

export const sanitizeCoachChatOutput = (input: string): {
  assistant_message: string;
  snippet: string | null;
} => {
  const fallbackMessage = trimText(input, MAX_MESSAGE_CHARS) || 'Try a smaller debugging question.';
  try {
    const parsed = JSON.parse(extractJsonBlock(input)) as {
      assistant_message?: unknown;
      snippet?: unknown;
    };
    const assistantMessage =
      trimText(parsed.assistant_message, MAX_MESSAGE_CHARS) || fallbackMessage;
    return {
      assistant_message: assistantMessage,
      snippet: sanitizeSnippet(parsed.snippet),
    };
  } catch {
    return {
      assistant_message: fallbackMessage,
      snippet: null,
    };
  }
};

const extractOutputText = (payload: unknown): string => {
  if (
    payload &&
    typeof payload === 'object' &&
    'output_text' in payload &&
    typeof (payload as { output_text?: unknown }).output_text === 'string'
  ) {
    return (payload as { output_text: string }).output_text;
  }

  if (
    payload &&
    typeof payload === 'object' &&
    Array.isArray((payload as { output?: unknown[] }).output)
  ) {
    const blocks = (payload as { output: Array<{ content?: Array<{ text?: string }> }> }).output;
    const text = blocks
      .flatMap((item) => item.content ?? [])
      .map((item) => item.text ?? '')
      .join('\n')
      .trim();
    return text;
  }

  return '';
};

const refusalResponse = (): {
  assistant_message: string;
  snippet: string | null;
} => ({
  assistant_message:
    'I can help you reason about the bug, test cases, and debugging steps, but I cannot provide a full solution. Ask for one failing edge case, a smaller snippet, or help interpreting your run output.',
  snippet: null,
});

export class CoachChatService {
  private schemaReady: Promise<void> | null = null;

  private async ensureSchema(): Promise<void> {
    if (!this.schemaReady) {
      this.schemaReady = (async () => {
        await query(
          `CREATE TABLE IF NOT EXISTS ai_chat_events (
             id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
             session_id UUID REFERENCES proctoring_sessions(id) ON DELETE CASCADE,
             challenge_id UUID REFERENCES challenges(id) ON DELETE CASCADE,
             user_id UUID REFERENCES users(id) ON DELETE CASCADE,
             role VARCHAR(20) NOT NULL,
             content TEXT NOT NULL,
             contains_code BOOLEAN NOT NULL DEFAULT false,
             blocked BOOLEAN NOT NULL DEFAULT false,
             created_at TIMESTAMP DEFAULT NOW()
           )`,
        );
        await query(
          `CREATE INDEX IF NOT EXISTS idx_ai_chat_events_session_role
           ON ai_chat_events(session_id, role, created_at)`,
        );
      })().catch((error) => {
        this.schemaReady = null;
        throw error;
      });
    }

    await this.schemaReady;
  }

  private async persistChatEvent(
    sessionId: string,
    challengeId: string,
    userId: string,
    role: PersistedChatRole,
    content: string,
    options?: { blocked?: boolean; containsCode?: boolean },
  ): Promise<void> {
    await query(
      `INSERT INTO ai_chat_events
         (session_id, challenge_id, user_id, role, content, contains_code, blocked)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        sessionId,
        challengeId,
        userId,
        role,
        trimText(content, 12_000),
        options?.containsCode === true,
        options?.blocked === true,
      ],
    );
  }

  async getChatForChallenge(
    userId: string,
    challengeId: string,
    input: CoachChatInput,
  ): Promise<CoachChatResponse> {
    await this.ensureSchema();

    if (!config.OPENAI_API_KEY) {
      throw new Error('AI coach chat is not configured on this server');
    }

    const language = normalizeLanguage(input.language);
    const sessionId = trimText(input.session_id, 64);
    if (!sessionId) {
      throw new Error('Session ID is required for AI coach chat');
    }

    const sanitizedMessages = sanitizeHistory(input.messages);
    const latestUserMessage = [...sanitizedMessages].reverse().find((entry) => entry.role === 'user');
    if (!latestUserMessage) {
      throw new Error('At least one user chat message is required');
    }

    const [challengeResult, sessionResult, replyCountResult] = await Promise.all([
      query(
        `SELECT id, title, description
         FROM challenges
         WHERE id = $1`,
        [challengeId],
      ),
      query(
        `SELECT id, status
         FROM proctoring_sessions
         WHERE id = $1 AND user_id = $2 AND challenge_id = $3`,
        [sessionId, userId, challengeId],
      ),
      query(
        `SELECT COUNT(*)::int AS count
         FROM ai_chat_events
         WHERE session_id = $1
           AND challenge_id = $2
           AND user_id = $3
           AND role = 'assistant'`,
        [sessionId, challengeId, userId],
      ),
    ]);

    if (challengeResult.rows.length === 0) {
      throw new Error('Challenge not found');
    }
    if (sessionResult.rows.length === 0) {
      throw new Error('Invalid session for AI coach chat');
    }
    if (sessionResult.rows[0].status === 'completed') {
      throw new Error('Completed sessions cannot request AI coach chat');
    }

    const currentReplyCount = Number(replyCountResult.rows[0]?.count ?? 0);
    if (currentReplyCount >= MAX_ASSISTANT_REPLIES) {
      throw new Error('AI coach chat limit reached for this challenge session');
    }

    const challenge = challengeResult.rows[0];
    const sanitizedCode = trimText(input.code, MAX_CODE_CHARS);
    const stdout = trimText(input.run_context?.stdout, MAX_RUN_CONTEXT_CHARS);
    const stderr = trimText(input.run_context?.stderr, MAX_RUN_CONTEXT_CHARS);
    const provider = trimText(input.run_context?.provider, 40);

    await this.persistChatEvent(sessionId, challengeId, userId, 'user', latestUserMessage.content, {
      blocked: isExplicitSolutionRequest(latestUserMessage.content),
      containsCode: /```|class |function |def |public static|console\.log|print\(/i.test(
        latestUserMessage.content,
      ),
    });

    const nextReplyCount = currentReplyCount + 1;
    let responsePayload = refusalResponse();

    if (!isExplicitSolutionRequest(latestUserMessage.content)) {
      const systemPrompt = [
        'You are YoScore Coach Chat inside a monitored coding assessment.',
        'Your job is to help the developer debug, reason, and test without giving away the full solution.',
        'Hard rules:',
        '- Never provide a complete solution, full file rewrite, or exact final answer.',
        '- Snippets must stay short, targeted, and under 8 lines.',
        '- Focus on concepts, debugging, edge cases, test interpretation, security hints, and decomposition.',
        '- If the user asks for the answer directly, refuse briefly and redirect to a smaller step.',
        '- Return JSON only with keys: assistant_message, snippet.',
        `Challenge title: ${trimText(challenge.title, 180)}`,
        `Challenge summary: ${trimText(challenge.description, 1_200)}`,
        `Current language: ${language}`,
        sanitizedCode ? `Current code:\n${sanitizedCode}` : 'Current code: [empty]',
        stdout ? `Latest stdout:\n${stdout}` : 'Latest stdout: [none]',
        stderr ? `Latest stderr:\n${stderr}` : 'Latest stderr: [none]',
        provider ? `Execution provider: ${provider}` : 'Execution provider: [unknown]',
      ].join('\n');

      try {
        const response = await aiClient.post(
          '/responses',
          {
            model: config.OPENAI_MODEL,
            instructions: systemPrompt,
            store: false,
            max_output_tokens: 450,
            input: sanitizedMessages.map((message) => ({
              role: message.role,
              content: [
                {
                  type: 'input_text',
                  text: message.content,
                },
              ],
            })),
          },
          {
            headers: {
              Authorization: `Bearer ${config.OPENAI_API_KEY}`,
              'Content-Type': 'application/json',
            },
          },
        );

        const rawOutput = extractOutputText(response.data);
        responsePayload = sanitizeCoachChatOutput(rawOutput);
      } catch (error) {
        if (axios.isAxiosError(error) && error.response?.status === 401) {
          throw new Error('AI coach chat credentials are invalid on this server');
        }
        throw new Error('AI coach chat is temporarily unavailable');
      }
    }

    await this.persistChatEvent(
      sessionId,
      challengeId,
      userId,
      'assistant',
      responsePayload.assistant_message + (responsePayload.snippet ? `\n${responsePayload.snippet}` : ''),
      {
        blocked: isExplicitSolutionRequest(latestUserMessage.content),
        containsCode: Boolean(responsePayload.snippet),
      },
    );

    return {
      assistant_message: responsePayload.assistant_message,
      remaining_messages: Math.max(0, MAX_ASSISTANT_REPLIES - nextReplyCount),
      policy: {
        max_messages: MAX_ASSISTANT_REPLIES,
        full_solution_blocked: true,
        snippet_limited: true,
        mode: 'guided_chat',
      },
      snippet: responsePayload.snippet,
    };
  }
}

export const coachChatService = new CoachChatService();
