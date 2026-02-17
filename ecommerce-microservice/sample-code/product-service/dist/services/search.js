"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SearchService = void 0;
const elasticsearch_1 = require("@elastic/elasticsearch");
const logger_1 = require("../utils/logger");
const tracing_1 = require("../utils/tracing");
const app_1 = require("../config/app");
class SearchService {
    constructor() {
        this.client = new elasticsearch_1.Client({
            node: app_1.config.elasticsearch.node,
            auth: app_1.config.elasticsearch.auth,
            maxRetries: app_1.config.elasticsearch.maxRetries,
            requestTimeout: app_1.config.elasticsearch.requestTimeout,
        });
    }
    async indexProduct(product) {
        return tracing_1.tracer.startActiveSpan('SearchService.indexProduct', async (span) => {
            span.setAttribute('product.id', product._id.toString());
            try {
                const document = {
                    id: product._id.toString(),
                    sku: product.sku,
                    name: product.name,
                    slug: product.slug,
                    description: product.description,
                    short_description: product.shortDescription,
                    category_id: product.categoryId.toString(),
                    category_name: product.category?.name,
                    brand: product.brand,
                    tags: product.tags,
                    attributes: product.attributes,
                    pricing: product.pricing,
                    images: product.images,
                    variants: product.variants,
                    seo: product.seo,
                    status: product.status,
                    seller_id: product.sellerId,
                    avg_rating: product.avgRating,
                    review_count: product.reviewCount,
                    created_at: product.createdAt,
                    updated_at: product.updatedAt,
                };
                await this.client.index({
                    index: 'products',
                    id: product._id.toString(),
                    body: document,
                });
                logger_1.logger.debug('Product indexed', { productId: product._id.toString() });
            }
            catch (error) {
                span.recordException(error);
                logger_1.logger.error('Failed to index product', {
                    productId: product._id.toString(),
                    error: error.message
                });
                throw error;
            }
            finally {
                span.end();
            }
        });
    }
    async deleteProduct(productId) {
        return tracing_1.tracer.startActiveSpan('SearchService.deleteProduct', async (span) => {
            span.setAttribute('product.id', productId);
            try {
                await this.client.delete({
                    index: 'products',
                    id: productId,
                });
                logger_1.logger.debug('Product removed from search', { productId });
            }
            catch (error) {
                span.recordException(error);
                logger_1.logger.error('Failed to remove product from search', {
                    productId,
                    error: error.message
                });
                // Don't throw - search index inconsistencies are not critical
            }
            finally {
                span.end();
            }
        });
    }
    async searchProducts(filters, sort, pagination) {
        return tracing_1.tracer.startActiveSpan('SearchService.searchProducts', async (span) => {
            try {
                const query = this.buildSearchQuery(filters);
                const sortOptions = this.buildSortOptions(sort);
                const from = pagination.page ? (pagination.page - 1) * (pagination.limit || 20) : 0;
                const size = Math.min(pagination.limit || 20, 100);
                const searchResponse = await this.client.search({
                    index: 'products',
                    body: {
                        query,
                        sort: sortOptions,
                        from,
                        size: size + 1, // +1 to check if there's next page
                        _source: true,
                    },
                });
                const hits = searchResponse.body.hits.hits;
                const total = searchResponse.body.hits.total.value;
                const hasNext = hits.length > size;
                const products = hasNext ? hits.slice(0, -1) : hits;
                // Convert Elasticsearch documents back to product format
                const productResults = products.map((hit) => ({
                    _id: hit._id,
                    ...hit._source,
                    categoryId: hit._source.category_id,
                    category: hit._source.category_name ? {
                        _id: hit._source.category_id,
                        name: hit._source.category_name,
                    } : undefined,
                }));
                return {
                    products: productResults,
                    total,
                    hasNext,
                    nextCursor: hasNext ? `${(pagination.page || 1) + 1}` : undefined,
                };
            }
            catch (error) {
                span.recordException(error);
                logger_1.logger.error('Search query failed', { error: error.message, filters });
                // Fallback to database search would go here
                throw error;
            }
            finally {
                span.end();
            }
        });
    }
    buildSearchQuery(filters) {
        const must = [];
        const should = [];
        const filter = [];
        // Text search
        if (filters.search) {
            must.push({
                multi_match: {
                    query: filters.search,
                    fields: ['name^3', 'description', 'tags^2', 'brand^2'],
                    fuzziness: 'AUTO',
                },
            });
        }
        // Status filter
        if (filters.status) {
            filter.push({
                term: { status: filters.status },
            });
        }
        else {
            // Default to active products
            filter.push({
                term: { status: 'active' },
            });
        }
        // Category filter
        if (filters.category) {
            filter.push({
                term: { category_id: filters.category },
            });
        }
        // Brand filter
        if (filters.brand) {
            filter.push({
                term: { brand: filters.brand },
            });
        }
        // Price range filter
        if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
            const priceRange = {};
            if (filters.minPrice !== undefined) {
                priceRange.gte = filters.minPrice;
            }
            if (filters.maxPrice !== undefined) {
                priceRange.lte = filters.maxPrice;
            }
            filter.push({
                range: {
                    'pricing.base_price': priceRange,
                },
            });
        }
        // Tags filter
        if (filters.tags && filters.tags.length > 0) {
            filter.push({
                terms: { tags: filters.tags },
            });
        }
        return {
            bool: {
                must,
                should,
                filter,
            },
        };
    }
    buildSortOptions(sort) {
        const sortOptions = [];
        switch (sort.field) {
            case 'name':
                sortOptions.push({ name: { order: sort.order } });
                break;
            case 'price':
                sortOptions.push({ 'pricing.base_price': { order: sort.order } });
                break;
            case 'rating':
                sortOptions.push({ avg_rating: { order: sort.order } });
                break;
            case 'createdAt':
            default:
                sortOptions.push({ created_at: { order: sort.order } });
                break;
        }
        // Always add _score for search relevance
        sortOptions.push('_score');
        return sortOptions;
    }
    async getSearchSuggestions(query, limit = 10) {
        return tracing_1.tracer.startActiveSpan('SearchService.getSearchSuggestions', async (span) => {
            span.setAttribute('search.query', query);
            try {
                const response = await this.client.search({
                    index: 'products',
                    body: {
                        query: {
                            multi_match: {
                                query,
                                fields: ['name', 'tags', 'brand'],
                                type: 'phrase_prefix',
                            },
                        },
                        _source: ['name'],
                        size: limit,
                    },
                });
                const suggestions = response.body.hits.hits.map((hit) => hit._source.name);
                return [...new Set(suggestions)]; // Remove duplicates
            }
            catch (error) {
                span.recordException(error);
                logger_1.logger.error('Failed to get search suggestions', { query, error: error.message });
                return [];
            }
            finally {
                span.end();
            }
        });
    }
}
exports.SearchService = SearchService;
//# sourceMappingURL=search.js.map