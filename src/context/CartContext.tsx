import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../services/api';
import { Product } from '../types/platform';

export interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  fileFormat?: string;
  images?: string[];
  shortDesc?: string;
  slug: string;
}

interface CartContextType {
  items: CartItem[];
  itemCount: number;
  totalAmount: number;
  addToCart: (product: Product, quantity?: number) => Promise<void>;
  updateQuantity: (productId: string, quantity: number) => Promise<void>;
  removeFromCart: (productId: string) => Promise<void>;
  clearCart: () => Promise<void>;
  refreshCart: () => Promise<void>;
  isCartOpen: boolean;
  setIsCartOpen: (open: boolean) => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);

  const loadCart = async () => {
    try {
      const data = await api.getCart();
      const mapped: CartItem[] = data.map((item: any) => ({
        id: item.id,
        name: item.name,
        price: item.price,
        quantity: item.quantity || 1,
        fileFormat: item.fileFormat,
        images: item.images,
        shortDesc: item.shortDesc,
        slug: item.slug,
      }));
      setItems(mapped);
    } catch (e) {
      console.error('Failed to load cart:', e);
    }
  };

  useEffect(() => {
    loadCart();
  }, []);

  const addToCart = async (product: Product, quantity = 1) => {
    try {
      await api.addToCart(product.id, quantity);
      await loadCart();
      setIsCartOpen(true);
    } catch (e) {
      console.error('Failed to add to cart:', e);
      throw e;
    }
  };

  const updateQuantity = async (productId: string, quantity: number) => {
    try {
      await api.updateCartQuantity(productId, quantity);
      await loadCart();
    } catch (e) {
      console.error('Failed to update cart quantity:', e);
      throw e;
    }
  };

  const removeFromCart = async (productId: string) => {
    try {
      await api.removeFromCart(productId);
      await loadCart();
    } catch (e) {
      console.error('Failed to remove from cart:', e);
    }
  };

  const clearCart = async () => {
    try {
      await api.clearCart();
      setItems([]);
    } catch (e) {
      console.error('Failed to clear cart:', e);
    }
  };

  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalAmount = Math.round(items.reduce((sum, item) => sum + item.price * item.quantity, 0) * 100) / 100;

  return (
    <CartContext.Provider
      value={{
        items,
        itemCount,
        totalAmount,
        addToCart,
        updateQuantity,
        removeFromCart,
        clearCart,
        refreshCart: loadCart,
        isCartOpen,
        setIsCartOpen,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used within a CartProvider');
  return context;
};
