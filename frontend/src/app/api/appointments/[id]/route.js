import { NextResponse } from 'next/server';

import { resolveClinic } from '@/lib/server/clinic-resolver';
import { pool } from '@/lib/server/db';
import { sendBrevoEmail } from '@/lib/server/brevo-mail';
import { createCancelToken } from '@/lib/server/appointment-cancel';
import { requireAuth } from '@/lib/server/auth';
import { logAudit } from '@/lib/server/audit';
import { upsertAppointmentReminder } from '@/lib/server/reminders';
import { getHeader } from '@/lib/server/headers';
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

function normalizeDateValue(value) {
  if (!value) {
    return '';
  }

  if (typeof value === 'string') {
    return value.slice(0, 10);
  }

  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  return String(value).slice(0, 10);
}

function getBaseUrl(headers) {
  const forwardedProto = getHeader(headers, 'x-forwarded-proto');
  const forwardedHost = getHeader(headers, 'x-forwarded-host');
  const host = forwardedHost || getHeader(headers, 'host');

  if (!host) {
    return process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || '';
  }

  const proto = forwardedProto ? forwardedProto.split(',')[0].trim() : 'https';
  return `${proto}://${host.split(',')[0].trim()}`;
}

function getFirstName(value) {
  if (!value) {
    return '';
  }

  return value.trim().split(/\s+/)[0] || '';
}

function buildClinicLogoUrl(clinic) {
  const fallback =
    'https://res.cloudinary.com/dfuieb3iz/image/upload/v1769096434/logo_y76eph.png';

  if (clinic?.logo) {
    return String(clinic.logo).trim();
  }

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  if (cloudName && clinic?.id) {
    return `https://res.cloudinary.com/${cloudName}/image/upload/clinics/${clinic.id}/logo`;
  }

  return fallback;
}

async function sendRescheduledEmail({
  to,
  patientName,
  clinic,
  date,
  time,
  baseUrl,
  appointmentId,
}) {
  if (!to) {
    return { sent: false, error: 'missing recipient' };
  }

  const safeClinicName = clinic?.name || 'the clinic';
  const subject = `Appointment rescheduled at ${safeClinicName}`;
  const text = `Your appointment at ${safeClinicName} has been rescheduled to ${date} at ${time}.`;
  const token = createCancelToken({
    appointmentId,
    clinicId: clinic?.id,
    patientEmail: to,
  });
  const resolvedBaseUrl = clinic?.domain ? `https://${clinic.domain}` : baseUrl;
  const cancelUrl = token && resolvedBaseUrl
    ? `${resolvedBaseUrl}/api/appointments/cancel?token=${encodeURIComponent(token)}`
    : null;
  const rescheduleUrl = token && resolvedBaseUrl
    ? `${resolvedBaseUrl}/api/appointments/reschedule?token=${encodeURIComponent(token)}`
    : null;
  const templateId = Number(process.env.BREVO_APPOINTMENT_RESCHEDULE_TEMPLATE_ID);

  try {
    const info = await sendBrevoEmail({
      to,
      subject,
      text: cancelUrl ? `${text}\n\nCancel: ${cancelUrl}` : text,
      senderName: safeClinicName,
      templateId: Number.isInteger(templateId) ? templateId : null,
      params: {
        FIRSTNAME: getFirstName(patientName || ''),
        clinic_name: safeClinicName,
        clinic_logo: buildClinicLogoUrl(clinic),
        clinic_id: clinic?.id || '',
        date,
        time,
        cancel_token: token || '',
        reschedule_url: rescheduleUrl || '',
      },
    });

    return { sent: true, info };
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Reschedule email failed:', error);
    return { sent: false, error: error?.message || 'Unable to send reschedule email.' };
  }
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

    const existingResult = await pool.query(
      'SELECT id, date, time FROM appointments WHERE id = $1 AND clinic_id = $2',
      [params.id, clinic.id]
    );

    if (existingResult.rowCount === 0) {
      return NextResponse.json({ error: 'Appointment not found.' }, { status: 404 });
    }

    const previous = existingResult.rows[0];
    const previousDate = normalizeDateValue(previous.date);
    const previousTime = normalizeTime(previous.time);

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

    const rescheduled = previousDate !== date || previousTime !== normalizedTime;

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
      action: rescheduled ? 'appointment_rescheduled_by_admin' : 'appointment_updated',
      metadata: {
        appointmentId: params.id,
        rescheduled,
        previous: {
          date: previousDate,
          time: previousTime,
        },
        next: {
          date,
          time: normalizedTime,
        },
      },
    });

    if (rescheduled && patientEmail) {
      const trimmedEmail = patientEmail.trim();
      if (trimmedEmail) {
        void sendRescheduledEmail({
          to: trimmedEmail,
          patientName,
          clinic,
          date,
          time: normalizedTime,
          baseUrl: getBaseUrl(request.headers),
          appointmentId: params.id,
        });
      }
    }

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
