import { pool } from './db';

function getHostname(headers) {
  const explicitDomain = headers.get('x-clinic-domain');
  const forwardedHost = headers.get('x-forwarded-host');
  const hostHeader = forwardedHost || headers.get('host');
  const rawHost = explicitDomain || hostHeader;

  if (!rawHost) {
    return null;
  }

  return rawHost.split(',')[0].trim().replace(/:\d+$/, '');
}

export async function resolveClinic(headers) {
  const hostname = getHostname(headers);

  if (!hostname) {
    return { error: 'Missing hostname.' };
  }

  const result = await pool.query(
    'SELECT id, name, domain, logo, phone, email, address, is_disabled, opens_at, closes_at, slot_minutes, created_at FROM clinics WHERE domain = $1 LIMIT 1',
    [hostname]
  );

  if (result.rowCount === 0) {
    return {
      error: 'Clinic not found for host.',
      host: hostname,
    };
  }

  return { clinic: result.rows[0] };
}
