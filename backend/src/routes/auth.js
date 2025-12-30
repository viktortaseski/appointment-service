const express = require('express');
const jwt = require('jsonwebtoken');

const pool = require('../db');

const router = express.Router();

router.post('/login', async (req, res, next) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'username and password are required.' });
  }

  try {
    const result = await pool.query(
      'SELECT id, clinic_id, name, password FROM doctors WHERE clinic_id = $1 AND name = $2 LIMIT 1',
      [req.clinic.id, username]
    );

    if (result.rowCount === 0) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    const doctor = result.rows[0];

    if (!doctor.password) {
      return res.status(401).json({ error: 'Password not set for this doctor.' });
    }

    if (doctor.password !== password) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    const token = jwt.sign(
      {
        doctorId: doctor.id,
        clinicId: doctor.clinic_id,
        name: doctor.name,
      },
      process.env.JWT_SECRET || 'dev-secret',
      { expiresIn: '8h' }
    );

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
