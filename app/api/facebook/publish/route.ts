import { NextResponse } from 'next/server';
import path from 'node:path';
import { addPublication, getComputer, getSettings, GENERATED_DIR } from '@/lib/db';
import { publishToFacebookPage } from '@/lib/services/facebook-service';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  let body: {
    computerId?: string;
    generationId?: string | null;
    filename?: string;
    caption?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Corps de requête invalide' }, { status: 400 });
  }

  if (!body.computerId || !getComputer(body.computerId)) {
    return NextResponse.json({ error: 'Produit introuvable' }, { status: 404 });
  }

  if (!body.filename) {
    return NextResponse.json({ error: "Nom de fichier d'image manquant" }, { status: 400 });
  }

  const settings = getSettings();
  const pageId = settings.facebook_page_id;
  const accessToken = settings.facebook_page_access_token;

  if (!pageId || !accessToken) {
    return NextResponse.json(
      { error: 'Veuillez d\'abord configurer votre Page ID et votre Access Token Facebook dans les Réglages.' },
      { status: 400 }
    );
  }

  const imagePath = path.join(GENERATED_DIR, body.filename);

  const result = await publishToFacebookPage({
    pageId,
    accessToken,
    imagePath,
    caption: body.caption || '',
  });

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  // Enregistrement dans l'historique des publications
  addPublication({
    computer_id: body.computerId,
    generation_id: body.generationId ?? null,
    platform: 'facebook',
    declared_status: 'published',
    published_at: new Date().toISOString().slice(0, 10),
    link: result.postUrl ?? null,
    text_final: body.caption ?? null,
  });

  return NextResponse.json({
    success: true,
    postUrl: result.postUrl,
    id: result.id,
  });
}
