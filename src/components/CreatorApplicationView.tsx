import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { CreatorApplication } from '../types/platform';
import {
  Sparkles,
  Send,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileCode,
  Layers,
  ArrowRight,
  Shield,
  RotateCcw,
} from 'lucide-react';

export const CreatorApplicationView: React.FC = () => {
  const [application, setApplication] = useState<CreatorApplication | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form Fields
  const [motivation, setMotivation] = useState('');
  const [plannedProjects, setPlannedProjects] = useState('');
  const [plannedContent, setPlannedContent] = useState('');
  const [portfolioUrl, setPortfolioUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showReapplyForm, setShowReapplyForm] = useState(false);

  const loadApplication = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const app = await api.getCreatorApplication();
      setApplication(app);
      if (app) {
        setMotivation(app.motivation || '');
        setPlannedProjects(app.plannedProjects || '');
        setPlannedContent(app.plannedContent || '');
        setPortfolioUrl(app.portfolioUrl || '');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Antragsstatus konnte nicht abgerufen werden.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadApplication();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!motivation.trim() || !plannedProjects.trim() || !plannedContent.trim()) {
      setErrorMsg('Bitte fülle alle Pflichtfelder (Motivation, geplante Projekte und Inhalte) aus.');
      return;
    }

    setIsSubmitting(true);
    try {
      const created = await api.submitCreatorApplication({
        motivation: motivation.trim(),
        plannedProjects: plannedProjects.trim(),
        plannedContent: plannedContent.trim(),
        portfolioUrl: portfolioUrl.trim() || undefined,
      });
      setApplication(created);
      setSuccessMsg('Creator-Antrag erfolgreich eingereicht! Ein Administrator wird deine Angaben prüfen.');
      setShowReapplyForm(false);
    } catch (err: any) {
      setErrorMsg(err.message || 'Fehler beim Einreichen des Antrags.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto py-24 px-4 text-center space-y-3">
        <div className="w-8 h-8 rounded-full border-2 border-white border-t-transparent animate-spin mx-auto" />
        <p className="text-xs text-zinc-400 font-mono">Prüfe Creator-Berechtigungsstatus...</p>
      </div>
    );
  }

  // Pending State
  if (application && application.status === 'PENDING') {
    return (
      <div className="max-w-2xl mx-auto py-16 px-4 animate-in fade-in duration-200">
        <div className="p-8 liquid-glass rounded-2xl border border-amber-500/30 space-y-6 shadow-2xl relative overflow-hidden">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <Clock className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-white">Creator-Antrag in Prüfung</h2>
                <span className="px-2.5 py-0.5 text-2xs font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded-full">
                  PENDING
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                Eingereicht am {new Date(application.createdAt).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>

          <p className="text-xs text-zinc-300 leading-relaxed">
            Dein Antrag für das Creator CMS und Publisher-Rechte wurde gespeichert und wartet auf die Überprüfung durch einen Plattform-Administrator. Sobald dein Antrag genehmigt wurde, erhält dein Konto automatisch die Rolle <strong className="text-white">CREATOR</strong>.
          </p>

          <div className="p-4 rounded-xl bg-white/[0.02] border border-white/10 space-y-3 text-xs">
            <div>
              <span className="text-2xs font-mono text-zinc-400 uppercase tracking-wider block">Deine Motivation:</span>
              <p className="text-zinc-200 mt-1 whitespace-pre-wrap">{application.motivation}</p>
            </div>
            <div>
              <span className="text-2xs font-mono text-zinc-400 uppercase tracking-wider block">Geplante Projekte:</span>
              <p className="text-zinc-200 mt-1 whitespace-pre-wrap">{application.plannedProjects}</p>
            </div>
            <div>
              <span className="text-2xs font-mono text-zinc-400 uppercase tracking-wider block">Geplante Store-Inhalte:</span>
              <p className="text-zinc-200 mt-1 whitespace-pre-wrap">{application.plannedContent}</p>
            </div>
            {application.portfolioUrl && (
              <div>
                <span className="text-2xs font-mono text-zinc-400 uppercase tracking-wider block">Portfolio / GitHub:</span>
                <a href={application.portfolioUrl} target="_blank" rel="noreferrer" className="text-zinc-300 hover:text-white underline mt-1 block">
                  {application.portfolioUrl}
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Rejected State
  if (application && application.status === 'REJECTED' && !showReapplyForm) {
    return (
      <div className="max-w-2xl mx-auto py-16 px-4 animate-in fade-in duration-200">
        <div className="p-8 liquid-glass rounded-2xl border border-rose-500/30 space-y-6 shadow-2xl">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-white">Creator-Antrag abgelehnt</h2>
                <span className="px-2.5 py-0.5 text-2xs font-mono font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40 rounded-full">
                  REJECTED
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                Geprüft am {application.reviewedAt ? new Date(application.reviewedAt).toLocaleDateString('de-DE') : 'kürzlich'}
              </p>
            </div>
          </div>

          {application.adminNotes && (
            <div className="p-4 rounded-xl bg-rose-950/30 border border-rose-800/40 text-xs text-rose-200 space-y-1">
              <span className="font-semibold block text-rose-300">Begründung des Administrators:</span>
              <p className="whitespace-pre-wrap">{application.adminNotes}</p>
            </div>
          )}

          <p className="text-xs text-zinc-300">
            Du kannst deine Angaben überarbeiten und einen aktualisierten Creator-Antrag einreichen.
          </p>

          <button
            onClick={() => setShowReapplyForm(true)}
            className="px-4 py-2.5 bg-white text-black font-semibold text-xs rounded-xl hover:bg-zinc-200 transition-colors flex items-center gap-2 cursor-pointer shadow-md"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Neuen Antrag einreichen</span>
          </button>
        </div>
      </div>
    );
  }

  // Application Form
  return (
    <div className="max-w-2xl mx-auto py-12 px-4 animate-in fade-in duration-200">
      <div className="p-8 liquid-glass rounded-2xl border border-white/10 space-y-6 shadow-2xl">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-xl bg-white/10 border border-white/15 text-white">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white">Creator-Zugang beantragen</h1>
            <p className="text-xs text-zinc-400 mt-1">
              Schalte das Nexus Creator CMS frei, um eigene Open-Source-Projekte, Case Studies und digitale Store-Vorlagen zu veröffentlichen.
            </p>
          </div>
        </div>

        {errorMsg && (
          <div className="p-3.5 bg-rose-950/40 border border-rose-800/50 rounded-xl text-xs text-rose-200 flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div>{errorMsg}</div>
          </div>
        )}

        {successMsg && (
          <div className="p-3.5 bg-emerald-950/40 border border-emerald-800/50 rounded-xl text-xs text-emerald-200 flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <div>{successMsg}</div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-2xs font-mono uppercase tracking-wider text-zinc-400 mb-1.5">
              Motivation &amp; Hintergrund *
            </label>
            <textarea
              required
              rows={3}
              value={motivation}
              onChange={(e) => setMotivation(e.target.value)}
              placeholder="Warum möchtest du Creator werden? Welches Fachwissen bringst du ein (z.B. C# .NET, DevOps, Fabric Modding, 3D-Druck)?"
              className="w-full px-3.5 py-2.5 bg-black/40 border border-white/10 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-white/40 resize-none"
            />
          </div>

          <div>
            <label className="block text-2xs font-mono uppercase tracking-wider text-zinc-400 mb-1.5">
              Geplante Portfolio-Projekte *
            </label>
            <textarea
              required
              rows={2}
              value={plannedProjects}
              onChange={(e) => setPlannedProjects(e.target.value)}
              placeholder="Welche Software-Projekte, Server-Setups oder Werkzeuge möchtest du dokumentieren und vorstellen?"
              className="w-full px-3.5 py-2.5 bg-black/40 border border-white/10 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-white/40 resize-none"
            />
          </div>

          <div>
            <label className="block text-2xs font-mono uppercase tracking-wider text-zinc-400 mb-1.5">
              Geplante Store-Inhalte &amp; Downloads *
            </label>
            <textarea
              required
              rows={2}
              value={plannedContent}
              onChange={(e) => setPlannedContent(e.target.value)}
              placeholder="z.B. Docker Compose Vorlagen, 3D-Modelle (STL), WPF-Snippets, Cheatsheets..."
              className="w-full px-3.5 py-2.5 bg-black/40 border border-white/10 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-white/40 resize-none"
            />
          </div>

          <div>
            <label className="block text-2xs font-mono uppercase tracking-wider text-zinc-400 mb-1.5">
              GitHub URL oder Portfolio (optional)
            </label>
            <input
              type="url"
              value={portfolioUrl}
              onChange={(e) => setPortfolioUrl(e.target.value)}
              placeholder="https://github.com/mein-profil"
              className="w-full px-3.5 py-2.5 bg-black/40 border border-white/10 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-white/40"
            />
          </div>

          <div className="pt-3 flex items-center justify-between border-t border-white/10">
            <span className="text-3xs text-zinc-500 font-mono">
              * Antragsentscheidungen werden serverseitig autorisiert und auditiert.
            </span>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 bg-white text-black font-semibold text-xs rounded-xl hover:bg-zinc-200 transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50 shadow-md shrink-0"
            >
              {isSubmitting ? (
                <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Antrag einreichen</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
