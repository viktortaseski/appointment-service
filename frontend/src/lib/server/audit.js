import { pool } from './db';

export async function logAudit({ clinicId, doctorId, action, metadata }) {
  if (!clinicId || !action) {
    return;
  }

  try {
    await pool.query(
      `INSERT INTO audit_logs (clinic_id, doctor_id, action, metadata)
       VALUES ($1, $2, $3, $4)`,
      [clinicId, doctorId || null, action, metadata || {}]
    );
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Audit log failed:', error);
  }
}
