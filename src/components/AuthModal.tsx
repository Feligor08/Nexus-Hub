import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { X, LogIn, UserPlus, Eye, EyeOff, AlertCircle, CheckCircle2 } from 'lucide-react';

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
  const [emailOrUsername, setEmailOrUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Status states
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessNotice(null);

    // Client-side validations (Sections 15, 16)
    if (mode === 'register') {
      const trimmedUser = username.trim();
      if (trimmedUser.length < 3 || trimmedUser.length > 30) {
        setError('Der Benutzername muss zwischen 3 und 30 Zeichen lang sein.');
        return;
      }

      if (!/^[a-zA-Z0-9_]+$/.test(trimmedUser)) {
        setError('Der Benutzername darf nur Buchstaben, Zahlen und Unterstriche enthalten.');
        return;
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!email || !emailRegex.test(email.trim())) {
        setError('Die E-Mail-Adresse ist ungültig.');
        return;
      }

      if (password.length < 12) {
        setError('Das Passwort muss mindestens 12 Zeichen enthalten.');
        return;
      }

      if (password !== confirmPassword) {
        setError('Die Passwörter stimmen nicht überein.');
        return;
      }
    } else {
      if (!emailOrUsername.trim() || !password) {
        setError('Bitte E-Mail/Benutzername und Passwort eingeben.');
        return;
      }
    }

    setIsSubmitting(true);

    try {
      if (mode === 'login') {
        await login({ emailOrUsername: emailOrUsername.trim(), password });
        setSuccessNotice('Erfolgreich angemeldet.');
        setTimeout(() => onClose(), 500);
      } else {
        await register({
          username: username.trim().toLowerCase(),
          email: email.trim().toLowerCase(),
          password,
          displayName: displayName.trim() || username.trim(),
        });
        setSuccessNotice('Registrierung erfolgreich! Sitzung wurde gestartet.');
        setTimeout(() => onClose(), 600);
      }
    } catch (err: any) {
      setError(err.message || 'Authentifizierungsfehler aufgetreten.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-[#060709] rounded-2xl border border-white/10 shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/10 bg-white/[0.02]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-white/5 border border-white/10 text-white">
              {mode === 'login' ? <LogIn className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">
                {mode === 'login' ? 'Anmelden' : 'Registrieren'}
              </h3>
              <p className="text-2xs text-zinc-400">
                {mode === 'login'
                  ? 'Sichere Session via MariaDB & HttpOnly Cookie'
                  : 'Neues Benutzerkonto mit Standardrolle USER erstellen'}
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
        <form onSubmit={handleSubmit} className="p-5 space-y-3.5">
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

          {mode === 'login' ? (
            <>
              {/* Login Fields */}
              <div>
                <label className="block text-2xs font-mono uppercase tracking-wider text-zinc-400 mb-1.5">
                  E-Mail oder Benutzername
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={emailOrUsername}
                  onChange={(e) => setEmailOrUsername(e.target.value)}
                  placeholder="user@example.com oder feligor08"
                  className="w-full px-3.5 py-2.5 bg-black/40 border border-white/10 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-white/40 focus:ring-1 focus:ring-white/20 transition-all font-mono"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-2xs font-mono uppercase tracking-wider text-zinc-400">
                    Passwort
                  </label>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
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
              </div>
            </>
          ) : (
            <>
              {/* Register Fields */}
              <div>
                <label className="block text-2xs font-mono uppercase tracking-wider text-zinc-400 mb-1.5">
                  Benutzername (3–30 Zeichen, a-z, 0-9, _)
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="z.B. dev_user"
                  pattern="^[a-zA-Z0-9_]{3,30}$"
                  title="3 bis 30 Zeichen, nur Buchstaben, Zahlen und Unterstriche"
                  className="w-full px-3.5 py-2.5 bg-black/40 border border-white/10 rounded-xl text-xs font-mono text-white placeholder-zinc-500 focus:outline-none focus:border-white/40 focus:ring-1 focus:ring-white/20 transition-all"
                />
              </div>

              <div>
                <label className="block text-2xs font-mono uppercase tracking-wider text-zinc-400 mb-1.5">
                  E-Mail-Adresse
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="user@example.com"
                  className="w-full px-3.5 py-2.5 bg-black/40 border border-white/10 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-white/40 focus:ring-1 focus:ring-white/20 transition-all font-mono"
                />
              </div>

              <div>
                <label className="block text-2xs font-mono uppercase tracking-wider text-zinc-400 mb-1.5">
                  Anzeigename <span className="text-zinc-500 font-normal lowercase">(optional)</span>
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="z.B. Johann Schneider"
                  className="w-full px-3.5 py-2.5 bg-black/40 border border-white/10 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-white/40 focus:ring-1 focus:ring-white/20 transition-all"
                />
              </div>

              <div>
                <label className="block text-2xs font-mono uppercase tracking-wider text-zinc-400 mb-1.5">
                  Passwort (mindestens 12 Zeichen)
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mindestens 12 Zeichen"
                    minLength={12}
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
              </div>

              <div>
                <label className="block text-2xs font-mono uppercase tracking-wider text-zinc-400 mb-1.5">
                  Passwort bestätigen
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Passwort wiederholen"
                    minLength={12}
                    className="w-full px-3.5 py-2.5 pr-10 bg-black/40 border border-white/10 rounded-xl text-xs font-mono text-white placeholder-zinc-500 focus:outline-none focus:border-white/40 focus:ring-1 focus:ring-white/20 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 cursor-pointer p-1"
                    aria-label="Passwort anzeigen"
                  >
                    {showConfirmPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2.5 px-4 bg-white text-black font-semibold text-xs rounded-xl hover:bg-zinc-200 active:scale-[0.99] transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 mt-3 shadow-lg shadow-white/5"
          >
            {isSubmitting ? (
              <span>{mode === 'login' ? 'Wird angemeldet…' : 'Wird registriert…'}</span>
            ) : mode === 'login' ? (
              <>
                <LogIn className="w-3.5 h-3.5" />
                <span>Anmelden</span>
              </>
            ) : (
              <>
                <UserPlus className="w-3.5 h-3.5" />
                <span>Registrieren</span>
              </>
            )}
          </button>

          <div className="pt-2 text-center text-2xs text-zinc-400">
            {mode === 'login' ? (
              <span>
                Noch kein Konto?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('register');
                    setError(null);
                  }}
                  className="text-white hover:underline cursor-pointer font-medium"
                >
                  Jetzt registrieren
                </button>
              </span>
            ) : (
              <span>
                Bereits registriert?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setError(null);
                  }}
                  className="text-white hover:underline cursor-pointer font-medium"
                >
                  Hier anmelden
                </button>
              </span>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};
