import { jest } from '@jest/globals';
import { CartService } from '../services/cartService';
import { Cart } from '../types';

// Mock Redis client
var mockRedis: any;

jest.mock('../config/redis', () => {
  mockRedis = {
    get: jest.fn() as any,
    set: jest.fn() as any,
    setEx: jest.fn() as any,
    del: jest.fn() as any,
    expire: jest.fn() as any,
  };
  return {
    getRedisClient: () => mockRedis,
  };
});

describe('CartService', () => {
  let cartService: CartService;

  beforeEach(() => {
    cartService = new CartService();
    jest.clearAllMocks();
  });

  describe('getCart', () => {
    it('should return null if cart not found', async () => {
      mockRedis.get.mockResolvedValue(null);

      const result = await cartService.getCart('cart1');

      expect(result).toBeNull();
      expect(mockRedis.get).toHaveBeenCalledWith('cart:cart1');
    });

    it('should return cart data if found', async () => {
      const cartData: Cart = {
        id: 'cart1',
        items: [],
        total: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt: new Date(),
      };
      mockRedis.get.mockResolvedValue(JSON.stringify(cartData));
      mockRedis.expire.mockResolvedValue(1);

      const result = await cartService.getCart('cart1');

      expect(result).toEqual(expect.objectContaining({ id: 'cart1' }));
      expect(mockRedis.expire).toHaveBeenCalled();
    });
  });

  describe('createCart', () => {
    it('should create and save a new cart', async () => {
      mockRedis.setEx.mockResolvedValue('OK');

      const result = await cartService.createCart('cart1', true);

      expect(result.id).toBe('cart1');
      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.expiresAt).toBeDefined();
      expect(mockRedis.setEx).toHaveBeenCalled();
    });
  });

  describe('addItem', () => {
    it('should add new item to cart', async () => {
      const cartData: Cart = {
        id: 'cart1',
        items: [],
        total: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockRedis.get.mockResolvedValue(JSON.stringify(cartData));
      mockRedis.setEx.mockResolvedValue('OK');

      const operation = { productId: 'prod1', quantity: 2 };
      const result = await cartService.addItem('cart1', operation);

      expect(result.items).toHaveLength(1);
      expect(result.items[0].productId).toBe('prod1');
      expect(result.items[0].quantity).toBe(2);
    });

    it('should increase quantity for existing item', async () => {
      const cartData: Cart = {
        id: 'cart1',
        items: [{ productId: 'prod1', variantId: 'var1', quantity: 1, price: 10, addedAt: new Date() }],
        total: 10,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockRedis.get.mockResolvedValue(JSON.stringify(cartData));
      mockRedis.setEx.mockResolvedValue('OK');

      const operation = { productId: 'prod1', variantId: 'var1', quantity: 3 };
      const result = await cartService.addItem('cart1', operation);

      expect(result.items[0].quantity).toBe(4);
    });
  });

  describe('updateItem', () => {
    it('should update item quantity', async () => {
      const cartData: Cart = {
        id: 'cart1',
        items: [{ productId: 'prod1', quantity: 1, price: 10, addedAt: new Date() }],
        total: 10,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockRedis.get.mockResolvedValue(JSON.stringify(cartData));
      mockRedis.setEx.mockResolvedValue('OK');

      const operation = { productId: 'prod1', quantity: 5 };
      const result = await cartService.updateItem('cart1', operation);

      expect(result.items[0].quantity).toBe(5);
    });

    it('should remove item if quantity is 0', async () => {
      const cartData: Cart = {
        id: 'cart1',
        items: [{ productId: 'prod1', quantity: 2, price: 10, addedAt: new Date() }],
        total: 20,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockRedis.get.mockResolvedValue(JSON.stringify(cartData));
      mockRedis.setEx.mockResolvedValue('OK');

      const operation = { productId: 'prod1', quantity: 0 };
      const result = await cartService.updateItem('cart1', operation);

      expect(result.items).toHaveLength(0);
    });
  });

  describe('mergeCarts', () => {
    it('should merge session cart into user cart', async () => {
      const sessionCart: Cart = {
        id: 'session1',
        items: [{ productId: 'prod1', quantity: 2, price: 10, addedAt: new Date() }],
        total: 20,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const userCart: Cart = {
        id: 'user1',
        items: [{ productId: 'prod2', quantity: 1, price: 15, addedAt: new Date() }],
        total: 15,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockRedis.get.mockImplementation(((key: string) => {
        if (key === 'cart:session1') return Promise.resolve(JSON.stringify(sessionCart));
        if (key === 'cart:user1') return Promise.resolve(JSON.stringify(userCart));
        return Promise.resolve(null);
      }) as any);
      mockRedis.set.mockResolvedValue('OK');
      mockRedis.del.mockResolvedValue(1);

      const result = await cartService.mergeCarts('session1', 'user1');

      expect(result.items).toHaveLength(2);
      expect(result.items.find(i => i.productId === 'prod1')?.quantity).toBe(2);
      expect(result.items.find(i => i.productId === 'prod2')?.quantity).toBe(1);
      expect(mockRedis.del).toHaveBeenCalledWith('cart:session1');
    });
  });
});