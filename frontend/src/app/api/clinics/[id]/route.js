import { NextResponse } from 'next/server';

import { pool } from '@/lib/server/db';

export const runtime = 'nodejs';

export async function GET(request, { params }) {
  try {
    const result = await pool.query(
      `SELECT
         c.id,
         c.name,
         c.domain,
         c.logo,
         c.phone,
         c.email,
         c.address,
         c.theme_primary,
         c.theme_secondary,
         c.is_disabled,
         c.opens_at,
         c.closes_at,
         c.slot_minutes,
         c.default_language,
         c.created_at,
         COALESCE(r.rating_avg, 0) AS rating_avg,
         COALESCE(r.rating_count, 0) AS rating_count
       FROM clinics c
       LEFT JOIN (
         SELECT clinic_id, AVG(rating)::float AS rating_avg, COUNT(*) AS rating_count
         FROM clinic_ratings
         GROUP BY clinic_id
       ) r ON r.clinic_id = c.id
       WHERE c.id = $1`,
      [params.id]
    );

    if (result.rowCount === 0) {
      return NextResponse.json({ error: 'Clinic not found.' }, { status: 404 });
    }

    return NextResponse.json({ clinic: result.rows[0] });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Clinic fetch failed:', err);
    return NextResponse.json({ error: 'Unable to load clinic.' }, { status: 500 });
  }
}
