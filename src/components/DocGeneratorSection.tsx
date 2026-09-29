import React, { useState } from 'react';
import { generateDocsWithGemini } from '../services/geminiService';
import { FileText, Play, Copy, Check, Terminal } from 'lucide-react';

export const DocGeneratorSection: React.FC = () => {
  const [title, setTitle] = useState('HP EliteDesk 800 G3 Mini Server & Docker-Netzwerk-Architektur');
  const [docType, setDocType] = useState('Infrastruktur- & Netzwerkkonzept');
  const [techStack, setTechStack] = useState('Ubuntu Server 24.04, CasaOS, Docker, Nginx Proxy Manager, Tailscale, MariaDB');
  const [requirements, setRequirements] = useState(`- Vollständige Netzwerk-Topologie (internes Docker-Bridge-Netzwerk vs. Tailscale Mesh-VPN)
- Keine offenen Ports am WAN-Router, sicherer Fernzugriff nur via Tailscale
- Nginx Proxy Manager Konfiguration mit Let's Encrypt Wildcard-Zertifikaten
- MariaDB Backup-Routine mit Cron-Job und Dump auf verschlüsseltes externes Dateisystem
- Ressourcen-Monitoring und Ausfallsicherheit auf dem HP EliteDesk Mini PC`);
  const [generatedDoc, setGeneratedDoc] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  const presets = [
    {
      label: 'HomeServer Infrastruktur-Doku',
      title: 'HP EliteDesk 800 G3 Mini Server & Docker-Netzwerk-Architektur',
      docType: 'Infrastruktur- & Netzwerkkonzept',
      techStack: 'Ubuntu Server 24.04, CasaOS, Docker, NPM, Tailscale, MariaDB',
      req: `- Vollständige Netzwerk-Topologie (internes Docker-Bridge-Netzwerk vs. Tailscale Mesh-VPN)
- Keine offenen Ports am WAN-Router, sicherer Fernzugriff nur via Tailscale
- Nginx Proxy Manager Konfiguration mit TLS
- MariaDB Backup-Routine mit automatischer Sicherung
- Ressourcen-Monitoring auf dem HP EliteDesk Mini`,
    },
    {
      label: 'C# WPF MVVM Architekturbericht',
      title: 'Moderne ITA-Projektverwaltung mit C# .NET 10 & MVVM',
      docType: 'Software-Architekturkonzept',
      techStack: 'C#, .NET 10.0, WPF, CommunityToolkit.Mvvm, EF Core, MariaDB',
      req: `- Strikte Schichtentrennung: Views (.xaml), ViewModels, Models, Repositories
- Dependency Injection Container Konfiguration in App.xaml.cs
- Keine Event-Handler oder Business-Logik im Code-Behind (.xaml.cs)
- Asynchrone RelayCommands mit Fehlerbehandlung und IsBusy-Indikatoren
- Unit-Testbarkeit der Business-Logik`,
    },
    {
      label: '8051 Laborprotokoll (Timer/Interrupt)',
      title: '8051 Mikrocontroller Laborbericht: Timer 0 & Interrupt-Steuerung',
      docType: 'Technischer Laborbericht (ITA)',
      techStack: '8051 Assembler, Keil µVision, 12 MHz Quarz, 7-Segment-Anzeige',
      req: `- Exakte mathematische Herleitung der TH0/TL0 Vorladewerte bei 12 MHz Takt
- Aufbau der Interrupt Service Routine (ISR) an Vektoradresse 000BH
- Flussdiagramm und strukturierter Assembler-Quellcode
- Verifikation mit Oszilloskop und Testprotokoll`,
    },
  ];

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !requirements.trim()) return;

    setIsGenerating(true);
    setGeneratedDoc(null);
    try {
      const doc = await generateDocsWithGemini({
        title,
        docType,
        requirements,
        techStack,
      });
      setGeneratedDoc(doc);
    } catch (err: any) {
      setGeneratedDoc(`⚠️ Fehler bei der Dokumentationsgenerierung: ${err.message || 'Serverfehler'}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = () => {
    if (!generatedDoc) return;
    navigator.clipboard.writeText(generatedDoc);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-white/10">
        <div>
          <span className="text-2xs font-semibold uppercase tracking-wider text-zinc-400">Industriedokumentation &amp; Spezifikationen</span>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-white" />
            <span>Technischer Dokumentations- &amp; Blueprint-Generator</span>
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Erstellt professionelle Industrie-Spezifikationen, Laborberichte und Architektur-Pläne für Schule, Home-Server und Beruf.
          </p>
        </div>
      </div>

      {/* Presets */}
      <div className="flex items-center gap-2 overflow-x-auto scrollbar-none py-1">
        <span className="text-2xs font-mono uppercase text-zinc-400 shrink-0">Vorlagen:</span>
        {presets.map((p, idx) => (
          <button
            key={idx}
            onClick={() => {
              setTitle(p.title);
              setDocType(p.docType);
              setTechStack(p.techStack);
              setRequirements(p.req);
              setGeneratedDoc(null);
            }}
            className="px-3 py-1.5 text-xs glass-1 hover:glass-2 text-zinc-300 hover:text-white border border-white/10 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Form */}
        <form onSubmit={handleGenerate} className="space-y-4">
          <div>
            <label className="block text-2xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
              Dokumentations-Titel *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3.5 py-2.5 text-xs liquid-glass-input rounded-xl text-white placeholder-zinc-500"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-2xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
                Dokumentations-Typ
              </label>
              <input
                type="text"
                value={docType}
                onChange={(e) => setDocType(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs liquid-glass-input rounded-xl text-white placeholder-zinc-500"
              />
            </div>

            <div>
              <label className="block text-2xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
                Technologie-Stack
              </label>
              <input
                type="text"
                value={techStack}
                onChange={(e) => setTechStack(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs liquid-glass-input rounded-xl text-white placeholder-zinc-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-2xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
              Anforderungen, Systemkomponenten &amp; Randbedingungen *
            </label>
            <textarea
              rows={10}
              required
              value={requirements}
              onChange={(e) => setRequirements(e.target.value)}
              className="w-full p-3 font-mono text-xs liquid-glass-input rounded-xl text-zinc-200 leading-relaxed scrollbar-none"
            />
          </div>

          <button
            type="submit"
            disabled={isGenerating}
            className="flex items-center gap-2 px-6 py-2.5 btn-primary text-xs rounded-xl font-semibold transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50"
          >
            <Play className="w-4 h-4" />
            <span>{isGenerating ? 'Generiere Dokumentation...' : 'Spezifikation generieren'}</span>
          </button>
        </form>

        {/* Output */}
        <div className="flex flex-col glass-2 border border-white/10 rounded-2xl p-6 shadow-xl">
          <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-white" />
              <h3 className="text-sm font-semibold text-white">Generierte Spezifikation</h3>
            </div>
            {generatedDoc && (
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-3 py-1 text-2xs btn-secondary rounded-lg transition-colors cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-white" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Kopiert' : 'Kopieren'}</span>
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto max-h-[600px] pr-2">
            {isGenerating ? (
              <div className="h-64 flex flex-col items-center justify-center gap-3 text-zinc-400">
                <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <p className="text-xs">Nexus generiert vollständige technische Spezifikation...</p>
              </div>
            ) : generatedDoc ? (
              <div className="prose prose-invert prose-sm max-w-none whitespace-pre-wrap font-sans text-zinc-300 text-xs leading-relaxed">
                {generatedDoc}
              </div>
            ) : (
              <div className="h-64 flex flex-col items-center justify-center text-center p-6 text-zinc-500 border border-dashed border-white/10 rounded-xl">
                <FileText className="w-8 h-8 text-zinc-500 mb-2" />
                <p className="text-sm font-medium text-zinc-300">Noch keine Spezifikation generiert</p>
                <p className="text-xs text-zinc-500 mt-1 max-w-sm">
                  Wähle oben eine Vorlage oder gib deine Parameter ein, um eine Spezifikation nach Industriestandards zu erstellen.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
