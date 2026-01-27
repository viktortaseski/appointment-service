import { NextResponse } from 'next/server';

import { resolveClinic } from '@/lib/server/clinic-resolver';
import { requireAuth } from '@/lib/server/auth';
import { pool } from '@/lib/server/db';
import { logAudit } from '@/lib/server/audit';

export const runtime = 'nodejs';

export async function PATCH(request) {
  const { clinic, error } = await resolveClinic(request.headers);
  if (error) {
    return NextResponse.json({ error }, { status: 404 });
  }

  const authResult = await requireAuth(request, clinic);
  if (authResult.error) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  const body = await request.json();
  const {
    is_disabled: isDisabled,
    opens_at: opensAt,
    closes_at: closesAt,
    slot_minutes: slotMinutes,
    theme_primary: themePrimary,
    theme_secondary: themeSecondary,
    default_language: defaultLanguage,
  } = body || {};

  const updates = [];
  const values = [];

  if (typeof isDisabled === 'boolean') {
    values.push(isDisabled);
    updates.push(`is_disabled = $${values.length}`);
  }

  if (opensAt) {
    values.push(opensAt);
    updates.push(`opens_at = $${values.length}`);
  }

  if (closesAt) {
    values.push(closesAt);
    updates.push(`closes_at = $${values.length}`);
  }

  if (slotMinutes !== undefined) {
    const parsedSlot = Number(slotMinutes);
    if (!Number.isInteger(parsedSlot) || parsedSlot <= 0) {
      return NextResponse.json(
        { error: 'slot_minutes must be a positive integer.' },
        { status: 400 }
      );
    }
    values.push(parsedSlot);
    updates.push(`slot_minutes = $${values.length}`);
  }

  if (themePrimary !== undefined) {
    if (themePrimary !== null && typeof themePrimary !== 'string') {
      return NextResponse.json(
        { error: 'theme_primary must be a string or null.' },
        { status: 400 }
      );
    }
    values.push(themePrimary);
    updates.push(`theme_primary = $${values.length}`);
  }

  if (themeSecondary !== undefined) {
    if (themeSecondary !== null && typeof themeSecondary !== 'string') {
      return NextResponse.json(
        { error: 'theme_secondary must be a string or null.' },
        { status: 400 }
      );
    }
    values.push(themeSecondary);
    updates.push(`theme_secondary = $${values.length}`);
  }

  if (defaultLanguage !== undefined) {
    if (defaultLanguage !== null && typeof defaultLanguage !== 'string') {
      return NextResponse.json(
        { error: 'default_language must be a string or null.' },
        { status: 400 }
      );
    }
    values.push(defaultLanguage);
    updates.push(`default_language = $${values.length}`);
  }

  if (updates.length === 0) {
    return NextResponse.json({ error: 'No clinic settings provided.' }, { status: 400 });
  }

  values.push(clinic.id);

  const result = await pool.query(
    `UPDATE clinics
     SET ${updates.join(', ')}
     WHERE id = $${values.length}
     RETURNING id, name, domain, logo, phone, email, address, theme_primary, theme_secondary, is_disabled, opens_at, closes_at, slot_minutes, default_language`,
    values
  );

  await logAudit({
    clinicId: clinic.id,
    doctorId: authResult.auth?.doctorId,
    action: 'clinic_settings_updated',
    metadata: {
      updates: Object.keys(body || {}),
    },
  });

  return NextResponse.json({ clinic: result.rows[0] });
}
