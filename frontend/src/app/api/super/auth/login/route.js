import bcrypt from 'bcryptjs';
import { NextResponse } from 'next/server';

import {
  getSuperAdminCookieName,
  getSuperAdminCookieOptions,
  signSuperAdminToken,
  superAdminEnabled,
} from '@/lib/server/super-admin-auth';

export const runtime = 'nodejs';

export async function POST(request) {
  if (!superAdminEnabled()) {
    return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  }

  const body = await request.json();
  const { username, password } = body || {};

  if (!username || !password) {
    return NextResponse.json(
      { error: 'username and password are required.' },
      { status: 400 }
    );
  }

  const expectedUser = process.env.SUPER_ADMIN_USERNAME || '';
  const expectedHash = process.env.SUPER_ADMIN_PASSWORD_HASH || '';
  const expectedPassword = process.env.SUPER_ADMIN_PASSWORD || '';

  if (!expectedUser || (!expectedHash && !expectedPassword)) {
    return NextResponse.json(
      { error: 'Super admin credentials not configured.' },
      { status: 500 }
    );
  }

  if (username !== expectedUser) {
    return NextResponse.json({ error: 'Invalid credentials.' }, { status: 401 });
  }

  const passwordMatches = expectedHash
    ? await bcrypt.compare(password, expectedHash)
    : password === expectedPassword;

  if (!passwordMatches) {
    return NextResponse.json({ error: 'Invalid credentials.' }, { status: 401 });
  }

  const token = signSuperAdminToken({ role: 'super_admin', username });
  const response = NextResponse.json({ user: { username } });
  response.cookies.set(
    getSuperAdminCookieName(),
    token,
    Object.assign(getSuperAdminCookieOptions(), { maxAge: 60 * 60 * 12 })
  );

  return response;
}
