import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Project } from '../types/platform';
import {
  Layers,
  Search,
  ExternalLink,
  Github,
  ArrowLeft,
  ArrowRight,
  Code2,
  CheckCircle2,
  Cpu,
  Terminal,
} from 'lucide-react';

interface PortfolioPageProps {
  selectedSlug?: string;
  onNavigateToProject?: (slug: string) => void;
  onBack?: () => void;
}

export const PortfolioPage: React.FC<PortfolioPageProps> = ({
  selectedSlug,
  onNavigateToProject,
  onBack,
}) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    api.getProjects()
      .then((data) => {
        setProjects(data);
        if (selectedSlug) {
          const found = data.find((p) => p.slug === selectedSlug);
          if (found) setActiveProject(found);
        } else {
          setActiveProject(null);
        }
      })
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, [selectedSlug]);

  const categories = [
    { id: 'all', label: 'Alle Systeme' },
    { id: 'Software', label: 'Software & C#' },
    { id: 'DevOps', label: 'DevOps & HomeServer' },
    { id: 'GameServer', label: 'Game Server' },
    { id: 'AI & Automation', label: 'KI & n8n' },
    { id: 'Maker', label: '3D-Druck & Bambu' },
    { id: 'ITA Curriculum', label: '8051 & ITA' },
  ];

  const filtered = projects.filter((p) => {
    const matchesCat = selectedCategory === 'all' || p.category === selectedCategory;
    const matchesSearch =
      !searchQuery ||
      p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.shortDesc.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.techStack.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCat && matchesSearch;
  });

  // CASE STUDY / DETAIL VIEW
  if (activeProject) {
    return (
      <div className="max-w-5xl mx-auto py-8 px-4 sm:px-6 space-y-8 animate-in fade-in duration-150">
        <button
          onClick={() => {
            setActiveProject(null);
            if (onBack) onBack();
          }}
          className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-400 hover:text-white transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Zurück zur Übersicht</span>
        </button>

        {/* Hero Header */}
        <div className="p-8 liquid-glass rounded-2xl border border-white/10 space-y-4">
          <div className="flex items-center gap-2 text-2xs text-zinc-400">
            <span>{activeProject.category}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono text-zinc-200">{activeProject.status}</span>
          </div>

          <h1 className="text-2xl sm:text-4xl font-extrabold text-white">{activeProject.title}</h1>
          <p className="text-sm text-zinc-300 leading-relaxed max-w-3xl">{activeProject.description}</p>

          <div className="flex flex-wrap gap-2 pt-2">
            {activeProject.techStack.map((tech, idx) => (
              <span
                key={idx}
                className="px-2.5 py-1 text-2xs font-mono bg-white/5 border border-white/10 text-white rounded"
              >
                {tech}
              </span>
            ))}
          </div>

          <div className="flex items-center gap-4 pt-3 border-t border-white/10">
            {activeProject.githubUrl && (
              <a
                href={activeProject.githubUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-white/10 hover:bg-white text-white hover:text-black text-xs font-semibold rounded-lg transition-colors"
              >
                <Github className="w-4 h-4" />
                <span>GitHub Repository</span>
              </a>
            )}
            {activeProject.liveUrl && (
              <a
                href={activeProject.liveUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-white text-black font-semibold text-xs rounded-lg hover:bg-zinc-200 transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                <span>Live System</span>
              </a>
            )}
          </div>
        </div>

        {/* Problem & Solution Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-6 liquid-glass rounded-xl border border-white/10 space-y-2">
            <span className="text-2xs font-semibold uppercase tracking-wider text-zinc-400">01. Problemstellung</span>
            <h3 className="text-sm font-bold text-white">Herausforderung</h3>
            <p className="text-xs text-zinc-300 leading-relaxed">{activeProject.problem}</p>
          </div>

          <div className="p-6 liquid-glass rounded-xl border border-white/10 space-y-2">
            <span className="text-2xs font-semibold uppercase tracking-wider text-zinc-400">02. Technische Lösung</span>
            <h3 className="text-sm font-bold text-white">Implementierung &amp; Ergebnis</h3>
            <p className="text-xs text-zinc-300 leading-relaxed">{activeProject.solution}</p>
          </div>
        </div>

        {/* Architecture & Key Features */}
        <div className="p-6 liquid-glass rounded-xl border border-white/10 space-y-4">
          <div>
            <span className="text-2xs font-semibold uppercase tracking-wider text-zinc-400">03. Architektur &amp; Prinzipien</span>
            <h3 className="text-sm font-bold text-white mt-1">Systemdesign &amp; Schichtentrennung</h3>
            <p className="text-xs text-zinc-300 leading-relaxed mt-1.5">{activeProject.architecture}</p>
          </div>

          <div className="pt-4 border-t border-white/10">
            <span className="text-xs font-semibold text-white block mb-2">Kernfunktionen:</span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {activeProject.keyFeatures.map((feat, idx) => (
                <div key={idx} className="flex items-start gap-2 text-xs text-zinc-300">
                  <CheckCircle2 className="w-4 h-4 text-white shrink-0 mt-0.5" />
                  <span>{feat}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // LIST OVERVIEW
  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-white/10">
        <div>
          <span className="text-2xs font-semibold uppercase tracking-wider text-zinc-400">Showcase &amp; Systeme</span>
          <h1 className="text-xl sm:text-2xl font-bold text-white">Engineering Portfolio</h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Echte Systeme: Home-Server Architektur, C# WPF .NET 10, Minecraft Fabric Modding und 8051 Assembler-Labore.
          </p>
        </div>

        {/* Search */}
        <div className="relative w-full md:w-64">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Projekte durchsuchen..."
            className="w-full pl-9 pr-3 py-1.5 text-xs liquid-glass-input rounded-lg"
          />
        </div>
      </div>

      {/* Category Filter */}
      <div className="flex items-center gap-1.5 p-1 liquid-glass rounded-xl overflow-x-auto scrollbar-none border border-white/10">
        {categories.map((c) => (
          <button
            key={c.id}
            onClick={() => setSelectedCategory(c.id)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
              selectedCategory === c.id
                ? 'bg-white text-black font-semibold'
                : 'text-zinc-400 hover:text-white hover:bg-white/5'
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="py-16 text-center text-xs text-zinc-500">Lade Portfolio...</div>
      ) : filtered.length === 0 ? (
        <div className="py-20 text-center text-zinc-500 liquid-glass rounded-2xl border border-white/10 space-y-3">
          <Layers className="w-12 h-12 mx-auto text-zinc-600 stroke-[1.5]" />
          <p className="text-base font-semibold text-white">
            {projects.length === 0 ? 'Noch keine Projekte vorhanden.' : 'Keine Projekte für diesen Filter gefunden.'}
          </p>
          <p className="text-xs text-zinc-400 max-w-sm mx-auto">
            {projects.length === 0
              ? 'Es wurden noch keine Projekte im System veröffentlicht. Nutze das Creator CMS Studio, um dein erstes Projekt mit Case Study anzulegen.'
              : 'Passe deine Filtersuche oder den gewählten Technologiebereich an.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((proj) => (
            <div
              key={proj.id}
              onClick={() => {
                setActiveProject(proj);
                if (onNavigateToProject) onNavigateToProject(proj.slug);
              }}
              className="p-6 liquid-glass liquid-glass-hover rounded-xl border border-white/10 flex flex-col justify-between space-y-4 cursor-pointer"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between text-2xs text-zinc-400">
                  <span>{proj.category}</span>
                  <span className="font-mono text-zinc-200">{proj.status}</span>
                </div>

                <h3 className="text-base font-bold text-white leading-snug">{proj.title}</h3>
                <p className="text-xs text-zinc-400 line-clamp-3 leading-relaxed">{proj.shortDesc}</p>
              </div>

              <div className="space-y-3 pt-3 border-t border-white/10">
                <div className="flex flex-wrap gap-1">
                  {proj.techStack.map((tech, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-0.5 text-2xs font-mono bg-white/5 border border-white/10 rounded text-zinc-300"
                    >
                      {tech}
                    </span>
                  ))}
                </div>

                <div className="flex items-center justify-between text-2xs pt-1">
                  <span className="text-white font-semibold flex items-center gap-1">
                    <span>Case Study &amp; Details</span>
                    <ArrowRight className="w-3 h-3" />
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
