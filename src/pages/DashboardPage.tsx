import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { Order, Project, Product, DownloadEntitlement, Notification, CreatorApplication } from '../types/platform';
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
  Bell,
  PackageCheck,
  FileCode,
  FolderGit2,
  ExternalLink,
  Check,
} from 'lucide-react';

interface DashboardPageProps {
  onNavigate: (view: string, detailSlug?: string) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ onNavigate }) => {
  const { currentUser, isAuthenticated, isCreator, isAdmin, openAuthModal } = useAuth();
  const [activeTab, setActiveTab] = useState<'orders' | 'content' | 'creator' | 'notifications'>('orders');
  const [orders, setOrders] = useState<Order[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [entitlements, setEntitlements] = useState<DownloadEntitlement[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [creatorApp, setCreatorApp] = useState<CreatorApplication | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [downloadNotice, setDownloadNotice] = useState<string | null>(null);

  const loadDashboardData = async () => {
    if (!isAuthenticated) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const [ordersData, projectsData, prodsData, entsData, notifsData, appData] = await Promise.all([
        api.getOrders().catch(() => []),
        api.getProjects().catch(() => []),
        api.getProducts().catch(() => []),
        api.getEntitlements().catch(() => []),
        api.getNotifications().catch(() => []),
        api.getCreatorApplication().catch(() => null),
      ]);
      setOrders(ordersData);
      setProjects(projectsData);
      setProducts(prodsData);
      setEntitlements(entsData);
      setNotifications(notifsData);
      setCreatorApp(appData);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, [isAuthenticated, currentUser?.id]);

  const handleDownloadByToken = (orderId: string, downloadToken: string) => {
    try {
      setDownloadNotice(`Generiere sicheren Download-Token für ${orderId}...`);
      const a = document.createElement('a');
      a.href = `/api/downloads/file/${encodeURIComponent(downloadToken)}`;
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

  const handleDownloadEntitlement = async (ent: DownloadEntitlement) => {
    try {
      setDownloadNotice(`Generiere 24h Einmal-Token für ${ent.productName}...`);
      const tokenData = await api.getDownloadToken(ent.id);
      const a = document.createElement('a');
      a.href = tokenData.downloadUrl;
      a.download = '';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setDownloadNotice(`Download für ${ent.productName} erfolgreich gestartet.`);
      setTimeout(() => setDownloadNotice(null), 4000);
    } catch (err: any) {
      setDownloadNotice(`Download-Fehler: ${err.message}`);
    }
  };

  const handleMarkNotificationsRead = async () => {
    try {
      await api.markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch (err) {
      console.error('Failed to mark notifications read:', err);
    }
  };

  const myProjects = projects.filter((p) => p.authorId === currentUser?.id);
  const myProducts = products.filter((p) => p.authorId === currentUser?.id);
  const totalSpent = orders.reduce((sum, o) => sum + o.totalAmount, 0);
  const unreadNotifsCount = notifications.filter((n) => !n.read).length;

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

        {/* Quick Launch & Actions */}
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
            <span>Creator Studio</span>
          </button>
          <button
            onClick={() => onNavigate('community')}
            className="px-4 py-2 liquid-glass liquid-glass-hover text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer border border-white/15"
          >
            <Sparkles className="w-4 h-4" />
            <span>Community</span>
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
          <span className="text-2xs text-zinc-400 font-medium">Download-Lizenzen</span>
          <span className="font-mono text-2xl font-bold text-white block">{entitlements.length}</span>
          <span className="text-2xs text-zinc-500">24h Tokens autorisiert</span>
        </div>

        <div className="p-5 liquid-glass rounded-xl border border-white/10 space-y-1">
          <span className="text-2xs text-zinc-400 font-medium">Eigene Projekte &amp; Docs</span>
          <span className="font-mono text-2xl font-bold text-white block">{myProjects.length}</span>
          <span className="text-2xs text-zinc-500">{myProducts.length} Store-Produkte</span>
        </div>

        <div className="p-5 liquid-glass rounded-xl border border-white/10 space-y-1">
          <span className="text-2xs text-zinc-400 font-medium">Plattform-Rolle</span>
          <span className="font-mono text-base font-bold text-white block truncate uppercase">{currentUser.role}</span>
          <span className="text-2xs text-zinc-500">{currentUser.roles?.join(', ') || currentUser.role}</span>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-white/10 pb-3 overflow-x-auto scrollbar-none">
        <button
          onClick={() => setActiveTab('orders')}
          className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'orders' ? 'bg-white text-black' : 'text-zinc-400 hover:text-white'
          }`}
        >
          <ShoppingBag className="w-3.5 h-3.5" />
          <span>Bestellungen &amp; Downloads ({orders.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('content')}
          className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'content' ? 'bg-white text-black' : 'text-zinc-400 hover:text-white'
          }`}
        >
          <FolderGit2 className="w-3.5 h-3.5" />
          <span>Eigene Projekte &amp; Produkte ({myProjects.length + myProducts.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('creator')}
          className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'creator' ? 'bg-white text-black' : 'text-zinc-400 hover:text-white'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Creator-Status</span>
          {creatorApp?.status === 'PENDING' && (
            <span className="w-2 h-2 rounded-full bg-amber-400"></span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('notifications')}
          className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap relative ${
            activeTab === 'notifications' ? 'bg-white text-black' : 'text-zinc-400 hover:text-white'
          }`}
        >
          <Bell className="w-3.5 h-3.5" />
          <span>Benachrichtigungen ({notifications.length})</span>
          {unreadNotifsCount > 0 && (
            <span className="px-1.5 py-0.2 text-3xs font-mono bg-white text-black font-bold rounded-full">
              {unreadNotifsCount}
            </span>
          )}
        </button>
      </div>

      {/* Tab: ORDERS & DOWNLOADS */}
      {activeTab === 'orders' && (
        <div className="space-y-6">
          {/* Entitlements Direct Access Card */}
          {entitlements.length > 0 && (
            <div className="p-6 liquid-glass rounded-2xl border border-white/10 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <PackageCheck className="w-4 h-4 text-emerald-400" />
                  <span>Berechtigte Sofort-Downloads (Lizenzen)</span>
                </h3>
                <span className="text-2xs text-zinc-400 font-mono">{entitlements.length} Produkte verfügbar</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {entitlements.map((ent) => (
                  <div
                    key={ent.id}
                    className="p-4 rounded-xl bg-white/[0.02] border border-white/10 space-y-3 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between text-2xs text-zinc-400 font-mono">
                        <span>{ent.fileFormat}</span>
                        <span>{ent.fileSize || 'Asset'}</span>
                      </div>
                      <h4 className="text-xs font-bold text-white mt-1">{ent.productName}</h4>
                      <span className="text-3xs text-zinc-500 font-mono block mt-0.5">
                        Lizenz erteilt: {new Date(ent.createdAt).toLocaleDateString('de-DE')}
                      </span>
                    </div>

                    <button
                      onClick={() => handleDownloadEntitlement(ent)}
                      className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-white text-black font-semibold text-2xs rounded-lg hover:bg-zinc-200 transition-colors cursor-pointer shadow-sm"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Jetzt herunterladen</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Orders History */}
          <div className="p-6 liquid-glass rounded-2xl border border-white/10 space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4 text-white" />
                  <span>Bestellverlauf</span>
                </h2>
                <p className="text-2xs text-zinc-400 mt-0.5">
                  Alle verifizierten Transaktionen und Belege aus MariaDB.
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
                        <span className="text-emerald-400 font-semibold">
                          {ord.paymentStatus === 'NOT_REQUIRED' ? 'Kostenlos' : ord.paymentStatus === 'PAID' ? 'Bezahlt' : 'Zahlung offen'}
                        </span>
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
                        onClick={() => handleDownloadByToken(ord.id, ord.downloadToken)}
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
        </div>
      )}

      {/* Tab: MY CONTENT (Projects & Products) */}
      {activeTab === 'content' && (
        <div className="p-6 liquid-glass rounded-2xl border border-white/10 space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <FolderGit2 className="w-4 h-4 text-white" />
                <span>Eigene Projekte &amp; Produkte</span>
              </h2>
              <p className="text-2xs text-zinc-400 mt-0.5">
                Veröffentlichte und gespeicherte Arbeiten von @{currentUser.username}.
              </p>
            </div>
            {(isCreator || isAdmin) && (
              <button
                onClick={() => onNavigate('creator')}
                className="px-3 py-1.5 bg-white text-black text-xs font-semibold rounded-lg hover:bg-zinc-200 transition-colors cursor-pointer"
              >
                Im Creator CMS bearbeiten
              </button>
            )}
          </div>

          <div className="space-y-6">
            <div>
              <h3 className="text-xs font-bold text-white mb-3">Portfolio-Projekte ({myProjects.length})</h3>
              {myProjects.length === 0 ? (
                <div className="p-6 text-center text-zinc-500 rounded-xl bg-white/[0.01] border border-white/5 text-xs">
                  Noch keine Projekte veröffentlicht.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {myProjects.map((p) => (
                    <div
                      key={p.id}
                      onClick={() => onNavigate('portfolio', p.slug)}
                      className="p-4 rounded-xl bg-white/[0.02] border border-white/10 hover:border-white/25 cursor-pointer space-y-2 transition-all"
                    >
                      <div className="flex items-center justify-between text-2xs text-zinc-400">
                        <span>{p.category}</span>
                        <span className="font-mono text-zinc-300">{p.status}</span>
                      </div>
                      <h4 className="text-xs font-bold text-white">{p.title}</h4>
                      <p className="text-2xs text-zinc-400 line-clamp-2">{p.shortDesc}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <h3 className="text-xs font-bold text-white mb-3">Store-Produkte ({myProducts.length})</h3>
              {myProducts.length === 0 ? (
                <div className="p-6 text-center text-zinc-500 rounded-xl bg-white/[0.01] border border-white/5 text-xs">
                  Noch keine Produkte angeboten.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {myProducts.map((p) => (
                    <div
                      key={p.id}
                      onClick={() => onNavigate('store', p.slug)}
                      className="p-4 rounded-xl bg-white/[0.02] border border-white/10 hover:border-white/25 cursor-pointer space-y-2 transition-all"
                    >
                      <div className="flex items-center justify-between text-2xs text-zinc-400">
                        <span>{p.category}</span>
                        <span className="font-mono text-emerald-400 font-bold">{p.price.toFixed(2)} €</span>
                      </div>
                      <h4 className="text-xs font-bold text-white">{p.name}</h4>
                      <p className="text-2xs text-zinc-400 line-clamp-2">{p.shortDesc}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab: CREATOR STATUS */}
      {activeTab === 'creator' && (
        <div className="p-6 liquid-glass rounded-2xl border border-white/10 space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-white" />
                <span>Creator-Berechtigungen &amp; Status</span>
              </h2>
              <p className="text-2xs text-zinc-400 mt-0.5">
                Publisher-Rolle und Content Management Workflow.
              </p>
            </div>
          </div>

          {isCreator || isAdmin ? (
            <div className="p-6 rounded-xl bg-emerald-950/30 border border-emerald-800/40 space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-300">
                  <CheckCircle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Vollständiger Creator-Zugriff aktiv</h3>
                  <p className="text-xs text-zinc-400">
                    Du hast die Rolle {currentUser.role} und kannst Projekte, Case Studies, Store-Produkte und Medien direkt verwalten.
                  </p>
                </div>
              </div>

              <button
                onClick={() => onNavigate('creator')}
                className="px-4 py-2 bg-white text-black font-semibold text-xs rounded-lg hover:bg-zinc-200 transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <span>Zum Creator CMS wechseln</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : creatorApp ? (
            <div className="p-6 rounded-xl bg-white/[0.02] border border-white/10 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white">Status deiner Creator-Bewerbung:</span>
                <span
                  className={`px-2.5 py-0.5 text-2xs font-mono font-bold rounded-full ${
                    creatorApp.status === 'APPROVED'
                      ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/40'
                      : creatorApp.status === 'REJECTED'
                      ? 'bg-rose-950/60 text-rose-300 border border-rose-800/40'
                      : 'bg-amber-950/60 text-amber-300 border border-amber-800/40'
                  }`}
                >
                  {creatorApp.status}
                </span>
              </div>

              <div className="text-xs text-zinc-300 space-y-2">
                <div>
                  <span className="text-2xs font-mono text-zinc-400 uppercase tracking-wider block">Motivation:</span>
                  <p className="mt-0.5">{creatorApp.motivation}</p>
                </div>
                <div>
                  <span className="text-2xs font-mono text-zinc-400 uppercase tracking-wider block">Geplante Projekte:</span>
                  <p className="mt-0.5">{creatorApp.plannedProjects}</p>
                </div>
                {creatorApp.adminNotes && (
                  <div className="p-3 rounded-lg bg-white/[0.03] border border-white/5 text-2xs">
                    <span className="font-semibold text-white block">Notiz des Administrators:</span>
                    <p className="text-zinc-300 mt-0.5">{creatorApp.adminNotes}</p>
                  </div>
                )}
              </div>

              <button
                onClick={() => onNavigate('creator')}
                className="px-4 py-2 glass-2 border border-white/15 text-white text-xs font-semibold rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
              >
                Details / Antrag ansehen
              </button>
            </div>
          ) : (
            <div className="p-6 rounded-xl bg-white/[0.02] border border-white/10 space-y-4 text-center">
              <Sparkles className="w-8 h-8 text-zinc-400 mx-auto" />
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-white">Möchtest du eigene Projekte &amp; Vorlagen veröffentlichen?</h3>
                <p className="text-xs text-zinc-400 max-w-md mx-auto">
                  Stelle einen Creator-Antrag, um Zugriff auf das CMS, Medien-Uploads und Produktverwaltung zu erhalten.
                </p>
              </div>
              <button
                onClick={() => onNavigate('creator')}
                className="px-4 py-2 bg-white text-black font-semibold text-xs rounded-lg hover:bg-zinc-200 transition-colors cursor-pointer inline-flex items-center gap-1.5"
              >
                <span>Creator-Antrag stellen</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Tab: NOTIFICATIONS */}
      {activeTab === 'notifications' && (
        <div className="p-6 liquid-glass rounded-2xl border border-white/10 space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Bell className="w-4 h-4 text-white" />
                <span>System-Benachrichtigungen</span>
              </h2>
              <p className="text-2xs text-zinc-400 mt-0.5">
                Echtzeitmeldungen zu Käufen, Rechten und Statusänderungen.
              </p>
            </div>
            {notifications.length > 0 && (
              <button
                onClick={handleMarkNotificationsRead}
                className="text-xs font-semibold text-zinc-400 hover:text-white cursor-pointer"
              >
                Alle als gelesen markieren
              </button>
            )}
          </div>

          {notifications.length === 0 ? (
            <div className="py-8 text-center text-zinc-500">
              <Bell className="w-8 h-8 mx-auto mb-2 text-zinc-600 stroke-[1.5]" />
              <p className="text-xs font-semibold text-zinc-300">Keine neuen Benachrichtigungen</p>
              <p className="text-2xs text-zinc-500 mt-0.5">
                Wichtige Ereignisse werden dir hier angezeigt.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {notifications.map((notif) => (
                <div
                  key={notif.id}
                  className={`p-4 rounded-xl border transition-colors ${
                    notif.read ? 'bg-white/[0.01] border-white/5 text-zinc-400' : 'bg-white/[0.04] border-white/20 text-white'
                  }`}
                >
                  <div className="flex items-center justify-between text-2xs">
                    <span className="font-semibold text-white">{notif.title}</span>
                    <span className="text-zinc-500 font-mono">
                      {new Date(notif.createdAt).toLocaleDateString('de-DE')}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-300 mt-1">{notif.message}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Edit Profile Modal */}
      <ProfileEditModal
        isOpen={isEditProfileOpen}
        onClose={() => setIsEditProfileOpen(false)}
      />
    </div>
  );
};
