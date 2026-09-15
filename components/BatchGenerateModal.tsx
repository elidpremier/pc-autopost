'use client';

import { useState, useEffect } from 'react';
import type { Format } from '@/lib/types';
import type { BatchComputerResult } from '@/app/api/computers/batch-generate/route';

type SelectedItem = {
  id: string;
  brand: string;
  model: string;
  price_amount: number | null;
  currency: string;
  status: string;
  imageCount: number;
  missingFields: string[];
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  selectedComputers: SelectedItem[];
  onComplete?: () => void;
};

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

const FORMAT_OPTIONS: { id: Format; label: string; ratio: string; desc: string }[] = [
  { id: 'square', label: 'Carré (1:1)', ratio: '1080 × 1080', desc: 'Feed Instagram, Facebook & WhatsApp' },
  { id: 'portrait', label: 'Portrait (4:5)', ratio: '1080 × 1350', desc: 'Format mobile haute visibilité' },
  { id: 'story', label: 'Story (9:16)', ratio: '1080 × 1920', desc: 'Statuts WhatsApp & Instagram Stories' },
  { id: 'detail', label: 'Fiche Détaillée', ratio: '1080 × 1080', desc: 'Carrousel 2e image specs complètes' },
];

export default function BatchGenerateModal({ isOpen, onClose, selectedComputers, onComplete }: Props) {
  const [templateId, setTemplateId] = useState('cyber_luxe_v2');
  const [colorPrimary, setColorPrimary] = useState('#7C3AED');
  const [colorAccent, setColorAccent] = useState('#CCFF00');
  const [formats, setFormats] = useState<Format[]>(['square', 'portrait', 'story', 'detail']);
  const [isGenerating, setIsGenerating] = useState(false);
  const [results, setResults] = useState<BatchComputerResult[] | null>(null);
  const [summary, setSummary] = useState<{
    totalRequested: number;
    successfulComputers: number;
    skippedComputers: number;
    totalGeneratedPosters: number;
  } | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  // Raccourci Échap pour fermer la modale
  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const readyCount = selectedComputers.filter((c) => c.missingFields.length === 0 && c.imageCount > 0).length;
  const totalPostersToGenerate = readyCount * formats.length;

  function toggleFormat(f: Format) {
    if (formats.includes(f)) {
      if (formats.length === 1) return; // Garder au moins 1 format
      setFormats(formats.filter((item) => item !== f));
    } else {
      setFormats([...formats, f]);
    }
  }

  function handleStartBatch() {
    setIsGenerating(true);
    setErrorMsg('');
    setResults(null);

    const readyComputers = selectedComputers.filter(
      (c) => c.missingFields.length === 0 && c.imageCount > 0
    );

    const colorQuery = `&colorPrimary=${encodeURIComponent(colorPrimary)}&colorAccent=${encodeURIComponent(colorAccent)}`;

    const batchResults = readyComputers.map((c) => {
      const generated = formats.map((f) => ({
        id: `dyn-${c.id}-${f}`,
        format: f,
        filename: `poster_${(c.brand || 'pc').toLowerCase()}_${(c.model || '').toLowerCase()}_${f}.jpg`,
        url: `/api/computers/${c.id}/preview?format=${f}&template=${templateId}${colorQuery}`,
        downloadUrl: `/api/computers/${c.id}/preview?format=${f}&template=${templateId}${colorQuery}&download=1`,
      }));

      return {
        computerId: c.id,
        brand: c.brand,
        model: c.model,
        status: 'success' as const,
        generated,
      };
    });

    const totalPosters = readyComputers.length * formats.length;

    setSummary({
      totalRequested: selectedComputers.length,
      successfulComputers: readyComputers.length,
      skippedComputers: selectedComputers.length - readyComputers.length,
      totalGeneratedPosters: totalPosters,
    });

    setResults(batchResults);
    setIsGenerating(false);
    if (onComplete) onComplete();
  }

  function handleDownloadAll() {
    if (!results) return;
    const allLinks: { url: string; filename: string }[] = [];
    results.forEach((r) => {
      r.generated.forEach((g) => {
        allLinks.push({ url: g.downloadUrl, filename: g.filename });
      });
    });

    // Déclenche le téléchargement progressif de toutes les images
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-3 sm:p-6 backdrop-blur-md animate-fade-in">
      <div className="flex h-full max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
        
        {/* Header Modal */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-lime-400/20 text-2xl text-lime-600 dark:text-lime-400">
              ⚡
            </span>
            <div>
              <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">
                Génération d&apos;Affiches par Lot
              </h3>
              <p className="text-xs text-slate-500">
                Générez instantanément des visuels professionnels pour plusieurs produits en 1 clic.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isGenerating}
            className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-white transition disabled:opacity-50"
          >
            ✕
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {errorMsg && (
            <div className="rounded-2xl bg-rose-500/10 p-4 text-sm font-semibold text-rose-600 border border-rose-500/20">
              ⚠️ {errorMsg}
            </div>
          )}

          {/* Affichage des Résultats après génération */}
          {results && summary ? (
            <div className="space-y-6">
              <div className="rounded-2xl bg-emerald-500/10 p-5 border border-emerald-500/20 text-center sm:text-left sm:flex sm:items-center sm:justify-between gap-4">
                <div>
                  <div className="text-xl font-black text-emerald-600 dark:text-emerald-400">
                    🎉 {summary.totalGeneratedPosters} visuels générés avec succès !
                  </div>
                  <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                    {summary.successfulComputers} produits sur {summary.totalRequested} ont été traités sans erreur.
                  </p>
                </div>
                <button
                  onClick={handleDownloadAll}
                  className="mt-3 sm:mt-0 btn-primary bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/20"
                >
                  📥 Tout Télécharger ({summary.totalGeneratedPosters})
                </button>
              </div>

              {/* Détails par produit */}
              <div className="space-y-4">
                <h4 className="text-sm font-bold uppercase tracking-wider text-slate-400">
                  Résultats par Produit
                </h4>
                {results.map((r) => (
                  <div
                    key={r.computerId}
                    className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-4 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 dark:text-white">
                          💻 {r.brand} {r.model}
                        </span>
                        {r.status === 'success' ? (
                          <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                            ✓ {r.generated.length} visuels prêts
                          </span>
                        ) : (
                          <span className="rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-600 dark:text-amber-400 border border-amber-500/20">
                            ⚠️ Ignoré ({r.reason})
                          </span>
                        )}
                      </div>
                    </div>

                    {r.generated.length > 0 && (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                        {r.generated.map((g) => (
                          <div
                            key={g.id}
                            className="group relative overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-black aspect-square flex items-center justify-center"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={g.url}
                              alt={g.format}
                              className="h-full w-full object-cover transition group-hover:scale-105"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition flex flex-col justify-end p-2">
                              <span className="text-[10px] font-bold text-lime-400 uppercase tracking-wide">
                                {g.format}
                              </span>
                              <a
                                href={g.downloadUrl}
                                download={g.filename}
                                className="mt-1 rounded bg-white/20 hover:bg-white/30 backdrop-blur py-1 text-center text-xs font-bold text-white transition"
                              >
                                ⬇ Télécharger
                              </a>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* Mode Configuration & Lancement */
            <div className="space-y-6">

              {/* Résumé de la sélection */}
              <div className="rounded-2xl bg-blue-500/10 p-4 border border-blue-500/20 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <span className="text-sm font-bold text-blue-900 dark:text-blue-300">
                    Produits sélectionnés : {selectedComputers.length}
                  </span>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {readyCount} prêt(s) pour génération immédiate • {selectedComputers.length - readyCount} fiche(s) incomplète(s)
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-lg font-black text-lime-500">
                    {totalPostersToGenerate} visuels
                  </span>
                  <span className="block text-[10px] text-slate-400 uppercase">
                    Total estimé
                  </span>
                </div>
              </div>

              {/* Choix du Template */}
              <div className="space-y-3">
                <label className="block text-sm font-bold uppercase tracking-wider text-slate-400">
                  1. Choisir le Style Visuel & Thème Couleur
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {TEMPLATE_OPTIONS.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setTemplateId(t.id)}
                      className={`flex flex-col justify-between rounded-2xl p-4 text-left transition border ${
                        templateId === t.id
                          ? 'border-lime-400 bg-lime-400/10 ring-2 ring-lime-400/30'
                          : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900 dark:text-white text-sm">
                          {t.label}
                        </span>
                        <span className={`h-2.5 w-2.5 rounded-full ${t.color}`} />
                      </div>
                      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                        {t.desc}
                      </p>
                    </button>
                  ))}
                </div>

                {/* Personnalisation des Couleurs du Lot */}
                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-950/50 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-500">🎨 Thème Couleur pour ce lot :</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={colorPrimary}
                        onChange={(e) => setColorPrimary(e.target.value)}
                        className="h-6 w-8 cursor-pointer rounded border-0 p-0"
                        title="Couleur Principale"
                      />
                      <input
                        type="color"
                        value={colorAccent}
                        onChange={(e) => setColorAccent(e.target.value)}
                        className="h-6 w-8 cursor-pointer rounded border-0 p-0"
                        title="Couleur Accent"
                      />
                    </div>
                  </div>
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
                          className={`flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[11px] font-bold transition ${
                            isSelected
                              ? 'border-blue-600 bg-blue-600 text-white shadow-sm'
                              : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'
                          }`}
                        >
                          <div className="flex h-2.5 w-5 items-center overflow-hidden rounded-sm border border-black/20">
                            <span className="h-full w-1/2" style={{ backgroundColor: p.primary }} />
                            <span className="h-full w-1/2" style={{ backgroundColor: p.accent }} />
                          </div>
                          {p.name.split(' ')[0]}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Choix des Formats */}
              <div>
                <label className="block text-sm font-bold uppercase tracking-wider text-slate-400 mb-3">
                  2. Sélectionner les Formats à Générer
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {FORMAT_OPTIONS.map((f) => {
                    const active = formats.includes(f.id);
                    return (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => toggleFormat(f.id)}
                        className={`flex items-center gap-3 rounded-2xl p-3 text-left transition border ${
                          active
                            ? 'border-blue-500 bg-blue-500/10 ring-2 ring-blue-500/30'
                            : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 opacity-60 hover:opacity-100'
                        }`}
                      >
                        <div
                          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border text-xs font-bold ${
                            active
                              ? 'border-blue-500 bg-blue-500 text-white'
                              : 'border-slate-300 dark:border-slate-700'
                          }`}
                        >
                          {active ? '✓' : ''}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-slate-900 dark:text-white">
                              {f.label}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              ({f.ratio})
                            </span>
                          </div>
                          <p className="text-xs text-slate-500">{f.desc}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Liste récapitulative des produits */}
              <div>
                <label className="block text-sm font-bold uppercase tracking-wider text-slate-400 mb-3">
                  3. Produits Inclus dans ce Lot ({selectedComputers.length})
                </label>
                <div className="max-h-48 overflow-y-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-2 space-y-1">
                  {selectedComputers.map((c) => {
                    const isReady = c.missingFields.length === 0 && c.imageCount > 0;
                    return (
                      <div
                        key={c.id}
                        className="flex items-center justify-between rounded-xl px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 dark:text-white">
                            💻 {c.brand} {c.model}
                          </span>
                        </div>
                        <div>
                          {isReady ? (
                            <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                              ✓ Prêt ({formats.length} visuels)
                            </span>
                          ) : (
                            <span className="font-semibold text-amber-600 dark:text-amber-400">
                              ⚠️ Incomplet ({c.missingFields.join(', ') || 'Photo manquante'})
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between border-t border-slate-100 px-6 py-4 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
          <button
            type="button"
            onClick={onClose}
            disabled={isGenerating}
            className="btn-ghost"
          >
            {results ? 'Fermer' : 'Annuler'}
          </button>

          {!results && (
            <button
              type="button"
              onClick={handleStartBatch}
              disabled={isGenerating || readyCount === 0}
              className="btn-primary bg-gradient-to-r from-lime-500 to-emerald-500 hover:from-lime-600 hover:to-emerald-600 text-black font-extrabold shadow-lg shadow-lime-500/20 disabled:opacity-50"
            >
              {isGenerating ? (
                <span className="flex items-center gap-2">
                  <span className="animate-spin">⏳</span> Génération du lot en cours...
                </span>
              ) : (
                `🚀 Lancer la Génération Par Lot (${totalPostersToGenerate} visuels)`
              )}
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
