import { NextResponse } from 'next/server';
import { getComputer, updateComputer, listExtractions } from '@/lib/db';
import { normalizeProcessor } from '@/lib/services/standard-format';
import { llmRefineProcessor } from '@/lib/services/ai-extract';

export const dynamic = 'force-dynamic';

type Ctx = { params: { id: string } };

export async function POST(req: Request, { params }: Ctx) {
  const computer = getComputer(params.id);
  if (!computer) {
    return NextResponse.json({ error: 'Produit introuvable' }, { status: 404 });
  }

  let body: { mode?: 'auto' | 'ai' | 'rule'; apply?: boolean; processor?: string } = {};
  try {
    body = await req.json();
  } catch {
    // Mode auto par défaut si aucun body
  }

  const mode = body.mode || 'auto';
  const shouldApply = Boolean(body.apply);
  const currentProc = (computer.processor || '').trim();

  // Si une valeur spécifique de processeur à enregistrer est passée avec apply: true
  if (shouldApply && typeof body.processor === 'string' && body.processor.trim()) {
    const finalProc = normalizeProcessor(body.processor.trim());
    const updated = updateComputer(params.id, { processor: finalProc });
    return NextResponse.json({
      ok: true,
      saved: true,
      computer: updated,
      previousProcessor: currentProc,
      newProcessor: finalProc,
    });
  }

  // Recherche d'un texte d'extraction précédent (OCR/texte original) comme contexte
  const extractions = listExtractions(computer.id);
  const contextHint = extractions.find((e) => e.raw_text?.trim())?.raw_text || computer.notes || '';

  let refinedProcessor = '';
  let usedMethod: 'ai' | 'rule' = 'rule';

  // 1. Essai via LLM si mode !== 'rule'
  if (mode !== 'rule') {
    try {
      const llmResult = await llmRefineProcessor(currentProc, contextHint);
      if (llmResult) {
        refinedProcessor = normalizeProcessor(llmResult);
        usedMethod = 'ai';
      }
    } catch (e) {
      console.warn(`[RefineProcessor] Repli sur normalisation déterministe pour ${params.id}:`, e);
    }
  }

  // 2. Repli / Mode déterministe
  if (!refinedProcessor) {
    // Si on a un texte source original (OCR) qui contenait des cœurs/threads absents du champ actuel, on peut le scanner
    let combined = currentProc;
    if (contextHint && !/(?:coeurs?|cores?)/i.test(combined)) {
      const coresM = contextHint.match(/(?:(?:avec\s+)?\(?\s*(\d+)\s*(?:c(?:oe|œ|o)urs?|cores?)\s*(?:et|,|\/)?\s*(\d+)\s*(?:threads?|processeurs?\s*logiques?)\s*\)?)/i);
      if (coresM) {
        combined += ` (${coresM[1]} coeurs, ${coresM[2]} threads)`;
      } else {
        const coresOnlyM = contextHint.match(/(?:(?:avec\s+)?\(?\s*(\d+)\s*(?:c(?:oe|œ|o)urs?|cores?)\s*\)?)/i);
        if (coresOnlyM) combined += ` (${coresOnlyM[1]} coeurs)`;
      }
    }
    refinedProcessor = normalizeProcessor(combined);
    usedMethod = 'rule';
  }

  if (!refinedProcessor) {
    refinedProcessor = currentProc;
  }

  // Si on a demandé d'appliquer directement
  if (shouldApply) {
    const updated = updateComputer(params.id, {
      processor: refinedProcessor,
    });
    return NextResponse.json({
      ok: true,
      saved: true,
      computer: updated,
      previousProcessor: currentProc,
      newProcessor: refinedProcessor,
      method: usedMethod,
    });
  }

  // Mode preview : renvoie la proposition sans enregistrer en base
  return NextResponse.json({
    ok: true,
    saved: false,
    previousProcessor: currentProc,
    proposedProcessor: refinedProcessor,
    method: usedMethod,
    hasChanged: currentProc !== refinedProcessor,
  });
}

