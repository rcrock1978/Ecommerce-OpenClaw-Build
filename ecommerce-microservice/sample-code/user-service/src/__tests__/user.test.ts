import { jest } from '@jest/globals';
import { createUser, findByEmail, findById, findByIdWithHash, updateUser, listUsers, verifyPassword } from '../models/user';
import { User, UserRole } from '../types';

// Mock the database pool
const mockPool = {
  query: jest.fn(),
};

jest.mock('../config/database', () => ({
  default: mockPool,
}));

// Mock bcrypt
jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
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

      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
      mockPool.query.mockResolvedValue({ rows: [mockUser] });

      const result = await createUser({
        email: 'test@example.com',
        password: 'password123',
        first_name: 'John',
        last_name: 'Doe',
      });

      expect(bcrypt.hash).toHaveBeenCalledWith('password123', 12);
      expect(mockPool.query).toHaveBeenCalledWith(
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

      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
      mockPool.query.mockResolvedValue({ rows: [mockUser] });

      await createUser({
        email: 'test@example.com',
        password: 'password123',
        first_name: 'John',
        last_name: 'Doe',
      });

      expect(mockPool.query).toHaveBeenCalledWith(
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

      mockPool.query.mockResolvedValue({ rows: [mockUser] });

      const result = await findByEmail('test@example.com');

      expect(mockPool.query).toHaveBeenCalledWith(
        'SELECT * FROM users WHERE email = $1 AND is_active = true',
        ['test@example.com']
      );
      expect(result).toEqual(mockUser);
    });

    it('should return null if user not found', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      const result = await findByEmail('nonexistent@example.com');

      expect(result).toBeNull();
    });

    it('should lowercase email', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      await findByEmail('TEST@EXAMPLE.COM');

      expect(mockPool.query).toHaveBeenCalledWith(
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

      mockPool.query.mockResolvedValue({ rows: [mockUser] });

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
      mockPool.query.mockResolvedValue({ rows: [] });

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

      mockPool.query.mockResolvedValue({ rows: [mockUser] });

      const result = await findByIdWithHash('user-id');

      expect(result).toEqual(mockUser);
    });

    it('should return null if user not found', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

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

      mockPool.query.mockResolvedValue({ rows: [mockUser] });

      const result = await updateUser('user-id', {
        first_name: 'Jane',
        last_name: 'Smith',
        email: 'newemail@example.com',
      });

      expect(mockPool.query).toHaveBeenCalledWith(
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
      mockPool.query.mockResolvedValue({ rows: [] });

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

      mockPool.query.mockResolvedValue({ rows: [mockUser] });

      const result = await updateUser('user-id', {});

      expect(mockPool.query).not.toHaveBeenCalled();
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

      mockPool.query
        .mockResolvedValueOnce({ rows: mockUsers })
        .mockResolvedValueOnce({ rows: [{ count: '10' }] });

      const result = await listUsers(1, 20);

      expect(mockPool.query).toHaveBeenCalledWith(
        'SELECT * FROM users WHERE is_active = true ORDER BY created_at DESC LIMIT $1 OFFSET $2',
        [20, 0]
      );
      expect(mockPool.query).toHaveBeenCalledWith(
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
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await verifyPassword('plaintext', 'hash');

      expect(bcrypt.compare).toHaveBeenCalledWith('plaintext', 'hash');
      expect(result).toBe(true);
    });

    it('should return false for invalid password', async () => {
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      const result = await verifyPassword('wrong', 'hash');

      expect(result).toBe(false);
    });
  });
});