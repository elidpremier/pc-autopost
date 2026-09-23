// Extraction par IA optionnelle (OpenAI-compatible).
// Activée uniquement si PC_AUTOPOST_LLM_API_KEY est définie dans l'environnement
// (.env.local). Sans clé, l'application utilise le parseur local déterministe :
// le cœur du produit reste 100 % fonctionnel hors IA (spec §10.3).

import { parseStandardInput, STANDARD_JSON_TEMPLATE } from './standard-format';

const SYSTEM_PROMPT = `Tu es un extracteur de fiches techniques d'ordinateurs.
À partir du texte fourni (capture lue par OCR, copier-collé ou libre), renvoie UNIQUEMENT un objet JSON valide au format exact ci-dessous, sans commentaire, sans markdown, sans balise de code.
DÉBUTE ta réponse directement par { et termine par }. Ne mets rien avant ni après.
Utilise null pour les valeurs absentes. N'invente JAMAIS une valeur absente.

Règles marque & modèle (CRITIQUE) :
- "marque" : La marque exacte (ex: "HP", "Dell", "Lenovo", "Acer", "Asus", "Apple", "MSI", "Samsung", "Microsoft", "Toshiba"). NE PAS inclure la gamme ou le modèle dans la marque.
- "modele" : Le MODÈLE OU LA GAMME commerciale UNIQUEMENT (ex: "ThinkBook 15", "ThinkBook", "ThinkPad X1 Carbon", "Latitude 5420", "EliteBook 840 G8", "Inspiron 15", "Pavilion 14", "Spectre x360", "MacBook Pro 14").
- Ne JAMAIS inclure le processeur (ex: "core i5", "i7", "11ème génération", "8th", "Ryzen", "2.42GHz", "processeur") ni aucune caractéristique technique (RAM, SSD, Go, Hz) dans le champ "modele" !
- Exemple : Si le texte dit "Lenovo ThinkBook core i5 11ème génération", alors "marque" est "Lenovo", "modele" est "ThinkBook 15" (ou "ThinkBook") et "processeur" est "i5-11th".

Règles processeur :
- Format standard et uniformisé pour "processeur".
- Lorsque le modèle exact n'est pas précisé mais que la génération est indiquée, utilise la forme abrégée : "i3-Xth", "i5-Xth", "i7-Xth", "i9-Xth" (ex: "i7-11th", "i5-10th", "i5-8th").
- Si le modèle complet est présent, garde-le de manière concise (ex: "Core i5-1145G7", "Ryzen 5 5500U", "Apple M1").
- CŒURS ET THREADS : Si le nombre de cœurs et/ou threads est mentionné (ex: 4 cœurs 8 threads, 4 cores 8 processors), AJOUTE-LE OBLIGATOIREMENT à la fin du processeur sous la forme "(X coeurs, Y threads)" ou "(X coeurs)" (ex: "i7-11th (4 coeurs, 8 threads)", "Core i5-1145G7 (4 coeurs, 8 threads)").
- Ne JAMAIS inclure les fréquences d'horloge en GHz ou MHz (retire systématiquement "@ 2.40GHz", "2.8GHz", etc.).

Règles carte graphique :
- Format standard et épuré pour "graphique".
- Supprimer impérativement les mentions parasites et marques déposées : "(R)", "(TM)", "Laptop GPU", "Mobile GPU", "Controller", "Display Adapter", "Family".
- Standardiser selon les gammes :
  * Intel : "Intel Iris Xe", "Intel Iris Plus", "Intel UHD Graphics [modèle]", "Intel HD Graphics [modèle]", "Intel Arc [modèle]", "Intel Graphics"
  * NPU / Accélérateurs IA : "Intel NPU", "Intel AI Boost", "AMD Ryzen AI NPU", "Qualcomm Hexagon NPU", "Apple Neural Engine"
  * NVIDIA : "NVIDIA GeForce RTX [modèle]", "NVIDIA GeForce GTX [modèle]", "NVIDIA GeForce MX[modèle]", "NVIDIA Quadro [modèle]", "NVIDIA RTX [modèle]"
  * AMD : "AMD Radeon [modèle]", "AMD Radeon Vega [chiffre]", "AMD Radeon RX [modèle]", "AMD Radeon Pro [modèle]"
- DÉDIÉE vs INTÉGRÉE :
  * Si c'est une carte graphique DÉDIÉE (NVIDIA RTX/GTX/MX/Quadro, AMD Radeon RX/Pro, Intel Arc A/B) et que la VRAM dédiée est précisée (en Go ou Mo, ex: 4Go, 512Mo, 6GB), l'ajouter entre parenthèses à la fin : "(4 Go)" ou "(512 Mo)" (ex: "NVIDIA GeForce RTX 3050 (4 Go)").
  * Si c'est une carte graphique INTÉGRÉE (Intel Iris Xe, Intel UHD/HD, Intel Arc Graphics, AMD Radeon/Vega/780M, Apple M-series GPU) ou un NPU (Intel NPU, Intel AI Boost, AMD Ryzen AI NPU), NE JAMAIS ajouter de VRAM ou mémoire partagée. Spécifier la carte/NPU seule (ex: "Intel Iris Xe", "Intel NPU").

Règles écran (IMPORTANT) :
- Format pour "ecran" : {"pouces": nombre_ou_null, "resolution": "résolution_ou_null"}.
- Cherche la taille de l'écran PARTOUT dans le texte, y compris : "écran14", "ecran14", "14 pouces", "15,6\"", "14-inch".
- Valeurs valides pour les pouces : entre 10 et 23. Ignore toutes les autres valeurs numériques.
- Si l'écran est tactile (ex: "tactile", "touchscreen", "touch"), l'indiquer OBLIGATOIREMENT dans la résolution (ex: "Full HD Tactile").
- Si l'écran est convertible / pliable 360° (ex: "x360", "360°", "360", "convertible", "pliable"), l'indiquer OBLIGATOIREMENT dans la résolution sous la forme "Full HD Tactile x360", "Tactile x360" ou "x360".
- Ne JAMAIS confondre la taille de l'écran avec la RAM, le stockage, les coeurs ou les threads.

Règles stockage (IMPORTANT) :
- Valeurs réalistes : entre 32 Go et 8192 Go (8 To). Toute valeur hors de cette plage est une erreur OCR à corriger.
- Si le texte dit "1512Go", c'est probablement "512Go" ou "1To" (1024Go) — choisir la valeur la plus réaliste selon le contexte.
- Format : {"go": nombre_entier, "type": "SSD"|"HDD"|"NVMe"|"eMMC"|null}.

Règles ports & connectiques :
- Extraire sous forme de tableau JSON tous les ports repérés dans la fiche ou la description (ex: ["USB-C", "HDMI", "RJ45", "USB 3.0", "Jack 3,5", "SD"]).
- "typeC" ou "type C" → "USB-C". "port HDMI" → "HDMI". "2 ports usb" → ["USB", "USB"]. Dédoublonner les types identiques.

Règles générales : ram_go en entier ; stockage {go, type} avec type parmi SSD|HDD|NVMe|eMMC ; ecran {pouces, resolution} ; ports et accessoires en tableaux ; etat parmi "Neuf" | "Très bon état" | "Bon état" | "État correct" | "À réparer" ; statut parmi "Disponible" | "Réservé" | "Vendu" | "Archivé" ; garde les formulations de batterie telles quelles.
Format :
${STANDARD_JSON_TEMPLATE}`;


type LlmConfig = { key: string; url: string; model: string };

function extractJsonObjects(text: string): string[] {
  const objects: string[] = [];
  let start = -1;
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') {
      inString = true;
      continue;
    }
    if (char === '{') {
      if (depth === 0) start = index;
      depth += 1;
    } else if (char === '}' && depth > 0) {
      depth -= 1;
      if (depth === 0 && start >= 0) {
        objects.push(text.slice(start, index + 1));
        start = -1;
      }
    }
  }
  return objects;
}

export function getLlmConfig(): LlmConfig | null {
  const key = process.env.PC_AUTOPOST_LLM_API_KEY;
  if (!key) return null;
  const url = process.env.PC_AUTOPOST_LLM_API_URL || 'https://api.openai.com/v1/chat/completions';
  const defaultModel = url.includes('api.groq.com') ? 'openai/gpt-oss-20b' : 'gpt-4o-mini';
  return {
    key,
    url,
    model: process.env.PC_AUTOPOST_LLM_MODEL || defaultModel,
  };
}

/**
 * Détermine si le provider supporte response_format: json_object.
 * Groq et OpenAI officiels le supportent. Les autres providers (OpenRouter,
 * Ollama, Together…) peuvent ne pas le supporter selon le modèle.
 */
function supportsJsonResponseFormat(url: string, model: string): boolean {
  // Groq et OpenAI officiel supportent toujours json_object
  if (url.includes('api.groq.com') || url.includes('api.openai.com')) return true;
  // OpenRouter supporte json_object seulement sur certains modèles (pas openai/gpt-oss-*)
  if (url.includes('openrouter.ai') && model.startsWith('openai/gpt-oss')) return false;
  // Par défaut : tenter sans pour éviter les erreurs 400
  return false;
}

/**
 * Envoie le texte brut à un LLM compatible OpenAI et renvoie le résultat
 * structuré (même contrat que le parseur local). Retourne null si non configuré.
 */
export async function llmExtract(rawText: string, defaultCurrency: string): Promise<{
  fields: import('./standard-format').StandardParseResult['fields'];
  structured: Record<string, unknown>;
  confidence: Record<string, number>;
} | null> {
  const cfg = getLlmConfig();
  if (!cfg) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45000);
  let response: Response;
  try {
    const useJsonFormat = supportsJsonResponseFormat(cfg.url, cfg.model);
    const requestBody: Record<string, unknown> = {
      model: cfg.model,
      temperature: 0,
      // 3000 tokens nécessaire pour couvrir le raisonnement + la réponse JSON complète
      max_tokens: 3000,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: rawText },
      ],
    };
    // Activer response_format seulement si le provider le supporte
    if (useJsonFormat) {
      requestBody['response_format'] = { type: 'json_object' };
    }
    response = await fetch(cfg.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.key}` },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });
  } catch (e) {
    clearTimeout(timer);
    throw new Error(`IA injoignable (${e instanceof Error ? e.message : 'erreur réseau'})`);
  }
  clearTimeout(timer);

  if (!response.ok) {
    let detail = '';
    try {
      const errorData = (await response.json()) as { error?: { message?: string } };
      detail = errorData.error?.message || '';
    } catch {
      // La réponse d'erreur peut ne pas être du JSON.
    }
    const retryAfter = response.headers.get('retry-after');
    const retryHint = retryAfter ? ` Réessayez dans ${retryAfter} seconde(s).` : '';
    throw new Error(`IA a répondu ${response.status}.${retryHint}${detail ? ` ${detail}` : ''}`);
  }
  const data = (await response.json()) as {
    choices?: { message?: { content?: string; reasoning?: string; reasoning_content?: string } }[];
  };
  const message = data.choices?.[0]?.message;
  const candidates = [message?.content, message?.reasoning_content, message?.reasoning]
    .filter((value): value is string => Boolean(value));
  let parseError = '';

  for (const candidate of candidates) {
    for (const json of extractJsonObjects(candidate)) {
      try {
        // Réutilise le parseur JSON standard (validation, normalisation, confiances).
        const parsed = parseStandardInput(json, defaultCurrency, 'llm');
        return { fields: parsed.fields, structured: parsed.structured, confidence: parsed.confidence };
      } catch (error) {
        parseError = error instanceof Error ? error.message : 'JSON invalide';
      }
    }
  }
  throw new Error(`IA : réponse illisible${parseError ? ` (${parseError})` : ' (aucun JSON reçu)'}`);
}

/**
 * Recalibre/uniformise spécifiquement la désignation du processeur via le LLM
 * selon nos règles de nommage strictes (forme abrégée i7-11th, cœurs/threads, suppression GHz).
 */
export async function llmRefineProcessor(currentProcessor: string, contextHint?: string): Promise<string | null> {
  const cfg = getLlmConfig();
  if (!cfg) return null;

  const prompt = `Tu es un assistant expert en fiches techniques d'ordinateurs.
Ta mission est UNIQUEMENT de formater et standardiser le processeur fourni selon les règles strictes suivantes :
1. Si le modèle exact est inconnu ou absent mais que la génération est connue, utilise IMPÉRATIVEMENT la forme abrégée : "i3-Xth", "i5-Xth", "i7-Xth", "i9-Xth" (exemples : "i7-11th", "i5-10th", "i5-8th").
2. Si le modèle complet précis est présent, conserve-le de manière propre (ex: "Core i5-1145G7", "Ryzen 5 5500U", "Apple M1").
3. Si le texte contient le nombre de cœurs et/ou de threads/processeurs logiques, ajoute-le OBLIGATOIREMENT à la fin sous la forme : "(X coeurs, Y threads)" ou "(X coeurs)" (ex: "i7-11th (4 coeurs, 8 threads)", "Core i5-1145G7 (4 coeurs, 8 threads)").
4. Ne JAMAIS inclure les fréquences d'horloge (@ 2.40GHz, 1.8GHz, etc.).
5. Retire les mentions superflues comme "CPU", "(R)", "(TM)", "avec carte graphique intégrée", etc.

Renvoie UNIQUEMENT un objet JSON : {"processor": "LE_PROCESSEUR_NORMALISE"}
Sans markdown, sans texte avant ou après.`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const inputContent = contextHint
      ? `Processeur actuel : "${currentProcessor}"\nContexte / texte de l'annonce ou fiche : "${contextHint}"`
      : `Processeur actuel : "${currentProcessor}"`;

    const requestBody: Record<string, unknown> = {
      model: cfg.model,
      temperature: 0,
      max_tokens: 150,
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: inputContent },
      ],
    };
    if (supportsJsonResponseFormat(cfg.url, cfg.model)) {
      requestBody['response_format'] = { type: 'json_object' };
    }

    const response = await fetch(cfg.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.key}` },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!response.ok) return null;

    const data = (await response.json()) as { choices?: { message?: { content?: string } }[] };
    const content = data.choices?.[0]?.message?.content;
    if (!content) return null;

    for (const jsonStr of extractJsonObjects(content)) {
      try {
        const obj = JSON.parse(jsonStr) as { processor?: string };
        if (obj && typeof obj.processor === 'string' && obj.processor.trim()) {
          return obj.processor.trim();
        }
      } catch {
        // continue
      }
    }
    return null;
  } catch {
    clearTimeout(timer);
    return null;
  }
}

/**
 * Recalibre/uniformise spécifiquement la désignation de la carte graphique via le LLM
 * selon nos règles de nommage strictes.
 */
export async function llmRefineGraphics(currentGraphics: string, contextHint?: string): Promise<string | null> {
  const cfg = getLlmConfig();
  if (!cfg) return null;

  const prompt = `Tu es un assistant expert en fiches techniques d'ordinateurs.
Ta mission est UNIQUEMENT de formater et standardiser la carte graphique ou le NPU fourni selon les règles strictes suivantes :
1. Format épuré : "Intel Iris Xe", "Intel UHD Graphics 620", "Intel NPU", "Intel AI Boost", "NVIDIA GeForce RTX 3050", "NVIDIA GeForce GTX 1650", "AMD Radeon Vega 8", "AMD Radeon RX 6600M", "AMD Ryzen AI NPU", etc.
2. Si la carte est DÉDIÉE (NVIDIA RTX/GTX/MX/Quadro, AMD Radeon RX/Pro, Intel Arc A/B) et que la VRAM dédiée est précisée (ex: 4Go, 512Mo, 6GB), ajoute-la proprement entre parenthèses à la fin : "(4 Go)" ou "(512 Mo)".
3. Si la carte est INTÉGRÉE (Intel Iris Xe, Intel UHD/HD, Intel Arc Graphics, AMD Radeon/Vega/780M, Apple M GPU) ou un NPU, spécifie UNIQUEMENT le nom de la carte/NPU seul, SANS aucune mention de VRAM ou mémoire partagée.
4. Supprime les mentions parasites : "(R)", "(TM)", "Laptop GPU", "Mobile GPU", "Controller", "Family", "with Max-Q Design" (remplacer par "Max-Q").

Renvoie UNIQUEMENT un objet JSON : {"graphics": "LA_CARTE_GRAPHIQUE_NORMALISEE"}
Sans markdown, sans texte avant ou après.`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const inputContent = contextHint
      ? `Carte graphique actuelle : "${currentGraphics}"\nContexte / texte de l'annonce ou fiche : "${contextHint}"`
      : `Carte graphique actuelle : "${currentGraphics}"`;

    const requestBody: Record<string, unknown> = {
      model: cfg.model,
      temperature: 0,
      max_tokens: 150,
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: inputContent },
      ],
    };
    if (supportsJsonResponseFormat(cfg.url, cfg.model)) {
      requestBody['response_format'] = { type: 'json_object' };
    }

    const response = await fetch(cfg.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.key}` },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!response.ok) return null;

    const data = (await response.json()) as { choices?: { message?: { content?: string } }[] };
    const content = data.choices?.[0]?.message?.content;
    if (!content) return null;

    for (const jsonStr of extractJsonObjects(content)) {
      try {
        const obj = JSON.parse(jsonStr) as { graphics?: string };
        if (obj && typeof obj.graphics === 'string' && obj.graphics.trim()) {
          return obj.graphics.trim();
        }
      } catch {
        // continue
      }
    }
    return null;
  } catch {
    clearTimeout(timer);
    return null;
  }
}

