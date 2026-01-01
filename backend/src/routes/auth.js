const bcrypt = require('bcryptjs');
const express = require('express');
const jwt = require('jsonwebtoken');

const pool = require('../db');
const rateLimit = require('../middleware/rate-limit');
const { logAudit } = require('../utils/audit');

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyPrefix: 'login',
});

router.post('/login', loginLimiter, async (req, res, next) => {
  const { clinicName, username, password } = req.body;
  const secret = process.env.JWT_SECRET;

  if (!clinicName || !username || !password) {
    return res
      .status(400)
      .json({ error: 'clinicName, username, and password are required.' });
  }

  if (!secret) {
    return res.status(500).json({ error: 'JWT_SECRET not configured.' });
  }

  try {
    const normalizedClinicName = clinicName.trim().toLowerCase();
    const resolvedClinicName = req.clinic?.name?.trim().toLowerCase();

    if (!resolvedClinicName || normalizedClinicName !== resolvedClinicName) {
      await logAudit({
        clinicId: req.clinic?.id,
        action: 'login_failed',
        metadata: {
          reason: 'clinic_name_mismatch',
          username,
          ip: req.ip,
          userAgent: req.headers['user-agent'],
        },
      });
      return res.status(401).json({ error: 'Clinic name does not match this domain.' });
    }

    const result = await pool.query(
      'SELECT id, clinic_id, name, username, password_hash, is_disabled FROM doctors WHERE clinic_id = $1 AND username = $2 LIMIT 1',
      [req.clinic.id, username]
    );

    if (result.rowCount === 0) {
      await logAudit({
        clinicId: req.clinic?.id,
        action: 'login_failed',
        metadata: {
          reason: 'doctor_not_found',
          username,
          ip: req.ip,
          userAgent: req.headers['user-agent'],
        },
      });
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    const doctor = result.rows[0];

    if (doctor.is_disabled) {
      await logAudit({
        clinicId: req.clinic?.id,
        doctorId: doctor.id,
        action: 'login_failed',
        metadata: {
          reason: 'doctor_disabled',
          username,
          ip: req.ip,
          userAgent: req.headers['user-agent'],
        },
      });
      return res.status(403).json({ error: 'Doctor account disabled.' });
    }

    if (!doctor.password_hash) {
      await logAudit({
        clinicId: req.clinic?.id,
        doctorId: doctor.id,
        action: 'login_failed',
        metadata: {
          reason: 'password_not_set',
          username,
          ip: req.ip,
          userAgent: req.headers['user-agent'],
        },
      });
      return res.status(401).json({ error: 'Password not set for this doctor.' });
    }

    const isMatch = await bcrypt.compare(password, doctor.password_hash);
    if (!isMatch) {
      await logAudit({
        clinicId: req.clinic?.id,
        doctorId: doctor.id,
        action: 'login_failed',
        metadata: {
          reason: 'invalid_password',
          username,
          ip: req.ip,
          userAgent: req.headers['user-agent'],
        },
      });
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    const token = jwt.sign(
      {
        doctorId: doctor.id,
        clinicId: doctor.clinic_id,
        name: doctor.name,
        username: doctor.username,
      },
      secret,
      { expiresIn: '8h' }
    );

    await logAudit({
      clinicId: req.clinic?.id,
      doctorId: doctor.id,
      action: 'login_success',
      metadata: {
        username,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      },
    });

    return res.json({
      token,
      doctor: {
        id: doctor.id,
        name: doctor.name,
        clinic_id: doctor.clinic_id,
      },
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
