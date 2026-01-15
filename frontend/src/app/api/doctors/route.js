import bcrypt from 'bcryptjs';
import { NextResponse } from 'next/server';

import { resolveClinic } from '@/lib/server/clinic-resolver';
import { pool } from '@/lib/server/db';
import { requireAuth } from '@/lib/server/auth';
import { logAudit } from '@/lib/server/audit';

export const runtime = 'nodejs';

export async function GET(request) {
  const { clinic, error } = await resolveClinic(request.headers);
  if (error) {
    return NextResponse.json({ error }, { status: 404 });
  }

  try {
    const result = await pool.query(
      `SELECT id, clinic_id, name, username, specialty, opens_at, closes_at, description, avatar, is_disabled, created_at, updated_at
       FROM doctors
       WHERE clinic_id = $1
       ORDER BY name`,
      [clinic.id]
    );

    return NextResponse.json({
      clinic,
      doctors: result.rows,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Doctors fetch failed:', err);
    return NextResponse.json({ error: 'Unable to load doctors.' }, { status: 500 });
  }
}

export async function POST(request) {
  const { clinic, error } = await resolveClinic(request.headers);
  if (error) {
    return NextResponse.json({ error }, { status: 404 });
  }

  const authResult = await requireAuth(request, clinic);
  if (authResult.error) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  if (!authResult.auth || authResult.auth.clinicId !== clinic.id) {
    return NextResponse.json({ error: 'Not authorized for this clinic.' }, { status: 403 });
  }

  const body = await request.json();
  const {
    name,
    specialty,
    avatar,
    description,
    username,
    password,
    opens_at: opensAt,
    closes_at: closesAt,
  } = body || {};

  if (!name || !specialty) {
    return NextResponse.json({ error: 'name and specialty are required.' }, { status: 400 });
  }

  try {
    const passwordHash = password ? await bcrypt.hash(password, 10) : null;

    const result = await pool.query(
      `INSERT INTO doctors (clinic_id, name, username, specialty, opens_at, closes_at, description, avatar, password_hash)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, clinic_id, name, username, specialty, opens_at, closes_at, description, avatar, is_disabled, created_at, updated_at`,
      [
        clinic.id,
        name,
        username || null,
        specialty,
        opensAt || null,
        closesAt || null,
        description || null,
        avatar || null,
        passwordHash,
      ]
    );

    await logAudit({
      clinicId: clinic.id,
      doctorId: authResult.auth.doctorId,
      action: 'doctor_created',
      metadata: {
        createdDoctorId: result.rows[0].id,
      },
    });

    return NextResponse.json({ doctor: result.rows[0] }, { status: 201 });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Doctor create failed:', err);
    return NextResponse.json({ error: 'Unable to create doctor.' }, { status: 500 });
  }
}
