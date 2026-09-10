import { NextResponse } from 'next/server';
import fs from 'node:fs';
import { getImage } from '@/lib/db';
import { imagePath } from '@/lib/services/image-service';

export const dynamic = 'force-dynamic';

type Ctx = { params: { id: string } };

export async function GET(_req: Request, { params }: Ctx) {
  const img = getImage(params.id);
  if (!img) return NextResponse.json({ error: 'Image introuvable' }, { status: 404 });
  const p = imagePath(img.kind, img.filename);
  if (!fs.existsSync(p)) return NextResponse.json({ error: 'Fichier introuvable' }, { status: 410 });
  const buf = fs.readFileSync(p);
  const type = p.endsWith('.png') ? 'image/png' : p.endsWith('.webp') ? 'image/webp' : 'image/jpeg';
  return new NextResponse(buf, {
    headers: {
      'Content-Type': type,
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
