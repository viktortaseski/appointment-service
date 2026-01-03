import jwt from 'jsonwebtoken';

import { debugLog } from './debug';
import { pool } from './db';
import { getHeader } from './headers';

export async function requireAuth(request, clinic) {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    debugLog('auth: missing JWT_SECRET');
    return { error: 'JWT_SECRET not configured.', status: 500 };
  }

  const authHeader = getHeader(request, 'authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    debugLog('auth: missing bearer token');
    return { error: 'Missing auth token.', status: 401 };
  }

  try {
    const payload = jwt.verify(token, secret);

    if (clinic && payload.clinicId !== clinic.id) {
      debugLog('auth: clinic mismatch', {
        tokenClinicId: payload.clinicId,
        clinicId: clinic.id,
      });
      return { error: 'Token not valid for this clinic.', status: 403 };
    }

    const result = await pool.query(
      'SELECT id, clinic_id, is_disabled FROM doctors WHERE id = $1 AND clinic_id = $2',
      [payload.doctorId, payload.clinicId]
    );

    if (result.rowCount === 0) {
      debugLog('auth: doctor not found', {
        doctorId: payload.doctorId,
        clinicId: payload.clinicId,
      });
      return { error: 'Invalid auth token.', status: 401 };
    }

    if (result.rows[0].is_disabled) {
      debugLog('auth: doctor disabled', {
        doctorId: payload.doctorId,
        clinicId: payload.clinicId,
      });
      return { error: 'Doctor account disabled.', status: 403 };
    }

    return { auth: payload };
  } catch (error) {
    debugLog('auth: token verify failed', {
      message: error?.message || error,
    });
    return { error: 'Invalid auth token.', status: 401 };
  }
}
