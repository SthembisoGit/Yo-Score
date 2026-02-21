import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

export type RunnerLanguage = 'python' | 'node';

export interface RunnerTestCase {
  id: string;
  input: string;
  expected_output: string;
  timeout_ms: number;
  memory_mb: number;
  points: number;
}

export interface RunnerResult {
  testResults: Array<{
    id: string;
    status: 'passed' | 'failed' | 'error';
    output: string;
    error?: string;
    runtime_ms: number;
    points_awarded: number;
  }>;
  stdout: string;
  stderr: string;
  runtime_ms: number;
  memory_mb: number;
}

export interface RunnerAdhocResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  timedOut: boolean;
  runtimeMs: number;
  memoryMb: number;
}

function languageConfig(language: RunnerLanguage) {
  if (language === 'python') {
    return { image: 'python:3.11-alpine', filename: 'solution.py', runCmd: 'python solution.py' };
  }
  return { image: 'node:18-alpine', filename: 'solution.js', runCmd: 'node solution.js' };
}

type ExecutionBackend = 'local' | 'docker';
type PythonRuntimeCommand = 'python3' | 'python' | null;

interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  timedOut: boolean;
  durationMs: number;
}

function normalizeDockerVolumePath(tmpDir: string): string {
  if (process.platform !== 'win32') return tmpDir;

  const normalized = tmpDir.replace(/\\/g, '/');
  if (/^[a-zA-Z]:/.test(normalized)) {
    const drive = normalized.charAt(0).toLowerCase();
    const rest = normalized.slice(2);
    return `/${drive}${rest}`;
  }
  return normalized;
}

function isDockerUnavailableMessage(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes('docker') &&
    (normalized.includes('not found') ||
      normalized.includes('cannot connect to the docker daemon') ||
      normalized.includes('is not running') ||
      normalized.includes('is not recognized as an internal or external command'))
  );
}

function runCommand(
  command: string,
  args: string[],
  opts: { cwd: string; stdin?: string; timeoutMs: number },
): Promise<CommandResult> {
  return new Promise((resolve) => {
    const startTime = Date.now();
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let settled = false;

    const finalize = (exitCode: number) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({
        stdout,
        stderr,
        exitCode,
        timedOut,
        durationMs: Date.now() - startTime,
      });
    };

    const child = spawn(command, args, {
      cwd: opts.cwd,
      stdio: 'pipe',
      shell: false,
      windowsHide: true,
    });

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
      setTimeout(() => finalize(-1), 100);
    }, opts.timeoutMs);

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', (error) => {
      stderr += `${error.message}`;
      finalize(-1);
    });

    child.on('close', (code) => {
      finalize(typeof code === 'number' ? code : -1);
    });

    try {
      if (opts.stdin) {
        child.stdin.write(opts.stdin);
      }
      child.stdin.end();
    } catch {
      // Ignore stdin write errors for short-lived child processes.
    }
  });
}

export class RunnerService {
  private dockerAvailable: boolean | null = null;
  private pythonRuntime: PythonRuntimeCommand | undefined;

  private getRunnerMode(): 'local' | 'docker' | 'auto' {
    const value = String(process.env.JUDGE_RUNNER_MODE ?? 'local').toLowerCase();
    if (value === 'docker' || value === 'auto') return value;
    return 'local';
  }

  private async detectDockerAvailability(): Promise<boolean> {
    if (this.dockerAvailable !== null) return this.dockerAvailable;

    const result = await runCommand('docker', ['version', '--format', '{{.Server.Version}}'], {
      cwd: process.cwd(),
      timeoutMs: 3000,
    });
    this.dockerAvailable = result.exitCode === 0 && result.stdout.trim().length > 0;
    return this.dockerAvailable;
  }

  private async resolvePythonRuntime(): Promise<PythonRuntimeCommand> {
    if (this.pythonRuntime !== undefined) return this.pythonRuntime;

    const python3 = await runCommand('python3', ['--version'], {
      cwd: process.cwd(),
      timeoutMs: 3000,
    });
    if (python3.exitCode === 0) {
      this.pythonRuntime = 'python3';
      return this.pythonRuntime;
    }

    const python = await runCommand('python', ['--version'], {
      cwd: process.cwd(),
      timeoutMs: 3000,
    });
    if (python.exitCode === 0) {
      this.pythonRuntime = 'python';
      return this.pythonRuntime;
    }

    this.pythonRuntime = null;
    return this.pythonRuntime;
  }

  private async resolveExecutionBackend(): Promise<ExecutionBackend> {
    const mode = this.getRunnerMode();
    if (mode === 'local') return 'local';

    const dockerAvailable = await this.detectDockerAvailability();
    if (dockerAvailable) return 'docker';

    return 'local';
  }

  private async runLocalTest(
    language: RunnerLanguage,
    filename: string,
    test: RunnerTestCase,
    tmpDir: string,
  ): Promise<{
    status: 'passed' | 'failed' | 'error';
    output: string;
    error?: string;
    runtimeMs: number;
    pointsAwarded: number;
  }> {
    let command = 'node';
    const args = [filename];

    if (language === 'python') {
      const runtime = await this.resolvePythonRuntime();
      if (!runtime) {
        return {
          status: 'error',
          output: '',
          error: 'Python runtime is unavailable on this worker',
          runtimeMs: 0,
          pointsAwarded: 0,
        };
      }
      command = runtime;
    }

    const result = await runCommand(command, args, {
      cwd: tmpDir,
      stdin: test.input,
      timeoutMs: test.timeout_ms,
    });

    if (result.timedOut) {
      return {
        status: 'error',
        output: '',
        error: `Execution timed out after ${test.timeout_ms}ms`,
        runtimeMs: result.durationMs,
        pointsAwarded: 0,
      };
    }

    const output = result.stdout.trim();
    if (result.exitCode !== 0) {
      return {
        status: 'error',
        output,
        error: (result.stderr || `Process exited with code ${result.exitCode}`).trim(),
        runtimeMs: result.durationMs,
        pointsAwarded: 0,
      };
    }

    const passed = output === test.expected_output.trim();
    return {
      status: passed ? 'passed' : 'failed',
      output,
      error: result.stderr?.trim() || undefined,
      runtimeMs: result.durationMs,
      pointsAwarded: passed ? test.points : 0,
    };
  }

  private async runDockerTest(
    cfg: ReturnType<typeof languageConfig>,
    test: RunnerTestCase,
    tmpDir: string,
  ): Promise<{
    status: 'passed' | 'failed' | 'error';
    output: string;
    error?: string;
    runtimeMs: number;
    pointsAwarded: number;
  }> {
    const volumePath = `${normalizeDockerVolumePath(tmpDir)}:/app`;
    const args = [
      'run',
      '--rm',
      '--network',
      'none',
      '-m',
      `${test.memory_mb}m`,
      '-v',
      volumePath,
      '-w',
      '/app',
      '--cpus=0.5',
      '--pull=never',
      cfg.image,
      'sh',
      '-c',
      cfg.runCmd,
    ];

    const result = await runCommand('docker', args, {
      cwd: tmpDir,
      stdin: test.input,
      timeoutMs: test.timeout_ms,
    });

    if (result.timedOut) {
      return {
        status: 'error',
        output: '',
        error: `Execution timed out after ${test.timeout_ms}ms`,
        runtimeMs: result.durationMs,
        pointsAwarded: 0,
      };
    }

    const output = result.stdout.trim();
    if (result.exitCode !== 0) {
      return {
        status: 'error',
        output,
        error: (result.stderr || `Docker exited with code ${result.exitCode}`).trim(),
        runtimeMs: result.durationMs,
        pointsAwarded: 0,
      };
    }

    const passed = output === test.expected_output.trim();
    return {
      status: passed ? 'passed' : 'failed',
      output,
      error: result.stderr?.trim() || undefined,
      runtimeMs: result.durationMs,
      pointsAwarded: passed ? test.points : 0,
    };
  }

  async runCode(
    language: RunnerLanguage,
    code: string,
    tests: RunnerTestCase[],
  ): Promise<RunnerResult> {
    const cfg = languageConfig(language);
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'judge-'));
    const codePath = path.join(tmpDir, cfg.filename);
    fs.writeFileSync(codePath, code, 'utf-8');
    let backend = await this.resolveExecutionBackend();

    const results: RunnerResult = {
      testResults: [],
      stdout: '',
      stderr: '',
      runtime_ms: 0,
      memory_mb: 0,
    };

    for (const test of tests) {
      let testResult =
        backend === 'docker'
          ? await this.runDockerTest(cfg, test, tmpDir)
          : await this.runLocalTest(language, cfg.filename, test, tmpDir);

      if (
        backend === 'docker' &&
        testResult.status === 'error' &&
        testResult.error &&
        isDockerUnavailableMessage(testResult.error)
      ) {
        backend = 'local';
        testResult = await this.runLocalTest(language, cfg.filename, test, tmpDir);
      }

      results.testResults.push({
        id: test.id,
        status: testResult.status,
        output: testResult.output,
        error: testResult.error,
        runtime_ms: testResult.runtimeMs,
        points_awarded: testResult.pointsAwarded,
      });

      results.stdout += testResult.output;
      if (testResult.error) results.stderr += `${testResult.error}\n`;
      results.runtime_ms += testResult.runtimeMs;
    }

    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }

    return results;
  }

  async runAdhoc(
    language: RunnerLanguage,
    code: string,
    stdin: string,
    timeoutMs: number,
  ): Promise<RunnerAdhocResult> {
    const cfg = languageConfig(language);
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'run-'));
    const codePath = path.join(tmpDir, cfg.filename);
    fs.writeFileSync(codePath, code, 'utf-8');

    let backend = await this.resolveExecutionBackend();
    let result: CommandResult;

    try {
      if (backend === 'docker') {
        const args = [
          'run',
          '--rm',
          '--network',
          'none',
          '-m',
          '256m',
          '-v',
          `${normalizeDockerVolumePath(tmpDir)}:/app`,
          '-w',
          '/app',
          '--cpus=0.5',
          '--pull=never',
          cfg.image,
          'sh',
          '-c',
          cfg.runCmd,
        ];

        result = await runCommand('docker', args, {
          cwd: tmpDir,
          stdin,
          timeoutMs,
        });

        if (result.exitCode !== 0 && isDockerUnavailableMessage(result.stderr || result.stdout)) {
          backend = 'local';
        }
      }

      if (backend === 'local') {
        let command = 'node';
        const args = [cfg.filename];

        if (language === 'python') {
          const runtime = await this.resolvePythonRuntime();
          if (!runtime) {
            return {
              stdout: '',
              stderr: 'Python runtime is unavailable on this worker',
              exitCode: 1,
              timedOut: false,
              runtimeMs: 0,
              memoryMb: 0,
            };
          }
          command = runtime;
        }

        result = await runCommand(command, args, {
          cwd: tmpDir,
          stdin,
          timeoutMs,
        });
      }

      return {
        stdout: result!.stdout,
        stderr: result!.stderr,
        exitCode: result!.exitCode,
        timedOut: result!.timedOut,
        runtimeMs: result!.durationMs,
        memoryMb: 0,
      };
    } finally {
      try {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      } catch {
        // ignore cleanup errors
      }
    }
  }
}

export const runnerService = new RunnerService();
