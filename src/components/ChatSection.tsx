import React, { useState, useRef, useEffect } from 'react';
import { sendChatMessage, ChatMessage } from '../services/geminiService';
import {
  Send,
  Bot,
  User as UserIcon,
  Copy,
  Check,
  RotateCcw,
  Sparkles,
  Download,
  Terminal,
  Code2,
  Server,
  GraduationCap,
  Gamepad2,
  Cpu,
  Search,
} from 'lucide-react';

interface ChatSectionProps {
  onNavigateToTab?: (tab: string) => void;
}

export const ChatSection: React.FC<ChatSectionProps> = ({ onNavigateToTab }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome-msg',
      role: 'assistant',
      content: `Willkommen im **Nexus AI Workspace**. 

Hier steht dir deine persönliche KI-Entwicklungsumgebung zur Seite — abgestimmt auf deine IT-Ausbildung (ITA 2. Lehrjahr), deinen HP EliteDesk 800 G3 Mini Server Stack und dein Karriereziel: Duales Studium Wirtschaftsinformatik bei der Atruvia AG 2027.

Wähle oben eine Spezialisten-Rolle oder tippe deine Frage direkt ein.`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      assistantRole: 'general',
    },
  ]);
  const [input, setInput] = useState('');
  const [selectedRole, setSelectedRole] = useState('general');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const roles = [
    {
      id: 'general',
      name: 'Nexus Core',
      desc: 'Allround IT & System-Architektur',
      icon: Terminal,
    },
    {
      id: 'architect',
      name: 'Software Architect',
      desc: 'C# .NET 10, WPF (MVVM), Java & REST',
      icon: Code2,
    },
    {
      id: 'devops',
      name: 'DevOps & HomeServer',
      desc: 'Docker, Tailscale, CasaOS & MariaDB',
      icon: Server,
    },
    {
      id: 'ita_coach',
      name: 'ITA & Atruvia Coach',
      desc: '8051 Assembler, Prüfungen & WI-Studium',
      icon: GraduationCap,
    },
    {
      id: 'gameserver',
      name: 'Game Server & Modding',
      desc: 'Minecraft Fabric & Roblox Luau',
      icon: Gamepad2,
    },
    {
      id: 'maker',
      name: '3D Maker Lab',
      desc: 'Bambu Lab P1S, PETG & Bento3D',
      icon: Cpu,
    },
  ];

  const quickPrompts = [
    {
      label: 'C# MVVM RelayCommand',
      role: 'architect',
      prompt: 'Zeige mir eine saubere C# .NET 10 MVVM Implementierung eines Async RelayCommands mit Dependency Injection für eine WPF-Anwendung.',
    },
    {
      label: 'Docker Compose MariaDB & NPM',
      role: 'devops',
      prompt: 'Wie konfiguriere ich ein sicheres Docker-Compose-Setup für MariaDB 11 und Nginx Proxy Manager mit internem Netzwerk und persistenten Volumes auf Ubuntu Server?',
    },
    {
      label: '8051 Timer Modus 1 Berechnung',
      role: 'ita_coach',
      prompt: 'Erkläre mir die exakte Formel zur Berechnung der TH0- und TL0-Vorladewerte für den 8051 Mikrocontroller bei 12 MHz Quarzoszillator für ein 10ms Intervall.',
    },
    {
      label: 'Roblox RemoteEvent Sicherheit',
      role: 'gameserver',
      prompt: 'Wie implementiere ich in Roblox Luau eine serverseitige Validierung für RemoteEvents gegen Speed-Hacks und ungültige Payloads?',
    },
  ];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSendMessage = async (textToSend?: string) => {
    const messageContent = (textToSend || input).trim();
    if (!messageContent || isLoading) return;

    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}-user`,
      role: 'user',
      content: messageContent,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const newHistory = [...messages, userMessage];
    setMessages(newHistory);
    setInput('');
    setIsLoading(true);

    try {
      const historyPayload = newHistory.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const reply = await sendChatMessage(historyPayload, selectedRole);

      const assistantMessage: ChatMessage = {
        id: `msg-${Date.now()}-bot`,
        role: 'assistant',
        content: reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        assistantRole: selectedRole,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error: any) {
      console.error('Chat error:', error);
      const errorMessage: ChatMessage = {
        id: `msg-${Date.now()}-err`,
        role: 'assistant',
        content: `Fehler bei der Kommunikation mit dem Server: ${error.message || 'Verbindung fehlgeschlagen.'}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        assistantRole: selectedRole,
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleExportChat = () => {
    const exportText = messages
      .map((m) => `[${m.timestamp}] ${m.role.toUpperCase()} (${m.assistantRole || 'user'}):\n${m.content}\n`)
      .join('\n---\n\n');
    const blob = new Blob([exportText], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nexus_chat_export_${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredMessages = messages.filter((m) =>
    !searchTerm || m.content.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex flex-col h-[calc(100vh-8.5rem)] max-w-7xl mx-auto space-y-4">
      {/* 1. ROLE SELECTOR (Elevated Quiet Premium Cards per Section 19) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-2xs text-zinc-400">
          <span className="font-semibold uppercase tracking-wider">Spezialisten-Rolle wählen:</span>
          <span className="font-mono text-zinc-300">Aktives Modell: Gemini 3.5 Flash</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {roles.map((r) => {
            const Icon = r.icon;
            const isActive = selectedRole === r.id;
            return (
              <button
                key={r.id}
                onClick={() => setSelectedRole(r.id)}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between space-y-1.5 ${
                  isActive
                    ? 'glass-2 border-white/40 ring-1 ring-white/20'
                    : 'glass-1 border-white/5 hover:border-white/15'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className={`p-1.5 rounded-lg ${isActive ? 'bg-white text-black' : 'bg-white/5 text-zinc-300'}`}>
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  {isActive && <span className="w-1.5 h-1.5 rounded-full bg-white"></span>}
                </div>

                <div>
                  <h4 className="text-xs font-semibold text-white leading-tight">{r.name}</h4>
                  <p className="text-2xs text-zinc-400 line-clamp-1 mt-0.5">{r.desc}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. CONVERSATION TOOLBAR */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 glass-1 rounded-xl border border-white/10 text-xs">
        <div className="flex items-center gap-2 flex-1 max-w-sm">
          <Search className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Gespräch durchsuchen..."
            className="w-full bg-transparent text-xs text-white placeholder-zinc-500 focus:outline-hidden"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportChat}
            className="px-2.5 py-1 btn-ghost text-2xs rounded-lg flex items-center gap-1.5 cursor-pointer"
            title="Chat als Markdown exportieren"
          >
            <Download className="w-3 h-3" />
            <span>Exportieren</span>
          </button>
          <button
            onClick={() =>
              setMessages([
                {
                  id: 'reset-msg',
                  role: 'assistant',
                  content: 'Neues Gespräch gestartet. Wie kann ich dir helfen?',
                  timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                  assistantRole: selectedRole,
                },
              ])
            }
            className="px-2.5 py-1 btn-ghost text-2xs rounded-lg flex items-center gap-1.5 cursor-pointer"
            title="Chat zurücksetzen"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Neuer Chat</span>
          </button>
        </div>
      </div>

      {/* 3. MESSAGE THREAD */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1">
        {filteredMessages.map((message) => {
          const isUser = message.role === 'user';
          return (
            <div
              key={message.id}
              className={`flex items-start gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
            >
              <div
                className={`w-7 h-7 rounded-lg shrink-0 flex items-center justify-center text-xs font-bold ${
                  isUser
                    ? 'bg-white text-black'
                    : 'bg-white/10 text-white border border-white/15'
                }`}
              >
                {isUser ? <UserIcon className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
              </div>

              <div
                className={`max-w-[85%] md:max-w-[78%] rounded-xl p-4 text-xs leading-relaxed ${
                  isUser
                    ? 'glass-2 border border-white/20 text-white'
                    : 'glass-1 border border-white/10 text-zinc-200'
                }`}
              >
                {/* Message Header */}
                <div className="flex items-center justify-between gap-4 mb-2 pb-1.5 border-b border-white/10 text-2xs text-zinc-400">
                  <span className="font-semibold text-zinc-300">
                    {isUser ? 'Du' : `Nexus Assistant (${message.assistantRole || 'Core'})`}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="tabular-nums font-mono text-zinc-400">{message.timestamp}</span>
                    <button
                      onClick={() => handleCopy(message.content, message.id)}
                      className="text-zinc-500 hover:text-white p-0.5 cursor-pointer transition-colors"
                      title="Kopieren"
                    >
                      {copiedId === message.id ? (
                        <Check className="w-3.5 h-3.5 text-white" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Message Body */}
                <div className="whitespace-pre-wrap font-sans space-y-2 leading-relaxed text-zinc-200">
                  {message.content}
                </div>
              </div>
            </div>
          );
        })}

        {isLoading && (
          <div className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-lg bg-white/10 text-white border border-white/15 shrink-0 flex items-center justify-center">
              <Bot className="w-3.5 h-3.5 animate-pulse" />
            </div>
            <div className="glass-1 border border-white/10 rounded-xl p-4 text-xs text-zinc-400 flex items-center gap-3">
              <div className="flex gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-bounce"></span>
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-bounce delay-150"></span>
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-bounce delay-300"></span>
              </div>
              <span className="font-mono text-2xs">Nexus generiert präzise Lösung...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 4. QUICK PROMPTS CHIPS */}
      <div className="flex items-center gap-2 overflow-x-auto scrollbar-none py-1">
        <span className="text-2xs text-zinc-400 shrink-0 flex items-center gap-1 font-mono">
          <Sparkles className="w-3 h-3 text-white" /> SCHNELLSTART:
        </span>
        {quickPrompts.map((qp, idx) => (
          <button
            key={idx}
            onClick={() => {
              setSelectedRole(qp.role);
              handleSendMessage(qp.prompt);
            }}
            disabled={isLoading}
            className="px-2.5 py-1 text-2xs glass-1 hover:glass-2 text-zinc-300 hover:text-white border border-white/10 rounded-lg transition-colors whitespace-nowrap shrink-0 disabled:opacity-50 cursor-pointer"
          >
            {qp.label}
          </button>
        ))}
      </div>

      {/* 5. INPUT BAR */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSendMessage();
        }}
        className="flex items-center gap-3 pt-1"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={`Frage an ${roles.find((r) => r.id === selectedRole)?.name || 'Nexus'} eingeben...`}
          disabled={isLoading}
          className="flex-1 px-4 py-3 liquid-glass-input rounded-xl text-xs text-white placeholder-zinc-500"
        />

        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="px-5 py-3 btn-primary text-xs rounded-xl flex items-center gap-2 cursor-pointer disabled:opacity-50"
        >
          <Send className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Senden</span>
        </button>
      </form>
    </div>
  );
};
