// Service OCR optionnel (spec §10.3 : le cœur de l'app doit fonctionner sans IA/OCR).
// Fournisseur : Tesseract.js local (eng + fra). En cas d'échec, l'API renvoie une
// erreur explicite et l'utilisateur peut coller le texte de la fiche manuellement.

type Worker = {
  recognize: (image: Buffer | string) => Promise<{ data: { text: string } }>;
  terminate?: () => Promise<void>;
};

let workerPromise: Promise<Worker> | null = null;

async function getWorker(): Promise<Worker> {
  if (!workerPromise) {
    const T = await import('tesseract.js');
    // createWorker télécharge les modèles au premier usage (mis en cache ensuite).
    workerPromise = T.createWorker(['eng', 'fra']).then((w) => w as unknown as Worker);
  }
  return workerPromise;
}

export type OcrResult = { text: string; provider: string };

/** Libère le worker (utile pour les scripts CLI ; le serveur Next.js peut le garder en mémoire). */
export async function terminateOcrWorker(): Promise<void> {
  if (workerPromise) {
    try {
      const worker = await workerPromise;
      await worker.terminate?.();
    } catch {
      /* noop */
    }
    workerPromise = null;
  }
}

export async function ocrImage(jpegBuffer: Buffer, timeoutMs = 120000): Promise<OcrResult> {
  try {
    const worker = await getWorker();
    const result = await Promise.race([
      worker.recognize(jpegBuffer),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Délai d’OCR dépassé')), timeoutMs)),
    ]);
    const text = (result.data?.text ?? '').trim();
    return { text, provider: 'tesseract' };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`OCR indisponible (${msg}). Vous pouvez coller le texte de la fiche manuellement.`);
  }
}
