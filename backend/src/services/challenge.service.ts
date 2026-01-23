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