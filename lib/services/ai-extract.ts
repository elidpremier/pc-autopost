// Extraction par IA optionnelle (OpenAI-compatible).
// Activée uniquement si PC_AUTOPOST_LLM_API_KEY est définie dans l'environnement
// (.env.local). Sans clé, l'application utilise le parseur local déterministe :
// le cœur du produit reste 100 % fonctionnel hors IA (spec §10.3).

import { parseStandardInput, STANDARD_JSON_TEMPLATE } from './standard-format';

const SYSTEM_PROMPT = `Tu es un extracteur de fiches techniques d'ordinateurs.
À partir du texte fourni (capture lue par OCR, copier-collé ou libre), renvoie UNIQUEMENT un objet JSON valide au format exact ci-dessous, sans commentaire, sans markdown.
Utilise null pour les valeurs absentes. N'invente JAMAIS une valeur absente.
Règles : ram_go en entier ; stockage {go, type} avec type parmi SSD|HDD|NVMe|eMMC ; ecran {pouces, resolution} ; ports et accessoires en tableaux ; etat parmi "Neuf" | "Très bon état" | "Bon état" | "État correct" | "À réparer" ; statut parmi "Disponible" | "Réservé" | "Vendu" | "Archivé" ; garde les formulations de batterie telles quelles.
Format :
${STANDARD_JSON_TEMPLATE}`;

type LlmConfig = { key: string; url: string; model: string };

export function getLlmConfig(): LlmConfig | null {
  const key = process.env.PC_AUTOPOST_LLM_API_KEY;
  if (!key) return null;
  return {
    key,
    url: process.env.PC_AUTOPOST_LLM_API_URL || 'https://api.openai.com/v1/chat/completions',
    model: process.env.PC_AUTOPOST_LLM_MODEL || 'gpt-4o-mini',
  };
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
    response = await fetch(cfg.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.key}` },
      body: JSON.stringify({
        model: cfg.model,
        temperature: 0,
        max_tokens: 1200,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: rawText },
        ],
      }),
      signal: controller.signal,
    });
  } catch (e) {
    clearTimeout(timer);
    throw new Error(`IA injoignable (${e instanceof Error ? e.message : 'erreur réseau'})`);
  }
  clearTimeout(timer);

  if (!response.ok) {
    throw new Error(`IA a répondu ${response.status}`);
  }
  const data = (await response.json()) as { choices?: { message?: { content?: string } }[] };
  const content = data.choices?.[0]?.message?.content ?? '';
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('IA : réponse illisible');

  // Réutilise le parseur JSON standard (validation, normalisation, confiances).
  const parsed = parseStandardInput(jsonMatch[0], defaultCurrency, 'llm');
  return { fields: parsed.fields, structured: parsed.structured, confidence: parsed.confidence };
}
