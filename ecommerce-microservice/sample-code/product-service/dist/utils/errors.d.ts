export declare class BaseError extends Error {
    readonly code: string;
    readonly statusCode: number;
    readonly isOperational: boolean;
    constructor(message: string, code: string, statusCode?: number, isOperational?: boolean);
}
export declare class ValidationError extends BaseError {
    readonly details: any[];
    constructor(message: string, details?: any[]);
}
export declare class NotFoundError extends BaseError {
    constructor(resource?: string);
}
export declare class ConflictError extends BaseError {
    constructor(message: string);
}
export declare class UnauthorizedError extends BaseError {
    constructor(message?: string);
}
export declare class ForbiddenError extends BaseError {
    constructor(message?: string);
}
export declare class RateLimitError extends BaseError {
    constructor(message?: string);
}
export declare const asyncHandler: (fn: Function) => (req: any, res: any, next: any) => void;
//# sourceMappingURL=errors.d.ts.map