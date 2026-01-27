import { NextResponse } from 'next/server';

import { pool } from '@/lib/server/db';

export const runtime = 'nodejs';

export async function GET() {
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
       ORDER BY c.name`
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
    theme_primary: themePrimary,
    theme_secondary: themeSecondary,
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
      `INSERT INTO clinics (name, domain, logo, phone, email, address, theme_primary, theme_secondary, is_disabled, opens_at, closes_at, slot_minutes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING id, name, domain, logo, phone, email, address, theme_primary, theme_secondary, is_disabled, opens_at, closes_at, slot_minutes, created_at`,
      [
        name,
        domain,
        logo || null,
        phone || null,
        email || null,
        address || null,
        themePrimary || null,
        themeSecondary || null,
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
