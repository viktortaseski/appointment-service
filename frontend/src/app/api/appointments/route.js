import { NextResponse } from 'next/server';

import { resolveClinic } from '@/lib/server/clinic-resolver';
import { pool } from '@/lib/server/db';
import { sendBrevoEmail } from '@/lib/server/brevo-mail';
import { checkRateLimit } from '@/lib/server/rate-limit';
import { debugLog } from '@/lib/server/debug';
import { createCancelToken } from '@/lib/server/appointment-cancel';
import { getHeader } from '@/lib/server/headers';
import {
  buildTimeSlotsFromClinic,
  computeBlockedTimes,
  normalizeTime,
} from '@/lib/server/availability';

export const runtime = 'nodejs';

const emailQueue = [];
let emailQueueRunning = false;

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

function maskEmail(value) {
  if (!value || !value.includes('@')) {
    return value || '';
  }

  const [name, domain] = value.split('@');
  const maskedName = name.length > 2 ? `${name[0]}***${name[name.length - 1]}` : name[0];
  return `${maskedName}@${domain}`;
}

function getFirstName(value) {
  if (!value) {
    return '';
  }

  return value.trim().split(/\s+/)[0] || '';
}

function enqueueEmailJob(job, context) {
  return new Promise((resolve, reject) => {
    emailQueue.push({ job, resolve, reject, context });
    if (!emailQueueRunning) {
      void runEmailQueue();
    }
  });
}

async function runEmailQueue() {
  emailQueueRunning = true;

  while (emailQueue.length > 0) {
    const { job, resolve, reject, context } = emailQueue.shift();

    try {
      // eslint-disable-next-line no-console
      console.log('[mail] queue: start', context);
      const result = await job();
      // eslint-disable-next-line no-console
      console.log('[mail] queue: done', context);
      resolve(result);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('[mail] queue: error', {
        context,
        message: error?.message || error,
        code: error?.code,
      });
      reject(error);
    }
  }

  emailQueueRunning = false;
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

async function sendAppointmentEmail({
  to,
  clinicName,
  clinicId,
  clinicLogo,
  date,
  time,
  appointmentId,
  patientName,
  baseUrl,
}) {
  const safeClinicName = clinicName || 'the clinic';
  const subject = `Appointment confirmed at ${safeClinicName}`;
  const text = `You have an appointment at ${safeClinicName} on ${date} at ${time}.`;
  const token = createCancelToken({
    appointmentId,
    clinicId,
    patientEmail: to,
  });
  const cancelUrl = token && baseUrl
    ? `${baseUrl}/api/appointments/cancel?token=${encodeURIComponent(token)}`
    : null;
  const templateId = Number(process.env.BREVO_APPOINTMENT_TEMPLATE_ID);
  const cancelToken = token || '';

  try {
    // eslint-disable-next-line no-console
    console.log('[mail] sendBrevoEmail: before', {
      to: maskEmail(to),
      subject,
    });
    const info = await sendBrevoEmail({
      to,
      subject,
      text: cancelUrl ? `${text}\n\nCancel: ${cancelUrl}` : text,
      senderName: safeClinicName,
      templateId: Number.isInteger(templateId) ? templateId : null,
      params: {
        FIRSTNAME: getFirstName(patientName || ''),
        clinic_name: safeClinicName,
        clinic_logo: clinicLogo || '',
        clinic_id: clinicId || '',
        date,
        time,
        cancel_token: cancelToken,
      },
    });

    // eslint-disable-next-line no-console
    console.log('[mail] sendBrevoEmail: after', {
      messageId: info?.messageId,
    });

    return { sent: true, info };
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[mail] sendBrevoEmail: failed', {
      message: error?.message || error,
      code: error?.code,
      command: error?.command,
      response: error?.response,
      stack: error?.stack,
    });
    return {
      sent: false,
      error: error?.message || 'Unable to send confirmation email.',
    };
  }
}

export async function GET(request) {
  debugLog('appointments: GET start');
  const { clinic, error } = await resolveClinic(request.headers);
  if (error) {
    debugLog('appointments: GET clinic error', { error });
    return NextResponse.json({ error }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const doctorId = searchParams.get('doctorId');
  const date = searchParams.get('date');
  const completed = searchParams.get('completed');

  const conditions = ['clinic_id = $1'];
  const values = [clinic.id];

  if (doctorId) {
    values.push(doctorId);
    conditions.push(`doctor_id = $${values.length}`);
  }

  if (date) {
    values.push(date);
    conditions.push(`date = $${values.length}`);
  }

  if (completed !== null) {
    const isCompleted = completed === 'true';
    values.push(isCompleted);
    conditions.push(`completed = $${values.length}`);
  }

  const query = `
    SELECT *
    FROM appointments_with_doctors
    WHERE ${conditions.join(' AND ')}
    ORDER BY date ASC, time ASC
  `;

  try {
    await pruneOldAppointments();
    const result = await pool.query(query, values);
    let unavailableTimes = [];

    if (doctorId && date) {
      const unavailableResult = await pool.query(
        `SELECT start_date, end_date, start_time, end_time
         FROM doctor_unavailability
         WHERE clinic_id = $1 AND doctor_id = $2`,
        [clinic.id, doctorId]
      );

      const slots = buildTimeSlotsFromClinic(clinic);
      unavailableTimes = computeBlockedTimes(date, unavailableResult.rows, slots);
    }

    return NextResponse.json({
      clinic,
      appointments: result.rows,
      unavailableTimes,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Appointments fetch failed:', err);
    return NextResponse.json({ error: 'Unable to load appointments.' }, { status: 500 });
  }
}

export async function POST(request) {
  debugLog('appointments: POST start');
  const limit = checkRateLimit(request.headers, {
    windowMs: 5 * 60 * 1000,
    max: 20,
    keyPrefix: 'book',
  });

  if (limit.limited) {
    debugLog('appointments: POST rate limited');
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } }
    );
  }

  const { clinic, error } = await resolveClinic(request.headers);
  if (error) {
    debugLog('appointments: POST clinic error', { error });
    return NextResponse.json({ error }, { status: 404 });
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
    debugLog('appointments: POST missing fields', {
      hasDoctor: Boolean(doctorId),
      hasName: Boolean(patientName),
      hasDate: Boolean(date),
      hasTime: Boolean(time),
    });
    return NextResponse.json(
      { error: 'doctor_id, patient_name, date, and time are required.' },
      { status: 400 }
    );
  }

  try {
    await pruneOldAppointments();
    if (clinic.is_disabled) {
      debugLog('appointments: POST clinic disabled', { clinicId: clinic.id });
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
      debugLog('appointments: POST doctor mismatch', { doctorId });
      return NextResponse.json(
        { error: 'Doctor does not belong to this clinic.' },
        { status: 400 }
      );
    }

    if (doctorCheck.rows[0].is_disabled) {
      debugLog('appointments: POST doctor disabled', { doctorId });
      return NextResponse.json(
        { error: 'Doctor is not accepting appointments.' },
        { status: 403 }
      );
    }

    const normalizedTime = normalizeTime(time);
    const allowedTimes = buildTimeSlotsFromClinic(clinic);

    if (!normalizedTime || !allowedTimes.includes(normalizedTime)) {
      debugLog('appointments: POST time outside hours', {
        time: normalizedTime,
        allowedCount: allowedTimes.length,
      });
      return NextResponse.json(
        { error: 'Selected time is outside clinic hours.' },
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
      debugLog('appointments: POST time blocked', { time: normalizedTime });
      return NextResponse.json(
        { error: 'Selected time is unavailable for this doctor.' },
        { status: 409 }
      );
    }

    const insertResult = await pool.query(
      'INSERT INTO appointments (clinic_id, doctor_id, patient_name, patient_email, patient_phone, date, time, notes) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id',
      [
        clinic.id,
        doctorId,
        patientName,
        patientEmail || '',
        patientPhone || '',
        date,
        normalizedTime,
        notes || null,
      ]
    );

    const appointmentResult = await pool.query(
      'SELECT * FROM appointments_with_doctors WHERE id = $1',
      [insertResult.rows[0].id]
    );

    await upsertPatientRecord({
      name: patientName,
      email: patientEmail,
      phone: patientPhone,
    });

    if (patientEmail) {
      void enqueueEmailJob(
        () =>
          sendAppointmentEmail({
            to: patientEmail,
            clinicName: clinic.name,
            clinicId: clinic.id,
            clinicLogo: clinic.logo,
            date,
            time: normalizedTime,
            appointmentId: insertResult.rows[0].id,
            patientName,
            baseUrl: getBaseUrl(request.headers),
          }),
        {
          clinicId: clinic.id,
          appointmentId: insertResult.rows[0].id,
          recipient: maskEmail(patientEmail),
        }
      ).catch((emailError) => {
        // eslint-disable-next-line no-console
        console.error('[mail] queue: unhandled error', {
          message: emailError?.message || emailError,
          code: emailError?.code,
        });
      });
    }

    debugLog('appointments: POST success', { appointmentId: insertResult.rows[0].id });
    return NextResponse.json({ appointment: appointmentResult.rows[0] }, { status: 201 });
  } catch (err) {
    if (err?.code === '23505') {
      debugLog('appointments: POST conflict');
      return NextResponse.json(
        { error: 'Appointment slot already booked.' },
        { status: 409 }
      );
    }

    // eslint-disable-next-line no-console
    console.error('Appointment creation failed:', err);
    return NextResponse.json({ error: 'Unable to create appointment.' }, { status: 500 });
  }
}
