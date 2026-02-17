import { Router, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import Joi from 'joi';
import { createUser, findByEmail, findByIdWithHash, verifyPassword } from '../models/user';
import { validateBody } from '../middleware/validate';
import { AuthenticatedRequest, AuthPayload, RefreshPayload, UserRole } from '../types';
import logger from '../utils/logger';

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET ?? 'change-me-in-production';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET ?? 'change-me-in-production-too';
const ACCESS_TOKEN_TTL = process.env.ACCESS_TOKEN_TTL ?? '15m';
const REFRESH_TOKEN_TTL = process.env.REFRESH_TOKEN_TTL ?? '7d';

// ── Helpers ─────────────────────────────────────────────────────────

function generateTokens(payload: AuthPayload) {
  const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_TOKEN_TTL } as any);
  const refreshToken = jwt.sign(
    { userId: payload.userId, tokenVersion: 0 } satisfies RefreshPayload,
    JWT_REFRESH_SECRET,
    { expiresIn: REFRESH_TOKEN_TTL } as any,
  );
  return { accessToken, refreshToken };
}

// ── Validation Schemas ──────────────────────────────────────────────

const registerSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  first_name: Joi.string().required(),
  last_name: Joi.string().required(),
  role: Joi.string().valid('customer', 'admin').optional(),
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

const refreshTokenSchema = Joi.object({
  refresh_token: Joi.string().required(),
});

// ── POST /register ───────────────────────────────────────────────────

router.post('/register', validateBody(registerSchema), async (req, res: Response) => {
  try {
    const { email, password, first_name, last_name, role } = req.body;

    // Check if user exists
    const existing = await findByEmail(email);
    if (existing) {
      res.status(409).json({ success: false, message: 'Email already registered' });
      return;
    }

    // Create user
    const user = await createUser({
      email,
      password,
      first_name,
      last_name,
      role: role === 'admin' ? UserRole.ADMIN : UserRole.CUSTOMER,
    });

    // Generate tokens
    const payload: AuthPayload = {
      userId: user.id,
      role: user.role,
      tokenVersion: 0,
    };
    const { accessToken, refreshToken } = generateTokens(payload);

    res.status(201).json({
      success: true,
      data: {
        user,
        accessToken,
        refreshToken,
      },
    });
  } catch (err) {
    logger.error('Registration failed', { error: (err as Error).message });
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// ── POST /login ──────────────────────────────────────────────────────

router.post('/login', validateBody(loginSchema), async (req, res: Response) => {
  try {
    const { email, password } = req.body;

    // Find user
    const user = await findByEmail(email);
    if (!user) {
      res.status(401).json({ success: false, message: 'Invalid credentials' });
      return;
    }

    // Verify password
    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) {
      res.status(401).json({ success: false, message: 'Invalid credentials' });
      return;
    }

    // Generate tokens
    const payload: AuthPayload = {
      userId: user.id,
      role: user.role,
      tokenVersion: 0,
    };
    const { accessToken, refreshToken } = generateTokens(payload);

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          first_name: user.first_name,
          last_name: user.last_name,
          role: user.role,
          is_active: user.is_active,
          created_at: user.created_at,
          updated_at: user.updated_at,
        },
        accessToken,
        refreshToken,
      },
    });
  } catch (err) {
    logger.error('Login failed', { error: (err as Error).message });
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// ── POST /refresh-token ──────────────────────────────────────────────

router.post('/refresh-token', validateBody(refreshTokenSchema), async (req, res: Response) => {
  try {
    const { refresh_token } = req.body;

    // Verify refresh token
    const refreshPayload = jwt.verify(refresh_token, JWT_REFRESH_SECRET) as RefreshPayload;

    // Find user
    const user = await findByIdWithHash(refreshPayload.userId);
    if (!user) {
      res.status(401).json({ success: false, message: 'User not found' });
      return;
    }

    // Generate new tokens
    const payload: AuthPayload = {
      userId: user.id,
      role: user.role,
      tokenVersion: refreshPayload.tokenVersion,
    };
    const { accessToken, refreshToken } = generateTokens(payload);

    res.json({
      success: true,
      data: {
        accessToken,
        refreshToken,
      },
    });
  } catch (err) {
    logger.error('Token refresh failed', { error: (err as Error).message });
    res.status(401).json({ success: false, message: 'Invalid refresh token' });
  }
});

// ── POST /logout ─────────────────────────────────────────────────────

router.post('/logout', (req, res: Response) => {
  res.json({ success: true, message: 'Logged out successfully' });
});

export default router;