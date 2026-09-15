import { NextResponse } from 'next/server';
import path from 'node:path';
import sharp from 'sharp';
import { getSettings, ORIGINALS_DIR } from '@/lib/db';
import { saveImage, extractTopZone, ALLOWED_MIME, MAX_UPLOAD_BYTES } from '@/lib/services/image-service';
import { ocrImage } from '@/lib/services/ocr-service';
import { parseSpecText } from '@/lib/services/spec-parser';
import { parseStandardInput } from '@/lib/services/standard-format';
import { llmExtract, getLlmConfig } from '@/lib/services/ai-extract';
import type { Condition, StorageType } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export type CropBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type AnalyzedRawItem = {
  id: string;
  filename: string;
  width: number;
  height: number;
  previewUrl: string;
  cropBox?: CropBox | null;
  rawText: string;
  usedAi: boolean;
  brand: string;
  model: string;
  processor: string;
  ram_gb: number | null;
  storage_capacity_gb: number | null;
  storage_type: StorageType | null;
  screen_size: number | null;
  screen_resolution: string;
  graphics: string;
  price_amount: number | null;
  currency: string;
  condition: Condition;
  status: string;
};

export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Envoi invalide (FormData attendu)' }, { status: 400 });
  }

  const files = form.getAll('files').filter((f): f is File => f instanceof File);
  if (!files.length) {
    const single = form.get('file');
    if (single instanceof File) files.push(single);
  }

  // Permet aussi d'analyser un fichier existant déjà sur le disque via son filename
  const existingFilename = form.get('existingFilename')?.toString();
  const cropDataStr = form.get('cropBox')?.toString();
  let cropBoxInput: CropBox | null = null;
  if (cropDataStr) {
    try {
      cropBoxInput = JSON.parse(cropDataStr);
    } catch {
      cropBoxInput = null;
    }
  }

  if (!files.length && !existingFilename) {
    return NextResponse.json({ error: 'Aucun fichier image n’a été sélectionné' }, { status: 400 });
  }

  const settings = getSettings();
  const aiConfigured = !!getLlmConfig();
  const analyzedItems: AnalyzedRawItem[] = [];

  // Traitement si ré-analyse d'un fichier existant avec recadrage
  if (existingFilename && !files.length) {
    const origAbs = path.join(ORIGINALS_DIR, existingFilename);
    try {
      const fs = await import('node:fs/promises');
      const buffer = await fs.readFile(origAbs);
      const meta = await sharp(buffer).metadata();
      const imgWidth = meta.width || 1080;
      const imgHeight = meta.height || 1080;

      let rawText = '';
      if (cropBoxInput && cropBoxInput.width > 0 && cropBoxInput.height > 0) {
        try {
          const left = Math.max(0, Math.round((cropBoxInput.x / 100) * imgWidth));
          const top = Math.max(0, Math.round((cropBoxInput.y / 100) * imgHeight));
          const width = Math.min(imgWidth - left, Math.round((cropBoxInput.width / 100) * imgWidth));
          const height = Math.min(imgHeight - top, Math.round((cropBoxInput.height / 100) * imgHeight));

          const croppedBuf = await sharp(buffer)
            .extract({ left, top, width, height })
            .toBuffer();
          const cropOcr = await ocrImage(croppedBuf);
          rawText = cropOcr.text;
        } catch {
          const fullOcr = await ocrImage(buffer);
          rawText = fullOcr.text;
        }
      } else {
        const fullOcr = await ocrImage(buffer);
        rawText = fullOcr.text;
      }

      let parsedStruct: Record<string, unknown> = {};
      let usedAi = false;

      if (rawText.trim()) {
        try {
          const llm = await llmExtract(rawText, settings.currency);
          if (llm && Object.keys(llm.structured).length > 0) {
            parsedStruct = llm.structured;
            usedAi = true;
          }
        } catch (aiErr) {
          console.warn(`[Batch OCR] Repli sur parseur local pour ${existingFilename}:`, aiErr);
        }

        if (!usedAi) {
          try {
            const std = parseStandardInput(rawText, settings.currency);
            parsedStruct = std.structured;
          } catch {
            const sp = parseSpecText(rawText, settings.currency);
            parsedStruct = sp.structured;
          }
        }
      }

      const brand = String(parsedStruct.brand || parsedStruct.marque || '').trim();
      const model = String(parsedStruct.model || parsedStruct.modele || '').trim();
      const processor = String(parsedStruct.processor || parsedStruct.processeur || '').trim();
      const ram_gb = typeof parsedStruct.ram_gb === 'number' ? parsedStruct.ram_gb : null;

      let storage_capacity_gb: number | null = null;
      let storage_type: StorageType | null = null;
      if (parsedStruct.storage && typeof parsedStruct.storage === 'object') {
        const st = parsedStruct.storage as { go?: number; type?: StorageType };
        storage_capacity_gb = typeof st.go === 'number' ? st.go : null;
        storage_type = st.type || null;
      } else if (typeof parsedStruct.storage_capacity_gb === 'number') {
        storage_capacity_gb = parsedStruct.storage_capacity_gb;
      }

      let screen_size: number | null = null;
      let screen_resolution = '';
      if (parsedStruct.screen && typeof parsedStruct.screen === 'object') {
        const sc = parsedStruct.screen as { pouces?: number; resolution?: string };
        screen_size = typeof sc.pouces === 'number' ? sc.pouces : null;
        screen_resolution = sc.resolution || '';
      }

      const graphics = String(parsedStruct.graphics || parsedStruct.graphique || '').trim();
      const price_amount = typeof parsedStruct.price_amount === 'number' && parsedStruct.price_amount > 0
        ? parsedStruct.price_amount
        : (typeof parsedStruct.prix === 'number' && parsedStruct.prix > 0 ? parsedStruct.prix : null);

      analyzedItems.push({
        id: `raw-${Date.now()}-0-${Math.random().toString(36).slice(2, 6)}`,
        filename: existingFilename,
        width: imgWidth,
        height: imgHeight,
        previewUrl: `/api/batch-raw-images/temp-preview?filename=${existingFilename}`,
        cropBox: cropBoxInput,
        rawText,
        usedAi,
        brand,
        model,
        processor,
        ram_gb,
        storage_capacity_gb,
        storage_type,
        screen_size,
        screen_resolution,
        graphics,
        price_amount,
        currency: settings.currency || 'FCFA',
        condition: 'bon',
        status: 'available',
      });
    } catch (err) {
      console.error(`Erreur ré-analyse ${existingFilename}:`, err);
    }

    return NextResponse.json({ items: analyzedItems, aiConfigured });
  }

  // Traitement classique des nouveaux fichiers téléversés
  for (let idx = 0; idx < files.length; idx++) {
    const file = files[idx];
    if (file.size > MAX_UPLOAD_BYTES) continue;
    const ext = ALLOWED_MIME[file.type] || 'jpg';

    try {
      const buffer = Buffer.from(await file.arrayBuffer());
      const saved = await saveImage(buffer, 'originals', ext);
      const origAbs = path.join(ORIGINALS_DIR, saved.filename);

      let rawText = '';
      if (cropBoxInput && cropBoxInput.width > 0 && cropBoxInput.height > 0) {
        try {
          const left = Math.max(0, Math.round((cropBoxInput.x / 100) * saved.width));
          const top = Math.max(0, Math.round((cropBoxInput.y / 100) * saved.height));
          const width = Math.min(saved.width - left, Math.round((cropBoxInput.width / 100) * saved.width));
          const height = Math.min(saved.height - top, Math.round((cropBoxInput.height / 100) * saved.height));

          const croppedBuf = await sharp(buffer)
            .extract({ left, top, width, height })
            .toBuffer();
          const cropOcr = await ocrImage(croppedBuf);
          rawText = cropOcr.text;
        } catch {
          const fullOcr = await ocrImage(buffer);
          rawText = fullOcr.text;
        }
      } else {
        try {
          const fullOcr = await ocrImage(buffer);
          rawText = fullOcr.text;
        } catch {
          try {
            const defaultCropTop = Math.round(0.40 * saved.height);
            const zoneBuf = await extractTopZone(origAbs, defaultCropTop);
            const zoneOcr = await ocrImage(zoneBuf);
            rawText = zoneOcr.text;
          } catch {
            rawText = '';
          }
        }
      }

      // Traitement des données brutes par l'IA en arrière-plan (Groq / LLM compatible OpenAI)
      let parsedStruct: Record<string, unknown> = {};
      let usedAi = false;

      if (rawText.trim()) {
        try {
          const llm = await llmExtract(rawText, settings.currency);
          if (llm && Object.keys(llm.structured).length > 0) {
            parsedStruct = llm.structured;
            usedAi = true;
          }
        } catch (aiErr) {
          console.warn(`[Batch OCR] Repli sur parseur local pour ${file.name}:`, aiErr);
        }

        if (!usedAi) {
          try {
            const std = parseStandardInput(rawText, settings.currency);
            parsedStruct = std.structured;
          } catch {
            const sp = parseSpecText(rawText, settings.currency);
            parsedStruct = sp.structured;
          }
        }
      }

      // Mapping propre des champs extraits
      const brand = String(parsedStruct.brand || parsedStruct.marque || '').trim();
      const model = String(parsedStruct.model || parsedStruct.modele || '').trim();
      const processor = String(parsedStruct.processor || parsedStruct.processeur || '').trim();
      const ram_gb = typeof parsedStruct.ram_gb === 'number' ? parsedStruct.ram_gb : null;
      
      let storage_capacity_gb: number | null = null;
      let storage_type: StorageType | null = null;
      if (parsedStruct.storage && typeof parsedStruct.storage === 'object') {
        const st = parsedStruct.storage as { go?: number; type?: StorageType };
        storage_capacity_gb = typeof st.go === 'number' ? st.go : null;
        storage_type = st.type || null;
      } else if (typeof parsedStruct.storage_capacity_gb === 'number') {
        storage_capacity_gb = parsedStruct.storage_capacity_gb;
      }

      let screen_size: number | null = null;
      let screen_resolution = '';
      if (parsedStruct.screen && typeof parsedStruct.screen === 'object') {
        const sc = parsedStruct.screen as { pouces?: number; resolution?: string };
        screen_size = typeof sc.pouces === 'number' ? sc.pouces : null;
        screen_resolution = sc.resolution || '';
      }

      const graphics = String(parsedStruct.graphics || parsedStruct.graphique || '').trim();
      const price_amount = typeof parsedStruct.price_amount === 'number' && parsedStruct.price_amount > 0
        ? parsedStruct.price_amount
        : (typeof parsedStruct.prix === 'number' && parsedStruct.prix > 0 ? parsedStruct.prix : null);

      analyzedItems.push({
        id: `raw-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
        filename: saved.filename,
        width: saved.width,
        height: saved.height,
        previewUrl: `/api/batch-raw-images/temp-preview?filename=${saved.filename}`,
        rawText,
        usedAi,
        brand,
        model,
        processor,
        ram_gb,
        storage_capacity_gb,
        storage_type,
        screen_size,
        screen_resolution,
        graphics,
        price_amount,
        currency: settings.currency || 'FCFA',
        condition: 'bon',
        status: 'available',
      });
    } catch (err) {
      console.error(`Erreur analyse image brute ${file.name}:`, err);
    }
  }

  return NextResponse.json({ items: analyzedItems, aiConfigured });
}
