import { NextResponse } from 'next/server';
import path from 'node:path';
import fs from 'node:fs';
import { getComputer, getImage, addImage, getDb, listImages, CLEANED_DIR, ORIGINALS_DIR } from '@/lib/db';
import type { ImageRow } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 180;

type Ctx = { params: { id: string } };
type RemovalResult = { method: string; model: string; durationMs: number; warnings: string[] };

let hfModel: any = null;
let hfProcessor: any = null;
let hfLoadPromise: Promise<void> | null = null;

const removalUrl = (process.env.BACKGROUND_REMOVAL_URL || '').replace(/\/$/, '');
const allowedModels = ['birefnet-general-lite', 'birefnet-general'] as const;
type RemovalModel = typeof allowedModels[number];
const configuredModel: RemovalModel = allowedModels.includes(process.env.BACKGROUND_REMOVAL_MODEL as RemovalModel)
  ? process.env.BACKGROUND_REMOVAL_MODEL as RemovalModel
  : 'birefnet-general-lite';
const timeoutMs = Number(process.env.BACKGROUND_REMOVAL_TIMEOUT_MS || 120_000);

function resolveModel(value: unknown): RemovalModel {
  return allowedModels.includes(value as RemovalModel) ? value as RemovalModel : configuredModel;
}

function ownedImage(computerId: string, imageId: string | undefined): ImageRow | null {
  if (!imageId) return null;
  const image = getImage(imageId);
  return image && image.computer_id === computerId ? image : null;
}

function safeImagePath(image: ImageRow): string {
  const dir = image.kind === 'cleaned' ? CLEANED_DIR : ORIGINALS_DIR;
  const result = path.resolve(dir, image.filename);
  if (!result.startsWith(`${path.resolve(dir)}${path.sep}`)) throw new Error('Chemin image invalide');
  return result;
}

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  return fetch(input, { ...init, signal: AbortSignal.timeout(timeoutMs) });
}

async function removeWithRembg(srcPath: string, destPath: string, model: RemovalModel): Promise<RemovalResult> {
  if (!removalUrl) throw new Error('BACKGROUND_REMOVAL_URL non configurée');
  const started = Date.now();
  const input = await fs.promises.readFile(srcPath);
  const form = new FormData();
  form.append('file', new Blob([input], { type: 'image/jpeg' }), path.basename(srcPath));
  // rembg 2.x lit le modèle dans le champ multipart `model`; le query string
  // est ignoré par certaines versions et déclenche alors le modèle par défaut.
  form.append('model', model);
  const url = `${removalUrl}/api/remove`;
  const response = await fetchWithTimeout(url, { method: 'POST', body: form });
  if (!response.ok) throw new Error(`rembg HTTP ${response.status}`);
  const output = Buffer.from(await response.arrayBuffer());
  if (output.length < 100) throw new Error('rembg a renvoyé un fichier vide');
  await fs.promises.writeFile(destPath, output);
  return { method: 'rembg-http', model, durationMs: Date.now() - started, warnings: [] };
}

async function loadHf(): Promise<void> {
  if (hfModel && hfProcessor) return;
  if (hfLoadPromise) return hfLoadPromise;
  hfLoadPromise = (async () => {
    const { AutoModel, AutoProcessor } = await import('@huggingface/transformers');
    const modelId = 'onnx-community/BiRefNet_lite-ONNX';
    hfModel = await AutoModel.from_pretrained(modelId, { dtype: 'fp32', device: 'cpu' });
    hfProcessor = await AutoProcessor.from_pretrained(modelId);
  })();
  try {
    await hfLoadPromise;
  } catch (error) {
    hfLoadPromise = null;
    hfModel = null;
    hfProcessor = null;
    throw error;
  }
}

async function removeWithHf(srcPath: string, destPath: string): Promise<RemovalResult> {
  const started = Date.now();
  const { RawImage } = await import('@huggingface/transformers');
  await loadHf();
  const sharp = (await import('sharp')).default;
  const input = await fs.promises.readFile(srcPath);
  const rgba = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const image = new RawImage(new Uint8Array(rgba.data), rgba.info.width, rgba.info.height, rgba.info.channels);
  const { pixel_values } = await hfProcessor(image);
  const { output_image } = await hfModel({ input_image: pixel_values });
  if (!output_image?.[0]) throw new Error('BiRefNet : sortie de masque absente');
  const mask = await RawImage.fromTensor(output_image[0].sigmoid().mul(255).to('uint8')).resize(image.width, image.height);
  const maskData = mask.data as Uint8Array;
  if (maskData.length !== rgba.info.width * rgba.info.height) throw new Error('BiRefNet : dimensions de masque incohérentes');
  for (let i = 0; i < maskData.length; i++) rgba.data[i * 4 + 3] = maskData[i];
  await sharp(rgba.data, { raw: { width: rgba.info.width, height: rgba.info.height, channels: 4 } }).png({ compressionLevel: 8 }).toFile(destPath);
  return { method: 'hf-birefnet-lite', model: 'onnx-community/BiRefNet_lite-ONNX', durationMs: Date.now() - started, warnings: ['Fallback Node utilisé : rembg HTTP indisponible'] };
}

async function validateOutput(filePath: string): Promise<{ width: number; height: number; coverage: number }> {
  const sharp = (await import('sharp')).default;
  const meta = await sharp(filePath).metadata();
  if (meta.format !== 'png' || meta.channels !== 4 || !meta.width || !meta.height) throw new Error('Sortie invalide : PNG RGBA attendu');
  const { data } = await sharp(filePath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let nonTransparent = 0;
  for (let i = 3; i < data.length; i += 4) if (data[i] > 8) nonTransparent++;
  const coverage = nonTransparent / (meta.width * meta.height);
  if (coverage < 0.01 || coverage > 0.995) throw new Error(`Masque suspect : couverture ${(coverage * 100).toFixed(1)} %`);
  return { width: meta.width, height: meta.height, coverage };
}

export async function POST(req: Request, { params }: Ctx) {
  const computer = getComputer(params.id);
  if (!computer) return NextResponse.json({ error: 'Produit introuvable' }, { status: 404 });
  let body: { imageId?: string; model?: string } = {};
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'JSON invalide' }, { status: 400 }); }
  const requestedModel = resolveModel(body.model);

  const requested = ownedImage(computer.id, body.imageId);
  if (body.imageId && !requested) return NextResponse.json({ error: 'Image inconnue ou non rattachée à ce produit' }, { status: 403 });
  const deterministicCrop = listImages(computer.id).find((i) => i.kind === 'cleaned' && i.derived_from && i.crop_top !== null);
  if (requested?.kind === 'cleaned' && !(requested.crop_top !== null && requested.derived_from)) {
    return NextResponse.json({ error: 'Un détourage IA existant ne peut pas être retraité ; la photo originale ou la découpe produit est requise' }, { status: 409 });
  }
  const source = requested ?? deterministicCrop ?? listImages(computer.id).find((i) => i.kind === 'main');
  if (!source) return NextResponse.json({ error: 'Photo originale principale introuvable' }, { status: 400 });
  const srcPath = safeImagePath(source);
  if (!fs.existsSync(srcPath)) return NextResponse.json({ error: 'Fichier source introuvable' }, { status: 410 });

  const filename = `cutout_${computer.id}_${Date.now()}.png`;
  const destPath = path.join(CLEANED_DIR, filename);
  const tempPath = `${destPath}.tmp`;
  try {
    let result: RemovalResult;
    try {
      result = await removeWithRembg(srcPath, tempPath, requestedModel);
    } catch (rembgError) {
      console.warn('[remove-bg] rembg indisponible, fallback BiRefNet Node :', rembgError);
      result = await removeWithHf(srcPath, tempPath);
      if (requestedModel === 'birefnet-general') result.warnings.push('Le modèle lourd nécessite rembg ; fallback léger utilisé');
    }
    const output = await validateOutput(tempPath);
    await fs.promises.rename(tempPath, destPath);

    const db = getDb();
    const oldCleaned = listImages(computer.id).filter((i) => i.kind === 'cleaned');
    const cleanedRow = addImage(computer.id, 'cleaned', filename, output.width, output.height, null, 'none', source.id);
    for (const old of oldCleaned) {
      try { await fs.promises.unlink(safeImagePath(old)); } catch { /* fichier déjà absent */ }
      db.prepare('DELETE FROM computer_images WHERE id = ?').run(old.id);
    }
    return NextResponse.json({ success: true, method: result.method, model: result.model, durationMs: result.durationMs, maskCoverage: output.coverage, warnings: result.warnings, cleaned: cleanedRow, images: listImages(computer.id) });
  } catch (error) {
    try { await fs.promises.unlink(tempPath); } catch { /* noop */ }
    const message = error instanceof Error ? error.message : String(error);
    console.error('[remove-bg] échec :', message);
    return NextResponse.json({ error: `Détourage échoué : ${message}` }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ configured: Boolean(removalUrl), model: configuredModel, fallback: 'hf-birefnet-lite' });
}
