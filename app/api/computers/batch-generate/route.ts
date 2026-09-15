import { NextResponse } from 'next/server';
import path from 'node:path';
import {
  getComputer, listImages, addGeneration, getSettings, LOGOS_DIR,
  ORIGINALS_DIR, CLEANED_DIR, SECONDARY_DIR,
} from '@/lib/db';
import {
  renderFormat, buildTemplateData, checkGenerationReadiness, TEMPLATES,
} from '@/lib/services/generation-service';
import type { Format } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const ALL_FORMATS: Format[] = ['square', 'portrait', 'story', 'detail'];

export type BatchResultItem = {
  id: string;
  format: Format;
  filename: string;
  url: string;
  downloadUrl: string;
};

export type BatchComputerResult = {
  computerId: string;
  brand: string;
  model: string;
  status: 'success' | 'skipped' | 'error';
  reason?: string;
  missingFields?: string[];
  generated: BatchResultItem[];
};

export async function POST(req: Request) {
  let body: { computerIds?: string[]; formats?: Format[]; templateId?: string; colorPrimary?: string; colorAccent?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Corps de requête JSON invalide' }, { status: 400 });
  }

  const computerIds = Array.isArray(body.computerIds) ? body.computerIds.filter((id) => typeof id === 'string' && id.trim()) : [];
  if (!computerIds.length) {
    return NextResponse.json({ error: 'Aucun ordinateur sélectionné pour la génération par lot' }, { status: 400 });
  }

  const formats = (body.formats ?? ALL_FORMATS).filter((f) => ALL_FORMATS.includes(f));
  if (!formats.length) {
    return NextResponse.json({ error: 'Aucun format valide sélectionné' }, { status: 400 });
  }

  const settings = getSettings();
  const templateId = (body.templateId || settings.default_template || 'cyber_luxe_v2').trim();
  const template = TEMPLATES[templateId] || TEMPLATES.cyber_luxe_v2;
  const logo = settings.logo_file ? path.join(LOGOS_DIR, settings.logo_file) : null;

  const results: BatchComputerResult[] = [];
  let totalGeneratedPosters = 0;
  let successfulComputers = 0;
  let skippedComputers = 0;

  for (const computerId of computerIds) {
    const computer = getComputer(computerId);
    if (!computer) {
      results.push({
        computerId,
        brand: 'Inconnu',
        model: 'Introuvable',
        status: 'error',
        reason: 'Produit introuvable en base de données',
        generated: [],
      });
      skippedComputers++;
      continue;
    }

    const brand = computer.brand || 'Sans marque';
    const model = computer.model || 'Sans modèle';

    const missing = checkGenerationReadiness(computer);
    if (missing.length > 0) {
      results.push({
        computerId,
        brand,
        model,
        status: 'skipped',
        reason: `Fiche incomplète : ${missing.join(', ')}`,
        missingFields: missing,
        generated: [],
      });
      skippedComputers++;
      continue;
    }

    const images = listImages(computer.id);
    const original = images.find((i) => i.kind === 'main');
    const cleaned = images.find((i) => i.kind === 'cleaned');
    const secondary = images.find((i) => i.kind === 'secondary');

    const photos: { main?: string; secondary?: string } = {};
    if (cleaned) photos.main = path.join(CLEANED_DIR, cleaned.filename);
    else if (original) photos.main = path.join(ORIGINALS_DIR, original.filename);
    if (secondary) photos.secondary = path.join(SECONDARY_DIR, secondary.filename);

    if (!photos.main) {
      results.push({
        computerId,
        brand,
        model,
        status: 'skipped',
        reason: 'Aucune photo principale disponible pour ce produit',
        generated: [],
      });
      skippedComputers++;
      continue;
    }

    const data = buildTemplateData(computer, settings, {
      primaryColor: body.colorPrimary,
      accentColor: body.colorAccent,
    });
    const generatedItems: BatchResultItem[] = [];

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
        generatedItems.push({
          id: gen.id,
          format,
          filename: rendered.filename,
          url: `/api/generations/${gen.id}`,
          downloadUrl: `/api/generations/${gen.id}/download`,
        });
        totalGeneratedPosters++;
      } catch (err) {
        console.error(`Erreur rendu [${computerId}] format ${format}:`, err);
      }
    }

    if (generatedItems.length > 0) {
      successfulComputers++;
      results.push({
        computerId,
        brand,
        model,
        status: 'success',
        generated: generatedItems,
      });
    } else {
      results.push({
        computerId,
        brand,
        model,
        status: 'error',
        reason: 'Échec de génération pour tous les formats demandés',
        generated: [],
      });
      skippedComputers++;
    }
  }

  return NextResponse.json({
    summary: {
      totalRequested: computerIds.length,
      successfulComputers,
      skippedComputers,
      totalGeneratedPosters,
    },
    template: { id: templateId, name: template.name },
    results,
  });
}
