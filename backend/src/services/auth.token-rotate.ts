import jwt from 'jsonwebtoken';
import { config } from '../config';
import { query } from '../db';
import { UserPayload } from './auth.service';

const JWT_EXPIRES_IN = config.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'];

export async function rotateToken(oldToken: string) {
  let payload: UserPayload;

  try {
    payload = jwt.verify(oldToken, config.JWT_SECRET) as UserPayload;
  } catch {
    throw new Error('Invalid token');
  }

  const result = await query(
    'SELECT id, name, email, role FROM users WHERE id = $1',
    [payload.id]
  );

  if (result.rows.length === 0) {
    throw new Error('User not found');
  }

  const user = result.rows[0];

  const newToken = jwt.sign(
    {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role
    },
    config.JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN },
  );

  return { token: newToken };
}
