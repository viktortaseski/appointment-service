import { NextResponse } from 'next/server';

import cloudinary from '@/lib/server/cloudinary';
import { resolveClinic } from '@/lib/server/clinic-resolver';
import { pool } from '@/lib/server/db';
import { requireAuth } from '@/lib/server/auth';
import { logAudit } from '@/lib/server/audit';

export const runtime = 'nodejs';

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

export async function POST(request) {
  const { clinic, error } = await resolveClinic(request.headers);
  if (error) {
    return NextResponse.json({ error }, { status: 404 });
  }

  if (!cloudinary.config().cloud_name) {
    return NextResponse.json({ error: 'Cloudinary not configured.' }, { status: 500 });
  }

  const authResult = await requireAuth(request, clinic);
  if (authResult.error) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  if (!authResult.auth || authResult.auth.clinicId !== clinic.id) {
    return NextResponse.json({ error: 'Not authorized for this clinic.' }, { status: 403 });
  }

  const formData = await request.formData();
  const doctorId = formData.get('doctorId');
  const file = formData.get('image');

  if (!doctorId || typeof doctorId !== 'string') {
    return NextResponse.json({ error: 'doctorId is required.' }, { status: 400 });
  }

  if (!file || typeof file.arrayBuffer !== 'function') {
    return NextResponse.json({ error: 'Image file is required.' }, { status: 400 });
  }

  try {
    const doctorResult = await pool.query(
      'SELECT id FROM doctors WHERE id = $1 AND clinic_id = $2',
      [doctorId, clinic.id]
    );

    if (doctorResult.rowCount === 0) {
      return NextResponse.json({ error: 'Doctor not found.' }, { status: 404 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const uploadResult = await uploadBufferToCloudinary(buffer, {
      folder: `clinics/${clinic.id}/doctors`,
      public_id: doctorId,
      overwrite: true,
      resource_type: 'image',
    });

    const updateResult = await pool.query(
      'UPDATE doctors SET avatar = $1 WHERE id = $2 RETURNING id, avatar',
      [uploadResult.secure_url, doctorId]
    );

    await logAudit({
      clinicId: clinic.id,
      doctorId: authResult.auth?.doctorId,
      action: 'doctor_avatar_uploaded',
      metadata: {
        targetDoctorId: doctorId,
      },
    });

    return NextResponse.json({
      doctor: updateResult.rows[0],
      url: uploadResult.secure_url,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Doctor avatar upload failed:', err);
    return NextResponse.json({ error: 'Unable to upload doctor avatar.' }, { status: 500 });
  }
}
