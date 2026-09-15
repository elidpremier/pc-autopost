import { NextResponse } from 'next/server';
import { getComputer, updateComputer, listExtractions } from '@/lib/db';
import { normalizeGraphics } from '@/lib/services/standard-format';
import { llmRefineGraphics } from '@/lib/services/ai-extract';

export const dynamic = 'force-dynamic';

type Ctx = { params: { id: string } };

export async function POST(req: Request, { params }: Ctx) {
  const computer = getComputer(params.id);
  if (!computer) {
    return NextResponse.json({ error: 'Produit introuvable' }, { status: 404 });
  }

  let body: { mode?: 'auto' | 'ai' | 'rule'; apply?: boolean; graphics?: string } = {};
  try {
    body = await req.json();
  } catch {
    // Mode auto par défaut si aucun body
  }

  const mode = body.mode || 'auto';
  const shouldApply = Boolean(body.apply);
  const currentGfx = (computer.graphics || '').trim();

  // Si une valeur spécifique de carte graphique à enregistrer est passée avec apply: true
  if (shouldApply && typeof body.graphics === 'string' && body.graphics.trim()) {
    const finalGfx = normalizeGraphics(body.graphics.trim());
    const updated = updateComputer(params.id, { graphics: finalGfx });
    return NextResponse.json({
      ok: true,
      saved: true,
      computer: updated,
      previousGraphics: currentGfx,
      newGraphics: finalGfx,
    });
  }

  // Recherche d'un texte d'extraction précédent (OCR/texte original) comme contexte
  const extractions = listExtractions(computer.id);
  const contextHint = extractions.find((e) => e.raw_text?.trim())?.raw_text || computer.notes || '';

  let refinedGraphics = '';
  let usedMethod: 'ai' | 'rule' = 'rule';

  // 1. Essai via LLM si mode !== 'rule'
  if (mode !== 'rule') {
    try {
      const llmResult = await llmRefineGraphics(currentGfx, contextHint);
      if (llmResult) {
        refinedGraphics = normalizeGraphics(llmResult);
        usedMethod = 'ai';
      }
    } catch (e) {
      console.warn(`[RefineGraphics] Repli sur normalisation déterministe pour ${params.id}:`, e);
    }
  }

  // 2. Repli / Mode déterministe
  if (!refinedGraphics) {
    refinedGraphics = normalizeGraphics(currentGfx);
    usedMethod = 'rule';
  }

  if (!refinedGraphics) {
    refinedGraphics = currentGfx;
  }

  // Si on a demandé d'appliquer directement
  if (shouldApply) {
    const updated = updateComputer(params.id, {
      graphics: refinedGraphics,
    });
    return NextResponse.json({
      ok: true,
      saved: true,
      computer: updated,
      previousGraphics: currentGfx,
      newGraphics: refinedGraphics,
      method: usedMethod,
    });
  }

  // Mode preview : renvoie la proposition sans enregistrer en base
  return NextResponse.json({
    ok: true,
    saved: false,
    previousGraphics: currentGfx,
    proposedGraphics: refinedGraphics,
    method: usedMethod,
    hasChanged: currentGfx !== refinedGraphics,
  });
}

