import React from 'react';
import { useCart } from '../context/CartContext';
import { ShoppingBag, X, Trash2, ArrowRight, Download, Plus, Minus } from 'lucide-react';

interface CartDrawerProps {
  onProceedToCheckout: () => void;
}

export const CartDrawer: React.FC<CartDrawerProps> = ({ onProceedToCheckout }) => {
  const { isCartOpen, setIsCartOpen, items, updateQuantity, removeFromCart, totalAmount, itemCount } = useCart();

  if (!isCartOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-md h-full bg-[#0a0b0e] border-l border-white/10 p-6 flex flex-col justify-between shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2.5">
            <ShoppingBag className="w-5 h-5 text-white" />
            <h2 className="text-base font-semibold text-white">Warenkorb ({itemCount})</h2>
          </div>
          <button
            onClick={() => setIsCartOpen(false)}
            className="p-1.5 text-zinc-400 hover:text-white rounded transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Items List */}
        <div className="flex-1 overflow-y-auto py-4 space-y-3 pr-1">
          {items.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-center p-6 text-zinc-500">
              <ShoppingBag className="w-10 h-10 mb-3 text-zinc-600 stroke-[1.5]" />
              <p className="text-sm font-medium text-zinc-300">Dein Warenkorb ist leer</p>
              <p className="text-xs text-zinc-500 mt-1 max-w-xs">
                Entdecke Vorlagen, 3D-Druck STL-Dateien und Entwickler-Tools im Store.
              </p>
            </div>
          ) : (
            items.map((item) => (
              <div
                key={item.id}
                className="p-3.5 liquid-glass rounded-lg flex items-center justify-between gap-3 border border-white/10"
              >
                <div className="flex-1 min-w-0">
                  <h4 className="text-xs font-semibold text-white truncate">{item.name}</h4>
                  <div className="flex items-center gap-2 text-2xs text-zinc-400 mt-0.5">
                    <span>{item.fileFormat || 'Digital Download'}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono text-zinc-200">
                      {item.price.toFixed(2)} € × {item.quantity}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-md p-0.5">
                    <button
                      onClick={() => updateQuantity(item.id, Math.max(0, item.quantity - 1))}
                      className="p-1 text-zinc-400 hover:text-white rounded hover:bg-white/10 transition-colors cursor-pointer"
                      title="Menge verringern"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="font-mono text-2xs px-1.5 text-white">{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(item.id, item.quantity + 1)}
                      className="p-1 text-zinc-400 hover:text-white rounded hover:bg-white/10 transition-colors cursor-pointer"
                      title="Menge erhöhen"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                  <span className="font-mono text-xs font-bold text-white">
                    {(item.price * item.quantity).toFixed(2)} €
                  </span>
                  <button
                    onClick={() => removeFromCart(item.id)}
                    className="p-1 text-zinc-500 hover:text-red-400 transition-colors cursor-pointer"
                    title="Entfernen"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-white/10 space-y-3 shrink-0">
          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-400">Gesamtbetrag</span>
            <span className="font-mono text-lg font-bold text-white">{totalAmount.toFixed(2)} €</span>
          </div>

          <p className="text-2xs text-zinc-500 flex items-center gap-1">
            <Download className="w-3 h-3 text-zinc-400" />
            <span>Sofortiger digitaler Download nach Kaufabschluss.</span>
          </p>

          <button
            onClick={() => {
              setIsCartOpen(false);
              onProceedToCheckout();
            }}
            disabled={items.length === 0}
            className="w-full py-3 bg-white hover:bg-zinc-200 disabled:bg-zinc-800 disabled:text-zinc-600 text-black font-semibold text-xs rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
          >
            <span>Zur Kasse gehen</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
