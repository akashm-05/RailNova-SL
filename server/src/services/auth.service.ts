import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getDb } from '../db/connection.js';

const JWT_SECRET = process.env.JWT_SECRET || 'railnova_super_secret_jwt_key_2026';

export interface UserPayload {
  id: string;
  email: string;
  name: string;
  role: 'PASSENGER' | 'ORGANISER';
}

export class AuthService {
  static async register(data: { email: string; password: string; name: string; role?: 'PASSENGER' | 'ORGANISER' }): Promise<{ token: string; user: UserPayload }> {
    const db = await getDb();
    
    // Check existing
    const existing = await db.query('SELECT id FROM users WHERE email = $1', [data.email.toLowerCase().trim()]);
    if (existing.rows.length > 0) {
      throw { status: 409, code: 'EMAIL_EXISTS', message: 'An account with this email already exists.' };
    }

    const id = `usr-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const passwordHash = await bcrypt.hash(data.password, 10);
    const role: 'PASSENGER' | 'ORGANISER' = data.role === 'ORGANISER' ? 'ORGANISER' : 'PASSENGER';

    await db.query(`
      INSERT INTO users (id, email, password_hash, name, role)
      VALUES ($1, $2, $3, $4, $5)
    `, [id, data.email.toLowerCase().trim(), passwordHash, data.name.trim(), role]);

    const user: UserPayload = { id, email: data.email.toLowerCase().trim(), name: data.name.trim(), role };
    const token = jwt.sign(user, JWT_SECRET, { expiresIn: '7d' });

    return { token, user };
  }

  static async login(email: string, password: string): Promise<{ token: string; user: UserPayload }> {
    const db = await getDb();
    const res = await db.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase().trim()]);
    
    if (res.rows.length === 0) {
      throw { status: 401, code: 'INVALID_CREDENTIALS', message: 'Invalid email or password.' };
    }

    const userRow = res.rows[0];
    const valid = await bcrypt.compare(password, userRow.password_hash);
    if (!valid) {
      throw { status: 401, code: 'INVALID_CREDENTIALS', message: 'Invalid email or password.' };
    }

    const user: UserPayload = {
      id: userRow.id,
      email: userRow.email,
      name: userRow.name,
      role: userRow.role
    };

    const token = jwt.sign(user, JWT_SECRET, { expiresIn: '7d' });
    return { token, user };
  }

  static verifyToken(token: string): UserPayload {
    try {
      return jwt.verify(token, JWT_SECRET) as UserPayload;
    } catch {
      throw { status: 401, code: 'UNAUTHENTICATED', message: 'Session expired or invalid token.' };
    }
  }

  static async getUserById(id: string): Promise<UserPayload | null> {
    const db = await getDb();
    const res = await db.query('SELECT id, email, name, role FROM users WHERE id = $1', [id]);
    if (res.rows.length === 0) return null;
    return res.rows[0];
  }
}
