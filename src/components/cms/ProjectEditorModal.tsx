import React, { useState, useEffect } from 'react';
import { Project, ContentStatus } from '../../types/platform';
import { api } from '../../services/api';
import { MediaManagerModal } from './MediaManagerModal';
import {
  X,
  Layers,
  Save,
  Send,
  Eye,
  Github,
  ExternalLink,
  Code2,
  FileText,
  Cpu,
  Sparkles,
  Check,
  Plus,
  Trash2,
  AlertCircle,
  HelpCircle,
  Film,
  BookOpen,
} from 'lucide-react';

interface ProjectEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: (project: Project) => void;
  initialProject?: Project | null;
}

const COMMON_TECH_STACK = [
  'C#',
  '.NET 10',
  'WPF / MVVM',
  'React',
  'TypeScript',
  'Tailwind CSS',
  'Java',
  'Python',
  'Docker',
  'Docker Compose',
  'MariaDB',
  'MySQL',
  'Ubuntu Server',
  'Tailscale',
  'CasaOS',
  'Nginx Proxy Manager',
  'n8n',
  'Ollama',
  '8051 Assembler',
  'Bambu Studio',
  'Bambu Lab P1S',
  'Gridfinity',
  'REST API',
  'Express',
  'Hibernate',
  'C++',
];

const CATEGORIES = [
  'Software',
  'DevOps',
  'GameServer',
  'AI & Automation',
  'Maker',
  'ITA Curriculum',
];

export const ProjectEditorModal: React.FC<ProjectEditorModalProps> = ({
  isOpen,
  onClose,
  onSaved,
  initialProject,
}) => {
  const [activeTab, setActiveTab] = useState<
    'basics' | 'description' | 'tech' | 'casestudy' | 'links' | 'media' | 'preview'
  >('basics');

  // Form State
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [shortDesc, setShortDesc] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Software');
  const [status, setStatus] = useState<ContentStatus>('DRAFT');
  const [visibility, setVisibility] = useState<'PUBLIC' | 'PRIVATE'>('PUBLIC');
  const [featured, setFeatured] = useState(false);

  // Tech stack
  const [techStack, setTechStack] = useState<string[]>([]);
  const [techInput, setTechInput] = useState('');

  // Case study
  const [problem, setProblem] = useState('');
  const [solution, setSolution] = useState('');
  const [architecture, setArchitecture] = useState('');
  const [goal, setGoal] = useState('');
  const [caseStudyLearnings, setCaseStudyLearnings] = useState('');
  const [result, setResult] = useState('');

  // Links
  const [githubUrl, setGithubUrl] = useState('');
  const [liveUrl, setLiveUrl] = useState('');
  const [demoUrl, setDemoUrl] = useState('');
  const [documentationUrl, setDocumentationUrl] = useState('');
  const [videoUrl, setVideoUrl] = useState('');

  // Media
  const [coverImage, setCoverImage] = useState('');
  const [coverMediaId, setCoverMediaId] = useState('');
  const [galleryMediaIds, setGalleryMediaIds] = useState<string[]>([]);
  const [isMediaManagerOpen, setIsMediaManagerOpen] = useState(false);
  const [mediaTarget, setMediaTarget] = useState<'cover' | 'gallery'>('cover');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (initialProject) {
      setTitle(initialProject.title || '');
      setSlug(initialProject.slug || '');
      setShortDesc(initialProject.shortDesc || '');
      setDescription(initialProject.description || '');
      setCategory(initialProject.category || 'Software');
      setStatus((initialProject.status as ContentStatus) || 'DRAFT');
      setVisibility(initialProject.visibility || 'PUBLIC');
      setFeatured(Boolean(initialProject.featured));
      setTechStack(initialProject.techStack || []);
      setProblem(initialProject.caseStudyProblem || initialProject.problem || '');
      setSolution(initialProject.caseStudySolution || initialProject.solution || '');
      setArchitecture(initialProject.architecture || '');
      setGoal(initialProject.goal || '');
      setCaseStudyLearnings(initialProject.caseStudyLearnings || '');
      setResult(initialProject.result || '');
      setGithubUrl(initialProject.githubUrl || '');
      setLiveUrl(initialProject.liveUrl || '');
      setDemoUrl(initialProject.demoUrl || '');
      setDocumentationUrl(initialProject.documentationUrl || '');
      setVideoUrl(initialProject.videoUrl || '');
      setCoverImage(initialProject.coverImage || '');
      setCoverMediaId(initialProject.coverMediaId || '');
      setGalleryMediaIds(initialProject.galleryMediaIds || []);
    } else {
      // Reset defaults for new project
      setTitle('');
      setSlug('');
      setShortDesc('');
      setDescription('');
      setCategory('Software');
      setStatus('DRAFT');
      setVisibility('PUBLIC');
      setFeatured(false);
      setTechStack(['C#', '.NET 10', 'WPF / MVVM']);
      setProblem('');
      setSolution('');
      setArchitecture('');
      setGoal('');
      setCaseStudyLearnings('');
      setResult('');
      setGithubUrl('');
      setLiveUrl('');
      setDemoUrl('');
      setDocumentationUrl('');
      setVideoUrl('');
      setCoverImage('');
      setCoverMediaId('');
      setGalleryMediaIds([]);
    }
    setActiveTab('basics');
    setErrorMsg(null);
  }, [initialProject, isOpen]);

  if (!isOpen) return null;

  const handleTitleChange = (val: string) => {
    setTitle(val);
    if (!initialProject) {
      setSlug(
        val
          .toLowerCase()
          .replace(/ä/g, 'ae')
          .replace(/ö/g, 'oe')
          .replace(/ü/g, 'ue')
          .replace(/ß/g, 'ss')
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '')
      );
    }
  };

  const handleAddTech = (tech: string) => {
    const trimmed = tech.trim();
    if (trimmed && !techStack.includes(trimmed)) {
      setTechStack([...techStack, trimmed]);
    }
    setTechInput('');
  };

  const handleRemoveTech = (tech: string) => {
    setTechStack(techStack.filter((t) => t !== tech));
  };

  const handleSave = async (targetStatus?: ContentStatus) => {
    if (!title.trim()) {
      setErrorMsg('Bitte gib einen Projekttitel ein.');
      setActiveTab('basics');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    const effectiveStatus = targetStatus || status;

    const payload: Partial<Project> = {
      title,
      slug: slug || title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      shortDesc,
      description,
      category,
      status: effectiveStatus,
      visibility,
      featured,
      techStack,
      caseStudyProblem: problem,
      problem,
      caseStudySolution: solution,
      solution,
      goal,
      result,
      architecture,
      caseStudyLearnings,
      githubUrl: githubUrl || undefined,
      liveUrl: liveUrl || undefined,
      demoUrl: demoUrl || undefined,
      documentationUrl: documentationUrl || undefined,
      videoUrl: videoUrl || undefined,
      coverMediaId: coverMediaId || undefined,
      galleryMediaIds,
    };

    try {
      let saved: Project;
      if (initialProject && initialProject.id) {
        saved = await api.updateProject(initialProject.id, payload);
      } else {
        saved = await api.createProject(payload);
      }
      onSaved(saved);
      onClose();
    } catch (err: any) {
      console.error('Failed to save project:', err);
      setErrorMsg(err.message || 'Fehler beim Speichern des Projekts.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-4xl glass-2 border border-white/15 rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden my-auto animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center text-white">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">
                {initialProject ? 'Projekt bearbeiten' : 'Neues Projekt erstellen'}
              </h2>
              <p className="text-2xs font-mono text-zinc-400">
                Nexus CMS · Liquid Glass Case Study Builder
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`px-2 py-0.5 rounded text-2xs font-mono font-bold uppercase tracking-wider ${
                status === 'PUBLISHED'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : status === 'ARCHIVED'
                  ? 'bg-zinc-700/40 text-zinc-400 border border-zinc-600/30'
                  : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
              }`}
            >
              {status}
            </span>
            <button
              onClick={onClose}
              className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 px-6 pt-2 pb-2 border-b border-white/10 bg-black/20 overflow-x-auto scrollbar-none text-xs">
          {[
            { id: 'basics', label: '1. Basics' },
            { id: 'description', label: '2. Beschreibung' },
            { id: 'tech', label: '3. Technologien' },
            { id: 'casestudy', label: '4. Case Study' },
            { id: 'links', label: '5. Links & Demos' },
            { id: 'media', label: '6. Medien' },
            { id: 'preview', label: '7. Live-Vorschau' },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as any)}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all whitespace-nowrap cursor-pointer ${
                activeTab === t.id
                  ? 'bg-white text-black font-semibold shadow-sm'
                  : 'text-zinc-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Error message */}
        {errorMsg && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-rose-950/40 border border-rose-800/50 text-xs text-rose-200 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Form Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6 text-xs text-zinc-300">
          {/* TAB 1: BASICS */}
          {activeTab === 'basics' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-2xs font-mono uppercase text-zinc-400">Projekttitel *</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => handleTitleChange(e.target.value)}
                    placeholder="z.B. ITA Learning Platform & WPF Dashboard"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-zinc-500 focus:outline-none focus:border-white/30"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-2xs font-mono uppercase text-zinc-400">Slug (URL-Pfad)</label>
                  <input
                    type="text"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    placeholder="ita-learning-platform"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 font-mono text-zinc-300 placeholder-zinc-500 focus:outline-none focus:border-white/30"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-2xs font-mono uppercase text-zinc-400">Kategorie</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-white/10 text-white focus:outline-none focus:border-white/30"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c} className="bg-zinc-900 text-white">
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-2xs font-mono uppercase text-zinc-400">Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as ContentStatus)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-white/10 text-white focus:outline-none focus:border-white/30"
                  >
                    <option value="DRAFT">DRAFT (Entwurf - noch nicht öffentlich)</option>
                    <option value="PUBLISHED">PUBLISHED (Sofort öffentlich im Portfolio)</option>
                    <option value="ARCHIVED">ARCHIVED (Archiviert)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-2xs font-mono uppercase text-zinc-400">Sichtbarkeit</label>
                  <select
                    value={visibility}
                    onChange={(e) => setVisibility(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-white/10 text-white focus:outline-none focus:border-white/30"
                  >
                    <option value="PUBLIC">Öffentlich (Portfolio &amp; Suche)</option>
                    <option value="PRIVATE">Privat (Nur autorisierte Nutzer)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-2xs font-mono uppercase text-zinc-400">
                  Kurzbeschreibung (Teaser)
                </label>
                <textarea
                  value={shortDesc}
                  onChange={(e) => setShortDesc(e.target.value)}
                  rows={2}
                  placeholder="Kompakte Zusammenfassung für Portfolio-Karten und Vorschauen..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-zinc-500 focus:outline-none focus:border-white/30"
                />
              </div>

              <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10">
                <input
                  type="checkbox"
                  id="featured-check"
                  checked={featured}
                  onChange={(e) => setFeatured(e.target.checked)}
                  className="w-4 h-4 rounded border-white/20 bg-black/40 text-white focus:ring-0 cursor-pointer"
                />
                <label htmlFor="featured-check" className="cursor-pointer">
                  <span className="font-semibold text-white block">Als Highlight-Projekt markieren</span>
                  <span className="text-2xs text-zinc-400 block">
                    Wird prominent auf der Startseite im Feature-Karussell präsentiert.
                  </span>
                </label>
              </div>
            </div>
          )}

          {/* TAB 2: DESCRIPTION */}
          {activeTab === 'description' && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-2xs font-mono uppercase text-zinc-400">
                  Ausführliche Projektbeschreibung (Markdown unterstützt)
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={12}
                  placeholder="Detaillierte Beschreibung der Anforderungen, des Systems, der Schnittstellen und des Nutzens..."
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-zinc-500 font-mono text-xs leading-relaxed focus:outline-none focus:border-white/30"
                />
              </div>
            </div>
          )}

          {/* TAB 3: TECHNOLOGIES */}
          {activeTab === 'tech' && (
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-2xs font-mono uppercase text-zinc-400">
                  Ausgewählte Technologien ({techStack.length})
                </label>
                <div className="flex flex-wrap gap-1.5 min-h-[44px] p-3 rounded-xl bg-white/5 border border-white/10 items-center">
                  {techStack.length === 0 ? (
                    <span className="text-zinc-500 text-2xs">Keine Technologien ausgewählt</span>
                  ) : (
                    techStack.map((tech) => (
                      <span
                        key={tech}
                        className="px-2.5 py-1 bg-white/15 border border-white/20 rounded-md text-white font-mono text-2xs flex items-center gap-1.5"
                      >
                        <span>{tech}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveTech(tech)}
                          className="hover:text-rose-300 cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))
                  )}
                </div>
              </div>

              {/* Custom Add */}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={techInput}
                  onChange={(e) => setTechInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddTech(techInput);
                    }
                  }}
                  placeholder="Eigene Technologie hinzufügen (z.B. Avalonia, Ktor)..."
                  className="flex-1 px-3.5 py-2 rounded-xl bg-white/5 border border-white/10 text-white placeholder-zinc-500 text-xs focus:outline-none focus:border-white/30"
                />
                <button
                  type="button"
                  onClick={() => handleAddTech(techInput)}
                  className="px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/15 text-white font-semibold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Hinzufügen</span>
                </button>
              </div>

              {/* Suggestions */}
              <div className="space-y-2">
                <span className="text-2xs font-mono uppercase text-zinc-400 block">
                  Schnellauswahl gängiger Stack-Komponenten:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {COMMON_TECH_STACK.map((tech) => {
                    const isSelected = techStack.includes(tech);
                    return (
                      <button
                        key={tech}
                        type="button"
                        onClick={() =>
                          isSelected ? handleRemoveTech(tech) : handleAddTech(tech)
                        }
                        className={`px-2.5 py-1 rounded-lg text-2xs font-mono transition-colors cursor-pointer border ${
                          isSelected
                            ? 'bg-white text-black font-bold border-white'
                            : 'bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white border-white/10'
                        }`}
                      >
                        {isSelected ? '✓ ' : '+ '}
                        {tech}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: CASE STUDY */}
          {activeTab === 'casestudy' && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-2xs font-mono uppercase text-zinc-400">
                  1. Problem &amp; Herausforderung
                </label>
                <textarea
                  value={problem}
                  onChange={(e) => setProblem(e.target.value)}
                  rows={3}
                  placeholder="Welches konkrete Problem löst dieses System? (z.B. manuelle Datenbank-Backups, fehlende Schichtentrennung in WPF)..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-zinc-500 focus:outline-none focus:border-white/30"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-2xs font-mono uppercase text-zinc-400">
                  2. Architektur &amp; Systemkonzept
                </label>
                <textarea
                  value={architecture}
                  onChange={(e) => setArchitecture(e.target.value)}
                  rows={3}
                  placeholder="Wie ist das System strukturiert? (z.B. MVVM, Container-Netzwerk auf HP EliteDesk, MariaDB 11, Tailscale VPN)..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-zinc-500 focus:outline-none focus:border-white/30"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-2xs font-mono uppercase text-zinc-400">3. Ziel</label>
                <textarea
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                  rows={3}
                  placeholder="Welches konkrete Ziel sollte das Projekt erreichen?"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-zinc-500 focus:outline-none focus:border-white/30"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-2xs font-mono uppercase text-zinc-400">
                  4. Technische Lösung &amp; Umsetzung
                </label>
                <textarea
                  value={solution}
                  onChange={(e) => setSolution(e.target.value)}
                  rows={3}
                  placeholder="Wie wurde das System implementiert? Konkrete Bibliotheken, Muster und Mechanismen..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-zinc-500 focus:outline-none focus:border-white/30"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-2xs font-mono uppercase text-zinc-400">
                  5. Ergebnis
                </label>
                <textarea
                  value={result}
                  onChange={(e) => setResult(e.target.value)}
                  rows={3}
                  placeholder="Was wurde erreicht und wie lässt sich das Ergebnis bewerten?"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-zinc-500 focus:outline-none focus:border-white/30"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-2xs font-mono uppercase text-zinc-400">
                  6. Erkenntnisse &amp; Learnings (Post-Mortem)
                </label>
                <textarea
                  value={caseStudyLearnings}
                  onChange={(e) => setCaseStudyLearnings(e.target.value)}
                  rows={3}
                  placeholder="Was hat sich bewährt? Was würde in Revision 2.0 anders gemacht werden? (ITA-Ausbildungsbezug)..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-zinc-500 focus:outline-none focus:border-white/30"
                />
              </div>
            </div>
          )}

          {/* TAB 5: LINKS */}
          {activeTab === 'links' && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-2xs font-mono uppercase text-zinc-400">GitHub Repository URL</label>
                <input
                  type="url"
                  value={githubUrl}
                  onChange={(e) => setGithubUrl(e.target.value)}
                  placeholder="https://github.com/username/project"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-zinc-500 focus:outline-none focus:border-white/30 font-mono text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-2xs font-mono uppercase text-zinc-400">Live Demo URL</label>
                <input
                  type="url"
                  value={liveUrl}
                  onChange={(e) => setLiveUrl(e.target.value)}
                  placeholder="https://nexus.local oder https://demo.meinedomain.de"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-zinc-500 focus:outline-none focus:border-white/30 font-mono text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-2xs font-mono uppercase text-zinc-400">Dokumentations-URL</label>
                <input
                  type="url"
                  value={documentationUrl}
                  onChange={(e) => setDocumentationUrl(e.target.value)}
                  placeholder="https://docs.nexus.local/projects/ita"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-zinc-500 focus:outline-none focus:border-white/30 font-mono text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-2xs font-mono uppercase text-zinc-400">Video Walkthrough URL</label>
                <input
                  type="url"
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  placeholder="https://youtube.com/watch?v=... oder MP4 Stream"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-zinc-500 focus:outline-none focus:border-white/30 font-mono text-xs"
                />
              </div>
            </div>
          )}

          {/* TAB 6: MEDIA */}
          {activeTab === 'media' && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-2xs font-mono uppercase text-zinc-400">Cover aus der Mediathek</label>
                <div className="flex items-center gap-2">
                  {coverMediaId && <span className="min-w-0 flex-1 truncate text-2xs text-zinc-400 font-mono">Cover verknüpft</span>}
                  <button
                    type="button"
                    onClick={() => {
                      setMediaTarget('cover');
                      setIsMediaManagerOpen(true);
                    }}
                    className="px-3 py-2 glass-2 border border-white/15 rounded-lg text-xs text-white"
                  >
                    Mediathek
                  </button>
                  {coverMediaId && (
                    <button type="button" onClick={() => { setCoverMediaId(''); setCoverImage(''); }} className="p-2 text-zinc-400 hover:text-rose-300" aria-label="Cover entfernen">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {coverImage && (
                <div className="space-y-1.5">
                  <span className="text-2xs font-mono uppercase text-zinc-400 block">Bild-Vorschau:</span>
                  <div className="h-44 w-full rounded-xl overflow-hidden border border-white/15 bg-black/40">
                    <img
                      src={coverImage}
                      alt="Cover Preview"
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-2xs font-mono uppercase text-zinc-400">Weitere Projektbilder</label>
                  <button
                    type="button"
                    onClick={() => {
                      setMediaTarget('gallery');
                      setIsMediaManagerOpen(true);
                    }}
                    className="px-3 py-1.5 glass-2 border border-white/15 rounded-lg text-2xs text-white"
                  >
                    Aus Mediathek
                  </button>
                </div>
                {galleryMediaIds.length > 0 && (
                  <ul className="space-y-1">
                    {galleryMediaIds.map((mediaId, index) => (
                      <li key={mediaId} className="flex items-center gap-2 text-2xs text-zinc-300">
                        <img src={`/api/media/${encodeURIComponent(mediaId)}/file`} alt={`Projektbild ${index + 1}`} className="w-12 h-8 rounded object-cover" />
                        <span className="truncate flex-1">Bild {index + 1}</span>
                        <button
                          type="button"
                          onClick={() => setGalleryMediaIds(galleryMediaIds.filter((id) => id !== mediaId))}
                          className="text-zinc-400 hover:text-rose-300"
                          aria-label="Bild aus Galerie entfernen"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}

          {/* TAB 7: LIVE PREVIEW */}
          {activeTab === 'preview' && (
            <div className="space-y-6">
              <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-xs text-zinc-300">
                <span className="font-semibold text-white">Live-Vorschau für das Portfolio</span>
                <p className="text-2xs text-zinc-400 mt-0.5">
                  So wird das Projekt im öffentlichen Portfolio und in der Case Study gerendert.
                </p>
              </div>

              {/* Portfolio Detail Mockup */}
              <div className="p-6 liquid-glass rounded-2xl border border-white/15 space-y-4">
                <div className="flex items-center gap-2 text-2xs text-zinc-400">
                  <span className="font-medium text-white">{category}</span>
                  <span>·</span>
                  <span className="font-mono text-zinc-300">{status}</span>
                  <span>·</span>
                  <span className="font-mono text-zinc-400">{visibility}</span>
                </div>

                <h1 className="text-2xl font-extrabold text-white">
                  {title || 'Titel des Projekts'}
                </h1>
                <p className="text-xs text-zinc-300 leading-relaxed">
                  {shortDesc || 'Keine Kurzbeschreibung vorhanden.'}
                </p>

                <div className="flex flex-wrap gap-1.5 pt-2">
                  {techStack.map((tech) => (
                    <span
                      key={tech}
                      className="px-2.5 py-1 text-2xs font-mono bg-white/10 border border-white/15 text-white rounded"
                    >
                      {tech}
                    </span>
                  ))}
                </div>

                {(problem || solution || architecture) && (
                  <div className="pt-4 border-t border-white/10 space-y-3">
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                      Case Study Highlights
                    </h4>
                    {problem && (
                      <div className="p-3 bg-white/5 rounded-lg border border-white/5">
                        <span className="text-2xs font-mono uppercase text-zinc-400 block font-bold">
                          Problem:
                        </span>
                        <p className="text-xs text-zinc-300 mt-1">{problem}</p>
                      </div>
                    )}
                    {architecture && (
                      <div className="p-3 bg-white/5 rounded-lg border border-white/5">
                        <span className="text-2xs font-mono uppercase text-zinc-400 block font-bold">
                          Architektur:
                        </span>
                        <p className="text-xs text-zinc-300 mt-1">{architecture}</p>
                      </div>
                    )}
                    {solution && (
                      <div className="p-3 bg-white/5 rounded-lg border border-white/5">
                        <span className="text-2xs font-mono uppercase text-zinc-400 block font-bold">
                          Lösung:
                        </span>
                        <p className="text-xs text-zinc-300 mt-1">{solution}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-white/10 bg-white/[0.02] flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-zinc-400 hover:text-white rounded-xl hover:bg-white/5 transition-colors cursor-pointer"
          >
            Abbrechen
          </button>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => handleSave('DRAFT')}
              className="px-4 py-2 glass-2 border border-white/15 text-zinc-200 hover:text-white text-xs font-semibold rounded-xl hover:bg-white/10 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>Als Entwurf speichern</span>
            </button>

            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => handleSave('PUBLISHED')}
              className="px-5 py-2 bg-white text-black font-bold text-xs rounded-xl hover:bg-zinc-200 transition-colors flex items-center gap-1.5 cursor-pointer shadow-lg disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              <span>{initialProject ? 'Änderungen veröffentlichen' : 'Projekt veröffentlichen'}</span>
            </button>
          </div>
        </div>
      </div>

      <MediaManagerModal
        isOpen={isMediaManagerOpen}
        onClose={() => setIsMediaManagerOpen(false)}
        onSelectMedia={(media) => {
          if (media.fileCategory !== 'image') {
            setErrorMsg('Projektcover und Galerie benötigen Bilddateien.');
          } else if (mediaTarget === 'cover') {
            setCoverMediaId(media.id);
            setCoverImage(media.storagePath);
          } else if (media.fileCategory === 'image' && !galleryMediaIds.includes(media.id) && galleryMediaIds.length < 20) {
            setGalleryMediaIds([...galleryMediaIds, media.id]);
          }
        }}
      />
    </div>
  );
};
