import { Client } from '@elastic/elasticsearch';
import { logger } from '../utils/logger';
import { tracer } from '../utils/tracing';
import { config } from '../config/app';
import { IProduct } from '../models/Product';
import { ProductService, ProductFilters, ProductSort, PaginationOptions } from './ProductService';

export class SearchService {
  private client: Client;

  constructor() {
    this.client = new Client({
      node: config.elasticsearch.node,
      auth: config.elasticsearch.auth,
      maxRetries: config.elasticsearch.maxRetries,
      requestTimeout: config.elasticsearch.requestTimeout,
    });
  }

  async indexProduct(product: IProduct): Promise<void> {
    return tracer.startActiveSpan('SearchService.indexProduct', async (span) => {
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

        logger.debug('Product indexed', { productId: product._id.toString() });
      } catch (error) {
        span.recordException(error);
        logger.error('Failed to index product', {
          productId: product._id.toString(),
          error: error.message
        });
        throw error;
      } finally {
        span.end();
      }
    });
  }

  async deleteProduct(productId: string): Promise<void> {
    return tracer.startActiveSpan('SearchService.deleteProduct', async (span) => {
      span.setAttribute('product.id', productId);

      try {
        await this.client.delete({
          index: 'products',
          id: productId,
        });

        logger.debug('Product removed from search', { productId });
      } catch (error) {
        span.recordException(error);
        logger.error('Failed to remove product from search', {
          productId,
          error: error.message
        });
        // Don't throw - search index inconsistencies are not critical
      } finally {
        span.end();
      }
    });
  }

  async searchProducts(
    filters: ProductFilters,
    sort: ProductSort,
    pagination: PaginationOptions
  ): Promise<{ products: IProduct[]; total: number; hasNext: boolean; nextCursor?: string }> {
    return tracer.startActiveSpan('SearchService.searchProducts', async (span) => {
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
        const productResults = products.map((hit: any) => ({
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
      } catch (error) {
        span.recordException(error);
        logger.error('Search query failed', { error: error.message, filters });
        // Fallback to database search would go here
        throw error;
      } finally {
        span.end();
      }
    });
  }

  private buildSearchQuery(filters: ProductFilters): any {
    const must: any[] = [];
    const should: any[] = [];
    const filter: any[] = [];

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
    } else {
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
      const priceRange: any = {};
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

  private buildSortOptions(sort: ProductSort): any[] {
    const sortOptions: any[] = [];

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

  async getSearchSuggestions(query: string, limit: number = 10): Promise<string[]> {
    return tracer.startActiveSpan('SearchService.getSearchSuggestions', async (span) => {
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

        const suggestions = response.body.hits.hits.map((hit: any) => hit._source.name);
        return [...new Set(suggestions)]; // Remove duplicates
      } catch (error) {
        span.recordException(error);
        logger.error('Failed to get search suggestions', { query, error: error.message });
        return [];
      } finally {
        span.end();
      }
    });
  }
}