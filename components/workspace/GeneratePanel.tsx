'use client';

import { useState } from 'react';
import { FORMAT_INFO, type Format } from '@/lib/types';
import RenderStudioModal from './RenderStudioModal';

type Props = {
  computerId: string;
  missing: string[];
  texts: { facebook: string; instagram: string; whatsapp: string };
  tick?: number;
};

const FORMAT_CARDS: { format: Format; tag: string; icon: string }[] = [
  { format: 'square', tag: 'Facebook & Instagram', icon: '⏹️' },
  { format: 'portrait', tag: 'Fil Instagram HD', icon: '📱' },
  { format: 'story', tag: 'Stories & WhatsApp', icon: '📲' },
  { format: 'detail', tag: 'Fiche Technique', icon: '📄' },
];

const TEMPLATE_OPTIONS: { id: string; label: string; badge: string; color: string }[] = [
  { id: 'cyber_luxe_v2', label: 'Cyber Luxe v2', badge: '⭐ PSD Premium', color: 'bg-lime-400' },
  { id: 'clean_minimal', label: 'Clean E-Commerce', badge: 'Épuré', color: 'bg-emerald-500' },
  { id: 'dark_luxe', label: 'Dark Tech Luxe', badge: 'Sombre', color: 'bg-cyan-500' },
  { id: 'promo_banner', label: 'Bannière Promo', badge: 'High Impact', color: 'bg-amber-500' },
  { id: 'pro', label: 'Pro Classic', badge: 'Standard', color: 'bg-blue-500' },
];

export default function GeneratePanel({ computerId, missing, texts, tick }: Props) {
  const [selectedFormat, setSelectedFormat] = useState<Format | null>(null);
  const [studioOpen, setStudioOpen] = useState(false);
  const [activeTemplate, setActiveTemplate] = useState<string>('cyber_luxe_v2');

  function openStudio(f: Format) {
    setSelectedFormat(f);
    setStudioOpen(true);
  }

  const activeTemplateInfo = TEMPLATE_OPTIONS.find((t) => t.id === activeTemplate);

  return (
    <section className="card p-6">
      <div className="mb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4 dark:border-slate-800">
        <div>
          <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            🎨 Studio de Rendu & Création Visuelle
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Sélectionnez un style visuel, puis cliquez sur un format pour ouvrir le Studio HD.
          </p>
        </div>
        {missing.length > 0 && (
          <div className="rounded-xl bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-800 border border-amber-200 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-300">
            ⚠️ {missing.length} champ(s) manquant(s)
          </div>
        )}
      </div>

      {/* Sélecteur de Style Visuel */}
      <div className="mb-5">
        <p className="mb-2.5 text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
          1. Choisir le style visuel
        </p>
        <div className="flex flex-wrap gap-2">
          {TEMPLATE_OPTIONS.map((t) => {
            const active = activeTemplate === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTemplate(t.id)}
                className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold transition-all ${
                  active
                    ? 'border-blue-600 bg-blue-600 text-white shadow-md scale-105'
                    : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-400 hover:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                <span className={`h-2 w-2 rounded-full ${t.color}`} />
                {t.label}
                {active && <span className="ml-1 text-[9px] font-black opacity-80">✓</span>}
              </button>
            );
          })}
        </div>
        {activeTemplateInfo && (
          <p className="mt-1.5 text-[10px] text-slate-400">
            Aperçu actif :{' '}
            <span className="font-bold text-slate-600 dark:text-slate-300">{activeTemplateInfo.label}</span>{' '}
            — {activeTemplateInfo.badge}
          </p>
        )}
      </div>

      {/* Formats d'Aperçu */}
      <p className="mb-2.5 text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
        2. Choisir le format & ouvrir le Studio
      </p>

      {missing.length > 0 ? (
        <div className="my-4 rounded-2xl bg-amber-50/80 p-6 text-center border border-amber-200 dark:bg-amber-950/30 dark:border-amber-900">
          <span className="text-3xl">📝</span>
          <h3 className="mt-2 text-sm font-bold text-amber-900 dark:text-amber-200">
            Veuillez d'abord compléter les champs obligatoires du PC
          </h3>
          <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
            Renseignez : {missing.join(', ')}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {FORMAT_CARDS.map(({ format, tag, icon }) => {
            const info = FORMAT_INFO[format];
            const previewSrc = `/api/computers/${computerId}/preview?format=${format}&template=${activeTemplate}&t=${tick ?? 0}`;

            return (
              <div
                key={format}
                onClick={() => openStudio(format)}
                className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200 bg-white p-2.5 shadow-sm transition-all hover:-translate-y-1 hover:border-blue-500 hover:shadow-xl dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-500 cursor-pointer"
              >
                {/* Aperçu Réel */}
                <div className="relative flex h-48 w-full items-center justify-center overflow-hidden rounded-xl bg-slate-950">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={previewSrc}
                    alt={info.label}
                    className="max-h-44 w-auto rounded-lg object-contain transition-transform duration-300 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-blue-600/0 opacity-0 group-hover:bg-blue-600/10 group-hover:opacity-100 transition-all flex items-center justify-center">
                    <span className="rounded-xl bg-blue-600 px-3 py-1.5 text-[11px] font-bold text-white shadow-lg">
                      👁️ Studio HD
                    </span>
                  </div>
                </div>

                {/* Info Format */}
                <div className="mt-2 px-0.5">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-extrabold text-slate-900 dark:text-white flex items-center gap-1">
                      <span>{icon}</span> {info.label}
                    </h4>
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold text-slate-500 dark:bg-slate-800">
                      {info.h.split(' ')[0]}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[10px] text-slate-400">{tag}</p>
                </div>

                <button
                  type="button"
                  className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg bg-slate-100 py-2 text-[11px] font-bold text-slate-700 group-hover:bg-blue-600 group-hover:text-white dark:bg-slate-800 dark:text-slate-300 dark:group-hover:bg-blue-600 transition"
                >
                  Ouvrir →
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Studio de Rendu */}
      {selectedFormat && (
        <RenderStudioModal
          isOpen={studioOpen}
          onClose={() => setStudioOpen(false)}
          computerId={computerId}
          initialFormat={selectedFormat}
          initialTemplate={activeTemplate}
          texts={texts}
        />
      )}
    </section>
  );
}
