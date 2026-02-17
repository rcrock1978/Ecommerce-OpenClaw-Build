import { jest } from '@jest/globals';

jest.mock('jsonwebtoken', () => ({
  verify: jest.fn(),
}));

jest.mock('../utils/logger', () => ({ warn: jest.fn() }));

import { authenticate, authorize } from '../middleware/auth';
import { UserRole } from '../types';
import jwt from 'jsonwebtoken';
import logger from '../utils/logger';

const mockVerify = jwt.verify as jest.MockedFunction<typeof jwt.verify>;
const mockWarn = logger.warn as jest.MockedFunction<any>;

describe('Auth Middleware', () => {
  let mockReq: any;
  let mockRes: any;
  let mockNext: jest.MockedFunction<any>;

  beforeEach(() => {
    mockReq = {
      headers: {},
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    mockNext = jest.fn();
    jest.clearAllMocks();
  });

  describe('authenticate', () => {
    it('should call next with valid token', () => {
      const payload = { userId: 'user-1', role: UserRole.CUSTOMER, tokenVersion: 0 };
      mockVerify.mockReturnValue(payload);
      mockReq.headers = { authorization: 'Bearer valid-token' };

      authenticate(mockReq, mockRes, mockNext);

      expect(mockVerify).toHaveBeenCalledWith('valid-token', expect.any(String));
      expect(mockReq.user).toEqual(payload);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should return 401 for missing Authorization header', () => {
      authenticate(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Missing or malformed Authorization header',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 for malformed Authorization header', () => {
      mockReq.headers = { authorization: 'Invalid header' };

      authenticate(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Missing or malformed Authorization header',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 for invalid token', () => {
      mockVerify.mockImplementation(() => {
        throw new Error('Invalid token');
      });
      mockReq.headers = { authorization: 'Bearer invalid-token' };

      authenticate(mockReq, mockRes, mockNext);

      expect(mockWarn).toHaveBeenCalledWith('JWT verification failed', { error: 'Invalid token' });
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid or expired token',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('authorize', () => {
    it('should call next if user has required role', () => {
      const authMiddleware = authorize(UserRole.CUSTOMER);
      mockReq.user = { userId: 'user-1', role: UserRole.CUSTOMER, tokenVersion: 0 };

      authMiddleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should return 403 if user does not have required role', () => {
      const authMiddleware = authorize(UserRole.ADMIN);
      mockReq.user = { userId: 'user-1', role: UserRole.CUSTOMER, tokenVersion: 0 };

      authMiddleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Insufficient permissions',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 if not authenticated', () => {
      const authMiddleware = authorize(UserRole.CUSTOMER);

      authMiddleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Not authenticated',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should allow multiple roles', () => {
      const authMiddleware = authorize(UserRole.CUSTOMER, UserRole.ADMIN);
      mockReq.user = { userId: 'user-1', role: UserRole.ADMIN, tokenVersion: 0 };

      authMiddleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });
});