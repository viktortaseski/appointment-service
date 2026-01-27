import { NextResponse } from 'next/server';

import { pool } from '@/lib/server/db';
import { verifySuperAdminRequest } from '@/lib/server/super-admin-auth';

export const runtime = 'nodejs';

export async function POST(request) {
  const auth = verifySuperAdminRequest(request);
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

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
    default_language: defaultLanguage,
  } = body || {};

  if (!name || !domain) {
    return NextResponse.json({ error: 'name and domain are required.' }, { status: 400 });
  }

  try {
    const parsedSlotMinutes =
      slotMinutes === undefined || slotMinutes === null ? null : Number(slotMinutes);

    const result = await pool.query(
      `INSERT INTO clinics (
         name, domain, logo, phone, email, address, theme_primary, theme_secondary,
         is_disabled, opens_at, closes_at, slot_minutes, default_language
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       ON CONFLICT (domain) DO UPDATE SET
         name = EXCLUDED.name,
         logo = COALESCE(EXCLUDED.logo, clinics.logo),
         phone = COALESCE(EXCLUDED.phone, clinics.phone),
         email = COALESCE(EXCLUDED.email, clinics.email),
         address = COALESCE(EXCLUDED.address, clinics.address),
         theme_primary = COALESCE(EXCLUDED.theme_primary, clinics.theme_primary),
         theme_secondary = COALESCE(EXCLUDED.theme_secondary, clinics.theme_secondary),
         is_disabled = EXCLUDED.is_disabled,
         opens_at = COALESCE(EXCLUDED.opens_at, clinics.opens_at),
         closes_at = COALESCE(EXCLUDED.closes_at, clinics.closes_at),
         slot_minutes = COALESCE(EXCLUDED.slot_minutes, clinics.slot_minutes),
         default_language = COALESCE(EXCLUDED.default_language, clinics.default_language)
       RETURNING id, name, domain, logo, phone, email, address, theme_primary, theme_secondary, is_disabled, opens_at, closes_at, slot_minutes, default_language, created_at`,
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
        defaultLanguage || null,
      ]
    );

    return NextResponse.json({ clinic: result.rows[0] }, { status: 201 });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Super admin clinic upsert failed:', err);
    return NextResponse.json({ error: 'Unable to save clinic.' }, { status: 500 });
  }
}
