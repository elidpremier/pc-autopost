'use client';

import { useState } from 'react';
import Link from 'next/link';
import Nav from '@/components/Nav';
import type { Format, StorageType } from '@/lib/types';
import type { AnalyzedRawItem, CropBox } from '../api/batch-raw-images/analyze/route';
import ImageCropModal from '@/components/ImageCropModal';
import BatchActionBar from '@/components/workspace/BatchActionBar';

const TEMPLATE_OPTIONS = [
  { id: 'cyber_luxe_v2', label: 'Cyber Luxe v2', desc: 'Base PSD Ultra-Tech (Recommandé)', badge: 'Cyber', color: 'bg-purple-500' },
  { id: 'promo_banner', label: 'Bannière Promo', desc: 'High Impact Offre & Remise Spéciale', badge: 'Promo', color: 'bg-lime-400' },
];

const COLOR_PRESETS = [
  { name: 'Violet PSD', primary: '#7C3AED', accent: '#CCFF00' },
  { name: 'Bleu Cyber', primary: '#2563EB', accent: '#00F0FF' },
  { name: 'Cyan Tech', primary: '#06B6D4', accent: '#FF0055' },
  { name: 'Vert Émeraude', primary: '#059669', accent: '#FFD700' },
  { name: 'Rouge Impact', primary: '#DC2626', accent: '#FFCC00' },
  { name: 'Ambre Gold', primary: '#D97706', accent: '#00FFFF' },
];

const FORMAT_OPTIONS: { id: Format; label: string; ratio: string }[] = [
  { id: 'square', label: 'Carré (1:1)', ratio: '1080 × 1080' },
  { id: 'portrait', label: 'Portrait (4:5)', ratio: '1080 × 1350' },
  { id: 'story', label: 'Story (9:16)', ratio: '1080 × 1920' },
  { id: 'detail', label: 'Fiche Détaillée', ratio: '1080 × 1080' },
];

type ExecutionResult = {
  summary: { totalProductsCreated: number; totalPostersGenerated: number };
  results: Array<{
    computerId: string;
    brand: string;
    model: string;
    price: number | null;
    currency: string;
    generated: Array<{ id: string; format: Format; filename: string; url: string; downloadUrl: string }>;
  }>;
};

export default function BatchImportPage() {
  const [items, setItems] = useState<AnalyzedRawItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [cropModalItem, setCropModalItem] = useState<AnalyzedRawItem | null>(null);

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [aiConfigured, setAiConfigured] = useState<boolean | null>(null);

  const [templateId, setTemplateId] = useState('cyber_luxe_v2');
  const [colorPrimary, setColorPrimary] = useState('#7C3AED');
  const [colorAccent, setColorAccent] = useState('#CCFF00');
  const [formats, setFormats] = useState<Format[]>(['square', 'portrait', 'story', 'detail']);
  const [executionResult, setExecutionResult] = useState<ExecutionResult | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [isCuttingOut, setIsCuttingOut] = useState(false);
  const [cutoutModel, setCutoutModel] = useState<'birefnet-general-lite' | 'birefnet-general'>('birefnet-general-lite');
  const [cutoutProgress, setCutoutProgress] = useState('');

  // Traitement d'analyse lors de la sélection de fichiers
  async function handleFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsAnalyzing(true);
    setErrorMsg('');
    setExecutionResult(null);

    try {
      const fd = new FormData();
      for (let i = 0; i < files.length; i++) {
        fd.append('files', files[i]);
      }

      const res = await fetch('/api/batch-raw-images/analyze', {
        method: 'POST',
        body: fd,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur lors de l’analyse des photos');

      const newItems: AnalyzedRawItem[] = data.items || [];
      setItems((prev) => {
        const updated = [...prev, ...newItems];
        if (!activeItemId && updated.length > 0) {
          setActiveItemId(updated[0].id);
        }
        return updated;
      });

      if (typeof data.aiConfigured === 'boolean') {
        setAiConfigured(data.aiConfigured);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erreur lors de l’analyse des fichiers');
    } finally {
      setIsAnalyzing(false);
      e.target.value = '';
    }
  }

  // Ré-analyse d'un item individuel avec recadrage
  async function handleReanalyzeItem(item: AnalyzedRawItem, newCrop?: CropBox | null) {
    setIsAnalyzing(true);
    try {
      const fd = new FormData();
      fd.append('existingFilename', item.filename);
      if (newCrop) {
        fd.append('cropBox', JSON.stringify(newCrop));
      }

      const res = await fetch('/api/batch-raw-images/analyze', {
        method: 'POST',
        body: fd,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur lors du recadrage');

      if (data.items && data.items.length > 0) {
        const updatedItem: AnalyzedRawItem = data.items[0];
        setItems((prev) =>
          prev.map((i) =>
            i.id === item.id
              ? {
                  ...updatedItem,
                  id: item.id, // conserve le même id unique local
                  price_amount: item.price_amount || updatedItem.price_amount, // conserve le prix déjà saisi
                }
              : i
          )
        );
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erreur ré-analyse');
    } finally {
      setIsAnalyzing(false);
    }
  }

  function updateItem(id: string, patch: Partial<AnalyzedRawItem>) {
    setItems((list) => list.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  function removeItem(id: string) {
    setItems((list) => list.filter((item) => item.id !== id));
    setSelectedIds((prev) => prev.filter((i) => i !== id));
    if (activeItemId === id) {
      const remaining = items.filter((i) => i.id !== id);
      setActiveItemId(remaining.length > 0 ? remaining[0].id : null);
    }
  }

  function handleToggleSelect(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  }

  function handleSelectAll() {
    setSelectedIds(items.map((i) => i.id));
  }

  function handleDeselectAll() {
    setSelectedIds([]);
  }

  function handleDeleteSelected() {
    if (!selectedIds.length) return;
    setItems((prev) => prev.filter((i) => !selectedIds.includes(i.id)));
    if (activeItemId && selectedIds.includes(activeItemId)) {
      const remaining = items.filter((i) => !selectedIds.includes(i.id));
      setActiveItemId(remaining.length > 0 ? remaining[0].id : null);
    }
    setSelectedIds([]);
  }

  async function handleBatchCutout() {
    const targets = selectedIds.length ? items.filter((item) => selectedIds.includes(item.id)) : items;
    if (!targets.length) return;
    setIsCuttingOut(true);
    setErrorMsg('');
    setCutoutProgress(`Détourage de ${targets.length} photo(s) en cours…`);
    try {
      const res = await fetch('/api/batch-raw-images/cutout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: cutoutModel, items: targets.map(({ id, filename }) => ({ id, filename })) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur lors du détourage par lot');
      const successful = new Map<string, string>(
        data.results
          .filter((result: { cutoutFilename?: string }) => result.cutoutFilename)
          .map((result: { id: string; cutoutFilename: string }) => [result.id, result.cutoutFilename])
      );
      setItems((current) => current.map((item) => successful.has(item.id)
        ? { ...item, cutoutFilename: successful.get(item.id) }
        : item));
      const failures = data.results.filter((result: { error?: string }) => result.error);
      setCutoutProgress(`Détourage terminé : ${successful.size}/${targets.length} réussi(s).`);
      if (failures.length) setErrorMsg(`${failures.length} photo(s) n'ont pas pu être détourées.`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erreur lors du détourage par lot');
      setCutoutProgress('');
    } finally {
      setIsCuttingOut(false);
    }
  }

  function toggleFormat(f: Format) {
    if (formats.includes(f)) {
      if (formats.length === 1) return;
      setFormats(formats.filter((item) => item !== f));
    } else {
      setFormats([...formats, f]);
    }
  }

  async function handleExecuteBatch() {
    if (!items.length) return;
    setIsExecuting(true);
    setErrorMsg('');

    try {
      const res = await fetch('/api/batch-raw-images/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: items.map((i) => ({
            filename: i.filename,
            width: i.width,
            height: i.height,
            brand: i.brand,
            model: i.model,
            processor: i.processor,
            ram_gb: i.ram_gb,
            storage_capacity_gb: i.storage_capacity_gb,
            storage_type: i.storage_type,
            screen_size: i.screen_size,
            screen_resolution: i.screen_resolution,
            graphics: i.graphics,
            price_amount: i.price_amount,
            currency: i.currency,
            condition: i.condition,
            rawText: i.rawText,
            cutoutFilename: i.cutoutFilename,
          })),
          formats,
          templateId,
          colorPrimary,
          colorAccent,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur lors de la génération par lot');

      setExecutionResult(data);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erreur lors de l’exécution par lot');
    } finally {
      setIsExecuting(false);
    }
  }

  function handleDownloadAll() {
    if (!executionResult) return;
    const allLinks: { url: string; filename: string }[] = [];
    executionResult.results.forEach((r) => {
      r.generated.forEach((g) => {
        allLinks.push({ url: g.downloadUrl, filename: g.filename });
      });
    });

    allLinks.forEach((link, idx) => {
      setTimeout(() => {
        const a = document.createElement('a');
        a.href = link.url;
        a.download = link.filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }, idx * 250);
    });
  }

  const activeItem = items.find((i) => i.id === activeItemId) || items[0] || null;
  const pricedCount = items.filter((i) => typeof i.price_amount === 'number' && i.price_amount > 0).length;
  const readyCount = items.filter((i) => i.brand && i.model && i.price_amount).length;

  return (
    <main className="min-h-screen pb-24 bg-slate-950 text-slate-100">
      <Nav />

      {/* TopBar App SaaS Header */}
      <header className="sticky top-0 z-30 border-b border-slate-800 bg-slate-950/90 backdrop-blur-xl px-4 sm:px-8 py-3.5 shadow-xl">
        <div className="mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4 max-w-7xl">
          
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-lime-400 to-emerald-500 text-slate-950 font-black shadow-lg shadow-lime-500/20">
              ⚡
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-extrabold text-white">
                  Studio d&apos;Importation & Traitement par Lot
                </h1>
                {aiConfigured !== null && (
                  <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-black border ${
                    aiConfigured
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                      : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                  }`}>
                    {aiConfigured ? '🟢 IA Groq Active' : '🟡 Mode Parseur Local'}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">
                Importation multi-photos • Recadrage zone OCR • Saisie rapide des prix
              </p>
            </div>
          </div>

          {/* Compteurs & Action Héro */}
          <div className="flex items-center gap-4">
            {items.length > 0 && (
              <div className="hidden sm:flex items-center gap-3 rounded-2xl bg-slate-900 border border-slate-800 px-4 py-2 text-xs font-bold">
                <span>📦 <strong className="text-white">{items.length}</strong> photo(s)</span>
                <span className="text-slate-700">|</span>
                <span>⚡ <strong className="text-lime-400">{readyCount}</strong> prête(s)</span>
                <span className="text-slate-700">|</span>
                <span>💰 <strong className={pricedCount === items.length ? 'text-lime-400' : 'text-amber-400'}>{pricedCount}/{items.length}</strong> prix</span>
              </div>
            )}

            <Link href="/" className="btn-ghost text-xs text-slate-400 hover:text-white">
              ← Stock
            </Link>

            {items.length > 0 && !executionResult && (
              <div className="flex flex-wrap items-center justify-end gap-2">
                <select
                  value={cutoutModel}
                  onChange={(e) => setCutoutModel(e.target.value as 'birefnet-general-lite' | 'birefnet-general')}
                  disabled={isCuttingOut || isExecuting}
                  className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-2 text-xs text-slate-200"
                  aria-label="Modèle de détourage par lot"
                >
                  <option value="birefnet-general-lite">Détourage Lite</option>
                  <option value="birefnet-general">Détourage General</option>
                </select>
                <button
                  type="button"
                  onClick={handleBatchCutout}
                  disabled={isCuttingOut || isExecuting}
                  className="btn-secondary text-xs px-3 py-2 disabled:opacity-50"
                >
                  {isCuttingOut ? '✂️ Détourage…' : `✂️ Détourer ${selectedIds.length ? 'la sélection' : 'le lot'}`}
                </button>
                <button
                  type="button"
                  onClick={handleExecuteBatch}
                  disabled={isExecuting || isCuttingOut || items.some((i) => !i.price_amount)}
                  className="btn-primary bg-gradient-to-r from-lime-400 to-emerald-400 text-slate-950 font-black text-xs px-5 py-2.5 shadow-lg shadow-lime-400/20 hover:scale-105 transition disabled:opacity-50"
                >
                  {isExecuting ? (
                    <span className="flex items-center gap-2">
                      <span className="animate-spin">⏳</span> Génération du lot...
                    </span>
                  ) : (
                    `🚀 Générer ${items.length * formats.length} Affiches (1-Clic)`
                  )}
                </button>
              </div>
            )}
          </div>

        </div>
      </header>

      {/* Contenu Principal - Workspace Unifié à 3 Colonnes/Pannes */}
      <div className="mx-auto max-w-7xl px-4 sm:px-8 py-6 space-y-6">

        {errorMsg && (
          <div className="rounded-2xl bg-rose-500/10 p-4 text-xs font-extrabold text-rose-400 border border-rose-500/20 flex items-center justify-between">
            <span>⚠️ {errorMsg}</span>
            <button onClick={() => setErrorMsg('')} className="text-rose-400 hover:underline">Masquer</button>
          </div>
        )}
        {cutoutProgress && !errorMsg && (
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-xs font-bold text-emerald-300">
            {cutoutProgress}
          </div>
        )}

        {/* Écran de Résultats de Génération Finales */}
        {executionResult ? (
          <div className="space-y-6">
            <div className="rounded-3xl bg-gradient-to-r from-emerald-600 to-teal-700 p-6 text-white shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="text-2xl font-black">
                  🎉 {executionResult.summary.totalPostersGenerated} affiches générées avec succès !
                </div>
                <p className="mt-1 text-xs text-emerald-100">
                  {executionResult.summary.totalProductsCreated} ordinateurs ajoutés à votre stock avec affiches HD prêtes à être publiées.
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleDownloadAll}
                  className="btn-primary bg-white text-emerald-950 hover:bg-slate-100 font-black shadow-lg text-xs px-5 py-3"
                >
                  📥 Tout Télécharger ({executionResult.summary.totalPostersGenerated})
                </button>
                <Link href="/" className="btn-secondary bg-emerald-950/40 border-emerald-500/30 text-white hover:bg-emerald-900/60 text-xs px-4 py-3">
                  Voir dans mon stock ➔
                </Link>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6">
              {executionResult.results.map((r) => (
                <div
                  key={r.computerId}
                  className="rounded-3xl border border-slate-800 bg-slate-900 p-5 space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-extrabold text-white">
                        💻 {r.brand} {r.model}
                      </h3>
                      <span className="text-xs font-bold text-lime-400">
                        {r.price ? `${new Intl.NumberFormat('fr-FR').format(r.price)} ${r.currency}` : 'Prix non renseigné'}
                      </span>
                    </div>
                    <Link
                      href={`/computers/${r.computerId}`}
                      className="text-xs font-bold text-slate-400 hover:text-white"
                    >
                      Ouvrir la fiche ➔
                    </Link>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {r.generated.map((g) => (
                      <div
                        key={g.id}
                        className="group relative overflow-hidden rounded-2xl border border-slate-800 bg-black aspect-square flex items-center justify-center"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={g.url}
                          alt={g.format}
                          className="h-full w-full object-cover transition group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition flex flex-col justify-end p-2.5">
                          <span className="text-[10px] font-black text-lime-400 uppercase tracking-wide">
                            {g.format}
                          </span>
                          <a
                            href={g.downloadUrl}
                            download={g.filename}
                            className="mt-1.5 rounded-lg bg-white/20 hover:bg-white/30 backdrop-blur py-1.5 text-center text-xs font-bold text-white transition"
                          >
                            ⬇ Télécharger
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* WORKSPACE APPLICATIF DINAMIQUE */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

            {/* COLONNE GAUCHE (7/12) : Galerie & Workspace d'images */}
            <div className="lg:col-span-7 space-y-5">
              
              {/* Dropzone d'importation multi-fichiers */}
              <div className="relative rounded-3xl border-2 border-dashed border-slate-800 bg-slate-900/60 p-6 text-center transition hover:border-lime-400/50 hover:bg-slate-900">
                <input
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleFilesSelected}
                  className="absolute inset-0 z-10 opacity-0 cursor-pointer"
                />
                <div className="flex flex-col items-center justify-center">
                  <span className="text-3xl">📸</span>
                  <h3 className="mt-2 text-sm font-extrabold text-white">
                    Glissez-déposez ou cliquez pour ajouter des photos d&apos;ordinateurs
                  </h3>
                  <p className="mt-1 text-xs text-slate-400 max-w-sm">
                    Ajoutez plusieurs photos d&apos;un coup (ex: 5, 10, 20 photos). L&apos;OCR lit les fiches automatiquement !
                  </p>
                </div>

                {isAnalyzing && (
                  <div className="mt-3 flex items-center justify-center gap-2 text-xs font-bold text-lime-400 animate-pulse">
                    <span className="animate-spin">⏳</span> Analyse OCR & Extraction des fiches par l&apos;IA...
                  </div>
                )}
              </div>

              {/* Galerie des Photos Brutes & Cartes d'Analyse */}
              {items.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-xs font-black uppercase tracking-wider text-slate-400">
                      Galerie Media ({items.length} photo{items.length > 1 ? 's' : ''})
                    </span>
                    <button
                      type="button"
                      onClick={handleSelectAll}
                      className="text-xs text-lime-400 hover:underline font-bold"
                    >
                      {selectedIds.length === items.length ? 'Décocher tout' : 'Tout cocher'}
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {items.map((item) => {
                      const isSelected = selectedIds.includes(item.id);
                      const isActive = activeItem?.id === item.id;
                      const hasPrice = typeof item.price_amount === 'number' && item.price_amount > 0;

                      return (
                        <div
                          key={item.id}
                          onClick={() => setActiveItemId(item.id)}
                          className={`group relative flex flex-col justify-between overflow-hidden rounded-2xl border p-3 cursor-pointer transition-all ${
                            isActive
                              ? 'border-lime-400 bg-slate-900 ring-2 ring-lime-400/20 shadow-xl'
                              : isSelected
                              ? 'border-blue-500 bg-blue-950/20'
                              : 'border-slate-800 bg-slate-900/60 hover:border-slate-700 hover:bg-slate-900'
                          }`}
                        >
                          {/* Top Bar de la carte : Checkbox & Badges */}
                          <div className="flex items-center justify-between mb-2">
                            <label
                              onClick={(e) => e.stopPropagation()}
                              className="flex items-center gap-2 cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => handleToggleSelect(item.id)}
                                className="h-4 w-4 rounded border-slate-700 bg-slate-800 text-lime-400 focus:ring-lime-400"
                              />
                              <span className="text-[10px] font-mono text-slate-400">
                                #{items.indexOf(item) + 1}
                              </span>
                            </label>

                            <div className="flex items-center gap-1.5">
                              {item.cropBox && (
                                <span className="rounded bg-lime-400/10 px-1.5 py-0.5 text-[9px] font-black text-lime-400 border border-lime-400/30">
                                  ✂️ Recadré
                                </span>
                              )}
                              {item.usedAi ? (
                                <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-black text-emerald-400 border border-emerald-500/30">
                                  🤖 IA
                                </span>
                              ) : (
                                <span className="rounded bg-blue-500/10 px-1.5 py-0.5 text-[9px] font-bold text-blue-400 border border-blue-500/30">
                                  ⚡ Local
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeItem(item.id);
                                }}
                                className="rounded-full p-1 text-slate-500 hover:bg-rose-500/20 hover:text-rose-400 transition"
                                title="Supprimer"
                              >
                                ✕
                              </button>
                            </div>
                          </div>

                          {/* Aperçu Photo & Fiche Rapide */}
                          <div className="flex gap-3 items-center">
                            <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-black border border-slate-800">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={item.previewUrl}
                                alt="Aperçu PC"
                                className="h-full w-full object-cover"
                              />
                            </div>
                            <div className="flex-1 min-w-0 space-y-1">
                              <h4 className="text-xs font-black text-white truncate">
                                {item.brand || item.model ? `${item.brand} ${item.model}` : 'PC Non Identifié'}
                              </h4>
                              <p className="text-[10px] text-slate-400 truncate">
                                {item.processor || 'Processeur non détecté'}
                              </p>
                              <div className="flex items-center gap-2 pt-0.5">
                                {hasPrice ? (
                                  <span className="text-xs font-black text-lime-400">
                                    {new Intl.NumberFormat('fr-FR').format(item.price_amount!)} {item.currency}
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-extrabold text-amber-400">
                                    ⚠️ Prix manquant
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Action de Recadrage Zone OCR sur la Carte */}
                          <div className="mt-3 flex items-center justify-between border-t border-slate-800/80 pt-2 text-[11px]">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setCropModalItem(item);
                              }}
                              className="flex items-center gap-1 text-[11px] font-bold text-lime-400 hover:underline"
                            >
                              ✂️ Recadrer Zone OCR
                            </button>

                            <span className="text-[10px] text-slate-500">
                              {isActive ? '🔍 En cours d\'inspection' : 'Cliquer pour éditer'}
                            </span>
                          </div>

                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

            </div>

            {/* COLONNE DROITE (5/12) : Inspecteur Réactif & Aperçu Affiche HD Direct */}
            <div className="lg:col-span-5 space-y-5">
              
              {activeItem ? (
                <div className="sticky top-20 rounded-3xl border border-slate-800 bg-slate-900 p-5 space-y-5 shadow-2xl">
                  
                  {/* Title Inspecteur & Sélecteur d'Onglets d'Édition */}
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-lime-400/20 text-xs font-black text-lime-400">
                        ✏️
                      </span>
                      <h3 className="text-sm font-extrabold text-white">
                        Inspecteur : {activeItem.brand} {activeItem.model}
                      </h3>
                    </div>
                    <span className="text-[10px] font-mono text-slate-500">
                      ID: {activeItem.id.slice(0, 10)}
                    </span>
                  </div>

                  {/* champ Prix de Vente Héro */}
                  <div className="rounded-2xl bg-lime-400/10 p-3.5 border border-lime-400/30 flex items-center justify-between gap-3">
                    <div>
                      <label className="block text-xs font-black uppercase tracking-wider text-lime-400">
                        💰 Prix de Vente ({activeItem.currency}) *
                      </label>
                      <p className="text-[10px] text-slate-400">
                        Renseignez le prix pour valider cette affiche.
                      </p>
                    </div>
                    <div className="w-36">
                      <input
                        type="number"
                        value={activeItem.price_amount ?? ''}
                        onChange={(e) =>
                          updateItem(activeItem.id, {
                            price_amount: e.target.value ? parseInt(e.target.value) : null,
                          })
                        }
                        placeholder="ex: 245000"
                        className="w-full rounded-xl border border-lime-400 bg-slate-950 px-3 py-2 text-sm font-black text-lime-400 focus:outline-none focus:ring-2 focus:ring-lime-400"
                      />
                    </div>
                  </div>

                  {/* Champs de Spécifications */}
                  <div className="space-y-3">
                    <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                      Caractéristiques extraites par l&apos;OCR / IA
                    </label>

                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[9px] font-extrabold text-slate-400 mb-0.5">Marque</label>
                        <input
                          type="text"
                          value={activeItem.brand}
                          onChange={(e) => updateItem(activeItem.id, { brand: e.target.value })}
                          className="w-full rounded-xl border border-slate-800 bg-slate-950 px-2.5 py-1.5 text-xs font-bold text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-extrabold text-slate-400 mb-0.5">Modèle</label>
                        <input
                          type="text"
                          value={activeItem.model}
                          onChange={(e) => updateItem(activeItem.id, { model: e.target.value })}
                          className="w-full rounded-xl border border-slate-800 bg-slate-950 px-2.5 py-1.5 text-xs font-bold text-white"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[9px] font-extrabold text-slate-400 mb-0.5">Processeur</label>
                        <input
                          type="text"
                          value={activeItem.processor}
                          onChange={(e) => updateItem(activeItem.id, { processor: e.target.value })}
                          className="w-full rounded-xl border border-slate-800 bg-slate-950 px-2.5 py-1.5 text-xs font-semibold text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-extrabold text-slate-400 mb-0.5">RAM (Go)</label>
                        <input
                          type="number"
                          value={activeItem.ram_gb ?? ''}
                          onChange={(e) => updateItem(activeItem.id, { ram_gb: e.target.value ? parseInt(e.target.value) : null })}
                          className="w-full rounded-xl border border-slate-800 bg-slate-950 px-2.5 py-1.5 text-xs font-semibold text-white"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[9px] font-extrabold text-slate-400 mb-0.5">Stockage (Go)</label>
                        <div className="flex gap-1">
                          <input
                            type="number"
                            value={activeItem.storage_capacity_gb ?? ''}
                            onChange={(e) => updateItem(activeItem.id, { storage_capacity_gb: e.target.value ? parseInt(e.target.value) : null })}
                            className="w-full rounded-xl border border-slate-800 bg-slate-950 px-2.5 py-1.5 text-xs font-semibold text-white"
                          />
                          <select
                            value={activeItem.storage_type || 'SSD'}
                            onChange={(e) => updateItem(activeItem.id, { storage_type: e.target.value as StorageType })}
                            className="rounded-xl border border-slate-800 bg-slate-950 px-1.5 text-xs text-white"
                          >
                            <option value="SSD">SSD</option>
                            <option value="NVMe">NVMe</option>
                            <option value="HDD">HDD</option>
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="block text-[9px] font-extrabold text-slate-400 mb-0.5">Carte Graphique</label>
                        <input
                          type="text"
                          value={activeItem.graphics}
                          onChange={(e) => updateItem(activeItem.id, { graphics: e.target.value })}
                          className="w-full rounded-xl border border-slate-800 bg-slate-950 px-2.5 py-1.5 text-xs font-semibold text-white"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Choix du Style & Thème Couleur de l'Affiche */}
                  <div className="space-y-3 pt-2 border-t border-slate-800">
                    <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                      Style Visuel & Thème Couleur du Lot
                    </label>

                    {/* Modèles */}
                    <div className="grid grid-cols-2 gap-2">
                      {TEMPLATE_OPTIONS.map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setTemplateId(t.id)}
                          className={`rounded-xl border p-2.5 text-left transition ${
                            templateId === t.id
                              ? 'border-lime-400 bg-lime-400/10 text-white'
                              : 'border-slate-800 bg-slate-950 text-slate-400 hover:text-white'
                          }`}
                        >
                          <div className="flex items-center justify-between text-xs font-bold">
                            <span>{t.label}</span>
                            <span className={`h-2 w-2 rounded-full ${t.color}`} />
                          </div>
                        </button>
                      ))}
                    </div>

                    {/* Presets de couleurs */}
                    <div className="flex flex-wrap gap-1.5">
                      {COLOR_PRESETS.map((p) => {
                        const isSelected = colorPrimary.toUpperCase() === p.primary.toUpperCase() && colorAccent.toUpperCase() === p.accent.toUpperCase();
                        return (
                          <button
                            key={p.name}
                            type="button"
                            onClick={() => {
                              setColorPrimary(p.primary);
                              setColorAccent(p.accent);
                            }}
                            className={`flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[10px] font-bold transition ${
                              isSelected
                                ? 'border-lime-400 bg-lime-400/20 text-lime-300'
                                : 'border-slate-800 bg-slate-950 text-slate-400 hover:text-white'
                            }`}
                          >
                            <div className="flex h-2.5 w-5 items-center overflow-hidden rounded-sm border border-black/40">
                              <span className="h-full w-1/2" style={{ backgroundColor: p.primary }} />
                              <span className="h-full w-1/2" style={{ backgroundColor: p.accent }} />
                            </div>
                            {p.name.split(' ')[0]}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Formats à Générer */}
                  <div className="space-y-2 pt-2 border-t border-slate-800">
                    <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                      Formats à Exporter
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {FORMAT_OPTIONS.map((f) => {
                        const active = formats.includes(f.id);
                        return (
                          <button
                            key={f.id}
                            type="button"
                            onClick={() => toggleFormat(f.id)}
                            className={`flex items-center gap-2 rounded-xl border p-2 text-left transition ${
                              active
                                ? 'border-blue-500 bg-blue-500/10 font-bold text-white'
                                : 'border-slate-800 bg-slate-950 text-slate-500'
                            }`}
                          >
                            <span className="text-xs">{active ? '✓' : '🔲'}</span>
                            <span className="text-[11px]">{f.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                </div>
              ) : (
                <div className="rounded-3xl border border-slate-800 bg-slate-900/40 p-8 text-center text-slate-500 space-y-2">
                  <span className="text-3xl">👈</span>
                  <h4 className="text-sm font-bold text-slate-400">Aucune photo sélectionnée</h4>
                  <p className="text-xs">Ajoutez des photos pour ouvrir l&apos;inspecteur réactif.</p>
                </div>
              )}

            </div>

          </div>
        )}

      </div>

      {/* Barre d'Actions Flottante pour les Sélections Multiples */}
      <BatchActionBar
        selectedCount={selectedIds.length}
        totalCount={items.length}
        onSelectAll={handleSelectAll}
        onDeselectAll={handleDeselectAll}
        onDeleteSelected={handleDeleteSelected}
        onCropSelected={() => {
          if (selectedIds.length === 1) {
            const found = items.find((i) => i.id === selectedIds[0]);
            if (found) setCropModalItem(found);
          }
        }}
        onReanalyzeSelected={() => {
          selectedIds.forEach((id) => {
            const found = items.find((i) => i.id === id);
            if (found) handleReanalyzeItem(found, found.cropBox);
          });
        }}
      />

      {/* Modale de Recadrage Interactif Zone OCR */}
      {cropModalItem && (
        <ImageCropModal
          isOpen={!!cropModalItem}
          onClose={() => setCropModalItem(null)}
          imageUrl={cropModalItem.previewUrl}
          imageName={cropModalItem.filename}
          initialCrop={cropModalItem.cropBox}
          onSaveCrop={(crop) => {
            if (cropModalItem) {
              updateItem(cropModalItem.id, { cropBox: crop });
              handleReanalyzeItem(cropModalItem, crop);
            }
          }}
        />
      )}
    </main>
  );
}
