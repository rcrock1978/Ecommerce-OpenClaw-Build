import { getRedisClient } from '../config/redis';
import logger from '../utils/logger';
import { Cart, CartItem, CartOperation } from '../types';

const CART_EXPIRY_SECONDS = 7 * 24 * 60 * 60; // 7 days
const CART_KEY_PREFIX = 'cart:';

export class CartService {
  private redis = getRedisClient();

  async getCart(cartId: string): Promise<Cart | null> {
    try {
      const key = `${CART_KEY_PREFIX}${cartId}`;
      const data = await this.redis.get(key);

      if (!data) return null;

      const cart: Cart = JSON.parse(data);

      // Refresh expiry for anonymous carts
      if (cart.expiresAt) {
        await this.redis.expire(key, CART_EXPIRY_SECONDS);
        cart.expiresAt = new Date(Date.now() + CART_EXPIRY_SECONDS * 1000);
      }

      return cart;
    } catch (error) {
      logger.error('Error getting cart', { cartId, error });
      throw error;
    }
  }

  async createCart(cartId: string, isAnonymous = true): Promise<Cart> {
    const cart: Cart = {
      id: cartId,
      items: [],
      total: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...(isAnonymous && { expiresAt: new Date(Date.now() + CART_EXPIRY_SECONDS * 1000) }),
    };

    await this.saveCart(cart);
    logger.info('Created new cart', { cartId, isAnonymous });
    return cart;
  }

  async addItem(cartId: string, operation: CartOperation): Promise<Cart> {
    let cart = await this.getCart(cartId);
    if (!cart) {
      cart = await this.createCart(cartId);
    }

    const existingItemIndex = cart.items.findIndex(
      (item) => item.productId === operation.productId &&
                item.variantId === operation.variantId
    );

    if (existingItemIndex >= 0) {
      cart.items[existingItemIndex].quantity += operation.quantity;
    } else {
      const newItem: CartItem = {
        productId: operation.productId,
        variantId: operation.variantId,
        quantity: operation.quantity,
        price: 0, // TODO: Fetch from product service
        addedAt: new Date(),
      };
      cart.items.push(newItem);
    }

    cart.total = this.calculateTotal(cart.items);
    cart.updatedAt = new Date();

    await this.saveCart(cart);
    logger.info('Added item to cart', { cartId, operation });
    return cart;
  }

  async updateItem(cartId: string, operation: CartOperation): Promise<Cart> {
    const cart = await this.getCart(cartId);
    if (!cart) {
      throw new Error('Cart not found');
    }

    const itemIndex = cart.items.findIndex(
      (item) => item.productId === operation.productId &&
                item.variantId === operation.variantId
    );

    if (itemIndex === -1) {
      throw new Error('Item not found in cart');
    }

    if (operation.quantity <= 0) {
      cart.items.splice(itemIndex, 1);
    } else {
      cart.items[itemIndex].quantity = operation.quantity;
    }

    cart.total = this.calculateTotal(cart.items);
    cart.updatedAt = new Date();

    await this.saveCart(cart);
    logger.info('Updated item in cart', { cartId, operation });
    return cart;
  }

  async removeItem(cartId: string, productId: string, variantId?: string): Promise<Cart> {
    const cart = await this.getCart(cartId);
    if (!cart) {
      throw new Error('Cart not found');
    }

    cart.items = cart.items.filter(
      (item) => !(item.productId === productId && item.variantId === variantId)
    );

    cart.total = this.calculateTotal(cart.items);
    cart.updatedAt = new Date();

    await this.saveCart(cart);
    logger.info('Removed item from cart', { cartId, productId, variantId });
    return cart;
  }

  async clearCart(cartId: string): Promise<void> {
    const key = `${CART_KEY_PREFIX}${cartId}`;
    await this.redis.del(key);
    logger.info('Cleared cart', { cartId });
  }

  async mergeCarts(sessionId: string, userId: string): Promise<Cart> {
    const sessionCart = await this.getCart(sessionId);
    let userCart = await this.getCart(userId);

    if (!sessionCart) {
      throw new Error('Session cart not found');
    }

    if (!userCart) {
      userCart = await this.createCart(userId, false);
    }

    // Merge items: add quantities for same products
    for (const sessionItem of sessionCart.items) {
      const existingIndex = userCart.items.findIndex(
        (item) => item.productId === sessionItem.productId &&
                  item.variantId === sessionItem.variantId
      );

      if (existingIndex >= 0) {
        userCart.items[existingIndex].quantity += sessionItem.quantity;
      } else {
        userCart.items.push(sessionItem);
      }
    }

    userCart.total = this.calculateTotal(userCart.items);
    userCart.updatedAt = new Date();

    // Save merged cart under userId
    await this.saveCart(userCart);

    // Clear session cart
    await this.clearCart(sessionId);

    logger.info('Merged carts', { sessionId, userId });
    return userCart;
  }

  private async saveCart(cart: Cart): Promise<void> {
    const key = `${CART_KEY_PREFIX}${cart.id}`;
    const data = JSON.stringify(cart);

    if (cart.expiresAt) {
      await this.redis.setEx(key, CART_EXPIRY_SECONDS, data);
    } else {
      await this.redis.set(key, data);
    }
  }

  private calculateTotal(items: CartItem[]): number {
    return items.reduce((total, item) => total + (item.price * item.quantity), 0);
  }
}

export default new CartService();