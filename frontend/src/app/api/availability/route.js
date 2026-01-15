import { NextResponse } from 'next/server';

import { resolveClinic } from '@/lib/server/clinic-resolver';
import { pool } from '@/lib/server/db';
import {
  buildTimeSlotsFromDoctor,
  computeBlockedTimes,
  normalizeDateKey,
} from '@/lib/server/availability';

export const runtime = 'nodejs';

export async function GET(request) {
  const { clinic, error } = await resolveClinic(request.headers);
  if (error) {
    return NextResponse.json({ error }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const doctorId = searchParams.get('doctorId');
  const date = searchParams.get('date');
  const dateKey = normalizeDateKey(date);

  if (!doctorId || !dateKey) {
    return NextResponse.json({ error: 'doctorId and date are required.' }, { status: 400 });
  }

  try {
    const doctorResult = await pool.query(
      'SELECT opens_at, closes_at FROM doctors WHERE clinic_id = $1 AND id = $2',
      [clinic.id, doctorId]
    );

    const result = await pool.query(
      `SELECT start_date, end_date, start_time, end_time
       FROM doctor_unavailability
       WHERE clinic_id = $1 AND doctor_id = $2`,
      [clinic.id, doctorId]
    );

    const slots = buildTimeSlotsFromDoctor(doctorResult.rows[0], clinic);
    const unavailableTimes = computeBlockedTimes(dateKey, result.rows, slots);

    return NextResponse.json({
      clinic,
      unavailableTimes,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Availability fetch failed:', err);
    return NextResponse.json({ error: 'Unable to load availability.' }, { status: 500 });
  }
}
