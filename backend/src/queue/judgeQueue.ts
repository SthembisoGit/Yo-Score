import { Queue, Worker, QueueEvents, JobsOptions } from 'bullmq';
import { config, enableJudge } from '../config';

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

export const judgeQueue: JudgeQueueLike = enableJudge
  ? new Queue('judge', { connection })
  : new DisabledJudgeQueue();

export const judgeEvents = enableJudge ? new QueueEvents('judge', { connection }) : null;

export type JudgeJobData = {
  submissionId: string;
  challengeId: string;
  userId: string;
  code: string;
  language: 'javascript' | 'python';
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
