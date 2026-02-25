import { executionService } from './execution.service';
import {
  normalizeLanguage,
  type SupportedLanguage,
} from '../constants/languages';
import { logger } from '../utils/logger';
import { challengeRepository } from '../repositories/challenge.repository';

export interface RunCodeInput {
  language: string;
  code: string;
  stdin?: string;
  challenge_id?: string;
}

export class CodeRunService {
  async runCode(userId: string, input: RunCodeInput) {
    const language: SupportedLanguage = normalizeLanguage(input.language);
    const challengeId = input.challenge_id?.trim() || null;

    if (challengeId) {
      const challenge = await challengeRepository.findChallengePublishState(challengeId);
      if (!challenge) {
        throw new Error('Challenge not found');
      }
      if (challenge.publish_status !== 'published') {
        throw new Error('Challenge is not published');
      }
    }

    const result = await executionService.runCode({
      language,
      code: input.code,
      stdin: input.stdin ?? '',
    });

    const errorClass =
      result.error_class ??
      (result.exit_code === 0
        ? undefined
        : result.timed_out
          ? 'timeout'
          : 'runtime');

    // Minimal telemetry log for execution debugging without storing source code.
    logger.info('Code execution completed', {
      userId,
      language,
      provider: result.provider,
      exitCode: result.exit_code,
      runtimeMs: result.runtime_ms,
      errorClass,
    });

    return {
      language,
      stdout: result.stdout,
      stderr: result.stderr,
      exit_code: result.exit_code,
      timed_out: result.timed_out,
      runtime_ms: result.runtime_ms,
      memory_kb: result.memory_kb,
      truncated: result.truncated,
      provider: result.provider,
      error_class: errorClass,
    };
  }
}

export const codeRunService = new CodeRunService();
