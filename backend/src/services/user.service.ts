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
}