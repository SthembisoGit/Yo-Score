import { query } from '../db';

type ChallengePublishRecord = {
  id: string;
  publish_status: string;
};

export class ChallengeRepository {
  async findChallengePublishState(challengeId: string): Promise<ChallengePublishRecord | null> {
    const result = await query(
      `SELECT id, publish_status
       FROM challenges
       WHERE id = $1`,
      [challengeId],
    );
    if (result.rows.length === 0) return null;
    return result.rows[0] as ChallengePublishRecord;
  }
}

export const challengeRepository = new ChallengeRepository();
