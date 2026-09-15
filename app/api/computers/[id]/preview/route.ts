import { NextResponse } from 'next/server';
import path from 'node:path';
import {
  getComputer, listImages, getSettings, LOGOS_DIR,
  ORIGINALS_DIR, CLEANED_DIR, SECONDARY_DIR,
} from '@/lib/db';
import {
  renderFormatToBuffer, buildTemplateData, TEMPLATES,
} from '@/lib/services/generation-service';
import type { Format } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

type Ctx = { params: { id: string } };

export async function GET(req: Request, { params }: Ctx) {
  const computer = getComputer(params.id);
  if (!computer) return NextResponse.json({ error: 'Produit introuvable' }, { status: 404 });

  const { searchParams } = new URL(req.url);
  const format = (searchParams.get('format') || 'square') as Format;
  const templateId = searchParams.get('template') || 'cyber_luxe_v2';
  const colorPrimary = searchParams.get('colorPrimary') || undefined;
  const colorAccent = searchParams.get('colorAccent') || undefined;
  const isDownload = searchParams.get('download') === '1';

  const settings = getSettings();
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
    return NextResponse.json({ error: 'Aucune photo disponible' }, { status: 422 });
  }

  const logo = settings.logo_file ? path.join(LOGOS_DIR, settings.logo_file) : null;

  try {
    const buffer = await renderFormatToBuffer(format, data, photos, logo, templateId);
    
    const headers = new Headers();
    headers.set('Content-Type', 'image/jpeg');
    headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');

    if (isDownload) {
      const safeBrand = (computer.brand || 'PC').replace(/[^a-zA-Z0-9]/g, '_');
      const safeModel = (computer.model || 'model').replace(/[^a-zA-Z0-9]/g, '_');
      headers.set('Content-Disposition', `attachment; filename="${safeBrand}_${safeModel}_${templateId}_${format}.jpg"`);
    }

    return new NextResponse(new Uint8Array(buffer), { status: 200, headers });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Erreur de génération du visuel' }, { status: 500 });
  }
}
