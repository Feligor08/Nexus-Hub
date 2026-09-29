import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { Project, Product, MediaFile, ContentStatus } from '../types/platform';
import { ProjectEditorModal } from '../components/cms/ProjectEditorModal';
import { ProductEditorModal } from '../components/cms/ProductEditorModal';
import { MediaManagerModal } from '../components/cms/MediaManagerModal';
import {
  Layers,
  ShoppingBag,
  Plus,
  Edit,
  Trash2,
  Eye,
  CheckCircle,
  Clock,
  Archive,
  Image as ImageIcon,
  ArrowUpRight,
  TrendingUp,
  FileText,
  AlertCircle,
  RefreshCw,
  Sparkles,
  Shield,
  LogIn,
} from 'lucide-react';

interface CreatorPageProps {
  onNavigate: (view: string, detailSlug?: string) => void;
}

export const CreatorPage: React.FC<CreatorPageProps> = ({ onNavigate }) => {
  const { currentUser, isAuthenticated, isCreator, isAdmin, switchRole, openAuthModal } = useAuth();

  const [activeTab, setActiveTab] = useState<'overview' | 'projects' | 'products' | 'media' | 'drafts'>('overview');
  const [stats, setStats] = useState<{
    totalProjects: number;
    totalProducts: number;
    totalPosts: number;
    totalMedia: number;
    draftsCount: number;
    publishedCount: number;
    archivedCount: number;
    projects: Project[];
    products: Product[];
  }>({
    totalProjects: 0,
    totalProducts: 0,
    totalPosts: 0,
    totalMedia: 0,
    draftsCount: 0,
    publishedCount: 0,
    archivedCount: 0,
    projects: [],
    products: [],
  });

  const [mediaList, setMediaList] = useState<MediaFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  // Modals
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);

  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const [isMediaModalOpen, setIsMediaModalOpen] = useState(false);

  const loadCmsData = async () => {
    setIsLoading(true);
    try {
      const [cmsStats, media] = await Promise.all([
        api.getCmsStats().catch(() => null),
        api.getMedia(true).catch(() => []),
      ]);

      if (cmsStats) {
        setStats(cmsStats);
      } else {
        // Fallback: load directly
        const [projs, prods] = await Promise.all([
          api.getProjects(undefined, undefined),
          api.getProducts(undefined, undefined, true),
        ]);
        setStats({
          totalProjects: projs.length,
          totalProducts: prods.length,
          totalPosts: 0,
          totalMedia: media.length,
          draftsCount: projs.filter((p) => p.status === 'DRAFT').length + prods.filter((p) => p.status === 'DRAFT').length,
          publishedCount: projs.filter((p) => p.status === 'PUBLISHED').length + prods.filter((p) => p.status === 'PUBLISHED').length,
          archivedCount: projs.filter((p) => p.status === 'ARCHIVED').length + prods.filter((p) => p.status === 'ARCHIVED').length,
          projects: projs,
          products: prods,
        });
      }
      setMediaList(media);
    } catch (err: any) {
      console.error('Failed to load CMS data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      loadCmsData();
    } else {
      setIsLoading(false);
    }
  }, [isAuthenticated, currentUser?.role]);

  const showFeedback = (msg: string) => {
    setFeedbackMsg(msg);
    setTimeout(() => setFeedbackMsg(null), 3500);
  };

  // Actions for Projects
  const handleToggleProjectStatus = async (project: Project, newStatus: ContentStatus) => {
    try {
      await api.updateProjectStatus(project.id, newStatus);
      showFeedback(`Status von "${project.title}" geändert zu ${newStatus}`);
      loadCmsData();
    } catch (err: any) {
      alert(err.message || 'Status-Aktualisierung fehlgeschlagen');
    }
  };

  const handleDeleteProject = async (id: string, title: string) => {
    if (!confirm(`Projekt "${title}" wirklich unwiderruflich löschen?`)) return;
    try {
      await api.deleteProject(id);
      showFeedback(`Projekt "${title}" gelöscht`);
      loadCmsData();
    } catch (err: any) {
      alert(err.message || 'Löschen fehlgeschlagen');
    }
  };

  // Actions for Products
  const handleToggleProductStatus = async (product: Product, newStatus: ContentStatus) => {
    try {
      await api.updateProductStatus(product.id, newStatus);
      showFeedback(`Status von "${product.name}" geändert zu ${newStatus}`);
      loadCmsData();
    } catch (err: any) {
      alert(err.message || 'Status-Aktualisierung fehlgeschlagen');
    }
  };

  const handleDeleteProduct = async (id: string, name: string) => {
    if (!confirm(`Produkt "${name}" wirklich unwiderruflich löschen?`)) return;
    try {
      await api.deleteProduct(id);
      showFeedback(`Produkt "${name}" gelöscht`);
      loadCmsData();
    } catch (err: any) {
      alert(err.message || 'Löschen fehlgeschlagen');
    }
  };

  if (!isAuthenticated || !currentUser) {
    return (
      <div className="max-w-2xl mx-auto py-24 px-4 text-center space-y-6">
        <div className="w-16 h-16 rounded-2xl glass-2 border border-white/10 flex items-center justify-center mx-auto text-zinc-300">
          <Layers className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-white">Content Management System</h1>
          <p className="text-xs text-zinc-400 max-w-md mx-auto">
            Melde dich mit deinem Entwickler- oder Administrator-Account an, um Inhalte zu verwalten,
            Projekte anzulegen und Store-Produkte zu veröffentlichen.
          </p>
        </div>
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            onClick={() => openAuthModal('login')}
            className="px-5 py-2.5 bg-white text-black font-semibold text-xs rounded-xl hover:bg-zinc-200 transition-colors flex items-center gap-2 cursor-pointer shadow-lg"
          >
            <LogIn className="w-4 h-4" />
            <span>Jetzt anmelden</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 space-y-8 animate-in fade-in duration-150">
      {/* Toast Feedback */}
      {feedbackMsg && (
        <div className="p-3.5 bg-emerald-950/40 border border-emerald-800/50 rounded-xl text-xs text-emerald-200 flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-2.5">
            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{feedbackMsg}</span>
          </div>
          <button onClick={() => setFeedbackMsg(null)} className="text-2xs text-emerald-400 hover:text-white">
            Ausblenden
          </button>
        </div>
      )}

      {/* Top Header & Quick Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-white/10">
        <div>
          <div className="flex items-center gap-2 text-2xs font-mono text-zinc-400 uppercase tracking-wider">
            <span>Nexus Content Management</span>
            <span>·</span>
            <span className="text-white font-bold">{currentUser.role} Studio</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white mt-1">
            Creator Dashboard &amp; CMS
          </h1>
          <p className="text-xs text-zinc-400 mt-1 max-w-2xl">
            Verwalte deine persönlichen Projekte, digitalen Store-Vorlagen, Case Studies und Mediendateien direkt in MariaDB ohne Demo-Daten.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => {
              setEditingProject(null);
              setIsProjectModalOpen(true);
            }}
            className="px-4 py-2.5 bg-white text-black font-bold text-xs rounded-xl hover:bg-zinc-200 transition-colors flex items-center gap-2 cursor-pointer shadow-lg"
          >
            <Plus className="w-4 h-4" />
            <span>Neues Projekt</span>
          </button>

          <button
            onClick={() => {
              setEditingProduct(null);
              setIsProductModalOpen(true);
            }}
            className="px-4 py-2.5 glass-2 border border-white/15 text-white font-bold text-xs rounded-xl hover:bg-white/10 transition-colors flex items-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Neues Produkt</span>
          </button>

          <button
            onClick={() => setIsMediaModalOpen(true)}
            className="px-3 py-2.5 glass-2 border border-white/10 text-zinc-300 hover:text-white text-xs font-semibold rounded-xl hover:bg-white/5 transition-colors flex items-center gap-1.5 cursor-pointer"
            title="Medien-Manager"
          >
            <ImageIcon className="w-4 h-4" />
            <span className="hidden sm:inline">Medien</span>
          </button>

          <button
            onClick={loadCmsData}
            className="p-2.5 glass-2 border border-white/10 text-zinc-400 hover:text-white rounded-xl hover:bg-white/5 transition-colors cursor-pointer"
            title="Daten neu laden"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Real MariaDB CMS Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3.5">
        <div className="p-4 liquid-glass rounded-xl border border-white/10 space-y-1">
          <span className="text-2xs font-mono uppercase text-zinc-400">Projekte</span>
          <div className="text-xl sm:text-2xl font-bold font-mono text-white">
            {stats.totalProjects}
          </div>
          <span className="text-3xs text-zinc-500 block">MariaDB Echteinträge</span>
        </div>

        <div className="p-4 liquid-glass rounded-xl border border-white/10 space-y-1">
          <span className="text-2xs font-mono uppercase text-zinc-400">Store-Produkte</span>
          <div className="text-xl sm:text-2xl font-bold font-mono text-white">
            {stats.totalProducts}
          </div>
          <span className="text-3xs text-zinc-500 block">Digital &amp; Physisch</span>
        </div>

        <div className="p-4 liquid-glass rounded-xl border border-white/10 space-y-1">
          <span className="text-2xs font-mono uppercase text-emerald-400">Veröffentlicht</span>
          <div className="text-xl sm:text-2xl font-bold font-mono text-emerald-300">
            {stats.publishedCount}
          </div>
          <span className="text-3xs text-zinc-500 block">Öffentlich sichtbar</span>
        </div>

        <div className="p-4 liquid-glass rounded-xl border border-white/10 space-y-1">
          <span className="text-2xs font-mono uppercase text-amber-400">Entwürfe (Drafts)</span>
          <div className="text-xl sm:text-2xl font-bold font-mono text-amber-300">
            {stats.draftsCount}
          </div>
          <span className="text-3xs text-zinc-500 block">In Bearbeitung</span>
        </div>

        <div className="p-4 liquid-glass rounded-xl border border-white/10 space-y-1">
          <span className="text-2xs font-mono uppercase text-zinc-400">Archiviert</span>
          <div className="text-xl sm:text-2xl font-bold font-mono text-zinc-300">
            {stats.archivedCount}
          </div>
          <span className="text-3xs text-zinc-500 block">Inaktiv</span>
        </div>

        <div className="p-4 liquid-glass rounded-xl border border-white/10 space-y-1">
          <span className="text-2xs font-mono uppercase text-zinc-400">Mediendateien</span>
          <div className="text-xl sm:text-2xl font-bold font-mono text-white">
            {mediaList.length}
          </div>
          <span className="text-3xs text-zinc-500 block">Assets &amp; Covers</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1.5 p-1 liquid-glass rounded-xl border border-white/10 overflow-x-auto scrollbar-none text-xs">
        {[
          { id: 'overview', label: 'Übersicht & Neueste' },
          { id: 'projects', label: `Projekte (${stats.totalProjects})` },
          { id: 'products', label: `Produkte (${stats.totalProducts})` },
          { id: 'drafts', label: `Entwürfe & Archiv (${stats.draftsCount + stats.archivedCount})` },
          { id: 'media', label: `Medienbibliothek (${mediaList.length})` },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id as any)}
            className={`px-3.5 py-2 rounded-lg font-medium transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === t.id
                ? 'bg-white text-black font-semibold shadow-sm'
                : 'text-zinc-400 hover:text-white hover:bg-white/5'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* TAB CONTENT */}

      {/* 1. OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Projects Summary */}
          <div className="p-6 liquid-glass rounded-2xl border border-white/10 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-white" />
                <h3 className="text-sm font-bold text-white">Letzte Projekte</h3>
              </div>
              <button
                onClick={() => setActiveTab('projects')}
                className="text-2xs text-zinc-400 hover:text-white"
              >
                Alle anzeigen →
              </button>
            </div>

            {stats.projects.length === 0 ? (
              <div className="py-12 text-center text-zinc-500 glass-2 rounded-xl border border-white/5 space-y-3">
                <Layers className="w-8 h-8 mx-auto text-zinc-600 stroke-[1.5]" />
                <p className="text-xs font-semibold text-zinc-300">Noch keine Projekte vorhanden.</p>
                <button
                  onClick={() => {
                    setEditingProject(null);
                    setIsProjectModalOpen(true);
                  }}
                  className="px-4 py-2 bg-white text-black text-2xs font-bold rounded-lg hover:bg-zinc-200 cursor-pointer"
                >
                  Erstes Projekt anlegen
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {stats.projects.slice(0, 4).map((p) => (
                  <div
                    key={p.id}
                    className="p-3 bg-white/[0.03] hover:bg-white/[0.06] rounded-xl border border-white/5 flex items-center justify-between transition-colors text-xs"
                  >
                    <div className="space-y-0.5 truncate pr-2">
                      <span className="font-semibold text-white truncate block">{p.title}</span>
                      <span className="text-3xs text-zinc-400 font-mono">
                        {p.category} · {p.techStack.slice(0, 3).join(', ')}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`px-2 py-0.5 rounded text-3xs font-mono font-bold uppercase ${
                          p.status === 'PUBLISHED'
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : p.status === 'ARCHIVED'
                            ? 'bg-zinc-700/30 text-zinc-400'
                            : 'bg-amber-500/20 text-amber-300'
                        }`}
                      >
                        {p.status}
                      </span>
                      <button
                        onClick={() => {
                          setEditingProject(p);
                          setIsProjectModalOpen(true);
                        }}
                        className="p-1 text-zinc-400 hover:text-white"
                        title="Bearbeiten"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Products Summary */}
          <div className="p-6 liquid-glass rounded-2xl border border-white/10 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-white" />
                <h3 className="text-sm font-bold text-white">Letzte Store-Produkte</h3>
              </div>
              <button
                onClick={() => setActiveTab('products')}
                className="text-2xs text-zinc-400 hover:text-white"
              >
                Alle anzeigen →
              </button>
            </div>

            {stats.products.length === 0 ? (
              <div className="py-12 text-center text-zinc-500 glass-2 rounded-xl border border-white/5 space-y-3">
                <ShoppingBag className="w-8 h-8 mx-auto text-zinc-600 stroke-[1.5]" />
                <p className="text-xs font-semibold text-zinc-300">Noch keine Produkte vorhanden.</p>
                <button
                  onClick={() => {
                    setEditingProduct(null);
                    setIsProductModalOpen(true);
                  }}
                  className="px-4 py-2 bg-white text-black text-2xs font-bold rounded-lg hover:bg-zinc-200 cursor-pointer"
                >
                  Erstes Produkt anlegen
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {stats.products.slice(0, 4).map((prod) => (
                  <div
                    key={prod.id}
                    className="p-3 bg-white/[0.03] hover:bg-white/[0.06] rounded-xl border border-white/5 flex items-center justify-between transition-colors text-xs"
                  >
                    <div className="space-y-0.5 truncate pr-2">
                      <span className="font-semibold text-white truncate block">{prod.name}</span>
                      <span className="text-3xs text-zinc-400 font-mono">
                        {prod.category} · {prod.price === 0 ? 'Kostenlos' : `${prod.price.toFixed(2)} €`} · v{prod.version}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`px-2 py-0.5 rounded text-3xs font-mono font-bold uppercase ${
                          prod.status === 'PUBLISHED'
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : prod.status === 'ARCHIVED'
                            ? 'bg-zinc-700/30 text-zinc-400'
                            : 'bg-amber-500/20 text-amber-300'
                        }`}
                      >
                        {prod.status}
                      </span>
                      <button
                        onClick={() => {
                          setEditingProduct(prod);
                          setIsProductModalOpen(true);
                        }}
                        className="p-1 text-zinc-400 hover:text-white"
                        title="Bearbeiten"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2. PROJECTS TAB */}
      {activeTab === 'projects' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white">Alle Projekte im CMS</h3>
            <button
              onClick={() => {
                setEditingProject(null);
                setIsProjectModalOpen(true);
              }}
              className="px-3.5 py-1.5 bg-white text-black font-bold text-xs rounded-xl hover:bg-zinc-200 flex items-center gap-1.5 cursor-pointer shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Neues Projekt</span>
            </button>
          </div>

          {stats.projects.length === 0 ? (
            <div className="py-20 text-center text-zinc-500 liquid-glass rounded-2xl border border-white/10 space-y-3">
              <Layers className="w-12 h-12 mx-auto text-zinc-600 stroke-[1.5]" />
              <p className="text-sm font-semibold text-zinc-300">Noch keine Projekte vorhanden.</p>
              <p className="text-2xs text-zinc-500 max-w-sm mx-auto">
                Lege dein erstes C# / DevOps / ITA-Projekt über den grafischen Editor an.
              </p>
              <button
                onClick={() => {
                  setEditingProject(null);
                  setIsProjectModalOpen(true);
                }}
                className="px-4 py-2 bg-white text-black text-xs font-bold rounded-xl hover:bg-zinc-200 cursor-pointer shadow-md inline-flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>Erstes Projekt anlegen</span>
              </button>
            </div>
          ) : (
            <div className="liquid-glass rounded-2xl border border-white/10 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-zinc-300">
                  <thead className="bg-white/5 border-b border-white/10 text-2xs font-mono uppercase text-zinc-400">
                    <tr>
                      <th className="py-3 px-4">Titel &amp; Slug</th>
                      <th className="py-3 px-4">Kategorie</th>
                      <th className="py-3 px-4">Tech-Stack</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Highlight</th>
                      <th className="py-3 px-4 text-right">Aktionen</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {stats.projects.map((proj) => (
                      <tr key={proj.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="py-3 px-4">
                          <span className="font-bold text-white block">{proj.title}</span>
                          <span className="text-3xs font-mono text-zinc-500">/{proj.slug}</span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-2xs">
                            {proj.category}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex flex-wrap gap-1 max-w-xs">
                            {proj.techStack.slice(0, 3).map((t) => (
                              <span key={t} className="px-1.5 py-0.5 rounded bg-white/5 text-3xs font-mono text-zinc-300">
                                {t}
                              </span>
                            ))}
                            {proj.techStack.length > 3 && (
                              <span className="text-3xs text-zinc-500">+{proj.techStack.length - 3}</span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <select
                            value={proj.status}
                            onChange={(e) => handleToggleProjectStatus(proj, e.target.value as ContentStatus)}
                            className={`px-2 py-1 rounded text-2xs font-mono font-bold uppercase bg-zinc-900 border ${
                              proj.status === 'PUBLISHED'
                                ? 'text-emerald-300 border-emerald-500/30'
                                : proj.status === 'ARCHIVED'
                                ? 'text-zinc-400 border-zinc-600/30'
                                : 'text-amber-300 border-amber-500/30'
                            }`}
                          >
                            <option value="DRAFT">DRAFT</option>
                            <option value="PUBLISHED">PUBLISHED</option>
                            <option value="ARCHIVED">ARCHIVED</option>
                          </select>
                        </td>
                        <td className="py-3 px-4">
                          {proj.featured ? (
                            <span className="text-emerald-400 text-2xs font-bold font-mono">★ JA</span>
                          ) : (
                            <span className="text-zinc-600 text-2xs font-mono">NEIN</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => onNavigate('portfolio', proj.slug)}
                              className="p-1 text-zinc-400 hover:text-white"
                              title="Im Portfolio ansehen"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => {
                                setEditingProject(proj);
                                setIsProjectModalOpen(true);
                              }}
                              className="p-1 text-zinc-400 hover:text-white"
                              title="Bearbeiten"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteProject(proj.id, proj.title)}
                              className="p-1 text-zinc-500 hover:text-rose-400"
                              title="Löschen"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3. PRODUCTS TAB */}
      {activeTab === 'products' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white">Alle Produkte im Store-CMS</h3>
            <button
              onClick={() => {
                setEditingProduct(null);
                setIsProductModalOpen(true);
              }}
              className="px-3.5 py-1.5 bg-white text-black font-bold text-xs rounded-xl hover:bg-zinc-200 flex items-center gap-1.5 cursor-pointer shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Neues Produkt</span>
            </button>
          </div>

          {stats.products.length === 0 ? (
            <div className="py-20 text-center text-zinc-500 liquid-glass rounded-2xl border border-white/10 space-y-3">
              <ShoppingBag className="w-12 h-12 mx-auto text-zinc-600 stroke-[1.5]" />
              <p className="text-sm font-semibold text-zinc-300">Noch keine Produkte vorhanden.</p>
              <p className="text-2xs text-zinc-500 max-w-sm mx-auto">
                Erstelle ein digitales Template, 3D Modell oder Tool mit serverseitigem Download-Token.
              </p>
              <button
                onClick={() => {
                  setEditingProduct(null);
                  setIsProductModalOpen(true);
                }}
                className="px-4 py-2 bg-white text-black text-xs font-bold rounded-xl hover:bg-zinc-200 cursor-pointer shadow-md inline-flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>Erstes Produkt anlegen</span>
              </button>
            </div>
          ) : (
            <div className="liquid-glass rounded-2xl border border-white/10 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-zinc-300">
                  <thead className="bg-white/5 border-b border-white/10 text-2xs font-mono uppercase text-zinc-400">
                    <tr>
                      <th className="py-3 px-4">Produktname</th>
                      <th className="py-3 px-4">Kategorie</th>
                      <th className="py-3 px-4">Preis</th>
                      <th className="py-3 px-4">Format / Version</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Aktionen</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {stats.products.map((prod) => (
                      <tr key={prod.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="py-3 px-4">
                          <span className="font-bold text-white block">{prod.name}</span>
                          <span className="text-3xs font-mono text-zinc-500">/{prod.slug}</span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-2xs">
                            {prod.category}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono font-bold">
                          {prod.price === 0 ? (
                            <span className="text-emerald-400">Kostenlos</span>
                          ) : (
                            <span className="text-white">{prod.price.toFixed(2)} €</span>
                          )}
                        </td>
                        <td className="py-3 px-4 font-mono text-3xs text-zinc-400">
                          {prod.fileFormat} · v{prod.version}
                        </td>
                        <td className="py-3 px-4">
                          <select
                            value={prod.status}
                            onChange={(e) => handleToggleProductStatus(prod, e.target.value as ContentStatus)}
                            className={`px-2 py-1 rounded text-2xs font-mono font-bold uppercase bg-zinc-900 border ${
                              prod.status === 'PUBLISHED'
                                ? 'text-emerald-300 border-emerald-500/30'
                                : prod.status === 'ARCHIVED'
                                ? 'text-zinc-400 border-zinc-600/30'
                                : 'text-amber-300 border-amber-500/30'
                            }`}
                          >
                            <option value="DRAFT">DRAFT</option>
                            <option value="PUBLISHED">PUBLISHED</option>
                            <option value="ARCHIVED">ARCHIVED</option>
                          </select>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => onNavigate('store', prod.slug)}
                              className="p-1 text-zinc-400 hover:text-white"
                              title="Im Store ansehen"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => {
                                setEditingProduct(prod);
                                setIsProductModalOpen(true);
                              }}
                              className="p-1 text-zinc-400 hover:text-white"
                              title="Bearbeiten"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteProduct(prod.id, prod.name)}
                              className="p-1 text-zinc-500 hover:text-rose-400"
                              title="Löschen"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 4. DRAFTS & ARCHIVE TAB */}
      {activeTab === 'drafts' && (
        <div className="space-y-6">
          <div className="p-6 liquid-glass rounded-2xl border border-white/10 space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-400" />
              <span>Entwürfe (DRAFT - Nicht öffentlich)</span>
            </h3>

            {stats.projects.filter((p) => p.status === 'DRAFT').length === 0 &&
            stats.products.filter((p) => p.status === 'DRAFT').length === 0 ? (
              <p className="text-xs text-zinc-500 py-4 text-center">Keine offenen Entwürfe vorhanden.</p>
            ) : (
              <div className="space-y-2">
                {stats.projects
                  .filter((p) => p.status === 'DRAFT')
                  .map((p) => (
                    <div
                      key={p.id}
                      className="p-3 bg-white/5 rounded-xl border border-white/10 flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="font-semibold text-white block">Projekt: {p.title}</span>
                        <span className="text-3xs text-zinc-400 font-mono">Entwurf gespeichert</span>
                      </div>
                      <button
                        onClick={() => {
                          setEditingProject(p);
                          setIsProjectModalOpen(true);
                        }}
                        className="px-3 py-1 bg-white text-black font-semibold text-2xs rounded-lg"
                      >
                        Weiterbearbeiten
                      </button>
                    </div>
                  ))}

                {stats.products
                  .filter((p) => p.status === 'DRAFT')
                  .map((p) => (
                    <div
                      key={p.id}
                      className="p-3 bg-white/5 rounded-xl border border-white/10 flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="font-semibold text-white block">Produkt: {p.name}</span>
                        <span className="text-3xs text-zinc-400 font-mono">Entwurf gespeichert</span>
                      </div>
                      <button
                        onClick={() => {
                          setEditingProduct(p);
                          setIsProductModalOpen(true);
                        }}
                        className="px-3 py-1 bg-white text-black font-semibold text-2xs rounded-lg"
                      >
                        Weiterbearbeiten
                      </button>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 5. MEDIA TAB */}
      {activeTab === 'media' && (
        <div className="p-6 liquid-glass rounded-2xl border border-white/10 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-white">Medienbibliothek</h3>
              <p className="text-2xs text-zinc-400">Assets für Coverbilder, Dokumente und 3D-Modelle</p>
            </div>
            <button
              onClick={() => setIsMediaModalOpen(true)}
              className="px-3.5 py-1.5 bg-white text-black font-bold text-xs rounded-xl hover:bg-zinc-200 cursor-pointer shadow-sm flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Asset hinzufügen</span>
            </button>
          </div>

          {mediaList.length === 0 ? (
            <div className="py-16 text-center text-zinc-500 glass-2 rounded-xl border border-white/5 space-y-2">
              <ImageIcon className="w-10 h-10 mx-auto text-zinc-600 stroke-[1.5]" />
              <p className="text-xs font-semibold text-zinc-300">Keine Mediendateien hochgeladen</p>
              <button
                onClick={() => setIsMediaModalOpen(true)}
                className="px-3 py-1.5 bg-white text-black text-2xs font-semibold rounded-lg hover:bg-zinc-200 cursor-pointer"
              >
                Erstes Asset registrieren
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {mediaList.map((m) => (
                <div key={m.id} className="p-3 bg-white/5 rounded-xl border border-white/10 space-y-2">
                  <div className="h-24 rounded-lg bg-black/40 overflow-hidden flex items-center justify-center">
                    {m.fileCategory === 'image' ? (
                      <img
                        src={m.storagePath}
                        alt={m.filename}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as any).src =
                            '/src/assets/images/nexus_cyberpunk_banner_1790662130550.jpg';
                        }}
                      />
                    ) : (
                      <FileText className="w-8 h-8 text-zinc-400" />
                    )}
                  </div>
                  <span className="text-xs font-semibold text-white block truncate">{m.filename}</span>
                  <span className="text-3xs font-mono text-zinc-500 block uppercase">{m.fileCategory}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MODALS */}
      <ProjectEditorModal
        isOpen={isProjectModalOpen}
        onClose={() => setIsProjectModalOpen(false)}
        initialProject={editingProject}
        onSaved={(saved) => {
          showFeedback(`Projekt "${saved.title}" gespeichert.`);
          loadCmsData();
        }}
      />

      <ProductEditorModal
        isOpen={isProductModalOpen}
        onClose={() => setIsProductModalOpen(false)}
        initialProduct={editingProduct}
        onSaved={(saved) => {
          showFeedback(`Produkt "${saved.name}" gespeichert.`);
          loadCmsData();
        }}
      />

      <MediaManagerModal
        isOpen={isMediaModalOpen}
        onClose={() => {
          setIsMediaModalOpen(false);
          loadCmsData();
        }}
      />
    </div>
  );
};
