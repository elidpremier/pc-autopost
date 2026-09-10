import { NextResponse } from 'next/server';
import {
  getComputer, updateComputer, deleteComputer, listImages, listGenerations,
  listPublications, listStatusHistory, listExtractions,
} from '@/lib/db';
import type { ComputerFields } from '@/lib/types';

export const dynamic = 'force-dynamic';

type Ctx = { params: { id: string } };

export async function GET(_req: Request, { params }: Ctx) {
  const c = getComputer(params.id);
  if (!c) return NextResponse.json({ error: 'Produit introuvable' }, { status: 404 });
  return NextResponse.json({
    computer: c,
    images: listImages(c.id),
    generations: listGenerations(c.id),
    publications: listPublications(c.id),
    statusHistory: listStatusHistory(c.id),
    extractions: listExtractions(c.id),
  });
}

export async function PATCH(req: Request, { params }: Ctx) {
  const c = getComputer(params.id);
  if (!c) return NextResponse.json({ error: 'Produit introuvable' }, { status: 404 });
  let patch: Partial<ComputerFields>;
  try {
    patch = await req.json();
  } catch {
    return NextResponse.json({ error: 'Corps de requête invalide' }, { status: 400 });
  }
  const updated = updateComputer(params.id, patch);
  if (!updated) return NextResponse.json({ error: 'Modification impossible' }, { status: 500 });
  return NextResponse.json({ computer: updated, statusHistory: listStatusHistory(updated.id) });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const c = getComputer(params.id);
  if (!c) return NextResponse.json({ error: 'Produit introuvable' }, { status: 404 });
  deleteComputer(params.id);
  return NextResponse.json({ ok: true });
}
