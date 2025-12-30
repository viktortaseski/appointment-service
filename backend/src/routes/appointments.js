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

function maskEmail(value) {
  if (!value || !value.includes('@')) {
    return value || '';
  }

  const [name, domain] = value.split('@');
  const maskedName = name.length > 2 ? `${name[0]}***${name[name.length - 1]}` : name[0];
  return `${maskedName}@${domain}`;
}

function getEmailTransporter() {
  if (cachedTransporter) {
    return cachedTransporter;
  }

  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const secure = process.env.SMTP_SECURE === 'true';
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

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

  cachedTransporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: user ? { user, pass } : undefined,
  });

  return cachedTransporter;
}

async function sendAppointmentEmail({ to, clinicName, date, time }) {
  const smtpUser = process.env.SMTP_USER;
  const displayName = clinicName || 'Dental Clinic';
  const from =
    process.env.SMTP_FROM || (smtpUser ? `${displayName} <${smtpUser}>` : null);
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

  const safeClinicName = clinicName || 'the clinic';
  const subject = `Appointment confirmed at ${safeClinicName}`;
  const text = `You have an appointment at ${safeClinicName} on ${date} at ${time}.`;

  try {
    // eslint-disable-next-line no-console
    console.log('Email send attempt:', {
      to: maskEmail(to),
      from,
      subject,
    });
    await transporter.sendMail({
      from,
      to,
      subject,
      text,
    });

    // eslint-disable-next-line no-console
    console.log('Email send success:', { to: maskEmail(to) });
    return { sent: true };
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Email send failed:', error?.message || error);
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
      sendAppointmentEmail({
        to: patientEmail,
        clinicName: req.clinic.name,
        date,
        time,
      }).catch(() => {});
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
