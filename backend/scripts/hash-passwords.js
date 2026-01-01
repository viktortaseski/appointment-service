/* eslint-disable no-console */
const bcrypt = require('bcryptjs');
const { Client } = require('pg');

const isProduction = process.env.NODE_ENV === 'production';
const connectionString = isProduction
  ? process.env.DATABASE_URL
  : process.env.DATABASE_URL_DEV || process.env.DATABASE_URL;

if (!connectionString) {
  console.error('Missing DATABASE_URL (prod) or DATABASE_URL_DEV (dev).');
  process.exit(1);
}

async function run() {
  const client = new Client({
    connectionString,
    ssl: isProduction ? { rejectUnauthorized: false } : undefined,
  });

  try {
    await client.connect();

    const columnCheck = await client.query(
      `SELECT 1
       FROM information_schema.columns
       WHERE table_name = 'doctors' AND column_name = 'password'`
    );

    if (columnCheck.rowCount === 0) {
      console.log('No plaintext password column found. Nothing to migrate.');
      return;
    }

    const result = await client.query(
      `SELECT id, password
       FROM doctors
       WHERE password IS NOT NULL
         AND password <> ''
         AND (password_hash IS NULL OR password_hash = '')`
    );

    if (result.rowCount === 0) {
      console.log('No plaintext passwords pending migration.');
      return;
    }

    for (const row of result.rows) {
      const hash = await bcrypt.hash(row.password, 10);
      await client.query(
        'UPDATE doctors SET password_hash = $1, password = NULL WHERE id = $2',
        [hash, row.id]
      );
    }

    console.log(`Migrated ${result.rowCount} doctor password(s).`);
  } catch (error) {
    console.error('Password migration failed:', error);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

run();
