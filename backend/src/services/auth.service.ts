import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { query } from '../../db';

export interface UserPayload {
    id: string;
    name: string;
    email: string;
    role: string;
}

export class AuthService {
    async signup(name: string, email: string, password: string, role: string = 'developer') {
        // Check if user already exists
        const existingUser = await query(
            'SELECT id FROM users WHERE email = $1',
            [email]
        );

        if (existingUser.rows.length > 0) {
            throw new Error('User already exists');
        }

        // Hash password
        const saltRounds = config.BCRYPT_SALT_ROUNDS;
        const passwordHash = await bcrypt.hash(password, saltRounds);

        // Create user
        const result = await query(
            `INSERT INTO users (name, email, password, role) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id, name, email, role, created_at`,
            [name, email, passwordHash, role]
        );

        const user = result.rows[0];

        // Generate JWT token
        const token = this.generateToken({
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role
        });

        return {
            token,
            user: {
                user_id: user.id,
                name: user.name,
                email: user.email,
                role: user.role
            }
        };
    }

    async login(email: string, password: string) {
        // Find user
        const result = await query(
            'SELECT id, name, email, password, role FROM users WHERE email = $1',
            [email]
        );

        if (result.rows.length === 0) {
            throw new Error('Invalid credentials');
        }

        const user = result.rows[0];

        // Verify password
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            throw new Error('Invalid credentials');
        }

        // Generate JWT token
        const token = this.generateToken({
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role
        });

        return {
            token,
            user: {
                user_id: user.id,
                name: user.name,
                email: user.email,
                role: user.role
            }
        };
    }

    async logout(token: string) {
        // In a production system, you would:
        // 1. Add token to blacklist
        // 2. Store in Redis with expiry
        // For MVP, we rely on JWT expiry
        return { message: 'Logged out successfully' };
    }

    private generateToken(payload: UserPayload): string {
        return jwt.sign(
            payload,
            config.JWT_SECRET,
            { expiresIn: 86400 }
        );
    }

    verifyToken(token: string): UserPayload {
        return jwt.verify(token, config.JWT_SECRET) as UserPayload;
    }
}