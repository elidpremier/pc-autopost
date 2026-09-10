import { NextResponse } from 'next/server';
import fs from 'node:fs';
import { getComputer, addImage, replaceMainImages, listImages } from '@/lib/db';
import {
  saveImage, cropBottom, ALLOWED_MIME, MAX_UPLOAD_BYTES, type SavedImage,
} from '@/lib/services/image-service';
import type { ImageRow } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

type Ctx = { params: { id: string } };

/**
 * POST — téléverse une image (photo principale avec fiche, ou photo secondaire).
 * FormData: file, kind ('main'|'secondary'), cropRatio (0..1, optionnel pour main).
 */
export async function POST(req: Request, { params }: Ctx) {
  const computer = getComputer(params.id);
  if (!computer) return NextResponse.json({ error: 'Produit introuvable' }, { status: 404 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Envoi invalide (FormData attendu)' }, { status: 400 });
  }

  const file = form.get('file');
  const kind = form.get('kind');
  const cropRatioRaw = form.get('cropRatio');

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Fichier absent' }, { status: 400 });
  }
  if (!['main', 'secondary'].includes(kind as string)) {
    return NextResponse.json({ error: "Type d'image invalide" }, { status: 400 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: 'Image trop volumineuse (15 Mo maximum)' }, { status: 413 });
  }
  const ext = ALLOWED_MIME[file.type];
  if (!ext) {
    return NextResponse.json({ error: 'Format non supporté (JPEG, PNG ou WebP uniquement)' }, { status: 415 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  try {
    if (kind === 'main') {
      const saved: SavedImage = await saveImage(buffer, 'originals', ext);
      const mainRow = addImage(params.id, 'main', saved.filename, saved.width, saved.height, null, 'none', null);
      replaceMainImages(params.id, [mainRow.id]);

      let cleanedRow: ImageRow | null = null;
      let cropTop: number | null = null;
      let cropMethod: 'none' | 'manual' = 'none';
      const ratio = cropRatioRaw ? parseFloat(String(cropRatioRaw)) : NaN;
      if (Number.isFinite(ratio) && ratio > 0.02 && ratio < 0.95) {
        cropTop = Math.round(ratio * saved.height);
        const origAbs = (await import('@/lib/services/image-service')).imagePath('main', saved.filename);
        const cleaned = await cropBottom(origAbs, saved.width, saved.height, cropTop);
        cleanedRow = addImage(params.id, 'cleaned', cleaned.filename, cleaned.width, cleaned.height, cropTop, 'manual', mainRow.id);
        cropMethod = 'manual';
      }
      return NextResponse.json(
        { image: listImages(params.id).find((i) => i.id === mainRow.id), cleaned: cleanedRow, images: listImages(params.id) },
        { status: 201 }
      );
    }

    const saved: SavedImage = await saveImage(buffer, 'secondary', ext);
    const row = addImage(params.id, 'secondary', saved.filename, saved.width, saved.height, null, 'none', null);
    // Une seule photo secondaire à la fois (MVP) : supprime l'ancienne.
    const others = listImages(params.id).filter((i) => i.kind === 'secondary' && i.id !== row.id);
    for (const o of others) {
      try {
        fs.unlinkSync((await import('@/lib/services/image-service')).imagePath('secondary', o.filename));
      } catch { /* noop */ }
    }
    return NextResponse.json({ image: row, images: listImages(params.id) }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: `Échec du traitement de l'image : ${msg}` }, { status: 500 });
  }
}
