import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { AdminStats, User, AuditLog, SystemHealthData, CreatorApplication, CommunityReport } from '../types/platform';
import {
  Shield,
  Users,
  Database,
  Activity,
  CheckCircle2,
  AlertTriangle,
  RotateCw,
  Server,
  Play,
  Clock,
  HardDrive,
  Cpu,
  Layers,
  Network,
  Lock,
  Sparkles,
  Check,
  X,
  FileText,
  AlertCircle,
  Flag,
  Trash2,
} from 'lucide-react';

export const AdminPage: React.FC = () => {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [creatorApps, setCreatorApps] = useState<CreatorApplication[]>([]);
  const [reports, setReports] = useState<CommunityReport[]>([]);
  const [systemHealth, setSystemHealth] = useState<SystemHealthData | null>(null);
  const [activeTab, setActiveTab] = useState<'infrastructure' | 'users' | 'creator-apps' | 'reports' | 'logs'>('infrastructure');
  const [isLoading, setIsLoading] = useState(true);
  const [migrationStatus, setMigrationStatus] = useState<string | null>(null);
  const [isMigrating, setIsMigrating] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Review state
  const [appNotes, setAppNotes] = useState<Record<string, string>>({});
  const [reportNotes, setReportNotes] = useState<Record<string, string>>({});

  const loadAdminData = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [s, u, l, h, appsRes, repsRes] = await Promise.all([
        api.getAdminStats(),
        api.getAdminUsers(),
        api.getAdminAuditLogs(),
        api.getSystemHealth(),
        api.getAdminCreatorApplications().then((r) => r.applications).catch(() => []),
        api.getAdminReports().catch(() => []),
      ]);
      setStats(s);
      setUsers(u);
      setAuditLogs(l);
      setSystemHealth(h);
      setCreatorApps(appsRes);
      setReports(repsRes);
    } catch (e: any) {
      console.error('Failed to load admin data:', e);
      setLoadError(e instanceof Error ? e.message : 'Admin-Daten konnten nicht geladen werden.');
      setStats(null);
      setUsers([]);
      setAuditLogs([]);
      setSystemHealth(null);
      setCreatorApps([]);
      setReports([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAdminData();
  }, []);

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      const updated = await api.updateAdminUserRole(userId, newRole);
      setUsers((prev) => prev.map((u) => (u.id === userId ? updated : u)));
    } catch (e: any) {
      alert(e.message || 'Rollenänderung fehlgeschlagen');
    }
  };

  const handleToggleStatus = async (userId: string) => {
    try {
      const updated = await api.toggleAdminUserStatus(userId);
      setUsers((prev) => prev.map((u) => (u.id === userId ? updated : u)));
    } catch (e: any) {
      alert(e.message || 'Statusänderung fehlgeschlagen');
    }
  };

  const handleReviewCreatorApp = async (id: string, status: 'APPROVED' | 'REJECTED') => {
    const notes = appNotes[id] || '';
    try {
      await api.reviewCreatorApplication(id, status, notes);
      setCreatorApps((prev) =>
        prev.map((a) => (a.id === id ? { ...a, status, adminNotes: notes, reviewedAt: new Date().toISOString() } : a))
      );
      const updatedUsers = await api.getAdminUsers();
      setUsers(updatedUsers);
    } catch (err: any) {
      alert(err.message || 'Bewerbungsprüfung fehlgeschlagen');
    }
  };

  const handleReviewReport = async (id: string, status: 'RESOLVED' | 'DISMISSED') => {
    const notes = reportNotes[id] || '';
    try {
      await api.reviewReport(id, status, notes);
      setReports((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status, reviewNotes: notes, resolvedAt: new Date().toISOString() } : r))
      );
    } catch (err: any) {
      alert(err.message || 'Meldungsbearbeitung fehlgeschlagen');
    }
  };

  const handleDeleteReportedPost = async (postId: string, reportId: string) => {
    if (!confirm('Diesen gemeldeten Beitrag wirklich löschen?')) return;
    try {
      await api.deletePost(postId);
      await api.reviewReport(reportId, 'RESOLVED', 'Beitrag durch Administrator gelöscht');
      setReports((prev) =>
        prev.map((r) => (r.id === reportId ? { ...r, status: 'RESOLVED', reviewNotes: 'Beitrag gelöscht' } : r))
      );
    } catch (err: any) {
      alert(err.message || 'Löschen fehlgeschlagen');
    }
  };

  const handleRunMigrations = async () => {
    setIsMigrating(true);
    setMigrationStatus(null);
    try {
      const res = await api.runDatabaseMigrations();
      if (res.success) {
        setMigrationStatus(`Erfolg: ${res.data.message}`);
      } else {
        setMigrationStatus(`Fehler: ${res.error?.message || 'Migration fehlgeschlagen'}`);
      }
      await loadAdminData();
    } catch (err: any) {
      setMigrationStatus(`Fehler: ${err.message || 'Serverfehler'}`);
    } finally {
      setIsMigrating(false);
      setTimeout(() => setMigrationStatus(null), 5000);
    }
  };

  const isDbConnected = systemHealth?.database?.connected;
  const pendingAppsCount = creatorApps.filter((a) => a.status === 'PENDING').length;
  const pendingReportsCount = reports.filter((r) => r.status === 'PENDING').length;

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 space-y-8 animate-in fade-in duration-150">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-2xs font-semibold uppercase tracking-wider text-zinc-400">Verwaltungskonsole</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
            <Shield className="w-5 h-5 text-white" />
            <span>Nexus Administration &amp; Governance</span>
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            MariaDB Datenbank-Engine, HP EliteDesk Server-Infrastruktur, Creator-Anträge &amp; Audit-Logs.
          </p>
        </div>

        <button
          onClick={loadAdminData}
          disabled={isLoading}
          className="flex items-center gap-1.5 px-3 py-1.5 btn-secondary text-xs font-medium rounded-lg cursor-pointer"
        >
          <RotateCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Aktualisieren</span>
        </button>
      </div>

      {loadError && (
        <div role="alert" className="p-3 border border-rose-800/50 bg-rose-950/30 text-rose-200 text-xs rounded-lg">
          {loadError}
        </div>
      )}

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="p-4 glass-1 rounded-xl border border-white/10 space-y-1">
          <span className="text-2xs text-zinc-400 font-medium block">Datenbank-Status</span>
          <div className="flex items-center gap-2 mt-1">
            <span
              className={`w-2 h-2 rounded-full ${
                isDbConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
              }`}
            ></span>
            <span className="font-mono text-sm font-bold text-white">
              {isDbConnected ? 'MARIADB CONNECTED' : 'MARIADB UNAVAILABLE'}
            </span>
          </div>
          <span className="text-2xs text-zinc-500 block">
            {isDbConnected
              ? `${systemHealth?.database?.latencyMs || 0}ms Latenz`
              : 'Keine Datenbankdaten verfügbar'}
          </span>
        </div>

        <div className="p-4 glass-1 rounded-xl border border-white/10 space-y-1">
          <span className="text-2xs text-zinc-400 font-medium block">Registrierte Benutzer</span>
          <span className="font-mono text-xl font-bold text-white block mt-1">{stats?.totalUsers ?? users.length}</span>
          <span className="text-2xs text-zinc-500">RBAC geschützt</span>
        </div>

        <div className="p-4 glass-1 rounded-xl border border-white/10 space-y-1">
          <span className="text-2xs text-zinc-400 font-medium block">Portfolio Systeme</span>
          <span className="font-mono text-xl font-bold text-white block mt-1">{stats?.totalProjects ?? 0}</span>
          <span className="text-2xs text-zinc-500">Live Case Studies</span>
        </div>

        <div className="p-4 glass-1 rounded-xl border border-white/10 space-y-1">
          <span className="text-2xs text-zinc-400 font-medium block">Creator-Bewerbungen</span>
          <span className="font-mono text-xl font-bold text-white block mt-1">
            {creatorApps.length}
            {pendingAppsCount > 0 && (
              <span className="ml-2 text-2xs text-amber-400 font-sans font-semibold">({pendingAppsCount} offen)</span>
            )}
          </span>
          <span className="text-2xs text-zinc-500">Workflow &amp; Audit</span>
        </div>

        <div className="p-4 glass-1 rounded-xl border border-white/10 space-y-1">
          <span className="text-2xs text-zinc-400 font-medium block">Host Infrastruktur</span>
          <span className="font-mono text-sm font-bold text-white block mt-1">HP EliteDesk Mini</span>
          <span className="text-2xs text-zinc-500">Ubuntu 24.04 · Tailscale</span>
        </div>
      </div>

      {/* Admin Tabs */}
      <div className="flex items-center gap-2 border-b border-white/10 pb-3 overflow-x-auto scrollbar-none">
        <button
          onClick={() => setActiveTab('infrastructure')}
          className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'infrastructure' ? 'bg-white text-black' : 'text-zinc-400 hover:text-white'
          }`}
        >
          <Database className="w-3.5 h-3.5" />
          <span>Infrastruktur &amp; MariaDB</span>
        </button>

        <button
          onClick={() => setActiveTab('users')}
          className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'users' ? 'bg-white text-black' : 'text-zinc-400 hover:text-white'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Benutzerverwaltung ({users.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('creator-apps')}
          className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap relative ${
            activeTab === 'creator-apps' ? 'bg-white text-black' : 'text-zinc-400 hover:text-white'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Creator-Anträge ({creatorApps.length})</span>
          {pendingAppsCount > 0 && (
            <span className="w-2 h-2 rounded-full bg-amber-400"></span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('reports')}
          className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap relative ${
            activeTab === 'reports' ? 'bg-white text-black' : 'text-zinc-400 hover:text-white'
          }`}
        >
          <Flag className="w-3.5 h-3.5" />
          <span>Moderation &amp; Meldungen ({reports.length})</span>
          {pendingReportsCount > 0 && (
            <span className="w-2 h-2 rounded-full bg-rose-400"></span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('logs')}
          className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'logs' ? 'bg-white text-black' : 'text-zinc-400 hover:text-white'
          }`}
        >
          <Shield className="w-3.5 h-3.5" />
          <span>Sicherheits-Audit Logs ({auditLogs.length})</span>
        </button>
      </div>

      {/* Tab 1: INFRASTRUCTURE & MARIADB */}
      {activeTab === 'infrastructure' && (
        <div className="space-y-6">
          {migrationStatus && (
            <div className="p-3 bg-white/10 border border-white/20 rounded-xl text-xs text-white flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-white" />
              <span>{migrationStatus}</span>
            </div>
          )}

          {/* Database Control Card */}
          <div className="p-6 glass-2 rounded-2xl border border-white/10 space-y-5 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center text-white">
                  <Database className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">MariaDB 11 Connection Pool</h3>
                  <p className="text-2xs text-zinc-400">
                    Host: {systemHealth?.database?.host || '127.0.0.1'} · DB: nexus_code_play · User: nexus_app (Unprivileged)
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleRunMigrations}
                  disabled={isMigrating}
                  className="flex items-center gap-1.5 px-3 py-1.5 btn-primary text-2xs font-semibold rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                  title="Führt Migrationen auf MariaDB aus"
                >
                  <Play className="w-3 h-3" />
                  <span>{isMigrating ? 'Führe aus...' : 'Schema Migrationen anwenden'}</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="p-3.5 bg-black/40 border border-white/10 rounded-xl space-y-1">
                <span className="text-2xs text-zinc-400 uppercase tracking-wider block">Verbindungsmodus</span>
                <span className="font-mono text-sm font-bold text-white block">
                  {isDbConnected ? 'Native MariaDB Connection' : 'High-Fidelity Resilient Mode'}
                </span>
                <span className="text-2xs text-zinc-500 block">
                  {isDbConnected
                    ? 'Verbindung zum HP EliteDesk aktiv'
                    : 'Reagiert kontrolliert bei Netzwerkunterbrechung'}
                </span>
              </div>

              <div className="p-3.5 bg-black/40 border border-white/10 rounded-xl space-y-1">
                <span className="text-2xs text-zinc-400 uppercase tracking-wider block">Least-Privilege Security</span>
                <span className="font-mono text-sm font-bold text-white block">nexus_app Account</span>
                <span className="text-2xs text-zinc-500 block">Root-Zugriff für Applikation gesperrt</span>
              </div>

              <div className="p-3.5 bg-black/40 border border-white/10 rounded-xl space-y-1">
                <span className="text-2xs text-zinc-400 uppercase tracking-wider block">Netzwerk &amp; Port</span>
                <span className="font-mono text-sm font-bold text-white block">Port 3306 (Tailscale)</span>
                <span className="text-2xs text-zinc-500 block">Keine unnötige WAN-Portfreigabe</span>
              </div>
            </div>
          </div>

          {/* System Services Grid */}
          <div className="p-6 glass-1 rounded-2xl border border-white/10 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Server className="w-4 h-4 text-white" />
                <span>Infrastruktur &amp; Service Topologie</span>
              </h3>
              <span className="text-2xs text-zinc-400 font-mono">Stand: {new Date().toLocaleTimeString()}</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {[
                { name: 'MariaDB 11 Database Engine', status: isDbConnected ? 'ONLINE' : 'FALLBACK', note: 'Port 3306 / InnoDB' },
                { name: 'Nexus REST API Gateway', status: 'ONLINE', note: 'Port 3000 / Express TS' },
                { name: 'Gemini AI Integration', status: 'AVAILABLE', note: 'Gemini 3.5 & 3.1 Flash' },
                { name: 'Google Workspace Calendar', status: 'ONLINE', note: 'OAuth 2.0 Bearer Sync' },
                { name: 'Docker Engine (HP EliteDesk)', status: 'RUNNING', note: 'Ubuntu Server 24.04 LTS' },
                { name: 'Tailscale Mesh-VPN', status: 'CONNECTED', note: 'Zero-Trust Remote Mesh' },
              ].map((svc, idx) => (
                <div key={idx} className="p-3 bg-white/[0.02] border border-white/10 rounded-xl flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="font-medium text-xs text-white block">{svc.name}</span>
                    <span className="text-3xs text-zinc-400">{svc.note}</span>
                  </div>
                  <span className="px-2 py-0.5 text-3xs font-mono font-bold bg-white/10 text-white rounded">
                    {svc.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: USERS */}
      {activeTab === 'users' && (
        <div className="p-6 glass-1 rounded-2xl border border-white/10 overflow-x-auto shadow-xl">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-white/10 text-zinc-400 text-2xs uppercase tracking-wider">
                <th className="pb-3 font-semibold">Benutzer</th>
                <th className="pb-3 font-semibold">E-Mail</th>
                <th className="pb-3 font-semibold">Rolle (RBAC)</th>
                <th className="pb-3 font-semibold">Status</th>
                <th className="pb-3 font-semibold text-right">Aktionen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="py-3 font-medium text-white flex items-center gap-2.5">
                    <img
                      src={u.avatar || '/src/assets/images/avatar_ita_developer_1790662143237.jpg'}
                      alt={u.displayName}
                      className="w-7 h-7 rounded-lg object-cover border border-white/10"
                    />
                    <div>
                      <span className="block font-semibold">{u.displayName}</span>
                      <span className="text-2xs text-zinc-500 font-mono">@{u.username}</span>
                    </div>
                  </td>
                  <td className="py-3 text-zinc-400">{u.email}</td>
                  <td className="py-3">
                    <select
                      value={u.role}
                      onChange={(e) => handleRoleChange(u.id, e.target.value)}
                      className="liquid-glass-input text-2xs px-2 py-1 rounded font-mono"
                    >
                      <option value="USER" className="bg-[#0e1014] text-white">USER</option>
                      <option value="CREATOR" className="bg-[#0e1014] text-white">CREATOR</option>
                      <option value="MODERATOR" className="bg-[#0e1014] text-white">MODERATOR</option>
                      <option value="ADMIN" className="bg-[#0e1014] text-white">ADMIN</option>
                      <option value="GUEST" className="bg-[#0e1014] text-white">GUEST</option>
                    </select>
                  </td>
                  <td className="py-3">
                    <span
                      className={`px-2 py-0.5 rounded text-2xs font-mono font-medium ${
                        u.status === 'ACTIVE'
                          ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/40'
                          : 'bg-red-950/60 text-red-300 border border-red-800/40'
                      }`}
                    >
                      {u.status}
                    </span>
                  </td>
                  <td className="py-3 text-right">
                    <button
                      onClick={() => handleToggleStatus(u.id)}
                      className="text-2xs text-zinc-400 hover:text-white px-2.5 py-1 rounded border border-white/10 hover:border-white/20 transition-colors cursor-pointer"
                    >
                      {u.status === 'ACTIVE' ? 'Sperren' : 'Aktivieren'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab: CREATOR APPLICATIONS */}
      {activeTab === 'creator-apps' && (
        <div className="space-y-4">
          {creatorApps.length === 0 ? (
            <div className="p-12 text-center text-zinc-500 liquid-glass rounded-xl border border-white/10">
              <Sparkles className="w-10 h-10 mx-auto mb-2 text-zinc-600 stroke-[1.5]" />
              <p className="text-sm font-semibold text-zinc-300">Keine Creator-Anträge vorhanden</p>
              <p className="text-xs text-zinc-500 mt-1">Bewerbungen von Nutzern erscheinen hier zur Überprüfung.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {creatorApps.map((app) => (
                <div
                  key={app.id}
                  className="p-6 liquid-glass rounded-xl border border-white/10 space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/10">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-white/10 text-white">
                        <Users className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-white">
                          Bewerbung von @{app.userUsername || app.userId}
                        </h4>
                        <span className="text-2xs text-zinc-400 font-mono">
                          Eingereicht am {new Date(app.createdAt).toLocaleDateString('de-DE')} {app.userEmail && `· ${app.userEmail}`}
                        </span>
                      </div>
                    </div>

                    <span
                      className={`px-2.5 py-1 text-2xs font-mono font-bold rounded-full self-start sm:self-center ${
                        app.status === 'APPROVED'
                          ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/40'
                          : app.status === 'REJECTED'
                          ? 'bg-rose-950/60 text-rose-300 border border-rose-800/40'
                          : 'bg-amber-950/60 text-amber-300 border border-amber-800/40'
                      }`}
                    >
                      {app.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                    <div className="p-3 rounded-lg bg-black/40 border border-white/5 space-y-1">
                      <span className="text-2xs font-mono text-zinc-400 uppercase tracking-wider block">Motivation</span>
                      <p className="text-zinc-200 whitespace-pre-wrap">{app.motivation}</p>
                    </div>

                    <div className="p-3 rounded-lg bg-black/40 border border-white/5 space-y-1">
                      <span className="text-2xs font-mono text-zinc-400 uppercase tracking-wider block">Geplante Projekte</span>
                      <p className="text-zinc-200 whitespace-pre-wrap">{app.plannedProjects}</p>
                    </div>

                    <div className="p-3 rounded-lg bg-black/40 border border-white/5 space-y-1">
                      <span className="text-2xs font-mono text-zinc-400 uppercase tracking-wider block">Geplante Inhalte</span>
                      <p className="text-zinc-200 whitespace-pre-wrap">{app.plannedContent}</p>
                      {app.portfolioUrl && (
                        <div className="pt-2 border-t border-white/5">
                          <a href={app.portfolioUrl} target="_blank" rel="noreferrer" className="text-zinc-300 underline text-2xs">
                            Portfolio / Link
                          </a>
                        </div>
                      )}
                    </div>
                  </div>

                  {app.adminNotes && (
                    <div className="p-3 rounded-lg bg-white/[0.02] border border-white/5 text-2xs text-zinc-400">
                      <span className="font-semibold text-zinc-300 block">Notizen / Begründung:</span>
                      <p className="mt-0.5">{app.adminNotes}</p>
                    </div>
                  )}

                  {/* Action Bar for Pending Applications */}
                  {app.status === 'PENDING' && (
                    <div className="pt-3 border-t border-white/10 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                      <input
                        type="text"
                        placeholder="Begründung oder Admin-Notiz eingeben (optional)..."
                        value={appNotes[app.id] || ''}
                        onChange={(e) => setAppNotes({ ...appNotes, [app.id]: e.target.value })}
                        className="flex-1 px-3 py-1.5 bg-black/40 border border-white/10 rounded-lg text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-white/30"
                      />
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => handleReviewCreatorApp(app.id, 'REJECTED')}
                          className="px-3.5 py-1.5 bg-rose-950/60 hover:bg-rose-900 border border-rose-800/50 text-rose-200 text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>Ablehnen</span>
                        </button>
                        <button
                          onClick={() => handleReviewCreatorApp(app.id, 'APPROVED')}
                          className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-black text-xs font-bold rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Genehmigen &amp; Rolle zuweisen</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: MODERATION & REPORTS */}
      {activeTab === 'reports' && (
        <div className="space-y-4">
          {reports.length === 0 ? (
            <div className="p-12 text-center text-zinc-500 liquid-glass rounded-xl border border-white/10">
              <Flag className="w-10 h-10 mx-auto mb-2 text-zinc-600 stroke-[1.5]" />
              <p className="text-sm font-semibold text-zinc-300">Keine gemeldeten Beiträge</p>
              <p className="text-xs text-zinc-500 mt-1">Community-Meldungen erscheinen hier zur Überprüfung.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {reports.map((rep) => (
                <div
                  key={rep.id}
                  className="p-5 liquid-glass rounded-xl border border-white/10 space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-white/10">
                    <div className="flex items-center gap-2 text-xs">
                      <Flag className="w-4 h-4 text-rose-400" />
                      <span className="font-bold text-white">
                        {rep.postId ? `Beitrag: "${rep.postTitle || rep.postId}"` : `Kommentar gemeldet`}
                      </span>
                      <span className="text-zinc-500">·</span>
                      <span className="text-zinc-400 text-2xs">
                        Gemeldet von @{rep.reporterUsername || rep.reporterId} ({new Date(rep.createdAt).toLocaleDateString('de-DE')})
                      </span>
                    </div>

                    <span
                      className={`px-2 py-0.5 text-2xs font-mono font-bold rounded-full ${
                        rep.status === 'RESOLVED'
                          ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/40'
                          : rep.status === 'DISMISSED'
                          ? 'bg-zinc-800 text-zinc-400 border border-white/10'
                          : 'bg-rose-950/60 text-rose-300 border border-rose-800/40'
                      }`}
                    >
                      {rep.status}
                    </span>
                  </div>

                  <div className="p-3 rounded-lg bg-black/40 border border-white/5 text-xs">
                    <span className="text-2xs font-mono text-zinc-400 uppercase tracking-wider block">Meldegrund:</span>
                    <p className="text-zinc-200 mt-0.5">{rep.reason}</p>
                  </div>

                  {rep.reviewNotes && (
                    <div className="p-2.5 rounded-lg bg-white/[0.02] border border-white/5 text-2xs text-zinc-400">
                      <span className="font-semibold text-zinc-300">Moderationsnotiz:</span> {rep.reviewNotes}
                    </div>
                  )}

                  {rep.status === 'PENDING' && (
                    <div className="pt-2 border-t border-white/10 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
                      <input
                        type="text"
                        placeholder="Moderationsentscheidung / Notiz..."
                        value={reportNotes[rep.id] || ''}
                        onChange={(e) => setReportNotes({ ...reportNotes, [rep.id]: e.target.value })}
                        className="flex-1 px-3 py-1.5 bg-black/40 border border-white/10 rounded-lg text-xs text-white placeholder-zinc-500 focus:outline-none"
                      />
                      <div className="flex items-center gap-2 shrink-0">
                        {rep.postId && (
                          <button
                            onClick={() => handleDeleteReportedPost(rep.postId!, rep.id)}
                            className="px-3 py-1.5 bg-rose-950/80 hover:bg-rose-900 border border-rose-800 text-rose-200 text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Löschen &amp; Schließen</span>
                          </button>
                        )}
                        <button
                          onClick={() => handleReviewReport(rep.id, 'DISMISSED')}
                          className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-300 text-xs font-medium rounded-lg transition-colors cursor-pointer"
                        >
                          Abweisen
                        </button>
                        <button
                          onClick={() => handleReviewReport(rep.id, 'RESOLVED')}
                          className="px-3 py-1.5 bg-white text-black text-xs font-semibold rounded-lg hover:bg-zinc-200 transition-colors cursor-pointer"
                        >
                          Als gelöst markieren
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: AUDIT LOGS */}
      {activeTab === 'logs' && (
        <div className="p-6 glass-1 rounded-2xl border border-white/10 overflow-x-auto shadow-xl">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-white/10 text-zinc-400 text-2xs uppercase tracking-wider">
                <th className="pb-3 font-semibold">Zeitstempel</th>
                <th className="pb-3 font-semibold">Aktion</th>
                <th className="pb-3 font-semibold">Benutzer</th>
                <th className="pb-3 font-semibold">Details</th>
                <th className="pb-3 font-semibold text-right">IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-zinc-300">
              {auditLogs.map((log) => (
                <tr key={log.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="py-2.5 text-zinc-400 text-2xs">{new Date(log.timestamp).toLocaleString()}</td>
                  <td className="py-2.5">
                    <span className="px-1.5 py-0.5 bg-white/10 text-white rounded text-2xs font-bold">
                      {log.action}
                    </span>
                  </td>
                  <td className="py-2.5 text-zinc-200">{log.username}</td>
                  <td className="py-2.5 text-zinc-400 font-sans text-xs">{log.details}</td>
                  <td className="py-2.5 text-right text-2xs text-zinc-400">{log.ip}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
