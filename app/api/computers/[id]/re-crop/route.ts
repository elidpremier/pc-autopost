import { NextResponse } from 'next/server';
import path from 'node:path';
import fs from 'node:fs';
import { getComputer, getImage, addImage, getDb, listImages, ORIGINALS_DIR, CLEANED_DIR } from '@/lib/db';
import { cropBottom, imagePath } from '@/lib/services/image-service';
import type { ImageRow } from '@/lib/types';

export const dynamic = 'force-dynamic';

type Ctx = { params: { id: string } };

/**
 * POST — recadre la photo principale avec une nouvelle ligne de séparation
 * (spec §22.5 : l'original est toujours conservé, le recadrage est reproductible).
 * Body: { imageId, cropRatio }
 */
export async function POST(req: Request, { params }: Ctx) {
  const computer = getComputer(params.id);
  if (!computer) return NextResponse.json({ error: 'Produit introuvable' }, { status: 404 });

  let body: { imageId?: string; cropRatio?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Corps de requête invalide' }, { status: 400 });
  }

  const img = body.imageId ? getImage(body.imageId) : null;
  if (!img || img.kind !== 'main') {
    return NextResponse.json({ error: 'Photo principale introuvable' }, { status: 400 });
  }
  const ratio = body.cropRatio as number;
  if (!Number.isFinite(ratio) || ratio <= 0.02 || ratio >= 0.95) {
    return NextResponse.json({ error: 'Position de recadrage invalide' }, { status: 400 });
  }

  try {
    const cropTop = Math.round(ratio * img.height);
    const origAbs = path.join(ORIGINALS_DIR, img.filename);
    const cleaned = await cropBottom(origAbs, img.width, img.height, cropTop);

    const db = getDb();
    // Remplace la version nettoyée existante.
    const old = listImages(computer.id).find((i) => i.kind === 'cleaned' && i.derived_from === img.id);
    if (old) {
      try {
        fs.unlinkSync(path.join(CLEANED_DIR, old.filename));
      } catch { /* noop */ }
      db.prepare('DELETE FROM computer_images WHERE id = ?').run(old.id);
    }
    db.prepare('UPDATE computer_images SET crop_top = ?, crop_method = ? WHERE id = ?')
      .run(cropTop, 'manual', img.id);

    const cleanedRow: ImageRow = addImage(computer.id, 'cleaned', cleaned.filename, cleaned.width, cleaned.height, cropTop, 'manual', img.id);
    return NextResponse.json({
      image: getImage(img.id),
      cleaned: cleanedRow,
      images: listImages(computer.id),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: `Recadrage impossible : ${msg}` }, { status: 500 });
  }
}
