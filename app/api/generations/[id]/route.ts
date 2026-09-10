import { NextResponse } from 'next/server';
import fs from 'node:fs';
import path from 'node:path';
import { GENERATED_DIR, getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

type Ctx = { params: { id: string } };

/** Aperçu (octets de l'image générée). */
export async function GET(_req: Request, { params }: Ctx) {
  const db = getDb();
  const row = db.prepare('SELECT * FROM generations WHERE id = ?').get(params.id) as
    | { id: string; filename: string; format: string }
    | undefined;
  if (!row) return NextResponse.json({ error: 'Génération introuvable' }, { status: 404 });
  const p = path.join(GENERATED_DIR, row.filename);
  if (!fs.existsSync(p)) return NextResponse.json({ error: 'Fichier introuvable' }, { status: 410 });
  const buf = fs.readFileSync(p);
  return new NextResponse(buf, {
    headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=3600' },
  });
}
