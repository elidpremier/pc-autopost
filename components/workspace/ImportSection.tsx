'use client';

import { useState } from 'react';
import {
  STANDARD_TEXT_TEMPLATE, STANDARD_JSON_TEMPLATE,
} from '@/lib/services/standard-format';
import type { ExtractedField } from '@/lib/types';

type Props = {
  extracting: boolean;
  error: string;
  detected: { source: string; provider: string; fields: ExtractedField[]; rawText: string } | null;
  onImport: (rawText: string) => Promise<{ ok: boolean; error?: string }>;
};

type Tab = 'text' | 'json' | 'free';

const TABS: { id: Tab; label: string; hint: string }[] = [
  { id: 'text', label: 'Texte standard', hint: 'Le format recommandé — une ligne par caractéristique.' },
  { id: 'json', label: 'JSON', hint: 'Toutes les informations d’un coup, clés structurées.' },
  { id: 'free', label: 'Texte libre / OCR', hint: 'Tout texte (capture lue par OCR, message WhatsApp…) est analysé.' },
];

export default function ImportSection({ extracting, error, detected, onImport }: Props) {
  const [tab, setTab] = useState<Tab>('text');
  const [value, setValue] = useState('');
  const [copied, setCopied] = useState('');

  const template = tab === 'json' ? STANDARD_JSON_TEMPLATE : STANDARD_TEXT_TEMPLATE;

  async function copyTemplate() {
    try {
      await navigator.clipboard.writeText(template);
      setCopied('Copié ✓');
    } catch {
      const ta = document.createElement('textarea');
      ta.value = template;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied('Copié ✓');
    }
    setTimeout(() => setCopied(''), 1500);
  }

  async function runImport() {
    const r = await onImport(value);
    if (r.ok) setValue('');
  }

  const found = detected ? detected.fields.filter((f) => f.value !== null) : [];

  return (
    <section className="card p-5">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">📥 Importer la fiche — zéro saisie manuelle</h2>
        <span className="text-xs text-slate-400">
          {tab === 'free' ? 'Le texte est analysé automatiquement' : 'Remplissez le modèle, collez-le ici, et lancez l’import'}
        </span>
      </div>
      <p className="mb-4 text-sm text-slate-500">
        Copiez le format standard, collez votre texte ou votre JSON, et toutes les caractéristiques
        (marque, processeur, RAM, stockage, écran, prix, état…) sont remplies d’un coup.
      </p>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg bg-slate-100 p-1 text-sm">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`rounded-md px-3 py-1.5 font-medium ${tab === t.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
              title={t.hint}
            >
              {t.label}
            </button>
          ))}
        </div>
        {tab !== 'free' && (
          <button onClick={() => void copyTemplate()} className="btn-ghost !py-1.5 text-xs">
            📋 {copied ? 'Modèle copié' : 'Copier le modèle'}
          </button>
        )}
      </div>

      <details className="mb-3 rounded-lg bg-slate-50 p-3 text-sm">
        <summary className="cursor-pointer font-semibold text-slate-600">
          Voir le format standard {tab === 'json' ? 'JSON' : 'texte'}
        </summary>
        <pre className="mt-2 overflow-auto rounded bg-white p-3 text-xs text-slate-600">{template}</pre>
      </details>

      <textarea
        className="input min-h-44 font-mono text-xs"
        placeholder={
          tab === 'json'
            ? '{\n  "marque": "HP",\n  "modele": "EliteBook 840 G6",\n  "processeur": "Intel Core i5",\n  "ram_go": 8,\n  "stockage": { "go": 256, "type": "SSD" },\n  "prix": 180000,\n  "devise": "FCFA",\n  "etat": "Bon état"\n}'
            : tab === 'text'
              ? 'MARQUE : HP\nMODELE : EliteBook 840 G6\nPROCESSEUR : Intel Core i5\nRAM : 8 Go\nSTOCKAGE : 256 Go SSD\nECRAN : 14 pouces Full HD\nPRIX : 180000 FCFA\nETAT : Bon état'
              : 'Collez ici n’importe quel texte de fiche (résultat OCR, message, notes…) — les informations seront reconnues automatiquement.'
        }
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />

      {error && <div className="mt-3 rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-700">{error}</div>}

      <div className="mt-3 flex items-center gap-3">
        <button onClick={() => void runImport()} disabled={extracting || value.trim().length < 5} className="btn-primary">
          {extracting ? 'Analyse en cours…' : '⚡ Importer toutes les caractéristiques'}
        </button>
        <span className="text-xs text-slate-400">La génération reste bloquée tant que vous n’avez pas vérifié les valeurs.</span>
      </div>

      {detected && (
        <div className="mt-4 rounded-lg border border-emerald-100 bg-emerald-50/60 p-4">
          <p className="text-sm font-semibold text-emerald-800">
            ✅ {found.length} valeur{found.length > 1 ? 's' : ''} importée{found.length > 1 ? 's' : ''} via {detected.source}
            {detected.provider === 'llm' ? ' (IA)' : ''} — appliquée{found.length > 1 ? 's' : ''} aux champs ci-dessous.
          </p>
          <div className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
            {found.map((f) => (
              <div key={f.key} className="flex justify-between gap-2 border-b border-emerald-100 py-1">
                <span className="text-slate-500">{f.label}</span>
                <span className="text-right font-semibold text-slate-800">{Array.isArray(f.value) ? f.value.join(', ') : String(f.value)}</span>
              </div>
            ))}
          </div>
          {found.length === 0 && (
            <p className="mt-2 text-sm text-amber-700">
              ⚠️ Aucune valeur reconnue. Vérifiez le format (voir le modèle) ou utilisez l’onglet « Texte libre / OCR ».
            </p>
          )}
          <p className="mt-2 text-xs text-emerald-700/80">
            ⚠️ Règle de confiance : confirmez ou corrigez les valeurs, puis générez.
          </p>
          <details className="mt-2">
            <summary className="cursor-pointer text-xs font-semibold text-emerald-700">Voir le texte importé</summary>
            <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded bg-white p-3 text-xs text-slate-600">{detected.rawText}</pre>
          </details>
        </div>
      )}
    </section>
  );
}
