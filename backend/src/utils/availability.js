const DEFAULT_START_HOUR = 9;
const DEFAULT_END_HOUR = 16;
const DEFAULT_INTERVAL_MINUTES = 30;

function buildTimeSlots(
  startHour = DEFAULT_START_HOUR,
  endHour = DEFAULT_END_HOUR,
  intervalMinutes = DEFAULT_INTERVAL_MINUTES
) {
  const slots = [];
  const startMinutes = startHour * 60;
  const endMinutes = endHour * 60;

  for (let minutes = startMinutes; minutes <= endMinutes; minutes += intervalMinutes) {
    const hour = Math.floor(minutes / 60);
    const minute = minutes % 60;
    const value = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    slots.push(value);
  }

  return slots;
}

const DEFAULT_TIME_SLOTS = buildTimeSlots();

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
  buildTimeSlots,
  computeBlockedTimes,
  normalizeDateKey,
  DEFAULT_TIME_SLOTS,
};
