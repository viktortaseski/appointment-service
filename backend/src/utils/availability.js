const DEFAULT_START_TIME = '09:00';
const DEFAULT_END_TIME = '16:00';
const DEFAULT_INTERVAL_MINUTES = 30;

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

function minutesToTime(totalMinutes) {
  const safeMinutes = Math.max(0, totalMinutes);
  const hours = Math.floor(safeMinutes / 60);
  const minutes = safeMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function normalizeTime(value) {
  if (!value) {
    return '';
  }

  const normalized = typeof value === 'string' ? value : String(value);
  const [hour, minute] = normalized.split(':');
  if (!hour) {
    return '';
  }
  return `${hour.padStart(2, '0')}:${String(minute || '00').padStart(2, '0')}`;
}

function buildTimeSlotsFromTimes(startTime, endTime, intervalMinutes) {
  const startMinutes = parseTimeToMinutes(startTime || DEFAULT_START_TIME);
  const endMinutes = parseTimeToMinutes(endTime || DEFAULT_END_TIME);
  const interval = Number(intervalMinutes) || DEFAULT_INTERVAL_MINUTES;

  if (startMinutes === null || endMinutes === null || interval <= 0) {
    return [];
  }

  const slots = [];

  for (let minutes = startMinutes; minutes <= endMinutes; minutes += interval) {
    slots.push(minutesToTime(minutes));
  }

  return slots;
}

function buildTimeSlotsFromClinic(clinic) {
  return buildTimeSlotsFromTimes(
    clinic?.opens_at,
    clinic?.closes_at,
    clinic?.slot_minutes
  );
}

const DEFAULT_TIME_SLOTS = buildTimeSlotsFromTimes();

function normalizeDateKey(value) {
  if (!value) {
    return '';
  }

  if (typeof value === 'string') {
    return value.slice(0, 10);
  }

  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  return String(value).slice(0, 10);
}

function timeToMinutes(value) {
  return parseTimeToMinutes(value);
}

function computeBlockedTimes(dateKey, records, slots = DEFAULT_TIME_SLOTS) {
  const normalizedDate = normalizeDateKey(dateKey);
  if (!normalizedDate) {
    return [];
  }

  const blocked = new Set();
  const slotMinutes = slots.map(timeToMinutes);

  records.forEach((record) => {
    const startDate = normalizeDateKey(record.start_date);
    const endDate = normalizeDateKey(record.end_date);

    if (!startDate || !endDate) {
      return;
    }

    if (normalizedDate < startDate || normalizedDate > endDate) {
      return;
    }

    if (!record.start_time && !record.end_time) {
      slots.forEach((slot) => blocked.add(slot));
      return;
    }

    const startMinutes = timeToMinutes(record.start_time);
    const endMinutes = timeToMinutes(record.end_time);

    if (startMinutes === null || endMinutes === null) {
      return;
    }

    slotMinutes.forEach((minutes, index) => {
      if (minutes >= startMinutes && minutes < endMinutes) {
        blocked.add(slots[index]);
      }
    });
  });

  return Array.from(blocked);
}

module.exports = {
  buildTimeSlotsFromTimes,
  buildTimeSlotsFromClinic,
  computeBlockedTimes,
  normalizeDateKey,
  normalizeTime,
  DEFAULT_TIME_SLOTS,
};
