const dns = require('dns');
const express = require('express');
const nodemailer = require('nodemailer');

const pool = require('../db');
const {
  buildTimeSlotsFromClinic,
  computeBlockedTimes,
  normalizeTime,
} = require('../utils/availability');

const router = express.Router();

let cachedTransporter;
let smtpVerified = false;
const emailQueue = [];
let emailQueueRunning = false;

function maskEmail(value) {
  if (!value || !value.includes('@')) {
    return value || '';
  }

  const [name, domain] = value.split('@');
  const maskedName = name.length > 2 ? `${name[0]}***${name[name.length - 1]}` : name[0];
  return `${maskedName}@${domain}`;
}

function getSmtpConfig() {
  return {
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.SMTP_FROM,
    debug: process.env.SMTP_DEBUG === 'true',
    verify: process.env.SMTP_VERIFY === 'true',
    connectionTimeout: Number(process.env.SMTP_CONNECTION_TIMEOUT || 0),
    greetingTimeout: Number(process.env.SMTP_GREETING_TIMEOUT || 0),
    socketTimeout: Number(process.env.SMTP_SOCKET_TIMEOUT || 0),
  };
}

function getEmailTransporter() {
  if (cachedTransporter) {
    return cachedTransporter;
  }

  const {
    host,
    port,
    secure,
    user,
    pass,
    debug,
    connectionTimeout,
    greetingTimeout,
    socketTimeout,
  } = getSmtpConfig();

  if (!host) {
    // eslint-disable-next-line no-console
    console.log('SMTP not configured: SMTP_HOST is missing.');
    return null;
  }

  // eslint-disable-next-line no-console
  console.log('SMTP config:', {
    host,
    port,
    secure,
    user: user ? maskEmail(user) : null,
    hasPass: Boolean(pass),
  });

  const transportOptions = {
    host,
    port,
    secure,
    auth: user ? { user, pass } : undefined,
  };

  if (connectionTimeout > 0) {
    transportOptions.connectionTimeout = connectionTimeout;
  }

  if (greetingTimeout > 0) {
    transportOptions.greetingTimeout = greetingTimeout;
  }

  if (socketTimeout > 0) {
    transportOptions.socketTimeout = socketTimeout;
  }

  if (debug) {
    transportOptions.logger = true;
    transportOptions.debug = true;
  }

  cachedTransporter = nodemailer.createTransport(transportOptions);

  return cachedTransporter;
}

async function logSmtpDiagnostics({ host, port, secure, user, from, debug }) {
  if (!debug || !host) {
    return;
  }

  // eslint-disable-next-line no-console
  console.log('SMTP diagnostics:', {
    host,
    port,
    secure,
    from,
    user: user ? maskEmail(user) : null,
    node: process.version,
  });

  try {
    const lookup = await dns.promises.lookup(host);
    // eslint-disable-next-line no-console
    console.log('SMTP DNS lookup:', lookup);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('SMTP DNS lookup failed:', error?.message || error);
  }
}

function enqueueEmailJob(job, context) {
  return new Promise((resolve, reject) => {
    emailQueue.push({ job, resolve, reject, context });
    if (!emailQueueRunning) {
      void runEmailQueue();
    }
  });
}

async function runEmailQueue() {
  emailQueueRunning = true;

  while (emailQueue.length > 0) {
    const { job, resolve, reject, context } = emailQueue.shift();

    try {
      // eslint-disable-next-line no-console
      console.log('[mail] queue: start', context);
      const result = await job();
      // eslint-disable-next-line no-console
      console.log('[mail] queue: done', context);
      resolve(result);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('[mail] queue: error', {
        context,
        message: error?.message || error,
        code: error?.code,
      });
      reject(error);
    }
  }

  emailQueueRunning = false;
}

async function verifyTransporter(transporter, debugEnabled, forceVerify) {
  if (!transporter) {
    return;
  }

  if (!forceVerify && smtpVerified) {
    return;
  }

  if (!debugEnabled && !forceVerify) {
    return;
  }

  try {
    // eslint-disable-next-line no-console
    console.log('[mail] verify: before');
    const verified = await transporter.verify();
    smtpVerified = true;
    // eslint-disable-next-line no-console
    console.log('[mail] verify: after', verified);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[mail] verify: failed', {
      message: error?.message || error,
      code: error?.code,
      command: error?.command,
      response: error?.response,
    });
  }
}

async function sendAppointmentEmail({ to, clinicName, date, time }) {
  const {
    host,
    port,
    secure,
    user: smtpUser,
    from: smtpFrom,
    debug,
    verify,
  } = getSmtpConfig();
  const displayName = clinicName || 'Dental Clinic';
  const from =
    smtpFrom || (smtpUser ? `${displayName} <${smtpUser}>` : null);
  const transporter = getEmailTransporter();

  if (!to || !from || !transporter) {
    // eslint-disable-next-line no-console
    console.log('Email send skipped:', {
      hasTo: Boolean(to),
      hasFrom: Boolean(from),
      hasTransport: Boolean(transporter),
      to: maskEmail(to),
      from,
    });
    return { sent: false, error: 'Email service not configured.' };
  }

  await logSmtpDiagnostics({
    host,
    port,
    secure,
    user: smtpUser,
    from,
    debug,
  });

  await verifyTransporter(transporter, debug, verify);

  const safeClinicName = clinicName || 'the clinic';
  const subject = `Appointment confirmed at ${safeClinicName}`;
  const text = `You have an appointment at ${safeClinicName} on ${date} at ${time}.`;

  try {
    // eslint-disable-next-line no-console
    console.log('[mail] sendMail: before', {
      to: maskEmail(to),
      from,
      subject,
    });
    const info = await transporter.sendMail({
      from,
      to,
      subject,
      text,
    });

    // eslint-disable-next-line no-console
    console.log('[mail] sendMail: after', {
      messageId: info?.messageId,
      response: info?.response,
      accepted: info?.accepted,
      rejected: info?.rejected,
    });

    return { sent: true, info };
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Email send failed:', {
      message: error?.message || error,
      code: error?.code,
      command: error?.command,
      response: error?.response,
      stack: error?.stack,
    });
    return {
      sent: false,
      error: error?.message || 'Unable to send confirmation email.',
    };
  }
}

router.get('/', async (req, res, next) => {
  const { doctorId, date, completed } = req.query;
  const conditions = ['clinic_id = $1'];
  const values = [req.clinic.id];

  if (doctorId) {
    values.push(doctorId);
    conditions.push(`doctor_id = $${values.length}`);
  }

  if (date) {
    values.push(date);
    conditions.push(`date = $${values.length}`);
  }

  if (completed !== undefined) {
    const isCompleted = completed === 'true';
    values.push(isCompleted);
    conditions.push(`completed = $${values.length}`);
  }

  const query = `
    SELECT *
    FROM appointments_with_doctors
    WHERE ${conditions.join(' AND ')}
    ORDER BY date ASC, time ASC
  `;

  try {
    const result = await pool.query(query, values);
    let unavailableTimes = [];

    if (doctorId && date) {
      const unavailableResult = await pool.query(
        `SELECT start_date, end_date, start_time, end_time
         FROM doctor_unavailability
         WHERE clinic_id = $1 AND doctor_id = $2`,
        [req.clinic.id, doctorId]
      );

      const slots = buildTimeSlotsFromClinic(req.clinic);
      unavailableTimes = computeBlockedTimes(date, unavailableResult.rows, slots);
    }

    return res.json({
      clinic: req.clinic,
      appointments: result.rows,
      unavailableTimes,
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const result = await pool.query(
      'SELECT * FROM appointments_with_doctors WHERE clinic_id = $1 AND id = $2',
      [req.clinic.id, req.params.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Appointment not found.' });
    }

    return res.json({ appointment: result.rows[0] });
  } catch (error) {
    return next(error);
  }
});

router.post('/', async (req, res, next) => {
  const {
    doctor_id: doctorId,
    patient_name: patientName,
    patient_email: patientEmail,
    patient_phone: patientPhone,
    date,
    time,
    notes,
  } = req.body;

  if (!doctorId || !patientName || !date || !time) {
    return res.status(400).json({
      error: 'doctor_id, patient_name, date, and time are required.',
    });
  }

  try {
    if (req.clinic.is_disabled) {
      return res.status(403).json({
        error: 'Clinic is not accepting appointments.',
      });
    }

    const doctorCheck = await pool.query(
      'SELECT id FROM doctors WHERE id = $1 AND clinic_id = $2',
      [doctorId, req.clinic.id]
    );

    if (doctorCheck.rowCount === 0) {
      return res.status(400).json({
        error: 'Doctor does not belong to this clinic.',
      });
    }

    const normalizedTime = normalizeTime(time);
    const allowedTimes = buildTimeSlotsFromClinic(req.clinic);

    if (!normalizedTime || !allowedTimes.includes(normalizedTime)) {
      return res.status(400).json({
        error: 'Selected time is outside clinic hours.',
      });
    }

    const availabilityResult = await pool.query(
      `SELECT start_date, end_date, start_time, end_time
       FROM doctor_unavailability
       WHERE clinic_id = $1 AND doctor_id = $2`,
      [req.clinic.id, doctorId]
    );

    const blockedTimes = computeBlockedTimes(date, availabilityResult.rows, allowedTimes);

    if (blockedTimes.includes(normalizedTime)) {
      return res.status(409).json({
        error: 'Selected time is unavailable for this doctor.',
      });
    }

    const insertResult = await pool.query(
      'INSERT INTO appointments (clinic_id, doctor_id, patient_name, patient_email, patient_phone, date, time, notes) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id',
      [
        req.clinic.id,
        doctorId,
        patientName,
        patientEmail || '',
        patientPhone || '',
        date,
        time,
        notes || null,
      ]
    );

    const appointmentResult = await pool.query(
      'SELECT * FROM appointments_with_doctors WHERE id = $1',
      [insertResult.rows[0].id]
    );

    if (patientEmail) {
      await enqueueEmailJob(
        () =>
          sendAppointmentEmail({
            to: patientEmail,
            clinicName: req.clinic.name,
            date,
            time,
          }),
        {
          clinicId: req.clinic.id,
          appointmentId: insertResult.rows[0].id,
          recipient: maskEmail(patientEmail),
        }
      );
    }

    return res.status(201).json({
      appointment: appointmentResult.rows[0],
    });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({
        error: 'Appointment slot already booked.',
      });
    }

    return next(error);
  }
});

router.patch('/:id', async (req, res, next) => {
  const { completed } = req.body;

  if (typeof completed !== 'boolean') {
    return res.status(400).json({ error: 'completed must be a boolean.' });
  }

  try {
    const updateResult = await pool.query(
      'UPDATE appointments SET completed = $1 WHERE id = $2 AND clinic_id = $3 RETURNING id',
      [completed, req.params.id, req.clinic.id]
    );

    if (updateResult.rowCount === 0) {
      return res.status(404).json({ error: 'Appointment not found.' });
    }

    const appointmentResult = await pool.query(
      'SELECT * FROM appointments_with_doctors WHERE id = $1',
      [req.params.id]
    );

    return res.json({ appointment: appointmentResult.rows[0] });
  } catch (error) {
    return next(error);
  }
});

router.put('/:id', async (req, res, next) => {
  const {
    doctor_id: doctorId,
    patient_name: patientName,
    patient_email: patientEmail,
    patient_phone: patientPhone,
    date,
    time,
    notes,
  } = req.body;

  if (!doctorId || !patientName || !date || !time) {
    return res.status(400).json({
      error: 'doctor_id, patient_name, date, and time are required.',
    });
  }

  try {
    if (req.clinic.is_disabled) {
      return res.status(403).json({
        error: 'Clinic is not accepting appointments.',
      });
    }

    const doctorCheck = await pool.query(
      'SELECT id FROM doctors WHERE id = $1 AND clinic_id = $2',
      [doctorId, req.clinic.id]
    );

    if (doctorCheck.rowCount === 0) {
      return res.status(400).json({
        error: 'Doctor does not belong to this clinic.',
      });
    }

    const normalizedTime = normalizeTime(time);
    const allowedTimes = buildTimeSlotsFromClinic(req.clinic);

    if (!normalizedTime || !allowedTimes.includes(normalizedTime)) {
      return res.status(400).json({
        error: 'Selected time is outside clinic hours.',
      });
    }

    const availabilityResult = await pool.query(
      `SELECT start_date, end_date, start_time, end_time
       FROM doctor_unavailability
       WHERE clinic_id = $1 AND doctor_id = $2`,
      [req.clinic.id, doctorId]
    );

    const blockedTimes = computeBlockedTimes(date, availabilityResult.rows, allowedTimes);

    if (blockedTimes.includes(normalizedTime)) {
      return res.status(409).json({
        error: 'Selected time is unavailable for this doctor.',
      });
    }

    const updateResult = await pool.query(
      'UPDATE appointments SET doctor_id = $1, patient_name = $2, patient_email = $3, patient_phone = $4, date = $5, time = $6, notes = $7 WHERE id = $8 AND clinic_id = $9 RETURNING id',
      [
        doctorId,
        patientName,
        patientEmail || '',
        patientPhone || '',
        date,
        time,
        notes || null,
        req.params.id,
        req.clinic.id,
      ]
    );

    if (updateResult.rowCount === 0) {
      return res.status(404).json({ error: 'Appointment not found.' });
    }

    const appointmentResult = await pool.query(
      'SELECT * FROM appointments_with_doctors WHERE id = $1',
      [req.params.id]
    );

    return res.json({ appointment: appointmentResult.rows[0] });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({
        error: 'Appointment slot already booked.',
      });
    }

    return next(error);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const deleteResult = await pool.query(
      'DELETE FROM appointments WHERE id = $1 AND clinic_id = $2',
      [req.params.id, req.clinic.id]
    );

    if (deleteResult.rowCount === 0) {
      return res.status(404).json({ error: 'Appointment not found.' });
    }

    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
