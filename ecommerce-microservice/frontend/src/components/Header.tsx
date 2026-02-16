'use client';

import Link from 'next/link';
import { useAuthStore } from '@/lib/store';
import { ShoppingCart, User, LogOut } from 'lucide-react';
import { useCartStore } from '@/lib/store';

export default function Header() {
  const { isAuthenticated, logout } = useAuthStore();
  const { items } = useCartStore();

  return (
    <header className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link href="/" className="text-xl font-bold text-gray-900">
            ECommerce
          </Link>

          <nav className="flex items-center space-x-4">
            <Link href="/products" className="text-gray-700 hover:text-gray-900">
              Products
            </Link>

            {isAuthenticated ? (
              <>
                <Link href="/cart" className="relative text-gray-700 hover:text-gray-900">
                  <ShoppingCart size={20} />
                  {items.length > 0 && (
                    <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                      {items.length}
                    </span>
                  )}
                </Link>
                <Link href="/profile" className="text-gray-700 hover:text-gray-900">
                  <User size={20} />
                </Link>
                <button onClick={logout} className="text-gray-700 hover:text-gray-900">
                  <LogOut size={20} />
                </button>
              </>
            ) : (
              <>
                <Link href="/login" className="text-gray-700 hover:text-gray-900">
                  Login
                </Link>
                <Link href="/register" className="text-gray-700 hover:text-gray-900">
                  Register
                </Link>
              </>
            )}
          </nav>
        </div>
      </div>
    </header>
  );
}