import React, { useState, useEffect } from 'react';
import { MediaFile } from '../../types/platform';
import { api } from '../../services/api';
import {
  X,
  Image as ImageIcon,
  File,
  FileText,
  Box,
  Upload,
  Trash2,
  Copy,
  Check,
  Search,
  Filter,
  AlertCircle,
  Plus,
} from 'lucide-react';

interface MediaManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectMedia?: (media: MediaFile) => void;
}

export const MediaManagerModal: React.FC<MediaManagerModalProps> = ({
  isOpen,
  onClose,
  onSelectMedia,
}) => {
  const [mediaList, setMediaList] = useState<MediaFile[]>([]);
  const [category, setCategory] = useState<string>('all');
  const [search, setSearch] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Upload Form State
  const [isUploading, setIsUploading] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchMedia = () => {
    setIsLoading(true);
    api.getMedia(true, category)
      .then((data) => setMediaList(data))
      .catch((err) => setErrorMsg(err.message || 'Fehler beim Laden der Medien.'))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    if (isOpen) {
      fetchMedia();
    }
  }, [isOpen, category]);

  if (!isOpen) return null;

  const handleCopy = (url: string, id: string) => {
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Mediendatei wirklich löschen?')) return;
    try {
      await api.deleteMedia(id);
      setMediaList((prev) => prev.filter((m) => m.id !== id));
    } catch (err: any) {
      alert(err.message || 'Löschen fehlgeschlagen.');
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) {
      setErrorMsg('Wähle zuerst eine Datei aus.');
      return;
    }

    try {
      setErrorMsg(null);
      const created = await api.uploadMedia(uploadFile);

      setMediaList([created, ...mediaList]);
      setUploadFile(null);
      setIsUploading(false);
    } catch (err: any) {
      setErrorMsg(err.message || 'Fehler beim Hochladen der Datei.');
    }
  };

  const filtered = mediaList.filter(
    (m) =>
      !search ||
      m.filename.toLowerCase().includes(search.toLowerCase()) ||
      m.originalName.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-4xl glass-2 border border-white/15 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden my-auto animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center text-white">
              <ImageIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Medien- &amp; Asset-Manager</h2>
              <p className="text-2xs font-mono text-zinc-400">
                Nexus CMS · Grafiken, Dokumente &amp; Binärdateien
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsUploading(!isUploading)}
              className="px-3 py-1.5 bg-white text-black font-semibold text-xs rounded-xl hover:bg-zinc-200 transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Asset hinzufügen</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Upload Drawer / Form */}
        {isUploading && (
          <form
            onSubmit={handleUpload}
            className="p-5 border-b border-white/10 bg-white/[0.03] space-y-4 animate-in slide-in-from-top duration-150 text-xs"
          >
            <div className="flex items-center justify-between">
              <span className="font-bold text-white text-xs">Neues Asset registrieren / hochladen</span>
              <button
                type="button"
                onClick={() => setIsUploading(false)}
                className="text-2xs text-zinc-400 hover:text-white"
              >
                Schließen
              </button>
            </div>

            <div className="space-y-2">
              <label htmlFor="media-upload-file" className="text-2xs font-mono text-zinc-400 uppercase">
                Datei auswählen *
              </label>
              <input
                id="media-upload-file"
                type="file"
                required
                accept=".jpg,.jpeg,.png,.webp,.pdf,.zip,.stl,.3mf,.step,.stp"
                onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-xs file:mr-3 file:px-3 file:py-1 file:border-0 file:rounded-md file:bg-white file:text-black"
              />
              <p className="text-2xs text-zinc-500">
                PNG/JPG/WEBP, PDF, ZIP und 3D-Formate. Typ und Größe werden serverseitig geprüft.
              </p>
              {uploadFile && (
                <p className="text-2xs text-zinc-300 font-mono">
                  {uploadFile.name} · {(uploadFile.size / 1024 / 1024).toFixed(2)} MB
                </p>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsUploading(false)}
                className="px-3 py-1.5 text-zinc-400 hover:text-white rounded-lg"
              >
                Abbrechen
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-white text-black font-bold text-xs rounded-xl hover:bg-zinc-200 cursor-pointer"
              >
                Asset speichern
              </button>
            </div>
          </form>
        )}

        {/* Toolbar: Category Filters and Search */}
        <div className="p-4 border-b border-white/10 bg-black/20 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
            {[
              { id: 'all', label: 'Alle' },
              { id: 'image', label: 'Bilder' },
              { id: 'file', label: 'Dateien & ZIPs' },
              { id: 'document', label: 'Dokumente' },
              { id: '3d', label: '3D STL / Bambu' },
            ].map((c) => (
              <button
                key={c.id}
                onClick={() => setCategory(c.id)}
                className={`px-3 py-1 rounded-lg text-2xs font-medium cursor-pointer transition-colors ${
                  category === c.id
                    ? 'bg-white text-black font-semibold'
                    : 'text-zinc-400 hover:text-white hover:bg-white/5'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-56">
            <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Medien durchsuchen..."
              className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-zinc-500 text-2xs focus:outline-none focus:border-white/30"
            />
          </div>
        </div>

        {/* Media Grid */}
        <div className="p-6 overflow-y-auto flex-1">
          {isLoading ? (
            <div className="py-16 text-center text-xs text-zinc-500">Lade Medienbibliothek...</div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center text-zinc-500 glass-2 rounded-xl border border-white/10 space-y-2">
              <ImageIcon className="w-10 h-10 mx-auto text-zinc-600 stroke-[1.5]" />
              <p className="text-sm font-semibold text-zinc-300">Keine Mediendateien vorhanden</p>
              <p className="text-2xs text-zinc-500 max-w-sm mx-auto">
                Registriere deine Cover-Grafiken, Dokumente und 3D-Druck STL-Dateien über "Asset hinzufügen".
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {filtered.map((item) => (
                <div
                  key={item.id}
                  className="group p-3 liquid-glass rounded-xl border border-white/10 flex flex-col justify-between space-y-2.5 relative hover:border-white/30 transition-all"
                >
                  <div className="h-28 w-full rounded-lg bg-black/40 overflow-hidden flex items-center justify-center relative border border-white/5">
                    {item.fileCategory === 'image' ? (
                      <img
                        src={item.storagePath}
                        alt={item.filename}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        onError={(e) => {
                          (e.target as any).src =
                            '/src/assets/images/nexus_cyberpunk_banner_1790662130550.jpg';
                        }}
                      />
                    ) : item.fileCategory === '3d' ? (
                      <Box className="w-8 h-8 text-cyan-400 stroke-[1.5]" />
                    ) : item.fileCategory === 'document' ? (
                      <FileText className="w-8 h-8 text-amber-400 stroke-[1.5]" />
                    ) : (
                      <File className="w-8 h-8 text-emerald-400 stroke-[1.5]" />
                    )}

                    <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/70 text-3xs font-mono text-zinc-300">
                      {(item.fileSize / 1024).toFixed(0)} KB
                    </span>
                  </div>

                  <div>
                    <h4 className="text-xs font-semibold text-white truncate" title={item.filename}>
                      {item.filename}
                    </h4>
                    <span className="text-3xs font-mono text-zinc-500 uppercase block">
                      {item.fileCategory}
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-white/10 text-2xs">
                    <button
                      onClick={() => handleCopy(item.storagePath, item.id)}
                      className="text-zinc-400 hover:text-white flex items-center gap-1 cursor-pointer"
                      title="Pfad kopieren"
                    >
                      {copiedId === item.id ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span className="text-emerald-400">Kopiert</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>URL</span>
                        </>
                      )}
                    </button>

                    {onSelectMedia ? (
                      <button
                        onClick={() => {
                          onSelectMedia(item);
                          onClose();
                        }}
                        className="px-2 py-1 bg-white text-black font-bold rounded text-3xs cursor-pointer hover:bg-zinc-200"
                      >
                        Auswählen
                      </button>
                    ) : (
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="text-zinc-500 hover:text-rose-400 cursor-pointer p-1"
                        title="Datei löschen"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-white/10 bg-white/[0.02] flex items-center justify-between text-2xs text-zinc-500">
          <span>{filtered.length} Elemente in der Bibliothek</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 glass-2 border border-white/10 rounded-lg text-zinc-300 hover:text-white"
          >
            Schließen
          </button>
        </div>
      </div>
    </div>
  );
};
