const express = require('express');

const pool = require('../db');

const router = express.Router();

router.patch('/', async (req, res, next) => {
  const { is_disabled: isDisabled } = req.body;

  if (typeof isDisabled !== 'boolean') {
    return res.status(400).json({ error: 'is_disabled must be a boolean.' });
  }

  try {
    const result = await pool.query(
      `UPDATE clinics
       SET is_disabled = $1
       WHERE id = $2
       RETURNING id, name, domain, logo, phone, email, address, is_disabled`,
      [isDisabled, req.clinic.id]
    );

    return res.json({ clinic: result.rows[0] });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
