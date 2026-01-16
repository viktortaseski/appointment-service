function parseTimeToMinutes(value) {
  if (!value) {
    return null;
  }

  const normalized = typeof value === 'string' ? value : String(value);
  const [hour, minute] = normalized.split(':');
  const hours = Number(hour);
  const minutes = Number(minute || 0);

  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    return null;
  }

  return hours * 60 + minutes;
}

export function normalizeWeeklyScheduleInput(schedule) {
  if (schedule === undefined) {
    return { schedule: null, error: null };
  }

  if (!Array.isArray(schedule)) {
    return { schedule: null, error: 'weekly_schedule must be an array.' };
  }

  const seen = new Set();
  const normalized = [];

  for (const entry of schedule) {
    const weekday = Number(entry?.weekday);
    if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) {
      return { schedule: null, error: 'weekday must be between 0 and 6.' };
    }

    if (seen.has(weekday)) {
      return { schedule: null, error: 'weekday entries must be unique.' };
    }
    seen.add(weekday);

    const isOff = Boolean(entry?.is_off ?? entry?.isOff);
    let opensAt = entry?.opens_at ?? entry?.opensAt ?? null;
    let closesAt = entry?.closes_at ?? entry?.closesAt ?? null;

    if (isOff) {
      opensAt = null;
      closesAt = null;
    } else {
      opensAt = opensAt ? String(opensAt).trim() : '';
      closesAt = closesAt ? String(closesAt).trim() : '';

      if (!opensAt || !closesAt) {
        return {
          schedule: null,
          error: 'opens_at and closes_at are required for working days.',
        };
      }

      const start = parseTimeToMinutes(opensAt);
      const end = parseTimeToMinutes(closesAt);

      if (start === null || end === null || start >= end) {
        return {
          schedule: null,
          error: 'opens_at must be before closes_at for working days.',
        };
      }
    }

    normalized.push({
      weekday,
      opens_at: opensAt,
      closes_at: closesAt,
      is_off: isOff,
    });
  }

  normalized.sort((a, b) => a.weekday - b.weekday);

  return { schedule: normalized, error: null };
}
