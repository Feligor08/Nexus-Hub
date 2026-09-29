import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Project, Product, Post } from '../types/platform';
import {
  Sparkles,
  ArrowRight,
  Layers,
  ShoppingBag,
  MessageSquare,
  Bot,
  Bug,
  Server,
  Cpu,
  Terminal,
  Shield,
  Download,
  Calendar,
  CheckCircle,
  Code2,
  HardDrive,
  GitBranch,
} from 'lucide-react';

interface HomePageProps {
  onNavigate: (view: string, detailSlug?: string) => void;
}

export const HomePage: React.FC<HomePageProps> = ({ onNavigate }) => {
  const [featuredProjects, setFeaturedProjects] = useState<Project[]>([]);
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([]);
  const [latestPosts, setLatestPosts] = useState<Post[]>([]);

  useEffect(() => {
    api.getProjects().then((list) => setFeaturedProjects(list.slice(0, 3))).catch(console.error);
    api.getProducts().then((list) => setFeaturedProducts(list.slice(0, 3))).catch(console.error);
    api.getPosts().then((list) => setLatestPosts(list.slice(0, 3))).catch(console.error);
  }, []);

  return (
    <div className="space-y-28 py-12 px-4 sm:px-8 max-w-7xl mx-auto">
      {/* 1. HERO SECTION: Split Layout (Text Links, Abstract Technical Visual Rechts) */}
      <section className="relative pt-6 pb-8 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
        {/* Ambient subtle glow */}
        <div className="monochrome-glow -top-20 left-10"></div>

        {/* Text Left (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full glass-1 border border-white/10 text-2xs text-zinc-300">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
            <span>Developer Platform · AI Workspace · Systems Portfolio</span>
          </div>

          <div className="space-y-2">
            <h1 className="text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tight text-white leading-none">
              NEXUS CODE PLAY
            </h1>
            <p className="text-xl sm:text-2xl text-zinc-400 font-medium tracking-tight">
              Build. Create. Share. Connect.
            </p>
          </div>

          <p className="text-sm text-zinc-400 max-w-xl leading-relaxed">
            Die modulare Plattform für anspruchsvolle Entwickler, IT-Auszubildende und Maker. Vereint persönliche KI-Assistenten, 5-Stufen Debugging, echte Projekt-Showcases, einen digitalen Store und eine Entwickler-Community in einem hochpräzisen Liquid Glass UI.
          </p>

          {/* CTAs */}
          <div className="flex flex-wrap items-center gap-3.5 pt-2">
            <button
              onClick={() => onNavigate('ai')}
              className="px-6 py-3 btn-primary text-xs rounded-lg flex items-center gap-2 cursor-pointer shadow-sm"
            >
              <Bot className="w-4 h-4" />
              <span>AI Assistant starten</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              onClick={() => onNavigate('portfolio')}
              className="px-5 py-3 btn-secondary text-xs rounded-lg flex items-center gap-2 cursor-pointer"
            >
              <Layers className="w-4 h-4" />
              <span>Portfolio ansehen</span>
            </button>

            <button
              onClick={() => onNavigate('store')}
              className="px-4 py-3 btn-ghost text-xs rounded-lg flex items-center gap-1.5 cursor-pointer"
            >
              <span>Store entdecken</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Abstract Technical Visual Rechts (5 cols) */}
        <div className="lg:col-span-5 relative">
          <div className="p-6 glass-2 rounded-2xl border border-white/10 relative overflow-hidden tech-grid shadow-2xl">
            {/* Visual Header */}
            <div className="flex items-center justify-between pb-3 border-b border-white/10 text-2xs text-zinc-400">
              <div className="flex items-center gap-2 font-mono">
                <Terminal className="w-3.5 h-3.5 text-white" />
                <span>node_cluster.architecture</span>
              </div>
              <span className="font-mono text-zinc-300">status: optimal</span>
            </div>

            {/* Architecture Node Diagram Simulation in Pure Monochrome */}
            <div className="py-4 space-y-3 font-mono text-xs">
              <div className="p-3 bg-white/[0.03] border border-white/10 rounded-lg space-y-1">
                <div className="flex items-center justify-between text-2xs text-zinc-400">
                  <span className="text-white font-semibold">CORE // GEMINI REST PROXY</span>
                  <span>port: 3000</span>
                </div>
                <div className="text-2xs text-zinc-500 truncate">
                  POST /api/chat · models: gemini-3.5-flash
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-2xs">
                <div className="p-2.5 bg-white/[0.02] border border-white/5 rounded-lg">
                  <span className="text-zinc-400 block">DB ENGINE</span>
                  <span className="text-white font-bold">Relational Memory</span>
                  <span className="text-zinc-500 block text-2xs">ready for PostgreSQL</span>
                </div>
                <div className="p-2.5 bg-white/[0.02] border border-white/5 rounded-lg">
                  <span className="text-zinc-400 block">SECURITY</span>
                  <span className="text-white font-bold">RBAC Layer</span>
                  <span className="text-zinc-500 block text-2xs">5 Role Gates</span>
                </div>
              </div>

              {/* Code Snippet Box */}
              <div className="p-3 bg-black/60 border border-white/10 rounded-lg text-2xs text-zinc-300 space-y-1">
                <div className="flex items-center justify-between text-zinc-500 pb-1 border-b border-white/5">
                  <span>Architecture.cs</span>
                  <span className="text-zinc-400 font-mono">.NET 10 MVVM</span>
                </div>
                <div className="text-zinc-400 font-mono">
                  <span className="text-white">public sealed class</span> SystemNode : <span className="text-zinc-200">INodeCluster</span><br />
                  &#123; <span className="text-zinc-500">// Zero-Trust Server Architecture</span> &#125;
                </div>
              </div>
            </div>

            {/* Status footer */}
            <div className="pt-3 border-t border-white/10 flex items-center justify-between text-2xs text-zinc-500 font-mono">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-white"></span>
                <span>EliteDesk 800 G3 Mini Stack</span>
              </span>
              <span>WireGuard Mesh</span>
            </div>
          </div>
        </div>
      </section>

      {/* 2. NEXUS ECOSYSTEM (Clear Numbers & Prioritized Hierarchy) */}
      <section className="space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <span className="text-2xs font-semibold uppercase tracking-wider text-zinc-400">Plattform-Kennzahlen</span>
          <span className="text-2xs text-zinc-500">Stand: 2. ITA Ausbildungsjahr</span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-6 glass-1 rounded-xl border border-white/10 space-y-1">
            <span className="text-2xs uppercase tracking-wider text-zinc-500 font-semibold block">AI SPECIALISTS</span>
            <span className="font-mono text-3xl font-extrabold text-white block">6</span>
            <span className="text-2xs text-zinc-400">Rollen von Architect bis Maker</span>
          </div>

          <div className="p-6 glass-1 rounded-xl border border-white/10 space-y-1">
            <span className="text-2xs uppercase tracking-wider text-zinc-500 font-semibold block">ACTIVE SYSTEMS</span>
            <span className="font-mono text-3xl font-extrabold text-white block">5</span>
            <span className="text-2xs text-zinc-400">Produktionsreife Blueprints</span>
          </div>

          <div className="p-6 glass-1 rounded-xl border border-white/10 space-y-1">
            <span className="text-2xs uppercase tracking-wider text-zinc-500 font-semibold block">TECH STACK</span>
            <span className="font-mono text-3xl font-extrabold text-white block">12+</span>
            <span className="text-2xs text-zinc-400">C#, Docker, Fabric, 8051, MariaDB</span>
          </div>

          <div className="p-6 glass-1 rounded-xl border border-white/10 space-y-1">
            <span className="text-2xs uppercase tracking-wider text-zinc-500 font-semibold block">ZIEL: ATRUVIA AG</span>
            <span className="font-mono text-3xl font-extrabold text-white block">2027</span>
            <span className="text-2xs text-zinc-400">Fachhochschulreife &amp; Duales Studium</span>
          </div>
        </div>
      </section>

      {/* 3. EDITORIAL BENTO GRID (Varied Dimensions) */}
      <section className="space-y-6">
        <div className="space-y-1">
          <span className="text-2xs font-semibold uppercase tracking-wider text-zinc-400">Module &amp; Workspaces</span>
          <h2 className="text-2xl font-bold text-white">Integrierte Entwicklungsumgebung</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* Large Card: AI Workspace (8 cols) */}
          <div
            onClick={() => onNavigate('ai')}
            className="md:col-span-8 p-8 glass-2 liquid-glass-hover rounded-2xl border border-white/10 flex flex-col justify-between space-y-6 cursor-pointer"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between text-2xs text-zinc-400">
                <span className="font-mono">WORKSPACE // AI &amp; TOOLS</span>
                <span className="text-white font-semibold">Gemini 3.5 Flash</span>
              </div>
              <h3 className="text-xl font-bold text-white">KI-Assistent &amp; 5-Stufen Debugger</h3>
              <p className="text-xs text-zinc-400 max-w-xl leading-relaxed">
                6 spezialisierte Entwickler-Personas, die auf deinen genauen Stack abgestimmt sind. Vom Senior C# Architect für MVVM-Entkopplung bis zum ITA-Prüfungscoach für 8051 Assembler-Timer.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3 pt-4 border-t border-white/10 text-2xs font-mono text-zinc-300">
              <div className="p-2.5 bg-white/[0.02] border border-white/5 rounded-lg">
                <span className="text-zinc-500 block">METHODIK</span>
                <span className="text-white font-medium">Prinzip 23 Debugger</span>
              </div>
              <div className="p-2.5 bg-white/[0.02] border border-white/5 rounded-lg">
                <span className="text-zinc-500 block">KALENDER</span>
                <span className="text-white font-medium">Google Sync OAuth</span>
              </div>
              <div className="p-2.5 bg-white/[0.02] border border-white/5 rounded-lg">
                <span className="text-zinc-500 block">SCHNELL-KI</span>
                <span className="text-white font-medium">Flash-Lite Tools</span>
              </div>
            </div>
          </div>

          {/* Medium Card: Portfolio (4 cols) */}
          <div
            onClick={() => onNavigate('portfolio')}
            className="md:col-span-4 p-8 glass-2 liquid-glass-hover rounded-2xl border border-white/10 flex flex-col justify-between space-y-6 cursor-pointer"
          >
            <div className="space-y-3">
              <span className="text-2xs font-mono text-zinc-400 block">PORTFOLIO // SHOWCASE</span>
              <h3 className="text-xl font-bold text-white">Systeme &amp; Case Studies</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Dokumentierte Software- und Infrastruktur-Architekturen mit Quellcode-Ausschnitten, Problemstellungen und Live-Verlinkung.
              </p>
            </div>

            <div className="pt-4 border-t border-white/10 flex items-center justify-between text-2xs text-white font-semibold">
              <span>5 Case Studies erkunden</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </div>

          {/* Medium Card: Store (6 cols) */}
          <div
            onClick={() => onNavigate('store')}
            className="md:col-span-6 p-7 glass-2 liquid-glass-hover rounded-2xl border border-white/10 flex flex-col justify-between space-y-4 cursor-pointer"
          >
            <div className="space-y-2">
              <span className="text-2xs font-mono text-zinc-400 block">STORE // DIGITAL RES</span>
              <h3 className="text-base font-bold text-white">Entwickler-Vorlagen &amp; 3D STL</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Kuratierte .NET 10 WPF MVVM Starter-Kits, Docker-Compose HomeServer Bundles und 3D-Druckteile für den HP EliteDesk Mini PC.
              </p>
            </div>

            <div className="pt-3 border-t border-white/10 flex items-center justify-between text-2xs">
              <span className="text-zinc-400">Sofortiger digitaler Download</span>
              <span className="text-white font-semibold flex items-center gap-1">
                <span>Zum Store</span>
                <ArrowRight className="w-3 h-3" />
              </span>
            </div>
          </div>

          {/* Medium Card: Community (6 cols) */}
          <div
            onClick={() => onNavigate('community')}
            className="md:col-span-6 p-7 glass-2 liquid-glass-hover rounded-2xl border border-white/10 flex flex-col justify-between space-y-4 cursor-pointer"
          >
            <div className="space-y-2">
              <span className="text-2xs font-mono text-zinc-400 block">COMMUNITY // DISCUSSIONS</span>
              <h3 className="text-base font-bold text-white">Entwickler-Austausch &amp; Praxistipps</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Erfahrungsberichte zu Tailscale Mesh-VPN, 8051 Assembler-Berechnungen und Minecraft Fabric Modding.
              </p>
            </div>

            <div className="pt-3 border-t border-white/10 flex items-center justify-between text-2xs">
              <span className="text-zinc-400">Diskutiere mit Entwicklern</span>
              <span className="text-white font-semibold flex items-center gap-1">
                <span>Community öffnen</span>
                <ArrowRight className="w-3 h-3" />
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* 4. FEATURED PROJECTS PREVIEW */}
      <section className="space-y-6">
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div>
            <span className="text-2xs font-semibold uppercase tracking-wider text-zinc-400">Ausgewählte Systeme</span>
            <h2 className="text-xl font-bold text-white">Featured Portfolio</h2>
          </div>
          <button
            onClick={() => onNavigate('portfolio')}
            className="text-xs font-semibold text-white hover:underline flex items-center gap-1"
          >
            <span>Alle ansehen</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {featuredProjects.map((p) => (
            <div
              key={p.id}
              onClick={() => onNavigate('portfolio', p.slug)}
              className="p-6 glass-1 liquid-glass-hover rounded-xl border border-white/10 flex flex-col justify-between space-y-4 cursor-pointer"
            >
              <div className="space-y-2.5">
                <div className="flex items-center justify-between text-2xs text-zinc-400">
                  <span>{p.category}</span>
                  <span className="font-mono text-zinc-300 font-medium">{p.status}</span>
                </div>
                <h3 className="text-sm font-bold text-white">{p.title}</h3>
                <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed">{p.shortDesc}</p>
              </div>

              <div className="space-y-3 pt-3 border-t border-white/10">
                <div className="flex flex-wrap gap-1">
                  {p.techStack.slice(0, 3).map((t, idx) => (
                    <span key={idx} className="px-2 py-0.5 text-2xs font-mono bg-white/5 border border-white/10 rounded text-zinc-300">
                      {t}
                    </span>
                  ))}
                </div>

                <span className="text-2xs text-white font-medium flex items-center gap-1">
                  <span>Case Study lesen</span>
                  <ArrowRight className="w-3 h-3" />
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 5. CALL TO ACTION (Quiet Monochrome Premium) */}
      <section className="p-8 sm:p-12 glass-2 rounded-2xl border border-white/10 text-center space-y-4">
        <h2 className="text-2xl sm:text-3xl font-bold text-white">NEXUS CODE PLAY</h2>
        <p className="text-xs sm:text-sm text-zinc-400 max-w-lg mx-auto leading-relaxed">
          Bereit für die nächste Entwicklungsstufe? Nutze den KI-Workspace, analysiere Fehler mit dem 5-Stufen Debugger und synchronisiere deine Prüfungstermine.
        </p>
        <div className="pt-2 flex flex-wrap justify-center gap-3">
          <button
            onClick={() => onNavigate('ai')}
            className="px-6 py-2.5 btn-primary text-xs rounded-lg cursor-pointer"
          >
            AI Assistant starten
          </button>
          <button
            onClick={() => onNavigate('dashboard')}
            className="px-6 py-2.5 btn-secondary text-xs rounded-lg cursor-pointer"
          >
            Zum Dashboard
          </button>
        </div>
      </section>
    </div>
  );
};
