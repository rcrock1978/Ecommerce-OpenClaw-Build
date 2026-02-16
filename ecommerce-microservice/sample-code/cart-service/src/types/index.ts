export interface CartItem {
  productId: string;
  variantId?: string;
  quantity: number;
  price: number; // current price at time of addition
  addedAt: Date;
}

export interface Cart {
  id: string; // sessionId or userId
  items: CartItem[];
  total: number;
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date; // for anonymous carts
}

export interface CartOperation {
  productId: string;
  variantId?: string;
  quantity: number;
}

export interface MergeCartRequest {
  sessionId: string;
  userId: string;
}