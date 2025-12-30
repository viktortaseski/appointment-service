const pool = require('./db');

function getHostname(req) {
  const explicitDomain = req.headers['x-clinic-domain'];
  const explicitHost = Array.isArray(explicitDomain)
    ? explicitDomain[0]
    : explicitDomain;
  const forwardedHost = req.headers['x-forwarded-host'];
  const hostHeader = Array.isArray(forwardedHost)
    ? forwardedHost[0]
    : forwardedHost;
  const rawHost = explicitHost || hostHeader || req.headers.host || req.hostname;

  if (!rawHost) {
    return null;
  }

  return rawHost.split(',')[0].trim().replace(/:\d+$/, '');
}

module.exports = async function clinicResolver(req, res, next) {
  const hostname = getHostname(req);

  if (!hostname) {
    return res.status(400).json({ error: 'Missing hostname.' });
  }

  try {
    const result = await pool.query(
      'SELECT id, name, domain, logo, phone, email, address, created_at FROM clinics WHERE domain = $1 LIMIT 1',
      [hostname]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        error: 'Clinic not found for host.',
        host: hostname,
      });
    }

    req.clinic = result.rows[0];
    return next();
  } catch (error) {
    return next(error);
  }
};
