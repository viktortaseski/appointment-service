import { NextResponse } from 'next/server';

import { resolveClinic } from '@/lib/server/clinic-resolver';
import { pool } from '@/lib/server/db';
import { requireAuth } from '@/lib/server/auth';
import { logAudit } from '@/lib/server/audit';

export const runtime = 'nodejs';

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
    const result = await pool.query(
      'DELETE FROM doctor_unavailability WHERE id = $1 AND clinic_id = $2 RETURNING id',
      [params.id, clinic.id]
    );

    if (result.rowCount === 0) {
      return NextResponse.json({ error: 'Record not found.' }, { status: 404 });
    }

    await logAudit({
      clinicId: clinic.id,
      doctorId: authResult.auth?.doctorId,
      action: 'doctor_unavailability_removed',
      metadata: {
        recordId: result.rows[0].id,
      },
    });

    return NextResponse.json({ id: result.rows[0].id });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Availability record delete failed:', err);
    return NextResponse.json({ error: 'Unable to remove unavailable block.' }, { status: 500 });
  }
}
