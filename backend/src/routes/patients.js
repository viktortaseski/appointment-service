const express = require('express');

const authMiddleware = require('../auth-middleware');
const pool = require('../db');

const router = express.Router();

router.get('/', authMiddleware, async (req, res, next) => {
  if (!req.auth || req.auth.clinicId !== req.clinic.id) {
    return res.status(403).json({ error: 'Not authorized for this clinic.' });
  }

  const search = (req.query.search || '').trim();
  const values = [req.clinic.id];
  let searchClause = '';

  if (search) {
    values.push(`%${search}%`);
    searchClause = ' AND (p.name ILIKE $2 OR p.email ILIKE $2 OR p.phone ILIKE $2)';
  }

  const query = `
    SELECT DISTINCT p.id, p.name, p.email, p.phone, p.created_at, p.updated_at
    FROM patients p
    JOIN appointments a
      ON a.clinic_id = $1
      AND (
        (p.email IS NOT NULL AND p.email <> '' AND p.email = a.patient_email)
        OR (p.phone IS NOT NULL AND p.phone <> '' AND p.phone = a.patient_phone)
      )
    WHERE 1=1${searchClause}
    ORDER BY p.name ASC
  `;

  try {
    const result = await pool.query(query, values);
    return res.json({ patients: result.rows });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
