/**
 * Service de Détourage Automatique par IA — v5
 * ===============================================
 * Cascade 3 niveaux :
 *
 * Niveau 1 (Optimal) : API serveur /remove-bg
 *   → BiRefNet_lite via @huggingface/transformers + onnxruntime-node
 *   → Masque appliqué avec Sharp côté serveur
 *   → Aucun WASM navigateur, aucun problème Worker/CORS
 *   → Modèle mis en cache sur le serveur après 1er téléchargement
 *
 * Niveau 2 (Fallback CDN) : @imgly/background-removal CDN
 *   → RMBG-1.4 via jsdelivr ESM — qualité moindre sur objets sombres
 *
 * Niveau 3 (Fallback sécurisé) : Canvas seuillage
 *   → Fond blanc/clair uniquement
 */

/**
 * Niveau 1 : Appel API serveur — BiRefNet_lite (Node.js + Sharp)
 * Retourne { success, images } et enregistre directement en BDD.
 * computerId est requis pour identifier l'endpoint correct.
 */
export async function removeBackgroundServer(
  computerId: string,
  imageId: string,
  onProgress?: (msg: string) => void
): Promise<{ success: true; images: any[] }> {
  onProgress?.('Connexion au service de détourage serveur (BiRefNet_lite)…');

  const res = await fetch(`/api/computers/${computerId}/remove-bg`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageId }),
    // Timeout long : 1ère fois = téléchargement 224 Mo + inférence (~3-10 min)
    signal: AbortSignal.timeout(660_000), // 11 minutes
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Erreur serveur : ${res.status}`);
  }

  const data = await res.json();
  return data;
}

/**
 * Point d'entrée navigateur — utilisé quand le serveur n'est pas disponible
 * ou pour les fallbacks.
 * Retourne un Blob PNG transparent.
 */
export async function removeBackgroundClient(
  imageSrc: string,
  onProgress?: (msg: string) => void
): Promise<Blob> {
  if (typeof window === 'undefined') {
    throw new Error("Le détourage client s'exécute uniquement dans le navigateur");
  }

  const absoluteUrl = imageSrc.startsWith('http')
    ? imageSrc
    : `${window.location.origin}${imageSrc.startsWith('/') ? '' : '/'}${imageSrc}`;

  // ─── Niveau 2 : RMBG-1.4 via CDN ESM ──────────────────────────────────
  try {
    onProgress?.('Détourage RMBG-1.4 (CDN fallback)…');
    const blob = await runRmbgCdn(absoluteUrl, onProgress);
    return blob;
  } catch (e2) {
    console.warn('[Détourage] RMBG CDN échoué :', e2);
    onProgress?.('CDN indisponible, passage Canvas seuillage…');
  }

  // ─── Niveau 3 : Canvas seuillage luminance ─────────────────────────────
  onProgress?.('Détourage Canvas (fond blanc/studio)…');
  return fallbackCanvasCutout(absoluteUrl);
}

/**
 * Niveau 2 : RMBG-1.4 via @imgly CDN ESM
 */
async function runRmbgCdn(
  absoluteImageUrl: string,
  onProgress?: (msg: string) => void
): Promise<Blob> {
  onProgress?.('Chargement RMBG-1.4 (CDN)…');
  const cdnUrl = 'https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.5.5/+esm';
  const mod = await import(/* webpackIgnore: true */ cdnUrl);
  const removeFn = mod.removeBackground ?? mod.default;

  if (typeof removeFn !== 'function') {
    throw new Error('RMBG-1.4 : removeBackground introuvable dans le module CDN');
  }

  onProgress?.('RMBG-1.4 : segmentation en cours…');
  const imgResp = await fetch(absoluteImageUrl);
  const imgBlob = await imgResp.blob();

  return await removeFn(imgBlob, {
    output: { format: 'image/png', quality: 0.97 },
    model: 'medium',
    progress: (_k: string, current: number, total: number) => {
      if (total > 0) onProgress?.(`RMBG-1.4 : ${Math.round((current / total) * 100)}%`);
    },
  });
}

/**
 * Niveau 3 : Canvas seuillage luminance (fond blanc/studio)
 */
async function fallbackCanvasCutout(imageSrc: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('Canvas non disponible'));
      ctx.drawImage(img, 0, 0);
      const d = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      for (let i = 0; i < d.length; i += 4) {
        if (d[i] > 235 && d[i + 1] > 235 && d[i + 2] > 235) d[i + 3] = 0;
      }
      ctx.putImageData(new ImageData(d, canvas.width, canvas.height), 0, 0);
      canvas.toBlob((b) => b ? resolve(b) : reject(new Error('Erreur PNG')), 'image/png');
    };
    img.onerror = () => reject(new Error('Erreur chargement image'));
    img.src = imageSrc;
  });
}
