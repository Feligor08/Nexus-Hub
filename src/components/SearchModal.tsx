import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Project, Product, Post } from '../types/platform';
import { Search, X, Layers, ShoppingBag, MessageSquare, ArrowRight } from 'lucide-react';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (view: string, detailSlug?: string) => void;
}

export const SearchModal: React.FC<SearchModalProps> = ({ isOpen, onClose, onNavigate }) => {
  const [query, setQuery] = useState('');
  const [projects, setProjects] = useState<Project[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      return;
    }
  }, [isOpen]);

  useEffect(() => {
    if (!query.trim()) {
      setProjects([]);
      setProducts([]);
      setPosts([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const [projRes, prodRes, postRes] = await Promise.all([
          api.getProjects(undefined, query),
          api.getProducts(undefined, query),
          api.getPosts(),
        ]);
        setProjects(projRes);
        setProducts(prodRes);
        setPosts(
          postRes.filter(
            (p) =>
              p.title.toLowerCase().includes(query.toLowerCase()) ||
              p.content.toLowerCase().includes(query.toLowerCase())
          )
        );
      } catch (e) {
        console.error('Search failed:', e);
      } finally {
        setIsLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [query]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-20 bg-black/80 backdrop-blur-md animate-in fade-in duration-150">
      <div className="relative w-full max-w-2xl bg-[#0c0d12] border border-white/10 rounded-xl p-4 shadow-2xl overflow-hidden flex flex-col">
        {/* Search input header */}
        <div className="flex items-center gap-3 pb-3 border-b border-white/10">
          <Search className="w-5 h-5 text-zinc-400 shrink-0" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Globale Suche: Projekte, Produkte, Community, Cheatsheets..."
            className="w-full bg-transparent text-sm text-white placeholder-zinc-500 focus:outline-hidden"
          />
          <button onClick={onClose} className="p-1 text-zinc-400 hover:text-white rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Results Container */}
        <div className="max-h-96 overflow-y-auto py-3 space-y-4 pr-1">
          {isLoading ? (
            <div className="py-8 text-center text-xs text-zinc-500">Suche in Nexus Code Play...</div>
          ) : query && projects.length === 0 && products.length === 0 && posts.length === 0 ? (
            <div className="py-8 text-center text-xs text-zinc-500">
              Keine Treffer für &quot;{query}&quot; gefunden.
            </div>
          ) : !query ? (
            <div className="py-6 text-center text-xs text-zinc-500">
              Tippe einen Begriff ein, z.B. <span className="text-zinc-300">Docker</span>, <span className="text-zinc-300">WPF</span>, <span className="text-zinc-300">8051</span>, oder <span className="text-zinc-300">Gridfinity</span>.
            </div>
          ) : (
            <>
              {/* Projects */}
              {projects.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-2xs font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5 px-2">
                    <Layers className="w-3 h-3" />
                    <span>Portfolio & Projekte ({projects.length})</span>
                  </span>
                  {projects.map((p) => (
                    <div
                      key={p.id}
                      onClick={() => {
                        onClose();
                        onNavigate('portfolio', p.slug);
                      }}
                      className="p-2.5 rounded-lg liquid-glass-hover border border-white/5 flex items-center justify-between cursor-pointer"
                    >
                      <div>
                        <h4 className="text-xs font-semibold text-white">{p.title}</h4>
                        <p className="text-2xs text-zinc-400 mt-0.5 line-clamp-1">{p.shortDesc}</p>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-zinc-500" />
                    </div>
                  ))}
                </div>
              )}

              {/* Products */}
              {products.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-2xs font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5 px-2">
                    <ShoppingBag className="w-3 h-3" />
                    <span>Store & Produkte ({products.length})</span>
                  </span>
                  {products.map((p) => (
                    <div
                      key={p.id}
                      onClick={() => {
                        onClose();
                        onNavigate('store', p.slug);
                      }}
                      className="p-2.5 rounded-lg liquid-glass-hover border border-white/5 flex items-center justify-between cursor-pointer"
                    >
                      <div>
                        <h4 className="text-xs font-semibold text-white">{p.name}</h4>
                        <span className="font-mono text-2xs text-zinc-300 font-bold">{p.price.toFixed(2)} €</span>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-zinc-500" />
                    </div>
                  ))}
                </div>
              )}

              {/* Community Posts */}
              {posts.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-2xs font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5 px-2">
                    <MessageSquare className="w-3 h-3" />
                    <span>Community Beiträge ({posts.length})</span>
                  </span>
                  {posts.map((p) => (
                    <div
                      key={p.id}
                      onClick={() => {
                        onClose();
                        onNavigate('community');
                      }}
                      className="p-2.5 rounded-lg liquid-glass-hover border border-white/5 flex items-center justify-between cursor-pointer"
                    >
                      <div>
                        <h4 className="text-xs font-semibold text-white">{p.title}</h4>
                        <span className="text-2xs text-zinc-400">{p.category} · von {p.authorName}</span>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-zinc-500" />
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
