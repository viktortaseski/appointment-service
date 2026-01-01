const express = require('express');

const pool = require('../db');
const { logAudit } = require('../utils/audit');

const router = express.Router();

router.patch('/', async (req, res, next) => {
  const {
    is_disabled: isDisabled,
    opens_at: opensAt,
    closes_at: closesAt,
    slot_minutes: slotMinutes,
  } = req.body;

  const updates = [];
  const values = [];

  if (typeof isDisabled === 'boolean') {
    values.push(isDisabled);
    updates.push(`is_disabled = $${values.length}`);
  }

  if (opensAt) {
    values.push(opensAt);
    updates.push(`opens_at = $${values.length}`);
  }

  if (closesAt) {
    values.push(closesAt);
    updates.push(`closes_at = $${values.length}`);
  }

  if (slotMinutes !== undefined) {
    const parsedSlot = Number(slotMinutes);
    if (!Number.isInteger(parsedSlot) || parsedSlot <= 0) {
      return res.status(400).json({ error: 'slot_minutes must be a positive integer.' });
    }
    values.push(parsedSlot);
    updates.push(`slot_minutes = $${values.length}`);
  }

  if (updates.length === 0) {
    return res.status(400).json({ error: 'No clinic settings provided.' });
  }

  values.push(req.clinic.id);

  try {
    const result = await pool.query(
      `UPDATE clinics
       SET ${updates.join(', ')}
       WHERE id = $${values.length}
       RETURNING id, name, domain, logo, phone, email, address, is_disabled, opens_at, closes_at, slot_minutes`,
      values
    );

    await logAudit({
      clinicId: req.clinic.id,
      doctorId: req.auth?.doctorId,
      action: 'clinic_settings_updated',
      metadata: {
        updates: Object.keys(req.body || {}),
      },
    });

    return res.json({ clinic: result.rows[0] });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
