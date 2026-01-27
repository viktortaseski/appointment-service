import { NextResponse } from 'next/server';

import { verifySuperAdminRequest } from '@/lib/server/super-admin-auth';

export const runtime = 'nodejs';

export async function GET(request) {
  const auth = verifySuperAdminRequest(request);
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  return NextResponse.json({ ok: true, user: auth.payload });
}
