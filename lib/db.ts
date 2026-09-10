import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import type {
  ComputerFields,
  ImageKind,
  CropMethod,
  Format,
  Platform,
  PcStatus,
  Settings,
} from './types';

export const uid = () => crypto.randomUUID();
export const nowIso = () => new Date().toISOString();

export const DATA_DIR = path.join(process.cwd(), 'data');
export const UPLOADS_DIR = path.join(process.cwd(), 'uploads');
export const ORIGINALS_DIR = path.join(UPLOADS_DIR, 'originals');
export const CLEANED_DIR = path.join(UPLOADS_DIR, 'cleaned');
export const SECONDARY_DIR = path.join(UPLOADS_DIR, 'secondary');
export const GENERATED_DIR = path.join(UPLOADS_DIR, 'generated');
export const LOGOS_DIR = path.join(UPLOADS_DIR, 'logos');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS computers (
  id TEXT PRIMARY KEY,
  brand TEXT NOT NULL DEFAULT '',
  model TEXT NOT NULL DEFAULT '',
  processor TEXT NOT NULL DEFAULT '',
  ram_gb INTEGER,
  storage_capacity_gb INTEGER,
  storage_type TEXT,
  screen_size REAL,
  screen_resolution TEXT,
  graphics TEXT,
  keyboard TEXT,
  ports TEXT NOT NULL DEFAULT '[]',
  accessories TEXT NOT NULL DEFAULT '[]',
  warranty TEXT,
  condition TEXT NOT NULL DEFAULT 'bon',
  battery_condition TEXT NOT NULL DEFAULT 'non_renseignee',
  battery_note TEXT,
  price_amount INTEGER,
  currency TEXT NOT NULL DEFAULT 'FCFA',
  status TEXT NOT NULL DEFAULT 'available',
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS computer_images (
  id TEXT PRIMARY KEY,
  computer_id TEXT NOT NULL REFERENCES computers(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK(kind IN ('main','cleaned','secondary')),
  filename TEXT NOT NULL,
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  crop_top INTEGER,
  crop_method TEXT NOT NULL DEFAULT 'none',
  derived_from TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS extraction_runs (
  id TEXT PRIMARY KEY,
  computer_id TEXT NOT NULL REFERENCES computers(id) ON DELETE CASCADE,
  image_id TEXT,
  provider TEXT NOT NULL,
  raw_text TEXT NOT NULL DEFAULT '',
  structured TEXT NOT NULL DEFAULT '{}',
  confidence TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'proposed',
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS generations (
  id TEXT PRIMARY KEY,
  computer_id TEXT NOT NULL REFERENCES computers(id) ON DELETE CASCADE,
  template_id TEXT NOT NULL,
  template_version TEXT NOT NULL,
  format TEXT NOT NULL,
  filename TEXT NOT NULL,
  snapshot TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'done',
  error TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS publications (
  id TEXT PRIMARY KEY,
  computer_id TEXT NOT NULL REFERENCES computers(id) ON DELETE CASCADE,
  generation_id TEXT,
  platform TEXT NOT NULL,
  declared_status TEXT NOT NULL DEFAULT 'published',
  published_at TEXT NOT NULL,
  link TEXT,
  text_final TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS status_history (
  id TEXT PRIMARY KEY,
  computer_id TEXT NOT NULL REFERENCES computers(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_images_computer ON computer_images(computer_id);
CREATE INDEX IF NOT EXISTS idx_generations_computer ON generations(computer_id);
CREATE INDEX IF NOT EXISTS idx_status_history ON status_history(computer_id, created_at);
`;

const DEFAULT_SETTINGS: Settings = {
  shop_name: 'Ma Boutique PC',
  tagline: 'PC occasion & reconditionnés',
  phone: '',
  city: 'Ouagadougou',
  currency: 'FCFA',
  color_primary: '#1d4ed8',
  color_accent: '#f59e0b',
  logo_file: '',
  default_template: 'cyber_luxe_v2',
  facebook_page_id: '',
  facebook_page_access_token: '',
};

declare global {
  // eslint-disable-next-line no-var
  var __pcap_db: Database.Database | undefined;
}

function ensureDirs() {
  for (const d of [DATA_DIR, ORIGINALS_DIR, CLEANED_DIR, SECONDARY_DIR, GENERATED_DIR, LOGOS_DIR]) {
    fs.mkdirSync(d, { recursive: true });
  }
}

export function getDb(): Database.Database {
  if (!globalThis.__pcap_db) {
    ensureDirs();
    const db = new Database(path.join(DATA_DIR, 'pc-autopost.sqlite'));
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    db.exec(SCHEMA);
    const insert = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
    const tx = db.transaction(() => {
      for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) insert.run(k, v);
    });
    tx();
    globalThis.__pcap_db = db;
  }
  return globalThis.__pcap_db;
}

/* ------------------------------------------------------------------ */
/* Repositories                                                        */
/* ------------------------------------------------------------------ */

export type ComputerRow = Omit<ComputerFields, 'ports' | 'accessories'> & {
  id: string;
  ports: string[];
  accessories: string[];
  created_at: string;
  updated_at: string;
};

function rowToComputer(r: Record<string, unknown>): ComputerRow {
  return {
    ...(r as Omit<ComputerRow, 'ports' | 'accessories'>),
    ports: JSON.parse((r.ports as string) || '[]'),
    accessories: JSON.parse((r.accessories as string) || '[]'),
  };
}

export function listComputers(filter?: { status?: PcStatus; q?: string }): ComputerRow[] {
  const db = getDb();
  let sql = 'SELECT * FROM computers WHERE 1=1';
  const args: (string | number)[] = [];
  if (filter?.status) {
    sql += ' AND status = ?';
    args.push(filter.status);
  }
  if (filter?.q) {
    sql += ' AND (brand LIKE ? OR model LIKE ? OR (brand || \' \' || model) LIKE ?)';
    const like = `%${filter.q}%`;
    args.push(like, like, like);
  }
  sql += ' ORDER BY created_at DESC';
  const rows = db.prepare(sql).all(...args) as Record<string, unknown>[];
  return rows.map(rowToComputer);
}

export function getComputer(id: string): ComputerRow | null {
  const db = getDb();
  const r = db.prepare('SELECT * FROM computers WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  return r ? rowToComputer(r) : null;
}

export function createComputer(fields: Partial<ComputerFields>): ComputerRow {
  const db = getDb();
  const id = uid();
  const t = nowIso();
  const c: ComputerFields = {
    brand: fields.brand ?? '',
    model: fields.model ?? '',
    processor: fields.processor ?? '',
    ram_gb: fields.ram_gb ?? null,
    storage_capacity_gb: fields.storage_capacity_gb ?? null,
    storage_type: fields.storage_type ?? null,
    screen_size: fields.screen_size ?? null,
    screen_resolution: fields.screen_resolution ?? null,
    graphics: fields.graphics ?? null,
    keyboard: fields.keyboard ?? null,
    ports: fields.ports ?? [],
    accessories: fields.accessories ?? [],
    warranty: fields.warranty ?? null,
    condition: fields.condition ?? 'bon',
    battery_condition: fields.battery_condition ?? 'non_renseignee',
    battery_note: fields.battery_note ?? null,
    price_amount: fields.price_amount ?? null,
    currency: fields.currency ?? 'FCFA',
    status: fields.status ?? 'available',
    notes: fields.notes ?? '',
  };
  db.prepare(
    `INSERT INTO computers (id, brand, model, processor, ram_gb, storage_capacity_gb, storage_type,
       screen_size, screen_resolution, graphics, keyboard, ports, accessories, warranty,
       condition, battery_condition, battery_note, price_amount, currency, status, notes, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).run(
    id, c.brand, c.model, c.processor, c.ram_gb, c.storage_capacity_gb, c.storage_type,
    c.screen_size, c.screen_resolution, c.graphics, c.keyboard,
    JSON.stringify(c.ports), JSON.stringify(c.accessories), c.warranty,
    c.condition, c.battery_condition, c.battery_note, c.price_amount, c.currency, c.status, c.notes, t, t
  );
  const row = getComputer(id);
  return row as ComputerRow;
}

const UPDATABLE: (keyof ComputerFields)[] = [
  'brand', 'model', 'processor', 'ram_gb', 'storage_capacity_gb', 'storage_type',
  'screen_size', 'screen_resolution', 'graphics', 'keyboard', 'ports', 'accessories',
  'warranty', 'condition', 'battery_condition', 'battery_note', 'price_amount', 'currency', 'status', 'notes',
];

export function updateComputer(id: string, patch: Partial<ComputerFields>): ComputerRow | null {
  const db = getDb();
  const existing = getComputer(id);
  if (!existing) return null;
  const sets: string[] = [];
  const args: (string | number | null)[] = [];
  for (const k of UPDATABLE) {
    if (patch[k] === undefined) continue;
    let v = patch[k];
    if (k === 'ports' || k === 'accessories') v = JSON.stringify(v ?? []);
    sets.push(`${k} = ?`);
    args.push(v as string | number | null);
  }
  if (sets.length) {
    sets.push('updated_at = ?');
    args.push(nowIso());
    args.push(id);
    db.prepare(`UPDATE computers SET ${sets.join(', ')} WHERE id = ?`).run(...args);
  }
  if (patch.status && patch.status !== existing.status) {
    db.prepare('INSERT INTO status_history (id, computer_id, from_status, to_status, created_at) VALUES (?,?,?,?,?)')
      .run(uid(), id, existing.status, patch.status, nowIso());
  }
  return getComputer(id);
}

export function deleteComputer(id: string): void {
  const db = getDb();
  // Supprime les fichiers associés avant les lignes (spec §14).
  const images = db.prepare('SELECT * FROM computer_images WHERE computer_id = ?').all(id) as { filename: string }[];
  for (const img of images) removeFileSafe('originals', img.filename);
  const gens = db.prepare('SELECT * FROM generations WHERE computer_id = ?').all(id) as { filename: string }[];
  for (const g of gens) removeFileSafe('generated', g.filename);
  db.prepare('DELETE FROM computers WHERE id = ?').run(id);
}

function removeFileSafe(sub: string, filename: string) {
  try {
    const p = path.join(UPLOADS_DIR, sub, filename);
    if (fs.existsSync(p)) fs.unlinkSync(p);
  } catch {
    /* noop */
  }
}

export function listImages(computerId: string): import('./types').ImageRow[] {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM computer_images WHERE computer_id = ? ORDER BY created_at ASC').all(computerId) as Record<string, unknown>[];
  return rows as unknown as import('./types').ImageRow[];
}

export function getImage(id: string): import('./types').ImageRow | null {
  const db = getDb();
  const r = db.prepare('SELECT * FROM computer_images WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  return r ? (r as unknown as import('./types').ImageRow) : null;
}

export function addImage(
  computerId: string,
  kind: ImageKind,
  filename: string,
  width: number,
  height: number,
  cropTop: number | null,
  cropMethod: CropMethod,
  derivedFrom: string | null
): import('./types').ImageRow {
  const db = getDb();
  const id = uid();
  db.prepare(
    `INSERT INTO computer_images (id, computer_id, kind, filename, width, height, crop_top, crop_method, derived_from, created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?)`
  ).run(id, computerId, kind, filename, width, height, cropTop, cropMethod, derivedFrom, nowIso());
  return getImage(id) as import('./types').ImageRow;
}

export function replaceMainImages(computerId: string, keepIds: string[]) {
  const db = getDb();
  const keep = keepIds.length ? keepIds.map(() => '?').join(',') : 'NULL';
  db.prepare(`DELETE FROM computer_images WHERE computer_id = ? AND kind IN ('main','cleaned') AND id NOT IN (${keep})`).run(computerId, ...keepIds);
  for (const r of listImages(computerId).filter((i) => i.kind !== 'secondary' && !keepIds.includes(i.id))) {
    removeFileSafe(r.kind === 'cleaned' ? 'cleaned' : 'originals', r.filename);
  }
}

export function listGenerations(computerId: string): import('./types').GenerationRow[] {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM generations WHERE computer_id = ? ORDER BY created_at DESC').all(computerId) as Record<string, unknown>[];
  return (rows as unknown as import('./types').GenerationRow[]).map((g) => ({
    ...g,
    snapshot: JSON.parse((g.snapshot as unknown as string) || '{}') as Record<string, unknown>,
  })) as import('./types').GenerationRow[];
}

export function addGeneration(g: {
  computer_id: string;
  template_id: string;
  template_version: string;
  format: Format;
  filename: string;
  snapshot: Record<string, unknown>;
}): import('./types').GenerationRow {
  const db = getDb();
  const id = uid();
  db.prepare(
    `INSERT INTO generations (id, computer_id, template_id, template_version, format, filename, snapshot, status, error, created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?)`
  ).run(id, g.computer_id, g.template_id, g.template_version, g.format, g.filename, JSON.stringify(g.snapshot), 'done', null, nowIso());
  const r = db.prepare('SELECT * FROM generations WHERE id = ?').get(id) as Record<string, unknown>;
  return {
    ...(r as unknown as import('./types').GenerationRow),
    snapshot: JSON.parse((r.snapshot as string) || '{}') as Record<string, unknown>,
  };
}

export function listPublications(computerId: string): import('./types').PublicationRow[] {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM publications WHERE computer_id = ? ORDER BY created_at DESC').all(computerId) as Record<string, unknown>[];
  return rows as unknown as import('./types').PublicationRow[];
}

export function addPublication(p: {
  computer_id: string;
  generation_id: string | null;
  platform: Platform;
  declared_status: 'published' | 'removed';
  published_at: string;
  link: string | null;
  text_final: string | null;
}): void {
  const db = getDb();
  db.prepare(
    `INSERT INTO publications (id, computer_id, generation_id, platform, declared_status, published_at, link, text_final, created_at)
     VALUES (?,?,?,?,?,?,?,?,?)`
  ).run(uid(), p.computer_id, p.generation_id, p.platform, p.declared_status, p.published_at, p.link, p.text_final, nowIso());
}

export function listStatusHistory(computerId: string): import('./types').StatusHistoryRow[] {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM status_history WHERE computer_id = ? ORDER BY created_at DESC').all(computerId) as Record<string, unknown>[];
  return rows as unknown as import('./types').StatusHistoryRow[];
}

export function listExtractions(computerId: string): import('./types').ExtractionRow[] {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM extraction_runs WHERE computer_id = ? ORDER BY created_at DESC').all(computerId) as Record<string, unknown>[];
  return rows.map((r) => ({
    ...(r as unknown as import('./types').ExtractionRow),
    structured: JSON.parse((r.structured as string) || '{}') as Record<string, unknown>,
    confidence: JSON.parse((r.confidence as string) || '{}') as Record<string, number>,
  })) as import('./types').ExtractionRow[];
}

export function addExtraction(e: {
  computer_id: string;
  image_id: string | null;
  provider: string;
  raw_text: string;
  structured: Record<string, unknown>;
  confidence: Record<string, number>;
  status: 'proposed' | 'accepted' | 'corrected';
}): void {
  const db = getDb();
  db.prepare(
    `INSERT INTO extraction_runs (id, computer_id, image_id, provider, raw_text, structured, confidence, status, created_at)
     VALUES (?,?,?,?,?,?,?,?,?)`
  ).run(uid(), e.computer_id, e.image_id, e.provider, e.raw_text, JSON.stringify(e.structured), JSON.stringify(e.confidence), e.status, nowIso());
}

export function getSettings(): Settings {
  const db = getDb();
  const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[];
  const s = { ...DEFAULT_SETTINGS };
  for (const r of rows) {
    (s as unknown as Record<string, string>)[r.key] = r.value;
  }
  return s;
}

export function updateSettings(patch: Partial<Settings>): Settings {
  const db = getDb();
  const stmt = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
  for (const [k, v] of Object.entries(patch)) {
    if (v !== undefined) stmt.run(k, String(v));
  }
  return getSettings();
}
