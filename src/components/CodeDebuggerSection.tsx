import React, { useState } from 'react';
import { analyzeCodeWithGemini } from '../services/geminiService';
import { Bug, CheckCircle2, Play, Sparkles, Copy, Check, Terminal } from 'lucide-react';

export const CodeDebuggerSection: React.FC = () => {
  const [code, setCode] = useState(`// Beispiel: C# WPF Binding & Async Void Issue
public async void btnSpeichern_Click(object sender, RoutedEventArgs e)
{
    // Problem: async void führt zu unbehandelten Exceptions im WPF Thread
    // und Datenbindung friert ein
    var daten = await LadeDatenAusDatenbankAsync();
    dgvBenutzer.ItemsSource = daten;
}`);
  const [errorLog, setErrorLog] = useState(`System.InvalidOperationException: Der aufrufende Thread kann nicht auf dieses Objekt zugreifen, da sich das Objekt im Besitz eines anderen Threads befindet.
   bei System.Windows.Threading.Dispatcher.VerifyAccess()
   bei NexusCodePlay.MainWindow.btnSpeichern_Click(Object sender, RoutedEventArgs e) in MainWindow.xaml.cs:Zeile 42.`);
  const [language, setLanguage] = useState('csharp');
  const [context, setContext] = useState('WPF / C# .NET 10 MVVM');
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [copied, setCopied] = useState(false);

  const sampleScenarios = [
    {
      title: 'C# WPF Dispatcher & Async Void Deadlock',
      lang: 'csharp',
      ctx: 'WPF .NET 10 MVVM',
      code: `public async void btnSpeichern_Click(object sender, RoutedEventArgs e)
{
    // async void im Event-Handler ohne Dispatcher oder MVVM
    var daten = await Task.Run(() => LadeDatenAusDatenbank());
    dgvBenutzer.ItemsSource = daten;
}`,
      log: `System.InvalidOperationException: Der aufrufende Thread kann nicht auf dieses Objekt zugreifen, da sich das Objekt im Besitz eines anderen Threads befindet.
   bei System.Windows.Threading.Dispatcher.VerifyAccess()`,
    },
    {
      title: '8051 Assembler Timer0 Modus 1 Berechnungsfehler',
      lang: 'asm',
      ctx: '8051 Mikrocontroller Labor',
      code: `ORG 0000H
    LJMP START

START:
    MOV TMOD, #02H     ; Fehler: Modus 2 statt Modus 1 für 16-Bit Timer
    MOV TH0, #00H
    MOV TL0, #00H
    SETB TR0

WAIT:
    JNB TF0, WAIT      ; Schleife wartet auf Überlauf
    CLR TF0
    CPL P1.0
    SJMP WAIT`,
      log: `Timer Überlauf erfolgt viel zu schnell (ca. 256 Taktzyklen statt 65536). Die LED an P1.0 flackert mit Megahertz-Frequenz statt 10ms Intervall.`,
    },
    {
      title: 'Docker Compose Nginx Proxy Manager Port-Konflikt',
      lang: 'yaml',
      ctx: 'HP EliteDesk Ubuntu Server 24.04',
      code: `services:
  web1:
    image: nginx:alpine
    ports:
      - "80:80"

  nginx_proxy_manager:
    image: jc21/nginx-proxy-manager:latest
    ports:
      - "80:80"
      - "81:81"
      - "443:443"`,
      log: `Error response from daemon: driver failed programming external connectivity on endpoint nginx_proxy_manager: Bind for 0.0.0.0:80 failed: port is already allocated`,
    },
    {
      title: 'Java Hibernate N+1 Query & Lazy Loading',
      lang: 'java',
      ctx: 'Java / Hibernate REST API',
      code: `@Entity
public class Projekt {
    @Id @GeneratedValue
    private Long id;

    @OneToMany(fetch = FetchType.LAZY)
    private List<Aufgabe> aufgaben;
}

// Controller
@GetMapping("/projekte")
public List<ProjektDTO> getAll() {
    return repo.findAll().stream()
        .map(p -> new ProjektDTO(p.getId(), p.getAufgaben().size()))
        .toList();
}`,
      log: `Hibernate: select p1_0.id from projekt p1_0
Hibernate: select a1_0.projekt_id,a1_0.id from aufgabe a1_0 where a1_0.projekt_id=?
Hibernate: select a1_0.projekt_id,a1_0.id from aufgabe a1_0 where a1_0.projekt_id=?`,
    },
  ];

  const handleAnalyze = async () => {
    if (!code && !errorLog) return;
    setIsAnalyzing(true);
    setAnalysisResult(null);

    try {
      const result = await analyzeCodeWithGemini({
        code,
        language,
        errorLog,
        context,
      });
      setAnalysisResult(result);
    } catch (err: any) {
      setAnalysisResult(`Fehler bei der Analyse: ${err.message || 'Serverfehler'}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleCopy = () => {
    if (!analysisResult) return;
    navigator.clipboard.writeText(analysisResult);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-white/10">
        <div>
          <span className="text-2xs font-semibold uppercase tracking-wider text-zinc-400">Methodische Fehleranalyse</span>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Bug className="w-5 h-5 text-white" />
            <span>Strukturierter 5-Stufen Debugger</span>
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Prinzip 23: Fehlerbild · Ursachenanalyse · Relevante Komponenten · Korrigierter Code · Testschritte.
          </p>
        </div>

        <button
          onClick={handleAnalyze}
          disabled={isAnalyzing || (!code.trim() && !errorLog.trim())}
          className="flex items-center gap-2 px-5 py-2.5 btn-primary text-xs rounded-lg whitespace-nowrap cursor-pointer disabled:opacity-50"
        >
          <Play className="w-3.5 h-3.5" />
          <span>{isAnalyzing ? 'Analysiere...' : '5-Stufen Analyse starten'}</span>
        </button>
      </div>

      {/* Preset Scenarios */}
      <div className="flex items-center gap-2 overflow-x-auto scrollbar-none py-1">
        <span className="text-2xs text-zinc-400 font-mono shrink-0">ITA-SZENARIEN:</span>
        {sampleScenarios.map((s, idx) => (
          <button
            key={idx}
            onClick={() => {
              setCode(s.code);
              setErrorLog(s.log);
              setLanguage(s.lang);
              setContext(s.ctx);
              setAnalysisResult(null);
            }}
            className="px-3 py-1.5 text-2xs glass-1 hover:glass-2 text-zinc-300 hover:text-white border border-white/10 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {s.title}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Code & Log Input */}
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-zinc-300">Sprache:</label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="px-2.5 py-1 text-xs liquid-glass-input rounded-lg bg-[#08090c]"
              >
                <option value="csharp">C# (.NET 10 / WPF)</option>
                <option value="asm">8051 Assembler</option>
                <option value="yaml">Docker Compose (YAML)</option>
                <option value="java">Java / Hibernate</option>
                <option value="sql">SQL / MariaDB</option>
                <option value="lua">Roblox Luau</option>
                <option value="python">Python</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-zinc-300">Kontext:</label>
              <input
                type="text"
                value={context}
                onChange={(e) => setContext(e.target.value)}
                placeholder="z.B. ITA Schulprojekt"
                className="px-2.5 py-1 text-xs liquid-glass-input rounded-lg w-44"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between text-2xs text-zinc-400 mb-1.5">
              <span className="font-semibold text-zinc-300">Quellcode:</span>
              <span className="font-mono">{code.split('\n').length} Zeilen</span>
            </div>
            <textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              rows={12}
              className="w-full p-3 font-mono text-2xs liquid-glass-input rounded-xl leading-relaxed"
              placeholder="// Quellcode hier einfügen..."
            />
          </div>

          <div>
            <div className="flex items-center justify-between text-2xs text-zinc-400 mb-1.5">
              <span className="font-semibold text-zinc-300">Fehlermeldung, Log oder Stacktrace:</span>
            </div>
            <textarea
              value={errorLog}
              onChange={(e) => setErrorLog(e.target.value)}
              rows={6}
              className="w-full p-3 font-mono text-2xs liquid-glass-input rounded-xl leading-relaxed"
              placeholder="Fehlermeldung, Stacktrace oder Konsolen-Ausgabe hier einfügen..."
            />
          </div>
        </div>

        {/* Right Column: 5-Step Analysis Output */}
        <div className="flex flex-col glass-1 rounded-2xl border border-white/10 p-5">
          <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-white" />
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">Strukturierter Analysebericht</h3>
            </div>
            {analysisResult && (
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-2.5 py-1 text-2xs text-zinc-300 hover:text-white bg-white/5 border border-white/10 rounded-lg transition-colors cursor-pointer"
              >
                {copied ? <Check className="w-3 h-3 text-white" /> : <Copy className="w-3 h-3" />}
                <span>{copied ? 'Kopiert' : 'Kopieren'}</span>
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto max-h-[640px] pr-2">
            {isAnalyzing ? (
              <div className="h-64 flex flex-col items-center justify-center gap-3 text-zinc-400">
                <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <p className="text-2xs font-mono">Führe 5-stufige Fehleranalyse durch...</p>
              </div>
            ) : analysisResult ? (
              <div className="prose prose-invert prose-xs max-w-none whitespace-pre-wrap font-sans text-zinc-300 text-xs leading-relaxed">
                {analysisResult}
              </div>
            ) : (
              <div className="h-64 flex flex-col items-center justify-center text-center p-6 text-zinc-500 border border-dashed border-white/10 rounded-xl">
                <Bug className="w-8 h-8 text-zinc-600 mb-2 stroke-[1.5]" />
                <p className="text-xs font-medium text-zinc-300">Bereit für Fehleranalyse</p>
                <p className="text-2xs text-zinc-500 mt-1 max-w-xs">
                  Füge deinen Code links ein und klicke auf &quot;5-Stufen Analyse starten&quot;.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
