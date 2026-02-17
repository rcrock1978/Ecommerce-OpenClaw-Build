export declare const config: {
    env: string;
    port: number;
    version: string;
    mongodb: {
        uri: string;
        options: {
            maxPoolSize: number;
            serverSelectionTimeoutMS: number;
            socketTimeoutMS: number;
        };
    };
    elasticsearch: {
        node: string;
        auth: {
            username: string;
            password: string;
        } | undefined;
        maxRetries: number;
        requestTimeout: number;
    };
    redis: {
        url: string;
        ttl: {
            product: number;
            category: number;
            search: number;
        };
    };
    jwt: {
        secret: string;
        issuer: string;
        audience: string;
    };
    cors: {
        origin: string;
    };
    rateLimit: {
        windowMs: number;
        max: number;
    };
    logging: {
        level: string;
        format: string;
    };
    tracing: {
        serviceName: string;
        jaeger: {
            endpoint: string;
        };
    };
    metrics: {
        prefix: string;
    };
    services: {
        userService: {
            url: string;
            timeout: number;
        };
        inventoryService: {
            url: string;
            timeout: number;
        };
    };
    pagination: {
        defaultLimit: number;
        maxLimit: number;
    };
    upload: {
        maxSize: number;
        allowedTypes: string[];
    };
};
//# sourceMappingURL=app.d.ts.map