import { NextResponse } from 'next/server';
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { CLEANED_DIR, ORIGINALS_DIR } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const maxDuration = 600;

type Model = 'birefnet-general-lite' | 'birefnet-general';

type BatchItem = { id: string; filename: string };

let liteModel: any = null;
let liteProcessor: any = null;
let liteLoadPromise: Promise<void> | null = null;

async function loadLite(): Promise<void> {
  if (liteModel && liteProcessor) return;
  if (liteLoadPromise) return liteLoadPromise;
  liteLoadPromise = (async () => {
    const { AutoModel, AutoProcessor } = await import('@huggingface/transformers');
    const modelId = 'onnx-community/BiRefNet_lite-ONNX';
    liteProcessor = await AutoProcessor.from_pretrained(modelId);
    liteModel = await AutoModel.from_pretrained(modelId, { dtype: 'fp32', device: 'cpu' });
  })();
  try { await liteLoadPromise; } catch (error) {
    liteLoadPromise = null;
    liteModel = null;
    liteProcessor = null;
    throw error;
  }
}

async function removeWithLite(srcPath: string, destPath: string): Promise<void> {
  const { RawImage } = await import('@huggingface/transformers');
  await loadLite();
  const input = await fs.readFile(srcPath);
  const rgba = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const image = new RawImage(new Uint8Array(rgba.data), rgba.info.width, rgba.info.height, rgba.info.channels);
  const { pixel_values } = await liteProcessor(image);
  const { output_image } = await liteModel({ input_image: pixel_values });
  if (!output_image?.[0]) throw new Error('BiRefNet Lite : sortie de masque absente');
  const mask = await RawImage.fromTensor(output_image[0].sigmoid().mul(255).to('uint8')).resize(image.width, image.height);
  const maskData = mask.data as Uint8Array;
  for (let i = 0; i < maskData.length; i++) rgba.data[i * 4 + 3] = maskData[i];
  await sharp(rgba.data, { raw: { width: rgba.info.width, height: rgba.info.height, channels: 4 } }).png({ compressionLevel: 8 }).toFile(destPath);
}

async function removeWithRembg(srcPath: string, destPath: string): Promise<void> {
  const baseUrl = (process.env.BACKGROUND_REMOVAL_URL || 'http://127.0.0.1:7000').replace(/\/$/, '');
  const input = await fs.readFile(srcPath);
  const form = new FormData();
  form.append('file', new Blob([input], { type: 'image/jpeg' }), path.basename(srcPath));
  form.append('model', 'birefnet-general');
  const response = await fetch(`${baseUrl}/api/remove`, { method: 'POST', body: form, signal: AbortSignal.timeout(600_000) });
  if (!response.ok) throw new Error(`rembg HTTP ${response.status}`);
  await fs.writeFile(destPath, Buffer.from(await response.arrayBuffer()));
}

export async function POST(req: Request) {
  let body: { items?: BatchItem[]; model?: Model };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'JSON invalide' }, { status: 400 }); }
  const items = Array.isArray(body.items) ? body.items : [];
  const model: Model = body.model === 'birefnet-general' ? body.model : 'birefnet-general-lite';
  if (!items.length) return NextResponse.json({ error: 'Aucune photo à détourer' }, { status: 400 });

  await fs.mkdir(CLEANED_DIR, { recursive: true });
  const results: Array<{ id: string; cutoutFilename?: string; error?: string }> = [];
  for (const item of items) {
    const source = path.join(ORIGINALS_DIR, path.basename(item.filename));
    const filename = `batch-cutout-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`;
    const destination = path.join(CLEANED_DIR, filename);
    try {
      if (model === 'birefnet-general') await removeWithRembg(source, destination);
      else await removeWithLite(source, destination);
      results.push({ id: item.id, cutoutFilename: filename });
    } catch (error) {
      results.push({ id: item.id, error: error instanceof Error ? error.message : String(error) });
    }
  }
  return NextResponse.json({ model, results });
}
