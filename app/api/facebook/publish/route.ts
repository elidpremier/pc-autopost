import { NextResponse } from 'next/server';
import { addPublication, getComputer, getSettings, listImages, LOGOS_DIR, ORIGINALS_DIR, CLEANED_DIR, SECONDARY_DIR } from '@/lib/db';
import { publishToFacebookPage } from '@/lib/services/facebook-service';
import { renderFormatToBuffer, buildTemplateData } from '@/lib/services/generation-service';
import type { Format } from '@/lib/types';
import path from 'node:path';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function POST(req: Request) {
  let body: {
    computerId?: string;
    generationId?: string | null;
    caption?: string;
    // Paramètres de rendu (utilisés quand pas de fichier disque)
    format?: string;
    template?: string;
    colorPrimary?: string;
    colorAccent?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Corps de requête invalide' }, { status: 400 });
  }

  const computer = getComputer(body.computerId ?? '');
  if (!body.computerId || !computer) {
    return NextResponse.json({ error: 'Produit introuvable' }, { status: 404 });
  }

  const settings = getSettings();
  const pageId = settings.facebook_page_id;
  const accessToken = settings.facebook_page_access_token;

  if (!pageId || !accessToken) {
    return NextResponse.json(
      { error: "Veuillez d'abord configurer votre Page ID et votre Access Token Facebook dans les Réglages." },
      { status: 400 }
    );
  }

  // Génération de l'image en mémoire (comme la route /preview)
  const format = (body.format || 'square') as Format;
  const templateId = body.template || 'cyber_luxe_v2';
  const colorPrimary = body.colorPrimary || undefined;
  const colorAccent = body.colorAccent || undefined;

  const data = buildTemplateData(computer, settings, { primaryColor: colorPrimary, accentColor: colorAccent });

  const images = listImages(computer.id);
  const original = images.find((i) => i.kind === 'main');
  const cleaned = images.find((i) => i.kind === 'cleaned');
  const secondary = images.find((i) => i.kind === 'secondary');

  const photos: { main?: string; secondary?: string } = {};
  if (cleaned) photos.main = path.join(CLEANED_DIR, cleaned.filename);
  else if (original) photos.main = path.join(ORIGINALS_DIR, original.filename);
  if (secondary) photos.secondary = path.join(SECONDARY_DIR, secondary.filename);

  if (!photos.main) {
    return NextResponse.json({ error: 'Aucune photo disponible pour générer le visuel.' }, { status: 422 });
  }

  const logo = settings.logo_file ? path.join(LOGOS_DIR, settings.logo_file) : null;

  let imageBuffer: Buffer;
  try {
    imageBuffer = await renderFormatToBuffer(format, data, photos, logo, templateId);
  } catch (e: any) {
    return NextResponse.json(
      { error: `Erreur lors de la génération du visuel : ${e?.message || 'Erreur inconnue'}` },
      { status: 500 }
    );
  }

  const result = await publishToFacebookPage({
    pageId,
    accessToken,
    imageBuffer,
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
