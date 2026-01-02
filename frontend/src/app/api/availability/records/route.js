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

  const authResult = await requireAuth(request, clinic);
  if (authResult.error) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  const { searchParams } = new URL(request.url);
  const doctorId = searchParams.get('doctorId');
  const values = [clinic.id];
  const conditions = ['u.clinic_id = $1'];

  if (doctorId) {
    values.push(doctorId);
    conditions.push(`u.doctor_id = $${values.length}`);
  }

  try {
    const result = await pool.query(
      `SELECT u.id, u.doctor_id, u.start_date, u.end_date, u.start_time, u.end_time,
              d.name AS doctor_name
       FROM doctor_unavailability u
       JOIN doctors d ON d.id = u.doctor_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY u.start_date ASC, u.start_time NULLS FIRST`,
      values
    );

    return NextResponse.json({ records: result.rows });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Availability records fetch failed:', err);
    return NextResponse.json({ error: 'Unable to load availability.' }, { status: 500 });
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

  const body = await request.json();
  const {
    doctor_id: doctorId,
    start_date: startDate,
    end_date: endDate,
    start_time: startTime,
    end_time: endTime,
  } = body || {};

  if (!doctorId || !startDate || !endDate) {
    return NextResponse.json(
      { error: 'doctor_id, start_date, and end_date are required.' },
      { status: 400 }
    );
  }

  if (startDate > endDate) {
    return NextResponse.json({ error: 'start_date must be before end_date.' }, { status: 400 });
  }

  if ((startTime && !endTime) || (!startTime && endTime)) {
    return NextResponse.json(
      { error: 'start_time and end_time must both be provided.' },
      { status: 400 }
    );
  }

  if (startTime && startDate !== endDate) {
    return NextResponse.json(
      { error: 'Time ranges must use the same start and end date.' },
      { status: 400 }
    );
  }

  if (startTime && endTime && startTime >= endTime) {
    return NextResponse.json({ error: 'start_time must be before end_time.' }, { status: 400 });
  }

  try {
    const doctorCheck = await pool.query(
      'SELECT id FROM doctors WHERE id = $1 AND clinic_id = $2',
      [doctorId, clinic.id]
    );

    if (doctorCheck.rowCount === 0) {
      return NextResponse.json(
        { error: 'Doctor does not belong to this clinic.' },
        { status: 400 }
      );
    }

    const result = await pool.query(
      `INSERT INTO doctor_unavailability
         (clinic_id, doctor_id, start_date, end_date, start_time, end_time)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, doctor_id, start_date, end_date, start_time, end_time`,
      [
        clinic.id,
        doctorId,
        startDate,
        endDate,
        startTime || null,
        endTime || null,
      ]
    );

    await logAudit({
      clinicId: clinic.id,
      doctorId: authResult.auth?.doctorId,
      action: 'doctor_unavailability_added',
      metadata: {
        targetDoctorId: doctorId,
        startDate,
        endDate,
      },
    });

    return NextResponse.json({ record: result.rows[0] }, { status: 201 });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Availability record create failed:', err);
    return NextResponse.json({ error: 'Unable to update availability.' }, { status: 500 });
  }
}
