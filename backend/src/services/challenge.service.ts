import { query } from '../db';

export interface Challenge {
  challenge_id: string;
  title: string;
  description: string;
  category: string;
  difficulty: string;
  created_at: Date;
  updated_at: Date;
}

export class ChallengeService {
  async getAllChallenges() {
    const result = await query(
      `SELECT id, title, description, category, difficulty, created_at, updated_at
       FROM challenges
       ORDER BY created_at DESC`
    );

    return result.rows.map(challenge => ({
      challenge_id: challenge.id,
      title: challenge.title,
      description: challenge.description,
      category: challenge.category,
      difficulty: challenge.difficulty,
      created_at: challenge.created_at,
      updated_at: challenge.updated_at
    }));
  }

  async getChallengeById(challengeId: string) {
    const result = await query(
      `SELECT id, title, description, category, difficulty, created_at, updated_at
       FROM challenges
       WHERE id = $1`,
      [challengeId]
    );

    if (result.rows.length === 0) {
      throw new Error('Challenge not found');
    }

    const challenge = result.rows[0];
    return this.mapRowToChallenge(challenge);
  }

  async getNextChallengeForUser(userId: string) {
    const result = await query(
      `SELECT c.id, c.title, c.description, c.category, c.difficulty, c.created_at, c.updated_at
       FROM challenges c
       LEFT JOIN submissions s ON s.challenge_id = c.id AND s.user_id = $1 AND s.status = 'graded'
       WHERE s.id IS NULL
       ORDER BY c.created_at ASC
       LIMIT 1`,
      [userId]
    );

    if (result.rows.length === 0) {
      throw new Error('No challenges available');
    }
    return this.mapRowToChallenge(result.rows[0]);
  }

  private mapRowToChallenge(row: Record<string, unknown>) {
    return {
      challenge_id: row.id,
      title: row.title,
      description: row.description,
      category: row.category,
      difficulty: row.difficulty,
      created_at: row.created_at,
      updated_at: row.updated_at
    };
  }

  async createChallenge(data: {
    title: string;
    description: string;
    category: string;
    difficulty: string;
  }) {
    const result = await query(
      `INSERT INTO challenges (title, description, category, difficulty)
       VALUES ($1, $2, $3, $4)
       RETURNING id, title, description, category, difficulty, created_at, updated_at`,
      [data.title, data.description, data.category, data.difficulty]
    );

    const challenge = result.rows[0];
    
    return {
      challenge_id: challenge.id,
      title: challenge.title,
      description: challenge.description,
      category: challenge.category,
      difficulty: challenge.difficulty,
      created_at: challenge.created_at,
      updated_at: challenge.updated_at
    };
  }
}