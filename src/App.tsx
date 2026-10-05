import React, { useState, useEffect } from 'react';
import { User as FirebaseUser } from 'firebase/auth';
import { initAuth, googleSignIn, logout } from './services/calendarAuth';
import { AuthProvider, useAuth } from './context/AuthContext';
import { CartProvider, useCart } from './context/CartContext';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { CartDrawer } from './components/CartDrawer';
import { CheckoutModal } from './components/CheckoutModal';
import { SearchModal } from './components/SearchModal';
import { AuthModal } from './components/AuthModal';

// Pages
import { HomePage } from './pages/HomePage';
import { AiWorkspacePage } from './pages/AiWorkspacePage';
import { PortfolioPage } from './pages/PortfolioPage';
import { StorePage } from './pages/StorePage';
import { CommunityPage } from './pages/CommunityPage';
import { DashboardPage } from './pages/DashboardPage';
import { ProfilePage } from './pages/ProfilePage';
import { AdminPage } from './pages/AdminPage';
import { CreatorPage } from './pages/CreatorPage';
import { ShieldAlert, LogIn, ArrowLeft } from 'lucide-react';

function PlatformContent() {
  const [currentView, setCurrentView] = useState<string>('home');
  const [detailSlug, setDetailSlug] = useState<string | undefined>(undefined);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);

  const {
    isLoading,
    isAdmin,
    openAuthModal,
    isAuthModalOpen,
    authModalMode,
    closeAuthModal,
  } = useAuth();

  // Google Calendar Auth integration state
  const [calendarUser, setCalendarUser] = useState<FirebaseUser | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  useEffect(() => {
    const unsubscribe = initAuth(
      (user, _token) => {
        setCalendarUser(user);
      },
      () => {
        setCalendarUser(null);
      }
    );

    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, []);

  const handleSignInGoogle = async () => {
    setIsLoggingIn(true);
    try {
      const res = await googleSignIn();
      if (res?.user) {
        setCalendarUser(res.user);
      }
    } catch (err: any) {
      console.error('Google Calendar sign-in failed:', err);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleNavigate = (view: string, slug?: string) => {
    setCurrentView(view);
    setDetailSlug(slug);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Auth Loading State during Session Restore (Section 11)
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#060709] flex flex-col items-center justify-center text-zinc-300">
        <div className="w-12 h-12 rounded-2xl glass-2 border border-white/10 flex items-center justify-center mb-4 shadow-xl">
          <div className="w-5 h-5 rounded-full border-2 border-white border-t-transparent animate-spin" />
        </div>
        <p className="text-2xs font-mono tracking-widest uppercase text-zinc-400">
          Nexus Platform Core · Initialisiere Session...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#060709] text-zinc-100 flex flex-col font-sans selection:bg-white selection:text-black">
      {/* Liquid Glass Top Navigation Bar */}
      <Navbar
        currentView={currentView}
        onNavigate={handleNavigate}
        onOpenSearch={() => setIsSearchOpen(true)}
      />

      {/* Main Viewport */}
      <main className="flex-1">
        {currentView === 'home' && <HomePage onNavigate={handleNavigate} />}

        {currentView === 'ai' && (
          <AiWorkspacePage
            currentUser={calendarUser}
            onSignIn={handleSignInGoogle}
            isLoggingIn={isLoggingIn}
          />
        )}

        {currentView === 'portfolio' && (
          <PortfolioPage
            selectedSlug={detailSlug}
            onNavigateToProject={(slug) => handleNavigate('portfolio', slug)}
            onBack={() => handleNavigate('portfolio')}
          />
        )}

        {currentView === 'store' && (
          <StorePage
            selectedSlug={detailSlug}
            onNavigateToProduct={(slug) => handleNavigate('store', slug)}
            onBack={() => handleNavigate('store')}
            onOpenCheckout={() => setIsCheckoutOpen(true)}
          />
        )}

        {currentView === 'community' && <CommunityPage />}

        {currentView === 'dashboard' && <DashboardPage onNavigate={handleNavigate} />}

        {(currentView === 'creator' || currentView === 'manage') && (
          <CreatorPage onNavigate={handleNavigate} />
        )}

        {currentView === 'profile' && (
          <ProfilePage
            username={detailSlug || 'feligor08'}
            onNavigateToProject={(slug) => handleNavigate('portfolio', slug)}
          />
        )}

        {currentView === 'admin' && (
          isAdmin ? (
            <AdminPage />
          ) : (
            <div className="max-w-2xl mx-auto py-24 px-4 text-center space-y-6">
              <div className="w-16 h-16 rounded-2xl bg-rose-950/30 border border-rose-800/40 flex items-center justify-center mx-auto text-rose-300">
                <ShieldAlert className="w-8 h-8" />
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-bold text-white">Administrator-Bereich geschützt</h2>
                <p className="text-xs text-zinc-400 max-w-md mx-auto">
                  Für den Zugriff auf das Admin Panel, die MariaDB-Migrationen und Systemstatistiken
                  ist ein Benutzerkonto mit der Rolle <span className="text-white font-mono font-bold">ADMIN</span> erforderlich.
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <button
                  onClick={() => openAuthModal('login')}
                  className="px-4 py-2.5 bg-white text-black font-semibold text-xs rounded-xl hover:bg-zinc-200 transition-colors flex items-center gap-2 cursor-pointer shadow-lg"
                >
                  <LogIn className="w-4 h-4" />
                  <span>Als Administrator anmelden</span>
                </button>
                <button
                  onClick={() => handleNavigate('home')}
                  className="px-4 py-2.5 glass-2 border border-white/15 text-zinc-300 hover:text-white text-xs font-semibold rounded-xl hover:bg-white/10 transition-colors flex items-center gap-2 cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Zurück zur Startseite</span>
                </button>
              </div>
            </div>
          )
        )}
      </main>

      {/* Liquid Glass Footer */}
      <Footer onNavigate={handleNavigate} />

      {/* Shopping Cart Drawer */}
      <CartDrawer onProceedToCheckout={() => setIsCheckoutOpen(true)} />

      {/* Simulated Checkout Modal with Order Fulfillment */}
      <CheckoutModal
        isOpen={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
        onOrderCompleted={(order) => {
          handleNavigate('dashboard');
        }}
      />

      {/* Global Search Modal */}
      <SearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onNavigate={handleNavigate}
      />

      {/* Authentication Modal (Login & Registration) */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={closeAuthModal}
        initialMode={authModalMode}
      />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <PlatformContent />
      </CartProvider>
    </AuthProvider>
  );
}
