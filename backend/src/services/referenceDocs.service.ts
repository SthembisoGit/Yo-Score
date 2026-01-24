import { query } from '../db';

export interface ReferenceDoc {
  doc_id: string;
  title: string;
  content: string;
}

export class ReferenceDocsService {
  async getDocsForChallenge(challengeId: string) {
    const result = await query(
      `SELECT id, title, content, created_at, updated_at
       FROM reference_docs
       WHERE challenge_id = $1
       ORDER BY created_at`,
      [challengeId]
    );

    return result.rows.map(doc => ({
      doc_id: doc.id,
      title: doc.title,
      content: doc.content,
      created_at: doc.created_at,
      updated_at: doc.updated_at
    }));
  }

  async createDoc(challengeId: string, title: string, content: string) {
    const result = await query(
      `INSERT INTO reference_docs (challenge_id, title, content)
       VALUES ($1, $2, $3)
       RETURNING id, title, content, created_at, updated_at`,
      [challengeId, title, content]
    );

    const doc = result.rows[0];
    
    return {
      doc_id: doc.id,
      title: doc.title,
      content: doc.content,
      created_at: doc.created_at,
      updated_at: doc.updated_at
    };
  }
}