import axios from 'axios';
import { config } from '../config';
import {
  isLocalLanguage,
  isRemoteExecutionLanguage,
  LANGUAGE_FILE_NAMES,
  normalizeLanguage,
  type SupportedLanguage,
} from '../constants/languages';
import { runnerService, type RunnerLanguage } from './runner.service';

export type ExecutionProvider = 'local' | 'onecompiler';

export interface ExecutionLimits {
  timeoutMs: number;
  memoryMb: number;
  maxOutputBytes: number;
}

export interface ExecuteCodeInput {
  language: SupportedLanguage;
  code: string;
  stdin?: string;
  limits?: Partial<ExecutionLimits>;
}

export interface ExecuteCodeResult {
  stdout: string;
  stderr: string;
  exit_code: number;
  timed_out: boolean;
  runtime_ms: number;
  memory_kb: number;
  truncated: boolean;
  provider: ExecutionProvider;
  error_class?: 'compile' | 'runtime' | 'timeout' | 'infrastructure';
}

const DEFAULT_LIMITS: ExecutionLimits = {
  timeoutMs: config.CODE_EXEC_TIMEOUT_MS,
  memoryMb: 256,
  maxOutputBytes: config.CODE_EXEC_MAX_OUTPUT_BYTES,
};

const ONECOMPILER_LANGUAGES: Record<SupportedLanguage, string | null> = {
  javascript: null,
  python: null,
  java: 'java',
  cpp: 'cpp',
  go: 'go',
  csharp: 'csharp',
};

function toLocalRunnerLanguage(language: SupportedLanguage): RunnerLanguage {
  return language === 'python' ? 'python' : 'node';
}

function normalizeStdin(stdin?: string): string {
  const raw = typeof stdin === 'string' ? stdin : '';
  const size = Buffer.byteLength(raw, 'utf8');
  if (size > config.CODE_EXEC_MAX_STDIN_BYTES) {
    throw new Error(
      `stdin payload exceeds ${config.CODE_EXEC_MAX_STDIN_BYTES} bytes`,
    );
  }
  return raw;
}

function normalizeCode(code: string): string {
  const raw = String(code ?? '');
  const size = Buffer.byteLength(raw, 'utf8');
  if (size > config.CODE_EXEC_MAX_CODE_BYTES) {
    throw new Error(`code payload exceeds ${config.CODE_EXEC_MAX_CODE_BYTES} bytes`);
  }
  return raw;
}

function truncateOutput(
  stdout: string,
  stderr: string,
  maxBytes: number,
): { stdout: string; stderr: string; truncated: boolean } {
  const combinedBytes = Buffer.byteLength(stdout, 'utf8') + Buffer.byteLength(stderr, 'utf8');
  if (combinedBytes <= maxBytes) {
    return { stdout, stderr, truncated: false };
  }

  const marker = '\n[output truncated]';
  const markerBytes = Buffer.byteLength(marker, 'utf8');
  const allowed = Math.max(0, maxBytes - markerBytes);
  const stdoutBytes = Buffer.byteLength(stdout, 'utf8');

  if (stdoutBytes >= allowed) {
    const truncatedStdout = Buffer.from(stdout, 'utf8').subarray(0, allowed).toString('utf8');
    return { stdout: `${truncatedStdout}${marker}`, stderr: '', truncated: true };
  }

  const remaining = allowed - stdoutBytes;
  const truncatedStderr = Buffer.from(stderr, 'utf8').subarray(0, remaining).toString('utf8');
  return { stdout, stderr: `${truncatedStderr}${marker}`, truncated: true };
}

function inferErrorClass(input: {
  exitCode: number;
  timedOut: boolean;
  stderr: string;
}): ExecuteCodeResult['error_class'] {
  if (input.timedOut) return 'timeout';
  if (input.exitCode === 0) return undefined;

  const stderr = input.stderr.toLowerCase();
  if (stderr.includes('error:') || stderr.includes('exception') || stderr.includes('traceback')) {
    if (stderr.includes('syntax') || stderr.includes('compile') || stderr.includes('cannot find symbol')) {
      return 'compile';
    }
    return 'runtime';
  }
  return 'runtime';
}

async function runWithLocalProvider(input: {
  language: SupportedLanguage;
  code: string;
  stdin: string;
  limits: ExecutionLimits;
}): Promise<ExecuteCodeResult> {
  const runnerLanguage = toLocalRunnerLanguage(input.language);
  const run = await runnerService.runAdhoc(
    runnerLanguage,
    input.code,
    input.stdin,
    input.limits.timeoutMs,
  );

  const truncated = truncateOutput(
    run.stdout,
    run.stderr,
    input.limits.maxOutputBytes,
  );

  return {
    stdout: truncated.stdout,
    stderr: truncated.stderr,
    exit_code: run.exitCode,
    timed_out: run.timedOut,
    runtime_ms: run.runtimeMs,
    memory_kb: run.memoryMb > 0 ? run.memoryMb * 1024 : 0,
    truncated: truncated.truncated,
    provider: 'local',
    error_class: inferErrorClass({
      exitCode: run.exitCode,
      timedOut: run.timedOut,
      stderr: run.stderr,
    }),
  };
}

function stringifyOneCompilerException(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

function pickString(
  source: Record<string, unknown>,
  keys: string[],
): string {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'string') return value;
  }
  return '';
}

function pickNumber(
  source: Record<string, unknown>,
  keys: string[],
): number | null {
  for (const key of keys) {
    const value = source[key];
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function pickBoolean(
  source: Record<string, unknown>,
  keys: string[],
): boolean | null {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'boolean') return value;
  }
  return null;
}

async function runWithOneCompilerProvider(input: {
  language: SupportedLanguage;
  code: string;
  stdin: string;
  limits: ExecutionLimits;
}): Promise<ExecuteCodeResult> {
  const language = ONECOMPILER_LANGUAGES[input.language];
  if (!language) {
    throw new Error(`No OneCompiler language configured for ${input.language}`);
  }

  const hasAccessToken =
    typeof config.ONECOMPILER_ACCESS_TOKEN === 'string' &&
    config.ONECOMPILER_ACCESS_TOKEN.trim().length > 0;
  const hasApiKey =
    typeof config.ONECOMPILER_API_KEY === 'string' &&
    config.ONECOMPILER_API_KEY.trim().length > 0;
  if (!hasAccessToken && !hasApiKey) {
    throw new Error('OneCompiler credentials are not configured.');
  }

  const baseUrl = config.ONECOMPILER_BASE_URL.replace(/\/+$/, '');
  const url = `${baseUrl}/run`;
  const payload = {
    language,
    files: [
      {
        name: LANGUAGE_FILE_NAMES[input.language],
        content: input.code,
      },
    ],
    stdin: input.stdin,
  };

  const start = Date.now();
  const response = await axios.post(url, payload, {
    timeout: Math.max(config.ONECOMPILER_REQUEST_TIMEOUT_MS, input.limits.timeoutMs + 5000),
    params:
      hasAccessToken && config.ONECOMPILER_ACCESS_TOKEN
        ? { access_token: config.ONECOMPILER_ACCESS_TOKEN }
        : undefined,
    headers:
      hasApiKey && config.ONECOMPILER_API_KEY
        ? { 'X-API-Key': config.ONECOMPILER_API_KEY }
        : undefined,
  });

  const raw = response.data;
  const run: Record<string, unknown> =
    raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};

  const status = pickString(run, ['status', 'resultStatus', 'executionStatus'])
    .toLowerCase()
    .trim();
  const stdout = pickString(run, ['stdout', 'output', 'result', 'runOutput']);
  const stderr = pickString(run, [
    'stderr',
    'error',
    'errors',
    'compile_output',
    'compileOutput',
  ]);
  const exceptionText = stringifyOneCompilerException(run.exception);
  const combinedStderr = [stderr, exceptionText].filter(Boolean).join('\n').trim();
  const successFlag = pickBoolean(run, ['success', 'ok']);
  const explicitExitCode = pickNumber(run, ['exitCode', 'exit_code', 'code', 'statusCode']);
  const timedOutFromStatus =
    status === 'timeout' ||
    /tim(e|ed)\s*out|time limit/i.test(`${status}\n${combinedStderr}`);

  const hasMeaningfulPayload =
    status.length > 0 ||
    stdout.length > 0 ||
    combinedStderr.length > 0 ||
    explicitExitCode !== null ||
    successFlag !== null;
  if (!hasMeaningfulPayload) {
    throw new Error('Execution provider returned an empty response payload.');
  }

  let code = 0;
  if (explicitExitCode !== null) {
    code = explicitExitCode;
  } else if (successFlag === false) {
    code = 1;
  } else if (timedOutFromStatus) {
    code = 1;
  } else if (combinedStderr.length > 0) {
    code = 1;
  } else if (
    status &&
    !['success', 'ok', 'completed', 'done', 'passed'].includes(status)
  ) {
    code = 1;
  }

  const timedOut = timedOutFromStatus;
  const runtimeMs = Number(
    pickNumber(run, ['executionTime', 'execution_time', 'runtimeMs', 'runtime_ms']) ??
      (Date.now() - start),
  );

  const truncated = truncateOutput(stdout, combinedStderr, input.limits.maxOutputBytes);

  return {
    stdout: truncated.stdout,
    stderr: truncated.stderr,
    exit_code: code,
    timed_out: timedOut,
    runtime_ms: runtimeMs,
    memory_kb: Number(pickNumber(run, ['memoryKb', 'memory_kb', 'memory']) ?? 0),
    truncated: truncated.truncated,
    provider: 'onecompiler',
    error_class: inferErrorClass({
      exitCode: code,
      timedOut,
      stderr: combinedStderr,
    }),
  };
}

export class ExecutionService {
  private mergeLimits(limits?: Partial<ExecutionLimits>): ExecutionLimits {
    return {
      timeoutMs: Math.max(1000, Number(limits?.timeoutMs ?? DEFAULT_LIMITS.timeoutMs)),
      memoryMb: Math.max(32, Number(limits?.memoryMb ?? DEFAULT_LIMITS.memoryMb)),
      maxOutputBytes: Math.max(
        2048,
        Number(limits?.maxOutputBytes ?? DEFAULT_LIMITS.maxOutputBytes),
      ),
    };
  }

  private shouldRetryProviderError(error: unknown): boolean {
    if (!axios.isAxiosError(error)) return false;
    const status = error.response?.status;
    if (status && status < 500) return false;
    return true;
  }

  private toProviderError(error: unknown): Error {
    if (!axios.isAxiosError(error)) {
      return error instanceof Error ? error : new Error('Execution provider unavailable');
    }

    if (error.code === 'ECONNABORTED' || !error.response) {
      return new Error('Execution provider temporarily unavailable. Please retry.');
    }

    const status = error.response.status;
    if (status >= 500) {
      return new Error('Execution provider temporarily unavailable. Please retry.');
    }

    if (status >= 400) {
      return new Error(`Execution rejected by provider (status ${status}).`);
    }

    return new Error('Execution provider unavailable');
  }

  async runCode(input: ExecuteCodeInput): Promise<ExecuteCodeResult> {
    const language = normalizeLanguage(input.language);
    const code = normalizeCode(input.code);
    const stdin = normalizeStdin(input.stdin);
    const limits = this.mergeLimits(input.limits);

    if (isLocalLanguage(language)) {
      return runWithLocalProvider({ language, code, stdin, limits });
    }

    if (!isRemoteExecutionLanguage(language)) {
      throw new Error(`Unsupported execution language: ${language}`);
    }

    try {
      return await runWithOneCompilerProvider({ language, code, stdin, limits });
    } catch (error) {
      if (!this.shouldRetryProviderError(error)) {
        throw this.toProviderError(error);
      }
      try {
        return await runWithOneCompilerProvider({ language, code, stdin, limits });
      } catch (retryError) {
        throw this.toProviderError(retryError);
      }
    }
  }
}

export const executionService = new ExecutionService();
