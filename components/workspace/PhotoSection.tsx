'use client';

import { useRef, useState } from 'react';
import CropSlider from './CropSlider';
import type { ImageRow } from '@/lib/types';

type Props = {
  computerId: string;
  images: ImageRow[];
  onImagesChange: (imgs: ImageRow[]) => void;
  extracting: boolean;
  extract: (opts: { imageId?: string; cropRatio?: number; rawText?: string }) => Promise<{ ok: boolean; error?: string }>;
};

export default function PhotoSection({ computerId, images, onImagesChange, extracting, extract }: Props) {
  const main = images.find((i) => i.kind === 'main');
  const cleaned = images.find((i) => i.kind === 'cleaned');
  const secondary = images.find((i) => i.kind === 'secondary');
  const savedRatio = main && (cleaned?.crop_top ?? main.crop_top) ? (cleaned?.crop_top ?? main.crop_top)! / main.height : null;
  const [ratio, setRatio] = useState<number>(savedRatio ?? 0.32);
  const [view, setView] = useState<'original' | 'cleaned'>('original');
  const [busy, setBusy] = useState<'' | 'upload' | 'crop' | 'extract'>('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const mainInput = useRef<HTMLInputElement>(null);
  const secInput = useRef<HTMLInputElement>(null);
  const dirty = savedRatio === null ? false : Math.abs(ratio - savedRatio) > 0.004;

  async function upload(file: File, kind: 'main' | 'secondary') {
    setBusy('upload'); setError('');
    try {
      const fd = new FormData(); fd.append('file', file); fd.append('kind', kind);
      if (kind === 'main') fd.append('cropRatio', String(ratio));
      const res = await fetch(`/api/computers/${computerId}/images`, { method: 'POST', body: fd });
      const data = await res.json(); if (!res.ok) throw new Error(data.error ?? 'Erreur');
      onImagesChange(data.images as ImageRow[]); if (kind === 'main') setView('original');
    } catch (e) { setError(e instanceof Error ? e.message : 'Erreur'); } finally { setBusy(''); }
  }

  async function reCrop() {
    if (!main) return;
    setBusy('crop'); setError('');
    try {
      const res = await fetch(`/api/computers/${computerId}/re-crop`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ imageId: main.id, cropRatio: ratio }) });
      const data = await res.json(); if (!res.ok) throw new Error(data.error ?? 'Erreur'); onImagesChange(data.images as ImageRow[]);
    } catch (e) { setError(e instanceof Error ? e.message : 'Erreur'); } finally { setBusy(''); }
  }

  async function runExtract(opts: { imageId?: string; cropRatio?: number; rawText?: string }) {
    setBusy('extract'); setError(''); setInfo(''); const r = await extract(opts);
    if (!r.ok) setError(r.error ?? 'Erreur'); else setInfo('Valeurs extraites — vérifiez-les avant publication.'); setBusy('');
  }

  async function runCutoutAI() {
    if (!main) return;
    setBusy('extract'); setError(''); setInfo('Détourage du produit en cours…');
    try {
      const { removeBackgroundServer } = await import('@/lib/services/background-removal');
      const source = cleaned?.crop_top !== null && cleaned?.derived_from === main.id ? cleaned : main;
      const result = await removeBackgroundServer(computerId, source.id, setInfo);
      onImagesChange(result.images as ImageRow[]); setView('cleaned');
      const method = result.method === 'rembg-http' ? 'rembg + BiRefNet' : 'BiRefNet Node (fallback)';
      setInfo(`Détourage réussi avec ${method} en ${(result.durationMs / 1000).toFixed(1)} s. Couverture du masque : ${(result.maskCoverage * 100).toFixed(1)} %.`);
      if (result.warnings.length) setInfo((current) => `${current} ${result.warnings.join(' ')}`);
    } catch (e) { setError(e instanceof Error ? e.message : 'Erreur détourage IA'); setInfo(''); }
    finally { setBusy(''); }
  }

  return (
    <section className="card p-5">
      <div className="mb-3 flex items-center justify-between"><h2 className="font-semibold">Photos & fiche source</h2>{main && <div className="flex gap-2 text-xs"><button onClick={() => setView('original')} className={`chip ${view === 'original' ? 'bg-blue-700 text-white' : 'bg-slate-100 text-slate-500'}`}>Photo-fiche originale</button>{cleaned && <button onClick={() => setView('cleaned')} className={`chip ${view === 'cleaned' ? 'bg-blue-700 text-white' : 'bg-slate-100 text-slate-500'}`}>Photo détourée</button>}</div>}</div>
      {!main ? <div className="space-y-3"><p className="text-sm text-slate-500">Téléversez la photo-fiche : fiche technique en haut et PC en dessous (JPEG, PNG ou WebP, 15 Mo max).</p><button onClick={() => mainInput.current?.click()} disabled={busy === 'upload'} className="flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-slate-500 hover:border-blue-400 disabled:opacity-50"><span className="text-3xl">🖼️</span><span className="text-sm font-semibold">{busy === 'upload' ? 'Envoi en cours…' : 'Choisir la photo principale'}</span></button><input ref={mainInput} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f, 'main'); e.target.value = ''; }} /></div> : <div className="space-y-4">
        {view === 'original' && <CropSlider src={`/api/images/${main.id}?t=${Date.now()}`} ratio={ratio} onRatioChange={setRatio} naturalHeight={main.height} />}
        {view === 'cleaned' && cleaned && <div className="relative mx-auto w-fit max-w-full overflow-hidden rounded-lg"><img src={`/api/images/${cleaned.id}`} alt="Photo détourée" className="block max-h-[480px] w-auto max-w-full" /><span className="absolute left-2 top-2 rounded bg-emerald-600/90 px-2 py-0.5 text-[11px] font-semibold text-white">Produit isolé — fond transparent</span></div>}
        {error && <div className="rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-700">{error}</div>}{info && <div className="rounded-lg bg-emerald-50 px-4 py-2.5 text-sm text-emerald-700">{info}</div>}
        <div className="flex flex-wrap gap-2"><button onClick={() => runExtract({ imageId: main.id, cropRatio: ratio })} disabled={busy !== ''} className="btn-primary">{busy === 'extract' ? 'Traitement…' : 'Extraire la fiche (OCR)'}</button><button onClick={runCutoutAI} disabled={busy !== ''} className="chip bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow hover:brightness-110">Détourer le PC (BiRefNet)</button><button onClick={() => mainInput.current?.click()} disabled={busy !== ''} className="btn-ghost">Changer la photo</button>{dirty && <button onClick={reCrop} disabled={busy !== ''} className="btn-ghost border-amber-300 text-amber-700">{busy === 'crop' ? 'Recadrage…' : 'Appliquer ce recadrage'}</button>}</div>
        <input ref={mainInput} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f, 'main'); e.target.value = ''; }} />
        <details className="text-sm"><summary className="cursor-pointer font-semibold text-slate-600">OCR illisible ? Utiliser « Importer la fiche »</summary><p className="mt-2 text-slate-500">Le copier-coller d’un texte standard ou JSON reste la méthode la plus fiable.</p></details>
      </div>}
      <div className="mt-5 border-t border-slate-100 pt-4"><h3 className="mb-2 text-sm font-semibold text-slate-700">Photo secondaire (détail, clavier, ports…)</h3>{secondary ? <div className="flex items-center gap-3"><img src={`/api/images/${secondary.id}`} alt="Photo secondaire" className="h-20 w-28 rounded-lg object-cover" /><button onClick={() => secInput.current?.click()} disabled={busy === 'upload'} className="btn-ghost !py-1.5 text-xs">Remplacer</button></div> : <button onClick={() => secInput.current?.click()} disabled={busy === 'upload'} className="rounded-lg border border-dashed border-slate-300 px-4 py-2 text-sm text-slate-500">+ Ajouter une photo secondaire</button>}<input ref={secInput} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f, 'secondary'); e.target.value = ''; }} /></div>
    </section>
  );
}
