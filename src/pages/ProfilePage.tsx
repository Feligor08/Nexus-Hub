import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { PublicProfile, Project } from '../types/platform';
import { ProfileEditModal } from '../components/ProfileEditModal';
import {
  User as UserIcon,
  Github,
  Globe,
  Award,
  Code2,
  Calendar,
  Layers,
  ArrowRight,
  Shield,
  Briefcase,
  Edit3,
} from 'lucide-react';

interface ProfilePageProps {
  username?: string;
  onNavigateToProject?: (slug: string) => void;
}

export const ProfilePage: React.FC<ProfilePageProps> = ({
  username,
  onNavigateToProject,
}) => {
  const { currentUser } = useAuth();
  const [user, setUser] = useState<PublicProfile | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const targetUsername = username || currentUser?.username;

  const fetchProfile = () => {
    if (!targetUsername) {
      setUser(null);
      setProjects([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    Promise.all([api.getUserByUsername(targetUsername), api.getProjects()])
      .then(([userData, projectsData]) => {
        setUser(userData);
        setProjects(projectsData.filter((p) => p.authorId === userData.id));
      })
      .catch(console.error)
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    fetchProfile();
  }, [targetUsername]);

  if (isLoading) {
    return (
      <div className="py-24 text-center space-y-2">
        <div className="w-8 h-8 rounded-full border-2 border-white border-t-transparent animate-spin mx-auto" />
        <p className="text-xs text-zinc-500 font-mono">Lade Entwickler-Profil aus MariaDB...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-2xl mx-auto py-24 px-4 text-center space-y-3">
        <UserIcon className="w-10 h-10 mx-auto text-zinc-500" />
        <h1 className="text-lg font-semibold text-white">Profil nicht gefunden</h1>
        <p className="text-xs text-zinc-400">Melde dich an oder öffne ein Profil über seinen Benutzernamen.</p>
      </div>
    );
  }

  const isOwnProfile = currentUser?.username === user.username;

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 sm:px-6 space-y-8 animate-in fade-in duration-150">
      {/* Profile Card */}
      <div className="p-8 liquid-glass rounded-2xl border border-white/10 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6">
          <div className="flex items-start gap-5">
            <img
              src={user.avatar || '/src/assets/images/avatar_ita_developer_1790662143237.jpg'}
              alt={user.displayName}
              className="w-20 h-20 rounded-2xl object-cover border border-white/20 shadow-lg shrink-0"
            />
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold text-white">{user.displayName}</h1>
              </div>
              <p className="text-xs text-zinc-400">@{user.username}</p>
              <p className="text-xs text-zinc-300 leading-relaxed max-w-xl pt-1">{user.bio}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {isOwnProfile && (
              <button
                onClick={() => setIsEditModalOpen(true)}
                className="px-3.5 py-2 glass-2 border border-white/15 text-zinc-200 hover:text-white text-xs font-medium rounded-lg flex items-center gap-1.5 cursor-pointer hover:bg-white/10 transition-colors"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Profil bearbeiten</span>
              </button>
            )}
            {user.githubUrl && (
              <a
                href={user.githubUrl}
                target="_blank"
                rel="noreferrer"
                className="p-2 liquid-glass-button rounded-lg text-zinc-300 hover:text-white"
                title="GitHub"
              >
                <Github className="w-4 h-4" />
              </a>
            )}
            {user.websiteUrl && (
              <a
                href={user.websiteUrl}
                target="_blank"
                rel="noreferrer"
                className="p-2 liquid-glass-button rounded-lg text-zinc-300 hover:text-white"
                title="Website"
              >
                <Globe className="w-4 h-4" />
              </a>
            )}
          </div>
        </div>

        {/* Badges strip */}
        {user.badges?.length > 0 && (
          <div className="pt-4 border-t border-white/10">
            <span className="text-2xs font-semibold uppercase tracking-wider text-zinc-400 block mb-2">
              Verifizierte Auszeichnungen &amp; Rollen:
            </span>
            <div className="flex flex-wrap gap-2">
              {user.badges.map((b, idx) => (
                <span
                  key={idx}
                  className="flex items-center gap-1.5 px-3 py-1 bg-white/5 border border-white/15 rounded-md text-2xs font-medium text-white shadow-xs"
                >
                  <Award className="w-3.5 h-3.5 text-white" />
                  <span>{b}</span>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Skills & Technologies */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-6 liquid-glass rounded-xl border border-white/10 space-y-3">
          <span className="text-2xs font-semibold uppercase tracking-wider text-zinc-400">Kernkompetenzen</span>
          <h3 className="text-sm font-bold text-white">IT- &amp; Entwicklungs-Schwerpunkte</h3>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {user.skills?.map((s, idx) => (
              <span key={idx} className="px-2.5 py-1 text-xs bg-white/5 border border-white/10 rounded text-zinc-200">
                {s}
              </span>
            ))}
          </div>
        </div>

        <div className="p-6 liquid-glass rounded-xl border border-white/10 space-y-3">
          <span className="text-2xs font-semibold uppercase tracking-wider text-zinc-400">Technologie-Stack</span>
          <h3 className="text-sm font-bold text-white">Werkzeuge &amp; Frameworks</h3>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {user.technologies?.map((t, idx) => (
              <span key={idx} className="px-2.5 py-1 text-xs font-mono bg-white/5 border border-white/10 rounded text-zinc-300">
                {t}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Published Projects by this user */}
      <div className="p-6 liquid-glass rounded-xl border border-white/10 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <h3 className="text-sm font-bold text-white">Veröffentlichte Systeme von @{user.username}</h3>
          <span className="text-2xs text-zinc-400">{projects.length} Projekte</span>
        </div>

        {projects.length === 0 ? (
          <p className="text-xs text-zinc-500 py-4 text-center">Noch keine Projekte veröffentlicht.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {projects.map((proj) => (
              <div
                key={proj.id}
                onClick={() => onNavigateToProject && onNavigateToProject(proj.slug)}
                className="p-4 liquid-glass-subtle rounded-lg border border-white/5 hover:border-white/15 cursor-pointer space-y-2 transition-colors"
              >
                <div className="flex items-center justify-between text-2xs text-zinc-400">
                  <span>{proj.category}</span>
                  <span className="font-mono text-zinc-200">{proj.status}</span>
                </div>
                <h4 className="text-xs font-bold text-white">{proj.title}</h4>
                <p className="text-2xs text-zinc-400 line-clamp-2">{proj.shortDesc}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit Profile Modal */}
      {isOwnProfile && (
        <ProfileEditModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          onProfileUpdated={(updated) => setUser(updated)}
        />
      )}
    </div>
  );
};
