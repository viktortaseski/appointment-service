const express = require('express');
const multer = require('multer');

const cloudinary = require('../cloudinary');
const pool = require('../db');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

function uploadBufferToCloudinary(buffer, options) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(options, (error, result) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(result);
    });

    stream.end(buffer);
  });
}

router.post('/doctor-avatar', upload.single('image'), async (req, res, next) => {
  const { doctorId } = req.body;

  if (!cloudinary.config().cloud_name) {
    return res.status(500).json({ error: 'Cloudinary not configured.' });
  }

  if (!req.auth || req.auth.clinicId !== req.clinic.id) {
    return res.status(403).json({ error: 'Not authorized for this clinic.' });
  }

  if (!doctorId) {
    return res.status(400).json({ error: 'doctorId is required.' });
  }

  if (!req.file) {
    return res.status(400).json({ error: 'Image file is required.' });
  }

  try {
    const doctorResult = await pool.query(
      'SELECT id FROM doctors WHERE id = $1 AND clinic_id = $2',
      [doctorId, req.clinic.id]
    );

    if (doctorResult.rowCount === 0) {
      return res.status(404).json({ error: 'Doctor not found.' });
    }

    const uploadResult = await uploadBufferToCloudinary(req.file.buffer, {
      folder: `clinics/${req.clinic.id}/doctors`,
      public_id: doctorId,
      overwrite: true,
      resource_type: 'image',
    });

    const updateResult = await pool.query(
      'UPDATE doctors SET avatar = $1 WHERE id = $2 RETURNING id, avatar',
      [uploadResult.secure_url, doctorId]
    );

    return res.json({
      doctor: updateResult.rows[0],
      url: uploadResult.secure_url,
    });
  } catch (error) {
    return next(error);
  }
});

router.post('/clinic-logo', upload.single('image'), async (req, res, next) => {
  if (!cloudinary.config().cloud_name) {
    return res.status(500).json({ error: 'Cloudinary not configured.' });
  }

  if (!req.auth || req.auth.clinicId !== req.clinic.id) {
    return res.status(403).json({ error: 'Not authorized for this clinic.' });
  }

  if (!req.file) {
    return res.status(400).json({ error: 'Image file is required.' });
  }

  try {
    const uploadResult = await uploadBufferToCloudinary(req.file.buffer, {
      folder: `clinics/${req.clinic.id}`,
      public_id: 'logo',
      overwrite: true,
      resource_type: 'image',
    });

    const updateResult = await pool.query(
      'UPDATE clinics SET logo = $1 WHERE id = $2 RETURNING id, name, logo',
      [uploadResult.secure_url, req.clinic.id]
    );

    return res.json({
      clinic: updateResult.rows[0],
      url: uploadResult.secure_url,
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
