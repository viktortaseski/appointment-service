const express = require('express');

const authMiddleware = require('../auth-middleware');
const pool = require('../db');
const { computeBlockedTimes, normalizeDateKey } = require('../utils/availability');

const router = express.Router();

router.get('/', async (req, res, next) => {
  const { doctorId, date } = req.query;
  const dateKey = normalizeDateKey(date);

  if (!doctorId || !dateKey) {
    return res.status(400).json({ error: 'doctorId and date are required.' });
  }

  try {
    const result = await pool.query(
      `SELECT start_date, end_date, start_time, end_time
       FROM doctor_unavailability
       WHERE clinic_id = $1 AND doctor_id = $2`,
      [req.clinic.id, doctorId]
    );

    const unavailableTimes = computeBlockedTimes(dateKey, result.rows);

    return res.json({
      clinic: req.clinic,
      unavailableTimes,
    });
  } catch (error) {
    return next(error);
  }
});

router.use(authMiddleware);

router.get('/records', async (req, res, next) => {
  const { doctorId } = req.query;
  const values = [req.clinic.id];
  const conditions = ['u.clinic_id = $1'];

  if (doctorId) {
    values.push(doctorId);
    conditions.push(`u.doctor_id = $${values.length}`);
  }

  try {
    const result = await pool.query(
      `SELECT u.id, u.doctor_id, u.start_date, u.end_date, u.start_time, u.end_time,
              d.name AS doctor_name
       FROM doctor_unavailability u
       JOIN doctors d ON d.id = u.doctor_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY u.start_date ASC, u.start_time NULLS FIRST`,
      values
    );

    return res.json({ records: result.rows });
  } catch (error) {
    return next(error);
  }
});

router.post('/records', async (req, res, next) => {
  const {
    doctor_id: doctorId,
    start_date: startDate,
    end_date: endDate,
    start_time: startTime,
    end_time: endTime,
  } = req.body;

  if (!doctorId || !startDate || !endDate) {
    return res.status(400).json({
      error: 'doctor_id, start_date, and end_date are required.',
    });
  }

  if (startDate > endDate) {
    return res.status(400).json({
      error: 'start_date must be before end_date.',
    });
  }

  if ((startTime && !endTime) || (!startTime && endTime)) {
    return res.status(400).json({
      error: 'start_time and end_time must both be provided.',
    });
  }

  if (startTime && startDate !== endDate) {
    return res.status(400).json({
      error: 'Time ranges must use the same start and end date.',
    });
  }

  if (startTime && endTime && startTime >= endTime) {
    return res.status(400).json({
      error: 'start_time must be before end_time.',
    });
  }

  try {
    const doctorCheck = await pool.query(
      'SELECT id FROM doctors WHERE id = $1 AND clinic_id = $2',
      [doctorId, req.clinic.id]
    );

    if (doctorCheck.rowCount === 0) {
      return res.status(400).json({
        error: 'Doctor does not belong to this clinic.',
      });
    }

    const result = await pool.query(
      `INSERT INTO doctor_unavailability
         (clinic_id, doctor_id, start_date, end_date, start_time, end_time)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, doctor_id, start_date, end_date, start_time, end_time`,
      [
        req.clinic.id,
        doctorId,
        startDate,
        endDate,
        startTime || null,
        endTime || null,
      ]
    );

    return res.status(201).json({ record: result.rows[0] });
  } catch (error) {
    return next(error);
  }
});

router.delete('/records/:id', async (req, res, next) => {
  try {
    const result = await pool.query(
      'DELETE FROM doctor_unavailability WHERE id = $1 AND clinic_id = $2 RETURNING id',
      [req.params.id, req.clinic.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Record not found.' });
    }

    return res.json({ id: result.rows[0].id });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
