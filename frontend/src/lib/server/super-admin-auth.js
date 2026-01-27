import jwt from 'jsonwebtoken';

const COOKIE_NAME = 'super_admin_session';

function getSecret() {
  return process.env.SUPER_ADMIN_JWT_SECRET || process.env.JWT_SECRET || '';
}

export function superAdminEnabled() {
  return process.env.SUPER_ADMIN_ENABLED === 'true';
}

export function getSuperAdminCookieName() {
  return COOKIE_NAME;
}

export function getSuperAdminCookieOptions() {
  const isProduction = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
  };
}

export function signSuperAdminToken(payload) {
  const secret = getSecret();
  if (!secret) {
    throw new Error('SUPER_ADMIN_JWT_SECRET not configured.');
  }
  return jwt.sign(payload, secret, { expiresIn: '12h' });
}

export function verifySuperAdminRequest(request) {
  if (!superAdminEnabled()) {
    return { error: 'Not found.', status: 404 };
  }

  const secret = getSecret();
  if (!secret) {
    return { error: 'SUPER_ADMIN_JWT_SECRET not configured.', status: 500 };
  }

  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (!token) {
    return { error: 'Unauthorized.', status: 401 };
  }

  try {
    const payload = jwt.verify(token, secret);
    if (payload?.role !== 'super_admin') {
      return { error: 'Unauthorized.', status: 401 };
    }
    return { payload };
  } catch (error) {
    return { error: 'Unauthorized.', status: 401 };
  }
}
