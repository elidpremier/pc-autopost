import { NextResponse } from 'next/server';
import path from 'node:path';
import fs from 'node:fs';
import {
  createComputer, addImage, replaceMainImages, addExtraction,
  addGeneration, getSettings, LOGOS_DIR, ORIGINALS_DIR, CLEANED_DIR,
} from '@/lib/db';
import { cropBottom } from '@/lib/services/image-service';
import { renderFormat, buildTemplateData, TEMPLATES } from '@/lib/services/generation-service';
import type { Condition, Format, StorageType } from '@/lib/types';
import sharp from 'sharp';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const ALL_FORMATS: Format[] = ['square', 'portrait', 'story', 'detail'];

type IncomingItem = {
  filename: string;
  width: number;
  height: number;
  cropRatio?: number;
  brand?: string;
  model?: string;
  processor?: string;
  ram_gb?: number | null;
  storage_capacity_gb?: number | null;
  storage_type?: StorageType | null;
  screen_size?: number | null;
  screen_resolution?: string;
  graphics?: string;
  price_amount?: number | null;
  currency?: string;
  condition?: Condition;
  rawText?: string;
  cutoutFilename?: string;
};

export async function POST(req: Request) {
  let body: { items?: IncomingItem[]; formats?: Format[]; templateId?: string; colorPrimary?: string; colorAccent?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Corps de requête JSON invalide' }, { status: 400 });
  }

  const items = Array.isArray(body.items) ? body.items : [];
  if (!items.length) {
    return NextResponse.json({ error: 'Aucun produit fourni pour l’exécution par lot' }, { status: 400 });
  }

  const formats = (body.formats ?? ALL_FORMATS).filter((f) => ALL_FORMATS.includes(f));
  if (!formats.length) {
    return NextResponse.json({ error: 'Aucun format valide sélectionné' }, { status: 400 });
  }

  const settings = getSettings();
  const templateId = (body.templateId || settings.default_template || 'cyber_luxe_v2').trim();
  const template = TEMPLATES[templateId] || TEMPLATES.cyber_luxe_v2;
  const logo = settings.logo_file ? path.join(LOGOS_DIR, settings.logo_file) : null;

  const results: Array<{
    computerId: string;
    brand: string;
    model: string;
    price: number | null;
    currency: string;
    generated: Array<{ id: string; format: Format; filename: string; url: string; downloadUrl: string }>;
  }> = [];

  let totalPostersGenerated = 0;

  for (const item of items) {
    const brand = (item.brand || '').trim() || 'Marque';
    const model = (item.model || '').trim() || 'Modèle';
    const processor = (item.processor || '').trim() || 'Non renseigné';
    const ram_gb = item.ram_gb && item.ram_gb > 0 ? item.ram_gb : null;
    const storage_capacity_gb = item.storage_capacity_gb && item.storage_capacity_gb > 0 ? item.storage_capacity_gb : null;
    const price_amount = item.price_amount && item.price_amount > 0 ? item.price_amount : null;
    const currency = (item.currency || settings.currency || 'FCFA').trim();

    // 1. Créer le produit dans la base de données
    const computer = createComputer({
      brand,
      model,
      processor,
      ram_gb,
      storage_capacity_gb,
      storage_type: item.storage_type || null,
      screen_size: item.screen_size || null,
      screen_resolution: item.screen_resolution || '',
      graphics: item.graphics || '',
      price_amount,
      currency,
      condition: item.condition || 'bon',
      status: 'available',
    });

    // 2. Associer la photo originale principale
    const mainRow = addImage(computer.id, 'main', item.filename, item.width, item.height, null, 'none', null);
    replaceMainImages(computer.id, [mainRow.id]);

    // 3. Utiliser le détourage préparé ou effectuer le recadrage déterministe.
    const ratio = typeof item.cropRatio === 'number' && item.cropRatio > 0.05 && item.cropRatio < 0.9 ? item.cropRatio : 0.32;
    const cropTop = Math.round(ratio * item.height);
    const origAbs = path.join(ORIGINALS_DIR, item.filename);

    let cleanedFilename = item.filename;
    let mainPhotoPath = origAbs;

    const cutoutPath = item.cutoutFilename ? path.join(CLEANED_DIR, item.cutoutFilename) : null;
    if (cutoutPath && fs.existsSync(cutoutPath)) {
      const cutoutMeta = await sharp(cutoutPath).metadata();
      cleanedFilename = item.cutoutFilename!;
      mainPhotoPath = cutoutPath;
      addImage(computer.id, 'cleaned', cleanedFilename, cutoutMeta.width || item.width, cutoutMeta.height || item.height, null, 'none', mainRow.id);
    } else {
      try {
        const cleaned = await cropBottom(origAbs, item.width, item.height, cropTop);
        addImage(computer.id, 'cleaned', cleaned.filename, cleaned.width, cleaned.height, cropTop, 'manual', mainRow.id);
        cleanedFilename = cleaned.filename;
        mainPhotoPath = path.join(CLEANED_DIR, cleaned.filename);
      } catch {
        // Fallback sur l'image originale si le crop échoue
      }
    }

    // 4. Trace de l'extraction OCR / Texte s'il y en a une
    if (item.rawText) {
      addExtraction({
        computer_id: computer.id,
        image_id: mainRow.id,
        provider: 'ocr_batch',
        raw_text: item.rawText,
        structured: { brand, model, processor, ram_gb, storage_capacity_gb, price_amount },
        confidence: {},
        status: 'proposed',
      });
    }

    // 5. Génération des affiches pour tous les formats demandés
    const data = buildTemplateData(computer, settings, {
      primaryColor: body.colorPrimary,
      accentColor: body.colorAccent,
    });
    const photos = { main: mainPhotoPath };
    const generatedList: Array<{ id: string; format: Format; filename: string; url: string; downloadUrl: string }> = [];

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
        generatedList.push({
          id: gen.id,
          format,
          filename: rendered.filename,
          url: `/api/generations/${gen.id}`,
          downloadUrl: `/api/generations/${gen.id}/download`,
        });
        totalPostersGenerated++;
      } catch (err) {
        console.error(`Erreur rendu lot [${computer.id}] format ${format}:`, err);
      }
    }

    results.push({
      computerId: computer.id,
      brand,
      model,
      price: price_amount,
      currency,
      generated: generatedList,
    });
  }

  return NextResponse.json({
    summary: {
      totalProductsCreated: results.length,
      totalPostersGenerated,
    },
    template: { id: templateId, name: template.name },
    results,
  });
}
