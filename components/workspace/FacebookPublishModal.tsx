'use client';

import { useState } from 'react';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  computerId: string;
  generationId?: string | null;
  filename: string;
  imageUrl: string;
  defaultCaption: string;
};

export default function FacebookPublishModal({
  isOpen,
  onClose,
  computerId,
  generationId,
  filename,
  imageUrl,
  defaultCaption,
}: Props) {
  const [caption, setCaption] = useState(defaultCaption);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [publishedUrl, setPublishedUrl] = useState<string | null>(null);

  if (!isOpen) return null;

  async function handlePublish() {
    setLoading(true);
    setError(null);
    setPublishedUrl(null);

    try {
      const res = await fetch('/api/facebook/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          computerId,
          generationId,
          filename,
          caption,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || 'Erreur lors de la publication Facebook.');
        setLoading(false);
        return;
      }

      setPublishedUrl(data.postUrl || 'https://www.facebook.com');
    } catch (err: any) {
      setError(`Erreur réseau: ${err?.message || 'Impossible de contacter le serveur.'}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl transition-all dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
          <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
            <svg className="h-6 w-6 fill-current" viewBox="0 0 24 24">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
            </svg>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white">
              Publier directement sur Facebook
            </h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            ✕
          </button>
        </div>

        {publishedUrl ? (
          <div className="my-6 rounded-xl bg-emerald-50 p-6 text-center border border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-800">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900 dark:text-emerald-300">
              ✓
            </div>
            <h4 className="text-lg font-bold text-emerald-900 dark:text-emerald-200">
              Publication réussie sur Facebook !
            </h4>
            <p className="mt-1 text-sm text-emerald-700 dark:text-emerald-400">
              Votre visuel et sa légende ont été publiés sur votre Page Facebook.
            </p>
            <div className="mt-5 flex justify-center gap-3">
              <a
                href={publishedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 font-semibold text-white hover:bg-emerald-700 shadow-sm transition"
              >
                Voir le post sur Facebook →
              </a>
              <button
                onClick={onClose}
                className="rounded-xl border border-slate-300 px-4 py-2.5 font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Fermer
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            {error && (
              <div className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-300">
                <span className="font-bold">Erreur : </span> {error}
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {/* Aperçu image */}
              <div className="flex flex-col items-center justify-center rounded-xl bg-slate-100 p-2 dark:bg-slate-800">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imageUrl}
                  alt="Aperçu visuel"
                  className="max-h-48 rounded-lg object-contain shadow-sm"
                />
                <span className="mt-2 text-xs font-medium text-slate-500">Visuel sélectionné</span>
              </div>

              {/* Texte de publication */}
              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Légende du post Facebook
                </label>
                <textarea
                  rows={7}
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 p-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  placeholder="Écrivez la légende qui accompagnera le visuel..."
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handlePublish}
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-bold text-white shadow-md hover:bg-blue-700 disabled:opacity-50 transition"
              >
                {loading ? (
                  <>
                    <svg className="h-4 w-4 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Publication en cours...
                  </>
                ) : (
                  'Publier sur Facebook 🚀'
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
