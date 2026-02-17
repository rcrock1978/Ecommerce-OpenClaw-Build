import { Span } from '@opentelemetry/api';
import { Product, Category, IProduct } from '../models/Product';
import { EventPublisher } from './event-publisher';
import { CacheService } from './cache';
import { SearchService } from './search';
import { logger } from '../utils/logger';
import { tracer } from '../utils/tracing';
import { ValidationError, NotFoundError, ConflictError } from '../utils/errors';

// Interfaces
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

export class ProductService {
  constructor(
    private eventPublisher: EventPublisher,
    private cacheService: CacheService,
    private searchService: SearchService
  ) {}

  async createProduct(data: CreateProductData): Promise<IProduct> {
    return tracer.startActiveSpan('ProductService.createProduct', async (span: Span) => {
      span.setAttributes({
        'product.sku': data.sku,
        'product.name': data.name,
      });

      try {
        // Validate category exists
        const category = await Category.findById(data.categoryId);
        if (!category) {
          throw new ValidationError('Invalid category ID');
        }

        // Check if SKU already exists
        const existingProduct = await Product.findOne({ sku: data.sku.toUpperCase() });
        if (existingProduct) {
          throw new ConflictError(`Product with SKU ${data.sku} already exists`);
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
          status: 'draft' as const,
          avgRating: 0,
          reviewCount: 0,
        };

        // Create product
        const product = await Product.create(productData);

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

        logger.info('Product created', {
          productId: product._id.toString(),
          sku: product.sku,
        });

        span.setAttribute('product.id', product._id.toString());

        return product;
      } catch (error) {
        span.recordException(error as Error);
        logger.error('Failed to create product', {
          sku: data.sku,
          error: (error as Error).message
        });
        throw error;
      } finally {
        span.end();
      }
    });
  }

  async getProductById(id: string): Promise<IProduct> {
    return tracer.startActiveSpan('ProductService.getProductById', async (span: Span) => {
      span.setAttribute('product.id', id);

      try {
        const cacheKey = `product:${id}`;

        // Try cache first
        const cached = await this.cacheService.get<IProduct>(cacheKey);
        if (cached) {
          logger.debug('Product cache hit', { productId: id });
          return cached;
        }

        // Fetch from database
        const product = await Product.findById(id).populate('category');
        if (!product) {
          throw new NotFoundError('Product');
        }

        // Cache result
        await this.cacheService.set(cacheKey, product, 3600); // 1 hour

        return product;
      } catch (error) {
        span.recordException(error as Error);
        logger.error('Failed to get product', { productId: id, error: (error as Error).message });
        throw error;
      } finally {
        span.end();
      }
    });
  }

  async getProductBySku(sku: string): Promise<IProduct> {
    return tracer.startActiveSpan('ProductService.getProductBySku', async (span: Span) => {
      span.setAttribute('product.sku', sku);

      try {
        const cacheKey = `product:sku:${sku.toUpperCase()}`;

        // Try cache first
        const cached = await this.cacheService.get<IProduct>(cacheKey);
        if (cached) {
          logger.debug('Product SKU cache hit', { sku });
          return cached;
        }

        // Fetch from database
        const product = await Product.findOne({ sku: sku.toUpperCase() }).populate('category');
        if (!product) {
          throw new NotFoundError('Product');
        }

        // Cache result
        await this.cacheService.set(cacheKey, product, 3600);

        return product;
      } catch (error) {
        span.recordException(error as Error);
        logger.error('Failed to get product by SKU', { sku, error: (error as Error).message });
        throw error;
      } finally {
        span.end();
      }
    });
  }

  async updateProduct(id: string, data: UpdateProductData): Promise<IProduct> {
    return tracer.startActiveSpan('ProductService.updateProduct', async (span: Span) => {
      span.setAttribute('product.id', id);

      try {
        // Validate category if provided
        if (data.categoryId) {
          const category = await Category.findById(data.categoryId);
          if (!category) {
            throw new ValidationError('Invalid category ID');
          }
        }

        // Check SKU uniqueness if updating SKU
        if (data.sku) {
          const existingProduct = await Product.findOne({
            sku: data.sku.toUpperCase(),
            _id: { $ne: id }
          });
          if (existingProduct) {
            throw new ConflictError(`Product with SKU ${data.sku} already exists`);
          }
        }

        // Update product
        const updateData = {
          ...data,
          ...(data.sku && { sku: data.sku.toUpperCase() }),
          updatedAt: new Date(),
        };

        const product = await Product.findByIdAndUpdate(id, updateData, {
          new: true,
          runValidators: true
        }).populate('category');

        if (!product) {
          throw new NotFoundError('Product');
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

        logger.info('Product updated', {
          productId: id,
          sku: product.sku,
          changes: Object.keys(data),
        });

        return product;
      } catch (error) {
        span.recordException(error as Error);
        logger.error('Failed to update product', { productId: id, error: (error as Error).message });
        throw error;
      } finally {
        span.end();
      }
    });
  }

  async deleteProduct(id: string): Promise<void> {
    return tracer.startActiveSpan('ProductService.deleteProduct', async (span: Span) => {
      span.setAttribute('product.id', id);

      try {
        const product = await Product.findByIdAndDelete(id);
        if (!product) {
          throw new NotFoundError('Product');
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

        logger.info('Product deleted', { productId: id, sku: product.sku });
      } catch (error) {
        span.recordException(error as Error);
        logger.error('Failed to delete product', { productId: id, error: (error as Error).message });
        throw error;
      } finally {
        span.end();
      }
    });
  }

  async searchProducts(
    filters: ProductFilters,
    sort: ProductSort = { field: 'createdAt', order: 'desc' },
    pagination: PaginationOptions = {}
  ): Promise<{ products: IProduct[]; total: number; hasNext: boolean; nextCursor?: string }> {
    return tracer.startActiveSpan('ProductService.searchProducts', async (span: Span) => {
      try {
        // Try search service first (Elasticsearch)
        try {
          return await this.searchService.searchProducts(filters, sort, pagination);
        } catch (searchError) {
          logger.warn('Search service failed, falling back to database', { error: (searchError as Error).message });
        }

        // Fallback to database search
        const query = this.buildDatabaseQuery(filters);
        const sortOptions = this.buildDatabaseSort(sort);

        const page = pagination.page || 1;
        const limit = Math.min(pagination.limit || 20, 100);
        const skip = (page - 1) * limit;

        const [products, total] = await Promise.all([
          Product.find(query)
            .sort(sortOptions)
            .skip(skip)
            .limit(limit + 1) // +1 to check if there's next page
            .populate('category'),
          Product.countDocuments(query),
        ]);

        const hasNext = products.length > limit;
        const resultProducts = hasNext ? products.slice(0, -1) : products;

        return {
          products: resultProducts,
          total,
          hasNext,
          nextCursor: hasNext ? `${page + 1}` : undefined,
        };
      } catch (error) {
        span.recordException(error as Error);
        logger.error('Failed to search products', { error: (error as Error).message });
        throw error;
      } finally {
        span.end();
      }
    });
  }

  private buildDatabaseQuery(filters: ProductFilters): any {
    const query: any = {};

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

  private buildDatabaseSort(sort: ProductSort): any {
    const sortOptions: any = {};

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

  async getProductsByCategory(
    categoryId: string,
    pagination: PaginationOptions = {}
  ): Promise<{ products: IProduct[]; total: number; hasNext: boolean }> {
    return tracer.startActiveSpan('ProductService.getProductsByCategory', async (span: Span) => {
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
          Product.find({ categoryId, status: 'active' })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit + 1)
            .populate('category'),
          Product.countDocuments({ categoryId, status: 'active' }),
        ]);

        const hasNext = products.length > limit;
        const result = {
          products: hasNext ? products.slice(0, -1) : products,
          total,
          hasNext,
        };

        await this.cacheService.set(cacheKey, result, 1800); // 30 minutes

        return result;
      } catch (error) {
        span.recordException(error as Error);
        logger.error('Failed to get products by category', { categoryId, error: (error as Error).message });
        throw error;
      } finally {
        span.end();
      }
    });
  }
}