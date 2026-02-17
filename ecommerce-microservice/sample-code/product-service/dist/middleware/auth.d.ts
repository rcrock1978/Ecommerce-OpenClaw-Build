import { Request, Response, NextFunction } from 'express';
declare global {
    namespace Express {
        interface Request {
            user?: {
                id: string;
                email: string;
                roles: string[];
                permissions: string[];
            };
            correlationId?: string;
            span?: any;
        }
    }
}
export interface JWTPayload {
    sub: string;
    email: string;
    roles: string[];
    permissions: string[];
    scope?: string;
    iat: number;
    exp: number;
    jti: string;
}
export declare const authMiddleware: (req: Request, res: Response, next: NextFunction) => Promise<void | Response<any, Record<string, any>>>;
export declare const requirePermission: (requiredPermission: string) => (req: Request, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
export declare const requireRole: (requiredRole: string) => (req: Request, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
export declare const optionalAuth: (req: Request, res: Response, next: NextFunction) => Promise<void>;
//# sourceMappingURL=auth.d.ts.map