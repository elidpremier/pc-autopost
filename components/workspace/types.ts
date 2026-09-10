import type { ExtractedField } from '@/lib/types';

export type ExtractionResult = {
  rawText: string;
  provider: string;
  source?: string;
  fields: ExtractedField[];
  structured: Record<string, unknown>;
  confidence: Record<string, number>;
};

export type GenerationResult = {
  generated: { id: string; format: string; url: string; downloadUrl: string }[];
  errors: { format: string; error: string }[];
  texts: { facebook: string; instagram: string; whatsapp: string };
  template: { id: string; version: string; name: string };
  createdAt: string;
};
