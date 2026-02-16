import request from 'supertest';
import { jest } from '@jest/globals';
import app from '../index';
import { User, UserRole } from '../types';

// Mock the database functions
const mockCreateUser = jest.fn() as jest.MockedFunction<any>;
const mockFindByEmail = jest.fn() as jest.MockedFunction<any>;
const mockFindByIdWithHash = jest.fn() as jest.MockedFunction<any>;
const mockVerifyPassword = jest.fn() as jest.MockedFunction<any>;

jest.mock('../models/user', () => ({
  createUser: mockCreateUser,
  findByEmail: mockFindByEmail,
  findByIdWithHash: mockFindByIdWithHash,
  verifyPassword: mockVerifyPassword,
}));

// Mock jsonwebtoken
const mockSign = jest.fn() as jest.MockedFunction<any>;
const mockVerify = jest.fn() as jest.MockedFunction<any>;

jest.mock('jsonwebtoken', () => ({
  sign: mockSign,
  verify: mockVerify,
}));

// Mock logger
jest.mock('../utils/logger', () => ({
  default: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

describe('Auth Routes Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /auth/register', () => {
    it('should register a new user successfully', async () => {
      const newUser: User = {
        id: 'user-id',
        email: 'test@example.com',
        password_hash: 'hashed-password',
        first_name: 'John',
        last_name: 'Doe',
        role: UserRole.CUSTOMER,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockFindByEmail.mockResolvedValue(null);
      mockCreateUser.mockResolvedValue({
        id: newUser.id,
        email: newUser.email,
        first_name: newUser.first_name,
        last_name: newUser.last_name,
        role: newUser.role,
        is_active: newUser.is_active,
        created_at: newUser.created_at,
        updated_at: newUser.updated_at,
      });
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
        role: undefined,
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
      const user: User = {
        id: 'user-id',
        email: 'test@example.com',
        password_hash: 'hashed-password',
        first_name: 'John',
        last_name: 'Doe',
        role: UserRole.CUSTOMER,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockFindByEmail.mockResolvedValue(user);
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
      expect(mockVerifyPassword).toHaveBeenCalledWith('password123', 'hashed-password');
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
      const user: User = {
        id: 'user-id',
        email: 'test@example.com',
        password_hash: 'hashed-password',
        first_name: 'John',
        last_name: 'Doe',
        role: UserRole.CUSTOMER,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockFindByEmail.mockResolvedValue(user);
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
      const user: User = {
        id: 'user-id',
        email: 'test@example.com',
        password_hash: 'hashed-password',
        first_name: 'John',
        last_name: 'Doe',
        role: UserRole.CUSTOMER,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockVerify.mockReturnValue({ userId: 'user-id', tokenVersion: 0 });
      mockFindByIdWithHash.mockResolvedValue(user);
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