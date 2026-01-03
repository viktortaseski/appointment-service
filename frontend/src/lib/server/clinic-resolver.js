import { debugLog } from './debug';
import { pool } from './db';
import { getHeader, getHeaders } from './headers';

function getHostname(source) {
  const explicitDomain = getHeader(source, 'x-clinic-domain');
  const forwardedHost = getHeader(source, 'x-forwarded-host');
  const hostHeader = forwardedHost || getHeader(source, 'host');
  const rawHost = explicitDomain || hostHeader;

  if (!rawHost) {
    return null;
  }

  return rawHost.split(',')[0].trim().replace(/:\d+$/, '');
}

export async function resolveClinic(source) {
  const hostname = getHostname(source);

  if (!hostname) {
    debugLog('clinic-resolver: missing host', {
      forwardedHost: getHeader(source, 'x-forwarded-host'),
      host: getHeader(source, 'host'),
    });
    return { error: 'Missing hostname.' };
  }

  debugLog('clinic-resolver: lookup', { hostname });

  const result = await pool.query(
    'SELECT id, name, domain, logo, phone, email, address, is_disabled, opens_at, closes_at, slot_minutes, created_at FROM clinics WHERE domain = $1 LIMIT 1',
    [hostname]
  );

  if (result.rowCount === 0) {
    debugLog('clinic-resolver: not found', { hostname });
    return {
      error: 'Clinic not found for host.',
      host: hostname,
    };
  }

  debugLog('clinic-resolver: resolved', {
    clinicId: result.rows[0].id,
    domain: result.rows[0].domain,
  });

  return { clinic: result.rows[0] };
}
