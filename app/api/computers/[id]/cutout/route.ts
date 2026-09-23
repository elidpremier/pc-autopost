import { NextResponse } from 'next/server';
import path from 'node:path';
import fs from 'node:fs';
import { getComputer, getImage, addImage, getDb, listImages, CLEANED_DIR } from '@/lib/db';

export const dynamic = 'force-dynamic';

type Ctx = { params: { id: string } };

/**
 * POST /api/computers/[id]/cutout
 * Enregistre le PNG détouré avec fond transparent (Option A) comme image nettoyée principale.
 */
export async function POST(req: Request, { params }: Ctx) {
  const computer = getComputer(params.id);
  if (!computer) return NextResponse.json({ error: 'Produit introuvable' }, { status: 404 });

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const imageId = (formData.get('imageId') as string) || undefined;

    if (!file) {
      return NextResponse.json({ error: 'Fichier PNG de détourage manquant' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const filename = `cutout_${computer.id}_${Date.now()}.png`;
    const destPath = path.join(CLEANED_DIR, filename);

    let width = 800;
    let height = 600;
    try {
      const sharp = (await import('sharp')).default;
      const meta = await sharp(buffer).metadata();
      if (meta.width) width = meta.width;
      if (meta.height) height = meta.height;
    } catch {
      /* noop */
    }

    fs.writeFileSync(destPath, buffer);

    const db = getDb();
    // Remplace les versions nettoyées existantes par le PNG détouré transparent
    const mainImg = imageId ? getImage(imageId) : listImages(computer.id).find((i) => i.kind === 'main');
    const oldCleaned = listImages(computer.id).filter((i) => i.kind === 'cleaned');
    for (const old of oldCleaned) {
      try {
        fs.unlinkSync(path.join(CLEANED_DIR, old.filename));
      } catch {
        /* noop */
      }
      db.prepare('DELETE FROM computer_images WHERE id = ?').run(old.id);
    }

    const cleanedRow = addImage(
      computer.id,
      'cleaned',
      filename,
      width,
      height,
      0,
      'manual',
      mainImg ? mainImg.id : null
    );

    return NextResponse.json({
      success: true,
      cleaned: cleanedRow,
      images: listImages(computer.id),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: `Détourage impossible : ${msg}` }, { status: 500 });
  }
}
