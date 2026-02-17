import { Request, Response, NextFunction } from 'express';
import promClient from 'prom-client';
export declare const register: promClient.Registry;
export declare const httpRequestDuration: promClient.Histogram<"method" | "route" | "status_code">;
export declare const httpRequestsTotal: promClient.Counter<"method" | "route" | "status_code">;
export declare const activeConnections: promClient.Gauge<string>;
export declare const businessMetrics: {
    productsCreated: promClient.Counter<"category">;
    productsViewed: promClient.Counter<"category">;
};
export declare const metricsMiddleware: (req: Request, res: Response, next: NextFunction) => void;
export declare const metricsEndpoint: (req: Request, res: Response) => Promise<void>;
//# sourceMappingURL=metrics.d.ts.map