'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { STATUS_LABELS, type ExtractionRow, type StatusHistoryRow } from '@/lib/types';
import { timeAgo } from '@/lib/utils';

type Props = {
  computerId: string;
  extractions: ExtractionRow[];
  statusHistory: StatusHistoryRow[];
  onDelete: () => Promise<void>;
};

export default function HistorySection({ computerId, extractions, statusHistory, onDelete }: Props) {
  const router = useRouter();
  const [busyDelete, setBusyDelete] = useState(false);
  void computerId;

  return (
    <section className="card p-5">
      <h2 className="mb-4 font-semibold">🗂️ Historique & données conservées</h2>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Extractions ({extractions.length})</h3>
          {extractions.length === 0 ? (
            <p className="text-sm text-slate-400">Aucune extraction effectuée.</p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {extractions.slice(0, 8).map((e) => (
                <li key={e.id} className="rounded bg-slate-50 px-2.5 py-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">
                      {e.provider === 'tesseract' ? 'OCR' : e.provider === 'standard_json' ? 'Import JSON' : e.provider === 'llm' ? 'Import IA' : 'Import texte'}
                    </span>
                    <span className="text-[11px] text-slate-400">{timeAgo(e.created_at)}</span>
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-[11px] text-slate-400">{e.raw_text.slice(0, 90) || '(vide)'}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Changements de statut</h3>
          {statusHistory.length === 0 ? (
            <p className="text-sm text-slate-400">Aucun changement enregistré.</p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {statusHistory.slice(0, 8).map((h) => (
                <li key={h.id} className="rounded bg-slate-50 px-2.5 py-1.5">
                  <span className="font-medium">
                    {h.from_status ? STATUS_LABELS[h.from_status] : 'Création'} → {STATUS_LABELS[h.to_status]}
                  </span>
                  <span className="ml-2 text-[11px] text-slate-400">{timeAgo(h.created_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between rounded-lg border border-red-100 bg-red-50/50 px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-red-700">Zone de danger</p>
          <p className="text-xs text-red-500">Supprime définitivement le produit, ses photos et ses contenus générés.</p>
        </div>
        <button
          className="btn-danger"
          disabled={busyDelete}
          onClick={async () => {
            if (!confirm('Supprimer ce produit et tous ses fichiers ?')) return;
            setBusyDelete(true);
            await onDelete();
            router.push('/');
            router.refresh();
          }}
        >
          {busyDelete ? 'Suppression…' : 'Supprimer le produit'}
        </button>
      </div>
    </section>
  );
}
