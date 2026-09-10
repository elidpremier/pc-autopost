// Format standard d'import PC AutoPost (zéro saisie manuelle).
// Le vendeur copie-colle soit le TEXTE STANDARD, soit le JSON STANDARD :
// toutes les caractéristiques sont extraites d'un coup, sans ressaisie.

import type { Condition, ExtractedField, PcStatus, StorageType } from '../types';
import { mapCondition, mapStatus, parseSpecText } from './spec-parser';

export const STANDARD_TEXT_TEMPLATE = `MARQUE : Dell
MODELE : Latitude 5420
PROCESSEUR : Intel Core i5-1145G7
RAM : 16 Go
STOCKAGE : 512 Go SSD
ECRAN : 14 pouces Full HD
GRAPHIQUE : Intel Iris Xe
CLAVIER : AZERTY rétroéclairé
PORTS : USB, RJ45, HDMI, USB-C
BATTERIE : autonomie résistante
ACCESSOIRES : sac, chargeur, souris
GARANTIE : 3 mois
PRIX : 250000 FCFA
ETAT : Bon état
STATUT : Disponible`;

export const STANDARD_JSON_TEMPLATE = `{
  "marque": "Dell",
  "modele": "Latitude 5420",
  "processeur": "Intel Core i5-1145G7",
  "ram_go": 16,
  "stockage": { "go": 512, "type": "SSD" },
  "ecran": { "pouces": 14, "resolution": "Full HD" },
  "graphique": "Intel Iris Xe",
  "clavier": "AZERTY rétroéclairé",
  "ports": ["USB", "RJ45", "HDMI", "USB-C"],
  "batterie": "autonomie résistante",
  "accessoires": ["sac", "chargeur", "souris"],
  "garantie": "3 mois",
  "prix": 250000,
  "devise": "FCFA",
  "etat": "Bon état",
  "statut": "Disponible"
}`;

export type StandardParseResult = {
  fields: ExtractedField[];
  structured: Record<string, unknown>;
  confidence: Record<string, number>;
  provider: 'standard_json' | 'manual_text' | 'llm';
  source: string;
};

export function looksLikeJson(s: string): boolean {
  const t = s.trim();
  return t.startsWith('{') && t.endsWith('}');
}

function toStr(v: unknown): string {
  return v === null || v === undefined ? '' : String(v).trim();
}

function toNum(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const m = String(v).match(/-?\d+(?:[.,]\d+)?/);
  return m ? parseFloat(m[0].replace(',', '.')) : null;
}

function toList(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(toStr).filter(Boolean);
  const s = toStr(v);
  if (!s) return [];
  return s
    .split(/[,;+•]/)
    .map((x) => x.trim())
    .filter(Boolean);
}

function normType(s: string): StorageType | null {
  if (/nvme/i.test(s)) return 'NVMe';
  if (/ssd/i.test(s)) return 'SSD';
  if (/hdd|disque dur/i.test(s)) return 'HDD';
  if (/emmc/i.test(s)) return 'eMMC';
  return null;
}

function parseStorage(v: unknown): { go: number | null; type: StorageType | null } {
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    return { go: toNum(o.go ?? o.capacity ?? o.capacity_gb ?? o.capacite), type: normType(toStr(o.type)) };
  }
  const s = toStr(v);
  return { go: toNum(s), type: normType(s) };
}

function parseScreen(v: unknown): { pouces: number | null; resolution: string | null } {
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    return { pouces: toNum(o.pouces ?? o.size ?? o.taille), resolution: toStr(o.resolution) || null };
  }
  const s = toStr(v);
  const pouces = toNum(s.match(/(\d{1,2}(?:[.,]\d)?)\s*(?:pouces?|pols?|inch| pouces)/i)?.[1]);
  let resolution: string | null = null;
  if (/full\s?hd|fhd|1080p/i.test(s)) resolution = 'Full HD';
  else if (/wqhd/i.test(s)) resolution = 'WQHD';
  else if (/qhd|1440/i.test(s)) resolution = 'QHD';
  else {
    const r = s.match(/(Full HD|WQHD|QHD|HD)/i);
    if (r) resolution = r[1];
  }
  return { pouces, resolution };
}

function fieldsToMeta(fields: ExtractedField[]): { structured: Record<string, unknown>; confidence: Record<string, number> } {
  const structured: Record<string, unknown> = {};
  const confidence: Record<string, number> = {};
  for (const f of fields) {
    structured[f.key] = f.value;
    confidence[f.key] = f.confidence;
  }
  return { structured, confidence };
}

/** Branche JSON : clé explicite, confiance 1.0 (donnée saisie par le vendeur). */
function parseJsonStandard(t: string, defaultCurrency: string): StandardParseResult {
  let obj: Record<string, unknown>;
  try {
    obj = JSON.parse(t);
  } catch (e) {
    throw new Error(`JSON invalide : ${e instanceof Error ? e.message : 'erreur de syntaxe'}`);
  }
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
    throw new Error('Le JSON doit être un objet avec les clés du format standard.');
  }
  const get = (...keys: string[]): unknown => {
    for (const k of keys) {
      if (obj[k] !== undefined && obj[k] !== null && obj[k] !== '') return obj[k];
    }
    return undefined;
  };

  const fields: ExtractedField[] = [];
  const add = (key: string, label: string, value: string | number | string[] | null) => {
    if (value === null || value === undefined || value === '' || (Array.isArray(value) && value.length === 0)) return;
    fields.push({ key, label, value, confidence: 1 });
  };

  const storage = parseStorage(get('stockage', 'storage'));
  const screen = parseScreen(get('ecran', 'ecran_pouces', 'screen'));
  const conditionRaw = toStr(get('etat', 'etat_general', 'condition'));
  const statusRaw = toStr(get('statut', 'status'));
  const condition = mapCondition(conditionRaw);
  const status = mapStatus(statusRaw);

  add('brand', 'Marque', toStr(get('marque', 'brand')) || null);
  add('model', 'Modèle', toStr(get('modele', 'mode', 'model')) || null);
  add('processor', 'Processeur', toStr(get('processeur', 'processor', 'cpu')) || null);
  add('ram_gb', 'RAM (Go)', toNum(get('ram_go', 'ram', 'ram_gb', 'ramGb')));
  add('storage_capacity_gb', 'Stockage (Go)', storage.go);
  add('storage_type', 'Type de stockage', storage.type);
  add('screen_size', 'Écran (pouces)', screen.pouces);
  add('screen_resolution', 'Résolution', screen.resolution);
  add('graphics', 'Carte graphique', toStr(get('graphique', 'graphics', 'gpu')) || null);
  add('keyboard', 'Clavier', toStr(get('clavier', 'keyboard')) || null);
  add('ports', 'Ports', toList(get('ports')));
  add('battery', 'Batterie', toStr(get('batterie', 'battery', 'autonomie')) || null);
  add('accessories', 'Accessoires', toList(get('accessoires', 'accessories')));
  add('warranty', 'Garantie', toStr(get('garantie', 'warranty')) || null);
  add('price_amount', 'Prix', toNum(get('prix', 'price', 'prix_amount')));
  add('condition', 'État général', condition);
  add('status', 'Statut', status);
  add('currency', 'Devise', toStr(get('devise', 'currency')) || defaultCurrency);

  const { structured, confidence } = fieldsToMeta(fields);
  if (conditionRaw && !condition) {
    (structured as Record<string, unknown>).condition_note = conditionRaw;
  }
  if (statusRaw && !status) {
    (structured as Record<string, unknown>).status_note = statusRaw;
  }
  return { fields, structured, confidence, provider: 'standard_json', source: 'JSON standard' };
}

/**
 * Point d'entrée de l'import : détecte JSON vs texte.
 * Le texte passe par le parseur (labels standards + tolérance OCR/libre).
 */
export function parseStandardInput(raw: string, defaultCurrency: string, provider: 'manual_text' | 'llm' = 'manual_text'): StandardParseResult {
  const t = raw.trim();
  if (!t) throw new Error('Aucun texte à importer.');
  if (looksLikeJson(t)) return parseJsonStandard(t, defaultCurrency);
  const r = parseSpecText(t, defaultCurrency);
  return { ...r, provider, source: provider === 'llm' ? 'IA' : 'texte standard' };
}
