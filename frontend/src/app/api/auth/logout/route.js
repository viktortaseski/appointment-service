import { NextResponse } from 'next/server';

import { getAdminCookieName, getAdminCookieOptions } from '@/lib/server/auth';

export const runtime = 'nodejs';

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(
    getAdminCookieName(),
    '',
    Object.assign(getAdminCookieOptions(), { maxAge: 0 })
  );
  return response;
}
