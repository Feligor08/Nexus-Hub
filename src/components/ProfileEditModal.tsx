import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { X, Save, User as UserIcon, CheckCircle2, AlertCircle } from 'lucide-react';
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

  const [displayName, setDisplayName] = useState(currentUser?.displayName || '');
  const [bio, setBio] = useState(currentUser?.bio || '');
  const [avatar, setAvatar] = useState(currentUser?.avatar || '');
  const [githubUrl, setGithubUrl] = useState(currentUser?.githubUrl || '');
  const [websiteUrl, setWebsiteUrl] = useState(currentUser?.websiteUrl || '');
  const [skillsStr, setSkillsStr] = useState((currentUser?.skills || []).join(', '));
  const [techStr, setTechStr] = useState((currentUser?.technologies || []).join(', '));

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!isOpen || !currentUser) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    setSuccess(false);

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
        bio: bio.trim(),
        avatar: avatar.trim(),
        githubUrl: githubUrl.trim() || undefined,
        websiteUrl: websiteUrl.trim() || undefined,
        skills,
        technologies,
      });

      setSuccess(true);
      if (onProfileUpdated) onProfileUpdated(updated);
      setTimeout(() => {
        onClose();
        setSuccess(false);
      }, 700);
    } catch (err: any) {
      setError(err.message || 'Fehler beim Speichern');
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
              <UserIcon className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">Profil bearbeiten</h3>
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4">
          {error && (
            <div className="p-3 bg-rose-950/40 border border-rose-800/50 rounded-xl text-xs text-rose-200 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div>{error}</div>
            </div>
          )}

          {success && (
            <div className="p-3 bg-emerald-950/40 border border-emerald-800/50 rounded-xl text-xs text-emerald-200 flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <div>Profil erfolgreich in MariaDB gespeichert!</div>
            </div>
          )}

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
              Biografie / Kurzbeschreibung
            </label>
            <textarea
              rows={3}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Berufliche Schwerpunkte, Ausbildung, Projekte..."
              className="w-full px-3.5 py-2 bg-black/40 border border-white/10 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-white/40 resize-none"
            />
          </div>

          <div>
            <label className="block text-2xs font-mono uppercase tracking-wider text-zinc-400 mb-1.5">
              Avatar Bild-URL
            </label>
            <input
              type="text"
              value={avatar}
              onChange={(e) => setAvatar(e.target.value)}
              placeholder="/src/assets/images/... oder https://..."
              className="w-full px-3.5 py-2 bg-black/40 border border-white/10 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-white/40"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-2xs font-mono uppercase tracking-wider text-zinc-400 mb-1.5">
                GitHub URL
              </label>
              <input
                type="url"
                value={githubUrl}
                onChange={(e) => setGithubUrl(e.target.value)}
                placeholder="https://github.com/..."
                className="w-full px-3.5 py-2 bg-black/40 border border-white/10 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-white/40"
              />
            </div>
            <div>
              <label className="block text-2xs font-mono uppercase tracking-wider text-zinc-400 mb-1.5">
                Website URL
              </label>
              <input
                type="url"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                placeholder="https://..."
                className="w-full px-3.5 py-2 bg-black/40 border border-white/10 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-white/40"
              />
            </div>
          </div>

          <div>
            <label className="block text-2xs font-mono uppercase tracking-wider text-zinc-400 mb-1.5">
              Fähigkeiten &amp; Skills (kommagetrennt)
            </label>
            <input
              type="text"
              value={skillsStr}
              onChange={(e) => setSkillsStr(e.target.value)}
              placeholder="C# .NET 10, WPF, Docker, 8051 Assembler"
              className="w-full px-3.5 py-2 bg-black/40 border border-white/10 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-white/40"
            />
          </div>

          <div>
            <label className="block text-2xs font-mono uppercase tracking-wider text-zinc-400 mb-1.5">
              Technologien &amp; Tools (kommagetrennt)
            </label>
            <input
              type="text"
              value={techStr}
              onChange={(e) => setTechStr(e.target.value)}
              placeholder="Ubuntu 24.04, Tailscale, MariaDB, Bambu P1S"
              className="w-full px-3.5 py-2 bg-black/40 border border-white/10 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-white/40"
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
                  <Save className="w-3.5 h-3.5" />
                  <span>Speichern</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
