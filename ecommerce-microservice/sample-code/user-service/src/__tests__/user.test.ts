import { jest } from '@jest/globals';
import { createUser, findByEmail, findById, findByIdWithHash, updateUser, listUsers, verifyPassword } from '../models/user';
import { User, UserRole } from '../types';

// Mock the database pool
const mockQuery = jest.fn() as jest.MockedFunction<any>;
const mockPool = {
  query: mockQuery,
};

jest.mock('../config/database', () => ({
  default: mockPool,
}));

// Mock bcrypt
const mockHash = jest.fn() as jest.MockedFunction<any>;
const mockCompare = jest.fn() as jest.MockedFunction<any>;

jest.mock('bcrypt', () => ({
  hash: mockHash,
  compare: mockCompare,
}));

import bcrypt from 'bcrypt';

describe('User Model', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createUser', () => {
    it('should create a new user successfully', async () => {
      const mockUser: User = {
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

      mockHash.mockResolvedValue('hashed-password');
      mockQuery.mockResolvedValue({ rows: [mockUser] });

      const result = await createUser({
        email: 'test@example.com',
        password: 'password123',
        first_name: 'John',
        last_name: 'Doe',
      });

      expect(mockHash).toHaveBeenCalledWith('password123', 12);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO users'),
        expect.arrayContaining(['user-id', 'test@example.com', 'hashed-password', 'John', 'Doe', 'customer'])
      );
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
    });

    it('should use default role if not provided', async () => {
      const mockUser: User = {
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
        password_hash: 'hashed-password',
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

    it('should return null if user not found', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      const result = await findByEmail('nonexistent@example.com');

      expect(result).toBeNull();
    });

    it('should lowercase email', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      await findByEmail('TEST@EXAMPLE.COM');

      expect(mockQuery).toHaveBeenCalledWith(
        expect.any(String),
        ['test@example.com']
      );
    });
  });

  describe('findById', () => {
    it('should return safe user if found', async () => {
      const mockUser: User = {
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

    it('should return null if user not found', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      const result = await findById('nonexistent-id');

      expect(result).toBeNull();
    });
  });

  describe('findByIdWithHash', () => {
    it('should return user with hash if found', async () => {
      const mockUser: User = {
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

      mockQuery.mockResolvedValue({ rows: [mockUser] });

      const result = await findByIdWithHash('user-id');

      expect(result).toEqual(mockUser);
    });

    it('should return null if user not found', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      const result = await findByIdWithHash('nonexistent-id');

      expect(result).toBeNull();
    });
  });

  describe('updateUser', () => {
    it('should update user fields', async () => {
      const mockUser: User = {
        id: 'user-id',
        email: 'newemail@example.com',
        password_hash: 'hashed-password',
        first_name: 'Jane',
        last_name: 'Smith',
        role: UserRole.CUSTOMER,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockQuery.mockResolvedValue({ rows: [mockUser] });

      const result = await updateUser('user-id', {
        first_name: 'Jane',
        last_name: 'Smith',
        email: 'newemail@example.com',
      });

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users SET'),
        expect.arrayContaining(['Jane', 'Smith', 'newemail@example.com', 'user-id'])
      );
      expect(result).toEqual({
        id: 'user-id',
        email: 'newemail@example.com',
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

      const result = await updateUser('nonexistent-id', { first_name: 'Jane' });

      expect(result).toBeNull();
    });

    it('should return existing user if no fields to update', async () => {
      const mockUser: User = {
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

      mockQuery.mockResolvedValue({ rows: [mockUser] });

      const result = await updateUser('user-id', {});

      expect(mockQuery).not.toHaveBeenCalled();
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
    });
  });

  describe('listUsers', () => {
    it('should return paginated users', async () => {
      const mockUsers: User[] = [
        {
          id: 'user-1',
          email: 'user1@example.com',
          password_hash: 'hash1',
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
          password_hash: 'hash2',
          first_name: 'User',
          last_name: 'Two',
          role: UserRole.CUSTOMER,
          is_active: true,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];

      mockQuery
        .mockResolvedValueOnce({ rows: mockUsers })
        .mockResolvedValueOnce({ rows: [{ count: '10' }] });

      const result = await listUsers(1, 20);

      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT * FROM users WHERE is_active = true ORDER BY created_at DESC LIMIT $1 OFFSET $2',
        [20, 0]
      );
      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT COUNT(*) as count FROM users WHERE is_active = true',
        []
      );
      expect(result.users).toHaveLength(2);
      expect(result.total).toBe(10);
      expect(result.users[0]).not.toHaveProperty('password_hash');
    });
  });

  describe('verifyPassword', () => {
    it('should verify password correctly', async () => {
      mockCompare.mockResolvedValue(true);

      const result = await verifyPassword('plaintext', 'hash');

      expect(mockCompare).toHaveBeenCalledWith('plaintext', 'hash');
      expect(result).toBe(true);
    });

    it('should return false for invalid password', async () => {
      mockCompare.mockResolvedValue(false);

      const result = await verifyPassword('wrong', 'hash');

      expect(result).toBe(false);
    });
  });
});