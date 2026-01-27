import { NextResponse } from 'next/server';

import { getSuperAdminCookieName, getSuperAdminCookieOptions } from '@/lib/server/super-admin-auth';

export const runtime = 'nodejs';

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(
    getSuperAdminCookieName(),
    '',
    Object.assign(getSuperAdminCookieOptions(), { maxAge: 0 })
  );
  return response;
}
