import { NextResponse } from 'next/server';
import { testFacebookConnection } from '@/lib/services/facebook-service';
import { getSettings } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  let body: { pageId?: string; accessToken?: string } = {};
  try {
    body = await req.json();
  } catch {
    // If empty body, read from stored settings
  }

  const settings = getSettings();
  const pageId = body.pageId !== undefined ? body.pageId : settings.facebook_page_id;
  const accessToken = body.accessToken !== undefined ? body.accessToken : settings.facebook_page_access_token;

  if (!pageId || !accessToken) {
    return NextResponse.json(
      { success: false, error: 'Identifiants Facebook non renseignés. Veuillez renseigner le Page ID et le Jeton.' },
      { status: 400 }
    );
  }

  const result = await testFacebookConnection(pageId, accessToken);
  if (!result.success) {
    return NextResponse.json(result, { status: 400 });
  }

  return NextResponse.json(result);
}
