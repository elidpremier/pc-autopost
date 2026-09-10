'use client';

import { useMemo, useState } from 'react';
import FacebookPreview from './FacebookPreview';
import { FORMAT_INFO, type Format, type GenerationRow, type TemplateData } from '@/lib/types';
import { buildPlatformTexts } from '@/lib/services/text-service';
import { timeAgo } from '@/lib/utils';

type Props = {
  generations: GenerationRow[];
  shopName: string;
  logoUrl: string | null;
};

/**
 * Aperçu « tel que sur Facebook » + galerie de TOUS les formats enregistrés
 * (chaque génération est conservée : template versionné + snapshot des données).
 */
export default function PreviewGallery({ generations, shopName, logoUrl }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(generations[0]?.id ?? null);
  const selected = generations.find((g) => g.id === selectedId) ?? generations[0] ?? null;

  const facebookText = useMemo(() => {
    if (!selected) return '';
    try {
      return buildPlatformTexts(selected.snapshot as TemplateData).facebook;
    } catch {
      return '';
    }
  }, [selected]);

  return (
    <section className="card p-5">
      <h2 className="font-semibold">👁️ Aperçu & contenus enregistrés</h2>
      <p className="mb-4 mt-1 text-sm text-slate-500">
        Chaque format généré est conservé. Choisissez un visuel pour voir l’aperçu complet « comme sur Facebook »
        (texte + image), puis téléchargez et publiez.
      </p>

      {!generations.length ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-slate-200 p-8 text-center text-sm text-slate-400">
          <span className="text-2xl">🖼️</span>
          Aucun contenu enregistré pour l’instant — générez d’abord un ou plusieurs formats.
        </div>
      ) : (
        <>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {generations.slice(0, 12).map((g) => (
              <button
                key={g.id}
                onClick={() => setSelectedId(g.id)}
                className={`shrink-0 overflow-hidden rounded-xl border-2 text-left transition ${
                  selected?.id === g.id ? 'border-blue-600 shadow-md' : 'border-transparent opacity-80 hover:opacity-100'
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/api/generations/${g.id}`} alt={FORMAT_INFO[g.format as Format]?.label} className="h-28 w-28 object-cover" />
                <div className="bg-white px-1 py-1 text-center text-[10px] font-semibold text-slate-600">
                  {FORMAT_INFO[g.format as Format]?.label ?? g.format}
                </div>
              </button>
            ))}
          </div>

          <div className="mt-4 grid items-start gap-6 lg:grid-cols-2">
            <FacebookPreview
              image={selected ? { url: `/api/generations/${selected.id}`, formatLabel: FORMAT_INFO[selected.format as Format]?.label ?? selected.format } : null}
              text={facebookText}
              shopName={shopName}
              logoUrl={logoUrl}
            />

            <div className="space-y-3">
              {selected && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">
                      {FORMAT_INFO[selected.format as Format]?.label ?? selected.format}
                      <span className="ml-2 font-normal text-slate-400">
                        {FORMAT_INFO[selected.format as Format]?.h}
                      </span>
                    </span>
                    <a href={`/api/generations/${selected.id}/download`} download className="btn-primary !px-3 !py-1.5 text-xs">
                      ⬇ Télécharger
                    </a>
                  </div>
                  <p className="mt-1.5 text-xs text-slate-500">
                    Template professionnel v{selected.template_version} · généré {timeAgo(selected.created_at)}
                  </p>
                  <p className="mt-1.5 text-xs text-slate-500">
                    Le texte de l’aperçu est recalculé depuis le snapshot de cette génération :
                    image et annonce affichent toujours le même prix et les mêmes caractéristiques.
                  </p>
                </div>
              )}

              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Tous les formats enregistrés ({generations.length})
                </h3>
                <ul className="max-h-80 space-y-1.5 overflow-y-auto pr-1">
                  {generations.map((g) => (
                    <li key={g.id} className="flex items-center gap-3 rounded-lg border border-slate-100 bg-white px-2.5 py-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`/api/generations/${g.id}`} alt="" className="h-12 w-12 shrink-0 rounded object-cover" />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold">
                          {FORMAT_INFO[g.format as Format]?.label ?? g.format}
                        </div>
                        <div className="text-[11px] text-slate-400">{timeAgo(g.created_at)}</div>
                      </div>
                      {selected?.id === g.id ? (
                        <span className="chip bg-blue-100 text-blue-700">Aperçu</span>
                      ) : (
                        <button onClick={() => setSelectedId(g.id)} className="btn-ghost !px-2.5 !py-1 text-xs">
                          Aperçu
                        </button>
                      )}
                      <a href={`/api/generations/${g.id}/download`} download className="btn-ghost !px-2.5 !py-1 text-xs" title="Télécharger">
                        ⬇
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
