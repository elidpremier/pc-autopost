import fs from 'node:fs';

export type FacebookTestResult = {
  success: boolean;
  pageName?: string;
  pageId?: string;
  pictureUrl?: string;
  error?: string;
};

export type FacebookPublishResult = {
  success: boolean;
  id?: string;
  postUrl?: string;
  error?: string;
};

/**
 * Teste les identifiants Facebook (Page ID + Page Access Token).
 */
export async function testFacebookConnection(
  pageId: string,
  accessToken: string
): Promise<FacebookTestResult> {
  const cleanId = (pageId || '').trim();
  const cleanToken = (accessToken || '').trim();

  if (!cleanId) return { success: false, error: 'Identifiant de Page (Page ID) manquant.' };
  if (!cleanToken) return { success: false, error: "Jeton d'accès de Page (Page Access Token) manquant." };

  try {
    const url = `https://graph.facebook.com/v19.0/${cleanId}?fields=id,name,picture&access_token=${encodeURIComponent(cleanToken)}`;
    const res = await fetch(url);
    const data = await res.json();

    if (!res.ok || data.error) {
      const msg = data.error?.message || `Erreur Facebook API (${res.status})`;
      return { success: false, error: msg };
    }

    return {
      success: true,
      pageId: data.id,
      pageName: data.name,
      pictureUrl: data.picture?.data?.url,
    };
  } catch (err: any) {
    return {
      success: false,
      error: `Impossible de contacter l'API Meta Graph: ${err?.message || 'Erreur réseau'}`,
    };
  }
}

/**
 * Publie une photo avec légende sur la Page Facebook via l'API Graph.
 * Accepte soit un Buffer d'image en mémoire, soit un chemin de fichier sur disque.
 */
export async function publishToFacebookPage(params: {
  pageId: string;
  accessToken: string;
  caption: string;
  /** Buffer d'image (prioritaire) */
  imageBuffer?: Buffer;
  /** Chemin fichier sur disque (fallback, si imageBuffer absent) */
  imagePath?: string;
}): Promise<FacebookPublishResult> {
  const { pageId, accessToken, caption, imageBuffer, imagePath } = params;

  const cleanId = (pageId || '').trim();
  const cleanToken = (accessToken || '').trim();

  if (!cleanId || !cleanToken) {
    return { success: false, error: 'Veuillez configurer votre Page ID et votre Access Token dans les Réglages.' };
  }

  let fileBuffer: Buffer;

  if (imageBuffer) {
    fileBuffer = imageBuffer;
  } else if (imagePath) {
    if (!fs.existsSync(imagePath)) {
      return { success: false, error: "Fichier d'image généré introuvable sur le disque." };
    }
    fileBuffer = fs.readFileSync(imagePath);
  } else {
    return { success: false, error: "Aucune image fournie pour la publication." };
  }

  try {
    const blob = new Blob([new Uint8Array(fileBuffer)], { type: 'image/jpeg' });

    const formData = new FormData();
    formData.append('access_token', cleanToken);
    formData.append('message', caption);
    formData.append('source', blob, 'post.jpg');

    const url = `https://graph.facebook.com/v19.0/${cleanId}/photos`;
    const res = await fetch(url, {
      method: 'POST',
      body: formData,
    });

    const data = await res.json();

    if (!res.ok || data.error) {
      const msg = data.error?.message || `Échec de la publication Facebook (${res.status})`;
      return { success: false, error: msg };
    }

    const photoId = data.id;
    const postId = data.post_id || photoId;
    const postUrl = `https://www.facebook.com/${postId}`;

    return {
      success: true,
      id: postId,
      postUrl,
    };
  } catch (err: any) {
    return {
      success: false,
      error: `Erreur lors de la publication sur Facebook: ${err?.message || 'Erreur inconnue'}`,
    };
  }
}
