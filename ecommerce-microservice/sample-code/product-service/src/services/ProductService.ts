import { Product, Category, IProduct, ICategory } from '../models/Product';
import { logger } from '../utils/logger';
import { tracer } from '../utils/tracing';
import { EventPublisher } from './event-publisher';
import { CacheService } from './cache';
import { SearchService } from './search';
import { ValidationError, NotFoundError, ConflictError } from '../utils/errors';

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
    attributes: Record<string, any>;
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
  category?: string;
  brand?: string;
  minPrice?: number;
  maxPrice?: number;
  tags?: string[];
  status?: 'draft' | 'active' | 'archived';
  sellerId?: string;
  search?: string;
}

export interface ProductSort {
  field: 'name' | 'createdAt' | 'price' | 'rating';
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
    return tracer.startActiveSpan('ProductService.createProduct', async (span) => {
      span.setAttributes({
        'product.sku': data.sku,
        'product.name': data.name,
        'product.category_id': data.categoryId,
      });

      try {
        logger.info('Creating product', {
          sku: data.sku,
          name: data.name,
          categoryId: data.categoryId
        });

        // Validate SKU uniqueness
        const existingProduct = await Product.findOne({ sku: data.sku.toUpperCase() });
        if (existingProduct) {
          throw new ConflictError(`Product with SKU ${data.sku} already exists`);
        }

        // Validate category exists
        const category = await Category.findById(data.categoryId);
        if (!category) {
          throw new NotFoundError('Category not found');
        }

        // Validate variants SKUs don't conflict
        if (data.variants) {
          const variantSkus = data.variants.map(v => v.sku.toUpperCase());
          const existingVariants = await Product.find({
            'variants.sku': { $in: variantSkus }
          });

          if (existingVariants.length > 0) {
            const conflictingSkus = existingVariants.flatMap(p =>
              p.variants.filter(v => variantSkus.includes(v.sku)).map(v => v.sku)
            );
            throw new ConflictError(`Variant SKUs already exist: ${conflictingSkus.join(', ')}`);
          }
        }

        // Create product
        const product = new Product({
          ...data,
          pricing: {
            currency: data.pricing.currency || 'USD',
            ...data.pricing
          },
          images: data.images || [],
          variants: data.variants || [],
          tags: data.tags || [],
          attributes: data.attributes || {},
        });

        const savedProduct = await product.save();

        // Index for search
        await this.searchService.indexProduct(savedProduct);

        // Publish event
        await this.eventPublisher.publish('product.created', {
          productId: savedProduct._id.toString(),
          sku: savedProduct.sku,
          categoryId: savedProduct.categoryId.toString(),
          sellerId: savedProduct.sellerId,
        });

        // Invalidate cache
        await this.cacheService.invalidateByPattern('products:*');

        logger.info('Product created successfully', {
          productId: savedProduct._id.toString(),
          sku: savedProduct.sku
        });

        return savedProduct;
      } catch (error) {
        span.recordException(error);
        logger.error('Failed to create product', {
          sku: data.sku,
          error: error.message
        });
        throw error;
      } finally {
        span.end();
      }
    });
  }

  async getProductById(id: string): Promise<IProduct> {
    return tracer.startActiveSpan('ProductService.getProductById', async (span) => {
      span.setAttribute('product.id', id);

      try {
        // Try cache first
        const cacheKey = `product:${id}`;
        let product = await this.cacheService.get<IProduct>(cacheKey);

        if (!product) {
          product = await Product.findById(id).populate('category');
          if (!product) {
            throw new NotFoundError('Product not found');
          }

          // Cache for 1 hour
          await this.cacheService.set(cacheKey, product, 3600);
        }

        return product;
      } catch (error) {
        span.recordException(error);
        throw error;
      } finally {
        span.end();
      }
    });
  }

  async getProductBySku(sku: string): Promise<IProduct> {
    return tracer.startActiveSpan('ProductService.getProductBySku', async (span) => {
      span.setAttribute('product.sku', sku);

      try {
        const product = await Product.findBySku(sku).populate('category');
        if (!product) {
          throw new NotFoundError('Product not found');
        }

        return product;
      } catch (error) {
        span.recordException(error);
        throw error;
      } finally {
        span.end();
      }
    });
  }

  async updateProduct(id: string, data: UpdateProductData): Promise<IProduct> {
    return tracer.startActiveSpan('ProductService.updateProduct', async (span) => {
      span.setAttributes({
        'product.id': id,
        'product.updates': Object.keys(data).join(',')
      });

      try {
        logger.info('Updating product', { productId: id, updates: Object.keys(data) });

        const product = await Product.findById(id);
        if (!product) {
          throw new NotFoundError('Product not found');
        }

        // Validate SKU uniqueness if changing
        if (data.sku && data.sku.toUpperCase() !== product.sku) {
          const existingProduct = await Product.findOne({
            sku: data.sku.toUpperCase(),
            _id: { $ne: id }
          });
          if (existingProduct) {
            throw new ConflictError(`Product with SKU ${data.sku} already exists`);
          }
        }

        // Update fields
        Object.assign(product, data);
        const updatedProduct = await product.save();

        // Update search index
        await this.searchService.indexProduct(updatedProduct);

        // Publish event
        await this.eventPublisher.publish('product.updated', {
          productId: updatedProduct._id.toString(),
          sku: updatedProduct.sku,
          changes: Object.keys(data),
          updatedAt: updatedProduct.updatedAt
        });

        // Invalidate cache
        await this.cacheService.invalidateByPattern(`product:${id}`);
        await this.cacheService.invalidateByPattern('products:*');

        logger.info('Product updated successfully', {
          productId: id,
          sku: updatedProduct.sku
        });

        return updatedProduct;
      } catch (error) {
        span.recordException(error);
        logger.error('Failed to update product', {
          productId: id,
          error: error.message
        });
        throw error;
      } finally {
        span.end();
      }
    });
  }

  async deleteProduct(id: string): Promise<void> {
    return tracer.startActiveSpan('ProductService.deleteProduct', async (span) => {
      span.setAttribute('product.id', id);

      try {
        logger.info('Deleting product', { productId: id });

        const product = await Product.findById(id);
        if (!product) {
          throw new NotFoundError('Product not found');
        }

        // Soft delete
        product.deletedAt = new Date();
        await product.save();

        // Remove from search index
        await this.searchService.deleteProduct(id);

        // Publish event
        await this.eventPublisher.publish('product.deleted', {
          productId: id,
          sku: product.sku,
          deletedAt: product.deletedAt
        });

        // Invalidate cache
        await this.cacheService.invalidateByPattern(`product:${id}`);
        await this.cacheService.invalidateByPattern('products:*');

        logger.info('Product deleted successfully', {
          productId: id,
          sku: product.sku
        });
      } catch (error) {
        span.recordException(error);
        logger.error('Failed to delete product', {
          productId: id,
          error: error.message
        });
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
    return tracer.startActiveSpan('ProductService.searchProducts', async (span) => {
      try {
        // Use Elasticsearch for complex searches
        if (filters.search || filters.minPrice || filters.maxPrice || filters.tags?.length) {
          return await this.searchService.searchProducts(filters, sort, pagination);
        }

        // Use MongoDB for simple queries
        const query: any = { deletedAt: { $exists: false } };

        if (filters.category) query.categoryId = filters.category;
        if (filters.brand) query.brand = filters.brand;
        if (filters.status) query.status = filters.status;
        if (filters.sellerId) query.sellerId = filters.sellerId;
        if (filters.tags?.length) query.tags = { $in: filters.tags };

        const sortOptions: any = {};
        sortOptions[sort.field] = sort.order === 'desc' ? -1 : 1;

        const limit = Math.min(pagination.limit || 20, 100);
        const skip = pagination.page ? (pagination.page - 1) * limit : 0;

        const [products, total] = await Promise.all([
          Product.find(query)
            .populate('category')
            .sort(sortOptions)
            .skip(skip)
            .limit(limit + 1), // +1 to check if there's next page
          Product.countDocuments(query)
        ]);

        const hasNext = products.length > limit;
        const resultProducts = hasNext ? products.slice(0, -1) : products;

        return {
          products: resultProducts,
          total,
          hasNext,
          nextCursor: hasNext ? `${pagination.page || 1 + 1}` : undefined
        };
      } catch (error) {
        span.recordException(error);
        throw error;
      } finally {
        span.end();
      }
    });
  }

  async getProductsByCategory(
    categoryId: string,
    sort: ProductSort = { field: 'createdAt', order: 'desc' },
    pagination: PaginationOptions = {}
  ): Promise<{ products: IProduct[]; total: number; hasNext: boolean }> {
    return tracer.startActiveSpan('ProductService.getProductsByCategory', async (span) => {
      span.setAttribute('category.id', categoryId);

      try {
        // Get category and all subcategories
        const category = await Category.findById(categoryId);
        if (!category) {
          throw new NotFoundError('Category not found');
        }

        const subcategories = await Category.find({
          path: new RegExp(`^${category.path}`),
          isActive: true
        });

        const categoryIds = [categoryId, ...subcategories.map(c => c._id)];

        const query = {
          categoryId: { $in: categoryIds },
          status: 'active',
          deletedAt: { $exists: false }
        };

        const sortOptions: any = {};
        sortOptions[sort.field] = sort.order === 'desc' ? -1 : 1;

        const limit = Math.min(pagination.limit || 20, 100);
        const skip = pagination.page ? (pagination.page - 1) * limit : 0;

        const [products, total] = await Promise.all([
          Product.find(query)
            .populate('category')
            .sort(sortOptions)
            .skip(skip)
            .limit(limit),
          Product.countDocuments(query)
        ]);

        return {
          products,
          total,
          hasNext: skip + products.length < total
        };
      } catch (error) {
        span.recordException(error);
        throw error;
      } finally {
        span.end();
      }
    });
  }
}