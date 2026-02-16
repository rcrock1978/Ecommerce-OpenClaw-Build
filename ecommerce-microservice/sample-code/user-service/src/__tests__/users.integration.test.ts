import request from 'supertest';
import { jest } from '@jest/globals';
import app from '../index';
import { UserRole } from '../types';

// Mock the user model functions
const mockFindById = jest.fn() as jest.MockedFunction<any>;
const mockUpdateUser = jest.fn() as jest.MockedFunction<any>;
const mockListUsers = jest.fn() as jest.MockedFunction<any>;

jest.mock('../models/user', () => ({
  findById: mockFindById,
  updateUser: mockUpdateUser,
  listUsers: mockListUsers,
}));

// Mock the auth middleware
jest.mock('../middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { userId: 'test-user-id', email: 'test@example.com', role: UserRole.CUSTOMER };
    next();
  },
  authorize: () => (req: any, _res: any, next: any) => next(),
}));

// Mock logger
jest.mock('../utils/logger', () => ({
  default: {
    error: jest.fn(),
  },
}));

describe('User Routes Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /users/me', () => {
    it('should return current user profile', async () => {
      const user = {
        id: 'test-user-id',
        email: 'test@example.com',
        first_name: 'John',
        last_name: 'Doe',
        role: UserRole.CUSTOMER,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockFindById.mockResolvedValue(user);

      const response = await request(app)
        .get('/users/me')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.email).toBe('test@example.com');
      expect(response.body.data).not.toHaveProperty('password_hash');
    });

    it('should return 404 if user not found', async () => {
      mockFindById.mockResolvedValue(null);

      const response = await request(app)
        .get('/users/me')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('User not found');
    });
  });

  describe('PUT /users/me', () => {
    it('should update user profile', async () => {
      const updatedUser = {
        id: 'test-user-id',
        email: 'newemail@example.com',
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
        .send({
          first_name: 'Jane',
          last_name: 'Smith',
          email: 'newemail@example.com',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.first_name).toBe('Jane');
      expect(response.body.data.email).toBe('newemail@example.com');
      expect(mockUpdateUser).toHaveBeenCalledWith('test-user-id', {
        first_name: 'Jane',
        last_name: 'Smith',
        email: 'newemail@example.com',
      });
    });

    it('should return 404 if user not found', async () => {
      mockUpdateUser.mockResolvedValue(null);

      const response = await request(app)
        .put('/users/me')
        .send({ first_name: 'Jane' })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('User not found');
    });
  });

  describe('GET /users', () => {
    it('should return paginated users for admin', async () => {
      const users = [
        {
          id: 'user-1',
          email: 'user1@example.com',
          first_name: 'User',
          last_name: 'One',
          role: UserRole.CUSTOMER,
          is_active: true,
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          id: 'user-2',
          email: 'user2@example.com',
          first_name: 'User',
          last_name: 'Two',
          role: UserRole.CUSTOMER,
          is_active: true,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];

      mockListUsers.mockResolvedValue({ users, total: 25 });

      const response = await request(app)
        .get('/users?page=1&limit=20')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.meta.total).toBe(25);
      expect(response.body.meta.page).toBe(1);
      expect(response.body.meta.limit).toBe(20);
      expect(mockListUsers).toHaveBeenCalledWith(1, 20);
    });

    it('should use default pagination values', async () => {
      mockListUsers.mockResolvedValue({ users: [], total: 0 });

      await request(app)
        .get('/users')
        .expect(200);

      expect(mockListUsers).toHaveBeenCalledWith(1, 20);
    });
  });

  describe('GET /users/:id', () => {
    it('should return specific user for admin', async () => {
      const user = {
        id: 'user-id',
        email: 'user@example.com',
        first_name: 'User',
        last_name: 'Name',
        role: UserRole.CUSTOMER,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockFindById.mockResolvedValue(user);

      const response = await request(app)
        .get('/users/user-id')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe('user-id');
      expect(mockFindById).toHaveBeenCalledWith('user-id');
    });

    it('should return 404 if user not found', async () => {
      mockFindById.mockResolvedValue(null);

      const response = await request(app)
        .get('/users/nonexistent-id')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('User not found');
    });
  });
});