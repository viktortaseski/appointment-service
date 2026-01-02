import jwt from 'jsonwebtoken';

import { pool } from './db';

export async function requireAuth(request, clinic) {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    return { error: 'JWT_SECRET not configured.', status: 500 };
  }

  const authHeader = request.headers.get('authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return { error: 'Missing auth token.', status: 401 };
  }

  try {
    const payload = jwt.verify(token, secret);

    if (clinic && payload.clinicId !== clinic.id) {
      return { error: 'Token not valid for this clinic.', status: 403 };
    }

    const result = await pool.query(
      'SELECT id, clinic_id, is_disabled FROM doctors WHERE id = $1 AND clinic_id = $2',
      [payload.doctorId, payload.clinicId]
    );

    if (result.rowCount === 0) {
      return { error: 'Invalid auth token.', status: 401 };
    }

    if (result.rows[0].is_disabled) {
      return { error: 'Doctor account disabled.', status: 403 };
    }

    return { auth: payload };
  } catch (error) {
    return { error: 'Invalid auth token.', status: 401 };
  }
}
