import bcrypt from 'bcryptjs';
import { NextResponse } from 'next/server';

import { pool } from '@/lib/server/db';

export const runtime = 'nodejs';

function isAuthorized(request) {
  const expected = process.env.SUPER_ADMIN_TOKEN;
  if (!expected) {
    return false;
  }
  const token = request.headers.get('x-super-admin-token') || '';
  return token === expected;
}

export async function GET(request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const clinicId = searchParams.get('clinic_id');
  const clinicDomain = searchParams.get('clinic_domain');

  if (!clinicId && !clinicDomain) {
    return NextResponse.json(
      { error: 'clinic_id or clinic_domain is required.' },
      { status: 400 }
    );
  }

  try {
    const resolvedClinicId =
      clinicId ||
      (
        await pool.query('SELECT id FROM clinics WHERE domain = $1 LIMIT 1', [
          clinicDomain,
        ])
      ).rows?.[0]?.id;

    if (!resolvedClinicId) {
      return NextResponse.json({ error: 'Clinic not found.' }, { status: 404 });
    }

    const result = await pool.query(
      `SELECT id, clinic_id, name, username, specialty, description, avatar, is_disabled, created_at, updated_at
       FROM doctors
       WHERE clinic_id = $1
       ORDER BY name`,
      [resolvedClinicId]
    );

    return NextResponse.json({ doctors: result.rows });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Super admin doctor list failed:', err);
    return NextResponse.json({ error: 'Unable to load doctors.' }, { status: 500 });
  }
}

export async function POST(request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const body = await request.json();
  const {
    clinic_domain: clinicDomain,
    clinic_id: clinicId,
    name,
    username,
    specialty,
    description,
    avatar,
    password,
    is_disabled: isDisabled,
  } = body || {};

  if ((!clinicDomain && !clinicId) || !name || !specialty) {
    return NextResponse.json(
      { error: 'clinic_domain (or clinic_id), name, and specialty are required.' },
      { status: 400 }
    );
  }

  try {
    const resolvedClinic =
      clinicId ||
      (
        await pool.query('SELECT id FROM clinics WHERE domain = $1 LIMIT 1', [
          clinicDomain,
        ])
      ).rows?.[0]?.id;

    if (!resolvedClinic) {
      return NextResponse.json({ error: 'Clinic not found.' }, { status: 404 });
    }

    const passwordHash = password ? await bcrypt.hash(password, 10) : null;
    let result;

    if (username) {
      result = await pool.query(
        `INSERT INTO doctors (clinic_id, name, username, specialty, description, avatar, password_hash, is_disabled)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (clinic_id, username) DO UPDATE SET
           name = EXCLUDED.name,
           specialty = EXCLUDED.specialty,
           description = COALESCE(EXCLUDED.description, doctors.description),
           avatar = COALESCE(EXCLUDED.avatar, doctors.avatar),
           password_hash = COALESCE(EXCLUDED.password_hash, doctors.password_hash),
           is_disabled = EXCLUDED.is_disabled,
           updated_at = CURRENT_TIMESTAMP
         RETURNING id, clinic_id, name, username, specialty, description, avatar, is_disabled, created_at, updated_at`,
        [
          resolvedClinic,
          name,
          username,
          specialty,
          description || null,
          avatar || null,
          passwordHash,
          typeof isDisabled === 'boolean' ? isDisabled : false,
        ]
      );
    } else {
      result = await pool.query(
        `INSERT INTO doctors (clinic_id, name, specialty, description, avatar, password_hash, is_disabled)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, clinic_id, name, username, specialty, description, avatar, is_disabled, created_at, updated_at`,
        [
          resolvedClinic,
          name,
          specialty,
          description || null,
          avatar || null,
          passwordHash,
          typeof isDisabled === 'boolean' ? isDisabled : false,
        ]
      );
    }

    return NextResponse.json({ doctor: result.rows[0] }, { status: 201 });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Super admin doctor upsert failed:', err);
    return NextResponse.json({ error: 'Unable to save doctor.' }, { status: 500 });
  }
}
