import Image from 'next/image';
import { CartItem as CartItemType } from '@/lib/types';
import { useCartStore } from '@/lib/store';
import { Minus, Plus, Trash2 } from 'lucide-react';

interface CartItemProps {
  item: CartItemType;
}

export default function CartItem({ item }: CartItemProps) {
  const { updateQuantity, removeItem } = useCartStore();

  return (
    <div className="flex items-center space-x-4 p-4 border-b">
      <div className="relative w-16 h-16">
        <Image
          src={item.product.imageUrl}
          alt={item.product.name}
          fill
          className="object-cover rounded"
        />
      </div>
      <div className="flex-1">
        <h3 className="font-semibold text-gray-900">{item.product.name}</h3>
        <p className="text-gray-600">${item.product.price.toFixed(2)}</p>
      </div>
      <div className="flex items-center space-x-2">
        <button
          onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
          disabled={item.quantity <= 1}
          className="p-1 rounded hover:bg-gray-100 disabled:opacity-50"
        >
          <Minus size={16} />
        </button>
        <span className="w-8 text-center">{item.quantity}</span>
        <button
          onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
          className="p-1 rounded hover:bg-gray-100"
        >
          <Plus size={16} />
        </button>
      </div>
      <div className="font-semibold">
        ${(item.product.price * item.quantity).toFixed(2)}
      </div>
      <button
        onClick={() => removeItem(item.product.id)}
        className="p-1 text-red-600 hover:bg-red-50 rounded"
      >
        <Trash2 size={16} />
      </button>
    </div>
  );
}