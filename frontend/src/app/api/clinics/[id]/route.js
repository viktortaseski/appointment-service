import { NextResponse } from 'next/server';

import { pool } from '@/lib/server/db';

export const runtime = 'nodejs';

export async function GET(request, { params }) {
  try {
    const result = await pool.query(
      'SELECT id, name, domain, logo, phone, email, address, theme_confirm_bg, theme_confirm_border, is_disabled, opens_at, closes_at, slot_minutes, default_language, created_at FROM clinics WHERE id = $1',
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
