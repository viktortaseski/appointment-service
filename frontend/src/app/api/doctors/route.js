import bcrypt from 'bcryptjs';
import { NextResponse } from 'next/server';

import { resolveClinic } from '@/lib/server/clinic-resolver';
import { pool } from '@/lib/server/db';
import { requireAuth } from '@/lib/server/auth';
import { logAudit } from '@/lib/server/audit';
import { normalizeWeeklyScheduleInput } from '@/lib/server/doctor-schedule';

export const runtime = 'nodejs';

export async function GET(request) {
  const { clinic, error } = await resolveClinic(request.headers);
  if (error) {
    return NextResponse.json({ error }, { status: 404 });
  }

  try {
    const result = await pool.query(
      `SELECT id, clinic_id, name, username, specialty, description, avatar, is_disabled, created_at, updated_at
       FROM doctors
       WHERE clinic_id = $1
       ORDER BY name`,
      [clinic.id]
    );

    const scheduleResult = await pool.query(
      `SELECT doctor_id, weekday, opens_at, closes_at, is_off
       FROM doctor_working_hours
       WHERE clinic_id = $1
       ORDER BY weekday`,
      [clinic.id]
    );

    const scheduleMap = scheduleResult.rows.reduce((acc, row) => {
      if (!acc[row.doctor_id]) {
        acc[row.doctor_id] = [];
      }
      acc[row.doctor_id].push(row);
      return acc;
    }, {});

    return NextResponse.json({
      clinic,
      doctors: result.rows.map((doctor) => ({
        ...doctor,
        weekly_schedule: scheduleMap[doctor.id] || [],
      })),
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Doctors fetch failed:', err);
    return NextResponse.json({ error: 'Unable to load doctors.' }, { status: 500 });
  }
}

export async function POST(request) {
  const { clinic, error } = await resolveClinic(request.headers);
  if (error) {
    return NextResponse.json({ error }, { status: 404 });
  }

  const authResult = await requireAuth(request, clinic);
  if (authResult.error) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  if (!authResult.auth || authResult.auth.clinicId !== clinic.id) {
    return NextResponse.json({ error: 'Not authorized for this clinic.' }, { status: 403 });
  }

  const body = await request.json();
  const {
    name,
    specialty,
    avatar,
    description,
    username,
    password,
    weekly_schedule: weeklyScheduleInput,
  } = body || {};

  if (!name || !specialty) {
    return NextResponse.json({ error: 'name and specialty are required.' }, { status: 400 });
  }

  try {
    const { schedule, error: scheduleError } = normalizeWeeklyScheduleInput(
      weeklyScheduleInput
    );

    if (scheduleError) {
      return NextResponse.json({ error: scheduleError }, { status: 400 });
    }

    const passwordHash = password ? await bcrypt.hash(password, 10) : null;
    const client = await pool.connect();
    let result;

    try {
      await client.query('BEGIN');
      result = await client.query(
        `INSERT INTO doctors (clinic_id, name, username, specialty, description, avatar, password_hash)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, clinic_id, name, username, specialty, description, avatar, is_disabled, created_at, updated_at`,
        [
          clinic.id,
          name,
          username || null,
          specialty,
          description || null,
          avatar || null,
          passwordHash,
        ]
      );

      if (schedule && schedule.length > 0) {
        const scheduleValues = [];
        const placeholders = schedule.map((entry, index) => {
          const base = index * 6;
          scheduleValues.push(
            clinic.id,
            result.rows[0].id,
            entry.weekday,
            entry.opens_at,
            entry.closes_at,
            entry.is_off
          );
          return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6})`;
        });

        await client.query(
          `INSERT INTO doctor_working_hours
             (clinic_id, doctor_id, weekday, opens_at, closes_at, is_off)
           VALUES ${placeholders.join(', ')}`,
          scheduleValues
        );
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    await logAudit({
      clinicId: clinic.id,
      doctorId: authResult.auth.doctorId,
      action: 'doctor_created',
      metadata: {
        createdDoctorId: result.rows[0].id,
      },
    });

    return NextResponse.json(
      {
        doctor: {
          ...result.rows[0],
          weekly_schedule: schedule || [],
        },
      },
      { status: 201 }
    );
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Doctor create failed:', err);
    return NextResponse.json({ error: 'Unable to create doctor.' }, { status: 500 });
  }
}
