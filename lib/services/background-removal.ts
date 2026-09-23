export type RemovalResponse = {
  success: true;
  images: any[];
  method: string;
  model: string;
  durationMs: number;
  maskCoverage: number;
  warnings: string[];
};

export async function removeBackgroundServer(
  computerId: string,
  imageId: string,
  onProgress?: (msg: string) => void,
): Promise<RemovalResponse> {
  onProgress?.('Analyse du produit avec le moteur de détourage local…');
  const res = await fetch(`/api/computers/${computerId}/remove-bg`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageId }),
    signal: AbortSignal.timeout(190_000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Erreur serveur : ${res.status}`);
  return data as RemovalResponse;
}

/** Dernier secours volontairement limité aux fonds blancs uniformes. */
export async function removeBackgroundClient(imageSrc: string): Promise<Blob> {
  if (typeof window === 'undefined') throw new Error('Le détourage client nécessite un navigateur');
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('Canvas indisponible'));
      ctx.drawImage(image, 0, 0);
      const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
      for (let i = 0; i < pixels.data.length; i += 4) {
        if (pixels.data[i] > 235 && pixels.data[i + 1] > 235 && pixels.data[i + 2] > 235) pixels.data[i + 3] = 0;
      }
      ctx.putImageData(pixels, 0, 0);
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('PNG impossible à produire')), 'image/png');
    };
    image.onerror = () => reject(new Error('Image non chargeable'));
    image.src = imageSrc;
  });
}
