import { NextResponse } from 'next/server';

import { resolveClinic } from '@/lib/server/clinic-resolver';
import { pool } from '@/lib/server/db';
import { requireAuth } from '@/lib/server/auth';

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

  if (!authResult.auth || authResult.auth.clinicId !== clinic.id) {
    return NextResponse.json({ error: 'Not authorized for this clinic.' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const search = (searchParams.get('search') || '').trim();
  const values = [clinic.id];
  let searchClause = '';

  if (search) {
    values.push(`%${search}%`);
    searchClause = ' AND (p.name ILIKE $2 OR p.email ILIKE $2 OR p.phone ILIKE $2)';
  }

  const query = `
    SELECT DISTINCT p.id, p.name, p.email, p.phone, p.created_at, p.updated_at
    FROM patients p
    JOIN appointments a
      ON a.clinic_id = $1
      AND (
        (p.email IS NOT NULL AND p.email <> '' AND p.email = a.patient_email)
        OR (p.phone IS NOT NULL AND p.phone <> '' AND p.phone = a.patient_phone)
      )
    WHERE 1=1${searchClause}
    ORDER BY p.name ASC
  `;

  try {
    const result = await pool.query(query, values);
    return NextResponse.json({ patients: result.rows });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Patients fetch failed:', err);
    return NextResponse.json({ error: 'Unable to load patients.' }, { status: 500 });
  }
}
