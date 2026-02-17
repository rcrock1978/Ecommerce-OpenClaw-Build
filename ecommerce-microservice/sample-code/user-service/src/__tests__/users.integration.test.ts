import { jest } from '@jest/globals';

jest.mock('../models/user', () => ({
  findById: jest.fn(),
  updateUser: jest.fn(),
  listUsers: jest.fn(),
}));

jest.mock('../utils/logger', () => ({
  default: {
    error: jest.fn(),
  },
}));

jest.mock('jsonwebtoken', () => ({
  verify: jest.fn(),
}));
jest.mock('../config/database', () => ({
  pool: {
    query: jest.fn(),
    on: jest.fn(),
    connect: jest.fn(),
    end: jest.fn(),
  },
  connectDatabase: jest.fn(),
  disconnectDatabase: jest.fn(),
}));


import request from 'supertest';
import app from '../index';
import { UserRole } from '../types';
import { findById, updateUser, listUsers } from '../models/user';
import jwt from 'jsonwebtoken';

const mockFindById = findById as jest.MockedFunction<any>;
const mockUpdateUser = updateUser as jest.MockedFunction<any>;
const mockListUsers = listUsers as jest.MockedFunction<any>;
const mockVerify = jwt.verify as jest.MockedFunction<any>;

describe('Users Routes Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockVerify.mockReturnValue({ userId: 'user-id', role: UserRole.CUSTOMER, tokenVersion: 0 });
  });

  describe('GET /users/me', () => {
    it('should return user profile', async () => {
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

      mockFindById.mockResolvedValue(mockUser);

      const response = await request(app)
        .get('/users/me')
        .set('Authorization', 'Bearer valid-token')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockUser);
      expect(mockFindById).toHaveBeenCalledWith('user-id');
    });

    it('should return 404 if user not found', async () => {
      mockFindById.mockResolvedValue(null);

      const response = await request(app)
        .get('/users/me')
        .set('Authorization', 'Bearer valid-token')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('User not found');
    });

    it('should return 401 if not authenticated', async () => {
      mockVerify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      const response = await request(app)
        .get('/users/me')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /users/me', () => {
    it('should update user profile', async () => {
      const updatedUser = {
        id: 'user-id',
        email: 'updated@example.com',
        first_name: 'Jane',
        last_name: 'Smith',
        role: UserRole.CUSTOMER,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockUpdateUser.mockResolvedValue(updatedUser);

      const response = await request(app)
        .put('/users/me')
        .set('Authorization', 'Bearer valid-token')
        .send({
          first_name: 'Jane',
          last_name: 'Smith',
          email: 'updated@example.com',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(updatedUser);
      expect(mockUpdateUser).toHaveBeenCalledWith('user-id', {
        first_name: 'Jane',
        last_name: 'Smith',
        email: 'updated@example.com',
      });
    });

    it('should return 404 if user not found', async () => {
      mockUpdateUser.mockResolvedValue(null);

      const response = await request(app)
        .put('/users/me')
        .set('Authorization', 'Bearer valid-token')
        .send({ first_name: 'Jane' })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('User not found');
    });
  });

  describe('GET /users', () => {
    it('should return paginated users for admin', async () => {
      mockVerify.mockReturnValue({ userId: 'admin-id', role: UserRole.ADMIN, tokenVersion: 0 });

      const mockUsers = [
        {
          id: 'user-1',
          email: 'test1@example.com',
          first_name: 'John',
          last_name: 'Doe',
          role: UserRole.CUSTOMER,
          is_active: true,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];

      mockListUsers.mockResolvedValue({ users: mockUsers, total: 1 });

      const response = await request(app)
        .get('/users?page=1&limit=10')
        .set('Authorization', 'Bearer admin-token')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockUsers);
      expect(response.body.meta).toEqual({
        page: 1,
        limit: 10,
        total: 1,
        totalPages: 1,
      });
      expect(mockListUsers).toHaveBeenCalledWith(1, 10);
    });

    it('should return 403 for non-admin', async () => {
      const response = await request(app)
        .get('/users')
        .set('Authorization', 'Bearer customer-token')
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Insufficient permissions');
    });
  });

  describe('GET /users/:id', () => {
    it('should return user by id for admin', async () => {
      mockVerify.mockReturnValue({ userId: 'admin-id', role: UserRole.ADMIN, tokenVersion: 0 });

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

      mockFindById.mockResolvedValue(mockUser);

      const response = await request(app)
        .get('/users/user-id')
        .set('Authorization', 'Bearer admin-token')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockUser);
      expect(mockFindById).toHaveBeenCalledWith('user-id');
    });

    it('should return 404 if user not found', async () => {
      mockVerify.mockReturnValue({ userId: 'admin-id', role: UserRole.ADMIN, tokenVersion: 0 });

      mockFindById.mockResolvedValue(null);

      const response = await request(app)
        .get('/users/notfound')
        .set('Authorization', 'Bearer admin-token')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('User not found');
    });
  });
});