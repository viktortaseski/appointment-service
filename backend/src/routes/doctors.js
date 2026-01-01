const express = require('express');

const authMiddleware = require('../auth-middleware');
const pool = require('../db');

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT id, clinic_id, name, username, specialty, description, avatar, is_disabled, created_at, updated_at
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
      `SELECT id, clinic_id, name, username, specialty, description, avatar, is_disabled, created_at, updated_at
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
  const { name, specialty, avatar, description, username } = req.body;

  if (!name || !specialty) {
    return res.status(400).json({
      error: 'name and specialty are required.',
    });
  }

  try {
    const result = await pool.query(
      `INSERT INTO doctors (clinic_id, name, username, specialty, description, avatar)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, clinic_id, name, username, specialty, description, avatar, is_disabled, created_at, updated_at`,
      [
        req.clinic.id,
        name,
        username || null,
        specialty,
        description || null,
        avatar || null,
      ]
    );

    return res.status(201).json({ doctor: result.rows[0] });
  } catch (error) {
    return next(error);
  }
});

router.patch('/:id', authMiddleware, async (req, res, next) => {
  if (!req.auth || req.auth.clinicId !== req.clinic.id) {
    return res.status(403).json({ error: 'Not authorized for this clinic.' });
  }

  const {
    name,
    username,
    specialty,
    description,
    password,
    is_disabled: isDisabled,
  } = req.body;

  const updates = [];
  const values = [];

  if (name !== undefined) {
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'name is required.' });
    }
    values.push(name.trim());
    updates.push(`name = $${values.length}`);
  }

  if (username !== undefined) {
    values.push(username ? username.trim() : null);
    updates.push(`username = $${values.length}`);
  }

  if (specialty !== undefined) {
    if (!specialty || !specialty.trim()) {
      return res.status(400).json({ error: 'specialty is required.' });
    }
    values.push(specialty.trim());
    updates.push(`specialty = $${values.length}`);
  }

  if (description !== undefined) {
    values.push(description ? description.trim() : null);
    updates.push(`description = $${values.length}`);
  }

  if (password !== undefined) {
    values.push(password ? password.trim() : null);
    updates.push(`password = $${values.length}`);
  }

  if (typeof isDisabled === 'boolean') {
    values.push(isDisabled);
    updates.push(`is_disabled = $${values.length}`);
  }

  if (updates.length === 0) {
    return res.status(400).json({ error: 'No doctor updates provided.' });
  }

  values.push(req.clinic.id);
  values.push(req.params.id);

  try {
    const result = await pool.query(
      `UPDATE doctors
       SET ${updates.join(', ')}
       WHERE clinic_id = $${values.length - 1} AND id = $${values.length}
       RETURNING id, clinic_id, name, username, specialty, description, avatar, is_disabled, created_at, updated_at`,
      values
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Doctor not found.' });
    }

    return res.json({ doctor: result.rows[0] });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
