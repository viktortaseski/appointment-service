import { Pool, types } from 'pg';

import { debugLog } from './debug';

const isProduction = process.env.NODE_ENV === 'production';
const connectionString = isProduction
  ? process.env.DATABASE_URL
  : process.env.DATABASE_URL_DEV || process.env.DATABASE_URL;

if (!connectionString) {
  // eslint-disable-next-line no-console
  console.error('Missing DATABASE_URL (prod) or DATABASE_URL_DEV (dev).');
}

const sslRequired =
  isProduction ||
  process.env.DATABASE_SSL === 'true' ||
  process.env.PGSSLMODE === 'require' ||
  (connectionString && connectionString.includes('render.com'));

// Keep DATE columns as YYYY-MM-DD strings to avoid timezone shifts.
types.setTypeParser(1082, (value) => value);

export const pool = new Pool({
  connectionString,
  ssl: sslRequired ? { rejectUnauthorized: false } : undefined,
});

debugLog('db:init', {
  hasConnectionString: Boolean(connectionString),
  sslRequired,
  nodeEnv: process.env.NODE_ENV,
});
