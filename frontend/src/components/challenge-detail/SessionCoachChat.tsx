import { useMemo, useState } from 'react';
import { Loader2, MessageSquare, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  challengeService,
  type CoachChatMessage,
  type RunCodeResponse,
} from '@/services/challengeService';
import type { SupportedLanguageCode } from '@/constants/languages';

interface ChatEntry extends CoachChatMessage {
  snippet?: string | null;
}

interface SessionCoachChatProps {
  challengeId: string;
  sessionId: string | null;
  language: SupportedLanguageCode;
  code: string;
  runContext: RunCodeResponse | null;
  disabled?: boolean;
}

const STARTER_PROMPTS = [
  'Help me debug the current failure.',
  'What edge cases should I test next?',
  'Review my approach without giving the full answer.',
];

export function SessionCoachChat({
  challengeId,
  sessionId,
  language,
  code,
  runContext,
  disabled = false,
}: SessionCoachChatProps) {
  const [messages, setMessages] = useState<ChatEntry[]>([]);
  const [draft, setDraft] = useState('');
  const [remainingMessages, setRemainingMessages] = useState<number>(12);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSend = useMemo(() => {
    return !disabled && Boolean(sessionId) && draft.trim().length > 0 && remainingMessages > 0;
  }, [disabled, draft, remainingMessages, sessionId]);

  const handleSend = async () => {
    if (!canSend || !sessionId) return;

    const nextUserMessage: ChatEntry = {
      role: 'user',
      content: draft.trim(),
    };

    setIsSending(true);
    setError(null);
    setMessages((previous) => [...previous, nextUserMessage]);
    setDraft('');

    try {
      const response = await challengeService.getCoachChat({
        challengeId,
        sessionId,
        language,
        code,
        messages: [...messages, nextUserMessage].map((message) => ({
          role: message.role,
          content: message.content,
        })),
        runContext:
          runContext === null
            ? undefined
            : {
                stdout: runContext.stdout,
                stderr: runContext.stderr,
                exit_code: runContext.exit_code,
                timed_out: runContext.timed_out,
                runtime_ms: runContext.runtime_ms,
                memory_kb: runContext.memory_kb,
                provider: runContext.provider,
              },
      });

      setMessages((previous) => [
        ...previous,
        {
          role: 'assistant',
          content: response.assistant_message,
          snippet: response.snippet,
        },
      ]);
      setRemainingMessages(response.remaining_messages);
    } catch (requestError) {
      const message =
        requestError instanceof Error
          ? requestError.message
          : 'Coach chat is temporarily unavailable.';
      setError(message);
      setMessages((previous) => previous.slice(0, -1));
      setDraft(nextUserMessage.content);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-card">
      <div className="border-b border-border px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <div>
              <h3 className="text-sm font-semibold">AI Coach Chat</h3>
              <p className="text-xs text-muted-foreground">
                Guided debugging only. Full solutions are blocked.
              </p>
            </div>
          </div>
          <span className="rounded-full border border-border px-2 py-1 text-[11px] text-muted-foreground">
            {remainingMessages} replies left
          </span>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-border px-4 py-3">
        {STARTER_PROMPTS.map((prompt) => (
          <button
            key={prompt}
            type="button"
            onClick={() => setDraft(prompt)}
            className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
          >
            {prompt}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-muted/20 p-4 text-sm text-muted-foreground">
            Ask for help debugging a runtime error, narrowing an edge case, reviewing your current
            approach, or understanding a short snippet. The coach stays inside the challenge context.
          </div>
        ) : (
          messages.map((message, index) => (
            <div
              key={`${message.role}-${index}`}
              className={`rounded-xl border p-3 ${
                message.role === 'assistant'
                  ? 'border-primary/20 bg-primary/5'
                  : 'border-border bg-muted/20'
              }`}
            >
              <div className="mb-1 flex items-center gap-2 text-[11px] uppercase tracking-wide text-muted-foreground">
                <MessageSquare className="h-3.5 w-3.5" />
                <span>{message.role === 'assistant' ? 'Coach' : 'You'}</span>
              </div>
              <p className="whitespace-pre-wrap text-sm text-foreground">{message.content}</p>
              {message.snippet ? (
                <pre className="mt-3 overflow-x-auto rounded-lg border border-border bg-background p-3 text-xs text-foreground">
                  <code>{message.snippet}</code>
                </pre>
              ) : null}
            </div>
          ))
        )}
      </div>

      <div className="border-t border-border p-4">
        {error ? <p className="mb-2 text-xs text-destructive">{error}</p> : null}
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          disabled={disabled || !sessionId || remainingMessages <= 0 || isSending}
          placeholder="Ask about a failing test, runtime issue, or edge case..."
          className="min-h-[110px] w-full rounded-xl border border-border bg-background p-3 text-sm outline-none transition focus:border-primary"
        />
        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            Keep prompts specific. The coach can review bugs and test strategy, not solve the whole
            challenge for you.
          </p>
          <Button
            type="button"
            onClick={() => void handleSend()}
            disabled={!canSend || isSending}
          >
            {isSending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending
              </>
            ) : (
              'Send'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

