import { NextResponse } from 'next/server';

import { pool } from '@/lib/server/db';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const result = await pool.query(
      'SELECT id, name, domain, logo, phone, email, address, theme_confirm_bg, theme_confirm_border, is_disabled, opens_at, closes_at, slot_minutes, default_language, created_at FROM clinics ORDER BY name'
    );
    return NextResponse.json({ clinics: result.rows });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Clinics fetch failed:', err);
    return NextResponse.json({ error: 'Unable to load clinics.' }, { status: 500 });
  }
}

export async function POST(request) {
  const body = await request.json();
  const {
    name,
    domain,
    logo,
    phone,
    email,
    address,
    is_disabled: isDisabled,
    opens_at: opensAt,
    closes_at: closesAt,
    slot_minutes: slotMinutes,
  } = body || {};

  if (!name || !domain) {
    return NextResponse.json({ error: 'name and domain are required.' }, { status: 400 });
  }

  try {
    const parsedSlotMinutes =
      slotMinutes === undefined || slotMinutes === null ? null : Number(slotMinutes);

    const result = await pool.query(
      `INSERT INTO clinics (name, domain, logo, phone, email, address, is_disabled, opens_at, closes_at, slot_minutes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id, name, domain, logo, phone, email, address, theme_confirm_bg, theme_confirm_border, is_disabled, opens_at, closes_at, slot_minutes, created_at`,
      [
        name,
        domain,
        logo || null,
        phone || null,
        email || null,
        address || null,
        typeof isDisabled === 'boolean' ? isDisabled : false,
        opensAt || null,
        closesAt || null,
        Number.isFinite(parsedSlotMinutes) ? parsedSlotMinutes : null,
      ]
    );

    return NextResponse.json({ clinic: result.rows[0] }, { status: 201 });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Clinic create failed:', err);
    return NextResponse.json({ error: 'Unable to create clinic.' }, { status: 500 });
  }
}
