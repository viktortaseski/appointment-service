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

export function getReminderToken(request) {
  const authHeader = getHeader(request, 'authorization') || '';
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }

  return getHeader(request, 'x-cron-secret') || null;
}

function getReminderConfig() {
  const offsetMinutes = parseNumber(process.env.APPOINTMENT_REMINDER_OFFSET_MINUTES, 120);
  const intervalMinutes = parseNumber(
    process.env.APPOINTMENT_REMINDER_INTERVAL_MINUTES,
    parseNumber(process.env.APPOINTMENT_REMINDER_WINDOW_MINUTES, 15)
  );
  const timezone = process.env.APPOINTMENT_TIMEZONE || 'Europe/Skopje';
  const templateId = parseNumber(
    process.env.BREVO_APPOINTMENT_REMINDER_TEMPLATE_ID,
    parseNumber(process.env.BREVO_APPOINTMENT_TEMPLATE_ID, 0)
  );

  return {
    offsetMinutes,
    intervalMinutes,
    timezone,
    templateId,
  };
}

export async function runAppointmentReminders(request) {
  const { offsetMinutes, intervalMinutes, timezone, templateId } = getReminderConfig();

  if (!Number.isFinite(intervalMinutes) || intervalMinutes <= 0) {
    throw new Error('Invalid reminder interval.');
  }

  const client = await pool.connect();
  const sentAppointmentIds = [];

  try {
    await client.query('BEGIN');

    const result = await client.query(
      `WITH window AS (
         SELECT
           (date_trunc('hour', local_now)
             + (floor(date_part('minute', local_now) / $3) * $3) * interval '1 minute'
             + ($2 * interval '1 minute')) AT TIME ZONE $1 AS window_start,
           (date_trunc('hour', local_now)
             + (floor(date_part('minute', local_now) / $3) * $3) * interval '1 minute'
             + (($2 + $3) * interval '1 minute')) AT TIME ZONE $1 AS window_end
         FROM (SELECT NOW() AT TIME ZONE $1 AS local_now) AS base
       )
       SELECT a.id,
              a.date,
              a.time,
              a.patient_name,
              a.patient_email,
              a.clinic_id,
              c.name AS clinic_name,
              c.logo AS clinic_logo,
              c.domain AS clinic_domain,
              d.name AS doctor_name
       FROM appointments a
       JOIN clinics c ON c.id = a.clinic_id
       JOIN doctors d ON d.id = a.doctor_id
       CROSS JOIN window w
       WHERE a.completed = false
         AND a.patient_email IS NOT NULL
         AND a.patient_email <> ''
         AND a.reminder_sent_at IS NULL
         AND (a.date + a.time) AT TIME ZONE $1 >= w.window_start
         AND (a.date + a.time) AT TIME ZONE $1 < w.window_end
       ORDER BY a.date, a.time
       FOR UPDATE OF a SKIP LOCKED`,
      [timezone, offsetMinutes, intervalMinutes]
    );

    for (const row of result.rows) {
      const appointmentDate = normalizeDateKey(row.date);
      const appointmentTime = normalizeTime(row.time);
      const cancelToken = createCancelToken({
        appointmentId: row.id,
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
            clinic_logo: row.clinic_logo || '',
            doctor_name: row.doctor_name || '',
            date: appointmentDate,
            time: appointmentTime,
            cancel_token: cancelToken || '',
            cancel_url: cancelUrl,
            reschedule_url: rescheduleUrl,
          },
        });

        await client.query(
          'UPDATE appointments SET reminder_sent_at = NOW() WHERE id = $1 AND reminder_sent_at IS NULL',
          [row.id]
        );

        sentAppointmentIds.push(row.id);
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
