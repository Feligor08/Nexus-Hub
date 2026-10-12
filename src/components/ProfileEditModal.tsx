import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { X, Save, User as UserIcon, CheckCircle2, AlertCircle, Lock, Upload, KeyRound } from 'lucide-react';
import { User } from '../types/platform';

interface ProfileEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProfileUpdated?: (updated: User) => void;
}

export const ProfileEditModal: React.FC<ProfileEditModalProps> = ({
  isOpen,
  onClose,
  onProfileUpdated,
}) => {
  const { currentUser, updateProfile } = useAuth();

  const [activeTab, setActiveTab] = useState<'profile' | 'password'>('profile');

  // Profile Form State
  const [displayName, setDisplayName] = useState(currentUser?.displayName || '');
  const [username, setUsername] = useState(currentUser?.username || '');
  const [bio, setBio] = useState(currentUser?.bio || '');
  const [avatar, setAvatar] = useState(currentUser?.avatar || '');
  const [location, setLocation] = useState(currentUser?.location || '');
  const [githubUrl, setGithubUrl] = useState(currentUser?.githubUrl || '');
  const [websiteUrl, setWebsiteUrl] = useState(currentUser?.websiteUrl || currentUser?.website || '');
  const [skillsStr, setSkillsStr] = useState((currentUser?.skills || []).join(', '));
  const [techStr, setTechStr] = useState((currentUser?.technologies || []).join(', '));

  // Password Form State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Status State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  if (!isOpen || !currentUser) return null;

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Bitte wähle eine gültige Bilddatei (JPEG, PNG, WebP) aus.');
      return;
    }

    setIsUploadingAvatar(true);
    setError(null);
    try {
      const media = await api.uploadMedia(file);
      const fileUrl = `/api/media/${encodeURIComponent(media.id)}/file`;
      setAvatar(fileUrl);
      setSuccess('Avatar erfolgreich hochgeladen!');
      setTimeout(() => setSuccess(null), 2500);
    } catch (err: any) {
      setError(err.message || 'Fehler beim Hochladen des Avatars');
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    setSuccess(null);

    try {
      const skills = skillsStr
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const technologies = techStr
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      const updated = await updateProfile({
        displayName: displayName.trim(),
        username: username.trim().toLowerCase() !== currentUser.username ? username.trim().toLowerCase() : undefined,
        bio: bio.trim(),
        avatar: avatar.trim(),
        location: location.trim() || undefined,
        githubUrl: githubUrl.trim() || undefined,
        websiteUrl: websiteUrl.trim() || undefined,
        website: websiteUrl.trim() || undefined,
        skills,
        technologies,
      });

      setSuccess('Profil erfolgreich in MariaDB gespeichert!');
      if (onProfileUpdated) onProfileUpdated(updated);
      setTimeout(() => {
        onClose();
        setSuccess(null);
      }, 700);
    } catch (err: any) {
      setError(err.message || 'Fehler beim Speichern');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!currentPassword) {
      setError('Bitte gib dein aktuelles Passwort ein.');
      return;
    }

    if (newPassword.length < 12) {
      setError('Das neue Passwort muss mindestens 12 Zeichen lang sein (Sicherheitsrichtlinie).');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Die neuen Passwörter stimmen nicht überein.');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.changePassword(currentPassword, newPassword);
      setSuccess('Passwort erfolgreich geändert! Andere Sitzungen wurden beendet.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => {
        onClose();
        setSuccess(null);
      }, 1200);
    } catch (err: any) {
      setError(err.message || 'Passwortänderung fehlgeschlagen');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-lg glass-2 rounded-2xl border border-white/10 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/10 bg-white/[0.02]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-white/10 border border-white/15 text-white">
              {activeTab === 'profile' ? <UserIcon className="w-4 h-4" /> : <KeyRound className="w-4 h-4" />}
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">
                {activeTab === 'profile' ? 'Profil bearbeiten' : 'Passwort & Sicherheit'}
              </h3>
              <p className="text-2xs text-zinc-400">
                Wird direkt in der MariaDB 11 Datenbank persistiert
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

        {/* Tab Selection */}
        <div className="flex border-b border-white/10 px-5 pt-2 bg-white/[0.01]">
          <button
            type="button"
            onClick={() => {
              setActiveTab('profile');
              setError(null);
              setSuccess(null);
            }}
            className={`pb-2.5 px-3 text-xs font-semibold cursor-pointer border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'profile'
                ? 'border-white text-white'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <UserIcon className="w-3.5 h-3.5" />
            <span>Profil-Daten</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('password');
              setError(null);
              setSuccess(null);
            }}
            className={`pb-2.5 px-3 text-xs font-semibold cursor-pointer border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'password'
                ? 'border-white text-white'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Passwort ändern</span>
          </button>
        </div>

        {/* Form Body */}
        {activeTab === 'profile' ? (
          <form onSubmit={handleProfileSubmit} className="p-5 overflow-y-auto space-y-4">
            {error && (
              <div className="p-3 bg-rose-950/40 border border-rose-800/50 rounded-xl text-xs text-rose-200 flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <div>{error}</div>
              </div>
            )}

            {success && (
              <div className="p-3 bg-emerald-950/40 border border-emerald-800/50 rounded-xl text-xs text-emerald-200 flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <div>{success}</div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-2xs font-mono uppercase tracking-wider text-zinc-400 mb-1.5">
                  Anzeigename
                </label>
                <input
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full px-3.5 py-2 bg-black/40 border border-white/10 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-white/40"
                />
              </div>

              <div>
                <label className="block text-2xs font-mono uppercase tracking-wider text-zinc-400 mb-1.5">
                  Benutzername (@handle)
                </label>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-3.5 py-2 bg-black/40 border border-white/10 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-white/40 font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-2xs font-mono uppercase tracking-wider text-zinc-400 mb-1.5">
                Biografie / Kurzbeschreibung
              </label>
              <textarea
                rows={3}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Berufliche Schwerpunkte, Ausbildung, Interessen..."
                className="w-full px-3.5 py-2 bg-black/40 border border-white/10 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-white/40 resize-none"
              />
            </div>

            {/* Avatar & Upload */}
            <div>
              <label className="block text-2xs font-mono uppercase tracking-wider text-zinc-400 mb-1.5">
                Avatar (Bild oder Upload)
              </label>
              <div className="flex items-center gap-3">
                <img
                  src={avatar || '/src/assets/images/avatar_ita_developer_1790662143237.jpg'}
                  alt="Vorschau"
                  className="w-10 h-10 rounded-xl object-cover border border-white/20 shrink-0"
                />
                <input
                  type="text"
                  value={avatar}
                  onChange={(e) => setAvatar(e.target.value)}
                  placeholder="/api/media/... oder Bild-URL"
                  className="flex-1 px-3.5 py-2 bg-black/40 border border-white/10 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-white/40"
                />
                <label className="px-3 py-2 glass-2 border border-white/15 text-white text-xs font-semibold rounded-xl hover:bg-white/10 transition-colors cursor-pointer flex items-center gap-1.5 shrink-0">
                  <Upload className="w-3.5 h-3.5" />
                  <span>{isUploadingAvatar ? 'Lädt...' : 'Hochladen'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarUpload}
                    disabled={isUploadingAvatar}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-2xs font-mono uppercase tracking-wider text-zinc-400 mb-1.5">
                  Standort / Region
                </label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="z.B. Deutschland, NRW"
                  className="w-full px-3.5 py-2 bg-black/40 border border-white/10 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-white/40"
                />
              </div>

              <div>
                <label className="block text-2xs font-mono uppercase tracking-wider text-zinc-400 mb-1.5">
                  GitHub Profil
                </label>
                <input
                  type="url"
                  value={githubUrl}
                  onChange={(e) => setGithubUrl(e.target.value)}
                  placeholder="https://github.com/..."
                  className="w-full px-3.5 py-2 bg-black/40 border border-white/10 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-white/40"
                />
              </div>
            </div>

            <div>
              <label className="block text-2xs font-mono uppercase tracking-wider text-zinc-400 mb-1.5">
                Persönliche Website / Portfolio
              </label>
              <input
                type="url"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                placeholder="https://meine-website.de"
                className="w-full px-3.5 py-2 bg-black/40 border border-white/10 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-white/40"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-2xs font-mono uppercase tracking-wider text-zinc-400 mb-1.5">
                  Skills (kommagetrennt)
                </label>
                <input
                  type="text"
                  value={skillsStr}
                  onChange={(e) => setSkillsStr(e.target.value)}
                  placeholder="C# .NET, WPF, Docker"
                  className="w-full px-3.5 py-2 bg-black/40 border border-white/10 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-white/40"
                />
              </div>
              <div>
                <label className="block text-2xs font-mono uppercase tracking-wider text-zinc-400 mb-1.5">
                  Technologien (kommagetrennt)
                </label>
                <input
                  type="text"
                  value={techStr}
                  onChange={(e) => setTechStr(e.target.value)}
                  placeholder="Ubuntu, Tailscale, MariaDB"
                  className="w-full px-3.5 py-2 bg-black/40 border border-white/10 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-white/40"
                />
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2 border-t border-white/10">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs text-zinc-400 hover:text-white rounded-xl hover:bg-white/5 transition-colors cursor-pointer"
              >
                Abbrechen
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 bg-white text-black font-semibold text-xs rounded-xl hover:bg-zinc-200 transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                {isSubmitting ? (
                  <div className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    <span>Profil speichern</span>
                  </>
                )}
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handlePasswordSubmit} className="p-5 overflow-y-auto space-y-4">
            {error && (
              <div className="p-3 bg-rose-950/40 border border-rose-800/50 rounded-xl text-xs text-rose-200 flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <div>{error}</div>
              </div>
            )}

            {success && (
              <div className="p-3 bg-emerald-950/40 border border-emerald-800/50 rounded-xl text-xs text-emerald-200 flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <div>{success}</div>
              </div>
            )}

            <div className="p-3.5 bg-white/[0.02] border border-white/10 rounded-xl text-2xs text-zinc-400 space-y-1">
              <span className="font-semibold text-white block">Sicherheitsanforderungen:</span>
              <p>• Aktuelles Passwort muss korrekt eingegeben werden.</p>
              <p>• Neues Passwort muss mindestens 12 Zeichen lang sein.</p>
              <p>• Bei erfolgreicher Änderung werden alle anderen bestehenden Sitzungen widerrufen.</p>
            </div>

            <div>
              <label className="block text-2xs font-mono uppercase tracking-wider text-zinc-400 mb-1.5">
                Aktuelles Passwort
              </label>
              <input
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Dein bisheriges Passwort"
                className="w-full px-3.5 py-2 bg-black/40 border border-white/10 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-white/40"
              />
            </div>

            <div>
              <label className="block text-2xs font-mono uppercase tracking-wider text-zinc-400 mb-1.5">
                Neues Passwort (mind. 12 Zeichen)
              </label>
              <input
                type="password"
                required
                minLength={12}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Mindestens 12 Zeichen"
                className="w-full px-3.5 py-2 bg-black/40 border border-white/10 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-white/40 font-mono"
              />
            </div>

            <div>
              <label className="block text-2xs font-mono uppercase tracking-wider text-zinc-400 mb-1.5">
                Neues Passwort bestätigen
              </label>
              <input
                type="password"
                required
                minLength={12}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Neues Passwort wiederholen"
                className="w-full px-3.5 py-2 bg-black/40 border border-white/10 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-white/40 font-mono"
              />
            </div>

            <div className="pt-2 flex items-center justify-end gap-2 border-t border-white/10">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs text-zinc-400 hover:text-white rounded-xl hover:bg-white/5 transition-colors cursor-pointer"
              >
                Abbrechen
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 bg-white text-black font-semibold text-xs rounded-xl hover:bg-zinc-200 transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                {isSubmitting ? (
                  <div className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <KeyRound className="w-3.5 h-3.5" />
                    <span>Passwort aktualisieren</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
