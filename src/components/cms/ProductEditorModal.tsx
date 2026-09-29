import React, { useState, useEffect } from 'react';
import { Product, ContentStatus } from '../../types/platform';
import { api } from '../../services/api';
import {
  X,
  ShoppingBag,
  Save,
  Send,
  Eye,
  FileCode,
  DollarSign,
  Layers,
  Sparkles,
  AlertCircle,
  PackageCheck,
  Check,
  Tag,
} from 'lucide-react';

interface ProductEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: (product: Product) => void;
  initialProduct?: Product | null;
}

const PRODUCT_CATEGORIES = [
  'Templates',
  'Developer Tools',
  '3D Models & STL',
  'Tutorials',
  'Software',
  'Minecraft Mods',
  'Roblox Assets',
];

const FILE_FORMATS = ['ZIP', 'STL', 'PDF', 'DOCKER', 'TAR.GZ', 'EXE', 'CS'];

const LICENSES = [
  'MIT Open Source',
  'Commercial / Single Use',
  'Commercial / Extended Multi-Project',
  'Creative Commons CC-BY-SA 4.0',
  'GPL-3.0',
];

export const ProductEditorModal: React.FC<ProductEditorModalProps> = ({
  isOpen,
  onClose,
  onSaved,
  initialProduct,
}) => {
  const [activeTab, setActiveTab] = useState<'basics' | 'digital' | 'pricing' | 'media' | 'preview'>('basics');

  // Form State
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [category, setCategory] = useState('Templates');
  const [shortDesc, setShortDesc] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState<number>(0);
  const [currency, setCurrency] = useState('EUR');
  const [status, setStatus] = useState<ContentStatus>('DRAFT');
  const [visibility, setVisibility] = useState<'PUBLIC' | 'PRIVATE'>('PUBLIC');
  const [featured, setFeatured] = useState(false);

  // Digital Product Fields
  const [digitalProduct, setDigitalProduct] = useState(true);
  const [fileFormat, setFileFormat] = useState('ZIP');
  const [fileSize, setFileSize] = useState('15 MB');
  const [version, setVersion] = useState('1.0.0');
  const [license, setLicense] = useState('MIT Open Source');

  // Media & Links
  const [coverImage, setCoverImage] = useState('');
  const [demoFileUrl, setDemoFileUrl] = useState('');
  const [documentationUrl, setDocumentationUrl] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (initialProduct) {
      setName(initialProduct.name || '');
      setSlug(initialProduct.slug || '');
      setCategory(initialProduct.category || 'Templates');
      setShortDesc(initialProduct.shortDesc || '');
      setDescription(initialProduct.description || '');
      setPrice(initialProduct.price !== undefined ? initialProduct.price : 0);
      setCurrency(initialProduct.currency || 'EUR');
      setStatus((initialProduct.status as ContentStatus) || 'DRAFT');
      setVisibility(initialProduct.visibility || 'PUBLIC');
      setFeatured(Boolean(initialProduct.featured));
      setDigitalProduct(initialProduct.digitalProduct !== undefined ? initialProduct.digitalProduct : true);
      setFileFormat(initialProduct.fileFormat || 'ZIP');
      setFileSize(initialProduct.fileSize || '15 MB');
      setVersion(initialProduct.version || '1.0.0');
      setLicense(initialProduct.license || 'MIT Open Source');
      setCoverImage(
        initialProduct.images?.[0] || '/src/assets/images/nexus_cyberpunk_banner_1790662130550.jpg'
      );
      setDemoFileUrl(initialProduct.demoFileUrl || '');
      setDocumentationUrl(initialProduct.documentationUrl || '');
    } else {
      setName('');
      setSlug('');
      setCategory('Templates');
      setShortDesc('');
      setDescription('');
      setPrice(0);
      setCurrency('EUR');
      setStatus('DRAFT');
      setVisibility('PUBLIC');
      setFeatured(false);
      setDigitalProduct(true);
      setFileFormat('ZIP');
      setFileSize('12 MB');
      setVersion('1.0.0');
      setLicense('MIT Open Source');
      setCoverImage('/src/assets/images/nexus_cyberpunk_banner_1790662130550.jpg');
      setDemoFileUrl('');
      setDocumentationUrl('');
    }
    setActiveTab('basics');
    setErrorMsg(null);
  }, [initialProduct, isOpen]);

  if (!isOpen) return null;

  const handleNameChange = (val: string) => {
    setName(val);
    if (!initialProduct) {
      setSlug(
        val
          .toLowerCase()
          .replace(/ä/g, 'ae')
          .replace(/ö/g, 'oe')
          .replace(/ü/g, 'ue')
          .replace(/ß/g, 'ss')
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '')
      );
    }
  };

  const handleSave = async (targetStatus?: ContentStatus) => {
    if (!name.trim()) {
      setErrorMsg('Bitte gib einen Produktnamen ein.');
      setActiveTab('basics');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    const effectiveStatus = targetStatus || status;

    const payload: Partial<Product> = {
      name,
      slug: slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      category,
      shortDesc,
      description,
      price: Number(price) || 0,
      currency,
      status: effectiveStatus,
      published: effectiveStatus === 'PUBLISHED',
      visibility,
      featured,
      digitalProduct,
      fileFormat,
      fileSize,
      version,
      license,
      images: [coverImage || '/src/assets/images/nexus_cyberpunk_banner_1790662130550.jpg'],
      demoFileUrl: demoFileUrl || undefined,
      documentationUrl: documentationUrl || undefined,
    };

    try {
      let saved: Product;
      if (initialProduct && initialProduct.id) {
        saved = await api.updateProduct(initialProduct.id, payload);
      } else {
        saved = await api.createProduct(payload);
      }
      onSaved(saved);
      onClose();
    } catch (err: any) {
      console.error('Failed to save product:', err);
      setErrorMsg(err.message || 'Fehler beim Speichern des Produkts.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-4xl glass-2 border border-white/15 rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden my-auto animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center text-white">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">
                {initialProduct ? 'Produkt bearbeiten' : 'Neues Produkt anlegen'}
              </h2>
              <p className="text-2xs font-mono text-zinc-400">
                Nexus Store CMS · Digitale Produkte &amp; Token-Lizenzierung
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`px-2 py-0.5 rounded text-2xs font-mono font-bold uppercase tracking-wider ${
                status === 'PUBLISHED'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : status === 'ARCHIVED'
                  ? 'bg-zinc-700/40 text-zinc-400 border border-zinc-600/30'
                  : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
              }`}
            >
              {status}
            </span>
            <button
              onClick={onClose}
              className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 px-6 pt-2 pb-2 border-b border-white/10 bg-black/20 overflow-x-auto scrollbar-none text-xs">
          {[
            { id: 'basics', label: '1. Grunddaten' },
            { id: 'digital', label: '2. Digitale Datei & Version' },
            { id: 'pricing', label: '3. Preis & Lizenz' },
            { id: 'media', label: '4. Medien & Links' },
            { id: 'preview', label: '5. Vorschau' },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as any)}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all whitespace-nowrap cursor-pointer ${
                activeTab === t.id
                  ? 'bg-white text-black font-semibold shadow-sm'
                  : 'text-zinc-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Error message */}
        {errorMsg && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-rose-950/40 border border-rose-800/50 text-xs text-rose-200 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Form Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6 text-xs text-zinc-300">
          {/* TAB 1: BASICS */}
          {activeTab === 'basics' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-2xs font-mono uppercase text-zinc-400">Produktname *</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    placeholder="z.B. C# WPF Modern Enterprise Blueprint"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-zinc-500 focus:outline-none focus:border-white/30"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-2xs font-mono uppercase text-zinc-400">Slug (URL-Pfad)</label>
                  <input
                    type="text"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    placeholder="csharp-wpf-blueprint"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 font-mono text-zinc-300 placeholder-zinc-500 focus:outline-none focus:border-white/30"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-2xs font-mono uppercase text-zinc-400">Kategorie</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-white/10 text-white focus:outline-none focus:border-white/30"
                  >
                    {PRODUCT_CATEGORIES.map((c) => (
                      <option key={c} value={c} className="bg-zinc-900 text-white">
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-2xs font-mono uppercase text-zinc-400">Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as ContentStatus)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-white/10 text-white focus:outline-none focus:border-white/30"
                  >
                    <option value="DRAFT">DRAFT (Entwurf - noch nicht im Store gelistet)</option>
                    <option value="PUBLISHED">PUBLISHED (Öffentlich im Store kaufbar/claimbar)</option>
                    <option value="ARCHIVED">ARCHIVED (Archiviert)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-2xs font-mono uppercase text-zinc-400">Sichtbarkeit</label>
                  <select
                    value={visibility}
                    onChange={(e) => setVisibility(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-white/10 text-white focus:outline-none focus:border-white/30"
                  >
                    <option value="PUBLIC">Öffentlich</option>
                    <option value="PRIVATE">Privat</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-2xs font-mono uppercase text-zinc-400">Kurzbeschreibung</label>
                <textarea
                  value={shortDesc}
                  onChange={(e) => setShortDesc(e.target.value)}
                  rows={2}
                  placeholder="Kompakte Übersicht für Store-Karten..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-zinc-500 focus:outline-none focus:border-white/30"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-2xs font-mono uppercase text-zinc-400">
                  Detaillierte Produktbeschreibung
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={6}
                  placeholder="Ausführliche Funktionsliste, Systemanforderungen, Enthaltene Dateien..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-zinc-500 font-mono text-xs leading-relaxed focus:outline-none focus:border-white/30"
                />
              </div>

              <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10">
                <input
                  type="checkbox"
                  id="prod-featured"
                  checked={featured}
                  onChange={(e) => setFeatured(e.target.checked)}
                  className="w-4 h-4 rounded border-white/20 bg-black/40 text-white focus:ring-0 cursor-pointer"
                />
                <label htmlFor="prod-featured" className="cursor-pointer">
                  <span className="font-semibold text-white block">Als Store-Highlight markieren</span>
                  <span className="text-2xs text-zinc-400 block">
                    Erscheint hervorgehoben auf der Store-Startseite.
                  </span>
                </label>
              </div>
            </div>
          )}

          {/* TAB 2: DIGITAL PRODUCT SPEC */}
          {activeTab === 'digital' && (
            <div className="space-y-5">
              <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-2">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="digital-check"
                    checked={digitalProduct}
                    onChange={(e) => setDigitalProduct(e.target.checked)}
                    className="w-4 h-4 rounded border-white/20 bg-black/40 text-white cursor-pointer"
                  />
                  <label htmlFor="digital-check" className="cursor-pointer">
                    <span className="font-semibold text-white block">Digitales Download-Produkt</span>
                    <span className="text-2xs text-zinc-400 block">
                      Liefert nach Kauf oder Claim automatisch einen serverseitig verifizierten Download-Token aus.
                    </span>
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-2xs font-mono uppercase text-zinc-400">Dateiformat</label>
                  <select
                    value={fileFormat}
                    onChange={(e) => setFileFormat(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-white/10 text-white font-mono focus:outline-none focus:border-white/30"
                  >
                    {FILE_FORMATS.map((f) => (
                      <option key={f} value={f} className="bg-zinc-900 text-white">
                        {f}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-2xs font-mono uppercase text-zinc-400">Dateigröße</label>
                  <input
                    type="text"
                    value={fileSize}
                    onChange={(e) => setFileSize(e.target.value)}
                    placeholder="z.B. 14.2 MB"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 font-mono text-zinc-200 focus:outline-none focus:border-white/30"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-2xs font-mono uppercase text-zinc-400">Version</label>
                  <input
                    type="text"
                    value={version}
                    onChange={(e) => setVersion(e.target.value)}
                    placeholder="v1.0.0"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 font-mono text-zinc-200 focus:outline-none focus:border-white/30"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: PRICING & LICENSE */}
          {activeTab === 'pricing' && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-2xs font-mono uppercase text-zinc-400">
                    Preis in EUR (0 = Kostenlos)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={price}
                      onChange={(e) => setPrice(parseFloat(e.target.value) || 0)}
                      className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white font-mono text-sm focus:outline-none focus:border-white/30"
                    />
                    <DollarSign className="w-4 h-4 text-zinc-500 absolute left-3 top-3" />
                  </div>
                  {price === 0 && (
                    <span className="text-emerald-400 text-2xs font-mono block">
                      ✓ Kostenloses Produkt: Wird mit direktem 1-Klick Claim ausgeliefert.
                    </span>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="text-2xs font-mono uppercase text-zinc-400">Lizenzmodell</label>
                  <select
                    value={license}
                    onChange={(e) => setLicense(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-white/10 text-white focus:outline-none focus:border-white/30"
                  >
                    {LICENSES.map((l) => (
                      <option key={l} value={l} className="bg-zinc-900 text-white">
                        {l}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: MEDIA & LINKS */}
          {activeTab === 'media' && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-2xs font-mono uppercase text-zinc-400">Cover-Bild URL</label>
                <input
                  type="text"
                  value={coverImage}
                  onChange={(e) => setCoverImage(e.target.value)}
                  placeholder="/src/assets/images/banner.jpg"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white font-mono text-xs focus:outline-none focus:border-white/30"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-2xs font-mono uppercase text-zinc-400">Dokumentations-URL</label>
                <input
                  type="url"
                  value={documentationUrl}
                  onChange={(e) => setDocumentationUrl(e.target.value)}
                  placeholder="https://docs.nexus.local/products/template"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white font-mono text-xs focus:outline-none focus:border-white/30"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-2xs font-mono uppercase text-zinc-400">Demo-Datei / Link</label>
                <input
                  type="url"
                  value={demoFileUrl}
                  onChange={(e) => setDemoFileUrl(e.target.value)}
                  placeholder="https://nexus.local/demo-preview"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white font-mono text-xs focus:outline-none focus:border-white/30"
                />
              </div>
            </div>
          )}

          {/* TAB 5: PREVIEW */}
          {activeTab === 'preview' && (
            <div className="space-y-5">
              <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-xs text-zinc-300">
                <span className="font-semibold text-white">Live-Vorschau der Store-Karte</span>
              </div>

              <div className="max-w-md mx-auto p-6 liquid-glass rounded-xl border border-white/15 space-y-4 shadow-xl">
                <div className="flex items-center justify-between text-2xs text-zinc-400">
                  <span>{category}</span>
                  <span className="font-mono text-zinc-200">v{version}</span>
                </div>

                <h3 className="text-lg font-bold text-white">{name || 'Produktname'}</h3>
                <p className="text-xs text-zinc-400 line-clamp-2">
                  {shortDesc || 'Keine Kurzbeschreibung vorhanden.'}
                </p>

                <div className="pt-3 border-t border-white/10 flex items-center justify-between">
                  <span className="text-2xs text-zinc-400 font-mono">{fileFormat} · {fileSize}</span>
                  <span className="font-mono text-base font-bold text-white">
                    {price === 0 ? 'Kostenlos' : `${price.toFixed(2)} €`}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-white/10 bg-white/[0.02] flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-zinc-400 hover:text-white rounded-xl hover:bg-white/5 transition-colors cursor-pointer"
          >
            Abbrechen
          </button>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => handleSave('DRAFT')}
              className="px-4 py-2 glass-2 border border-white/15 text-zinc-200 hover:text-white text-xs font-semibold rounded-xl hover:bg-white/10 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>Als Entwurf speichern</span>
            </button>

            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => handleSave('PUBLISHED')}
              className="px-5 py-2 bg-white text-black font-bold text-xs rounded-xl hover:bg-zinc-200 transition-colors flex items-center gap-1.5 cursor-pointer shadow-lg disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              <span>{initialProduct ? 'Produkt aktualisieren' : 'Im Store veröffentlichen'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
