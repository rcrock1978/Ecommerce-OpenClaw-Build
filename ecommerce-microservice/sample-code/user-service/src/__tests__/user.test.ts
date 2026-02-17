import { jest } from '@jest/globals';

jest.mock('../config/database', () => ({ query: jest.fn() }));

jest.mock('bcrypt', () => ({ hash: jest.fn(), compare: jest.fn() }));

jest.mock('uuid', () => ({ v4: jest.fn() }));

import { createUser, findByEmail, findById, findByIdWithHash, updateUser, listUsers, verifyPassword } from '../models/user';
import { User, UserRole } from '../types';

import pool from '../config/database';

import bcrypt from 'bcrypt';

import { v4 as uuidv4 } from 'uuid';

const mockQuery = pool.query as jest.MockedFunction<any>;
const mockHash = bcrypt.hash as jest.MockedFunction<any>;
const mockCompare = bcrypt.compare as jest.MockedFunction<any>;
const mockV4 = uuidv4 as jest.MockedFunction<any>;

describe('User Model', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockV4.mockReturnValue('mock-uuid');
  });

  describe('createUser', () => {
    it('should create a user successfully', async () => {
      const mockUser: User = {
        id: 'mock-uuid',
        email: 'test@example.com',
        password_hash: 'hashed-password',
        first_name: 'John',
        last_name: 'Doe',
        role: UserRole.CUSTOMER,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockHash.mockResolvedValue('hashed-password');
      mockQuery.mockResolvedValue({ rows: [mockUser] });

      const result = await createUser({
        email: 'test@example.com',
        password: 'password123',
        first_name: 'John',
        last_name: 'Doe',
        role: UserRole.CUSTOMER,
      });

      expect(mockHash).toHaveBeenCalledWith('password123', 12);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO users'),
        ['mock-uuid', 'test@example.com', 'hashed-password', 'John', 'Doe', 'customer']
      );
      expect(result).toEqual({
        id: 'mock-uuid',
        email: 'test@example.com',
        first_name: 'John',
        last_name: 'Doe',
        role: UserRole.CUSTOMER,
        is_active: true,
        created_at: mockUser.created_at,
        updated_at: mockUser.updated_at,
      });
    });

    it('should default role to customer', async () => {
      const mockUser: User = {
        id: 'mock-uuid',
        email: 'test@example.com',
        password_hash: 'hashed-password',
        first_name: 'John',
        last_name: 'Doe',
        role: UserRole.CUSTOMER,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockHash.mockResolvedValue('hashed-password');
      mockQuery.mockResolvedValue({ rows: [mockUser] });

      await createUser({
        email: 'test@example.com',
        password: 'password123',
        first_name: 'John',
        last_name: 'Doe',
      });

      expect(mockQuery).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(['customer'])
      );
    });
  });

  describe('findByEmail', () => {
    it('should return user if found', async () => {
      const mockUser: User = {
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

      mockQuery.mockResolvedValue({ rows: [mockUser] });

      const result = await findByEmail('test@example.com');

      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT * FROM users WHERE email = $1 AND is_active = true',
        ['test@example.com']
      );
      expect(result).toEqual(mockUser);
    });

    it('should return null if not found', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      const result = await findByEmail('notfound@example.com');

      expect(result).toBeNull();
    });
  });

  describe('findById', () => {
    it('should return safe user if found', async () => {
      const mockUser: User = {
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

      mockQuery.mockResolvedValue({ rows: [mockUser] });

      const result = await findById('user-id');

      expect(result).toEqual({
        id: 'user-id',
        email: 'test@example.com',
        first_name: 'John',
        last_name: 'Doe',
        role: UserRole.CUSTOMER,
        is_active: true,
        created_at: mockUser.created_at,
        updated_at: mockUser.updated_at,
      });
      expect(result).not.toHaveProperty('password_hash');
    });

    it('should return null if not found', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      const result = await findById('notfound');

      expect(result).toBeNull();
    });
  });

  describe('findByIdWithHash', () => {
    it('should return user with hash if found', async () => {
      const mockUser: User = {
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

      mockQuery.mockResolvedValue({ rows: [mockUser] });

      const result = await findByIdWithHash('user-id');

      expect(result).toEqual(mockUser);
    });

    it('should return null if not found', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      const result = await findByIdWithHash('notfound');

      expect(result).toBeNull();
    });
  });

  describe('updateUser', () => {
    it('should update user fields', async () => {
      const mockUser: User = {
        id: 'user-id',
        email: 'updated@example.com',
        password_hash: 'hashed',
        first_name: 'Jane',
        last_name: 'Smith',
        role: UserRole.CUSTOMER,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockQuery.mockResolvedValue({ rows: [mockUser] });

      const result = await updateUser('user-id', {
        email: 'updated@example.com',
        first_name: 'Jane',
        last_name: 'Smith',
      });

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users SET'),
        expect.arrayContaining(['Jane', 'Smith', 'updated@example.com', 'user-id'])
      );
      expect(result).toEqual({
        id: 'user-id',
        email: 'updated@example.com',
        first_name: 'Jane',
        last_name: 'Smith',
        role: UserRole.CUSTOMER,
        is_active: true,
        created_at: mockUser.created_at,
        updated_at: mockUser.updated_at,
      });
    });

    it('should return null if user not found', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      const result = await updateUser('notfound', { first_name: 'Jane' });

      expect(result).toBeNull();
    });
  });

  describe('listUsers', () => {
    it('should return paginated users', async () => {
      const mockUsers: User[] = [
        {
          id: 'user-1',
          email: 'test1@example.com',
          password_hash: 'hash1',
          first_name: 'John',
          last_name: 'Doe',
          role: UserRole.CUSTOMER,
          is_active: true,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];

      mockQuery
        .mockResolvedValueOnce({ rows: mockUsers })
        .mockResolvedValueOnce({ rows: [{ count: '10' }] });

      const result = await listUsers(1, 10);

      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT * FROM users WHERE is_active = true ORDER BY created_at DESC LIMIT $1 OFFSET $2',
        [10, 0]
      );
      expect(result).toEqual({
        users: [
          {
            id: 'user-1',
            email: 'test1@example.com',
            first_name: 'John',
            last_name: 'Doe',
            role: UserRole.CUSTOMER,
            is_active: true,
            created_at: mockUsers[0].created_at,
            updated_at: mockUsers[0].updated_at,
          },
        ],
        total: 10,
      });
    });
  });

  describe('verifyPassword', () => {
    it('should verify password correctly', async () => {
      mockCompare.mockResolvedValue(true);

      const result = await verifyPassword('plaintext', 'hash');

      expect(mockCompare).toHaveBeenCalledWith('plaintext', 'hash');
      expect(result).toBe(true);
    });
  });
});