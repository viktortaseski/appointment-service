import bcrypt from 'bcryptjs';
import { NextResponse } from 'next/server';

import { resolveClinic } from '@/lib/server/clinic-resolver';
import { pool } from '@/lib/server/db';
import { requireAuth } from '@/lib/server/auth';
import { logAudit } from '@/lib/server/audit';

export const runtime = 'nodejs';

export async function GET(request, { params }) {
  const { clinic, error } = await resolveClinic(request.headers);
  if (error) {
    return NextResponse.json({ error }, { status: 404 });
  }

  try {
    const result = await pool.query(
      `SELECT id, clinic_id, name, username, specialty, opens_at, closes_at, description, avatar, is_disabled, created_at, updated_at
       FROM doctors
       WHERE clinic_id = $1 AND id = $2`,
      [clinic.id, params.id]
    );

    if (result.rowCount === 0) {
      return NextResponse.json({ error: 'Doctor not found.' }, { status: 404 });
    }

    return NextResponse.json({ doctor: result.rows[0] });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Doctor fetch failed:', err);
    return NextResponse.json({ error: 'Unable to load doctor.' }, { status: 500 });
  }
}

export async function PATCH(request, { params }) {
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
    username,
    specialty,
    description,
    password,
    opens_at: opensAt,
    closes_at: closesAt,
    is_disabled: isDisabled,
  } = body || {};

  const updates = [];
  const values = [];

  if (name !== undefined) {
    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'name is required.' }, { status: 400 });
    }
    values.push(name.trim());
    updates.push(`name = $${values.length}`);
  }

  if (username !== undefined) {
    values.push(username ? username.trim() : null);
    updates.push(`username = $${values.length}`);
  }

  if (specialty !== undefined) {
    if (!specialty || !specialty.trim()) {
      return NextResponse.json({ error: 'specialty is required.' }, { status: 400 });
    }
    values.push(specialty.trim());
    updates.push(`specialty = $${values.length}`);
  }

  if (description !== undefined) {
    values.push(description ? description.trim() : null);
    updates.push(`description = $${values.length}`);
  }

  if (opensAt !== undefined) {
    if (opensAt !== null && typeof opensAt !== 'string') {
      return NextResponse.json(
        { error: 'opens_at must be a string or null.' },
        { status: 400 }
      );
    }
    values.push(opensAt ? opensAt.trim() : null);
    updates.push(`opens_at = $${values.length}`);
  }

  if (closesAt !== undefined) {
    if (closesAt !== null && typeof closesAt !== 'string') {
      return NextResponse.json(
        { error: 'closes_at must be a string or null.' },
        { status: 400 }
      );
    }
    values.push(closesAt ? closesAt.trim() : null);
    updates.push(`closes_at = $${values.length}`);
  }

  if (password !== undefined) {
    const trimmed = password ? password.trim() : '';
    if (trimmed) {
      const hashed = await bcrypt.hash(trimmed, 10);
      values.push(hashed);
      updates.push(`password_hash = $${values.length}`);
    } else {
      values.push(null);
      updates.push(`password_hash = $${values.length}`);
    }
  }

  if (typeof isDisabled === 'boolean') {
    values.push(isDisabled);
    updates.push(`is_disabled = $${values.length}`);
  }

  if (updates.length === 0) {
    return NextResponse.json({ error: 'No doctor updates provided.' }, { status: 400 });
  }

  values.push(clinic.id);
  values.push(params.id);

  try {
    const result = await pool.query(
      `UPDATE doctors
       SET ${updates.join(', ')}
       WHERE clinic_id = $${values.length - 1} AND id = $${values.length}
       RETURNING id, clinic_id, name, username, specialty, opens_at, closes_at, description, avatar, is_disabled, created_at, updated_at`,
      values
    );

    if (result.rowCount === 0) {
      return NextResponse.json({ error: 'Doctor not found.' }, { status: 404 });
    }

    await logAudit({
      clinicId: clinic.id,
      doctorId: authResult.auth.doctorId,
      action: 'doctor_updated',
      metadata: {
        updatedDoctorId: result.rows[0].id,
        fields: updates
          .map((field) => field.split('=')[0].trim())
          .filter((field) => field !== 'password_hash'),
      },
    });

    return NextResponse.json({ doctor: result.rows[0] });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Doctor update failed:', err);
    return NextResponse.json({ error: 'Unable to update doctor.' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
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

  try {
    const result = await pool.query(
      'DELETE FROM doctors WHERE clinic_id = $1 AND id = $2 RETURNING id, name',
      [clinic.id, params.id]
    );

    if (result.rowCount === 0) {
      return NextResponse.json({ error: 'Doctor not found.' }, { status: 404 });
    }

    await logAudit({
      clinicId: clinic.id,
      doctorId: authResult.auth.doctorId,
      action: 'doctor_deleted',
      metadata: {
        deletedDoctorId: result.rows[0].id,
        deletedDoctorName: result.rows[0].name,
      },
    });

    return NextResponse.json({ doctor: result.rows[0] });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Doctor delete failed:', err);
    return NextResponse.json({ error: 'Unable to delete doctor.' }, { status: 500 });
  }
}
