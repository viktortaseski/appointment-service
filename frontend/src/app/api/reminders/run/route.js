import { NextResponse } from 'next/server';

import { getReminderToken, runAppointmentReminders } from '@/lib/server/reminders';

export const runtime = 'nodejs';

export async function POST(request) {
  const expectedSecret = process.env.CRON_SECRET;
  if (!expectedSecret) {
    return NextResponse.json(
      { error: 'CRON_SECRET not configured.' },
      { status: 500 }
    );
  }

  const providedToken = getReminderToken(request);
  if (providedToken !== expectedSecret) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  try {
    const result = await runAppointmentReminders(request);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error?.message || 'Reminder run failed.' },
      { status: 500 }
    );
  }
}
