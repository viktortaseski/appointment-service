import { normalizeDateKey, normalizeTime } from '@/lib/server/availability';
import { createCancelToken } from '@/lib/server/appointment-cancel';
import { sendBrevoEmail } from '@/lib/server/brevo-mail';
import { pool } from '@/lib/server/db';
import { getHeader } from '@/lib/server/headers';

function getBaseUrl(headers) {
  const forwardedProto = getHeader(headers, 'x-forwarded-proto');
  const forwardedHost = getHeader(headers, 'x-forwarded-host');
  const host = forwardedHost || getHeader(headers, 'host');

  if (!host) {
    return process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || '';
  }

  const proto = forwardedProto ? forwardedProto.split(',')[0].trim() : 'https';
  return `${proto}://${host.split(',')[0].trim()}`;
}

function getFirstName(value) {
  if (!value) {
    return '';
  }

  return value.trim().split(/\s+/)[0] || '';
}

function parseNumber(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

const DEFAULT_LOGO_URL =
  'https://res.cloudinary.com/dfuieb3iz/image/upload/v1769096434/logo_y76eph.png';

function normalizeLogo(value) {
  if (!value) {
    return '';
  }

  const trimmed = String(value).trim();
  if (!trimmed || trimmed.toLowerCase() === 'null') {
    return '';
  }

  return trimmed;
}

function buildClinicLogoUrl(clinicLogo, clinicId) {
  const normalizedLogo = normalizeLogo(clinicLogo);
  if (normalizedLogo) {
    return normalizedLogo;
  }

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  if (cloudName && clinicId) {
    return `https://res.cloudinary.com/${cloudName}/image/upload/clinics/${clinicId}/logo`;
  }

  return DEFAULT_LOGO_URL;
}

export function getReminderToken(request) {
  const authHeader = getHeader(request, 'authorization') || '';
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }

  return getHeader(request, 'x-cron-secret') || null;
}

function getReminderConfig() {
  const offsetMinutes = parseNumber(process.env.APPOINTMENT_REMINDER_OFFSET_MINUTES, 125);
  const timezone = process.env.APPOINTMENT_TIMEZONE || 'Europe/Skopje';
  const templateId = parseNumber(
    process.env.BREVO_APPOINTMENT_REMINDER_TEMPLATE_ID,
    parseNumber(process.env.BREVO_APPOINTMENT_TEMPLATE_ID, 0)
  );

  return {
    offsetMinutes,
    timezone,
    templateId,
  };
}

export async function upsertAppointmentReminder({
  appointmentId,
  clinicId,
  date,
  time,
  client = pool,
}) {
  const { offsetMinutes, timezone } = getReminderConfig();

  await client.query(
    `INSERT INTO appointment_reminders (appointment_id, clinic_id, scheduled_at)
     VALUES (
       $1,
       $2,
       ((($3::date + $4::time) AT TIME ZONE $5) - ($6 * interval '1 minute'))
     )
     ON CONFLICT (appointment_id)
     DO UPDATE SET
       scheduled_at = EXCLUDED.scheduled_at,
       sent = FALSE,
       sent_at = NULL,
       updated_at = NOW()`,
    [appointmentId, clinicId, date, time, timezone, offsetMinutes]
  );
}

export async function runAppointmentReminders(request) {
  const { templateId } = getReminderConfig();

  const client = await pool.connect();
  const sentAppointmentIds = [];

  try {
    await client.query('BEGIN');

    await client.query(
      "DELETE FROM appointments WHERE date < (CURRENT_DATE - INTERVAL '1 day')"
    );

    const result = await client.query(
      `SELECT r.id AS reminder_id,
              r.appointment_id,
              a.date,
              a.time,
              a.patient_name,
              a.patient_email,
              a.clinic_id,
              c.name AS clinic_name,
              c.logo AS clinic_logo,
              c.domain AS clinic_domain,
              d.name AS doctor_name
       FROM appointment_reminders r
       JOIN appointments a ON a.id = r.appointment_id
       JOIN clinics c ON c.id = a.clinic_id
       JOIN doctors d ON d.id = a.doctor_id
       WHERE r.sent = false
         AND r.scheduled_at <= NOW()
         AND a.completed = false
         AND a.patient_email IS NOT NULL
         AND a.patient_email <> ''
       ORDER BY r.scheduled_at ASC
       FOR UPDATE OF r SKIP LOCKED`
    );

    for (const row of result.rows) {
      const appointmentDate = normalizeDateKey(row.date);
      const appointmentTime = normalizeTime(row.time);
      const cancelToken = createCancelToken({
        appointmentId: row.appointment_id,
        clinicId: row.clinic_id,
        patientEmail: row.patient_email,
      });
      const baseUrl = row.clinic_domain
        ? `https://${row.clinic_domain}`
        : getBaseUrl(request.headers);
      const cancelUrl = cancelToken
        ? `${baseUrl}/api/appointments/cancel?token=${encodeURIComponent(cancelToken)}`
        : '';
      const rescheduleUrl = cancelToken
        ? `${baseUrl}/api/appointments/reschedule?token=${encodeURIComponent(cancelToken)}`
        : '';
      const clinicLogoUrl = buildClinicLogoUrl(row.clinic_logo, row.clinic_id);

      try {
        await sendBrevoEmail({
          to: row.patient_email,
          subject: `Reminder: appointment at ${row.clinic_name}`,
          text: `Reminder: your appointment at ${row.clinic_name} is on ${appointmentDate} at ${appointmentTime}.`,
          senderName: row.clinic_name,
          templateId: templateId > 0 ? templateId : null,
          params: {
            FIRSTNAME: getFirstName(row.patient_name || ''),
            clinic_name: row.clinic_name,
            clinic_id: row.clinic_id,
            clinic_logo: clinicLogoUrl,
            doctor_name: row.doctor_name || '',
            date: appointmentDate,
            time: appointmentTime,
            cancel_token: cancelToken || '',
            cancel_url: cancelUrl,
            reschedule_url: rescheduleUrl,
          },
        });

        await client.query(
          'DELETE FROM appointment_reminders WHERE id = $1',
          [row.reminder_id]
        );

        await client.query(
          'UPDATE appointments SET reminder_sent_at = NOW() WHERE id = $1 AND reminder_sent_at IS NULL',
          [row.appointment_id]
        );

        sentAppointmentIds.push(row.appointment_id);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Reminder email failed:', {
          appointmentId: row.id,
          message: error?.message || error,
        });
      }
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  return { sent: sentAppointmentIds.length };
}
