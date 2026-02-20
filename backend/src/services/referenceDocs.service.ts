import { query } from '../db';

export interface ReferenceDoc {
  doc_id: string;
  title: string;
  content: string;
}

export class ReferenceDocsService {
  private sanitizeDocTitle(title: string): string {
    return title.trim().slice(0, 140);
  }

  private sanitizeDocContent(content: string): string {
    const trimmed = content.trim().slice(0, 50_000);
    const withoutBlockedTags = trimmed
      .replace(
        /<\s*(script|style|iframe|object|embed|link|meta|base|form|input|button|textarea|select)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi,
        '',
      )
      .replace(
        /<\s*(script|style|iframe|object|embed|link|meta|base|form|input|button|textarea|select)\b[^>]*\/?>/gi,
        '',
      );

    const withoutEventHandlers = withoutBlockedTags
      .replace(/\son[a-z]+\s*=\s*(['"]).*?\1/gi, '')
      .replace(/\son[a-z]+\s*=\s*[^\s>]+/gi, '');

    return withoutEventHandlers
      .replace(/\s(href|src)\s*=\s*(['"])\s*javascript:[^'"]*\2/gi, ' $1="#"')
      .replace(/\s(href|src)\s*=\s*(['"])\s*data:text\/html[^'"]*\2/gi, ' $1="#"');
  }

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
      title: this.sanitizeDocTitle(doc.title),
      content: this.sanitizeDocContent(doc.content),
      created_at: doc.created_at,
      updated_at: doc.updated_at
    }));
  }

  async createDoc(challengeId: string, title: string, content: string) {
    const safeTitle = this.sanitizeDocTitle(title);
    const safeContent = this.sanitizeDocContent(content);

    const result = await query(
      `INSERT INTO reference_docs (challenge_id, title, content)
       VALUES ($1, $2, $3)
       RETURNING id, title, content, created_at, updated_at`,
      [challengeId, safeTitle, safeContent]
    );

    const doc = result.rows[0];
    
    return {
      doc_id: doc.id,
      title: this.sanitizeDocTitle(doc.title),
      content: this.sanitizeDocContent(doc.content),
      created_at: doc.created_at,
      updated_at: doc.updated_at
    };
  }
}
