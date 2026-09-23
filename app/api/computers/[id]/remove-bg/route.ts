/**
 * POST /api/computers/[id]/remove-bg
 * ====================================
 * Détourage professionnel côté serveur — 2 niveaux de qualité :
 *
 * Niveau 1 (Professionnel) : rembg Python + BiRefNet
 *   → Qualité e-commerce professionnelle, bords nets avec alpha matting
 *   → Modèle birefnet-general (~170 Mo, mis en cache ~/.cache/rembg/)
 *   → Alpha matting activé pour contours précis (cheveux, bords fins)
 *
 * Niveau 2 (Fallback) : @huggingface/transformers BiRefNet_lite Node.js
 *   → Qualité moindre mais fonctionne sans Python
 */

import { NextResponse } from 'next/server';
import path from 'node:path';
import fs from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import {
  getComputer, getImage, addImage, getDb, listImages,
  CLEANED_DIR, ORIGINALS_DIR,
} from '@/lib/db';

export const dynamic = 'force-dynamic';
export const maxDuration = 600;

const execFileAsync = promisify(execFile);
type Ctx = { params: { id: string } };

// Cache du segmenter HF (fallback uniquement)
let _hfSegmenter: any = null;

/** Vérifie que rembg est disponible */
async function isRembgAvailable(): Promise<boolean> {
  try {
    await execFileAsync('python3', ['-c', 'import rembg'], { timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

/** Détourage professionnel via rembg Python + BiRefNet */
async function removeBgWithRembg(srcPath: string, destPath: string): Promise<void> {
  const scriptPath = path.join(process.cwd(), 'scripts', 'remove_bg.py');

  const { stdout, stderr } = await execFileAsync(
    'python3',
    [scriptPath, srcPath, destPath, 'birefnet-general'],
    {
      timeout: 300_000, // 5 min max (1ère fois = téléchargement du modèle)
      maxBuffer: 10 * 1024 * 1024,
    }
  );

  if (stdout) console.log('[remove-bg/rembg]', stdout.trim());
  if (stderr) console.error('[remove-bg/rembg] stderr:', stderr.trim());

  if (!fs.existsSync(destPath)) {
    throw new Error(`rembg n'a pas produit le fichier de sortie : ${destPath}`);
  }
}

/** Fallback : BiRefNet_lite via @huggingface/transformers Node.js */
async function removeBgWithHF(srcPath: string, destPath: string): Promise<void> {
  if (!_hfSegmenter) {
    const { pipeline } = await import('@huggingface/transformers');
    console.log('[remove-bg/hf] Chargement BiRefNet_lite-ONNX…');
    _hfSegmenter = await pipeline('image-segmentation', 'onnx-community/BiRefNet_lite-ONNX', {
      dtype: 'fp32',
      device: 'cpu',
    });
  }

  const output = await _hfSegmenter(srcPath);
  if (!Array.isArray(output) || output.length === 0) throw new Error('HF: aucun segment');

  const fgSeg = output.find((s: any) => s.label === 'foreground');
  const segment = fgSeg ?? output[0];
  const invertMask = !fgSeg;
  if (!segment?.mask) throw new Error('HF: masque absent');

  const sharp = (await import('sharp')).default;
  const mask = segment.mask;
  const { data: imgRgba, info } = await sharp(srcPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;

  const maskResized = await sharp(Buffer.from(mask.data), { raw: { width: mask.width, height: mask.height, channels: 1 } })
    .resize(W, H, { fit: 'fill' }).raw().toBuffer();

  for (let i = 0; i < W * H; i++) {
    let alpha = maskResized[i];
    if (invertMask) alpha = 255 - alpha;
    imgRgba[i * 4 + 3] = alpha;
  }

  await sharp(imgRgba, { raw: { width: W, height: H, channels: 4 } })
    .png({ compressionLevel: 8 })
    .toFile(destPath);
}

export async function POST(req: Request, { params }: Ctx) {
  const computer = getComputer(params.id);
  if (!computer) return NextResponse.json({ error: 'Produit introuvable' }, { status: 404 });

  try {
    const body = await req.json() as { imageId?: string };
    const allImages = listImages(computer.id);
    const cleanedImg = allImages.find((i) => i.kind === 'cleaned');
    const mainImg    = allImages.find((i) => i.kind === 'main');
    const sourceImg  = body.imageId ? getImage(body.imageId) : (cleanedImg ?? mainImg);

    if (!sourceImg) return NextResponse.json({ error: 'Aucune image source' }, { status: 400 });

    const srcDir  = sourceImg.kind === 'cleaned' ? CLEANED_DIR : ORIGINALS_DIR;
    const srcPath = path.join(srcDir, sourceImg.filename);
    if (!fs.existsSync(srcPath)) return NextResponse.json({ error: 'Fichier source introuvable' }, { status: 410 });

    const filename = `cutout_${computer.id}_${Date.now()}.png`;
    const destPath = path.join(CLEANED_DIR, filename);

    // ── Niveau 1 : rembg Python (professionnel) ──────────────────────────
    let method = 'rembg-birefnet';
    try {
      const rembgOk = await isRembgAvailable();
      if (!rembgOk) throw new Error('rembg non disponible');
      console.log(`[remove-bg] Méthode : rembg Python + BiRefNet (professionnel)`);
      await removeBgWithRembg(srcPath, destPath);
    } catch (e1) {
      console.warn('[remove-bg] rembg échoué, passage HF BiRefNet_lite :', e1);
      method = 'hf-birefnet-lite';
      // ── Niveau 2 : HF transformers BiRefNet_lite ─────────────────────
      await removeBgWithHF(srcPath, destPath);
    }

    // ── Lire dimensions du PNG généré ────────────────────────────────────
    const sharp = (await import('sharp')).default;
    const meta = await sharp(destPath).metadata();
    const W = meta.width ?? 800;
    const H = meta.height ?? 600;

    // ── Mettre à jour BDD ────────────────────────────────────────────────
    const db = getDb();
    const oldCleaned = allImages.filter((i) => i.kind === 'cleaned');
    for (const old of oldCleaned) {
      try { fs.unlinkSync(path.join(CLEANED_DIR, old.filename)); } catch { }
      db.prepare('DELETE FROM computer_images WHERE id = ?').run(old.id);
    }
    const cleanedRow = addImage(computer.id, 'cleaned', filename, W, H, 0, 'manual', mainImg?.id ?? null);

    console.log(`[remove-bg] ✅ ${method} → ${filename}`);
    return NextResponse.json({ success: true, method, cleaned: cleanedRow, images: listImages(computer.id) });

  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[remove-bg] Erreur finale :', msg);
    return NextResponse.json({ error: `Détourage échoué : ${msg}` }, { status: 500 });
  }
}
