import { IProduct } from '../models/Product';
import { ProductFilters, ProductSort, PaginationOptions } from './ProductService';
export declare class SearchService {
    private client;
    constructor();
    indexProduct(product: IProduct): Promise<void>;
    deleteProduct(productId: string): Promise<void>;
    searchProducts(filters: ProductFilters, sort: ProductSort, pagination: PaginationOptions): Promise<{
        products: IProduct[];
        total: number;
        hasNext: boolean;
        nextCursor?: string;
    }>;
    private buildSearchQuery;
    private buildSortOptions;
    getSearchSuggestions(query: string, limit?: number): Promise<string[]>;
}
//# sourceMappingURL=search.d.ts.map