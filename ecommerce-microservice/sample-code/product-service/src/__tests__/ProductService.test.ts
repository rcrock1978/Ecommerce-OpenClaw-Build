import { jest } from '@jest/globals';
import { ProductService, CreateProductData, UpdateProductData } from '../services/ProductService';
import { IProduct } from '../models/Product';

// Mock dependencies
const mockEventPublisher = {
  publish: jest.fn(),
};

const mockCacheService = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  clear: jest.fn(),
  invalidateByPattern: jest.fn(),
  delete: jest.fn(),
};

const mockSearchService = {
  indexProduct: jest.fn(),
  updateProduct: jest.fn(),
  deleteProduct: jest.fn(),
  searchProducts: jest.fn(),
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
    startActiveSpan: jest.fn((name: string, fn: (span: any) => any) => fn({
      setAttribute: jest.fn(),
      setAttributes: jest.fn(),
      recordException: jest.fn(),
      end: jest.fn()
    })),
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

      (Product.findOne as any).mockResolvedValue(null); // No existing SKU
      (Product.create as any).mockResolvedValue(mockProduct);
      (Category.findById as any).mockResolvedValue({ _id: '507f1f77bcf86cd799439011', name: 'Test Category' });

      const result = await productService.createProduct(createData);

      expect(Product.findOne).toHaveBeenCalledWith({ sku: 'TEST-SKU' });
      expect(Product.create).toHaveBeenCalled();
      expect(mockEventPublisher.publish).toHaveBeenCalledWith('product.created', expect.any(Object));
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

      (Product.findOne as any).mockResolvedValue({ _id: 'existing', sku: 'EXISTING-SKU' }); // SKU exists

      await expect(productService.createProduct(createData)).rejects.toThrow('Product with SKU EXISTING-SKU already exists');
    });
  });

  // Add more tests as needed
});