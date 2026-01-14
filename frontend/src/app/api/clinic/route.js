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
    theme_confirm_bg: themeConfirmBg,
    theme_confirm_border: themeConfirmBorder,
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

  if (themeConfirmBg !== undefined) {
    if (themeConfirmBg !== null && typeof themeConfirmBg !== 'string') {
      return NextResponse.json(
        { error: 'theme_confirm_bg must be a string or null.' },
        { status: 400 }
      );
    }
    values.push(themeConfirmBg);
    updates.push(`theme_confirm_bg = $${values.length}`);
  }

  if (themeConfirmBorder !== undefined) {
    if (themeConfirmBorder !== null && typeof themeConfirmBorder !== 'string') {
      return NextResponse.json(
        { error: 'theme_confirm_border must be a string or null.' },
        { status: 400 }
      );
    }
    values.push(themeConfirmBorder);
    updates.push(`theme_confirm_border = $${values.length}`);
  }

  if (updates.length === 0) {
    return NextResponse.json({ error: 'No clinic settings provided.' }, { status: 400 });
  }

  values.push(clinic.id);

  const result = await pool.query(
    `UPDATE clinics
     SET ${updates.join(', ')}
     WHERE id = $${values.length}
     RETURNING id, name, domain, logo, phone, email, address, theme_confirm_bg, theme_confirm_border, is_disabled, opens_at, closes_at, slot_minutes, default_language`,
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
