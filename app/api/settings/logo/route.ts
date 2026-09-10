import { NextResponse } from 'next/server';
import fs from 'node:fs';
import path from 'node:path';
import { getSettings, LOGOS_DIR } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const settings = getSettings();
  if (!settings.logo_file) return new NextResponse(null, { status: 404 });
  const p = path.join(LOGOS_DIR, settings.logo_file);
  if (!fs.existsSync(p)) return new NextResponse(null, { status: 404 });
  const buf = fs.readFileSync(p);
  return new NextResponse(buf, {
    headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=86400' },
  });
}
