import React, { useState } from 'react';
import { useCart } from '../context/CartContext';
import { api } from '../services/api';
import { Order } from '../types/platform';
import { X, CheckCircle, Download, CreditCard, ShieldCheck, ArrowRight, Loader2 } from 'lucide-react';

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOrderCompleted?: (order: Order) => void;
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({
  isOpen,
  onClose,
  onOrderCompleted,
}) => {
  const { items, totalAmount, clearCart } = useCart();
  const [isProcessing, setIsProcessing] = useState(false);
  const [completedOrder, setCompletedOrder] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloadNotice, setDownloadNotice] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleDownload = (itemName: string, token: string) => {
    setDownloadNotice(`Download gestartet für "${itemName}" (Token: ${token})`);
    setTimeout(() => setDownloadNotice(null), 3500);
  };

  const handleExecutePayment = async () => {
    setIsProcessing(true);
    setError(null);
    try {
      const order = await api.checkout();
      setCompletedOrder(order);
      await clearCart();
      if (onOrderCompleted) onOrderCompleted(order);
    } catch (e: any) {
      setError(e.message || 'Zahlungsabwicklung fehlgeschlagen');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg bg-[#0c0d11] border border-white/10 rounded-xl p-6 shadow-2xl overflow-hidden">
        {/* Close Button */}
        <button
          onClick={() => {
            setCompletedOrder(null);
            onClose();
          }}
          className="absolute top-4 right-4 text-zinc-400 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {completedOrder ? (
          <div className="text-center py-4 space-y-4">
            <div className="w-12 h-12 bg-white/10 border border-white/20 rounded-full flex items-center justify-center mx-auto text-white">
              <CheckCircle className="w-6 h-6 text-white" />
            </div>

            <div>
              <h3 className="text-lg font-bold text-white">Bestellung erfolgreich abgeschlossen!</h3>
              <p className="text-xs text-zinc-400 mt-1">
                Bestellnummer: <span className="font-mono text-zinc-200">{completedOrder.id}</span>
              </p>
            </div>

            <div className="p-4 liquid-glass rounded-lg text-left space-y-2 border border-white/10">
              <span className="text-2xs font-semibold text-zinc-400 uppercase tracking-wider block">
                Deine digitalen Downloads:
              </span>
              {downloadNotice && (
                <div className="p-2.5 bg-emerald-950/40 border border-emerald-800/40 rounded-lg text-xs text-emerald-300 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 shrink-0 text-emerald-400" />
                  <span>{downloadNotice}</span>
                </div>
              )}
              {completedOrder.items.map((it, idx) => (
                <div key={idx} className="flex items-center justify-between text-xs py-1.5 border-b border-white/5 last:border-0">
                  <span className="text-zinc-200 font-medium">{it.name}</span>
                  <button
                    onClick={() => handleDownload(it.name, completedOrder.downloadToken)}
                    className="flex items-center gap-1.5 px-3 py-1 bg-white hover:bg-zinc-200 text-black font-semibold text-2xs rounded-lg transition-colors cursor-pointer"
                  >
                    <Download className="w-3 h-3" />
                    <span>Herunterladen</span>
                  </button>
                </div>
              ))}
            </div>

            <div className="pt-2 flex justify-center">
              <button
                onClick={() => {
                  setCompletedOrder(null);
                  onClose();
                }}
                className="px-6 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white font-medium text-xs rounded-lg transition-colors"
              >
                Schließen & zum Dashboard
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="flex items-center gap-2.5">
              <CreditCard className="w-5 h-5 text-white" />
              <div>
                <h3 className="text-base font-bold text-white">Kasse & Bestellübersicht</h3>
                <p className="text-xs text-zinc-400">Sichere digitale Transaktion über Backend Fulfillment</p>
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-950/50 border border-red-800/40 text-red-300 text-xs rounded">
                {error}
              </div>
            )}

            {/* Order Items Review */}
            <div className="p-4 liquid-glass rounded-lg space-y-2 max-h-48 overflow-y-auto border border-white/10">
              {items.map((it) => (
                <div key={it.id} className="flex items-center justify-between text-xs">
                  <span className="text-zinc-300">{it.name} × {it.quantity}</span>
                  <span className="font-mono text-zinc-100 font-semibold">
                    {(it.price * it.quantity).toFixed(2)} €
                  </span>
                </div>
              ))}
              <div className="pt-2 border-t border-white/10 flex items-center justify-between text-sm font-bold text-white">
                <span>Gesamt</span>
                <span className="font-mono text-base">{totalAmount.toFixed(2)} €</span>
              </div>
            </div>

            {/* Payment Method Details */}
            <div className="p-3.5 liquid-glass rounded-lg border border-white/10 text-xs space-y-1.5">
              <div className="flex items-center gap-2 text-zinc-300 font-semibold">
                <ShieldCheck className="w-4 h-4 text-white" />
                <span>Entwickler-Testumgebung (Stripe / SEPA Simuliert)</span>
              </div>
              <p className="text-2xs text-zinc-400 leading-relaxed">
                Der Betrag wird über die Server-Schnittstelle autorisiert. Nach Klick auf &quot;Zahlungspflichtig bestellen&quot; werden sofort die digitalen Download-Tokens generiert.
              </p>
            </div>

            {/* Action */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isProcessing}
                className="px-4 py-2 text-xs font-medium text-zinc-400 hover:text-white transition-colors"
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={handleExecutePayment}
                disabled={isProcessing || items.length === 0}
                className="px-5 py-2.5 bg-white hover:bg-zinc-200 disabled:bg-zinc-800 disabled:text-zinc-600 text-black font-bold text-xs rounded-lg transition-colors flex items-center gap-2 cursor-pointer"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Verarbeite Transaktion...</span>
                  </>
                ) : (
                  <>
                    <span>Zahlungspflichtig bestellen ({totalAmount.toFixed(2)} €)</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
