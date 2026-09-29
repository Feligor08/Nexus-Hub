import React, { useState } from 'react';
import { INITIAL_CHEATSHEETS, Cheatsheet } from '../data/initialData';
import { executeQuickAction } from '../services/geminiService';
import { BookOpen, Copy, Check, Zap, Sparkles, Send } from 'lucide-react';

export const CheatsheetsSection: React.FC = () => {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [quickActionType, setQuickActionType] = useState('asm_8051');
  const [quickActionInput, setQuickActionInput] = useState('');
  const [quickActionResult, setQuickActionResult] = useState<string | null>(null);
  const [isExecutingQuickAction, setIsExecutingQuickAction] = useState(false);

  const handleCopy = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleRunQuickAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickActionInput.trim()) return;

    setIsExecutingQuickAction(true);
    setQuickActionResult(null);
    try {
      const res = await executeQuickAction(quickActionType, quickActionInput);
      setQuickActionResult(res);
    } catch (err: any) {
      setQuickActionResult(`⚠️ Fehler: ${err.message || 'Konnte nicht berechnet werden'}`);
    } finally {
      setIsExecutingQuickAction(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-white/10">
        <div>
          <span className="text-2xs font-semibold uppercase tracking-wider text-zinc-400">Referenzhandbuch &amp; Automatisierung</span>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-white" />
            <span>Wissensbasis &amp; Schnell-Generatoren</span>
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Kompakte Referenzen für 8051 Assembler, WPF .NET 10, Docker und Atruvia AG Wirtschaftsinformatik-Vorbereitung.
          </p>
        </div>
      </div>

      {/* AI Quick Generator Bar (Gemini 3.1 Flash Lite) */}
      <div className="p-6 glass-2 rounded-2xl border border-white/10 space-y-4 shadow-xl">
        <div className="flex items-center gap-2 text-white">
          <Zap className="w-4 h-4 text-white" />
          <h3 className="text-sm font-semibold text-white">
            KI-Schnell-Generator (Gemini Flash-Lite)
          </h3>
        </div>

        <form onSubmit={handleRunQuickAction} className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-2xs font-semibold uppercase tracking-wider text-zinc-400">Modus:</label>
              <select
                value={quickActionType}
                onChange={(e) => {
                  setQuickActionType(e.target.value);
                  if (e.target.value === 'asm_8051') {
                    setQuickActionInput('Berechne 50ms Verzögerung bei 12 MHz Takt mit Timer 0 Modus 1');
                  } else if (e.target.value === 'wpf_command') {
                    setQuickActionInput('LadeKundenListeAsync mit Status-Meldung und IsBusy-Prüfung');
                  } else if (e.target.value === 'docker_snippet') {
                    setQuickActionInput('MariaDB 11 mit benanntem Volume und UTF8MB4 Encoding');
                  } else if (e.target.value === 'nginx_proxy') {
                    setQuickActionInput('Reverse Proxy für Obsidian CouchDB auf Port 5984 mit SSL');
                  }
                }}
                className="px-3 py-2 text-xs liquid-glass-input rounded-xl text-white cursor-pointer"
              >
                <option value="asm_8051" className="bg-[#0e1014] text-white">8051 Timer / Routine berechnen</option>
                <option value="wpf_command" className="bg-[#0e1014] text-white">C# .NET 10 MVVM RelayCommand</option>
                <option value="docker_snippet" className="bg-[#0e1014] text-white">Docker-Compose Snippet</option>
                <option value="nginx_proxy" className="bg-[#0e1014] text-white">Nginx Proxy Host Konfig</option>
                <option value="sql_optimize" className="bg-[#0e1014] text-white">SQL-Query Optimierung</option>
              </select>
            </div>

            <div className="flex-1 min-w-[280px]">
              <input
                type="text"
                value={quickActionInput}
                onChange={(e) => setQuickActionInput(e.target.value)}
                placeholder="z.B. 10ms Timer-Vorladewerte bei 12MHz Quarzoszillator..."
                className="w-full px-3.5 py-2 text-xs liquid-glass-input rounded-xl text-white placeholder-zinc-500"
              />
            </div>

            <button
              type="submit"
              disabled={isExecutingQuickAction || !quickActionInput.trim()}
              className="flex items-center gap-1.5 px-5 py-2 btn-primary text-xs rounded-xl font-semibold transition-colors whitespace-nowrap cursor-pointer shrink-0 disabled:opacity-50"
            >
              {isExecutingQuickAction ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
                  <span>Berechne...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Ausführen</span>
                </>
              )}
            </button>
          </div>
        </form>

        {/* Quick Result Preview */}
        {quickActionResult && (
          <div className="p-4 bg-black/60 border border-white/10 rounded-xl space-y-2 animate-in fade-in duration-150">
            <div className="flex items-center justify-between text-2xs text-zinc-400">
              <span className="font-mono text-zinc-300">ERGEBNIS // FLASH-LITE</span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(quickActionResult);
                  setCopiedId('quick-result');
                  setTimeout(() => setCopiedId(null), 2000);
                }}
                className="hover:text-white flex items-center gap-1 transition-colors cursor-pointer"
              >
                {copiedId === 'quick-result' ? <Check className="w-3 h-3 text-white" /> : <Copy className="w-3 h-3" />}
                <span>{copiedId === 'quick-result' ? 'Kopiert' : 'Kopieren'}</span>
              </button>
            </div>
            <pre className="font-mono text-2xs text-zinc-200 whitespace-pre-wrap leading-relaxed overflow-x-auto max-h-60 scrollbar-none">
              {quickActionResult}
            </pre>
          </div>
        )}
      </div>

      {/* Cheatsheets List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {INITIAL_CHEATSHEETS.map((cs) => (
          <div
            key={cs.id}
            className="glass-1 liquid-glass-hover border border-white/10 rounded-2xl p-6 flex flex-col justify-between space-y-4"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between text-2xs text-zinc-400">
                <span>{cs.category}</span>
                <span className="font-mono text-zinc-300 font-semibold">{cs.title}</span>
              </div>

              <p className="text-xs text-zinc-400 leading-relaxed">{cs.description}</p>

              <div className="pt-2 border-t border-white/10">
                <div className="flex items-center justify-between text-2xs text-zinc-400 mb-2">
                  <span className="font-mono text-zinc-300 uppercase">{cs.language}</span>
                  <button
                    onClick={() => handleCopy(cs.code, cs.id)}
                    className="hover:text-white flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    {copiedId === cs.id ? (
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
                <pre className="p-3.5 bg-black/60 border border-white/10 rounded-xl font-mono text-2xs text-zinc-300 overflow-x-auto max-h-52 leading-relaxed scrollbar-none">
                  {cs.code}
                </pre>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
