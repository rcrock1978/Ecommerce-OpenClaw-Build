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