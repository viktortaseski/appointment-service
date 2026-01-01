const jwt = require('jsonwebtoken');

const pool = require('./db');

module.exports = function authMiddleware(req, res, next) {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    return res.status(500).json({ error: 'JWT_SECRET not configured.' });
  }

  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Missing auth token.' });
  }

  try {
    const payload = jwt.verify(token, secret);

    if (req.clinic && payload.clinicId !== req.clinic.id) {
      return res.status(403).json({ error: 'Token not valid for this clinic.' });
    }

    return pool
      .query(
        'SELECT id, clinic_id, is_disabled FROM doctors WHERE id = $1 AND clinic_id = $2',
        [payload.doctorId, payload.clinicId]
      )
      .then((result) => {
        if (result.rowCount === 0) {
          return res.status(401).json({ error: 'Invalid auth token.' });
        }

        if (result.rows[0].is_disabled) {
          return res.status(403).json({ error: 'Doctor account disabled.' });
        }

        req.auth = payload;
        return next();
      })
      .catch((error) => {
        // eslint-disable-next-line no-console
        console.error(error);
        return res.status(500).json({ error: 'Auth validation failed.' });
      });
  } catch (error) {
    return res.status(401).json({ error: 'Invalid auth token.' });
  }
};
