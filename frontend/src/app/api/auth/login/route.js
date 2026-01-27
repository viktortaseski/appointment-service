import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { NextResponse } from 'next/server';

import { resolveClinic } from '@/lib/server/clinic-resolver';
import { pool } from '@/lib/server/db';
import { logAudit } from '@/lib/server/audit';
import { checkRateLimit } from '@/lib/server/rate-limit';
import { getAdminCookieName, getAdminCookieOptions } from '@/lib/server/auth';

export const runtime = 'nodejs';

function getAuditMeta(request) {
  return {
    ip: request.headers.get('x-forwarded-for') || '',
    userAgent: request.headers.get('user-agent') || '',
  };
}

export async function POST(request) {
  const limit = checkRateLimit(request.headers, {
    windowMs: 15 * 60 * 1000,
    max: 10,
    keyPrefix: 'login',
  });

  if (limit.limited) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } }
    );
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'JWT_SECRET not configured.' }, { status: 500 });
  }

  const { clinic, error } = await resolveClinic(request.headers);
  if (error) {
    return NextResponse.json({ error }, { status: 404 });
  }

  const body = await request.json();
  const { clinicName, username, password } = body || {};

  if (!clinicName || !username || !password) {
    return NextResponse.json(
      { error: 'clinicName, username, and password are required.' },
      { status: 400 }
    );
  }

  const normalizedClinicName = clinicName.trim().toLowerCase();
  const resolvedClinicName = clinic?.name?.trim().toLowerCase();

  if (!resolvedClinicName || normalizedClinicName !== resolvedClinicName) {
    await logAudit({
      clinicId: clinic?.id,
      action: 'login_failed',
      metadata: {
        reason: 'clinic_name_mismatch',
        username,
        ...getAuditMeta(request),
      },
    });
    return NextResponse.json(
      { error: 'Clinic name does not match this domain.' },
      { status: 401 }
    );
  }

  const result = await pool.query(
    'SELECT id, clinic_id, name, username, password_hash, is_disabled FROM doctors WHERE clinic_id = $1 AND username = $2 LIMIT 1',
    [clinic.id, username]
  );

  if (result.rowCount === 0) {
    await logAudit({
      clinicId: clinic?.id,
      action: 'login_failed',
      metadata: {
        reason: 'doctor_not_found',
        username,
        ...getAuditMeta(request),
      },
    });
    return NextResponse.json({ error: 'Invalid credentials.' }, { status: 401 });
  }

  const doctor = result.rows[0];

  if (doctor.is_disabled) {
    await logAudit({
      clinicId: clinic?.id,
      doctorId: doctor.id,
      action: 'login_failed',
      metadata: {
        reason: 'doctor_disabled',
        username,
        ...getAuditMeta(request),
      },
    });
    return NextResponse.json({ error: 'Doctor account disabled.' }, { status: 403 });
  }

  if (!doctor.password_hash) {
    await logAudit({
      clinicId: clinic?.id,
      doctorId: doctor.id,
      action: 'login_failed',
      metadata: {
        reason: 'password_not_set',
        username,
        ...getAuditMeta(request),
      },
    });
    return NextResponse.json({ error: 'Password not set for this doctor.' }, { status: 401 });
  }

  const isMatch = await bcrypt.compare(password, doctor.password_hash);
  if (!isMatch) {
    await logAudit({
      clinicId: clinic?.id,
      doctorId: doctor.id,
      action: 'login_failed',
      metadata: {
        reason: 'invalid_password',
        username,
        ...getAuditMeta(request),
      },
    });
    return NextResponse.json({ error: 'Invalid credentials.' }, { status: 401 });
  }

  const token = jwt.sign(
    {
      doctorId: doctor.id,
      clinicId: doctor.clinic_id,
      name: doctor.name,
      username: doctor.username,
    },
    secret,
    { expiresIn: '8h' }
  );

  await logAudit({
    clinicId: clinic?.id,
    doctorId: doctor.id,
    action: 'login_success',
    metadata: {
      username,
      ...getAuditMeta(request),
    },
  });

  const response = NextResponse.json({
    doctor: {
      id: doctor.id,
      name: doctor.name,
      clinic_id: doctor.clinic_id,
    },
  });
  response.cookies.set(
    getAdminCookieName(),
    token,
    Object.assign(getAdminCookieOptions(), { maxAge: 60 * 60 * 8 })
  );
  return response;
}
