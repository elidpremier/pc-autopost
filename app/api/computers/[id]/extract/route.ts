import { NextResponse } from 'next/server';
import path from 'node:path';
import { getComputer, getImage, addExtraction, getSettings, ORIGINALS_DIR } from '@/lib/db';
import { extractTopZone } from '@/lib/services/image-service';
import { ocrImage } from '@/lib/services/ocr-service';
import { parseSpecText } from '@/lib/services/spec-parser';
import { parseStandardInput, looksLikeJson } from '@/lib/services/standard-format';
import { llmExtract } from '@/lib/services/ai-extract';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

type Ctx = { params: { id: string } };

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
      return NextResponse.json({ error: 'Photo principale introuvable. Téléversez d’abord la photo-fiche.' }, { status: 400 });
    }
    const ratio = body.cropRatio;
    if (!Number.isFinite(ratio as number) || (ratio as number) <= 0.02 || (ratio as number) >= 0.95) {
      return NextResponse.json({ error: 'Position de recadrage invalide. Déplacez la ligne sur l’aperçu.' }, { status: 400 });
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

  return NextResponse.json({
    rawText,
    provider,
    source: 'OCR',
    fields: result.fields,
    structured: result.structured,
    confidence: result.confidence,
  });
}
