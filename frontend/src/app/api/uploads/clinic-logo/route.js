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
  const file = formData.get('image');

  if (!file || typeof file.arrayBuffer !== 'function') {
    return NextResponse.json({ error: 'Image file is required.' }, { status: 400 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const uploadResult = await uploadBufferToCloudinary(buffer, {
      folder: `clinics/${clinic.id}`,
      public_id: 'logo',
      overwrite: true,
      resource_type: 'image',
    });

    const updateResult = await pool.query(
      'UPDATE clinics SET logo = $1 WHERE id = $2 RETURNING id, name, logo',
      [uploadResult.secure_url, clinic.id]
    );

    await logAudit({
      clinicId: clinic.id,
      doctorId: authResult.auth?.doctorId,
      action: 'clinic_logo_uploaded',
      metadata: {},
    });

    return NextResponse.json({
      clinic: updateResult.rows[0],
      url: uploadResult.secure_url,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Clinic logo upload failed:', err);
    return NextResponse.json({ error: 'Unable to upload clinic logo.' }, { status: 500 });
  }
}
