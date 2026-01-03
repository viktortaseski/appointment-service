import jwt from 'jsonwebtoken';

import { debugLog } from './debug';

function getCancelSecret() {
  return process.env.APPOINTMENT_CANCEL_SECRET || process.env.JWT_SECRET;
}

export function createCancelToken({ appointmentId, clinicId, patientEmail }) {
  const secret = getCancelSecret();
  if (!secret) {
    debugLog('cancel-token: missing secret');
    return null;
  }

  return jwt.sign(
    { appointmentId, clinicId, patientEmail: patientEmail || null },
    secret
  );
}

export function verifyCancelToken(token) {
  const secret = getCancelSecret();
  if (!secret) {
    return { error: 'Cancellation is not configured.' };
  }

  try {
    const payload = jwt.verify(token, secret);
    return { payload };
  } catch (error) {
    return { error: 'Invalid or expired cancellation token.' };
  }
}
