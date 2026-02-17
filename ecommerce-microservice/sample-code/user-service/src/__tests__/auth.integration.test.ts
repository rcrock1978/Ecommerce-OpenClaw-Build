import request from 'supertest';
import { jest } from '@jest/globals';

jest.mock('../models/user', () => ({
  createUser: jest.fn(),
  findByEmail: jest.fn(),
  findByIdWithHash: jest.fn(),
  verifyPassword: jest.fn(),
}));

jest.mock('jsonwebtoken', () => ({
  sign: jest.fn(),
  verify: jest.fn(),
}));

jest.mock('../utils/logger', () => ({
  default: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

import app from '../index';
import { User, UserRole } from '../types';
import jwt from 'jsonwebtoken';
import { createUser, findByEmail, findByIdWithHash, verifyPassword } from '../models/user';

const mockCreateUser = createUser as jest.MockedFunction<any>;
const mockFindByEmail = findByEmail as jest.MockedFunction<any>;
const mockFindByIdWithHash = findByIdWithHash as jest.MockedFunction<any>;
const mockVerifyPassword = verifyPassword as jest.MockedFunction<any>;
const mockSign = jwt.sign as jest.MockedFunction<any>;
const mockVerify = jwt.verify as jest.MockedFunction<any>;

describe('Auth Routes Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /auth/register', () => {
    it('should register a new user successfully', async () => {
      const mockUser = {
        id: 'user-id',
        email: 'test@example.com',
        first_name: 'John',
        last_name: 'Doe',
        role: UserRole.CUSTOMER,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockFindByEmail.mockResolvedValue(null);
      mockCreateUser.mockResolvedValue(mockUser);
      mockSign
        .mockReturnValueOnce('access-token')
        .mockReturnValueOnce('refresh-token');

      const response = await request(app)
        .post('/auth/register')
        .send({
          email: 'test@example.com',
          password: 'password123',
          first_name: 'John',
          last_name: 'Doe',
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.email).toBe('test@example.com');
      expect(response.body.data).toHaveProperty('accessToken');
      expect(response.body.data).toHaveProperty('refreshToken');
      expect(mockFindByEmail).toHaveBeenCalledWith('test@example.com');
      expect(mockCreateUser).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
        first_name: 'John',
        last_name: 'Doe',
        role: UserRole.CUSTOMER,
      });
    });

    it('should return 409 if email already exists', async () => {
      mockFindByEmail.mockResolvedValue({
        id: 'existing-id',
        email: 'test@example.com',
      });

      const response = await request(app)
        .post('/auth/register')
        .send({
          email: 'test@example.com',
          password: 'password123',
          first_name: 'John',
          last_name: 'Doe',
        })
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Email already registered');
    });

    it('should validate input', async () => {
      const response = await request(app)
        .post('/auth/register')
        .send({
          email: 'invalid-email',
          password: '123',
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /auth/login', () => {
    it('should login user successfully', async () => {
      const mockUser = {
        id: 'user-id',
        email: 'test@example.com',
        password_hash: 'hashed',
        first_name: 'John',
        last_name: 'Doe',
        role: UserRole.CUSTOMER,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockFindByEmail.mockResolvedValue(mockUser);
      mockVerifyPassword.mockResolvedValue(true);
      mockSign
        .mockReturnValueOnce('access-token')
        .mockReturnValueOnce('refresh-token');

      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'test@example.com',
          password: 'password123',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.email).toBe('test@example.com');
      expect(response.body.data).toHaveProperty('accessToken');
      expect(response.body.data).toHaveProperty('refreshToken');
      expect(mockFindByEmail).toHaveBeenCalledWith('test@example.com');
      expect(mockVerifyPassword).toHaveBeenCalledWith('password123', 'hashed');
    });

    it('should return 401 for invalid credentials', async () => {
      mockFindByEmail.mockResolvedValue(null);

      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'password123',
        })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid credentials');
    });

    it('should return 401 for wrong password', async () => {
      const mockUser = {
        id: 'user-id',
        email: 'test@example.com',
        password_hash: 'hashed',
        first_name: 'John',
        last_name: 'Doe',
        role: UserRole.CUSTOMER,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockFindByEmail.mockResolvedValue(mockUser);
      mockVerifyPassword.mockResolvedValue(false);

      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'test@example.com',
          password: 'wrongpassword',
        })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid credentials');
    });
  });

  describe('POST /auth/refresh-token', () => {
    it('should refresh tokens successfully', async () => {
      const mockUser = {
        id: 'user-id',
        email: 'test@example.com',
        password_hash: 'hashed',
        first_name: 'John',
        last_name: 'Doe',
        role: UserRole.CUSTOMER,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockVerify.mockReturnValue({ userId: 'user-id', tokenVersion: 0 });
      mockFindByIdWithHash.mockResolvedValue(mockUser);
      mockSign
        .mockReturnValueOnce('new-access-token')
        .mockReturnValueOnce('new-refresh-token');

      const response = await request(app)
        .post('/auth/refresh-token')
        .send({
          refresh_token: 'valid-refresh-token',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.accessToken).toBe('new-access-token');
      expect(response.body.data.refreshToken).toBe('new-refresh-token');
    });

    it('should return 401 for invalid refresh token', async () => {
      mockVerify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      const response = await request(app)
        .post('/auth/refresh-token')
        .send({
          refresh_token: 'invalid-token',
        })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid refresh token');
    });

    it('should return 401 if user not found', async () => {
      mockVerify.mockReturnValue({ userId: 'nonexistent-id', tokenVersion: 0 });
      mockFindByIdWithHash.mockResolvedValue(null);

      const response = await request(app)
        .post('/auth/refresh-token')
        .send({
          refresh_token: 'valid-token',
        })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('User not found');
    });
  });

  describe('POST /auth/logout', () => {
    it('should logout successfully', async () => {
      const response = await request(app)
        .post('/auth/logout')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Logged out successfully');
    });
  });
});