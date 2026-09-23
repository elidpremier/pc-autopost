'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Nav from '@/components/Nav';
import StatusBadge from '@/components/StatusBadge';
import ImportSection from './ImportSection';
import PhotoSection from './PhotoSection';
import SpecForm from './SpecForm';
import GeneratePanel from './GeneratePanel';
import PreviewGallery from './PreviewGallery';
import HistorySection from './HistorySection';
import type { ExtractionResult, GenerationResult } from './types';
import {
  STATUS_LABELS, CONDITION_LABELS,
  type Condition, type ComputerFields, type ExtractionRow, type Format, type GenerationRow,
  type ImageRow, type Platform, type PublicationRow, type PcStatus,
  type StatusHistoryRow, type StorageType, type Settings,
} from '@/lib/types';
import type { ComputerRow } from '@/lib/db';

type Props = {
  initial: {
    computer: ComputerRow;
    images: ImageRow[];
    generations: GenerationRow[];
    publications: PublicationRow[];
    statusHistory: StatusHistoryRow[];
    extractions: ExtractionRow[];
    settings: Settings;
  };
};

function toFormFields(c: ComputerRow): ComputerFields {
  return {
    brand: c.brand, model: c.model, processor: c.processor,
    ram_gb: c.ram_gb, storage_capacity_gb: c.storage_capacity_gb, storage_type: c.storage_type,
    screen_size: c.screen_size, screen_resolution: c.screen_resolution,
    graphics: c.graphics, keyboard: c.keyboard, ports: c.ports, accessories: c.accessories,
    warranty: c.warranty, condition: c.condition, battery_condition: c.battery_condition,
    battery_note: c.battery_note ?? null, price_amount: c.price_amount, currency: c.currency,
    status: c.status, notes: c.notes,
  };
}

export default function Workspace({ initial }: Props) {
  const router = useRouter();
  const id = initial.computer.id;
  const [form, setForm] = useState<ComputerFields>(toFormFields(initial.computer));
  const [sources, setSources] = useState<Record<string, string>>({});
  const [images, setImages] = useState<ImageRow[]>(initial.images);
  const [generations, setGenerations] = useState<GenerationRow[]>(initial.generations);
  const [publications, setPublications] = useState<PublicationRow[]>(initial.publications);
  const [statusHistory, setStatusHistory] = useState<StatusHistoryRow[]>(initial.statusHistory);
  const [extractions, setExtractions] = useState<ExtractionRow[]>(initial.extractions);
  const [extraction, setExtraction] = useState<ExtractionResult | null>(null);
  const [importError, setImportError] = useState('');
  const [extracting, setExtracting] = useState(false);
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [tick, setTick] = useState<number>(() => Date.now());

  useEffect(() => {
    const timer = setTimeout(() => {
      fetch(`/api/computers/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      }).then((res) => {
        if (res.ok) {
          setSavedAt(new Date().toISOString());
          setTick(Date.now());
        }
      });
    }, 400);

    return () => clearTimeout(timer);
  }, [form, id]);

  const missing = useMemo(() => {
    const m: string[] = [];
    if (!form.brand.trim()) m.push('Marque');
    if (!form.model.trim()) m.push('Modèle');
    if (!form.processor.trim()) m.push('Processeur');
    if (!(form.ram_gb ?? 0)) m.push('RAM');
    if (!(form.storage_capacity_gb ?? 0)) m.push('Stockage');
    if (!form.condition) m.push('État général');
    if (!((form.price_amount ?? 0) > 0)) m.push('Prix valide');
    if (!form.currency.trim()) m.push('Devise');
    return m;
  }, [form]);

  const texts = useMemo(() => {
    const brand = form.brand.trim() || 'Marque';
    const model = form.model.trim() || '';
    const proc = form.processor.trim() || 'Non renseigné';
    const ram = form.ram_gb ? `${form.ram_gb} Go` : 'Non renseigné';
    const storage = form.storage_capacity_gb ? `${form.storage_capacity_gb} Go ${form.storage_type || ''}`.trim() : 'Non renseigné';
    const screen = form.screen_size ? `${form.screen_size}" ${form.screen_resolution || ''}`.trim() : '';
    const price = form.price_amount ? `${new Intl.NumberFormat('fr-FR').format(form.price_amount)} ${form.currency || 'FCFA'}` : '—';
    const cond = form.condition ? CONDITION_LABELS[form.condition] : 'Bon état';

    const fb = `💻 ${brand} ${model} — ${cond}

🔧 Processeur : ${proc}
🧠 RAM : ${ram}
💾 Stockage : ${storage}
${screen ? `🖥️ Écran : ${screen}\n` : ''}${form.graphics ? `🎮 Graphique : ${form.graphics}\n` : ''}${form.warranty ? `🛡️ Garantie : ${form.warranty}\n` : ''}${form.accessories?.length ? `📦 Accessoires : ${form.accessories.join(', ')}\n` : ''}
💰 Prix : ${price}
📞 Contact / WhatsApp : ${initial.settings.phone || 'Contact Boutique'}

#${brand.replace(/\s+/g, '')} #PCoccasion #Reconditionne #Technologie`;

    const ig = `💻 ${brand} ${model} — ${cond}

${proc} • ${ram} • ${storage}
${screen ? screen + ' • ' : ''}${form.warranty ? 'Garantie ' + form.warranty : ''}

💰 ${price}
📞 ${initial.settings.phone || ''}

#pc #pcoccasion #informatique #${brand.toLowerCase()}`;

    const wa = `Bonjour 👋

Je vous propose le PC suivant :
💻 *${brand} ${model}* (${cond})

• Processeur : ${proc}
• RAM : ${ram}
• Stockage : ${storage}
• Garantie : ${form.warranty || 'Oui'}
• Accessoires : ${form.accessories?.join(', ') || 'Chargeur'}

💰 *Prix : ${price}*
📞 Téléphone / WhatsApp : ${initial.settings.phone || ''}`;

    return { facebook: fb, instagram: ig, whatsapp: wa };
  }, [form, initial.settings]);

  function setField(patch: Partial<ComputerFields>) {
    setForm((f) => ({ ...f, ...patch }));
    setSavedAt(null);
    // Un champ saisi/corrigé par l'utilisateur devient « confirmé » (plus en badge OCR).
    setSources((s) => {
      const next = { ...s };
      for (const k of Object.keys(patch)) if (next[k]) delete next[k];
      return next;
    });
  }

  async function save(): Promise<boolean> {
    setSaving(true);
    try {
      const res = await fetch(`/api/computers/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Erreur');
      setSavedAt(new Date().toISOString());
      if (data.statusHistory) setStatusHistory(data.statusHistory);
      router.refresh();
      return true;
    } catch {
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function extract(opts: { imageId?: string; cropRatio?: number; rawText?: string }, origin: 'ocr' | 'import' = 'ocr') {
    setExtracting(true);
    try {
      const res = await fetch(`/api/computers/${id}/extract`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(opts),
      });
      const data = await res.json();
      if (!res.ok) {
        if (origin === 'import') setImportError(data.error ?? 'Import impossible');
        setExtractions(await fetchFreshExtractions());
        return { ok: false, error: data.error ?? 'Erreur lors de l’extraction' };
      }
      if (origin === 'import') setImportError('');
      const r: ExtractionResult = data;
      setExtraction(r);
      // Application des valeurs détectées (proposées — à confirmer par l'utilisateur).
      const patch: Partial<ComputerFields> = {};
      const nextSources: Record<string, string> = {};
      const sourceKey = data.source === 'OCR' ? 'ocr' : 'import';
      for (const f of r.fields) {
        if (f.value === null || f.value === '') continue;
        switch (f.key) {
          case 'brand':
          case 'model':
          case 'processor':
          case 'screen_resolution':
          case 'graphics':
          case 'keyboard':
          case 'warranty':
            if (typeof f.value === 'string') {
              patch[f.key as keyof ComputerFields] = f.value as never;
              nextSources[f.key] = sourceKey;
            }
            break;
          case 'ram_gb':
          case 'storage_capacity_gb':
          case 'price_amount': {
            const n = parseInt(f.value as string, 10);
            if (Number.isFinite(n) && n > 0) {
              patch[f.key as keyof ComputerFields] = n as never;
              nextSources[f.key] = sourceKey;
            }
            break;
          }
          case 'storage_type':
            if (['SSD', 'HDD', 'NVMe', 'eMMC', 'autre'].includes(f.value as string)) {
              patch.storage_type = f.value as StorageType;
              nextSources[f.key] = sourceKey;
            }
            break;
          case 'screen_size': {
            const n = parseFloat(f.value as string);
            if (Number.isFinite(n) && n > 0) {
              patch.screen_size = n;
              nextSources[f.key] = sourceKey;
            }
            break;
          }
          case 'ports':
          case 'accessories':
            if (Array.isArray(f.value)) {
              patch[f.key as keyof ComputerFields] = f.value as never;
              nextSources[f.key] = sourceKey;
            }
            break;
          case 'battery':
            if (typeof f.value === 'string') {
              patch.battery_note = f.value; // formulation conservée telle quelle
              nextSources[f.key] = sourceKey;
            }
            break;
          case 'condition':
            if (typeof f.value === 'string' && ['neuf', 'tres_bon', 'bon', 'correct', 'a_reparer'].includes(f.value)) {
              patch.condition = f.value as Condition;
              nextSources[f.key] = sourceKey;
            }
            break;
          case 'status':
            if (typeof f.value === 'string' && ['available', 'reserved', 'sold', 'archived'].includes(f.value)) {
              patch.status = f.value as import('@/lib/types').PcStatus;
              nextSources[f.key] = sourceKey;
            }
            break;
          case 'currency':
            if (typeof f.value === 'string' && f.value.trim()) {
              patch.currency = f.value.trim();
              nextSources[f.key] = sourceKey;
            }
            break;
        }
      }
      setForm((f) => ({ ...f, ...patch }));
      setSources(nextSources);
      setSavedAt(null);
      setExtractions(await fetchFreshExtractions());
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : 'Erreur' };
    } finally {
      setExtracting(false);
    }
  }

  async function fetchFreshExtractions(): Promise<ExtractionRow[]> {
    try {
      const res = await fetch(`/api/computers/${id}`, { cache: 'no-store' });
      const data = await res.json();
      return (data.extractions ?? []) as ExtractionRow[];
    } catch {
      return extractions;
    }
  }

  async function generate(formats: Format[], templateId?: string) {
    setGenerating(true);
    try {
      const ok = await save();
      if (!ok) {
        setResult(null);
        return { ok: false, error: 'Enregistrement impossible avant génération' };
      }
      const res = await fetch(`/api/computers/${id}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ formats, templateId }),
      });
      const data = await res.json();
      if (!res.ok) {
        return { ok: false, error: data.error ?? 'Erreur de génération', missing: data.missing };
      }
      setResult(data as GenerationResult);
      // Recharge les générations complètes (avec snapshots) pour la galerie.
      try {
        const fresh = await fetch(`/api/computers/${id}`, { cache: 'no-store' });
        const fd = await fresh.json();
        if (fresh.ok) {
          setGenerations(fd.generations ?? []);
          setPublications(fd.publications ?? publications);
          setExtractions(fd.extractions ?? extractions);
        }
      } catch {
        /* noop */
      }
      router.refresh();
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : 'Erreur' };
    } finally {
      setGenerating(false);
    }
  }

  async function declare(platform: Platform, publishedAt: string, link: string | null, text: string) {
    try {
      const res = await fetch('/api/publications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          computerId: id,
          generationId: result?.generated[0]?.id ?? null,
          platform,
          publishedAt,
          link,
          textFinal: text,
        }),
      });
      const data = await res.json();
      if (!res.ok) return { ok: false, error: data.error ?? 'Erreur' };
      const fresh = await fetch(`/api/computers/${id}`, { cache: 'no-store' });
      const fd = await fresh.json();
      setPublications(fd.publications);
      router.refresh();
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : 'Erreur' };
    }
  }

  async function quickStatus(status: PcStatus) {
    const res = await fetch(`/api/computers/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    const data = await res.json();
    if (res.ok) {
      setForm((f) => ({ ...f, status }));
      setStatusHistory(data.statusHistory ?? statusHistory);
      router.refresh();
    }
  }

  async function deleteProduct(): Promise<void> {
    await fetch(`/api/computers/${id}`, { method: 'DELETE' });
  }

  const title = [form.brand, form.model].filter(Boolean).join(' ') || 'Nouveau produit';

  const handleImport = (rawText: string) => extract({ rawText }, 'import');

  return (
    <main className="min-h-screen">
      <Nav />
      <div className="mx-auto max-w-5xl space-y-5 px-4 py-6">
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/" className="text-sm text-slate-500 hover:text-slate-800">← Stock</Link>
          <h1 className="text-xl font-bold">{title}</h1>
          <StatusBadge status={form.status} />
          <span className="ml-auto text-xs text-slate-400">
            {saving ? 'Enregistrement…' : savedAt ? `Enregistré ${new Date(savedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}` : 'Non enregistré'}
          </span>
          <button onClick={() => void save()} disabled={saving} className="btn-primary !py-1.5">
            💾 Enregistrer la fiche
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {(Object.keys(STATUS_LABELS) as PcStatus[]).map((s) => (
            <button
              key={s}
              onClick={() => void quickStatus(s)}
              className={`chip cursor-pointer border transition ${
                form.status === s
                  ? 'border-blue-700 bg-blue-700 text-white'
                  : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
              }`}
            >
              {STATUS_LABELS[s]}
            </button>
          ))}
        </div>

        <ImportSection
          extracting={extracting}
          error={importError}
          detected={
            extraction
              ? {
                  source: extraction.source ?? (extraction.provider === 'tesseract' ? 'OCR' : 'texte'),
                  provider: extraction.provider,
                  fields: extraction.fields,
                  rawText: extraction.rawText,
                }
              : null
          }
          onImport={handleImport}
        />

        <PhotoSection
          computerId={id}
          images={images}
          onImagesChange={setImages}
          extracting={extracting}
          extract={(opts) => extract(opts, 'ocr')}
        />

        <SpecForm value={form} sources={sources} onChange={setField} />

        <GeneratePanel
          computerId={id}
          missing={missing}
          texts={texts}
          tick={tick}
        />

        <PreviewGallery
          generations={generations}
          shopName={initial.settings.shop_name}
          logoUrl={initial.settings.logo_file ? '/api/settings/logo' : null}
        />

        <HistorySection
          computerId={id}
          extractions={extractions}
          statusHistory={statusHistory}
          publications={publications}
          onDelete={deleteProduct}
        />
      </div>
    </main>
  );
}
