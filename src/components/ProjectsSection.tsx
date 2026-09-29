import React, { useState } from 'react';
import { INITIAL_PROJECTS, ProjectBlueprint } from '../data/initialData';
import { Layers, Copy, Check, Terminal, Code2, ExternalLink, Sparkles } from 'lucide-react';

interface ProjectsSectionProps {
  onAskAiAboutProject: (project: ProjectBlueprint) => void;
}

export const ProjectsSection: React.FC<ProjectsSectionProps> = ({ onAskAiAboutProject }) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const categories = [
    { id: 'all', name: 'Alle Systeme' },
    { id: 'Software', name: 'Software & C#' },
    { id: 'DevOps', name: 'HomeServer & Docker' },
    { id: 'GameServer', name: 'Game Server' },
    { id: 'AI & Automation', name: 'KI & n8n' },
    { id: 'ITA Curriculum', name: 'ITA 8051 Lab' },
    { id: 'Maker', name: '3D-Druck Bambu P1S' },
  ];

  const filteredProjects = INITIAL_PROJECTS.filter(
    (p) => selectedCategory === 'all' || p.category === selectedCategory
  );

  const handleCopyCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-white/10">
        <div>
          <span className="text-2xs font-semibold uppercase tracking-wider text-zinc-400">Systemarchitektur &amp; Vorlagen</span>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Layers className="w-5 h-5 text-white" />
            <span>Projekt-Blueprints &amp; System-Architektur</span>
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Reale, langlebige Systeme: Home-Server, C# .NET 10 WPF, Fabric Modding, 8051 Assembler und lokale KI.
          </p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 p-1 glass-1 border border-white/10 rounded-xl overflow-x-auto scrollbar-none">
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
              selectedCategory === cat.id
                ? 'bg-white text-black font-semibold'
                : 'text-zinc-400 hover:text-white hover:bg-white/5'
            }`}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {/* Projects Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filteredProjects.map((project) => (
          <div
            key={project.id}
            className="glass-1 liquid-glass-hover border border-white/10 rounded-2xl p-6 flex flex-col justify-between space-y-5"
          >
            <div className="space-y-3.5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-white">{project.title}</h3>
                  <div className="flex items-center gap-2 text-2xs text-zinc-400 mt-1">
                    <span>{project.category}</span>
                    <span aria-hidden="true">·</span>
                    <span className="text-zinc-200 font-mono font-medium">{project.status}</span>
                  </div>
                </div>

                <button
                  onClick={() => onAskAiAboutProject(project)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-2xs btn-secondary rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  title="Im KI-Assistenten analysieren & erweitern"
                >
                  <Sparkles className="w-3 h-3 text-white" />
                  <span>Assistent fragen</span>
                </button>
              </div>

              <p className="text-xs text-zinc-300 leading-relaxed">{project.description}</p>

              {/* Tech Stack List */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {project.techStack.map((tech, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-0.5 text-2xs font-mono bg-white/5 text-zinc-300 border border-white/10 rounded"
                  >
                    {tech}
                  </span>
                ))}
              </div>

              {/* Architecture Key Points */}
              <div className="pt-3 border-t border-white/10">
                <span className="text-2xs font-semibold uppercase tracking-wider text-zinc-400 block mb-2">
                  Architektur-Merkmale:
                </span>
                <ul className="text-xs text-zinc-400 space-y-1.5 list-disc list-inside">
                  {project.details.keyPoints.map((kp, idx) => (
                    <li key={idx} className="leading-relaxed text-zinc-300">
                      {kp}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Code Snippet Box */}
            <div className="pt-3 border-t border-white/10">
              <div className="flex items-center justify-between text-2xs text-zinc-400 mb-2">
                <span className="font-mono text-zinc-200 flex items-center gap-1.5">
                  <Terminal className="w-3.5 h-3.5 text-white" />
                  {project.details.quickSnippetTitle}
                </span>
                <button
                  onClick={() => handleCopyCode(project.details.quickSnippet, project.id)}
                  className="hover:text-white flex items-center gap-1 cursor-pointer transition-colors"
                >
                  {copiedId === project.id ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-white" />
                      <span className="text-white font-medium">Kopiert</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Kopieren</span>
                    </>
                  )}
                </button>
              </div>
              <pre className="p-3.5 bg-black/60 border border-white/10 rounded-xl font-mono text-2xs text-zinc-300 overflow-x-auto max-h-48 leading-relaxed scrollbar-none">
                {project.details.quickSnippet}
              </pre>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
