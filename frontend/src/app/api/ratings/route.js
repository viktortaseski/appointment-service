import { NextResponse } from 'next/server';

import { pool } from '@/lib/server/db';
import { verifyRatingToken } from '@/lib/server/appointment-rating';
import { debugLog } from '@/lib/server/debug';

export const runtime = 'nodejs';

export async function POST(request) {
  const body = await request.json();
  const { appointmentId, rating, token } = body || {};
  const normalizedRating = Number(rating);

  if (!appointmentId || !token || !Number.isFinite(normalizedRating)) {
    return NextResponse.json({ error: 'Missing rating data.' }, { status: 400 });
  }

  if (normalizedRating < 1 || normalizedRating > 5) {
    return NextResponse.json({ error: 'Rating must be between 1 and 5.' }, { status: 400 });
  }

  const { payload, error } = verifyRatingToken(token);
  if (error) {
    return NextResponse.json({ error }, { status: 403 });
  }

  if (!payload || payload.appointmentId !== appointmentId) {
    return NextResponse.json({ error: 'Rating token does not match appointment.' }, { status: 403 });
  }

  try {
    const appointmentResult = await pool.query(
      'SELECT clinic_id, patient_email FROM appointments WHERE id = $1',
      [appointmentId]
    );

    if (appointmentResult.rowCount === 0) {
      return NextResponse.json({ error: 'Appointment not found.' }, { status: 404 });
    }

    const appointment = appointmentResult.rows[0];
    if (payload.clinicId && payload.clinicId !== appointment.clinic_id) {
      return NextResponse.json({ error: 'Clinic mismatch.' }, { status: 403 });
    }

    if (payload.patientEmail && appointment.patient_email) {
      const normalizedTokenEmail = String(payload.patientEmail).trim().toLowerCase();
      const normalizedAppointmentEmail = String(appointment.patient_email).trim().toLowerCase();
      if (normalizedTokenEmail !== normalizedAppointmentEmail) {
        return NextResponse.json({ error: 'Patient mismatch.' }, { status: 403 });
      }
    }

    const insertResult = await pool.query(
      `INSERT INTO clinic_ratings (clinic_id, appointment_id, patient_email, rating)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [appointment.clinic_id, appointmentId, appointment.patient_email || null, normalizedRating]
    );

    debugLog('rating: created', {
      ratingId: insertResult.rows[0]?.id,
      appointmentId,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    if (err?.code === '23505') {
      return NextResponse.json({ error: 'Rating already submitted.' }, { status: 409 });
    }

    // eslint-disable-next-line no-console
    console.error('Rating creation failed:', err);
    return NextResponse.json({ error: 'Unable to submit rating.' }, { status: 500 });
  }
}
