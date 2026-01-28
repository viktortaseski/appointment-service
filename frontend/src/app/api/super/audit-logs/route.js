import { NextResponse } from 'next/server';

import { pool } from '@/lib/server/db';
import { verifySuperAdminRequest } from '@/lib/server/super-admin-auth';

export const runtime = 'nodejs';

function parseDateParam(value) {
  if (!value) {
    return null;
  }

  const trimmed = String(value).trim();
  if (!trimmed) {
    return null;
  }

  const isoCandidate = trimmed.includes('T') ? trimmed : `${trimmed}T00:00:00Z`;
  const date = new Date(isoCandidate);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

export async function GET(request) {
  const auth = verifySuperAdminRequest(request);
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { searchParams } = new URL(request.url);
  const clinicId = searchParams.get('clinic_id');
  const clinicDomain = searchParams.get('clinic_domain');
  const doctorId = searchParams.get('doctor_id');
  const actionQuery = searchParams.get('action');
  const fromParam = searchParams.get('from');
  const toParam = searchParams.get('to');
  const limitParam = searchParams.get('limit');
  const offsetParam = searchParams.get('offset');

  const limitRaw = Number.parseInt(limitParam || '100', 10);
  const offsetRaw = Number.parseInt(offsetParam || '0', 10);
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 500) : 100;
  const offset = Number.isFinite(offsetRaw) && offsetRaw > 0 ? offsetRaw : 0;

  const conditions = [];
  const values = [];

  if (clinicId) {
    values.push(clinicId);
    conditions.push(`audit_logs.clinic_id = $${values.length}`);
  }

  if (clinicDomain) {
    values.push(clinicDomain);
    conditions.push(`clinics.domain = $${values.length}`);
  }

  if (doctorId) {
    values.push(doctorId);
    conditions.push(`audit_logs.doctor_id = $${values.length}`);
  }

  if (actionQuery) {
    values.push(`%${actionQuery}%`);
    conditions.push(`audit_logs.action ILIKE $${values.length}`);
  }

  const fromDate = parseDateParam(fromParam);
  if (fromDate) {
    values.push(fromDate.toISOString());
    conditions.push(`audit_logs.created_at >= $${values.length}`);
  }

  const toDate = parseDateParam(toParam);
  if (toDate) {
    const end = new Date(toDate.getTime());
    end.setUTCDate(end.getUTCDate() + 1);
    values.push(end.toISOString());
    conditions.push(`audit_logs.created_at < $${values.length}`);
  }

  const fromClause = `
    FROM audit_logs
    LEFT JOIN clinics ON audit_logs.clinic_id = clinics.id
    LEFT JOIN doctors ON audit_logs.doctor_id = doctors.id
  `;
  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  try {
    const countResult = await pool.query(
      `SELECT COUNT(*) ${fromClause} ${whereClause}`,
      values
    );
    const total = Number(countResult.rows?.[0]?.count || 0);

    const queryValues = [...values, limit, offset];
    const logsResult = await pool.query(
      `
      SELECT
        audit_logs.id,
        audit_logs.clinic_id,
        audit_logs.doctor_id,
        audit_logs.action,
        audit_logs.metadata,
        audit_logs.created_at,
        clinics.name AS clinic_name,
        clinics.domain AS clinic_domain,
        doctors.name AS doctor_name,
        doctors.username AS doctor_username
      ${fromClause}
      ${whereClause}
      ORDER BY audit_logs.created_at DESC
      LIMIT $${values.length + 1}
      OFFSET $${values.length + 2}
      `,
      queryValues
    );

    return NextResponse.json({
      logs: logsResult.rows || [],
      meta: {
        total,
        limit,
        offset,
      },
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Super admin audit log fetch failed:', err);
    return NextResponse.json({ error: 'Unable to load audit logs.' }, { status: 500 });
  }
}
