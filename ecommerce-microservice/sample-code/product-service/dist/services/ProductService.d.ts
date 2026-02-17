import { IProduct } from '../models/Product';
import { EventPublisher } from './event-publisher';
import { CacheService } from './cache';
import { SearchService } from './search';
export interface CreateProductData {
    sku: string;
    name: string;
    description?: string;
    shortDescription?: string;
    categoryId: string;
    brand?: string;
    tags?: string[];
    attributes?: Record<string, any>;
    pricing: {
        currency?: string;
        basePrice: number;
        salePrice?: number;
        saleStartsAt?: Date;
        saleEndsAt?: Date;
        costPrice?: number;
    };
    images?: Array<{
        url: string;
        altText?: string;
        sortOrder?: number;
        isPrimary?: boolean;
    }>;
    variants?: Array<{
        sku: string;
        name: string;
        attributes?: Record<string, any>;
        priceOverride?: number;
        isActive?: boolean;
    }>;
    seo?: {
        metaTitle?: string;
        metaDescription?: string;
        canonicalUrl?: string;
    };
    sellerId?: string;
}
export interface UpdateProductData extends Partial<CreateProductData> {
    status?: 'draft' | 'active' | 'archived';
}
export interface ProductFilters {
    search?: string;
    category?: string;
    brand?: string;
    status?: 'draft' | 'active' | 'archived';
    tags?: string[];
    minPrice?: number;
    maxPrice?: number;
    sellerId?: string;
}
export interface ProductSort {
    field: 'name' | 'price' | 'rating' | 'createdAt';
    order: 'asc' | 'desc';
}
export interface PaginationOptions {
    page?: number;
    limit?: number;
    cursor?: string;
}
export declare class ProductService {
    private eventPublisher;
    private cacheService;
    private searchService;
    constructor(eventPublisher: EventPublisher, cacheService: CacheService, searchService: SearchService);
    createProduct(data: CreateProductData): Promise<IProduct>;
    getProductById(id: string): Promise<IProduct>;
    getProductBySku(sku: string): Promise<IProduct>;
    updateProduct(id: string, data: UpdateProductData): Promise<IProduct>;
    deleteProduct(id: string): Promise<void>;
    searchProducts(filters: ProductFilters, sort?: ProductSort, pagination?: PaginationOptions): Promise<{
        products: IProduct[];
        total: number;
        hasNext: boolean;
        nextCursor?: string;
    }>;
    private buildDatabaseQuery;
    private buildDatabaseSort;
    getProductsByCategory(categoryId: string, pagination?: PaginationOptions): Promise<{
        products: IProduct[];
        total: number;
        hasNext: boolean;
    }>;
}
//# sourceMappingURL=ProductService.d.ts.map