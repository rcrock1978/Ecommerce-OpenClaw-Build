import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import Joi from 'joi';
import { validateBody } from '../middleware/validate';
import { createUser, findByEmail, findByIdWithHash, verifyPassword } from '../models/user';
import { AuthPayload, RefreshPayload, UserRole } from '../types';
import logger from '../utils/logger';

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET ?? 'change-me-in-production';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET ?? 'change-me-refresh';
const ACCESS_TOKEN_TTL = process.env.ACCESS_TOKEN_TTL ?? '15m';
const REFRESH_TOKEN_TTL = process.env.REFRESH_TOKEN_TTL ?? '7d';

// ── Validation Schemas ──────────────────────────────────────────────

const registerSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).max(128).required(),
  first_name: Joi.string().trim().min(1).max(100).required(),
  last_name: Joi.string().trim().min(1).max(100).required(),
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

const refreshSchema = Joi.object({
  refresh_token: Joi.string().required(),
});

// ── Helpers ─────────────────────────────────────────────────────────

function generateTokens(payload: AuthPayload) {
  const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_TOKEN_TTL });
  const refreshToken = jwt.sign(
    { userId: payload.userId, tokenVersion: 0 } satisfies RefreshPayload,
    JWT_REFRESH_SECRET,
    { expiresIn: REFRESH_TOKEN_TTL },
  );
  return { accessToken, refreshToken };
}

// ── POST /register ──────────────────────────────────────────────────

router.post('/register', validateBody(registerSchema), async (req: Request, res: Response) => {
  try {
    const { email, password, first_name, last_name } = req.body;

    // Check for existing user
    const existing = await findByEmail(email);
    if (existing) {
      res.status(409).json({ success: false, message: 'Email already registered' });
      return;
    }

    const user = await createUser({ email, password, first_name, last_name });
    const tokens = generateTokens({ userId: user.id, email: user.email, role: user.role });

    logger.info('User registered', { userId: user.id, email: user.email });

    res.status(201).json({
      success: true,
      data: { user, ...tokens },
    });
  } catch (err) {
    logger.error('Registration failed', { error: (err as Error).message });
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// ── POST /login ─────────────────────────────────────────────────────

router.post('/login', validateBody(loginSchema), async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    const user = await findByEmail(email);
    if (!user) {
      res.status(401).json({ success: false, message: 'Invalid credentials' });
      return;
    }

    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) {
      res.status(401).json({ success: false, message: 'Invalid credentials' });
      return;
    }

    const tokens = generateTokens({ userId: user.id, email: user.email, role: user.role as UserRole });

    logger.info('User logged in', { userId: user.id });

    const { password_hash: _, ...safeUser } = user;
    res.json({ success: true, data: { user: safeUser, ...tokens } });
  } catch (err) {
    logger.error('Login failed', { error: (err as Error).message });
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// ── POST /refresh-token ─────────────────────────────────────────────

router.post('/refresh-token', validateBody(refreshSchema), async (req: Request, res: Response) => {
  try {
    const { refresh_token } = req.body;

    const decoded = jwt.verify(refresh_token, JWT_REFRESH_SECRET) as RefreshPayload;
    const user = await findByIdWithHash(decoded.userId);

    if (!user) {
      res.status(401).json({ success: false, message: 'User not found' });
      return;
    }

    const tokens = generateTokens({ userId: user.id, email: user.email, role: user.role as UserRole });

    res.json({ success: true, data: tokens });
  } catch (err) {
    logger.warn('Token refresh failed', { error: (err as Error).message });
    res.status(401).json({ success: false, message: 'Invalid refresh token' });
  }
});

// ── POST /logout ────────────────────────────────────────────────────

router.post('/logout', (_req: Request, res: Response) => {
  // Stateless JWT: client discards tokens.
  // For full revocation, add token to a Redis blocklist here.
  res.json({ success: true, message: 'Logged out successfully' });
});

export default router;
