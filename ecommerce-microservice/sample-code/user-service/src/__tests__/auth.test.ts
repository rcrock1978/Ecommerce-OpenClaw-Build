import { jest } from '@jest/globals';
import jwt from 'jsonwebtoken';
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

import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types';

describe('Auth Middleware', () => {
  let mockReq: Partial<AuthenticatedRequest>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockReq = {
      headers: {},
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as Partial<Response>;
    mockNext = jest.fn();
    jest.clearAllMocks();
  });

  describe('authenticate', () => {
    it('should call next with valid token', () => {
      const payload = { userId: 'user-id', email: 'test@example.com', role: UserRole.CUSTOMER };
      mockReq.headers = { authorization: 'Bearer valid-token' };

      mockVerify.mockReturnValue(payload);

      authenticate(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockVerify).toHaveBeenCalledWith('valid-token', 'change-me-in-production');
      expect(mockReq.user).toEqual(payload);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should return 401 for missing authorization header', () => {
      authenticate(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Missing or malformed Authorization header',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 for malformed header', () => {
      mockReq.headers = { authorization: 'Invalid' };

      authenticate(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Missing or malformed Authorization header',
      });
    });

    it('should return 401 for invalid token', () => {
      mockReq.headers = { authorization: 'Bearer invalid-token' };

      mockVerify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      authenticate(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid or expired token',
      });
    });
  });

  describe('authorize', () => {
    const authMiddleware = authorize(UserRole.ADMIN);

    it('should call next for authorized user', () => {
      mockReq.user = { userId: 'user-id', email: 'admin@example.com', role: UserRole.ADMIN };

      authMiddleware(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should return 401 for unauthenticated user', () => {
      authMiddleware(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Not authenticated',
      });
    });

    it('should return 403 for insufficient permissions', () => {
      mockReq.user = { userId: 'user-id', email: 'customer@example.com', role: UserRole.CUSTOMER };

      authMiddleware(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Insufficient permissions',
      });
    });

    it('should support multiple roles', () => {
      const multiRoleMiddleware = authorize(UserRole.ADMIN, UserRole.SELLER);

      mockReq.user = { userId: 'user-id', email: 'seller@example.com', role: UserRole.SELLER };

      multiRoleMiddleware(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });
});