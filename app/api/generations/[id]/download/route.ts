import { NextResponse } from 'next/server';
import fs from 'node:fs';
import path from 'node:path';
import { GENERATED_DIR, getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

type Ctx = { params: { id: string } };

/** Téléchargement du fichier avec nom de fichier lisible. */
export async function GET(_req: Request, { params }: Ctx) {
  const db = getDb();
  const row = db
    .prepare('SELECT g.*, c.brand, c.model FROM generations g JOIN computers c ON c.id = g.computer_id WHERE g.id = ?')
    .get(params.id) as { filename: string; format: string; brand: string; model: string } | undefined;
  if (!row) return NextResponse.json({ error: 'Génération introuvable' }, { status: 404 });
  const p = path.join(GENERATED_DIR, row.filename);
  if (!fs.existsSync(p)) return NextResponse.json({ error: 'Fichier introuvable' }, { status: 410 });
  const buf = fs.readFileSync(p);
  const base = `${(row.brand || 'pc').replace(/\s+/g, '_')}_${(row.model || 'annonce').replace(/\s+/g, '_')}_${row.format}`.toLowerCase();
  return new NextResponse(buf, {
    headers: {
      'Content-Type': 'image/jpeg',
      'Content-Disposition': `attachment; filename="${base}.jpg"`,
    },
  });
}
