const express = require('express');

const pool = require('../db');

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const result = await pool.query(
      'SELECT id, name, domain, logo, phone, email, address, is_disabled, opens_at, closes_at, slot_minutes, created_at FROM clinics ORDER BY name'
    );
    return res.json({ clinics: result.rows });
  } catch (error) {
    return next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const result = await pool.query(
      'SELECT id, name, domain, logo, phone, email, address, is_disabled, opens_at, closes_at, slot_minutes, created_at FROM clinics WHERE id = $1',
      [req.params.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Clinic not found.' });
    }

    return res.json({ clinic: result.rows[0] });
  } catch (error) {
    return next(error);
  }
});

router.post('/', async (req, res, next) => {
  const {
    name,
    domain,
    logo,
    phone,
    email,
    address,
    is_disabled: isDisabled,
    opens_at: opensAt,
    closes_at: closesAt,
    slot_minutes: slotMinutes,
  } = req.body;

  if (!name || !domain) {
    return res.status(400).json({
      error: 'name and domain are required.',
    });
  }

  try {
    const parsedSlotMinutes =
      slotMinutes === undefined || slotMinutes === null ? null : Number(slotMinutes);

    const result = await pool.query(
      `INSERT INTO clinics (name, domain, logo, phone, email, address, is_disabled, opens_at, closes_at, slot_minutes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id, name, domain, logo, phone, email, address, is_disabled, opens_at, closes_at, slot_minutes, created_at`,
      [
        name,
        domain,
        logo || null,
        phone || null,
        email || null,
        address || null,
        typeof isDisabled === 'boolean' ? isDisabled : false,
        opensAt || null,
        closesAt || null,
        Number.isFinite(parsedSlotMinutes) ? parsedSlotMinutes : null,
      ]
    );

    return res.status(201).json({ clinic: result.rows[0] });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
