import { jest } from '@jest/globals';
import { ProductService, CreateProductData, UpdateProductData } from '../services/ProductService';
import { IProduct } from '../models/Product';

// Mock dependencies
const mockEventPublisher = {
  publishProductCreated: jest.fn(),
  publishProductUpdated: jest.fn(),
  publishProductDeleted: jest.fn(),
};

const mockCacheService = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  clear: jest.fn(),
};

const mockSearchService = {
  indexProduct: jest.fn(),
  updateProduct: jest.fn(),
  deleteProduct: jest.fn(),
  search: jest.fn(),
};

jest.mock('../services/event-publisher');
jest.mock('../services/cache');
jest.mock('../services/search');
jest.mock('../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));
jest.mock('../utils/tracing', () => ({
  tracer: {
    startActiveSpan: jest.fn((name, fn) => fn({ setAttribute: jest.fn() })),
  },
}));

// Mock the Product model
jest.mock('../models/Product', () => ({
  Product: {
    create: jest.fn(),
    findById: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    findByIdAndDelete: jest.fn(),
    countDocuments: jest.fn(),
  },
  Category: {
    findById: jest.fn(),
  },
}));

import { Product, Category } from '../models/Product';

describe('ProductService', () => {
  let productService: ProductService;

  beforeEach(() => {
    jest.clearAllMocks();
    productService = new ProductService(
      mockEventPublisher as any,
      mockCacheService as any,
      mockSearchService as any
    );
  });

  describe('createProduct', () => {
    it('should create a product successfully', async () => {
      const createData: CreateProductData = {
        sku: 'TEST-SKU',
        name: 'Test Product',
        description: 'Test description',
        categoryId: '507f1f77bcf86cd799439011',
        pricing: {
          basePrice: 100,
          currency: 'USD',
        },
        tags: ['test'],
        attributes: { color: 'red' },
      };

      const mockProduct = {
        _id: '507f1f77bcf86cd799439012',
        ...createData,
        slug: 'test-product',
        status: 'draft',
        avgRating: 0,
        reviewCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (Product.create as jest.Mock).mockResolvedValue(mockProduct);
      (Category.findById as jest.Mock).mockResolvedValue({ _id: '507f1f77bcf86cd799439011', name: 'Test Category' });

      const result = await productService.createProduct(createData);

      expect(Product.create).toHaveBeenCalled();
      expect(mockEventPublisher.publishProductCreated).toHaveBeenCalledWith(mockProduct);
      expect(mockSearchService.indexProduct).toHaveBeenCalledWith(mockProduct);
      expect(result).toEqual(mockProduct);
    });

    it('should throw error if SKU already exists', async () => {
      const createData: CreateProductData = {
        sku: 'EXISTING-SKU',
        name: 'Test Product',
        categoryId: '507f1f77bcf86cd799439011',
        pricing: { basePrice: 100 },
      };

      (Product.create as jest.Mock).mockRejectedValue({ code: 11000 }); // Duplicate key error

      await expect(productService.createProduct(createData)).rejects.toThrow('Product with SKU EXISTING-SKU already exists');
    });
  });

  describe('getProductById', () => {
    it('should return product from cache if available', async () => {
      const mockProduct = { _id: '507f1f77bcf86cd799439012', name: 'Test Product' };

      mockCacheService.get.mockResolvedValue(JSON.stringify(mockProduct));

      const result = await productService.getProductById('507f1f77bcf86cd799439012');

      expect(mockCacheService.get).toHaveBeenCalledWith('product:507f1f77bcf86cd799439012');
      expect(result).toEqual(mockProduct);
      expect(Product.findById).not.toHaveBeenCalled();
    });

    it('should fetch from database if not in cache', async () => {
      const mockProduct = {
        _id: '507f1f77bcf86cd799439012',
        name: 'Test Product',
        populate: jest.fn().mockResolvedValue({
          _id: '507f1f77bcf86cd799439012',
          name: 'Test Product',
          category: { name: 'Test Category' },
        }),
      };

      mockCacheService.get.mockResolvedValue(null);
      (Product.findById as jest.Mock).mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockProduct),
      });

      const result = await productService.getProductById('507f1f77bcf86cd799439012');

      expect(Product.findById).toHaveBeenCalledWith('507f1f77bcf86cd799439012');
      expect(mockCacheService.set).toHaveBeenCalled();
      expect(result).toEqual(mockProduct);
    });

    it('should throw NotFoundError if product not found', async () => {
      mockCacheService.get.mockResolvedValue(null);
      (Product.findById as jest.Mock).mockReturnValue({
        populate: jest.fn().mockResolvedValue(null),
      });

      await expect(productService.getProductById('507f1f77bcf86cd799439012')).rejects.toThrow('Product not found');
    });
  });

  describe('getProductBySku', () => {
    it('should return product by SKU', async () => {
      const mockProduct = {
        _id: '507f1f77bcf86cd799439012',
        sku: 'TEST-SKU',
        name: 'Test Product',
        populate: jest.fn().mockResolvedValue({
          _id: '507f1f77bcf86cd799439012',
          sku: 'TEST-SKU',
          name: 'Test Product',
        }),
      };

      (Product.findOne as jest.Mock).mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockProduct),
      });

      const result = await productService.getProductBySku('TEST-SKU');

      expect(Product.findOne).toHaveBeenCalledWith({ sku: 'TEST-SKU', deletedAt: { $exists: false } });
      expect(result).toEqual(mockProduct);
    });
  });

  describe('updateProduct', () => {
    it('should update product successfully', async () => {
      const updateData: UpdateProductData = {
        name: 'Updated Product',
        pricing: { basePrice: 150 },
      };

      const existingProduct = {
        _id: '507f1f77bcf86cd799439012',
        sku: 'TEST-SKU',
        name: 'Test Product',
        save: jest.fn().mockResolvedValue({
          _id: '507f1f77bcf86cd799439012',
          sku: 'TEST-SKU',
          name: 'Updated Product',
          pricing: { basePrice: 150 },
        }),
      };

      (Product.findById as jest.Mock).mockResolvedValue(existingProduct);

      const result = await productService.updateProduct('507f1f77bcf86cd799439012', updateData);

      expect(existingProduct.save).toHaveBeenCalled();
      expect(mockEventPublisher.publishProductUpdated).toHaveBeenCalled();
      expect(mockSearchService.updateProduct).toHaveBeenCalled();
      expect(mockCacheService.del).toHaveBeenCalledWith('product:507f1f77bcf86cd799439012');
      expect(result.name).toBe('Updated Product');
    });
  });

  describe('deleteProduct', () => {
    it('should soft delete product', async () => {
      const mockProduct = {
        _id: '507f1f77bcf86cd799439012',
        sku: 'TEST-SKU',
        deletedAt: null,
        save: jest.fn().mockResolvedValue({
          _id: '507f1f77bcf86cd799439012',
          deletedAt: new Date(),
        }),
      };

      (Product.findById as jest.Mock).mockResolvedValue(mockProduct);

      await productService.deleteProduct('507f1f77bcf86cd799439012');

      expect(mockProduct.save).toHaveBeenCalled();
      expect(mockEventPublisher.publishProductDeleted).toHaveBeenCalled();
      expect(mockSearchService.deleteProduct).toHaveBeenCalledWith('507f1f77bcf86cd799439012');
      expect(mockCacheService.del).toHaveBeenCalledWith('product:507f1f77bcf86cd799439012');
    });
  });

  describe('searchProducts', () => {
    it('should search products using search service', async () => {
      const searchResults = {
        products: [{ _id: '1', name: 'Product 1' }],
        total: 1,
        facets: {},
      };

      mockSearchService.search.mockResolvedValue(searchResults);

      const result = await productService.searchProducts({ query: 'test' });

      expect(mockSearchService.search).toHaveBeenCalledWith({ query: 'test' });
      expect(result).toEqual(searchResults);
    });
  });

  describe('getProductsByCategory', () => {
    it('should return products by category', async () => {
      const mockProducts = [
        { _id: '1', name: 'Product 1', categoryId: 'cat1' },
        { _id: '2', name: 'Product 2', categoryId: 'cat1' },
      ];

      (Product.find as jest.Mock).mockReturnValue({
        populate: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            skip: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue(mockProducts),
            }),
          }),
        }),
      });
      (Product.countDocuments as jest.Mock).mockResolvedValue(2);

      const result = await productService.getProductsByCategory('cat1', { page: 1, limit: 10 });

      expect(Product.find).toHaveBeenCalledWith({
        categoryId: 'cat1',
        status: 'active',
        deletedAt: { $exists: false },
      });
      expect(result.products).toEqual(mockProducts);
      expect(result.total).toBe(2);
    });
  });
});