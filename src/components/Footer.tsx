import React from 'react';
import { Cpu, Github, ExternalLink, Terminal, Shield } from 'lucide-react';

interface FooterProps {
  onNavigate: (view: string) => void;
}

export const Footer: React.FC<FooterProps> = ({ onNavigate }) => {
  return (
    <footer className="border-t border-white/10 bg-[#07080b]/90 backdrop-blur-xl py-12 px-6 text-xs text-zinc-400">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
        {/* Brand Col */}
        <div className="space-y-3">
          <div className="flex items-center gap-2.5 text-white font-bold text-sm">
            <div className="w-6 h-6 rounded bg-white/10 border border-white/20 flex items-center justify-center text-white">
              <Cpu className="w-3.5 h-3.5" />
            </div>
            <span>Nexus Code Play</span>
          </div>
          <p className="text-2xs text-zinc-400 leading-relaxed">
            Modulare Developer Platform, AI Workspace, Community & Marketplace für langlebige Software- und Infrastruktur-Projekte.
          </p>
          <div className="flex items-center gap-2 pt-1 text-2xs font-mono text-zinc-300">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            <span>API Engine: Online (Liquid Glass v2.0)</span>
          </div>
        </div>

        {/* Navigation */}
        <div className="space-y-2">
          <span className="text-xs font-semibold text-white uppercase tracking-wider block mb-2">Plattform</span>
          <button onClick={() => onNavigate('home')} className="block text-zinc-400 hover:text-white transition-colors">
            Startseite
          </button>
          <button onClick={() => onNavigate('ai')} className="block text-zinc-400 hover:text-white transition-colors">
            AI Assistant & Debugger
          </button>
          <button onClick={() => onNavigate('portfolio')} className="block text-zinc-400 hover:text-white transition-colors">
            Projekt-Portfolio
          </button>
          <button onClick={() => onNavigate('store')} className="block text-zinc-400 hover:text-white transition-colors">
            Online Store
          </button>
          <button onClick={() => onNavigate('community')} className="block text-zinc-400 hover:text-white transition-colors">
            Entwickler Community
          </button>
        </div>

        {/* Developer Context */}
        <div className="space-y-2">
          <span className="text-xs font-semibold text-white uppercase tracking-wider block mb-2">Entwickler</span>
          <p className="text-2xs text-zinc-300">Felix Schlüter (@feligor08)</p>
          <p className="text-2xs text-zinc-400">Ausbildung zum Informationstechnischen Assistenten (ITA, 2. Jahr)</p>
          <p className="text-2xs text-zinc-400">Fachhochschulreife 2027</p>
          <p className="text-2xs text-zinc-300 font-medium">Ziel: Duales Studium Wirtschaftsinformatik @ Atruvia AG</p>
        </div>

        {/* Stack & Systems */}
        <div className="space-y-2">
          <span className="text-xs font-semibold text-white uppercase tracking-wider block mb-2">Infrastruktur</span>
          <p className="text-2xs text-zinc-400">Hardware: HP EliteDesk 800 G3 Mini</p>
          <p className="text-2xs text-zinc-400">OS: Ubuntu Server 24.04 · CasaOS</p>
          <p className="text-2xs text-zinc-400">Netzwerk: Tailscale Mesh-VPN · Nginx Proxy Manager</p>
          <p className="text-2xs text-zinc-400">Maker: Bambu Lab P1S Combo · Gridfinity</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto pt-6 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4 text-2xs text-zinc-400">
        <div>
          © {new Date().getFullYear()} Nexus Code Play. Alle Rechte vorbehalten. Liquid Glass Monochrom-Design.
        </div>
        <div className="flex items-center gap-4">
          <button onClick={() => onNavigate('portfolio')} className="hover:text-white transition-colors">
            Portfolio
          </button>
          <button onClick={() => onNavigate('store')} className="hover:text-white transition-colors">
            Store
          </button>
          <button onClick={() => onNavigate('ai')} className="hover:text-white transition-colors">
            AI Assistant
          </button>
          <button onClick={() => onNavigate('admin')} className="hover:text-white transition-colors">
            Admin
          </button>
        </div>
      </div>
    </footer>
  );
};
