import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { X, LogIn, UserPlus, Eye, EyeOff, ShieldCheck, Sparkles, AlertCircle, CheckCircle2 } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'login' | 'register';
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  initialMode = 'login',
}) => {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Status states
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessNotice(null);
    setIsSubmitting(true);

    try {
      if (mode === 'login') {
        await login({ email, password });
        setSuccessNotice('Erfolgreich angemeldet.');
        setTimeout(() => onClose(), 600);
      } else {
        await register({ username, email, password, displayName });
        setSuccessNotice('Registrierung erfolgreich! Willkommen auf Nexus Code Play.');
        setTimeout(() => onClose(), 700);
      }
    } catch (err: any) {
      setError(err.message || 'Authentifizierungsfehler');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickFill = (presetEmail: string, presetPass: string) => {
    setEmail(presetEmail);
    setPassword(presetPass);
    setError(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-md glass-2 rounded-2xl border border-white/10 shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/10 bg-white/[0.02]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-white/10 border border-white/15 text-white">
              {mode === 'login' ? <LogIn className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">
                {mode === 'login' ? 'Auf Nexus anmelden' : 'Neues Entwickler-Konto'}
              </h3>
              <p className="text-2xs text-zinc-400">
                {mode === 'login'
                  ? 'Sichere Session via MariaDB 11 & HttpOnly Cookie'
                  : 'Tritt der Nexus Code Play Plattform bei'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            aria-label="Schließen"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mode Selector Tabs */}
        <div className="flex border-b border-white/10 bg-black/40 p-1">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setError(null);
            }}
            className={`flex-1 py-2 text-xs font-medium rounded-lg transition-all cursor-pointer ${
              mode === 'login'
                ? 'bg-white/15 text-white shadow-sm font-semibold'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Anmelden
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setError(null);
            }}
            className={`flex-1 py-2 text-xs font-medium rounded-lg transition-all cursor-pointer ${
              mode === 'register'
                ? 'bg-white/15 text-white shadow-sm font-semibold'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Registrieren
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="p-3 bg-rose-950/40 border border-rose-800/50 rounded-xl text-xs text-rose-200 flex items-start gap-2.5 animate-in fade-in duration-150">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="leading-relaxed">{error}</div>
            </div>
          )}

          {successNotice && (
            <div className="p-3 bg-emerald-950/40 border border-emerald-800/50 rounded-xl text-xs text-emerald-200 flex items-center gap-2.5 animate-in fade-in duration-150">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <div className="leading-relaxed">{successNotice}</div>
            </div>
          )}

          {mode === 'register' && (
            <>
              <div>
                <label className="block text-2xs font-mono uppercase tracking-wider text-zinc-400 mb-1.5">
                  Anzeigename
                </label>
                <input
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="z.B. Johann Schneider"
                  className="w-full px-3.5 py-2.5 bg-black/40 border border-white/10 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-white/40 focus:ring-1 focus:ring-white/20 transition-all"
                />
              </div>

              <div>
                <label className="block text-2xs font-mono uppercase tracking-wider text-zinc-400 mb-1.5">
                  Benutzername (eindeutig)
                </label>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="z.B. j_schneider"
                  pattern="^[a-zA-Z0-9_]{3,30}$"
                  title="3 bis 30 Zeichen, nur Buchstaben, Zahlen und Unterstriche"
                  className="w-full px-3.5 py-2.5 bg-black/40 border border-white/10 rounded-xl text-xs font-mono text-white placeholder-zinc-500 focus:outline-none focus:border-white/40 focus:ring-1 focus:ring-white/20 transition-all"
                />
              </div>
            </>
          )}

          <div>
            <label className="block text-2xs font-mono uppercase tracking-wider text-zinc-400 mb-1.5">
              {mode === 'login' ? 'E-Mail oder Benutzername' : 'E-Mail-Adresse'}
            </label>
            <input
              type={mode === 'login' ? 'text' : 'email'}
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={mode === 'login' ? 'name@beispiel.de oder feligor08' : 'name@beispiel.de'}
              className="w-full px-3.5 py-2.5 bg-black/40 border border-white/10 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-white/40 focus:ring-1 focus:ring-white/20 transition-all"
            />
          </div>

          <div>
            <label className="block text-2xs font-mono uppercase tracking-wider text-zinc-400 mb-1.5">
              Passwort
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                minLength={6}
                className="w-full px-3.5 py-2.5 pr-10 bg-black/40 border border-white/10 rounded-xl text-xs font-mono text-white placeholder-zinc-500 focus:outline-none focus:border-white/40 focus:ring-1 focus:ring-white/20 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 cursor-pointer p-1"
                aria-label="Passwort anzeigen"
              >
                {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
            {mode === 'register' && (
              <span className="text-3xs text-zinc-500 mt-1 block">Mindestens 6 Zeichen.</span>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2.5 px-4 bg-white text-black font-semibold text-xs rounded-xl hover:bg-zinc-200 active:scale-[0.99] transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 mt-2 shadow-lg shadow-white/5"
          >
            {isSubmitting ? (
              <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
            ) : mode === 'login' ? (
              <>
                <LogIn className="w-3.5 h-3.5" />
                <span>Anmelden</span>
              </>
            ) : (
              <>
                <UserPlus className="w-3.5 h-3.5" />
                <span>Konto anlegen</span>
              </>
            )}
          </button>

          {/* Quick-Fill Presets for Test Accounts */}
          {mode === 'login' && (
            <div className="pt-3 border-t border-white/10 space-y-2">
              <div className="flex items-center justify-between text-3xs font-mono uppercase tracking-wider text-zinc-400">
                <span className="flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-zinc-400" />
                  Test-Profile (1-Klick ausfüllen):
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1.5 text-2xs">
                <button
                  type="button"
                  onClick={() => handleQuickFill('fschlueter08@gmail.com', 'password123')}
                  className="px-2 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-left truncate transition-colors text-zinc-300 hover:text-white cursor-pointer"
                  title="Admin: Felix Schlüter"
                >
                  <span className="font-bold text-white block truncate">Admin</span>
                  <span className="text-3xs text-zinc-400 font-mono">feligor08</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickFill('alex@example.com', 'password123')}
                  className="px-2 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-left truncate transition-colors text-zinc-300 hover:text-white cursor-pointer"
                  title="Creator: Alex Meier"
                >
                  <span className="font-bold text-white block truncate">Creator</span>
                  <span className="text-3xs text-zinc-400 font-mono">alex_code</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickFill('guest@nexuscodeplay.dev', 'password123')}
                  className="px-2 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-left truncate transition-colors text-zinc-300 hover:text-white cursor-pointer"
                  title="User: Gast Entwickler"
                >
                  <span className="font-bold text-white block truncate">User</span>
                  <span className="text-3xs text-zinc-400 font-mono">guest_user</span>
                </button>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};
