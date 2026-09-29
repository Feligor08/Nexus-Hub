import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Product } from '../types/platform';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import {
  ShoppingBag,
  Search,
  Star,
  Download,
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  FileCode,
  ShieldCheck,
  Gift,
} from 'lucide-react';

interface StorePageProps {
  selectedSlug?: string;
  onNavigateToProduct?: (slug: string) => void;
  onBack?: () => void;
}

export const StorePage: React.FC<StorePageProps> = ({
  selectedSlug,
  onNavigateToProduct,
  onBack,
}) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeProduct, setActiveProduct] = useState<Product | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [claimStatus, setClaimStatus] = useState<string | null>(null);
  const { addToCart, setIsCartOpen } = useCart();
  const { isAuthenticated, openAuthModal } = useAuth();

  useEffect(() => {
    setIsLoading(true);
    api.getProducts()
      .then((data) => {
        setProducts(data);
        if (selectedSlug) {
          const found = data.find((p) => p.slug === selectedSlug);
          if (found) setActiveProduct(found);
        } else {
          setActiveProduct(null);
        }
      })
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, [selectedSlug]);

  const handleClaimFree = async (product: Product) => {
    if (!isAuthenticated) {
      openAuthModal('login');
      return;
    }

    try {
      setClaimStatus(`Schalte ${product.name} kostenlos frei...`);
      const res = await api.claimFreeProduct(product.id);
      setClaimStatus(`Erfolgreich freigeschaltet! Starte sicheren Download...`);

      // Initiate download with the generated token
      const a = document.createElement('a');
      a.href = `/api/downloads/file/${res.downloadToken}`;
      a.download = '';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      setTimeout(() => setClaimStatus(null), 4000);
    } catch (err: any) {
      setClaimStatus(`Fehler beim Freischalten: ${err.message}`);
    }
  };

  const categories = [
    { id: 'all', label: 'Alle Produkte' },
    { id: 'Templates', label: 'WPF & C# Templates' },
    { id: 'Developer Tools', label: 'Docker & DevOps' },
    { id: '3D Models & STL', label: '3D-Druck STL & Bambu' },
    { id: 'Tutorials', label: 'ITA Kompendien' },
  ];

  const filtered = products.filter((p) => {
    const matchesCat = selectedCategory === 'all' || p.category === selectedCategory;
    const matchesSearch =
      !searchQuery ||
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.shortDesc.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  // PRODUCT DETAIL VIEW
  if (activeProduct) {
    return (
      <div className="max-w-5xl mx-auto py-8 px-4 sm:px-6 space-y-8 animate-in fade-in duration-150">
        <button
          onClick={() => {
            setActiveProduct(null);
            if (onBack) onBack();
          }}
          className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-400 hover:text-white transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Zurück zum Store</span>
        </button>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Main Info (2 cols) */}
          <div className="md:col-span-2 space-y-6">
            <div className="p-8 liquid-glass rounded-2xl border border-white/10 space-y-4">
              <div className="flex items-center justify-between text-2xs text-zinc-400">
                <span>{activeProduct.category}</span>
                <div className="flex items-center gap-1 text-zinc-300">
                  <Star className="w-3.5 h-3.5 fill-white text-white" />
                  <span className="font-bold">{activeProduct.rating}</span>
                  <span className="text-zinc-500">({activeProduct.reviewsCount} Bewertungen)</span>
                </div>
              </div>

              <h1 className="text-2xl sm:text-3xl font-extrabold text-white">{activeProduct.name}</h1>
              <p className="text-sm text-zinc-300 leading-relaxed">{activeProduct.description}</p>
            </div>

            {/* Technical Specs */}
            <div className="p-6 liquid-glass rounded-xl border border-white/10 space-y-4">
              <h3 className="text-sm font-bold text-white">Technische Spezifikationen &amp; Lizenz</h3>
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-2xs text-zinc-500 block">Dateiformat</span>
                  <span className="text-zinc-200 font-mono">{activeProduct.fileFormat}</span>
                </div>
                <div>
                  <span className="text-2xs text-zinc-500 block">Dateigröße</span>
                  <span className="text-zinc-200 font-mono">{activeProduct.fileSize}</span>
                </div>
                <div>
                  <span className="text-2xs text-zinc-500 block">Version</span>
                  <span className="text-zinc-200 font-mono">v{activeProduct.version}</span>
                </div>
                <div>
                  <span className="text-2xs text-zinc-500 block">Lizenzmodell</span>
                  <span className="text-zinc-200">{activeProduct.license}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Checkout Card (1 col) */}
          <div className="space-y-4">
            {claimStatus && (
              <div className="p-3.5 bg-emerald-950/40 border border-emerald-800/50 rounded-xl text-xs text-emerald-200 flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{claimStatus}</span>
              </div>
            )}

            <div className="p-6 liquid-glass rounded-2xl border border-white/10 space-y-5 sticky top-24">
              <div>
                <span className="text-2xs text-zinc-400 block">Kaufpreis</span>
                <span className="font-mono text-3xl font-extrabold text-white">
                  {activeProduct.price === 0 ? 'Kostenlos' : `${activeProduct.price.toFixed(2)} €`}
                </span>
              </div>

              <div className="space-y-2.5 pt-2 border-t border-white/10 text-2xs text-zinc-400">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-3.5 h-3.5 text-white" />
                  <span>
                    {activeProduct.price === 0
                      ? 'Direkter Download-Token ohne Bezahlung'
                      : 'Sofortiger digitaler Download nach Kauf'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-3.5 h-3.5 text-white" />
                  <span>Lebenslanger Zugriff auf Updates</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-3.5 h-3.5 text-white" />
                  <span>Geprüft &amp; malware-frei</span>
                </div>
              </div>

              <div className="space-y-2 pt-2">
                {activeProduct.price === 0 ? (
                  <button
                    onClick={() => handleClaimFree(activeProduct)}
                    className="w-full py-3 bg-white hover:bg-zinc-200 text-black font-bold text-xs rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-lg"
                  >
                    <Download className="w-4 h-4" />
                    <span>Kostenlos beanspruchen &amp; herunterladen</span>
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => addToCart(activeProduct, 1)}
                      className="w-full py-3 bg-white hover:bg-zinc-200 text-black font-bold text-xs rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <ShoppingBag className="w-4 h-4" />
                      <span>In den Warenkorb</span>
                    </button>
                    <button
                      onClick={async () => {
                        await addToCart(activeProduct, 1);
                        setIsCartOpen(true);
                      }}
                      className="w-full py-2.5 liquid-glass-button text-xs font-semibold rounded-lg cursor-pointer"
                    >
                      Direkt zur Kasse
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // STORE OVERVIEW
  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-white/10">
        <div>
          <span className="text-2xs font-semibold uppercase tracking-wider text-zinc-400">Digitaler Marktplatz</span>
          <h1 className="text-xl sm:text-2xl font-bold text-white">Nexus Store &amp; Ressourcen</h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Professionelle Templates, Docker-Compose Bundles, 3D STL-Dateien und Prüfungskompendien.
          </p>
        </div>

        {/* Search */}
        <div className="relative w-full md:w-64">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Produkte durchsuchen..."
            className="w-full pl-9 pr-3 py-1.5 text-xs liquid-glass-input rounded-lg"
          />
        </div>
      </div>

      {/* Category Filter */}
      <div className="flex items-center gap-1.5 p-1 liquid-glass rounded-xl overflow-x-auto scrollbar-none border border-white/10">
        {categories.map((c) => (
          <button
            key={c.id}
            onClick={() => setSelectedCategory(c.id)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
              selectedCategory === c.id
                ? 'bg-white text-black font-semibold'
                : 'text-zinc-400 hover:text-white hover:bg-white/5'
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Products Grid */}
      {isLoading ? (
        <div className="py-16 text-center text-xs text-zinc-500">Lade Store-Produkte...</div>
      ) : filtered.length === 0 ? (
        <div className="py-20 text-center text-zinc-500 liquid-glass rounded-2xl border border-white/10 space-y-3">
          <ShoppingBag className="w-12 h-12 mx-auto text-zinc-600 stroke-[1.5]" />
          <p className="text-base font-semibold text-white">
            {products.length === 0 ? 'Noch keine Produkte vorhanden.' : 'Keine Produkte für diesen Filter gefunden.'}
          </p>
          <p className="text-xs text-zinc-400 max-w-sm mx-auto">
            {products.length === 0
              ? 'Es wurden noch keine digitalen Produkte im Store veröffentlicht. Nutze das Creator CMS Studio, um dein erstes Template oder 3D Modell anzulegen.'
              : 'Passe deine Filtersuche oder Kategorieauswahl an.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((prod) => (
            <div
              key={prod.id}
              className="p-6 liquid-glass liquid-glass-hover rounded-xl border border-white/10 flex flex-col justify-between space-y-4"
            >
              <div
                onClick={() => {
                  setActiveProduct(prod);
                  if (onNavigateToProduct) onNavigateToProduct(prod.slug);
                }}
                className="cursor-pointer space-y-3"
              >
                <div className="flex items-center justify-between text-2xs text-zinc-400">
                  <span>{prod.category}</span>
                  <div className="flex items-center gap-1 text-zinc-200">
                    <Star className="w-3 h-3 fill-white text-white" />
                    <span className="font-bold">{prod.rating}</span>
                  </div>
                </div>

                <h3 className="text-base font-bold text-white leading-snug">{prod.name}</h3>
                <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed">{prod.shortDesc}</p>
              </div>

              <div className="space-y-3 pt-3 border-t border-white/10">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-2xs text-zinc-500">{prod.fileFormat}</span>
                  <span className="font-mono text-base font-bold text-white">
                    {prod.price === 0 ? (
                      <span className="text-emerald-400 font-bold">Kostenlos</span>
                    ) : (
                      `${prod.price.toFixed(2)} €`
                    )}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setActiveProduct(prod);
                      if (onNavigateToProduct) onNavigateToProduct(prod.slug);
                    }}
                    className="flex-1 py-2 liquid-glass-button text-2xs font-semibold rounded-lg cursor-pointer"
                  >
                    Details
                  </button>

                  {prod.price === 0 ? (
                    <button
                      onClick={() => handleClaimFree(prod)}
                      className="flex-1 py-2 bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-2xs rounded-lg transition-colors flex items-center justify-center gap-1 cursor-pointer shadow-sm"
                      title="Kostenlos beanspruchen & herunterladen"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Kostenlos</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => addToCart(prod, 1)}
                      className="flex-1 py-2 bg-white hover:bg-zinc-200 text-black font-bold text-2xs rounded-lg transition-colors flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <ShoppingBag className="w-3.5 h-3.5" />
                      <span>In den Korb</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
