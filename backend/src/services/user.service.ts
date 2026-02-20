import { query } from '../db';

export interface UpdateUserData {
  name?: string;
  email?: string;
  avatar_url?: string | null;
  headline?: string | null;
  bio?: string | null;
  location?: string | null;
  github_url?: string | null;
  linkedin_url?: string | null;
  portfolio_url?: string | null;
}

export class UserService {
  private mapUserRow(user: any) {
    return {
      user_id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatar_url: user.avatar_url ?? null,
      headline: user.headline ?? null,
      bio: user.bio ?? null,
      location: user.location ?? null,
      github_url: user.github_url ?? null,
      linkedin_url: user.linkedin_url ?? null,
      portfolio_url: user.portfolio_url ?? null,
      created_at: user.created_at,
      updated_at: user.updated_at
    };
  }

  async getUserById(userId: string) {
    const result = await query(
      `SELECT id, name, email, role,
              avatar_url, headline, bio, location, github_url, linkedin_url, portfolio_url,
              created_at, updated_at 
       FROM users 
       WHERE id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      throw new Error('User not found');
    }

    return this.mapUserRow(result.rows[0]);
  }

  async updateUser(userId: string, data: UpdateUserData) {
    if (data.email) {
      const existing = await query(
        'SELECT id FROM users WHERE email = $1 AND id != $2',
        [data.email, userId]
      );

      if (existing.rows.length > 0) {
        throw new Error('Email already in use');
      }
    }

    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (data.name !== undefined) {
      updates.push(`name = $${paramCount}`);
      values.push(data.name);
      paramCount++;
    }

    if (data.email !== undefined) {
      updates.push(`email = $${paramCount}`);
      values.push(data.email);
      paramCount++;
    }

    const optionalFields: Array<keyof Pick<
      UpdateUserData,
      'avatar_url' | 'headline' | 'bio' | 'location' | 'github_url' | 'linkedin_url' | 'portfolio_url'
    >> = ['avatar_url', 'headline', 'bio', 'location', 'github_url', 'linkedin_url', 'portfolio_url'];

    for (const field of optionalFields) {
      if (data[field] !== undefined) {
        updates.push(`${field} = $${paramCount}`);
        values.push(data[field]);
        paramCount++;
      }
    }

    if (updates.length === 0) {
      throw new Error('No fields to update');
    }

    updates.push(`updated_at = NOW()`);
    values.push(userId);

    const queryText = `
      UPDATE users 
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING id, name, email, role,
                avatar_url, headline, bio, location, github_url, linkedin_url, portfolio_url,
                created_at, updated_at
    `;

    const result = await query(queryText, values);
    return this.mapUserRow(result.rows[0]);
  }

  async listUsers() {
    const result = await query(
      `SELECT id, name, email, role, created_at, updated_at
       FROM users
       ORDER BY created_at DESC`,
    );

    return result.rows.map((user) => ({
      user_id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      created_at: user.created_at,
      updated_at: user.updated_at,
    }));
  }

  async updateUserRole(
    adminUserId: string,
    targetUserId: string,
    role: 'developer' | 'recruiter' | 'admin',
  ) {
    if (!['developer', 'recruiter', 'admin'].includes(role)) {
      throw new Error('Invalid role');
    }
    if (adminUserId === targetUserId) {
      throw new Error('You cannot change your own role');
    }

    const result = await query(
      `UPDATE users
       SET role = $2, updated_at = NOW()
       WHERE id = $1
       RETURNING id, name, email, role, created_at, updated_at`,
      [targetUserId, role],
    );
    if (result.rows.length === 0) {
      throw new Error('User not found');
    }

    await query(
      `INSERT INTO admin_audit_logs (admin_user_id, target_user_id, action, details)
       VALUES ($1, $2, $3, $4::jsonb)`,
      [
        adminUserId,
        targetUserId,
        'user.role.update',
        JSON.stringify({ role }),
      ],
    );

    const user = result.rows[0];
    return {
      user_id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      created_at: user.created_at,
      updated_at: user.updated_at,
    };
  }
}
