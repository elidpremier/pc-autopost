import { NextResponse } from 'next/server';
import path from 'node:path';
import {
  getComputer, getImage, addExtraction, updateComputer, getSettings, ORIGINALS_DIR,
} from '@/lib/db';
import { extractTopZone } from '@/lib/services/image-service';
import { ocrImage } from '@/lib/services/ocr-service';
import { parseSpecText } from '@/lib/services/spec-parser';
import { parseStandardInput, looksLikeJson } from '@/lib/services/standard-format';
import { llmExtract } from '@/lib/services/ai-extract';
import type { ExtractedField, StorageType, Condition, PcStatus } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

type Ctx = { params: { id: string } };

/**
 * Applique les champs extraits directement dans la table computers.
 * Seuls les champs non-null et valides sont écrasés.
 * Cela garantit que l'écran, les ports, etc. sont persistés même si
 * Workspace.tsx n'est pas ouvert au moment de l'extraction.
 */
function applyFieldsToComputer(
  computerId: string,
  fields: ExtractedField[],
  structured: Record<string, unknown>,
) {
  const patch: Record<string, unknown> = {};

  for (const f of fields) {
    if (f.value === null || f.value === undefined || f.value === '') continue;

    switch (f.key) {
      case 'brand':
      case 'model':
      case 'processor':
      case 'graphics':
      case 'keyboard':
      case 'warranty':
        if (typeof f.value === 'string' && f.value.trim()) {
          patch[f.key] = f.value.trim();
        }
        break;

      case 'screen_resolution':
        if (typeof f.value === 'string' && f.value.trim()) {
          patch.screen_resolution = f.value.trim();
        }
        break;

      case 'screen_size': {
        const n = typeof f.value === 'number' ? f.value : parseFloat(String(f.value));
        if (Number.isFinite(n) && n >= 10 && n <= 23) patch.screen_size = n;
        break;
      }

      case 'ram_gb': {
        const n = typeof f.value === 'number' ? f.value : parseInt(String(f.value), 10);
        if (Number.isFinite(n) && n > 0 && n <= 512) patch.ram_gb = n;
        break;
      }

      case 'storage_capacity_gb': {
        const n = typeof f.value === 'number' ? f.value : parseInt(String(f.value), 10);
        // Plage réaliste : 32 Go à 8 To
        if (Number.isFinite(n) && n >= 32 && n <= 8192) patch.storage_capacity_gb = n;
        break;
      }

      case 'storage_type':
        if (['SSD', 'HDD', 'NVMe', 'eMMC', 'autre'].includes(String(f.value))) {
          patch.storage_type = f.value as StorageType;
        }
        break;

      case 'price_amount': {
        const n = typeof f.value === 'number' ? f.value : parseInt(String(f.value), 10);
        if (Number.isFinite(n) && n > 0) patch.price_amount = n;
        break;
      }

      case 'currency':
        if (typeof f.value === 'string' && f.value.trim()) patch.currency = f.value.trim();
        break;

      case 'condition':
        if (['neuf', 'tres_bon', 'bon', 'correct', 'a_reparer'].includes(String(f.value))) {
          patch.condition = f.value as Condition;
        }
        break;

      case 'status':
        if (['available', 'reserved', 'sold', 'archived'].includes(String(f.value))) {
          patch.status = f.value as PcStatus;
        }
        break;

      case 'ports':
      case 'accessories':
        if (Array.isArray(f.value) && f.value.length > 0) {
          patch[f.key] = f.value;
        }
        break;

      case 'battery':
        if (typeof f.value === 'string' && f.value.trim()) {
          patch.battery_note = f.value.trim();
        }
        break;
    }
  }

  // Récupération de l'écran depuis structured si absent des fields (cas LLM)
  if (patch.screen_size === undefined && structured.screen_size != null) {
    const n = typeof structured.screen_size === 'number'
      ? structured.screen_size
      : parseFloat(String(structured.screen_size));
    if (Number.isFinite(n) && n >= 10 && n <= 23) patch.screen_size = n;
  }
  if (patch.screen_resolution === undefined && structured.screen_resolution != null) {
    const r = String(structured.screen_resolution).trim();
    if (r) patch.screen_resolution = r;
  }
  if (patch.ports === undefined) {
    const p = structured.ports;
    if (Array.isArray(p) && p.length > 0) patch.ports = p;
  }
  if (patch.accessories === undefined) {
    const a = structured.accessories;
    if (Array.isArray(a) && a.length > 0) patch.accessories = a;
  }

  if (Object.keys(patch).length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    updateComputer(computerId, patch as any);
  }
}

/**
 * POST — extraction de la fiche (spec §22.1-22.3).
 * Body: { imageId, cropRatio?, rawText? }
 * - Si rawText fourni : analyse directe (fournisseur 'manual_text').
 * - Sinon : recadrage déterministe de la zone supérieure + OCR + parsing.
 */
export async function POST(req: Request, { params }: Ctx) {
  const computer = getComputer(params.id);
  if (!computer) return NextResponse.json({ error: 'Produit introuvable' }, { status: 404 });

  let body: { imageId?: string; cropRatio?: number; rawText?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Corps de requête invalide' }, { status: 400 });
  }

  const settings = getSettings();
  let rawText = '';
  let provider = 'manual_text';
  let source = 'texte';
  let imageId: string | null = null;

  if (body.rawText && body.rawText.trim()) {
    rawText = body.rawText.trim();
    // Import standard : JSON détecté automatiquement, sinon texte (standard ou libre).
    // Si une IA est configurée (.env) et que le texte n'est pas du JSON standard,
    // on tente d'abord l'IA, avec repli automatique sur le parseur local.
    try {
      if (!looksLikeJson(rawText)) {
        const llm = await llmExtract(rawText, settings.currency);
        if (llm) {
          provider = 'llm';
          source = 'IA';
          addExtraction({
            computer_id: params.id, image_id: null, provider, raw_text: rawText,
            structured: llm.structured, confidence: llm.confidence, status: 'proposed',
          });
          applyFieldsToComputer(params.id, llm.fields, llm.structured);
          return NextResponse.json({ rawText, provider, source, ...llm });
        }
      }
      const r = parseStandardInput(rawText, settings.currency);
      provider = r.provider;
      source = r.source;
      addExtraction({
        computer_id: params.id, image_id: null, provider, raw_text: rawText,
        structured: r.structured, confidence: r.confidence, status: 'proposed',
      });
      applyFieldsToComputer(params.id, r.fields, r.structured);
      return NextResponse.json({ rawText, provider, source, fields: r.fields, structured: r.structured, confidence: r.confidence });
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : 'Import impossible', canPaste: true },
        { status: 400 }
      );
    }
  } else {
    const img = body.imageId ? getImage(body.imageId) : null;
    if (!img || img.kind !== 'main') {
      return NextResponse.json({ error: 'Photo principale introuvable. Téléversez d\u2019abord la photo-fiche.' }, { status: 400 });
    }
    const ratio = body.cropRatio;
    if (!Number.isFinite(ratio as number) || (ratio as number) <= 0.02 || (ratio as number) >= 0.95) {
      return NextResponse.json({ error: 'Position de recadrage invalide. Déplacez la ligne sur l\u2019aperçu.' }, { status: 400 });
    }
    imageId = img.id;
    const cropTop = Math.round((ratio as number) * img.height);
    const origAbs = path.join(ORIGINALS_DIR, img.filename);
    let zoneBuffer: Buffer;
    try {
      zoneBuffer = await extractTopZone(origAbs, cropTop);
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : 'Recadrage impossible' }, { status: 400 });
    }
    try {
      const ocr = await ocrImage(zoneBuffer);
      rawText = ocr.text;
      provider = ocr.provider;
      if (!rawText) throw new Error('aucun texte détecté');
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : 'OCR indisponible', canPaste: true },
        { status: 502 }
      );
    }
  }

  // Le texte issu de l'OCR peut également être structuré par le LLM configuré.
  // En l'absence de clé, le parseur local reste le comportement de repli.
  try {
    const llm = await llmExtract(rawText, settings.currency);
    if (llm) {
      provider = 'llm';
      addExtraction({
        computer_id: params.id, image_id: imageId, provider, raw_text: rawText,
        structured: llm.structured, confidence: llm.confidence, status: 'proposed',
      });
      applyFieldsToComputer(params.id, llm.fields, llm.structured);
      return NextResponse.json({ rawText, provider, source: 'IA', ...llm });
    }
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Extraction IA impossible', canPaste: true },
      { status: 502 }
    );
  }

  const result = parseSpecText(rawText, settings.currency);

  addExtraction({
    computer_id: params.id,
    image_id: imageId,
    provider,
    raw_text: rawText,
    structured: result.structured,
    confidence: result.confidence,
    status: 'proposed',
  });
  applyFieldsToComputer(params.id, result.fields, result.structured);

  return NextResponse.json({
    rawText,
    provider,
    source: 'OCR',
    fields: result.fields,
    structured: result.structured,
    confidence: result.confidence,
  });
}
