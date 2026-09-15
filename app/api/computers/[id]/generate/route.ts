import { NextResponse } from 'next/server';
import path from 'node:path';
import {
  getComputer, listImages, addGeneration, getSettings, LOGOS_DIR,
  ORIGINALS_DIR, CLEANED_DIR, SECONDARY_DIR,
} from '@/lib/db';
import {
  renderFormat, buildTemplateData, checkGenerationReadiness, TEMPLATES,
} from '@/lib/services/generation-service';
import { buildPlatformTexts } from '@/lib/services/text-service';
import type { Format } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const ALL_FORMATS: Format[] = ['square', 'portrait', 'story', 'detail'];

type Ctx = { params: { id: string } };

/**
 * POST — génération des visuels sélectionnés (spec §9, §15).
 * Body: { formats: Format[] }
 * La génération est bloquée si des données obligatoires manquent.
 */
export async function POST(req: Request, { params }: Ctx) {
  const computer = getComputer(params.id);
  if (!computer) return NextResponse.json({ error: 'Produit introuvable' }, { status: 404 });

  let body: { formats?: Format[]; templateId?: string; colorPrimary?: string; colorAccent?: string };
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const formats = (body.formats ?? ['square']).filter((f) => ALL_FORMATS.includes(f));
  if (!formats.length) {
    return NextResponse.json({ error: 'Aucun format sélectionné' }, { status: 400 });
  }

  const missing = checkGenerationReadiness(computer);
  if (missing.length) {
    return NextResponse.json({ error: 'Fiche incomplète', missing }, { status: 422 });
  }

  const settings = getSettings();
  const templateId = (body.templateId || settings.default_template || 'cyber_luxe_v2').trim();
  const template = TEMPLATES[templateId] || TEMPLATES.cyber_luxe_v2;
  const data = buildTemplateData(computer, settings, {
    primaryColor: body.colorPrimary,
    accentColor: body.colorAccent,
  });

  const images = listImages(computer.id);
  const original = images.find((i) => i.kind === 'main');
  const cleaned = images.find((i) => i.kind === 'cleaned');
  const secondary = images.find((i) => i.kind === 'secondary');

  const photos: { main?: string; secondary?: string } = {};
  if (cleaned) photos.main = path.join(CLEANED_DIR, cleaned.filename);
  else if (original) photos.main = path.join(ORIGINALS_DIR, original.filename);
  if (secondary) photos.secondary = path.join(SECONDARY_DIR, secondary.filename);

  if (!photos.main) {
    return NextResponse.json({ error: 'Aucune photo principale disponible pour ce produit' }, { status: 422 });
  }

  const logo = settings.logo_file ? path.join(LOGOS_DIR, settings.logo_file) : null;
  const texts = buildPlatformTexts(data);

  const results: { id: string; format: Format; url: string; downloadUrl: string }[] = [];
  const errors: { format: Format; error: string }[] = [];

  for (const format of formats) {
    try {
      const rendered = await renderFormat(format, data, photos, logo, templateId);
      const gen = addGeneration({
        computer_id: computer.id,
        template_id: templateId,
        template_version: template.version,
        format,
        filename: rendered.filename,
        snapshot: data as unknown as Record<string, unknown>,
      });
      results.push({
        id: gen.id,
        format,
        url: `/api/generations/${gen.id}`,
        downloadUrl: `/api/generations/${gen.id}/download`,
      });
    } catch (e) {
      errors.push({ format, error: e instanceof Error ? e.message : String(e) });
    }
  }

  if (!results.length) {
    return NextResponse.json({ error: 'Échec de la génération', details: errors }, { status: 500 });
  }

  return NextResponse.json({
    generated: results,
    errors,
    texts,
    template: { id: templateId, version: template.version, name: template.name },
    createdAt: new Date().toISOString(),
  });
}
