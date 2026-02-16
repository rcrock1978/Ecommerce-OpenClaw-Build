import { jest } from '@jest/globals';
import { authenticate, authorize } from '../middleware/auth';
import { UserRole } from '../types';

// Mock jsonwebtoken
const mockVerify = jest.fn() as jest.MockedFunction<any>;

jest.mock('jsonwebtoken', () => ({
  verify: mockVerify,
}));

// Mock logger
jest.mock('../utils/logger', () => ({
  default: {
    warn: jest.fn(),
  },
}));

import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types';