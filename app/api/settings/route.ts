import { NextResponse } from 'next/server';
import fs from 'node:fs';
import path from 'node:path';
import { getSettings, updateSettings, LOGOS_DIR } from '@/lib/db';
import { ALLOWED_MIME } from '@/lib/services/image-service';
import sharp from 'sharp';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ settings: getSettings() });
}

/**
 * PUT — met à jour les paramètres de boutique.
 * JSON simple pour les champs texte, ou FormData avec `logo` pour le logo.
 */
export async function PUT(req: Request) {
  const type = req.headers.get('content-type') ?? '';

  if (type.includes('multipart/form-data')) {
    const form = await req.formData();
    const patch: Record<string, string> = {};
    for (const key of ['shop_name', 'tagline', 'phone', 'city', 'currency', 'color_primary', 'color_accent', 'default_template', 'facebook_page_id', 'facebook_page_access_token'] as const) {
      const v = form.get(key);
      if (typeof v === 'string') patch[key] = v;
    }
    const logo = form.get('logo');
    if (logo instanceof File) {
      const ext = ALLOWED_MIME[logo.type];
      if (!ext) return NextResponse.json({ error: 'Format de logo non supporté (JPEG, PNG ou WebP)' }, { status: 415 });
      if (logo.size > 5 * 1024 * 1024) return NextResponse.json({ error: 'Logo trop volumineux (5 Mo max)' }, { status: 413 });
      const buf = Buffer.from(await logo.arrayBuffer());
      const stamp = Date.now().toString(36);
      const filename = `logo-${stamp}.${ext}`;
      await sharp(buf).ensureAlpha().resize({ width: 800, withoutEnlargement: true }).png().toFile(path.join(LOGOS_DIR, filename));
      patch.logo_file = filename;
    }
    if (form.get('remove_logo') === '1') {
      const current = getSettings();
      if (current.logo_file) fs.unlinkSync(path.join(LOGOS_DIR, current.logo_file));
      patch.logo_file = '';
    }
    return NextResponse.json({ settings: updateSettings(patch) });
  }

  let body: Record<string, string>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Corps de requête invalide' }, { status: 400 });
  }
  const settings = updateSettings(body);
  return NextResponse.json({ settings });
}
