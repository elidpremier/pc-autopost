import { NextResponse } from 'next/server';
import { deleteComputer, getComputer } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const computerIds = body.computerIds;

    if (!Array.isArray(computerIds) || computerIds.length === 0) {
      return NextResponse.json({ error: 'Liste d’identifiants requise' }, { status: 400 });
    }

    let deletedCount = 0;
    for (const id of computerIds) {
      if (typeof id === 'string' && getComputer(id)) {
        deleteComputer(id);
        deletedCount++;
      }
    }

    return NextResponse.json({ ok: true, deletedCount });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur suppression' },
      { status: 500 }
    );
  }
}
