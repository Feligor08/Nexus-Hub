import React, { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import {
  CalendarEvent,
  fetchCalendarEvents,
  createCalendarEvent,
  deleteCalendarEvent,
} from '../services/calendarService';
import { INITIAL_SCHEDULE_EVENTS } from '../data/initialData';
import { ConfirmationModal } from './ConfirmationModal';
import {
  Calendar as CalendarIcon,
  Plus,
  Trash2,
  ExternalLink,
  Clock,
  MapPin,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  GraduationCap,
  Server,
  Briefcase,
  Layers,
} from 'lucide-react';

interface CalendarSectionProps {
  currentUser: User | null;
  onSignIn: () => void;
  isLoggingIn: boolean;
}

export const CalendarSection: React.FC<CalendarSectionProps> = ({
  currentUser,
  onSignIn,
  isLoggingIn,
}) => {
  const [events, setEvents] = useState<CalendarEvent[]>(INITIAL_SCHEDULE_EVENTS);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // New Event Form State
  const [showAddForm, setShowAddForm] = useState(false);
  const [newSummary, setNewSummary] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newLocation, setNewLocation] = useState('');
  const [newStartDate, setNewStartDate] = useState('');
  const [newEndDate, setNewEndDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Destructive Confirmation Modal State (MANDATORY per Workspace Skill)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [eventToDelete, setEventToDelete] = useState<CalendarEvent | null>(null);

  // Add Event Confirmation Modal State
  const [confirmAddModalOpen, setConfirmAddModalOpen] = useState(false);

  // Category filter
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // Load events from Google Calendar when signed in
  const loadGoogleEvents = async () => {
    if (!currentUser) return;
    setIsLoading(true);
    setError(null);
    try {
      const googleEvents = await fetchCalendarEvents();
      if (googleEvents.length > 0) {
        setEvents(googleEvents);
        setSuccessMessage('Termine erfolgreich mit Google Kalender synchronisiert.');
        setTimeout(() => setSuccessMessage(null), 3000);
      } else {
        setEvents(INITIAL_SCHEDULE_EVENTS);
      }
    } catch (err: any) {
      console.error('Failed to load Google Calendar events:', err);
      setError(
        err.message || 'Google Kalender konnte nicht synchronisiert werden. Prüfe die Berechtigungen.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser) {
      loadGoogleEvents();
    } else {
      setEvents(INITIAL_SCHEDULE_EVENTS);
    }
  }, [currentUser]);

  // Request Event Creation (opens explicit confirmation modal)
  const handleInitiateAddEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSummary.trim() || !newStartDate || !newEndDate) {
      setError('Bitte Titel, Start- und Endzeit angeben.');
      return;
    }
    setConfirmAddModalOpen(true);
  };

  // Perform Event Creation after user confirmed in modal
  const handleConfirmAddEvent = async () => {
    setConfirmAddModalOpen(false);
    setIsSubmitting(true);
    setError(null);

    try {
      if (currentUser) {
        const created = await createCalendarEvent({
          summary: newSummary,
          description: newDescription,
          location: newLocation,
          startDateTime: newStartDate,
          endDateTime: newEndDate,
        });
        setEvents((prev) => [created, ...prev]);
        setSuccessMessage(`Termin "${newSummary}" erfolgreich in Google Kalender eingetragen.`);
      } else {
        const mockNew: CalendarEvent = {
          id: `local-${Date.now()}`,
          summary: newSummary,
          description: newDescription,
          location: newLocation,
          start: { dateTime: new Date(newStartDate).toISOString() },
          end: { dateTime: new Date(newEndDate).toISOString() },
          category: 'project',
        };
        setEvents((prev) => [mockNew, ...prev]);
        setSuccessMessage(`Termin "${newSummary}" lokal gespeichert.`);
      }

      // Reset form
      setNewSummary('');
      setNewDescription('');
      setNewLocation('');
      setNewStartDate('');
      setNewEndDate('');
      setShowAddForm(false);
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      setError(err.message || 'Fehler beim Erstellen des Kalendereintrags');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Request Event Deletion (opens explicit confirmation modal per Workspace Skill)
  const handleInitiateDelete = (event: CalendarEvent) => {
    setEventToDelete(event);
    setDeleteModalOpen(true);
  };

  // Perform Deletion after explicit user confirmation in modal
  const handleConfirmDelete = async () => {
    if (!eventToDelete) return;
    const target = eventToDelete;
    setDeleteModalOpen(false);
    setEventToDelete(null);
    setIsLoading(true);
    setError(null);

    try {
      if (currentUser && !target.id.startsWith('sched-') && !target.id.startsWith('local-')) {
        await deleteCalendarEvent(target.id);
      }
      setEvents((prev) => prev.filter((e) => e.id !== target.id));
      setSuccessMessage(`Termin "${target.summary}" wurde erfolgreich gelöscht.`);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Fehler beim Löschen des Termins in Google Kalender.');
    } finally {
      setIsLoading(false);
    }
  };

  const getEventIcon = (event: CalendarEvent) => {
    const text = (event.summary + ' ' + (event.description || '')).toLowerCase();
    if (text.includes('klausur') || text.includes('prüfung') || text.includes('exam')) {
      return <GraduationCap className="w-4 h-4 text-zinc-200" />;
    }
    if (text.includes('atruvia') || text.includes('studium') || text.includes('bewerbung')) {
      return <Briefcase className="w-4 h-4 text-white" />;
    }
    if (text.includes('server') || text.includes('backup') || text.includes('casaos') || text.includes('docker')) {
      return <Server className="w-4 h-4 text-zinc-300" />;
    }
    return <Layers className="w-4 h-4 text-zinc-400" />;
  };

  const formatEventDate = (startObj?: { dateTime?: string; date?: string }) => {
    if (!startObj?.dateTime && !startObj?.date) return 'Keine Zeitangabe';
    const dateStr = startObj.dateTime || startObj.date;
    try {
      const d = new Date(dateStr!);
      return d.toLocaleString('de-DE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: startObj.dateTime ? '2-digit' : undefined,
        minute: startObj.dateTime ? '2-digit' : undefined,
      });
    } catch {
      return dateStr || '';
    }
  };

  const filteredEvents = events.filter((ev) => {
    if (categoryFilter === 'all') return true;
    const text = (ev.summary + ' ' + (ev.description || '')).toLowerCase();
    if (categoryFilter === 'exam') return text.includes('klausur') || text.includes('prüfung');
    if (categoryFilter === 'atruvia') return text.includes('atruvia') || text.includes('studium');
    if (categoryFilter === 'server') return text.includes('server') || text.includes('backup');
    return true;
  });

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header & Sync Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-white/10">
        <div>
          <span className="text-2xs font-semibold uppercase tracking-wider text-zinc-400">Termin- &amp; Meilenstein-Synchronisation</span>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 text-white" />
            <span>ITA Ausbildungs- &amp; Server-Kalender</span>
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Google Calendar Synchronisation für Klausurtermine (Fachhochschulreife 2027), Atruvia AG Bewerbungsphasen und Server-Wartung.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {currentUser ? (
            <button
              onClick={loadGoogleEvents}
              disabled={isLoading}
              className="flex items-center gap-1.5 px-3 py-2 btn-secondary text-xs rounded-lg transition-colors whitespace-nowrap cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-white' : ''}`} />
              <span>{isLoading ? 'Synchronisiere...' : 'Google Sync'}</span>
            </button>
          ) : (
            <button
              onClick={onSignIn}
              disabled={isLoggingIn}
              className="flex items-center gap-2 px-3.5 py-2 btn-primary text-xs rounded-lg transition-colors whitespace-nowrap cursor-pointer shadow-xs"
            >
              <CalendarIcon className="w-4 h-4" />
              <span>Mit Google Kalender verbinden</span>
            </button>
          )}

          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center gap-1.5 px-4 py-2 btn-secondary text-xs rounded-lg transition-colors whitespace-nowrap cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Neuer Termin</span>
          </button>
        </div>
      </div>

      {/* Feedback Messages */}
      {error && (
        <div className="p-3 bg-red-950/30 border border-red-800/40 rounded-xl flex items-center gap-2 text-xs text-red-300">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
          <span>{error}</span>
        </div>
      )}
      {successMessage && (
        <div className="p-3 bg-emerald-950/30 border border-emerald-800/40 rounded-xl flex items-center gap-2 text-xs text-emerald-300">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Add Event Form Collapsible */}
      {showAddForm && (
        <form
          onSubmit={handleInitiateAddEvent}
          className="p-6 glass-2 rounded-2xl border border-white/10 space-y-4 shadow-xl"
        >
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <h3 className="text-sm font-semibold text-white">
              Neuen Termin eintragen {currentUser ? '(in Google Kalender)' : '(lokal)'}
            </h3>
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="text-xs text-zinc-400 hover:text-white"
            >
              Abbrechen
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-2xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
                Titel / Bezeichnung *
              </label>
              <input
                type="text"
                required
                value={newSummary}
                onChange={(e) => setNewSummary(e.target.value)}
                placeholder="z.B. ITA Klausur Datenbanken / MariaDB"
                className="w-full px-3.5 py-2.5 text-xs liquid-glass-input rounded-xl text-white placeholder-zinc-500"
              />
            </div>

            <div>
              <label className="block text-2xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">Ort / Raum</label>
              <input
                type="text"
                value={newLocation}
                onChange={(e) => setNewLocation(e.target.value)}
                placeholder="z.B. ITA Labor 204 / Home Server"
                className="w-full px-3.5 py-2.5 text-xs liquid-glass-input rounded-xl text-white placeholder-zinc-500"
              />
            </div>

            <div>
              <label className="block text-2xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
                Start-Datum &amp; Uhrzeit *
              </label>
              <input
                type="datetime-local"
                required
                value={newStartDate}
                onChange={(e) => setNewStartDate(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs liquid-glass-input rounded-xl text-white placeholder-zinc-500"
              />
            </div>

            <div>
              <label className="block text-2xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
                End-Datum &amp; Uhrzeit *
              </label>
              <input
                type="datetime-local"
                required
                value={newEndDate}
                onChange={(e) => setNewEndDate(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs liquid-glass-input rounded-xl text-white placeholder-zinc-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-2xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
              Beschreibung &amp; Notizen
            </label>
            <textarea
              rows={2}
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="z.B. Themen: 3NF Normalisierung, SQL JOINs, Prepared Statements..."
              className="w-full px-3.5 py-2.5 text-xs liquid-glass-input rounded-xl text-white placeholder-zinc-500 leading-relaxed"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2 btn-ghost text-xs rounded-lg"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 btn-primary text-xs rounded-lg transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50"
            >
              Termin anlegen
            </button>
          </div>
        </form>
      )}

      {/* Filter Tabs & Source Status */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-1.5 p-1 glass-1 border border-white/10 rounded-xl overflow-x-auto scrollbar-none">
          <button
            onClick={() => setCategoryFilter('all')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
              categoryFilter === 'all'
                ? 'bg-white text-black font-semibold'
                : 'text-zinc-400 hover:text-white hover:bg-white/5'
            }`}
          >
            Alle Termine ({events.length})
          </button>
          <button
            onClick={() => setCategoryFilter('exam')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
              categoryFilter === 'exam'
                ? 'bg-white text-black font-semibold'
                : 'text-zinc-400 hover:text-white hover:bg-white/5'
            }`}
          >
            Klausuren &amp; Prüfungen
          </button>
          <button
            onClick={() => setCategoryFilter('atruvia')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
              categoryFilter === 'atruvia'
                ? 'bg-white text-black font-semibold'
                : 'text-zinc-400 hover:text-white hover:bg-white/5'
            }`}
          >
            Atruvia AG &amp; Studium
          </button>
          <button
            onClick={() => setCategoryFilter('server')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
              categoryFilter === 'server'
                ? 'bg-white text-black font-semibold'
                : 'text-zinc-400 hover:text-white hover:bg-white/5'
            }`}
          >
            HomeServer &amp; Backup
          </button>
        </div>

        {/* Status Indicator */}
        <div className="flex items-center gap-2 text-2xs text-zinc-400 font-mono">
          <span>QUELLE:</span>
          <span className="text-white font-medium">
            {currentUser ? 'Google Kalender (Live Sync)' : 'Lokaler ITA-Planer'}
          </span>
        </div>
      </div>

      {/* Events List */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="p-8 text-center glass-1 border border-white/10 rounded-xl">
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
            <p className="text-xs text-zinc-400">Lade Kalendertermine...</p>
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="p-8 text-center glass-1 border border-white/10 rounded-xl text-zinc-400">
            <CalendarIcon className="w-8 h-8 mx-auto mb-2 text-zinc-500" />
            <p className="text-sm font-medium text-white">Keine Termine in dieser Kategorie</p>
            <p className="text-xs text-zinc-400 mt-1">Klicke oben auf &quot;Neuer Termin&quot;, um einen Eintrag hinzuzufügen.</p>
          </div>
        ) : (
          filteredEvents.map((event) => (
            <div
              key={event.id}
              className="p-4 glass-1 liquid-glass-hover border border-white/10 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div className="flex items-start gap-3">
                <div className="p-2.5 bg-white/5 border border-white/10 rounded-lg shrink-0 mt-0.5 text-white">
                  {getEventIcon(event)}
                </div>

                <div className="space-y-1">
                  <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                    <span>{event.summary}</span>
                    {event.htmlLink && (
                      <a
                        href={event.htmlLink}
                        target="_blank"
                        rel="noreferrer"
                        className="text-zinc-400 hover:text-white"
                        title="In Google Kalender öffnen"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </h4>

                  {event.description && (
                    <p className="text-xs text-zinc-400 line-clamp-2 max-w-2xl leading-relaxed">{event.description}</p>
                  )}

                  {/* Clean unboxed metadata with bullet separators per zero-pill rule */}
                  <div className="flex items-center gap-2 text-2xs text-zinc-400 pt-0.5">
                    <span className="flex items-center gap-1 font-mono">
                      <Clock className="w-3 h-3 text-zinc-400" />
                      <span className="tabular-nums">{formatEventDate(event.start)}</span>
                    </span>
                    {event.location && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-zinc-400" />
                          <span>{event.location}</span>
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 self-end sm:self-center">
                <button
                  onClick={() => handleInitiateDelete(event)}
                  className="p-2 text-zinc-500 hover:text-white hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
                  title="Termin löschen (mit Bestätigung)"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* MANDATORY Confirmation Modal for DELETING Google Calendar Events */}
      <ConfirmationModal
        isOpen={deleteModalOpen}
        title="Termin dauerhaft löschen?"
        message={`Bist du sicher, dass du den Termin "${eventToDelete?.summary}" ${
          currentUser ? 'aus deinem Google Kalender' : 'aus dem Kalender'
        } löschen möchtest? Diese Aktion kann nicht rückgängig gemacht werden.`}
        confirmLabel="Ja, endgültig löschen"
        cancelLabel="Abbrechen"
        isDestructive={true}
        onConfirm={handleConfirmDelete}
        onCancel={() => {
          setDeleteModalOpen(false);
          setEventToDelete(null);
        }}
      />

      {/* Confirmation Modal for CREATING Google Calendar Events */}
      <ConfirmationModal
        isOpen={confirmAddModalOpen}
        title="Termin in Google Kalender anlegen?"
        message={`Möchtest du den neuen Termin "${newSummary}" vom ${newStartDate.replace(
          'T',
          ' '
        )} bis ${newEndDate.replace('T', ' ')} ${
          currentUser ? 'in deinem Google Kalender speichern' : 'lokal speichern'
        }?`}
        confirmLabel="Termin bestätigen &amp; speichern"
        cancelLabel="Zurück zur Bearbeitung"
        isDestructive={false}
        onConfirm={handleConfirmAddEvent}
        onCancel={() => setConfirmAddModalOpen(false)}
      />
    </div>
  );
};
