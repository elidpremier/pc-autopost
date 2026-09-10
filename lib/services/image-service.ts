import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import { ORIGINALS_DIR, CLEANED_DIR, SECONDARY_DIR } from '../db';

export const ALLOWED_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

export type SavedImage = { filename: string; width: number; height: number };

function uniqueName(subdir: string, base: string, ext: string): string {
  const stamp = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `${base}-${stamp}-${rand}.${ext}`;
}

function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

export async function saveImage(buffer: Buffer, subdir: 'originals' | 'secondary', ext: string): Promise<SavedImage> {
  const dir = subdir === 'originals' ? ORIGINALS_DIR : SECONDARY_DIR;
  ensureDir(dir);
  const filename = uniqueName(subdir, subdir === 'originals' ? 'main' : 'sec', ext);
  const out = path.join(dir, filename);
  const meta = await sharp(buffer).toFile(out);
  return { filename, width: meta.width, height: meta.height };
}

/**
 * Recadrage déterministe (spec §22.5) : on conserve la partie de l'image
 * située SOUS la ligne de séparation (crop_top). Le produit n'est jamais
 * modifié, uniquement la zone de texte supérieure qui est retirée.
 */
export async function cropBottom(
  originalPath: string,
  width: number,
  height: number,
  cropTop: number
): Promise<SavedImage> {
  const top = Math.max(0, Math.min(cropTop, height - 40));
  const h = height - top;
  ensureDir(CLEANED_DIR);
  const filename = uniqueName('cleaned', 'clean', 'jpg');
  const out = path.join(CLEANED_DIR, filename);
  await sharp(originalPath)
    .extract({ left: 0, top, width, height: h })
    .jpeg({ quality: 90 })
    .toFile(out);
  const meta = await sharp(out).metadata();
  return { filename, width: meta.width ?? width, height: meta.height ?? h };
}

/** Extrait la zone supérieure (la fiche) pour l'OCR. */
export async function extractTopZone(originalPath: string, cropTop: number): Promise<Buffer> {
  const top = Math.max(0, cropTop);
  const meta = await sharp(originalPath).metadata();
  const width = meta.width ?? 1080;
  const h = Math.min(top, meta.height ?? top);
  if (h < 8) throw new Error('Zone de texte trop fine, ajustez la ligne de recadrage.');
  return sharp(originalPath)
    .extract({ left: 0, top: 0, width, height: h })
    .resize(1600)
    .jpeg({ quality: 92 })
    .toBuffer();
}

/** Aperçu léger pour l'affichage (max 1600px). */
export async function previewBuffer(fileAbs: string, maxDim = 1600): Promise<Buffer> {
  return sharp(fileAbs).resize({ width: maxDim, withoutEnlargement: true }).jpeg({ quality: 82 }).toBuffer();
}

export function imagePath(kind: 'main' | 'cleaned' | 'secondary', filename: string): string {
  const dir = kind === 'cleaned' ? CLEANED_DIR : kind === 'secondary' ? SECONDARY_DIR : ORIGINALS_DIR;
  return path.join(dir, filename);
}

export function ensureFile(p: string): boolean {
  return fs.existsSync(p);
}
