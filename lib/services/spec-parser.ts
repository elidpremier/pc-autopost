import type { Condition, ExtractedField, PcStatus, StorageType } from '../types';

/* Mappages texte libre → valeurs contrôlées (partagés avec le format standard). */
export const CONDITION_MAP: [RegExp, Condition][] = [
  [/neuf/i, 'neuf'],
  [/très?\s?bon|tres\s?bon|very\s?good/i, 'tres_bon'],
  [/bon\s?état|bon\s?etat|good/i, 'bon'],
  [/état\s?correct|etat\s?correct|\bcorrect\b|usable|moyen|fair/i, 'correct'],
  [/à\s?réparer|a\s?reparer|reparation|broken|defect/i, 'a_reparer'],
];

export const STATUS_MAP: [RegExp, PcStatus][] = [
  [/disponible|available|\blibre\b|en\s?vente/i, 'available'],
  [/réserv|reserv|reserved/i, 'reserved'],
  [/vendu|sold/i, 'sold'],
  [/archiv|archive/i, 'archived'],
];

export function mapCondition(raw: string): Condition | null {
  const s = raw.trim();
  if (!s) return null;
  for (const [re, value] of CONDITION_MAP) if (re.test(s)) return value;
  return null;
}

export function mapStatus(raw: string): PcStatus | null {
  const s = raw.trim();
  if (!s) return null;
  for (const [re, value] of STATUS_MAP) if (re.test(s)) return value;
  return null;
}

/**
 * Spec-parser : transforme la transcription (OCR ou texte collé) de la zone
 * supérieure de la photo-fiche en champs structurés avec niveau de confiance
 * (spec §22.3). Aucune valeur n'est inventée : ce qui n'est pas détecté reste null.
 */

type Found = { value: string | string[]; confidence: number; note?: string };

const BRANDS: [RegExp, string][] = [
  [/HEWLETT[\s-]*PACKARD/i, 'HP'],
  [/\bHP\b/i, 'HP'],
  [/\bDELL\b/i, 'Dell'],
  [/\bLENOVO\b/i, 'Lenovo'],
  [/\bACER\b/i, 'Acer'],
  [/\bASUS\b/i, 'Asus'],
  [/\bMSI\b/i, 'MSI'],
  [/\bAPPLE\b/i, 'Apple'],
  [/\bSAMSUNG\b/i, 'Samsung'],
  [/\bTOSHIBA\b/i, 'Toshiba'],
  [/\bMICROSOFT\b/i, 'Microsoft'],
  [/\bFUJITSU\b/i, 'Fujitsu'],
  [/\bPACKARD\s*BELL\b/i, 'Packard Bell'],
  [/\bLG\b/i, 'LG'],
];

const MODEL_FAMILIES: [string, RegExp][] = [
  ['Latitude', /LATITUDE[\s-]?([A-Z]?\d{3,4}\w?)/i],
  ['EliteBook', /ELITE\s*BOOK[\s-]?([\w-]+)/i],
  ['ProBook', /PRO\s*BOOK[\s-]?([\w-]+)/i],
  ['ThinkBook', /THINK\s*BOOK[\s-]?([\w-]+)/i],
  ['ThinkPad', /THINK\s*PAD[\s-]?([\w-]+)/i],
  ['Vostro', /VOSTRO[\s-]?([\w-]+)/i],
  ['Inspiron', /INSPIRON[\s-]?([\w-]+)/i],
  ['OptiPlex', /OPTI\s*PLEX[\s-]?([\w-]+)/i],
  ['MacBook', /MAC\s*BOOK[\s-]?(AIR|PRO)[\s-]?(\d{4}\w?)?/i],
  ['Spectre', /SPECTRE[\s-]?([\w-]+)/i],
  ['Pavilion', /PAVILION[\s-]?([\w-]+)/i],
  ['IdeaPad', /IDEA\s*PAD[\s-]?([\w-]+)/i],
  ['Yoga', /YOGA[\s-]?(\w+)/i],
  ['ZenBook', /ZEN\s*BOOK[\s-]?([\w-]+)/i],
  ['VivoBook', /VIVO\s*BOOK[\s-]?([\w-]+)/i],
  ['Chromebook', /CHROME\s*BOOK[\s-]?([\w-]+)/i],
  ['TUF Gaming', /TUF[\s-]?GAMING[\s-]?([\w-]+)/i],
  ['ROG', /ROG[\s-]?([\w-]+)/i],
  ['Precision', /PRECISION[\s-]?([\w-]+)/i],
  ['ZBook', /Z\s*BOOK[\s-]?([\w-]+)/i],
  ['XPS', /XPS[\s-]?(\d{2,3})/i],
  ['Envy', /ENVY[\s-]?([\w-]+)/i],
  ['Victus', /VICTUS[\s-]?([\w-]+)/i],
  ['Omen', /OMEN[\s-]?([\w-]+)/i],
  ['Legion', /LEGION[\s-]?([\w-]+)/i],
  ['Surface', /SURFACE[\s-]?(LAPTOP|PRO|BOOK|GO)?[\s-]?(\d+)?/i],
];

const STOPWORDS = new Set([
  'PROCESSEUR', 'PROC', 'RAM', 'STOCKAGE', 'DISQUE', 'ECRAN', 'ÉCRAN', 'GARANTIE',
  'ACCESSOIRES', 'ACCESSOIRE', 'CLAVIER', 'BATTERIE', 'PORTS', 'PRIX', 'MARQUE',
  'MODELE', 'MODÈLE', 'MARCHE', 'OCCASION', 'RECONDITIONNE', 'RECONDITIONNÉ',
]);

function labelValue(text: string, labels: string[]): string | null {
  for (const lab of labels) {
    const re = new RegExp(`${lab}\\s*[:\\-–]?\\s*([^\\n:]{2,80})`, 'i');
    const m = text.match(re);
    if (m && m[1].trim()) return m[1].trim();
  }
  return null;
}

function cleanInline(s: string): string {
  return s.replace(/[|•·]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
}

/** Valide si une chaîne extraite d'une étiquette ressemble bien à un processeur */
function isValidProcessorString(val: string): boolean {
  if (!val || val.trim().length < 2) return false;
  const s = val.toLowerCase();
  const hasCpuKeyword = /(?:intel|core|i[3-9]|ryzen|amd|celeron|pentium|xeon|apple|m[1-4]|npu|snapdragon|athlon)/i.test(s);
  const isPureRamOrStorage = /^\d{1,4}\s*(?:go|gb|ga|g0|mo|mb|ssd|hdd|ram|g\b)/i.test(s.trim());
  return hasCpuKeyword && !isPureRamOrStorage;
}

/** première clause : coupe à la virgule / point-virgule (texte libre). */
function firstClause(s: string): string {
  return s.split(/[,;]/)[0].trim();
}

function parseNumber(s: string): number | null {
  const n = parseInt(s.replace(/[^\d]/g, ''), 10);
  return Number.isFinite(n) ? n : null;
}

export type ParseResult = {
  fields: ExtractedField[];
  structured: Record<string, unknown>;
  confidence: Record<string, number>;
};

export function parseSpecText(raw: string, defaultCurrency: string): ParseResult {
  const text = raw.replace(/\r/g, '');
  const found: Record<string, Found | null> = {};

  /* Marque — priorité à l'étiquette MARQUE : explicite */
  let brand: Found | null = null;
  const marqueLabel = labelValue(text, ['MARQUE']);
  if (marqueLabel) {
    // vérifier si correspond à une marque connue
    const ml = marqueLabel.trim();
    for (const [re, label] of BRANDS) {
      if (re.test(ml)) { brand = { value: label, confidence: 0.95 }; break; }
    }
    if (!brand && ml.length > 0 && ml.length <= 30) {
      brand = { value: ml, confidence: 0.9 };
    }
  }
  if (!brand) {
    for (const [re, label] of BRANDS) {
      const m = text.match(re);
      if (m) { brand = { value: label, confidence: 0.85 }; break; }
    }
  }
  found.brand = brand;

  /* Modèle */
  let model: Found | null = null;
  const labelledModel = labelValue(text, ['MODELE', 'MODÈLE']);
  if (labelledModel) {
    model = { value: cleanInline(labelledModel).slice(0, 60), confidence: 0.85 };
  } else {
    for (const [family, re] of MODEL_FAMILIES) {
      const m = text.toUpperCase().match(re);
      if (m) {
        let mVal = (m[1] || '').trim();
        if (/^(CORE|PROC|CPU|INTEL|AMD)$/i.test(mVal)) mVal = '';
        if (family === 'MacBook') {
          model = { value: `MacBook ${mVal} ${m[2] || ''}`.replace(/\s+/g, ' ').trim(), confidence: 0.8 };
          break;
        }
        model = { value: `${family} ${mVal}`.replace(/\s{2,}/g, ' ').replace(/[-\s]{2,}/g, '-').trim(), confidence: 0.75 };
        break;
      }
    }
  }
  if (!model && brand) {
    const line = text.split('\n').find((l) => l.match(/(HP|DELL|LENOVO|ACER|ASUS|APPLE|MSI)/i));
    if (line) {
      const rest = line
        .replace(/(HEWLETT[\s-]*PACKARD|HP|DELL|LENOVO|ACER|ASUS|APPLE|MSI)/i, '')
        .replace(/\d{2,}/g, '')
        .split(/\s+/)
        .filter((w) => w.length > 1 && !STOPWORDS.has(w.toUpperCase()))
        .slice(0, 4)
        .join(' ');
      if (rest.length > 2) model = { value: rest, confidence: 0.4, note: 'à vérifier' };
    }
  }
  found.model = model;

  /* Texte sans le nom du modèle pour éviter que "1030" ou "5420" soit confondu avec le stockage */
  const modelStr = model?.value ? (Array.isArray(model.value) ? model.value.join(' ') : model.value) : '';
  const textWithoutModel = modelStr
    ? text.replace(new RegExp(modelStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), ' ')
    : text;

  /* Processeur — PRIORITÉ à l'étiquette explicite PROCESSEUR si valide */
  let processor: Found | null = null;
  const procLabelled = labelValue(text, ['PROCESSEUR', 'PROC', 'CPU']);
  if (procLabelled && isValidProcessorString(procLabelled)) {
    // Valeur telle quelle, nettoyée — conserve "i7 13th (4 coeurs, 8 threads)"
    processor = { value: cleanInline(procLabelled).slice(0, 80), confidence: 0.9 };
  } else {
    // 1) Intel Core avec modèle 3-4 chiffres (ex: Core i5-1145G7, i7-8550U)
    const cpuM = text.match(/(intel\s+)?core\s?i([3-9])\s*[-]?\s*(\d{3,4})(\w*)/i);
    // 2) AMD Ryzen avec modèle 2-4 chiffres (ex: Ryzen 5 5500U)
    const ryzM = text.match(/(amd\s+)?ryzen\s?([3-9])\s*[-]?\s*(\d{2,4})(\w*)/i);
    // 3) Apple Silicon (ex: Apple M1 Pro, M2)
    const appleM = text.match(/(apple\s+)?(m[1-4](?:\s+(?:pro|max|ultra))?)/i);
    // 4) Intel / AMD sans modèle 4 chiffres mais avec génération (ex: Core i5 8ème, i7-11th)
    const genOnlyM = text.match(/(?:intel\s+)?(?:core\s+)?i([3-9])\s*[-_ ]?\s*(\d{1,2})(?:e|ème|eme|th|er|st|nd|rd)?\s*(?:g[ée]n(?:[ée]ration)?|gen)?/i);

    if (cpuM) {
      processor = {
        value: `${cpuM[1] ? 'Intel ' : ''}Core i${cpuM[2]}-${cpuM[3]}${cpuM[4]}`.replace('-undefined', ''),
        confidence: 0.85,
      };
    } else if (ryzM) {
      processor = { value: `${ryzM[1] ? 'AMD ' : ''}Ryzen ${ryzM[2]} ${ryzM[3]}${ryzM[4]}`.trim(), confidence: 0.85 };
    } else if (appleM) {
      processor = { value: `Apple ${appleM[2].toUpperCase()}`.trim(), confidence: 0.9 };
    } else if (genOnlyM) {
      processor = { value: `Core i${genOnlyM[1]}-${genOnlyM[2]}th`, confidence: 0.8 };
    } else {
      const bare = text.match(/\bi([3-9])\s*[-]?\s*(\d{3,4})(\w*)/i);
      if (bare) {
        processor = { value: `Core i${bare[1]}-${bare[2]}${bare[3]}`.replace('-undefined', ''), confidence: 0.65, note: 'format court — à confirmer' };
      }
    }
    // Ajout génération si détectée
    const genM = text.match(/(\d{1,2})(?:er|e|ème|eme)\s*g[ée]n/i);
    if (processor && genM) {
      const alreadyMentioned = new RegExp(`${genM[1]}\\s*[eéè]?\\s*g[ée]n|${genM[1]}th`, 'i').test(processor.value as string);
      if (!alreadyMentioned) {
        processor = { ...processor, value: `${processor.value} (${genM[1]}e génération)`, confidence: Math.min(processor.confidence, 0.7) };
      }
    }
  }
  found.processor = processor;

  const coresM = text.match(/(\d)\s*(?:C[OÖ]URS?|CORES)/i);
  found.cores = coresM ? { value: String(coresM[1]), confidence: 0.7 } : null;

  /* RAM — bornes de chiffres et tolérance OCR (Go, Ga, G0, GB, G) */
  let ramGb: number | null = null;
  const ramLabel = labelValue(textWithoutModel, ['RAM', 'MEMOIRE', 'MÉMOIRE']);
  if (ramLabel) {
    const m = ramLabel.match(/(?<!\d)(\d{1,3})(?!\d)\s*(?:GO|GB|GA|G0|G\b|G\/)?/i);
    if (m) ramGb = parseNumber(m[1]);
  }
  if (ramGb === null) {
    const m =
      textWithoutModel.match(/(?<!\d)(\d{1,3})(?!\d)\s*(?:GO|GB|GA|G0|G\b|G\/)?\s*(?:DE\s*)?RAM\b/i) ||
      textWithoutModel.match(/\bRAM\s*(?:DE\s*)?:?\s*(?<!\d)(\d{1,3})(?!\d)\s*(?:GO|GB|GA|G0|G\b)?/i) ||
      textWithoutModel.match(/(?<!\d)(4|8|12|16|24|32|64|128)\s*(?:GO|GB|GA|G0)\b/i);
    if (m) ramGb = parseNumber(m[1]);
  }
  if (ramGb !== null && (ramGb < 1 || ramGb > 256)) ramGb = null;
  found.ram_gb = ramGb !== null ? { value: String(ramGb), confidence: 0.85 } : null;

  /* Stockage — support To/TB, SSD 512, tolérance OCR */
  let cap: number | null = null;
  let stype: StorageType | null = null;
  const stLabelRaw = labelValue(textWithoutModel, ['STOCKAGE', 'DISQUE']);
  const pool = stLabelRaw ? `${stLabelRaw}\n${textWithoutModel}` : textWithoutModel;

  // 1) Terabytes (1 To / 1 TB -> 1024 Go)
  const tbMatch = pool.match(/(\d{1,2})\s*(?:TO|TB)\s*(SSD|HDD|NVME|EMMC)?/i) ||
                  pool.match(/(SSD|HDD|NVME|EMMC)\s*(\d{1,2})\s*(?:TO|TB)/i);
  if (tbMatch) {
    const rawNum = parseNumber(tbMatch[1] || tbMatch[2]);
    if (rawNum) cap = rawNum * 1024;
    const typeStr = (tbMatch[1] && isNaN(Number(tbMatch[1])) ? tbMatch[1] : tbMatch[2]) || '';
    if (typeStr && /SSD|HDD|NVME|EMMC/i.test(typeStr)) stype = typeStr.toUpperCase() as StorageType;
  }

  if (cap === null) {
    // type-avant-capacité : "SSD 512Go", "SSD 512"
    const typeFirst = pool.match(/(SSD|HDD|NVME|EMMC)[^\d]{0,14}(\d{3,4})\s*(?:GO|GB|GA|G0|G\b)?/i);
    // capacité-avant-type : "512Go SSD", "512 SSD", "512Ga SSD"
    const capFirst = pool.match(/(\d{3,4})\s*(?:GO|GB|GA|G0|G\b)?[\s,.-]{0,6}(SSD|HDD|NVME|EMMC)/i);
    const capOnly = pool.match(/(\d{3,4})\s*(?:GO|GB|GA|G0)\b/i);

    if (typeFirst) {
      cap = parseNumber(typeFirst[2]);
      stype = typeFirst[1].toUpperCase() as StorageType;
    } else if (capFirst) {
      cap = parseNumber(capFirst[1]);
      stype = capFirst[2].toUpperCase() as StorageType;
    } else if (capOnly) {
      cap = parseNumber(capOnly[1]);
    }
  }

  // Correction OCR fréquente : ex. 1512Go -> 512Go, 1256Go -> 256Go
  if (cap !== null) {
    if (cap === 1512) cap = 512;
    if (cap === 1256) cap = 256;
    if (cap === 1128) cap = 128;
    if (cap < 32 || cap > 8192) cap = null;
  }
  if (!stype && /SSD|NVME/i.test(pool)) stype = 'SSD';
  else if (!stype && /HDD|DISQUE DURE/i.test(pool)) stype = 'HDD';

  found.storage_capacity_gb = cap !== null ? { value: String(cap), confidence: 0.85 } : null;
  found.storage_type = stype ? { value: stype, confidence: 0.8 } : null;

  /* Écran — priorité à l'étiquette explicite ECRAN : ... */
  let screenSize: number | null = null;
  let resolution: string | null = null;
  const scrLabel = labelValue(text, ['ECRAN', 'ÉCRAN', 'DISPLAY', 'MONITEUR', 'SCREEN']);
  const scrPool = scrLabel ? `${scrLabel}\n${text}` : text;

  // 1) Marqueur explicite : "14 pouces", '14"', "14 inch"
  const scrExplicit = scrPool.match(/(\d{1,2}(?:[.,]\d)?)\s*(?:POUCES?|POLS?|INCH(?:ES)?|")/i);
  // 2) Format collé à "écran" sans espace : "écran14", "ecran14.1"
  const scrInline = text.match(/[ée]cran\s*(\d{1,2}(?:[.,]\d)?)/i);
  // 3) Contexte : nombre entre 10 et 23 entouré de mots liés à l'écran
  const scrContext = text.match(/(?:[ée]cran|screen|display|pouces?|inch)\D{0,10}(\d{1,2}(?:[.,]\d)?)|(\d{1,2}(?:[.,]\d)?)\D{0,10}(?:[ée]cran|screen|display|pouces?|inch)/i);

  for (const m of [scrExplicit, scrInline, scrContext]) {
    if (m) {
      const raw = ((m[1] ?? m[2]) || '').replace(',', '.');
      const val = parseFloat(raw);
      if (val >= 10 && val <= 23) { screenSize = val; break; }
    }
  }
  found.screen_size = screenSize !== null ? { value: String(screenSize), confidence: 0.85 } : null;

  // Résolution : attention, ne pas confondre "HD" dans "HDMI" avec une résolution
  if (/FULL\s?HD|FHD|1920\s*[X×]\s*1080/i.test(scrPool)) resolution = 'Full HD';
  else if (/4K|UHD\s*4K/i.test(scrPool)) resolution = '4K UHD';
  else if (/WQHD|2560\s*[X×]\s*1440/i.test(scrPool)) resolution = 'WQHD';
  else if (/\bQHD\b|1440P/i.test(scrPool)) resolution = 'QHD';
  else {
    // Cherche "HD" uniquement s'il n'est pas collé à MI (HDMI) ou suivi de lettre
    const r = scrPool.match(/\bFull HD\b|\b4K UHD\b|\b4K\b|\bWQHD\b|\bQHD\b|(?<!HD)\bHD\b(?!MI|[A-Z])/i);
    if (r) resolution = r[0].trim();
  }

  // Tactile : chercher dans tout le texte (pas seulement scrPool)
  const isTouchScreen = /tactil|touch/i.test(text);
  if (isTouchScreen) {
    resolution = resolution ? `${resolution} Tactile` : 'Tactile';
  }

  // Pliable / Convertible x360 : chercher x360 / 360° / 360 / convertible / pliable
  const isX360 = /x360|360°|360\b|convertible|pliable|2-en-1|2 in 1/i.test(text);
  if (isX360) {
    if (resolution && !/360|x360/i.test(resolution)) {
      resolution = `${resolution} x360`;
    } else if (!resolution) {
      resolution = 'x360';
    }
  }
  found.screen_resolution = resolution ? { value: resolution, confidence: 0.85 } : null;

  /* Carte graphique — priorité à l'étiquette GRAPHIQUE : */
  let graphics: string | null = null;
  const gfxLabelled = labelValue(text, ['GRAPHIQUE', 'GRAPHICS', 'GPU', 'CARTE GRAPHIQUE', 'NPU', 'ACCELERATEUR IA']);
  if (gfxLabelled) {
    graphics = firstClause(cleanInline(gfxLabelled)).slice(0, 60);
  } else {
    const gfxM =
      text.match(/GEFORCE\s?RTX\s?\d{2,4}\w*(?:\s?\d{1,2}\s?(?:GO|GB|MO|MB))?/i) ||
      text.match(/GEFORCE\s?GTX\s?\d{3,4}\w*(?:\s?\d{1,2}\s?(?:GO|GB|MO|MB))?/i) ||
      text.match(/GTX\s?\d{3,4}\w*(?:\s?\d{1,2}\s?(?:GO|GB|MO|MB))?/i) ||
      text.match(/RTX\s?\d{2,4}\w*(?:\s?\d{1,2}\s?(?:GO|GB|MO|MB))?/i) ||
      text.match(/QUADRO\s?\w+(?:\s?\d{1,2}\s?(?:GO|GB|MO|MB))?/i) ||
      text.match(/RTX\s?A\d{3,4}\w*/i) ||
      text.match(/RADEON\s?RX\s?\d{3,4}\w*(?:\s?\d{1,2}\s?(?:GO|GB|MO|MB))?/i) ||
      text.match(/RADEON\s?(?:PRO|FIREPRO)\s?\w*/i) ||
      text.match(/IRIS\s?(?:XE|PLUS)/i) ||
      text.match(/AMD\s?VEGA\s?\d+/i) ||
      text.match(/RADEON\s?(?:780M|680M|890M|880M|760M|660M)/i) ||
      text.match(/INTEL\s?ARC\s?\w*/i) ||
      text.match(/INTEL\s?AI\s?BOOST/i) ||
      text.match(/INTEL\s?NPU/i) ||
      text.match(/RYZEN\s?AI(?:\s?NPU)?/i) ||
      text.match(/UHD\s?GRAPHICS(?:\s?\d{3,4})?/i) ||
      text.match(/HD\s?GRAPHICS(?:\s?\d{3,4})?/i) ||
      text.match(/INTEL\s?GRAPHICS/i);
    if (gfxM) {
      graphics = gfxM[0].replace(/\s{2,}/g, ' ');
      if (/iris|uhd/i.test(graphics) && !/geforce|rtx|gtx|vega/i.test(graphics)) {
        graphics = graphics.charAt(0).toUpperCase() + graphics.slice(1);
      }
    }
  }
  found.graphics = graphics ? { value: graphics, confidence: 0.75 } : null;

  /* Clavier */
  const kbLabel = labelValue(text, ['CLAVIER']);
  let keyboard: string | null = null;
  if (kbLabel) keyboard = firstClause(cleanInline(kbLabel)).slice(0, 40);
  else if (/(AZERTY|QWERTY)/i.test(text)) {
    keyboard = (text.match(/(AZERTY|QWERTY)/i) as RegExpMatchArray)[1].toUpperCase();
    if (/r[éè]tro[\s-]*?clair/i.test(text)) keyboard += ' rétroéclairé';
  }
  found.keyboard = keyboard ? { value: keyboard, confidence: 0.8 } : null;

  /* Ports */
  const PORT_TOKENS: [string, RegExp][] = [
    ['USB-C', /USB\s?[-_]?C\b|TYPE\s?[-_]?C/i],
    ['USB 3.0', /USB\s?3\b/i],
    ['USB', /\bUSB\b/i],
    ['RJ45', /RJ\s?45|ETHERNET|LAN/i],
    ['HDMI', /\bHDMI\b/i],
    ['VGA', /\bVGA\b/i],
    ['SD', /\bSD\b|CARD\s*READER|LECTEUR\s*SD/i],
    ['Jack 3,5', /JACK|3\s?,?\s?5\s?MM|AUDIO/i],
    ['DisplayPort', /DISPLAY\s?PORT|DP\b/i],
    ['Thunderbolt', /THUNDERBOLT|\bTB\b/i],
  ];
  let ports: string[] = [];
  const portsLabel = labelValue(text, ['PORTS', 'PORT', 'CONNECTIQUE', 'CONNECTIVITE', 'INTERFACES']);
  const portPool = portsLabel ? `${portsLabel}\n${text}` : text;
  for (const [label, re] of PORT_TOKENS) {
    if (re.test(portPool) && !ports.includes(label)) ports.push(label);
  }
  if (ports.length > 1 && ports.includes('USB') && ports.includes('USB-C')) {
    ports = ports.filter((p) => p !== 'USB');
  }
  found.ports = ports.length >= 1 ? { value: ports, confidence: 0.75, note: 'liste issue de la fiche' } : null;

  /* Batterie — formulation conservée telle quelle (spec §22.3), première clause seulement */
  let battery: string | null = null;
  const batLabel = labelValue(text, ['BATTERIE', 'AUTONOMIE']);
  if (batLabel) battery = firstClause(cleanInline(batLabel)).slice(0, 60);
  else {
    const hoursM = text.match(/(\d{1,2}(?:[.,]\d)?)\s*(?:HEURES?|H)\s*(?:D'?\s*)?AUTONOMIE/i);
    if (hoursM) battery = `≈ ${hoursM[1].replace(',', '.')} h d'autonomie`;
  }
  found.battery = battery ? { value: battery, confidence: 0.6, note: 'formulation conservée telle quelle' } : null;

  /* Accessoires */
  let accessories: string[] = [];
  const accLabel = labelValue(text, ['ACCESSOIRES', 'ACCESSOIRE']);
  if (accLabel) {
    accessories = accLabel
      .split(/[,;+•]+/)
      .map((s) => cleanInline(s))
      .filter((s) => s.length > 1)
      .slice(0, 8);
  }
  found.accessories = accessories.length ? { value: accessories, confidence: 0.7 } : null;

  /* Garantie — première clause seulement (évite d'englober la suite en texte libre) */
  let warranty: string | null = null;
  const wLabel = labelValue(text, ['GARANTIE']);
  if (wLabel) warranty = firstClause(cleanInline(wLabel)).slice(0, 50);
  else {
    const wM = text.match(/(\d{1,2})\s*(MOIS|JOURS|SEMAINES|ANN[ÉE]ES?)/i);
    if (wM) warranty = `${wM[1]} ${wM[2].toLowerCase()}`;
  }
  found.warranty = warranty ? { value: warranty, confidence: 0.75 } : null;

  /* Prix (suggestion uniquement — toujours confirmé par le vendeur) */
  let price: number | null = null;
  let priceCurrency: string | null = null;
  const priceM = text.match(/PRIX\s*:?\s*([\d][\d\s\u00A0.,]{2,14})\s*(FCFA|XOF|EUROS?|DOLLARS?|USD|\$|€)?/i);
  if (priceM) {
    price = parseInt(priceM[1].replace(/[^\d]/g, ''), 10) || null;
    if (price !== null && (price < 1000 || price > 10_000_000)) price = null;
    if (priceM[2]) priceCurrency = priceM[2].toUpperCase().replace(/EUROS?/i, 'EUR').replace(/DOLLARS?/i, 'USD');
  }
  found.price_amount = price !== null ? { value: String(price), confidence: 0.7, note: 'prix détecté sur la fiche — à confirmer' } : null;

  /* Devise — priorité : label DEVISE > devise détectée dans PRIX > devise par défaut */
  const curLabel = labelValue(text, ['DEVISE', 'CURRENCY']);
  const currency = curLabel && curLabel.length <= 10
    ? curLabel.toUpperCase()
    : (priceCurrency || defaultCurrency);
  found.currency = { value: currency, confidence: curLabel ? 1 : (priceCurrency ? 0.8 : 0.5) };

  /* État général & statut (texte standard : « ETAT : Bon état ») */
  const condRaw = labelValue(text, ['ETAT GENERAL', 'ETAT', 'ÉTAT', 'CONDITION']);
  const condition = mapCondition(condRaw ?? '');
  found.condition = condition ? { value: condition, confidence: 0.9 } : null;
  const statRaw = labelValue(text, ['STATUT', 'STATUS']);
  const status = mapStatus(statRaw ?? '');
  found.status = status ? { value: status, confidence: 0.9 } : null;

  /* Construction des sorties */
  const defs: [string, string][] = [
    ['brand', 'Marque'],
    ['model', 'Modèle'],
    ['processor', 'Processeur'],
    ['ram_gb', 'RAM (Go)'],
    ['storage_capacity_gb', 'Stockage (Go)'],
    ['storage_type', 'Type de stockage'],
    ['screen_size', 'Écran (pouces)'],
    ['screen_resolution', 'Résolution'],
    ['graphics', 'Carte graphique'],
    ['keyboard', 'Clavier'],
    ['ports', 'Ports'],
    ['battery', 'Batterie'],
    ['accessories', 'Accessoires'],
    ['warranty', 'Garantie'],
    ['price_amount', 'Prix'],
    ['condition', 'État général'],
    ['status', 'Statut'],
  ];

  const fields: ExtractedField[] = defs.map(([key, label]) => {
    const f = found[key];
    return { key, label, value: f ? (f.value as ExtractedField['value']) : null, confidence: f ? f.confidence : 0, note: f?.note };
  });

  const storageCap = found.storage_capacity_gb ? parseInt(found.storage_capacity_gb.value as string, 10) : null;
  const storageType = (found.storage_type?.value as StorageType | null) ?? null;
  const screenSizeVal = found.screen_size ? parseFloat(found.screen_size.value as string) : null;
  const screenResVal = (found.screen_resolution?.value as string | null) ?? null;
  const batteryVal = (found.battery?.value as string | null) ?? null;

  const structured: Record<string, unknown> = {
    brand: found.brand?.value ?? null,
    model: found.model?.value ?? null,
    processor: found.processor?.value ?? null,
    cores: found.cores?.value ?? null,
    ram_gb: found.ram_gb ? parseInt(found.ram_gb.value as string, 10) : null,
    storage_capacity_gb: storageCap,
    storage_type: storageType,
    storage: { capacity_gb: storageCap, type: storageType },
    screen_size: screenSizeVal,
    screen_resolution: screenResVal,
    screen: { size: screenSizeVal, resolution: screenResVal },
    graphics: found.graphics?.value ?? null,
    keyboard: found.keyboard?.value ?? null,
    ports: found.ports?.value ?? [],
    battery_note: batteryVal,
    battery: batteryVal,
    accessories: found.accessories?.value ?? [],
    warranty: found.warranty?.value ?? null,
    price_amount: found.price_amount ? parseInt(found.price_amount.value as string, 10) : null,
    condition: found.condition?.value ?? null,
    status: found.status?.value ?? null,
    currency,
  };

  const confidence: Record<string, number> = {};
  for (const [k] of defs) {
    if (found[k]) confidence[k] = found[k]!.confidence;
  }

  return { fields, structured, confidence };
}
