"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProductService = void 0;
const Product_1 = require("../models/Product");
const logger_1 = require("../utils/logger");
const tracing_1 = require("../utils/tracing");
const errors_1 = require("../utils/errors");
class ProductService {
    constructor(eventPublisher, cacheService, searchService) {
        this.eventPublisher = eventPublisher;
        this.cacheService = cacheService;
        this.searchService = searchService;
    }
    async createProduct(data) {
        return tracing_1.tracer.startActiveSpan('ProductService.createProduct', async (span) => {
            span.setAttributes({
                'product.sku': data.sku,
                'product.name': data.name,
            });
            try {
                // Validate category exists
                const category = await Product_1.Category.findById(data.categoryId);
                if (!category) {
                    throw new errors_1.ValidationError('Invalid category ID');
                }
                // Check if SKU already exists
                const existingProduct = await Product_1.Product.findOne({ sku: data.sku.toUpperCase() });
                if (existingProduct) {
                    throw new errors_1.ConflictError(`Product with SKU ${data.sku} already exists`);
                }
                // Create product data
                const productData = {
                    ...data,
                    sku: data.sku.toUpperCase(),
                    pricing: {
                        currency: data.pricing.currency || 'USD',
                        ...data.pricing,
                    },
                    tags: data.tags || [],
                    attributes: data.attributes || {},
                    images: data.images || [],
                    variants: data.variants || [],
                    status: 'draft',
                    avgRating: 0,
                    reviewCount: 0,
                };
                // Create product
                const product = await Product_1.Product.create(productData);
                // Publish event
                await this.eventPublisher.publish('product.created', {
                    productId: product._id,
                    sku: product.sku,
                    name: product.name,
                    categoryId: product.categoryId,
                });
                // Index in search
                await this.searchService.indexProduct(product);
                // Clear relevant caches
                await this.cacheService.invalidateByPattern('products:*');
                await this.cacheService.invalidateByPattern(`category:${product.categoryId}:*`);
                logger_1.logger.info('Product created', {
                    productId: product._id.toString(),
                    sku: product.sku,
                });
                span.setAttribute('product.id', product._id.toString());
                return product;
            }
            catch (error) {
                span.recordException(error);
                logger_1.logger.error('Failed to create product', {
                    sku: data.sku,
                    error: error.message
                });
                throw error;
            }
            finally {
                span.end();
            }
        });
    }
    async getProductById(id) {
        return tracing_1.tracer.startActiveSpan('ProductService.getProductById', async (span) => {
            span.setAttribute('product.id', id);
            try {
                const cacheKey = `product:${id}`;
                // Try cache first
                const cached = await this.cacheService.get(cacheKey);
                if (cached) {
                    logger_1.logger.debug('Product cache hit', { productId: id });
                    return cached;
                }
                // Fetch from database
                const product = await Product_1.Product.findById(id).populate('category');
                if (!product) {
                    throw new errors_1.NotFoundError('Product');
                }
                // Cache result
                await this.cacheService.set(cacheKey, product, 3600); // 1 hour
                return product;
            }
            catch (error) {
                span.recordException(error);
                logger_1.logger.error('Failed to get product', { productId: id, error: error.message });
                throw error;
            }
            finally {
                span.end();
            }
        });
    }
    async getProductBySku(sku) {
        return tracing_1.tracer.startActiveSpan('ProductService.getProductBySku', async (span) => {
            span.setAttribute('product.sku', sku);
            try {
                const cacheKey = `product:sku:${sku.toUpperCase()}`;
                // Try cache first
                const cached = await this.cacheService.get(cacheKey);
                if (cached) {
                    logger_1.logger.debug('Product SKU cache hit', { sku });
                    return cached;
                }
                // Fetch from database
                const product = await Product_1.Product.findOne({ sku: sku.toUpperCase() }).populate('category');
                if (!product) {
                    throw new errors_1.NotFoundError('Product');
                }
                // Cache result
                await this.cacheService.set(cacheKey, product, 3600);
                return product;
            }
            catch (error) {
                span.recordException(error);
                logger_1.logger.error('Failed to get product by SKU', { sku, error: error.message });
                throw error;
            }
            finally {
                span.end();
            }
        });
    }
    async updateProduct(id, data) {
        return tracing_1.tracer.startActiveSpan('ProductService.updateProduct', async (span) => {
            span.setAttribute('product.id', id);
            try {
                // Validate category if provided
                if (data.categoryId) {
                    const category = await Product_1.Category.findById(data.categoryId);
                    if (!category) {
                        throw new errors_1.ValidationError('Invalid category ID');
                    }
                }
                // Check SKU uniqueness if updating SKU
                if (data.sku) {
                    const existingProduct = await Product_1.Product.findOne({
                        sku: data.sku.toUpperCase(),
                        _id: { $ne: id }
                    });
                    if (existingProduct) {
                        throw new errors_1.ConflictError(`Product with SKU ${data.sku} already exists`);
                    }
                }
                // Update product
                const updateData = {
                    ...data,
                    ...(data.sku && { sku: data.sku.toUpperCase() }),
                    updatedAt: new Date(),
                };
                const product = await Product_1.Product.findByIdAndUpdate(id, updateData, {
                    new: true,
                    runValidators: true
                }).populate('category');
                if (!product) {
                    throw new errors_1.NotFoundError('Product');
                }
                // Publish event
                await this.eventPublisher.publish('product.updated', {
                    productId: product._id,
                    sku: product.sku,
                    name: product.name,
                    changes: Object.keys(data),
                });
                // Update search index
                await this.searchService.indexProduct(product);
                // Clear caches
                await this.cacheService.delete(`product:${id}`);
                await this.cacheService.delete(`product:sku:${product.sku}`);
                await this.cacheService.invalidateByPattern('products:*');
                logger_1.logger.info('Product updated', {
                    productId: id,
                    sku: product.sku,
                    changes: Object.keys(data),
                });
                return product;
            }
            catch (error) {
                span.recordException(error);
                logger_1.logger.error('Failed to update product', { productId: id, error: error.message });
                throw error;
            }
            finally {
                span.end();
            }
        });
    }
    async deleteProduct(id) {
        return tracing_1.tracer.startActiveSpan('ProductService.deleteProduct', async (span) => {
            span.setAttribute('product.id', id);
            try {
                const product = await Product_1.Product.findByIdAndDelete(id);
                if (!product) {
                    throw new errors_1.NotFoundError('Product');
                }
                // Publish event
                await this.eventPublisher.publish('product.deleted', {
                    productId: product._id,
                    sku: product.sku,
                    name: product.name,
                });
                // Remove from search index
                await this.searchService.deleteProduct(id);
                // Clear caches
                await this.cacheService.delete(`product:${id}`);
                await this.cacheService.delete(`product:sku:${product.sku}`);
                await this.cacheService.invalidateByPattern('products:*');
                logger_1.logger.info('Product deleted', { productId: id, sku: product.sku });
            }
            catch (error) {
                span.recordException(error);
                logger_1.logger.error('Failed to delete product', { productId: id, error: error.message });
                throw error;
            }
            finally {
                span.end();
            }
        });
    }
    async searchProducts(filters, sort = { field: 'createdAt', order: 'desc' }, pagination = {}) {
        return tracing_1.tracer.startActiveSpan('ProductService.searchProducts', async (span) => {
            try {
                // Try search service first (Elasticsearch)
                try {
                    return await this.searchService.searchProducts(filters, sort, pagination);
                }
                catch (searchError) {
                    logger_1.logger.warn('Search service failed, falling back to database', { error: searchError.message });
                }
                // Fallback to database search
                const query = this.buildDatabaseQuery(filters);
                const sortOptions = this.buildDatabaseSort(sort);
                const page = pagination.page || 1;
                const limit = Math.min(pagination.limit || 20, 100);
                const skip = (page - 1) * limit;
                const [products, total] = await Promise.all([
                    Product_1.Product.find(query)
                        .sort(sortOptions)
                        .skip(skip)
                        .limit(limit + 1) // +1 to check if there's next page
                        .populate('category'),
                    Product_1.Product.countDocuments(query),
                ]);
                const hasNext = products.length > limit;
                const resultProducts = hasNext ? products.slice(0, -1) : products;
                return {
                    products: resultProducts,
                    total,
                    hasNext,
                    nextCursor: hasNext ? `${page + 1}` : undefined,
                };
            }
            catch (error) {
                span.recordException(error);
                logger_1.logger.error('Failed to search products', { error: error.message });
                throw error;
            }
            finally {
                span.end();
            }
        });
    }
    buildDatabaseQuery(filters) {
        const query = {};
        if (filters.search) {
            query.$or = [
                { name: new RegExp(filters.search, 'i') },
                { description: new RegExp(filters.search, 'i') },
                { tags: new RegExp(filters.search, 'i') },
            ];
        }
        if (filters.status) {
            query.status = filters.status;
        }
        if (filters.category) {
            query.categoryId = filters.category;
        }
        if (filters.brand) {
            query.brand = filters.brand;
        }
        if (filters.sellerId) {
            query.sellerId = filters.sellerId;
        }
        if (filters.tags && filters.tags.length > 0) {
            query.tags = { $in: filters.tags };
        }
        if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
            query['pricing.basePrice'] = {};
            if (filters.minPrice !== undefined) {
                query['pricing.basePrice'].$gte = filters.minPrice;
            }
            if (filters.maxPrice !== undefined) {
                query['pricing.basePrice'].$lte = filters.maxPrice;
            }
        }
        return query;
    }
    buildDatabaseSort(sort) {
        const sortOptions = {};
        switch (sort.field) {
            case 'name':
                sortOptions.name = sort.order === 'asc' ? 1 : -1;
                break;
            case 'price':
                sortOptions['pricing.basePrice'] = sort.order === 'asc' ? 1 : -1;
                break;
            case 'rating':
                sortOptions.avgRating = sort.order === 'asc' ? 1 : -1;
                break;
            case 'createdAt':
            default:
                sortOptions.createdAt = sort.order === 'asc' ? 1 : -1;
                break;
        }
        return sortOptions;
    }
    async getProductsByCategory(categoryId, pagination = {}) {
        return tracing_1.tracer.startActiveSpan('ProductService.getProductsByCategory', async (span) => {
            span.setAttribute('category.id', categoryId);
            try {
                const cacheKey = `category:${categoryId}:products:${pagination.page || 1}:${pagination.limit || 20}`;
                const cached = await this.cacheService.get(cacheKey);
                if (cached) {
                    return cached;
                }
                const page = pagination.page || 1;
                const limit = Math.min(pagination.limit || 20, 100);
                const skip = (page - 1) * limit;
                const [products, total] = await Promise.all([
                    Product_1.Product.find({ categoryId, status: 'active' })
                        .sort({ createdAt: -1 })
                        .skip(skip)
                        .limit(limit + 1)
                        .populate('category'),
                    Product_1.Product.countDocuments({ categoryId, status: 'active' }),
                ]);
                const hasNext = products.length > limit;
                const result = {
                    products: hasNext ? products.slice(0, -1) : products,
                    total,
                    hasNext,
                };
                await this.cacheService.set(cacheKey, result, 1800); // 30 minutes
                return result;
            }
            catch (error) {
                span.recordException(error);
                logger_1.logger.error('Failed to get products by category', { categoryId, error: error.message });
                throw error;
            }
            finally {
                span.end();
            }
        });
    }
}
exports.ProductService = ProductService;
//# sourceMappingURL=ProductService.js.map