import axios from 'axios';
import { User, Product, LoginRequest, RegisterRequest, AuthResponse, Order } from './types';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000';

const api = axios.create({
  baseURL: API_BASE,
});

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auth API
export const authApi = {
  login: async (data: LoginRequest): Promise<AuthResponse> => {
    const response = await axios.post(`${API_BASE}/auth/login`, data);
    return response.data;
  },
  register: async (data: RegisterRequest): Promise<AuthResponse> => {
    const response = await axios.post(`${API_BASE}/auth/register`, data);
    return response.data;
  },
  getProfile: async (): Promise<User> => {
    const response = await api.get('/auth/profile');
    return response.data;
  },
};

// Product API
export const productApi = {
  getAll: async (): Promise<Product[]> => {
    const response = await api.get('/products');
    return response.data;
  },
  getById: async (id: string): Promise<Product> => {
    const response = await api.get(`/products/${id}`);
    return response.data;
  },
  getByCategory: async (category: string): Promise<Product[]> => {
    const response = await api.get(`/products?category=${category}`);
    return response.data;
  },
};

// Payment API
export const paymentApi = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  createOrder: async (orderData: any): Promise<Order> => {
    const response = await api.post('/payments/order', orderData);
    return response.data;
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  processPayment: async (paymentData: any): Promise<any> => {
    const response = await api.post('/payments/process', paymentData);
    return response.data;
  },
};