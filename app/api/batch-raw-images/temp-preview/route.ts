import { NextResponse } from 'next/server';
import fs from 'node:fs';
import path from 'node:path';
import { ORIGINALS_DIR } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const filename = url.searchParams.get('filename');
  if (!filename || filename.includes('..') || filename.includes('/')) {
    return NextResponse.json({ error: 'Fichier invalide' }, { status: 400 });
  }

  const p = path.join(ORIGINALS_DIR, filename);
  if (!fs.existsSync(p)) {
    return NextResponse.json({ error: 'Fichier introuvable' }, { status: 404 });
  }

  const buf = fs.readFileSync(p);
  return new NextResponse(buf, {
    headers: {
      'Content-Type': 'image/jpeg',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
