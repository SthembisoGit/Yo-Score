import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import os from 'os';

const pexec = promisify(exec);

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

function languageConfig(language: RunnerLanguage) {
  if (language === 'python') {
    return { image: 'python:3.11-alpine', filename: 'solution.py', runCmd: 'python solution.py' };
  }
  return { image: 'node:18-alpine', filename: 'solution.js', runCmd: 'node solution.js' };
}

export class RunnerService {
  async runCode(
    language: RunnerLanguage,
    code: string,
    tests: RunnerTestCase[],
  ): Promise<RunnerResult> {
    const cfg = languageConfig(language);
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'judge-'));
    const codePath = path.join(tmpDir, cfg.filename);
    fs.writeFileSync(codePath, code, 'utf-8');

    const results: RunnerResult = {
      testResults: [],
      stdout: '',
      stderr: '',
      runtime_ms: 0,
      memory_mb: 0,
    };

    for (const test of tests) {
      const inputFile = path.join(tmpDir, 'input.txt');
      fs.writeFileSync(inputFile, test.input, 'utf-8');
      const start = Date.now();
      try {
        const { stdout, stderr } = await pexec(
          `docker run --rm --network none -m ${test.memory_mb}m -v "${tmpDir}:/app" -w /app --cpus=0.5 --pull=never ${cfg.image} sh -c "${cfg.runCmd} < input.txt"`,
          { timeout: test.timeout_ms },
        );
        const elapsed = Date.now() - start;
        const output = stdout.trim();
        const passed = output === test.expected_output.trim();
        results.testResults.push({
          id: test.id,
          status: passed ? 'passed' : 'failed',
          output,
          error: stderr?.trim() || undefined,
          runtime_ms: elapsed,
          points_awarded: passed ? test.points : 0,
        });
        results.stdout += stdout;
        results.stderr += stderr;
        results.runtime_ms += elapsed;
      } catch (err: any) {
        const elapsed = Date.now() - start;
        results.testResults.push({
          id: test.id,
          status: 'error',
          output: '',
          error: err?.message || 'execution error',
          runtime_ms: elapsed,
          points_awarded: 0,
        });
        results.stderr += err?.stderr || '';
        results.runtime_ms += elapsed;
      }
    }

    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }

    return results;
  }
}

export const runnerService = new RunnerService();
