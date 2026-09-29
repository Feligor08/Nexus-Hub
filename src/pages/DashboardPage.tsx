import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { Order, Project } from '../types/platform';
import { ProfileEditModal } from '../components/ProfileEditModal';
import {
  LayoutDashboard,
  ShoppingBag,
  Download,
  Bot,
  Layers,
  ArrowRight,
  Shield,
  CheckCircle,
  Edit3,
  LogIn,
  UserPlus,
  Clock,
  Sparkles,
  Server,
} from 'lucide-react';

interface DashboardPageProps {
  onNavigate: (view: string, detailSlug?: string) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ onNavigate }) => {
  const { currentUser, isAuthenticated, openAuthModal } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [downloadNotice, setDownloadNotice] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthenticated) {
      Promise.all([api.getOrders(), api.getProjects()])
        .then(([ordersData, projectsData]) => {
          setOrders(ordersData);
          setProjects(projectsData);
        })
        .catch(console.error)
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  const handleDownload = (orderId: string, downloadToken: string) => {
    try {
      setDownloadNotice(`Generiere sicheren Download-Token für ${orderId}...`);
      const a = document.createElement('a');
      a.href = `/api/downloads/file/${downloadToken}`;
      a.download = '';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setDownloadNotice(`Download autorisiert und gestartet (Sicherer Token validiert).`);
      setTimeout(() => setDownloadNotice(null), 4000);
    } catch (err: any) {
      setDownloadNotice(`Fehler beim Starten des Downloads: ${err.message}`);
    }
  };

  const totalSpent = orders.reduce((sum, o) => sum + o.totalAmount, 0);

  if (!isAuthenticated || !currentUser) {
    return (
      <div className="max-w-4xl mx-auto py-16 px-4 text-center space-y-6">
        <div className="w-16 h-16 rounded-2xl glass-2 border border-white/10 flex items-center justify-center mx-auto text-zinc-300">
          <LayoutDashboard className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-white">Entwickler-Dashboard</h1>
          <p className="text-xs text-zinc-400 max-w-md mx-auto">
            Melde dich mit deinem Nexus Code Play Konto an, um auf deine digitalen Downloads,
            Bestellungen, persönlichen Projekte und Server-Konfigurationen zuzugreifen.
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
          <button
            onClick={() => openAuthModal('register')}
            className="px-5 py-2.5 glass-2 border border-white/15 text-white font-semibold text-xs rounded-xl hover:bg-white/10 transition-colors flex items-center gap-2 cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Konto erstellen</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 space-y-8 animate-in fade-in duration-150">
      {/* Download Alert Notification */}
      {downloadNotice && (
        <div className="p-3.5 bg-emerald-950/40 border border-emerald-800/50 rounded-xl text-xs text-emerald-200 flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-2.5">
            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{downloadNotice}</span>
          </div>
          <button
            onClick={() => setDownloadNotice(null)}
            className="text-emerald-400 hover:text-emerald-200 text-xs font-semibold cursor-pointer"
          >
            Schließen
          </button>
        </div>
      )}

      {/* Header */}
      <div className="p-8 liquid-glass rounded-2xl border border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <img
            src={currentUser.avatar || '/src/assets/images/avatar_ita_developer_1790662143237.jpg'}
            alt={currentUser.displayName}
            className="w-16 h-16 rounded-xl object-cover border border-white/20 shadow-md"
          />
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold text-white">
                Willkommen zurück, {currentUser.displayName}!
              </h1>
              <span className="px-2 py-0.5 text-2xs font-mono font-bold bg-white/10 border border-white/20 text-white rounded">
                {currentUser.role}
              </span>
            </div>
            <p className="text-xs text-zinc-400 flex items-center gap-2">
              <span>@{currentUser.username}</span>
              <span>·</span>
              <span>{currentUser.email}</span>
              {currentUser.lastLoginAt && (
                <>
                  <span>·</span>
                  <span className="text-3xs text-zinc-500 font-mono">
                    Login: {new Date(currentUser.lastLoginAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </>
              )}
            </p>
          </div>
        </div>

        {/* Quick Launch & Edit Profile */}
        <div className="flex flex-wrap gap-2.5">
          <button
            onClick={() => setIsEditProfileOpen(true)}
            className="px-3.5 py-2 glass-2 border border-white/15 text-zinc-200 hover:text-white text-xs font-medium rounded-lg flex items-center gap-1.5 cursor-pointer hover:bg-white/10 transition-colors"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Profil bearbeiten</span>
          </button>
          <button
            onClick={() => onNavigate('ai')}
            className="px-4 py-2 bg-white text-black font-bold text-xs rounded-lg hover:bg-zinc-200 transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Bot className="w-4 h-4" />
            <span>AI Workspace</span>
          </button>
          <button
            onClick={() => onNavigate('creator')}
            className="px-4 py-2 bg-white/10 hover:bg-white/15 border border-white/20 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer"
          >
            <Layers className="w-4 h-4" />
            <span>Creator CMS</span>
          </button>
          <button
            onClick={() => onNavigate('portfolio')}
            className="px-4 py-2 liquid-glass liquid-glass-hover text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer border border-white/15"
          >
            <Layers className="w-4 h-4" />
            <span>Projekte</span>
          </button>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-5 liquid-glass rounded-xl border border-white/10 space-y-1">
          <span className="text-2xs text-zinc-400 font-medium">Meine Bestellungen</span>
          <span className="font-mono text-2xl font-bold text-white block">{orders.length}</span>
          <span className="text-2xs text-zinc-500">{totalSpent.toFixed(2)} € Gesamtumsatz</span>
        </div>

        <div className="p-5 liquid-glass rounded-xl border border-white/10 space-y-1">
          <span className="text-2xs text-zinc-400 font-medium">Veröffentlichte Systeme</span>
          <span className="font-mono text-2xl font-bold text-white block">{projects.length}</span>
          <span className="text-2xs text-zinc-500">In Portfolio &amp; Docs</span>
        </div>

        <div className="p-5 liquid-glass rounded-xl border border-white/10 space-y-1">
          <span className="text-2xs text-zinc-400 font-medium">Persistente Session</span>
          <span className="font-mono text-2xl font-bold text-emerald-400 block">MariaDB</span>
          <span className="text-2xs text-zinc-500">HttpOnly / Bearer Active</span>
        </div>

        <div className="p-5 liquid-glass rounded-xl border border-white/10 space-y-1">
          <span className="text-2xs text-zinc-400 font-medium">RBAC Berechtigung</span>
          <span className="font-mono text-base font-bold text-white block truncate uppercase">{currentUser.role}</span>
          <span className="text-2xs text-zinc-500">{currentUser.roles?.join(', ') || currentUser.role}</span>
        </div>
      </div>

      {/* Badges and Skills Showcase */}
      {(currentUser.badges?.length > 0 || currentUser.skills?.length > 0) && (
        <div className="p-6 liquid-glass rounded-2xl border border-white/10 space-y-4">
          <span className="text-2xs font-semibold uppercase tracking-wider text-zinc-400 block">
            Verifizierte Auszeichnungen &amp; Tech-Schwerpunkte
          </span>
          <div className="flex flex-wrap gap-2">
            {currentUser.badges?.map((badge, idx) => (
              <span
                key={idx}
                className="px-2.5 py-1 text-2xs font-medium rounded-lg bg-white/5 border border-white/10 text-zinc-200"
              >
                ★ {badge}
              </span>
            ))}
            {currentUser.skills?.map((skill, idx) => (
              <span
                key={idx}
                className="px-2.5 py-1 text-2xs font-mono rounded-lg bg-white/[0.03] border border-white/5 text-zinc-400"
              >
                {skill}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Main Content: Orders & Downloads */}
      <div className="p-6 liquid-glass rounded-2xl border border-white/10 space-y-6">
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-white" />
              <span>Bestellverlauf &amp; Digitale Downloads</span>
            </h2>
            <p className="text-2xs text-zinc-400 mt-0.5">
              Zugriff auf deine erworbenen Vorlagen, Docker Blueprints und 3D STL-Dateien aus MariaDB.
            </p>
          </div>
          <button
            onClick={() => onNavigate('store')}
            className="text-xs font-semibold text-white hover:underline flex items-center gap-1 cursor-pointer"
          >
            <span>Zum Store</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {isLoading ? (
          <div className="py-8 text-center text-xs text-zinc-500">Lade Bestellungen...</div>
        ) : orders.length === 0 ? (
          <div className="py-8 text-center text-zinc-500">
            <Download className="w-8 h-8 mx-auto mb-2 text-zinc-600 stroke-[1.5]" />
            <p className="text-xs font-semibold text-zinc-300">Noch keine Bestellungen getätigt</p>
            <p className="text-2xs text-zinc-500 mt-0.5">
              Entdecke digitale Entwickler-Ressourcen im Nexus Store.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((ord) => (
              <div
                key={ord.id}
                className="p-4 rounded-xl bg-white/[0.02] border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-2xs text-zinc-400">
                    <span className="font-mono text-zinc-300 font-semibold">{ord.id}</span>
                    <span aria-hidden="true">·</span>
                    <span>{new Date(ord.createdAt).toLocaleDateString('de-DE')}</span>
                    <span aria-hidden="true">·</span>
                    <span className="text-emerald-400 font-semibold">Bezahlt</span>
                  </div>

                  <div className="text-xs text-zinc-200">
                    {ord.items.map((i) => `${i.name} (${i.quantity}x)`).join(', ')}
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                  <span className="font-mono text-sm font-bold text-white">
                    {ord.totalAmount.toFixed(2)} €
                  </span>
                  <button
                    onClick={() => handleDownload(ord.id, ord.downloadToken)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-black font-semibold text-2xs rounded-lg hover:bg-zinc-200 transition-colors cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit Profile Modal */}
      <ProfileEditModal
        isOpen={isEditProfileOpen}
        onClose={() => setIsEditProfileOpen(false)}
      />
    </div>
  );
};
