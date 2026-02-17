import { query } from '../db';

export interface UpdateUserData {
  name?: string;
  email?: string;
}

export class UserService {
  async getUserById(userId: string) {
    const result = await query(
      `SELECT id, name, email, role, created_at, updated_at 
       FROM users 
       WHERE id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      throw new Error('User not found');
    }

    const user = result.rows[0];
    
    return {
      user_id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      created_at: user.created_at,
      updated_at: user.updated_at
    };
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

    if (data.name) {
      updates.push(`name = $${paramCount}`);
      values.push(data.name);
      paramCount++;
    }

    if (data.email) {
      updates.push(`email = $${paramCount}`);
      values.push(data.email);
      paramCount++;
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
      RETURNING id, name, email, role, created_at, updated_at
    `;

    const result = await query(queryText, values);

    const user = result.rows[0];
    
    return {
      user_id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      created_at: user.created_at,
      updated_at: user.updated_at
    };
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
