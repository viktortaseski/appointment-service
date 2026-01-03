import { getHeader } from './headers';

const buckets = new Map();

function getClientIp(source) {
  const forwarded = getHeader(source, 'x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  return getHeader(source, 'x-real-ip') || 'unknown';
}

export function checkRateLimit(source, options = {}) {
  const { windowMs = 60000, max = 60, keyPrefix = 'default' } = options;
  const now = Date.now();
  const key = `${keyPrefix}:${getClientIp(source)}`;
  const current = buckets.get(key);

  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { limited: false };
  }

  if (current.count >= max) {
    const retryAfterSeconds = Math.ceil((current.resetAt - now) / 1000);
    return { limited: true, retryAfterSeconds };
  }

  current.count += 1;
  return { limited: false };
}
