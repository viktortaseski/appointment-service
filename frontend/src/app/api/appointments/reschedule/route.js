import { NextResponse } from 'next/server';

import { logAudit } from '@/lib/server/audit';
import { pool } from '@/lib/server/db';
import { verifyCancelToken } from '@/lib/server/appointment-cancel';

export const runtime = 'nodejs';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');

  if (!token) {
    return NextResponse.json({ error: 'Missing token.' }, { status: 400 });
  }

  const { payload, error } = verifyCancelToken(token);
  if (error) {
    return NextResponse.json({ error }, { status: 400 });
  }

  const { appointmentId, clinicId } = payload || {};
  if (!appointmentId || !clinicId) {
    return NextResponse.json({ error: 'Invalid token.' }, { status: 400 });
  }

  let clinicDomain = null;

  try {
    const clinicResult = await pool.query(
      'SELECT domain FROM clinics WHERE id = $1',
      [clinicId]
    );
    clinicDomain = clinicResult.rows[0]?.domain || null;

    await pool.query(
      'DELETE FROM appointments WHERE id = $1 AND clinic_id = $2',
      [appointmentId, clinicId]
    );

    await logAudit({
      clinicId,
      action: 'appointment_rescheduled_by_patient',
      metadata: {
        appointmentId,
      },
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Appointment reschedule failed:', err);
  }

  const redirectUrl = clinicDomain
    ? `https://${clinicDomain}/?reschedule=1`
    : new URL('/?reschedule=1', request.url);
  return NextResponse.redirect(redirectUrl);
}
