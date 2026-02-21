import { Queue, Worker, JobsOptions } from 'bullmq';
import { config, enableJudge } from '../config';
import type { SupportedLanguage } from '../constants/languages';

const connection = { url: config.REDIS_URL || 'redis://127.0.0.1:6379' };

type JudgeQueueLike = {
  add: Queue['add'];
  getJobCounts: Queue['getJobCounts'];
};

class DisabledJudgeQueue implements JudgeQueueLike {
  async add(..._args: Parameters<Queue['add']>): Promise<never> {
    throw new Error('Judge queue is disabled');
  }

  async getJobCounts(
    ...statuses: Parameters<Queue['getJobCounts']>
  ): Promise<Awaited<ReturnType<Queue['getJobCounts']>>> {
    const counts = statuses.reduce<Record<string, number>>((acc, status) => {
      acc[status] = 0;
      return acc;
    }, {});
    return counts as Awaited<ReturnType<Queue['getJobCounts']>>;
  }
}

class LazyJudgeQueue implements JudgeQueueLike {
  private queue: Queue | null = null;

  private getQueue(): Queue {
    if (!this.queue) {
      this.queue = new Queue('judge', { connection });
    }
    return this.queue;
  }

  async add(...args: Parameters<Queue['add']>) {
    return this.getQueue().add(...args);
  }

  async getJobCounts(...statuses: Parameters<Queue['getJobCounts']>) {
    return this.getQueue().getJobCounts(...statuses);
  }
}

export const judgeQueue: JudgeQueueLike = enableJudge
  ? new LazyJudgeQueue()
  : new DisabledJudgeQueue();

export type JudgeJobData = {
  submissionId: string;
  challengeId: string;
  userId: string;
  code: string;
  language: SupportedLanguage;
  sessionId?: string | null;
};

export const defaultJobOptions: JobsOptions = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 3000 },
  removeOnComplete: true,
  removeOnFail: 50,
};

// Worker stub is defined in worker.ts; exported here for reference
export function createJudgeWorker(processor: any) {
  if (!enableJudge) return null;
  return new Worker('judge', processor, { connection });
}
