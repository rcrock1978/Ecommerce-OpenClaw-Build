import { Request } from 'express';

/** User roles for RBAC */
export enum UserRole {
  CUSTOMER = 'customer',
  ADMIN = 'admin',
  SELLER = 'seller',
}

/** User record as stored in the database */
export interface User {
  id: string;
  email: string;
  password_hash: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

/** Safe user object (no password hash) returned to clients */
export type SafeUser = Omit<User, 'password_hash'>;

/** JWT access-token payload */
export interface AuthPayload {
  userId: string;
  email: string;
  role: UserRole;
}

/** JWT refresh-token payload */
export interface RefreshPayload {
  userId: string;
  tokenVersion: number;
}

/** Express request augmented with authenticated user info */
export interface AuthenticatedRequest extends Request {
  user?: AuthPayload;
}

/** Pagination query parameters */
export interface PaginationQuery {
  page?: number;
  limit?: number;
}

/** Standard API response envelope */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  meta?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/** Input for creating a user */
export interface CreateUserInput {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  role?: UserRole;
}

/** Input for updating a user profile */
export interface UpdateUserInput {
  first_name?: string;
  last_name?: string;
  email?: string;
}
