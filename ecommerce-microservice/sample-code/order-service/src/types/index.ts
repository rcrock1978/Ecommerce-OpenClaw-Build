export interface OrderItem {
  id?: string;
  productId: string;
  variantId?: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface Order {
  id?: string;
  userId: string;
  status: OrderStatus;
  totalAmount: number;
  items: OrderItem[];
  shippingAddress?: Address;
  billingAddress?: Address;
  paymentMethod?: PaymentMethod;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface Address {
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
}

export interface PaymentMethod {
  type: 'credit_card' | 'paypal' | 'bank_transfer';
  details: Record<string, any>;
}

export type OrderStatus =
  | 'created'
  | 'confirmed'
  | 'paid'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'refunded';

export interface CreateOrderRequest {
  userId: string;
  items: OrderItem[];
  shippingAddress: Address;
  billingAddress?: Address;
  paymentMethod: PaymentMethod;
}

export interface UpdateOrderStatusRequest {
  status: OrderStatus;
  notes?: string;
}