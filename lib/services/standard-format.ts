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

export function normalizeProcessor(raw: string): string {
  let s = raw.trim();
  if (!s) return '';

  // Nettoyage des mentions de marque déposée et CPU résiduel (ex: "Intel(R) Core(TM) i5-8350U CPU")
  s = s.replace(/intel\s*\((?:r|tm)\)\s*/gi, 'Intel ').replace(/core\s*\((?:r|tm)\)\s*/gi, 'Core ');
  s = s.replace(/\bcpu\b/gi, '');

  // Supprime les fréquences d'horloge (@ 2.40GHz, @ 1.80 GHz, 2.4 GHz, etc.)
  s = s.replace(/@\s*\d+(?:[.,]\d+)?\s*[gm]hz/gi, '');
  s = s.replace(/\b\d+(?:[.,]\d+)?\s*[gm]hz\b/gi, '');

  // Détection des cœurs et threads s'ils sont présents dans la chaîne
  let coresInfo = '';
  const coresThreadsMatch = s.match(/(?:(?:avec\s+)?\(?\s*(\d+)\s*(?:c(?:oe|œ|o)urs?|cores?)\s*(?:et|,|\/)?\s*(\d+)\s*(?:threads?|processeurs?\s*logiques?)\s*\)?)/i);
  if (coresThreadsMatch) {
    coresInfo = `(${coresThreadsMatch[1]} coeurs, ${coresThreadsMatch[2]} threads)`;
    s = s.slice(0, coresThreadsMatch.index) + s.slice((coresThreadsMatch.index ?? 0) + coresThreadsMatch[0].length);
  } else {
    const coresOnlyMatch = s.match(/(?:(?:avec\s+)?\(?\s*(\d+)\s*(?:c(?:oe|œ|o)urs?|cores?)\s*\)?)/i);
    if (coresOnlyMatch) {
      coresInfo = `(${coresOnlyMatch[1]} coeurs)`;
      s = s.slice(0, coresOnlyMatch.index) + s.slice((coresOnlyMatch.index ?? 0) + coresOnlyMatch[0].length);
    }
  }

  // Nettoyage des parenthèses vides ou résiduelles et espaces multiples
  s = s.replace(/\(\s*\)/g, '').replace(/\s+/g, ' ').trim();

  // Uniformisation des formats de génération abrégés :
  // "Intel Core i7 11th Gen" / "Core i7 11eme generation" / "i7 11th" -> "i7-11th"
  const genIntelMatch = s.match(/(?:intel\s+)?(?:core\s+)?i([3-9])\s*[-_ ]?\s*(\d{1,2})(?:e|ème|eme|th|er|st|nd|rd)?\s*(?:g[ée]n(?:[ée]ration)?|gen(?:eration)?)?/i);
  // Vérifie qu'il ne s'agit pas d'un numéro de modèle 4 chiffres comme i7-1165G7
  if (genIntelMatch) {
    const family = genIntelMatch[1];
    const gen = genIntelMatch[2];
    // Si la chaîne ne contient pas un modèle plus précis (3 ou 4 chiffres + suffixe)
    const exactModelMatch = s.match(/i[3-9]\s*[-_ ]?\s*(\d{3,5}\w*)/i);
    if (!exactModelMatch) {
      s = `i${family}-${gen}th`;
    }
  }

  // Si on a extrait des cœurs/threads et qu'ils ne sont pas déjà dans la chaîne finale
  if (coresInfo && !s.includes(coresInfo)) {
    s = `${s} ${coresInfo}`.trim();
  }

  return s;
}

export function normalizeGraphics(raw: string): string {
  let s = raw.trim();
  if (!s) return '';

  // Nettoyage des marques déposées et mentions parasites
  s = s.replace(/\((?:r|tm)\)/gi, '');
  s = s.replace(/\b(?:laptop|mobile)?\s*gpu\b/gi, '');
  s = s.replace(/\b(?:graphics\s+)?(?:controller|display\s+adapter|family)\b/gi, '');
  s = s.replace(/\bwith\s+max-?q\s+design\b/gi, 'Max-Q');
  s = s.replace(/\s+/g, ' ').trim();

  // Extraction VRAM (ex: "4GB", "4 Go", "4Go", "4 GB GDDR6", "4G", "(4 Go)")
  // Éviter de confondre "8 Graphics" avec "8 G"
  let vram = '';
  const vramMatch = s.match(/(?:\(?\s*(\d{1,2})\s*(?:go|gb|gddr\d|g(?![a-z]))\s*(?:gddr\d)?\s*\)?)/i);
  if (vramMatch && !/(?:rtx|gtx|mx|rx)\s*\d+/i.test(vramMatch[0])) {
    vram = `${vramMatch[1]} Go`;
    s = s.replace(vramMatch[0], ' ').replace(/\s+/g, ' ').trim();
  }

  const isMaxQ = /\bmax-?q\b/i.test(s);
  s = s.replace(/\bmax-?q\b/gi, '').trim();

  // Intel
  if (/iris\s*xe/i.test(s)) {
    s = 'Intel Iris Xe';
  } else if (/iris\s*plus/i.test(s)) {
    s = 'Intel Iris Plus';
  } else if (/uhd\s*graphics/i.test(s) || /\buhd\b/i.test(s)) {
    const model = s.match(/uhd(?:\s*graphics)?\s*(\d{3,4})?/i);
    s = model && model[1] ? `Intel UHD Graphics ${model[1]}` : 'Intel UHD Graphics';
  } else if (/hd\s*graphics/i.test(s) || (/\bhd\b/i.test(s) && /intel/i.test(s))) {
    const model = s.match(/hd(?:\s*graphics)?\s*(\d{3,4})?/i);
    s = model && model[1] ? `Intel HD Graphics ${model[1]}` : 'Intel HD Graphics';
  } else if (/intel\s*graphics/i.test(s)) {
    s = 'Intel Graphics';
  } else if (/arc\s*(a\d{3}\w*)/i.test(s)) {
    const arcMatch = s.match(/arc\s*(a\d{3}\w*)/i);
    s = `Intel Arc ${arcMatch![1].toUpperCase()}`;
  }
  // NVIDIA
  else if (/rtx\s*(\d{3,4}\w*)/i.test(s)) {
    const rtxMatch = s.match(/rtx\s*(\d{3,4}(?:\s*ti)?)/i);
    const modelStr = rtxMatch ? rtxMatch[1].toUpperCase().replace(/TI\b/, 'Ti') : '';
    s = `NVIDIA GeForce RTX ${modelStr}`.trim();
  } else if (/gtx\s*(\d{3,4}\w*)/i.test(s)) {
    const gtxMatch = s.match(/gtx\s*(\d{3,4}(?:\s*ti)?)/i);
    const modelStr = gtxMatch ? gtxMatch[1].toUpperCase().replace(/TI\b/, 'Ti') : '';
    s = `NVIDIA GeForce GTX ${modelStr}`.trim();
  } else if (/geforce\s*mx\s*(\d{3})/i.test(s) || /\bmx\s*(\d{3})/i.test(s)) {
    const mxMatch = s.match(/mx\s*(\d{3})/i);
    s = `NVIDIA GeForce MX${mxMatch ? mxMatch[1] : ''}`;
  } else if (/quadro\s*(\w+)/i.test(s)) {
    const qMatch = s.match(/quadro\s*(\w+)/i);
    s = `NVIDIA Quadro ${qMatch ? qMatch[1].toUpperCase() : ''}`;
  } else if (/nvidia|geforce/i.test(s)) {
    const clean = s.replace(/nvidia\s*/gi, '').replace(/geforce\s*/gi, '').trim();
    s = clean ? `NVIDIA GeForce ${clean}` : 'NVIDIA GeForce';
  }
  // AMD
  else if (/vega\s*(\d+)/i.test(s)) {
    const vMatch = s.match(/vega\s*(\d+)/i);
    s = `AMD Radeon Vega ${vMatch ? vMatch[1] : ''}`.trim();
  } else if (/rx\s*(\d{4}\w*)/i.test(s)) {
    const rxMatch = s.match(/rx\s*(\d{4}\w*)/i);
    s = `AMD Radeon RX ${rxMatch ? rxMatch[1].toUpperCase() : ''}`.trim();
  } else if (/amd|radeon/i.test(s)) {
    s = 'AMD Radeon Graphics';
  }
  // Apple Silicon
  else if (/apple\s*m\d/i.test(s) || /\bm[1234]\s*(?:pro|max|ultra)?\b/i.test(s)) {
    const mMatch = s.match(/m[1234](?:\s*(?:pro|max|ultra))?/i);
    s = `Apple ${mMatch ? mMatch[0].toUpperCase() : 'M'} GPU`;
  }

  if (isMaxQ && !s.includes('Max-Q')) {
    s = `${s} Max-Q`;
  }

  s = s.replace(/\s+/g, ' ').trim();

  // Ajouter VRAM si présente
  if (vram && !s.includes(vram)) {
    s = `${s} (${vram})`;
  }

  return s;
}

function normType(s: string): StorageType | null {
  if (/nvme/i.test(s)) return 'NVMe';
  if (/ssd/i.test(s)) return 'SSD';
  if (/hdd|disque dur/i.test(s)) return 'HDD';
  if (/emmc/i.test(s)) return 'eMMC';
  return null;
}

function parseStorage(v: unknown, rootObj?: Record<string, unknown>): { go: number | null; type: StorageType | null } {
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    return { go: toNum(o.go ?? o.capacity ?? o.capacity_gb ?? o.capacite ?? o.storage_capacity_gb), type: normType(toStr(o.type)) };
  }
  const s = toStr(v);
  let go = toNum(s);
  let type = normType(s);

  if (rootObj) {
    if (go === null) {
      go = toNum(rootObj.storage_capacity_gb ?? rootObj.capacite ?? rootObj.cap_gb);
    }
    if (!type) {
      type = normType(toStr(rootObj.storage_type ?? rootObj.type_stockage));
    }
  }

  return { go, type };
}

function parseScreen(v: unknown, rootObj?: Record<string, unknown>): { pouces: number | null; resolution: string | null } {
  let pouces: number | null = null;
  let resolution: string | null = null;
  let isTouch = false;

  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    pouces = toNum(o.pouces ?? o.size ?? o.taille ?? o.screen_size);
    resolution = toStr(o.resolution ?? o.screen_resolution) || null;
    isTouch = Boolean(o.tactile || o.touch || o.is_touchscreen);
  } else {
    const s = toStr(v);
    pouces = toNum(s.match(/(\d{1,2}(?:[.,]\d)?)\s*(?:pouces?|pols?|inch|"|\bP\b)/i)?.[1]) || toNum(v);
    if (/full\s?hd|fhd|1080p/i.test(s)) resolution = 'Full HD';
    else if (/4k|uhd\s*4k/i.test(s)) resolution = '4K UHD';
    else if (/wqhd/i.test(s)) resolution = 'WQHD';
    else if (/qhd|1440/i.test(s)) resolution = 'QHD';
    else {
      const r = s.match(/(Full HD|4K UHD|4K|WQHD|QHD|HD)/i);
      if (r) resolution = r[1];
    }
    isTouch = /tactil|touch/i.test(s);
  }

  if (rootObj) {
    if (pouces === null) {
      pouces = toNum(rootObj.screen_size ?? rootObj.ecran_pouces ?? rootObj.pouces);
    }
    if (!resolution) {
      resolution = toStr(rootObj.screen_resolution ?? rootObj.resolution) || null;
    }
    if (!isTouch) {
      isTouch = Boolean(rootObj.tactile || rootObj.touch || rootObj.is_touchscreen || (rootObj.notes && /tactil|touch/i.test(String(rootObj.notes))));
    }
  }

  const rawStr = `${toStr(v)} ${rootObj ? JSON.stringify(rootObj) : ''}`;
  const isX360 = /x360|360°|360\b|convertible|pliable|2-en-1|2 in 1/i.test(rawStr);

  if (isTouch) {
    if (resolution && !/tactil|touch/i.test(resolution)) {
      resolution = `${resolution} Tactile`;
    } else if (!resolution) {
      resolution = 'Tactile';
    }
  }

  if (isX360) {
    if (resolution && !/360|x360/i.test(resolution)) {
      resolution = `${resolution} x360`;
    } else if (!resolution) {
      resolution = 'x360';
    }
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

  const storage = parseStorage(get('stockage', 'storage'), obj);
  const screen = parseScreen(get('ecran', 'ecran_pouces', 'screen'), obj);
  const conditionRaw = toStr(get('etat', 'etat_general', 'condition'));
  const statusRaw = toStr(get('statut', 'status'));
  const condition = mapCondition(conditionRaw);
  const status = mapStatus(statusRaw);

  add('brand', 'Marque', toStr(get('marque', 'brand')) || null);
  add('model', 'Modèle', toStr(get('modele', 'mode', 'model')) || null);
  const rawProcessor = toStr(get('processeur', 'processor', 'cpu'));
  add('processor', 'Processeur', rawProcessor ? normalizeProcessor(rawProcessor) : null);
  add('ram_gb', 'RAM (Go)', toNum(get('ram_go', 'ram', 'ram_gb', 'ramGb')));
  add('storage_capacity_gb', 'Stockage (Go)', storage.go);
  add('storage_type', 'Type de stockage', storage.type);
  add('screen_size', 'Écran (pouces)', screen.pouces);
  add('screen_resolution', 'Résolution', screen.resolution);
  const rawGraphics = toStr(get('graphique', 'graphics', 'gpu'));
  add('graphics', 'Carte graphique', rawGraphics ? normalizeGraphics(rawGraphics) : null);
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
  if (typeof r.structured.processor === 'string') {
    r.structured.processor = normalizeProcessor(r.structured.processor);
  }
  if (typeof r.structured.graphics === 'string') {
    r.structured.graphics = normalizeGraphics(r.structured.graphics);
  }
  for (const f of r.fields) {
    if (f.key === 'processor' && typeof f.value === 'string') {
      f.value = normalizeProcessor(f.value);
    }
    if (f.key === 'graphics' && typeof f.value === 'string') {
      f.value = normalizeGraphics(f.value);
    }
  }
  return { ...r, provider, source: provider === 'llm' ? 'IA' : 'texte standard' };
}
