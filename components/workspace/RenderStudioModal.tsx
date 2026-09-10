'use client';

import { useState, useEffect } from 'react';
import { FORMAT_INFO, FORMATS, type Format } from '@/lib/types';
import FacebookPublishModal from './FacebookPublishModal';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  computerId: string;
  initialFormat?: Format;
  initialTemplate?: string;
  texts: { facebook: string; instagram: string; whatsapp: string };
};

const TEMPLATE_OPTIONS = [
  { id: 'cyber_luxe_v2', label: 'Cyber Luxe v2', badge: 'Style PSD', color: 'bg-lime-400' },
  { id: 'clean_minimal', label: 'Clean E-Commerce', badge: 'Épuré', color: 'bg-emerald-500' },
  { id: 'dark_luxe', label: 'Dark Tech Luxe', badge: 'Sombre', color: 'bg-cyan-500' },
  { id: 'promo_banner', label: 'Bannière Promo', badge: 'High Impact', color: 'bg-amber-500' },
  { id: 'pro', label: 'Professionnel Classic', badge: 'Standard', color: 'bg-blue-500' },
];

export default function RenderStudioModal({
  isOpen,
  onClose,
  computerId,
  initialFormat = 'square',
  initialTemplate = 'cyber_luxe_v2',
  texts,
}: Props) {
  const [currentFormat, setCurrentFormat] = useState<Format>(initialFormat);
  const [currentTemplate, setCurrentTemplate] = useState<string>(initialTemplate);
  const [textTab, setTextTab] = useState<'facebook' | 'instagram' | 'whatsapp'>('facebook');
  const [loadingImg, setLoadingImg] = useState(true);
  const [copied, setCopied] = useState(false);
  const [imgTick, setImgTick] = useState(0);

  // Facebook publish modal
  const [showFbModal, setShowFbModal] = useState(false);

  useEffect(() => {
    setCurrentFormat(initialFormat);
    setCurrentTemplate(initialTemplate);
  }, [initialFormat, initialTemplate, isOpen]);

  if (!isOpen) return null;

  const previewUrl = `/api/computers/${computerId}/preview?format=${currentFormat}&template=${currentTemplate}&t=${imgTick}`;
  const downloadUrl = `/api/computers/${computerId}/preview?format=${currentFormat}&template=${currentTemplate}&download=1`;

  async function copyText(t: string) {
    try {
      await navigator.clipboard.writeText(t);
      setCopied(true);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = t;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
    }
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-6 backdrop-blur-md animate-fade-in">
      <div className="flex h-full max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
        
        {/* Header Modal */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-xl text-blue-600 dark:bg-blue-950 dark:text-blue-400">
              🎨
            </span>
            <div>
              <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">
                Studio de Rendu & Création
              </h3>
              <p className="text-xs text-slate-500">
                Aperçu réel HD — Choisissez votre style, téléchargez ou publiez en 1-clic.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-white transition"
          >
            ✕
          </button>
        </div>

        {/* Body : 2 colonnes */}
        <div className="grid flex-1 grid-cols-1 overflow-hidden lg:grid-cols-12">
          
          {/* Colonne Gauche : Aperçu Réel Visuel HD */}
          <div className="relative flex flex-col items-center justify-center bg-slate-950 p-4 lg:col-span-7">
            {loadingImg && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-sm">
                <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"></div>
                <span className="mt-3 text-xs font-semibold text-slate-300">Génération du rendu HD…</span>
              </div>
            )}
            
            <div className="relative flex h-full max-h-[70vh] w-full items-center justify-center overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewUrl}
                alt="Aperçu HD"
                onLoad={() => setLoadingImg(false)}
                onError={() => setLoadingImg(false)}
                className="max-h-[68vh] max-w-full rounded-2xl object-contain shadow-2xl transition-all duration-300"
              />
            </div>

            {/* Badge de format bas */}
            <div className="mt-3 flex items-center gap-2 rounded-full bg-slate-900/80 px-4 py-1.5 text-xs text-slate-300 border border-slate-800">
              <span className="font-bold text-white">{FORMAT_INFO[currentFormat]?.label}</span>
              <span>•</span>
              <span>{FORMAT_INFO[currentFormat]?.h}</span>
            </div>
          </div>

          {/* Colonne Droite : Contrôles, Modèles & Actions */}
          <div className="flex flex-col justify-between overflow-y-auto p-6 lg:col-span-5 border-l border-slate-100 dark:border-slate-800">
            <div className="space-y-5">
              
              {/* 1. Sélecteur de Modèle Visuel */}
              <div>
                <label className="mb-2.5 block text-xs font-extrabold uppercase tracking-wider text-slate-400">
                  1. Modèle Visuel
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  {TEMPLATE_OPTIONS.map((t) => {
                    const active = currentTemplate === t.id;
                    return (
                      <button
                        key={t.id}
                        onClick={() => {
                          setLoadingImg(true);
                          setCurrentTemplate(t.id);
                        }}
                        className={`flex flex-col items-start rounded-2xl border p-3 text-left transition-all ${
                          active
                            ? 'border-blue-600 bg-blue-50/80 ring-2 ring-blue-500/20 dark:border-blue-500 dark:bg-blue-950/40'
                            : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-800/40 dark:hover:bg-slate-800'
                        }`}
                      >
                        <div className="flex w-full items-center justify-between">
                          <span className="text-xs font-bold text-slate-900 dark:text-white">{t.label}</span>
                          <span className={`h-2 w-2 rounded-full ${t.color}`} />
                        </div>
                        <span className="mt-1 text-[10px] font-semibold text-slate-500">{t.badge}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2. Sélecteur de Format */}
              <div>
                <label className="mb-2.5 block text-xs font-extrabold uppercase tracking-wider text-slate-400">
                  2. Format d'exportation
                </label>
                <div className="flex flex-wrap gap-2">
                  {FORMATS.map((f) => {
                    const active = currentFormat === f;
                    const info = FORMAT_INFO[f];
                    return (
                      <button
                        key={f}
                        onClick={() => {
                          setLoadingImg(true);
                          setCurrentFormat(f);
                        }}
                        className={`rounded-xl px-3.5 py-2 text-xs font-bold transition ${
                          active
                            ? 'bg-slate-900 text-white shadow-md dark:bg-white dark:text-slate-900'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                        }`}
                      >
                        {info.label} ({info.h.split(' ')[0]})
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 3. Texte de publication */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
                    3. Légende du Post
                  </label>
                  <div className="flex rounded-lg bg-slate-100 p-0.5 text-[11px] dark:bg-slate-800">
                    {(['facebook', 'instagram', 'whatsapp'] as const).map((tab) => (
                      <button
                        key={tab}
                        onClick={() => setTextTab(tab)}
                        className={`rounded-md px-2 py-0.5 font-bold capitalize ${textTab === tab ? 'bg-white text-blue-600 shadow-sm dark:bg-slate-900 dark:text-blue-400' : 'text-slate-500'}`}
                      >
                        {tab}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="relative">
                  <textarea
                    readOnly
                    rows={4}
                    value={texts[textTab]}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs font-mono leading-relaxed text-slate-800 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200"
                  />
                  <button
                    onClick={() => void copyText(texts[textTab])}
                    className={`absolute bottom-2.5 right-2.5 rounded-lg px-2.5 py-1 text-[11px] font-bold transition ${copied ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-white hover:bg-slate-700'}`}
                  >
                    {copied ? 'Copié ✓' : 'Copier'}
                  </button>
                </div>
              </div>

            </div>

            {/* 4. Boutons d'Action Final */}
            <div className="mt-6 space-y-2.5 border-t border-slate-100 pt-4 dark:border-slate-800">
              <a
                href={downloadUrl}
                download
                className="flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-300 py-3 text-xs font-bold text-slate-800 shadow-sm hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 transition"
              >
                ⬇ Télécharger l'image HD (.jpg)
              </a>

              <button
                onClick={() => setShowFbModal(true)}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 py-3 text-xs font-extrabold text-white shadow-md hover:bg-blue-700 transition"
              >
                <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
                Publier directement sur Facebook
              </button>
            </div>

          </div>

        </div>

      </div>

      {/* Modal d'envoi Facebook */}
      {showFbModal && (
        <FacebookPublishModal
          isOpen={showFbModal}
          onClose={() => setShowFbModal(false)}
          computerId={computerId}
          generationId={null}
          filename={`preview_${currentTemplate}_${currentFormat}.jpg`}
          imageUrl={previewUrl}
          defaultCaption={texts[textTab]}
        />
      )}
    </div>
  );
}
