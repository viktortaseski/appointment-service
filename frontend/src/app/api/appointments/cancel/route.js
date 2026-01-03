import { NextResponse } from 'next/server';

import { logAudit } from '@/lib/server/audit';
import { pool } from '@/lib/server/db';
import { verifyCancelToken } from '@/lib/server/appointment-cancel';

export const runtime = 'nodejs';

function buildHtmlResponse(message) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Appointment cancellation</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 40px; color: #0f172a; }
      .card { max-width: 560px; margin: 0 auto; border: 1px solid #e2e8f0; padding: 24px; border-radius: 12px; }
      h1 { font-size: 20px; margin: 0 0 12px; }
      p { margin: 0; line-height: 1.5; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>Appointment update</h1>
      <p>${message}</p>
    </div>
  </body>
</html>`;
}

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

  try {
    const deleteResult = await pool.query(
      'DELETE FROM appointments WHERE id = $1 AND clinic_id = $2 RETURNING id',
      [appointmentId, clinicId]
    );

    if (deleteResult.rowCount === 0) {
      return NextResponse.json({ error: 'Appointment not found.' }, { status: 404 });
    }

    await logAudit({
      clinicId,
      action: 'appointment_cancelled_by_patient',
      metadata: {
        appointmentId,
      },
    });

    const wantsHtml = (request.headers.get('accept') || '').includes('text/html');
    if (wantsHtml) {
      return new NextResponse(
        buildHtmlResponse('Your appointment has been cancelled.'),
        { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
      );
    }

    return NextResponse.json({ cancelled: true });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Appointment cancellation failed:', err);
    return NextResponse.json({ error: 'Unable to cancel appointment.' }, { status: 500 });
  }
}
