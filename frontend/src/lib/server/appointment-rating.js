import jwt from 'jsonwebtoken';

import { debugLog } from './debug';

function getRatingSecret() {
  return process.env.APPOINTMENT_RATING_SECRET || process.env.JWT_SECRET;
}

export function createRatingToken({ appointmentId, clinicId, patientEmail }) {
  const secret = getRatingSecret();
  if (!secret) {
    debugLog('rating-token: missing secret');
    return null;
  }

  return jwt.sign(
    { appointmentId, clinicId, patientEmail: patientEmail || null },
    secret
  );
}

export function verifyRatingToken(token) {
  const secret = getRatingSecret();
  if (!secret) {
    return { error: 'Ratings are not configured.' };
  }

  try {
    const payload = jwt.verify(token, secret);
    return { payload };
  } catch (error) {
    return { error: 'Invalid or expired rating token.' };
  }
}
