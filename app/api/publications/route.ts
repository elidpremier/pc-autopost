import { NextResponse } from 'next/server';
import { addPublication, getComputer } from '@/lib/db';
import type { Platform } from '@/lib/types';

export const dynamic = 'force-dynamic';

const PLATFORM_IDS: Platform[] = ['facebook', 'instagram', 'whatsapp', 'other'];

export async function POST(req: Request) {
  let body: {
    computerId?: string;
    generationId?: string | null;
    platform?: Platform;
    declared_status?: 'published' | 'removed';
    publishedAt?: string;
    link?: string | null;
    textFinal?: string | null;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Corps de requête invalide' }, { status: 400 });
  }
  if (!body.computerId || !getComputer(body.computerId)) {
    return NextResponse.json({ error: 'Produit introuvable' }, { status: 404 });
  }
  if (!body.platform || !PLATFORM_IDS.includes(body.platform)) {
    return NextResponse.json({ error: 'Plateforme invalide' }, { status: 400 });
  }
  addPublication({
    computer_id: body.computerId,
    generation_id: body.generationId ?? null,
    platform: body.platform,
    declared_status: body.declared_status === 'removed' ? 'removed' : 'published',
    published_at: body.publishedAt || new Date().toISOString().slice(0, 10),
    link: body.link ?? null,
    text_final: body.textFinal ?? null,
  });
  return NextResponse.json({ ok: true }, { status: 201 });
}
