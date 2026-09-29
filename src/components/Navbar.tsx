import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { api } from '../services/api';
import { Notification } from '../types/platform';
import {
  Cpu,
  Search,
  ShoppingBag,
  Bell,
  User as UserIcon,
  Shield,
  LayoutDashboard,
  LogOut,
  ChevronDown,
  Menu,
  X,
  LogIn,
  UserPlus,
  Layers,
} from 'lucide-react';

interface NavbarProps {
  currentView: string;
  onNavigate: (view: string, detailSlug?: string) => void;
  onOpenSearch: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentView, onNavigate, onOpenSearch }) => {
  const { currentUser, isAuthenticated, logout, isAdmin, isCreator, openAuthModal } = useAuth();
  const { itemCount, setIsCartOpen } = useCart();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      api.getNotifications().then(setNotifications).catch(() => {});
    }

    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isAuthenticated]);

  const unreadNotifs = notifications.filter((n) => !n.read).length;

  const handleMarkAllRead = async () => {
    await api.markAllNotificationsRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const navLinks = [
    { id: 'home', label: 'Home' },
    { id: 'ai', label: 'AI Workspace' },
    { id: 'portfolio', label: 'Portfolio' },
    { id: 'store', label: 'Store' },
    { id: 'community', label: 'Community' },
  ];

  const handleMobileNav = (view: string) => {
    setIsMobileMenuOpen(false);
    onNavigate(view);
  };

  const handleLogout = async () => {
    setIsUserMenuOpen(false);
    await logout();
    onNavigate('home');
  };

  return (
    <>
      <header
        className={`h-16 px-4 sm:px-8 sticky top-0 z-40 flex items-center justify-between transition-all duration-200 ${
          isScrolled
            ? 'glass-2 border-b border-white/10'
            : 'bg-[#060709]/80 backdrop-blur-md border-b border-white/5'
        }`}
      >
        {/* Left: Brand Zone */}
        <div className="flex items-center gap-8">
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              onNavigate('home');
            }}
            className="flex items-center gap-2.5 text-white font-semibold text-sm tracking-tight hover:opacity-90 transition-opacity"
          >
            <div className="w-7 h-7 rounded-lg bg-white/10 border border-white/15 flex items-center justify-center text-white">
              <Cpu className="w-3.5 h-3.5" />
            </div>
            <span className="font-semibold tracking-wide">Nexus Code Play</span>
          </a>

          {/* Desktop Nav Links */}
          <nav className="hidden lg:flex items-center gap-6 text-xs font-medium text-zinc-400">
            {navLinks.map((link) => (
              <button
                key={link.id}
                onClick={() => onNavigate(link.id)}
                className={`transition-colors whitespace-nowrap cursor-pointer py-1 relative ${
                  currentView === link.id ? 'text-white font-semibold' : 'hover:text-zinc-200'
                }`}
              >
                {link.label}
                {currentView === link.id && (
                  <span className="absolute bottom-0 left-0 right-0 h-[1.5px] bg-white rounded-full"></span>
                )}
              </button>
            ))}
            {(isCreator || isAdmin) && (
              <button
                onClick={() => onNavigate('creator')}
                className={`flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer py-1 ${
                  currentView === 'creator' || currentView === 'manage' ? 'text-white font-bold' : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>CMS Studio</span>
              </button>
            )}
            {isAdmin && (
              <button
                onClick={() => onNavigate('admin')}
                className={`flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer py-1 ${
                  currentView === 'admin' ? 'text-white font-bold' : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Shield className="w-3.5 h-3.5" />
                <span>Admin</span>
              </button>
            )}
          </nav>
        </div>

        {/* Right: Global Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Search Trigger */}
          <button
            onClick={onOpenSearch}
            className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-zinc-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
            title="Globale Suche"
            aria-label="Suche öffnen"
          >
            <Search className="w-4 h-4" />
          </button>

          {/* Notifications Popover (Authenticated only) */}
          {isAuthenticated && (
            <div className="relative">
              <button
                onClick={() => setIsNotifOpen(!isNotifOpen)}
                className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-zinc-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors cursor-pointer relative"
                title="Benachrichtigungen"
                aria-label="Benachrichtigungen"
              >
                <Bell className="w-4 h-4" />
                {unreadNotifs > 0 && (
                  <span className="absolute top-2.5 right-2.5 w-1.5 h-1.5 rounded-full bg-white ring-2 ring-black"></span>
                )}
              </button>

              {isNotifOpen && (
                <div className="absolute right-0 mt-2 w-80 glass-3 rounded-xl p-3 z-50 animate-in fade-in duration-100 shadow-2xl border border-white/10">
                  <div className="flex items-center justify-between pb-2 border-b border-white/10 mb-2">
                    <span className="text-xs font-semibold text-white">Mitteilungen</span>
                    {unreadNotifs > 0 && (
                      <button
                        onClick={handleMarkAllRead}
                        className="text-2xs text-zinc-400 hover:text-white cursor-pointer"
                      >
                        Alle gelesen
                      </button>
                    )}
                  </div>
                  <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                    {notifications.length === 0 ? (
                      <p className="text-xs text-zinc-500 py-4 text-center">Keine neuen Mitteilungen</p>
                    ) : (
                      notifications.map((n) => (
                        <div
                          key={n.id}
                          className={`p-2.5 rounded-lg text-xs border ${
                            n.read
                              ? 'bg-white/[0.015] border-white/5 text-zinc-400'
                              : 'bg-white/[0.05] border-white/10 text-zinc-200'
                          }`}
                        >
                          <h5 className="font-semibold text-white">{n.title}</h5>
                          <p className="text-2xs text-zinc-400 mt-0.5 leading-relaxed">{n.message}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Cart Drawer Trigger */}
          <button
            onClick={() => setIsCartOpen(true)}
            className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-zinc-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors cursor-pointer relative"
            title="Warenkorb"
            aria-label="Warenkorb öffnen"
          >
            <ShoppingBag className="w-4 h-4" />
            {itemCount > 0 && (
              <span className="absolute top-1.5 right-1.5 min-w-[16px] h-[16px] px-1 bg-white text-black font-bold text-2xs rounded-full flex items-center justify-center font-mono">
                {itemCount}
              </span>
            )}
          </button>

          {/* User Section: Either Logged In Menu OR Auth Buttons */}
          {isAuthenticated && currentUser ? (
            <div className="relative">
              <button
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className="flex items-center gap-2 p-1 pl-1.5 pr-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 transition-colors cursor-pointer min-h-[44px]"
              >
                <img
                  src={currentUser.avatar || '/src/assets/images/avatar_ita_developer_1790662143237.jpg'}
                  alt={currentUser.displayName || 'User'}
                  className="w-6 h-6 rounded-md object-cover border border-white/20"
                />
                <span className="hidden xl:inline text-xs font-medium text-white truncate max-w-[100px]">
                  {currentUser.displayName}
                </span>
                <ChevronDown className="w-3 h-3 text-zinc-500" />
              </button>

              {isUserMenuOpen && (
                <div className="absolute right-0 mt-2 w-56 glass-3 rounded-xl p-2 z-50 animate-in fade-in duration-100 shadow-2xl border border-white/10">
                  <div className="px-3 py-2 border-b border-white/10 mb-1">
                    <span className="text-xs font-bold text-white block truncate">{currentUser.displayName}</span>
                    <span className="text-2xs text-zinc-400 font-mono truncate block">@{currentUser.username}</span>
                    <span className="inline-block px-1.5 py-0.5 mt-1 rounded bg-white/10 text-3xs font-mono text-zinc-300">
                      {currentUser.role}
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      onNavigate('dashboard');
                    }}
                    className="w-full text-left px-3 py-2 text-xs text-zinc-300 hover:text-white hover:bg-white/5 rounded-lg flex items-center gap-2 cursor-pointer"
                  >
                    <LayoutDashboard className="w-3.5 h-3.5" />
                    <span>Dashboard</span>
                  </button>
                  <button
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      onNavigate('creator');
                    }}
                    className="w-full text-left px-3 py-2 text-xs text-zinc-300 hover:text-white hover:bg-white/5 rounded-lg flex items-center gap-2 cursor-pointer"
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>Creator CMS Studio</span>
                  </button>
                  <button
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      onNavigate('profile', currentUser.username);
                    }}
                    className="w-full text-left px-3 py-2 text-xs text-zinc-300 hover:text-white hover:bg-white/5 rounded-lg flex items-center gap-2 cursor-pointer"
                  >
                    <UserIcon className="w-3.5 h-3.5" />
                    <span>Mein Profil</span>
                  </button>
                  {isAdmin && (
                    <button
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        onNavigate('admin');
                      }}
                      className="w-full text-left px-3 py-2 text-xs text-zinc-300 hover:text-white hover:bg-white/5 rounded-lg flex items-center gap-2 cursor-pointer"
                    >
                      <Shield className="w-3.5 h-3.5" />
                      <span>Admin Panel</span>
                    </button>
                  )}
                  <div className="my-1 border-t border-white/10"></div>
                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-3 py-2 text-xs text-rose-300 hover:text-rose-100 hover:bg-rose-950/40 rounded-lg flex items-center gap-2 cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Abmelden</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => openAuthModal('login')}
                className="px-3 py-1.5 text-xs text-zinc-300 hover:text-white rounded-lg hover:bg-white/5 transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Anmelden</span>
              </button>
              <button
                onClick={() => openAuthModal('register')}
                className="px-3 py-1.5 text-xs bg-white text-black font-semibold rounded-lg hover:bg-zinc-200 transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Registrieren</span>
              </button>
            </div>
          )}

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="lg:hidden p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-zinc-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
            aria-label="Navigation umschalten"
          >
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Mobile Drawer */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 top-16 z-30 lg:hidden bg-[#060709]/95 backdrop-blur-2xl p-6 flex flex-col justify-between border-b border-white/10 animate-in fade-in duration-150">
          <div className="space-y-4">
            <span className="text-2xs font-semibold uppercase tracking-wider text-zinc-400">Navigation</span>
            <div className="space-y-1">
              {navLinks.map((link) => (
                <button
                  key={link.id}
                  onClick={() => handleMobileNav(link.id)}
                  className={`w-full text-left py-3 px-3 rounded-lg text-sm font-semibold transition-colors flex items-center justify-between cursor-pointer ${
                    currentView === link.id
                      ? 'bg-white/10 text-white'
                      : 'text-zinc-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <span>{link.label}</span>
                </button>
              ))}
              {isAdmin && (
                <button
                  onClick={() => handleMobileNav('admin')}
                  className="w-full text-left py-3 px-3 rounded-lg text-sm font-semibold text-zinc-400 hover:text-white hover:bg-white/5 flex items-center gap-2 cursor-pointer"
                >
                  <Shield className="w-4 h-4" />
                  <span>Admin Panel</span>
                </button>
              )}
            </div>
          </div>

          <div className="pt-6 border-t border-white/10 space-y-3">
            {isAuthenticated && currentUser ? (
              <>
                <div className="flex items-center gap-3 p-2 bg-white/5 rounded-xl border border-white/10">
                  <img
                    src={currentUser.avatar}
                    alt={currentUser.displayName}
                    className="w-9 h-9 rounded-lg object-cover"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-white truncate">{currentUser.displayName}</p>
                    <p className="text-2xs text-zinc-400 truncate">@{currentUser.username} ({currentUser.role})</p>
                  </div>
                </div>
                <button
                  onClick={() => handleMobileNav('dashboard')}
                  className="w-full py-2.5 bg-white/10 hover:bg-white/15 text-white text-xs rounded-xl flex items-center justify-center gap-2 cursor-pointer font-medium"
                >
                  <LayoutDashboard className="w-4 h-4" />
                  <span>Zum Dashboard</span>
                </button>
                <button
                  onClick={handleLogout}
                  className="w-full py-2.5 bg-rose-950/30 text-rose-300 text-xs rounded-xl flex items-center justify-center gap-2 cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Abmelden</span>
                </button>
              </>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    openAuthModal('login');
                  }}
                  className="w-full py-2.5 bg-white/10 text-white font-medium text-xs rounded-xl hover:bg-white/15 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Anmelden</span>
                </button>
                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    openAuthModal('register');
                  }}
                  className="w-full py-2.5 bg-white text-black font-semibold text-xs rounded-xl hover:bg-zinc-200 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Registrieren</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};
