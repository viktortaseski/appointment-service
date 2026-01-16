import { NextResponse } from 'next/server';

import { resolveClinic } from '@/lib/server/clinic-resolver';
import { pool } from '@/lib/server/db';
import { requireAuth } from '@/lib/server/auth';
import { logAudit } from '@/lib/server/audit';
import { upsertAppointmentReminder } from '@/lib/server/reminders';
import {
  buildTimeSlotsForDate,
  computeBlockedTimes,
  normalizeTime,
} from '@/lib/server/availability';

export const runtime = 'nodejs';

async function pruneOldAppointments() {
  await pool.query(
    "DELETE FROM appointments WHERE date < (CURRENT_DATE - INTERVAL '2 days')"
  );
}

async function upsertPatientRecord({ name, email, phone }) {
  const normalizedEmail = email?.trim() || null;
  const normalizedPhone = phone?.trim() || null;
  const normalizedName = name?.trim();

  if (!normalizedName || (!normalizedEmail && !normalizedPhone)) {
    return;
  }

  await pool.query(
    `INSERT INTO patients (name, email, phone)
     VALUES ($1, $2, $3)
     ON CONFLICT DO NOTHING`,
    [normalizedName, normalizedEmail, normalizedPhone]
  );
}

export async function GET(request, { params }) {
  const { clinic, error } = await resolveClinic(request.headers);
  if (error) {
    return NextResponse.json({ error }, { status: 404 });
  }

  try {
    const result = await pool.query(
      'SELECT * FROM appointments_with_doctors WHERE clinic_id = $1 AND id = $2',
      [clinic.id, params.id]
    );

    if (result.rowCount === 0) {
      return NextResponse.json({ error: 'Appointment not found.' }, { status: 404 });
    }

    return NextResponse.json({ appointment: result.rows[0] });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Appointment lookup failed:', err);
    return NextResponse.json({ error: 'Unable to load appointment.' }, { status: 500 });
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

  const body = await request.json();
  const { completed } = body || {};

  if (typeof completed !== 'boolean') {
    return NextResponse.json({ error: 'completed must be a boolean.' }, { status: 400 });
  }

  try {
    const updateResult = await pool.query(
      'UPDATE appointments SET completed = $1 WHERE id = $2 AND clinic_id = $3 RETURNING id',
      [completed, params.id, clinic.id]
    );

    if (updateResult.rowCount === 0) {
      return NextResponse.json({ error: 'Appointment not found.' }, { status: 404 });
    }

    const appointmentResult = await pool.query(
      'SELECT * FROM appointments_with_doctors WHERE id = $1',
      [params.id]
    );

    await logAudit({
      clinicId: clinic.id,
      doctorId: authResult.auth?.doctorId,
      action: 'appointment_completion_toggled',
      metadata: {
        appointmentId: params.id,
        completed,
      },
    });

    return NextResponse.json({ appointment: appointmentResult.rows[0] });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Appointment update failed:', err);
    return NextResponse.json({ error: 'Unable to update appointment.' }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
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
    patient_name: patientName,
    patient_email: patientEmail,
    patient_phone: patientPhone,
    date,
    time,
    notes,
  } = body || {};

  if (!doctorId || !patientName || !date || !time) {
    return NextResponse.json(
      { error: 'doctor_id, patient_name, date, and time are required.' },
      { status: 400 }
    );
  }

  try {
    await pruneOldAppointments();
    if (clinic.is_disabled) {
      return NextResponse.json(
        { error: 'Clinic is not accepting appointments.' },
        { status: 403 }
      );
    }

    const doctorCheck = await pool.query(
      'SELECT id, is_disabled FROM doctors WHERE id = $1 AND clinic_id = $2',
      [doctorId, clinic.id]
    );

    if (doctorCheck.rowCount === 0) {
      return NextResponse.json(
        { error: 'Doctor does not belong to this clinic.' },
        { status: 400 }
      );
    }

    if (doctorCheck.rows[0].is_disabled) {
      return NextResponse.json(
        { error: 'Doctor is not accepting appointments.' },
        { status: 403 }
      );
    }

    const normalizedTime = normalizeTime(time);
    const scheduleResult = await pool.query(
      `SELECT weekday, opens_at, closes_at, is_off
       FROM doctor_working_hours
       WHERE clinic_id = $1 AND doctor_id = $2`,
      [clinic.id, doctorId]
    );
    const allowedTimes = buildTimeSlotsForDate(scheduleResult.rows, clinic, date);

    if (!normalizedTime || !allowedTimes.includes(normalizedTime)) {
      return NextResponse.json(
        { error: 'Selected time is outside doctor hours.' },
        { status: 400 }
      );
    }

    const availabilityResult = await pool.query(
      `SELECT start_date, end_date, start_time, end_time
       FROM doctor_unavailability
       WHERE clinic_id = $1 AND doctor_id = $2`,
      [clinic.id, doctorId]
    );

    const blockedTimes = computeBlockedTimes(date, availabilityResult.rows, allowedTimes);

    if (blockedTimes.includes(normalizedTime)) {
      return NextResponse.json(
        { error: 'Selected time is unavailable for this doctor.' },
        { status: 409 }
      );
    }

    const updateResult = await pool.query(
      'UPDATE appointments SET doctor_id = $1, patient_name = $2, patient_email = $3, patient_phone = $4, date = $5, time = $6, notes = $7 WHERE id = $8 AND clinic_id = $9 RETURNING id',
      [
        doctorId,
        patientName,
        patientEmail || '',
        patientPhone || '',
        date,
        normalizedTime,
        notes || null,
        params.id,
        clinic.id,
      ]
    );

    if (updateResult.rowCount === 0) {
      return NextResponse.json({ error: 'Appointment not found.' }, { status: 404 });
    }

    await upsertAppointmentReminder({
      appointmentId: params.id,
      clinicId: clinic.id,
      date,
      time: normalizedTime,
    });

    await upsertPatientRecord({
      name: patientName,
      email: patientEmail,
      phone: patientPhone,
    });

    const appointmentResult = await pool.query(
      'SELECT * FROM appointments_with_doctors WHERE id = $1',
      [params.id]
    );

    await logAudit({
      clinicId: clinic.id,
      doctorId: authResult.auth?.doctorId,
      action: 'appointment_updated',
      metadata: {
        appointmentId: params.id,
      },
    });

    return NextResponse.json({ appointment: appointmentResult.rows[0] });
  } catch (err) {
    if (err?.code === '23505') {
      return NextResponse.json(
        { error: 'Appointment slot already booked.' },
        { status: 409 }
      );
    }

    // eslint-disable-next-line no-console
    console.error('Appointment update failed:', err);
    return NextResponse.json({ error: 'Unable to update appointment.' }, { status: 500 });
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

  try {
    const deleteResult = await pool.query(
      'DELETE FROM appointments WHERE id = $1 AND clinic_id = $2',
      [params.id, clinic.id]
    );

    if (deleteResult.rowCount === 0) {
      return NextResponse.json({ error: 'Appointment not found.' }, { status: 404 });
    }

    await logAudit({
      clinicId: clinic.id,
      doctorId: authResult.auth?.doctorId,
      action: 'appointment_deleted',
      metadata: {
        appointmentId: params.id,
      },
    });

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Appointment delete failed:', err);
    return NextResponse.json({ error: 'Unable to delete appointment.' }, { status: 500 });
  }
}
