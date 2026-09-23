/**
 * Web Worker — Détourage IA BiRefNet_lite (v4 — WASM local)
 * ===========================================================
 * Servi depuis /public/workers/birefnet-worker.js
 *
 * Correction clé : env.backends.onnx.wasm.wasmPaths pointe vers /ort-wasm/
 * (fichiers WASM copiés depuis node_modules/onnxruntime-web/dist/ dans /public/)
 * → Évite les échecs de résolution WASM depuis un worker CDN
 */

const HF_CDN = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.0/+esm';

let segmenter = null;

async function getSegmenter() {
  if (segmenter) return segmenter;

  self.postMessage({ type: 'progress', message: 'Chargement Transformers.js…' });
  const mod = await import(HF_CDN);
  const { pipeline, env } = mod;

  // ── Configuration ONNX Runtime ───────────────────────────────────────
  if (env) {
    env.allowLocalModels = false;
    env.useBrowserCache = true;
    // Pointer vers les fichiers WASM locaux (copiés dans /public/ort-wasm/)
    // C'est la correction essentielle pour éviter les échecs en Web Worker
    env.backends.onnx.wasm.wasmPaths = '/ort-wasm/';
    // 1 thread = plus compatible (évite les problèmes SharedArrayBuffer)
    env.backends.onnx.wasm.numThreads = 1;
  }

  self.postMessage({ type: 'progress', message: 'Téléchargement BiRefNet_lite (~224 Mo, mis en cache après la 1ère fois)…' });

  segmenter = await pipeline(
    'image-segmentation',
    'onnx-community/BiRefNet_lite-ONNX',
    { dtype: 'fp32' }
  );

  self.postMessage({ type: 'progress', message: 'Modèle BiRefNet_lite prêt, segmentation…' });
  return segmenter;
}

self.onmessage = async (event) => {
  const { type, imageUrl } = event.data;
  if (type !== 'segment') return;

  try {
    const seg = await getSegmenter();

    // ── Inférence BiRefNet ───────────────────────────────────────────────
    self.postMessage({ type: 'progress', message: 'Analyse IA de l\'objet en cours…' });
    const output = await seg(imageUrl);

    if (!Array.isArray(output) || output.length === 0) {
      throw new Error('BiRefNet : aucun segment retourné');
    }

    // Segment "foreground" = le PC. Si absent, utiliser output[0] et inverser
    const fgSeg = output.find(s => s.label === 'foreground');
    const bgSeg = output.find(s => s.label === 'background');
    const segment = fgSeg ?? output[0];
    const invertMask = !fgSeg && !!bgSeg;

    if (!segment?.mask) throw new Error('BiRefNet : masque absent');

    const mask = segment.mask; // RawImage mode L (1 canal grayscale)
    const maskW = mask.width;
    const maskH = mask.height;
    const maskData = mask.data; // Uint8ClampedArray, 1 valeur/pixel

    // ── Charger l'image originale ────────────────────────────────────────
    self.postMessage({ type: 'progress', message: 'Application du masque de transparence…' });
    const resp = await fetch(imageUrl);
    if (!resp.ok) throw new Error(`Image non chargeable : ${resp.status}`);
    const imgBlob = await resp.blob();
    const bitmap = await createImageBitmap(imgBlob);
    const W = bitmap.width;
    const H = bitmap.height;

    // ── OffscreenCanvas : image + masque alpha ───────────────────────────
    const canvas = new OffscreenCanvas(W, H);
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(bitmap, 0, 0, W, H);
    const imgData = ctx.getImageData(0, 0, W, H);
    const px = imgData.data; // RGBA

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const pi = (y * W + x) * 4;
        // Projection pixel → masque (résolutions potentiellement différentes)
        const mx = Math.min(maskW - 1, Math.round((x / (W - 1 || 1)) * (maskW - 1)));
        const my = Math.min(maskH - 1, Math.round((y / (H - 1 || 1)) * (maskH - 1)));
        const mi = my * maskW + mx;
        let alpha = maskData[mi] ?? 0;
        if (invertMask) alpha = 255 - alpha;
        // Uniquement le canal alpha — R, G, B restent STRICTEMENT non modifiés
        px[pi + 3] = alpha;
      }
    }
    ctx.putImageData(imgData, 0, 0);

    const blob = await canvas.convertToBlob({ type: 'image/png', quality: 0.97 });
    self.postMessage({ type: 'done', blob });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[BiRefNet Worker]', msg);
    self.postMessage({ type: 'error', message: msg });
  }
};
