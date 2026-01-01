const buckets = new Map();

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  return req.ip || req.connection?.remoteAddress || 'unknown';
}

function rateLimit(options = {}) {
  const {
    windowMs = 60000,
    max = 60,
    keyPrefix = 'default',
  } = options;

  return function rateLimitMiddleware(req, res, next) {
    const now = Date.now();
    const key = `${keyPrefix}:${getClientIp(req)}`;
    const current = buckets.get(key);

    if (!current || current.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    if (current.count >= max) {
      const retryAfterSeconds = Math.ceil((current.resetAt - now) / 1000);
      res.set('Retry-After', String(retryAfterSeconds));
      return res.status(429).json({
        error: 'Too many requests. Please try again later.',
      });
    }

    current.count += 1;
    return next();
  };
}

module.exports = rateLimit;
