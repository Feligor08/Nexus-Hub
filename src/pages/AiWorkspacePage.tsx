import React, { useState } from 'react';
import { User } from 'firebase/auth';
import { ChatSection } from '../components/ChatSection';
import { CodeDebuggerSection } from '../components/CodeDebuggerSection';
import { CalendarSection } from '../components/CalendarSection';
import { ProjectsSection } from '../components/ProjectsSection';
import { CheatsheetsSection } from '../components/CheatsheetsSection';
import { DocGeneratorSection } from '../components/DocGeneratorSection';
import { ProjectBlueprint } from '../data/initialData';
import {
  Bot,
  Bug,
  Calendar,
  Layers,
  BookOpen,
  FileText,
  Sparkles,
} from 'lucide-react';

interface AiWorkspacePageProps {
  currentUser: User | null;
  onSignIn: () => void;
  isLoggingIn: boolean;
}

export const AiWorkspacePage: React.FC<AiWorkspacePageProps> = ({
  currentUser,
  onSignIn,
  isLoggingIn,
}) => {
  const [subTab, setSubTab] = useState<'chat' | 'debugger' | 'calendar' | 'blueprints' | 'cheatsheets' | 'docs'>('chat');

  const subTabs = [
    { id: 'chat', label: 'KI-Assistent', icon: Bot },
    { id: 'debugger', label: '5-Stufen Debugger', icon: Bug },
    { id: 'calendar', label: 'ITA Kalender (Google)', icon: Calendar },
    { id: 'blueprints', label: 'Architektur-Blueprints', icon: Layers },
    { id: 'cheatsheets', label: 'Wissensbasis & Schnell-KI', icon: BookOpen },
    { id: 'docs', label: 'Doku-Generator', icon: FileText },
  ];

  return (
    <div className="space-y-6 py-6 px-4 sm:px-6 max-w-7xl mx-auto">
      {/* Workspace Header Strip */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-2xs font-semibold uppercase tracking-wider text-zinc-400">Arbeitsbereich</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-white">AI Workspace &amp; Developer Engine</h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Spezialisierte KI-Modelle, strukturierte Fehleranalyse, Google Kalender und Architektur-Werkzeuge.
          </p>
        </div>

        {/* Sub-Tabs selector */}
        <div className="flex items-center gap-1.5 p-1 liquid-glass rounded-xl overflow-x-auto scrollbar-none border border-white/10">
          {subTabs.map((t) => {
            const Icon = t.icon;
            const isActive = subTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setSubTab(t.id as any)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'bg-white text-black font-semibold shadow-xs'
                    : 'text-zinc-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Render Sub-View */}
      <div className="min-h-[600px]">
        {subTab === 'chat' && <ChatSection onNavigateToTab={(t) => setSubTab(t as any)} />}
        {subTab === 'debugger' && <CodeDebuggerSection />}
        {subTab === 'calendar' && (
          <CalendarSection
            currentUser={currentUser}
            onSignIn={onSignIn}
            isLoggingIn={isLoggingIn}
          />
        )}
        {subTab === 'blueprints' && (
          <ProjectsSection onAskAiAboutProject={() => setSubTab('chat')} />
        )}
        {subTab === 'cheatsheets' && <CheatsheetsSection />}
        {subTab === 'docs' && <DocGeneratorSection />}
      </div>
    </div>
  );
};
