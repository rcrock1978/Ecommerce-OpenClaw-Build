import pool from '../config/database';
import { User, CreateUserInput, UpdateUserInput, SafeUser } from '../types';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';

const SALT_ROUNDS = 12;

/** Strip password_hash from a row */
function toSafeUser(row: User): SafeUser {
  const { password_hash: _, ...safe } = row;
  return safe;
}

/**
 * Create a new user. Returns the safe (no hash) user record.
 */
export async function createUser(input: CreateUserInput): Promise<SafeUser> {
  const id = uuidv4();
  const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);

  const { rows } = await pool.query<User>(
    `INSERT INTO users (id, email, password_hash, first_name, last_name, role)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [id, input.email.toLowerCase(), passwordHash, input.first_name, input.last_name, input.role ?? 'customer'],
  );

  return toSafeUser(rows[0]);
}

/**
 * Find a user by email (includes password_hash for auth).
 */
export async function findByEmail(email: string): Promise<User | null> {
  const { rows } = await pool.query<User>(
    'SELECT * FROM users WHERE email = $1 AND is_active = true',
    [email.toLowerCase()],
  );
  return rows[0] ?? null;
}

/**
 * Find a user by ID. Returns safe user (no hash).
 */
export async function findById(id: string): Promise<SafeUser | null> {
  const { rows } = await pool.query<User>(
    'SELECT * FROM users WHERE id = $1 AND is_active = true',
    [id],
  );
  return rows[0] ? toSafeUser(rows[0]) : null;
}

/**
 * Find a user by ID (includes hash — for internal auth use only).
 */
export async function findByIdWithHash(id: string): Promise<User | null> {
  const { rows } = await pool.query<User>(
    'SELECT * FROM users WHERE id = $1 AND is_active = true',
    [id],
  );
  return rows[0] ?? null;
}

/**
 * Update a user's profile fields. Returns the updated safe user.
 */
export async function updateUser(id: string, input: UpdateUserInput): Promise<SafeUser | null> {
  const fields: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (input.first_name !== undefined) {
    fields.push(`first_name = $${idx++}`);
    values.push(input.first_name);
  }
  if (input.last_name !== undefined) {
    fields.push(`last_name = $${idx++}`);
    values.push(input.last_name);
  }
  if (input.email !== undefined) {
    fields.push(`email = $${idx++}`);
    values.push(input.email.toLowerCase());
  }

  if (fields.length === 0) return findById(id);

  fields.push(`updated_at = NOW()`);
  values.push(id);

  const { rows } = await pool.query<User>(
    `UPDATE users SET ${fields.join(', ')} WHERE id = $${idx} AND is_active = true RETURNING *`,
    values,
  );

  return rows[0] ? toSafeUser(rows[0]) : null;
}

/**
 * List users with pagination (admin only).
 */
export async function listUsers(page: number, limit: number): Promise<{ users: SafeUser[]; total: number }> {
  const offset = (page - 1) * limit;

  const [dataResult, countResult] = await Promise.all([
    pool.query<User>('SELECT * FROM users WHERE is_active = true ORDER BY created_at DESC LIMIT $1 OFFSET $2', [limit, offset]),
    pool.query<{ count: string }>('SELECT COUNT(*) as count FROM users WHERE is_active = true'),
  ]);

  return {
    users: dataResult.rows.map(toSafeUser),
    total: Number(countResult.rows[0].count),
  };
}

/**
 * Verify a plaintext password against a hash.
 */
export async function verifyPassword(plaintext: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plaintext, hash);
}
