'use client';

import {
  CONDITION_LABELS, BATTERY_LABELS, STORAGE_TYPES, STATUS_LABELS,
  type BatteryCondition, type Condition, type ComputerFields, type PcStatus, type StorageType,
} from '@/lib/types';

type Props = {
  value: ComputerFields;
  /** Champs dont la valeur vient d'une proposition OCR/IA (à confirmer). */
  sources: Record<string, string>;
  onChange: (patch: Partial<ComputerFields>) => void;
};

function Field({ label, source, hint, children }: { label: string; source?: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="label flex items-center gap-1.5">
        {label}
        {source && (
          <span
            className={`chip !px-1.5 !py-0 ${source === 'ocr' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}
            title="Valeur importée (OCR ou copier-coller) — à confirmer"
          >
            {source === 'ocr' ? 'OCR' : 'IMPORT'}
          </span>
        )}
      </label>
      {children}
      {hint && <p className="mt-1 text-[11px] text-slate-400">{hint}</p>}
    </div>
  );
}

export default function SpecForm({ value, sources, onChange }: Props) {
  const checks = [
    { label: 'Marque', ok: value.brand.trim() !== '' },
    { label: 'Modèle', ok: value.model.trim() !== '' },
    { label: 'Processeur', ok: value.processor.trim() !== '' },
    { label: 'RAM', ok: (value.ram_gb ?? 0) > 0 },
    { label: 'Stockage', ok: (value.storage_capacity_gb ?? 0) > 0 },
    { label: 'État général', ok: !!value.condition },
    { label: 'Prix > 0', ok: (value.price_amount ?? 0) > 0 },
    { label: 'Devise', ok: value.currency.trim() !== '' },
  ];
  const missingCount = checks.filter((c) => !c.ok).length;

  const num = (raw: string): number | null => {
    if (raw === '') return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  };

  return (
    <section className="card p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-semibold">🧾 Caractéristiques & prix</h2>
        <span className={`chip ${missingCount ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
          {missingCount ? `${missingCount} champ(s) manquant(s)` : 'Fiche complète ✅'}
        </span>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-1.5 rounded-lg bg-slate-50 p-3 text-xs sm:grid-cols-4">
        {checks.map((c) => (
          <div key={c.label} className="flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${c.ok ? 'bg-emerald-500' : 'bg-red-400'}`} />
            <span className={c.ok ? 'text-slate-500' : 'font-semibold text-red-600'}>{c.label}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Marque *" source={sources.brand}>
          <input className="input" value={value.brand} onChange={(e) => onChange({ brand: e.target.value })} placeholder="Dell, HP, Lenovo…" />
        </Field>
        <Field label="Modèle *" source={sources.model}>
          <input className="input" value={value.model} onChange={(e) => onChange({ model: e.target.value })} placeholder="Latitude 5420" />
        </Field>
        <Field label="Processeur *" source={sources.processor} hint="Saisissez « Non renseigné » si l’info n’est pas disponible.">
          <input className="input" value={value.processor} onChange={(e) => onChange({ processor: e.target.value })} placeholder="Intel Core i5-1145G7" />
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="RAM (Go) *" source={sources.ram_gb}>
            <input className="input" type="number" min="1" max="128" value={value.ram_gb ?? ''} onChange={(e) => onChange({ ram_gb: num(e.target.value) })} placeholder="16" />
          </Field>
          <Field label="Stockage (Go) *" source={sources.storage_capacity_gb}>
            <input className="input" type="number" min="8" max="16384" value={value.storage_capacity_gb ?? ''} onChange={(e) => onChange({ storage_capacity_gb: num(e.target.value) })} placeholder="512" />
          </Field>
          <Field label="Type" source={sources.storage_type}>
            <select className="input" value={value.storage_type ?? ''} onChange={(e) => onChange({ storage_type: (e.target.value || null) as StorageType | null })}>
              <option value="">—</option>
              {STORAGE_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Écran (pouces)" source={sources.screen_size}>
            <input className="input" type="number" step="0.5" min="8" max="24" value={value.screen_size ?? ''} onChange={(e) => onChange({ screen_size: num(e.target.value) })} placeholder="14" />
          </Field>
          <Field label="Résolution / Type d'écran" source={sources.screen_resolution}>
            <input className="input" value={value.screen_resolution ?? ''} onChange={(e) => onChange({ screen_resolution: e.target.value || null })} placeholder="Full HD Tactile x360" />
            <div className="mt-1.5 flex items-center gap-3 select-none text-xs">
              <label className="flex items-center gap-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={/tactil|touch/i.test(value.screen_resolution || '')}
                  onChange={(e) => {
                    let res = value.screen_resolution || '';
                    if (e.target.checked) {
                      if (!/tactil|touch/i.test(res)) res = res ? `${res} Tactile` : 'Tactile';
                    } else {
                      res = res.replace(/\s*tactile/gi, '').replace(/\s*touchscreen/gi, '').replace(/\s*touch/gi, '').trim();
                    }
                    onChange({ screen_resolution: res || null });
                  }}
                  className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600"
                />
                <span className="font-semibold text-slate-700 dark:text-slate-300">🖐️ Tactile</span>
              </label>
              <label className="flex items-center gap-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={/360|x360/i.test(value.screen_resolution || '')}
                  onChange={(e) => {
                    let res = value.screen_resolution || '';
                    if (e.target.checked) {
                      if (!/360|x360/i.test(res)) res = res ? `${res} x360` : 'x360';
                    } else {
                      res = res.replace(/\s*x360/gi, '').replace(/\s*360°/gi, '').replace(/\s*360/gi, '').trim();
                    }
                    onChange({ screen_resolution: res || null });
                  }}
                  className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600"
                />
                <span className="font-semibold text-slate-700 dark:text-slate-300">🔄 x360°</span>
              </label>
            </div>
          </Field>
        </div>
        <Field label="Carte graphique" source={sources.graphics} hint="À n’inventer jamais — laisser vide si inconnu.">
          <input className="input" value={value.graphics ?? ''} onChange={(e) => onChange({ graphics: e.target.value || null })} placeholder="Intel Iris Xe" />
        </Field>
        <Field label="Clavier" source={sources.keyboard}>
          <input className="input" value={value.keyboard ?? ''} onChange={(e) => onChange({ keyboard: e.target.value || null })} placeholder="AZERTY rétroéclairé" />
        </Field>
        <Field label="Ports" source={sources.ports} hint="Séparés par des virgules.">
          <input className="input" value={value.ports.join(', ')} onChange={(e) => onChange({ ports: e.target.value.split(/[,;+]/).map((s) => s.trim()).filter(Boolean) })} placeholder="USB, RJ45, HDMI, USB-C" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="État batterie">
            <select className="input" value={value.battery_condition} onChange={(e) => onChange({ battery_condition: e.target.value as BatteryCondition })}>
              {Object.entries(BATTERY_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </Field>
          <Field label="Note batterie" source={sources.battery} hint="Formulation conservée telle quelle.">
            <input className="input" value={value.battery_note ?? ''} onChange={(e) => onChange({ battery_note: e.target.value || null })} placeholder="« Autonomie résistante »" />
          </Field>
        </div>
        <Field label="Garantie" source={sources.warranty}>
          <input className="input" value={value.warranty ?? ''} onChange={(e) => onChange({ warranty: e.target.value || null })} placeholder="3 mois" />
        </Field>
        <Field label="Accessoires" source={sources.accessories} hint="Séparés par des virgules.">
          <input className="input" value={value.accessories.join(', ')} onChange={(e) => onChange({ accessories: e.target.value.split(/[,;+]/).map((s) => s.trim()).filter(Boolean) })} placeholder="Sac, chargeur, souris" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Prix *" source={sources.price_amount} hint="Toujours confirmé par vous.">
            <input className="input" type="number" min="1" value={value.price_amount ?? ''} onChange={(e) => onChange({ price_amount: num(e.target.value) })} placeholder="250000" />
          </Field>
          <Field label="Devise *">
            <input className="input" value={value.currency} onChange={(e) => onChange({ currency: e.target.value })} placeholder="FCFA" />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="État général *">
            <select className="input" value={value.condition} onChange={(e) => onChange({ condition: e.target.value as Condition })}>
              {Object.entries(CONDITION_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </Field>
          <Field label="Statut">
            <select className="input" value={value.status} onChange={(e) => onChange({ status: e.target.value as PcStatus })}>
              {Object.entries(STATUS_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="Notes internes">
            <textarea className="input min-h-20" value={value.notes} onChange={(e) => onChange({ notes: e.target.value })} placeholder="Observations (non affichées sur les visuels)" />
          </Field>
        </div>
      </div>
    </section>
  );
}
