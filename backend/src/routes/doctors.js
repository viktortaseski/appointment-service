const express = require('express');

const pool = require('../db');

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT id, clinic_id, name, specialty, description, avatar, created_at, updated_at
       FROM doctors
       WHERE clinic_id = $1
       ORDER BY name`,
      [req.clinic.id]
    );

    return res.json({
      clinic: req.clinic,
      doctors: result.rows,
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT id, clinic_id, name, specialty, description, avatar, created_at, updated_at
       FROM doctors
       WHERE clinic_id = $1 AND id = $2`,
      [req.clinic.id, req.params.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Doctor not found.' });
    }

    return res.json({ doctor: result.rows[0] });
  } catch (error) {
    return next(error);
  }
});

router.post('/', async (req, res, next) => {
  const { name, specialty, avatar, description } = req.body;

  if (!name || !specialty) {
    return res.status(400).json({
      error: 'name and specialty are required.',
    });
  }

  try {
    const result = await pool.query(
      `INSERT INTO doctors (clinic_id, name, specialty, description, avatar)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, clinic_id, name, specialty, description, avatar, created_at, updated_at`,
      [req.clinic.id, name, specialty, description || null, avatar || null]
    );

    return res.status(201).json({ doctor: result.rows[0] });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
