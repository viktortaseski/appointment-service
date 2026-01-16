'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import BookingForm from '../components/BookingForm';
import DoctorsSection from '../components/DoctorsSection';
import SiteFooter from '../components/SiteFooter';
import Topbar from '../components/Topbar';
import { useI18n } from '../components/I18nProvider';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api';
const AVAILABILITY_POLL_MS = 30000;     // 30s Refresh rate for real time updates
const THEME_DEFAULTS = {
  primary: '#ff7a45',
  secondary: '#f7f3ea',
  textDark: '#201b16',
  textLight: '#f7f3ea',
  white: '#ffffff',
};

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function normalizeHex(value, fallback) {
  if (typeof value !== 'string') {
    return fallback;
  }

  const trimmed = value.trim();
  if (/^#[0-9a-f]{6}$/i.test(trimmed)) {
    return trimmed;
  }

  return fallback;
}

function hexToRgb(hex) {
  const normalized = hex.replace('#', '');
  const red = parseInt(normalized.slice(0, 2), 16);
  const green = parseInt(normalized.slice(2, 4), 16);
  const blue = parseInt(normalized.slice(4, 6), 16);
  return { red, green, blue };
}

function rgbToHex({ red, green, blue }) {
  const toHex = (value) => value.toString(16).padStart(2, '0');
  return `#${toHex(red)}${toHex(green)}${toHex(blue)}`;
}

function mixRgb(a, b, weight) {
  const w = clamp(weight, 0, 1);
  return {
    red: Math.round(a.red * w + b.red * (1 - w)),
    green: Math.round(a.green * w + b.green * (1 - w)),
    blue: Math.round(a.blue * w + b.blue * (1 - w)),
  };
}

function rgbToRgbaString(rgb, alpha) {
  const safeAlpha = Math.round(clamp(alpha, 0, 1) * 100) / 100;
  return `rgba(${rgb.red}, ${rgb.green}, ${rgb.blue}, ${safeAlpha})`;
}

function relativeLuminance({ red, green, blue }) {
  const toLinear = (value) => {
    const channel = value / 255;
    return channel <= 0.03928
      ? channel / 12.92
      : Math.pow((channel + 0.055) / 1.055, 2.4);
  };

  const r = toLinear(red);
  const g = toLinear(green);
  const b = toLinear(blue);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function buildTheme(primaryHex, secondaryHex) {
  const primary = normalizeHex(primaryHex, THEME_DEFAULTS.primary);
  const secondary = normalizeHex(secondaryHex, THEME_DEFAULTS.secondary);
  const primaryRgb = hexToRgb(primary);
  const secondaryRgb = hexToRgb(secondary);
  const whiteRgb = hexToRgb(THEME_DEFAULTS.white);

  const bg = secondary;
  const bg2 = rgbToHex(mixRgb(secondaryRgb, primaryRgb, 0.9));
  const accent = primary;
  const accentDark = rgbToHex(mixRgb(primaryRgb, { red: 0, green: 0, blue: 0 }, 0.8));

  const luminance = relativeLuminance(secondaryRgb);
  const text = luminance > 0.6 ? THEME_DEFAULTS.textDark : THEME_DEFAULTS.textLight;
  const textRgb = hexToRgb(text);
  const muted = rgbToHex(mixRgb(textRgb, secondaryRgb, 0.65));
  const surface = rgbToHex(mixRgb(secondaryRgb, whiteRgb, 0.2));

  const stroke = rgbToRgbaString(textRgb, 0.12);
  const shadow = `0 28px 60px ${rgbToRgbaString(textRgb, 0.12)}`;
  const confirmBg = rgbToRgbaString(mixRgb(secondaryRgb, primaryRgb, 0.85), 0.9);
  const confirmBorder = rgbToRgbaString(mixRgb(secondaryRgb, primaryRgb, 0.7), 0.6);
  const confirmShadow = `0 20px 40px ${rgbToRgbaString(primaryRgb, 0.25)}`;

  return {
    '--bg': bg,
    '--bg-2': bg2,
    '--text': text,
    '--muted': muted,
    '--accent': accent,
    '--accent-dark': accentDark,
    '--accent-rgb': `${primaryRgb.red}, ${primaryRgb.green}, ${primaryRgb.blue}`,
    '--surface': surface,
    '--stroke': stroke,
    '--shadow': shadow,
    '--confirm-bg': confirmBg,
    '--confirm-border': confirmBorder,
    '--confirm-shadow': confirmShadow,
  };
}

function formatDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function buildMonthGrid(cursor) {
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startWeekday = firstDay.getDay();
  const slots = [];

  for (let i = 0; i < startWeekday; i += 1) {
    slots.push(null);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(year, month, day);
    slots.push({
      key: formatDateKey(date),
      day,
    });
  }

  return slots;
}

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

function buildTimeSlots(startTime, endTime, intervalMinutes) {
  const slots = [];
  const startMinutes = parseTimeToMinutes(startTime) ?? 9 * 60;
  const endMinutes = parseTimeToMinutes(endTime) ?? 16 * 60;
  const interval = Number(intervalMinutes) || 30;

  if (interval <= 0) {
    return slots;
  }

  for (let minutes = startMinutes; minutes <= endMinutes; minutes += interval) {
    const hour = Math.floor(minutes / 60);
    const minute = minutes % 60;
    const value = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    const hour12 = ((hour + 11) % 12) + 1;
    const suffix = hour >= 12 ? 'PM' : 'AM';
    const label = `${hour12}:${String(minute).padStart(2, '0')} ${suffix}`;
    slots.push({ value, label });
  }

  return slots;
}

function getWeekdayIndex(dateKey) {
  if (!dateKey) {
    return null;
  }

  const normalized = String(dateKey).slice(0, 10);
  const [year, month, day] = normalized.split('-').map(Number);
  if (!year || !month || !day) {
    return null;
  }

  const utcDate = new Date(Date.UTC(year, month - 1, day));
  return utcDate.getUTCDay();
}

function getScheduleEntryForDate(scheduleRows, dateKey) {
  if (!Array.isArray(scheduleRows) || !dateKey) {
    return null;
  }

  const weekday = getWeekdayIndex(dateKey);
  if (weekday === null) {
    return null;
  }

  return scheduleRows.find((row) => Number(row.weekday) === weekday) || null;
}

function normalizeTime(value) {
  if (!value) {
    return null;
  }

  return value.slice(0, 5);
}

function formatDisplayDate(dateKey, localeTag) {
  if (!dateKey) {
    return '';
  }

  const date = new Date(`${dateKey}T00:00:00`);
  return date.toLocaleDateString(localeTag || 'en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatTimeDisplay(value, localeTag) {
  if (!value) {
    return '';
  }

  const normalized = typeof value === 'string' ? value : String(value);
  const [hour, minute] = normalized.split(':');
  const hours = Number(hour);
  const minutes = Number(minute || 0);

  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    return normalized.slice(0, 5);
  }

  const date = new Date(Date.UTC(1970, 0, 1, hours, minutes));
  return date.toLocaleTimeString(localeTag || 'en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function getClinicDomain() {
  if (typeof window === 'undefined') {
    return process.env.NEXT_PUBLIC_CLINIC_DOMAIN || '';
  }

  return process.env.NEXT_PUBLIC_CLINIC_DOMAIN || window.location.hostname;
}

function formatPhoneInput(value, maxDigits) {
  const digits = value.replace(/\D/g, '');
  const trimmed = maxDigits ? digits.slice(0, maxDigits) : digits;
  if (trimmed.length <= 2) {
    return trimmed;
  }

  const first = trimmed.slice(0, 2);
  const rest = trimmed.slice(2);
  const chunks = rest.match(/.{1,3}/g) || [];
  return [first, ...chunks].join(' ').trim();
}

function BookingPageContent() {
  const { t, localeTag, setLocale } = useI18n();
  const today = useMemo(() => new Date(), []);
  const todayKey = useMemo(() => formatDateKey(today), [today]);
  const [clinic, setClinic] = useState(null);
  const [doctors, setDoctors] = useState([]);
  const [status, setStatus] = useState({ loading: true, error: null });
  const [monthCursor, setMonthCursor] = useState(
    () => new Date(today.getFullYear(), today.getMonth(), 1)
  );
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const [selectedDoctor, setSelectedDoctor] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const phoneCountries = useMemo(
    () => [
      { code: 'MK', dial: '+389', label: 'MK +389', length: 8 },
      { code: 'AL', dial: '+355', label: 'AL +355', length: 9 },
      { code: 'US', dial: '+1', label: 'US +1', length: 10 },
      { code: 'UK', dial: '+44', label: 'UK +44', length: 10 },
      { code: 'DE', dial: '+49', label: 'DE +49', length: 10 },
    ],
    []
  );

  const [formState, setFormState] = useState({
    patientName: '',
    patientEmail: '',
    patientPhoneCountry: '+389',
    patientPhoneNumber: '',
    patientNotes: '',
  });
  const selectedPhoneCountry = useMemo(
    () =>
      phoneCountries.find((country) => country.dial === formState.patientPhoneCountry) ||
      phoneCountries[0],
    [formState.patientPhoneCountry, phoneCountries]
  );

  const [formErrors, setFormErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmNotice, setConfirmNotice] = useState(null);
  const [successNotice, setSuccessNotice] = useState(null);
  const [promptNotice, setPromptNotice] = useState(null);
  const [availability, setAvailability] = useState({
    loading: false,
    error: null,
    takenTimes: [],
  });

  const monthGrid = useMemo(
    () =>
      buildMonthGrid(monthCursor).map((slot) =>
        slot ? { ...slot, isPast: slot.key < todayKey } : slot
      ),
    [monthCursor, todayKey]
  );
  const monthLabel = useMemo(
    () =>
      monthCursor.toLocaleDateString(localeTag, {
        month: 'long',
        year: 'numeric',
      }),
    [monthCursor, localeTag]
  );
  const selectedDoctorInfo = useMemo(
    () => doctors.find((doctor) => doctor.id === selectedDoctor) || null,
    [doctors, selectedDoctor]
  );
  const selectedDoctorSchedule = useMemo(
    () => getScheduleEntryForDate(selectedDoctorInfo?.weekly_schedule, selectedDate),
    [selectedDoctorInfo, selectedDate]
  );
  const selectedScheduleOff = Boolean(
    selectedDoctorSchedule?.is_off ?? selectedDoctorSchedule?.isOff
  );
  const scheduleStart =
    selectedDoctorSchedule?.opens_at
      || selectedDoctorSchedule?.opensAt
      || clinic?.opens_at
      || '09:00';
  const scheduleEnd =
    selectedDoctorSchedule?.closes_at
      || selectedDoctorSchedule?.closesAt
      || clinic?.closes_at
      || '16:00';
  const timeSlots = useMemo(() => {
    if (selectedScheduleOff) {
      return [];
    }
    return buildTimeSlots(scheduleStart, scheduleEnd, clinic?.slot_minutes);
  }, [scheduleStart, scheduleEnd, clinic?.slot_minutes, selectedScheduleOff]);
  const scheduleInterval = clinic?.slot_minutes || 30;
  const scheduleStartLabel = formatTimeDisplay(scheduleStart, localeTag);
  const scheduleEndLabel = formatTimeDisplay(scheduleEnd, localeTag);
  const clinicStartLabel = formatTimeDisplay(clinic?.opens_at || '09:00', localeTag);
  const clinicEndLabel = formatTimeDisplay(clinic?.closes_at || '16:00', localeTag);
  const scheduleTimeHint = selectedDoctor && selectedScheduleOff
    ? t('time_off_hint')
    : t('time_hint', {
      start: scheduleStartLabel,
      end: scheduleEndLabel,
      interval: scheduleInterval,
    });
  const availabilityLabel = t('availability_label', {
    start: clinicStartLabel,
    end: clinicEndLabel,
  });
  const normalizedTakenTimes = useMemo(
    () => availability.takenTimes.map(normalizeTime).filter(Boolean),
    [availability.takenTimes]
  );

  const isPrevDisabled =
    monthCursor.getFullYear() === today.getFullYear() &&
    monthCursor.getMonth() === today.getMonth();

  useEffect(() => {
    if (!selectedDate) {
      setSelectedDate(todayKey);
      return;
    }

    const selected = new Date(`${selectedDate}T00:00:00`);
    const sameMonth =
      selected.getFullYear() === monthCursor.getFullYear() &&
      selected.getMonth() === monthCursor.getMonth();

    if (!sameMonth) {
      const year = monthCursor.getFullYear();
      const month = monthCursor.getMonth();
      const firstDay =
        year === today.getFullYear() && month === today.getMonth()
          ? today.getDate()
          : 1;
      setSelectedDate(formatDateKey(new Date(year, month, firstDay)));
    }
  }, [monthCursor, selectedDate, todayKey, today]);

  useEffect(() => {
    let isActive = true;

    async function loadClinic() {
      setStatus({ loading: true, error: null });

      try {
        const clinicDomain = getClinicDomain();
        const response = await fetch(`${API_BASE}/doctors`, {
          headers: {
            'x-clinic-domain': clinicDomain,
          },
        });

        if (!response.ok) {
          throw new Error(t('request_failed', { status: response.status }));
        }

        const data = await response.json();

        if (!isActive) {
          return;
        }

        const rawClinic = data.clinic || null;
        const normalizedClinic = rawClinic
          ? {
            ...rawClinic,
            opens_at: rawClinic.opens_at ?? rawClinic.opensAt,
            closes_at: rawClinic.closes_at ?? rawClinic.closesAt,
            slot_minutes: rawClinic.slot_minutes ?? rawClinic.slotMinutes,
            default_language:
              rawClinic.default_language ?? rawClinic.defaultLanguage ?? null,
          }
          : null;

        setClinic(normalizedClinic);
        setDoctors(data.doctors || []);
        setStatus({ loading: false, error: null });
      } catch (error) {
        if (!isActive) {
          return;
        }

        setStatus({
          loading: false,
          error: error?.message || t('load_clinic_error'),
        });
      }
    }

    loadClinic();

    return () => {
      isActive = false;
    };
  }, [t]);

  useEffect(() => {
    if (!clinic?.default_language) {
      return;
    }

    const stored = window.localStorage.getItem('locale');
    if (stored) {
      return;
    }

    const supportedLocales = ['en', 'mk', 'al', 'sl'];
    if (!supportedLocales.includes(clinic.default_language)) {
      return;
    }

    setLocale(clinic.default_language, 'auto');
  }, [clinic?.default_language, setLocale]);

  useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }

    const root = document.documentElement;
    const theme = buildTheme(clinic?.theme_primary, clinic?.theme_secondary);

    Object.entries(theme).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });
  }, [
    clinic?.theme_primary,
    clinic?.theme_secondary,
  ]);

  const fetchAvailability = useCallback(async (dateKey, doctorId) => {
    const clinicDomain = getClinicDomain();
    const [appointmentsResponse, unavailableResponse] = await Promise.all([
      fetch(`${API_BASE}/appointments?date=${dateKey}&doctorId=${doctorId}`, {
        headers: {
          'x-clinic-domain': clinicDomain,
        },
      }),
      fetch(`${API_BASE}/availability?date=${dateKey}&doctorId=${doctorId}`, {
        headers: {
          'x-clinic-domain': clinicDomain,
        },
      }),
    ]);

    if (!appointmentsResponse.ok) {
      throw new Error(t('request_failed', { status: appointmentsResponse.status }));
    }

    if (!unavailableResponse.ok) {
      throw new Error(t('request_failed', { status: unavailableResponse.status }));
    }

    const appointmentsData = await appointmentsResponse.json();
    const unavailableData = await unavailableResponse.json();
    const booked = (appointmentsData.appointments || [])
      .map((appointment) => appointment.time)
      .filter(Boolean);
    const unavailable = unavailableData.unavailableTimes || [];
    return Array.from(new Set([...booked, ...unavailable]));
  }, [t]);

  useEffect(() => {
    let isActive = true;
    let refreshTimer = null;
    let isFetching = false;

    if (!selectedDate || !selectedDoctor) {
      setAvailability({ loading: false, error: null, takenTimes: [] });
      return () => {
        isActive = false;
      };
    }

    async function loadAvailability({ silent = false } = {}) {
      if (isFetching) {
        return;
      }

      isFetching = true;

      if (!silent) {
        setAvailability({ loading: true, error: null, takenTimes: [] });
      }

      try {
        const taken = await fetchAvailability(selectedDate, selectedDoctor);

        if (!isActive) {
          return;
        }

        setAvailability({
          loading: false,
          error: null,
          takenTimes: taken,
        });
      } catch (error) {
        if (!isActive) {
          return;
        }

        setAvailability((prev) => ({
          loading: false,
          error: error?.message || t('availability_error'),
          takenTimes: silent ? prev.takenTimes : [],
        }));
      } finally {
        isFetching = false;
      }
    }

    loadAvailability({ silent: false });
    refreshTimer = setInterval(() => {
      loadAvailability({ silent: true });
    }, AVAILABILITY_POLL_MS);

    const handleFocus = () => {
      loadAvailability({ silent: true });
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('focus', handleFocus);
    }

    return () => {
      isActive = false;
      if (refreshTimer) {
        clearInterval(refreshTimer);
      }
      if (typeof window !== 'undefined') {
        window.removeEventListener('focus', handleFocus);
      }
    };
  }, [selectedDate, selectedDoctor, fetchAvailability]);

  useEffect(() => {
    setSelectedTime('');
  }, [selectedDate]);

  function handleFieldChange(field, value) {
    const nextValue =
      field === 'patientPhoneNumber'
        ? formatPhoneInput(value, selectedPhoneCountry?.length)
        : value;
    setFormState((prev) => ({ ...prev, [field]: nextValue }));
    setFormErrors((prev) => ({ ...prev, [field]: '' }));
  }

  function validateForm() {
    const errors = {};
    const email = formState.patientEmail.trim();
    const phoneDigits = formState.patientPhoneNumber.replace(/\D/g, '');
    const name = formState.patientName.trim();

    if (!name) {
      errors.patientName = t('validation_name_required');
    }

    if (!email) {
      errors.patientEmail = t('validation_email_required');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.patientEmail = t('validation_email_invalid');
    }

    if (!phoneDigits) {
      errors.patientPhone = t('validation_phone_required');
    } else if (
      selectedPhoneCountry?.length &&
      phoneDigits.length !== selectedPhoneCountry.length
    ) {
      errors.patientPhone = t('validation_phone_invalid', {
        length: selectedPhoneCountry.length,
      });
    }

    if (!selectedDate) {
      errors.date = t('validation_date_required');
    }

    if (!selectedDoctor) {
      errors.doctor = t('validation_doctor_required');
    }

    if (!selectedTime) {
      errors.time = t('validation_time_required');
    }

    return errors;
  }

  function handlePhoneCountryChange(value) {
    const resolved =
      phoneCountries.find((country) => country.dial === value) || phoneCountries[0];
    const digits = formState.patientPhoneNumber.replace(/\D/g, '');
    const nextNumber = formatPhoneInput(digits, resolved?.length);

    setFormState((prev) => ({
      ...prev,
      patientPhoneCountry: value,
      patientPhoneNumber: nextNumber,
    }));
    setFormErrors((prev) => ({ ...prev, patientPhone: '' }));
  }

  function handlePreviewSubmit(event) {
    event.preventDefault();
    setSubmitError('');
    setSuccessNotice(null);
    setConfirmNotice(null);
    setPromptNotice(null);

    const errors = validateForm();
    setFormErrors(errors);

    if (errors.doctor) {
      setPromptNotice({ type: 'doctor', message: t('prompt_select_doctor') });
      return;
    }

    if (errors.time) {
      setPromptNotice({ type: 'time', message: t('prompt_select_time') });
      return;
    }

    if (Object.keys(errors).length > 0) {
      return;
    }

    const doctorName =
      doctors.find((doctor) => doctor.id === selectedDoctor)?.name || t('doctor_label');
    const timeLabel =
      timeSlots.find((slot) => slot.value === selectedTime)?.label || selectedTime;

    setConfirmNotice({
      clinicName: clinic?.name || t('clinic_fallback'),
      date: formatDisplayDate(selectedDate, localeTag),
      time: timeLabel,
      doctor: doctorName,
    });
  }

  function handleBookDoctor(doctorId) {
    setSelectedDoctor(doctorId);
    setSelectedTime('');
    setFormErrors((prev) => ({ ...prev, doctor: '', time: '' }));
    setPromptNotice((prev) => (prev?.type === 'doctor' ? null : prev));

    const form = document.getElementById('book');
    if (form) {
      form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  async function handleReserveAppointment() {
    setIsSubmitting(true);

    try {
      const clinicDomain = getClinicDomain();
      const response = await fetch(`${API_BASE}/appointments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-clinic-domain': clinicDomain,
        },
        body: JSON.stringify({
          doctor_id: selectedDoctor,
          patient_name: formState.patientName.trim(),
          patient_email: formState.patientEmail.trim(),
          patient_phone: `${formState.patientPhoneCountry}${formState.patientPhoneNumber.replace(/\D/g, '')}`,
          date: selectedDate,
          time: selectedTime,
          notes: formState.patientNotes.trim() || null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || t('confirm_error'));
      }

      const appointment = data.appointment || {};
      const appointmentDate = appointment.date
        ? appointment.date.slice(0, 10)
        : selectedDate;

      setSuccessNotice({
        clinicName: clinic?.name || t('clinic_fallback'),
        date: formatDisplayDate(appointmentDate, localeTag),
        time: normalizeTime(appointment.time) || selectedTime,
        doctor: appointment.doctor_name || '',
      });
      setConfirmNotice(null);

      setFormState({
        patientName: '',
        patientEmail: '',
        patientPhoneCountry: formState.patientPhoneCountry,
        patientPhoneNumber: '',
        patientNotes: '',
      });
      setSelectedTime('');
      setFormErrors({});

      if (selectedDate && selectedDoctor) {
        const taken = await fetchAvailability(selectedDate, selectedDoctor);
        setAvailability({
          loading: false,
          error: null,
          takenTimes: taken,
        });
      }
    } catch (error) {
      setSubmitError(error?.message || t('confirm_error'));
    } finally {
      setIsSubmitting(false);
    }
  }

  if (clinic?.is_disabled) {
    return (
      <main className="page">
        <Topbar clinic={clinic} />
        <section className="hero">
          <div className="card clinic-status">
            <p className="status-title">{t('clinic_unavailable_title')}</p>
            <p className="status-copy">{t('clinic_unavailable_detail')}</p>
            <p className="status-copy muted">{t('clinic_unavailable_contact')}</p>
          </div>
        </section>
        <SiteFooter clinic={clinic} />
      </main>
    );
  }

  return (
    <main className="page">
      <Topbar clinic={clinic} />

      {successNotice && (
        <div className="notice-overlay">
          <div className="card success-banner notice-card">
            <div>
              <p className="success-title">{t('appointment_confirmed')}</p>
              <p className="success-detail">
                {t('appointment_detail', {
                  clinic: successNotice.clinicName,
                  date: successNotice.date,
                  time: successNotice.time,
                })}
              </p>
              {successNotice.doctor && (
                <p className="success-detail">
                  {t('doctor_label')}: {successNotice.doctor}
                </p>
              )}
              <p className="success-detail muted">
                {t('email_sent_later')}
              </p>
            </div>
            <button
              type="button"
              className="ghost"
              onClick={() => setSuccessNotice(null)}
            >
              {t('dismiss')}
            </button>
          </div>
        </div>
      )}

      {promptNotice && (
        <div className="notice-overlay">
          <div className="card prompt-banner notice-card">
            <p className="prompt-title">{promptNotice.message}</p>
            <button
              type="button"
              className="ghost"
              onClick={() => setPromptNotice(null)}
            >
              {t('dismiss')}
            </button>
          </div>
        </div>
      )}

      {confirmNotice && (
        <div className="notice-overlay">
          <div className="card confirm-banner notice-card">
            <div>
              <p className="confirm-title">{t('confirm_title')}</p>
              <p className="confirm-detail">
                {t('confirm_detail', {
                  clinic: confirmNotice.clinicName,
                  date: confirmNotice.date,
                  time: confirmNotice.time,
                })}
              </p>
              <p className="confirm-detail muted">
                {t('doctor_label')}: {confirmNotice.doctor}
              </p>
              {submitError && <p className="status error">{submitError}</p>}
            </div>
            <div className="confirm-actions">
              <button
                type="button"
                className="ghost"
                onClick={() => setConfirmNotice(null)}
                disabled={isSubmitting}
              >
                {t('back')}
              </button>
              <button
                type="button"
                className="cta"
                onClick={handleReserveAppointment}
                disabled={isSubmitting}
              >
                {isSubmitting ? t('reserving') : t('yes_reserve')}
              </button>
            </div>
          </div>
        </div>
      )}

      <section className="hero">
        <BookingForm
          monthLabel={monthLabel}
          monthGrid={monthGrid}
          isPrevDisabled={isPrevDisabled}
          onPrevMonth={() =>
            setMonthCursor(
              (current) => new Date(current.getFullYear(), current.getMonth() - 1, 1)
            )
          }
          onNextMonth={() =>
            setMonthCursor(
              (current) => new Date(current.getFullYear(), current.getMonth() + 1, 1)
            )
          }
          selectedDate={selectedDate}
          onSelectDate={(dateKey) => {
            setSelectedDate(dateKey);
            setSelectedTime('');
            setFormErrors((prev) => ({ ...prev, date: '', time: '' }));
          }}
          formState={formState}
          formErrors={formErrors}
          onFieldChange={handleFieldChange}
          phoneCountries={phoneCountries}
          doctors={doctors}
          selectedDoctor={selectedDoctor}
          onSelectDoctor={(doctorId) => {
            setSelectedDoctor(doctorId);
            setSelectedTime('');
            setFormErrors((prev) => ({ ...prev, doctor: '', time: '' }));
            setPromptNotice((prev) => (prev?.type === 'doctor' ? null : prev));
            if (typeof window !== 'undefined') {
              window.requestAnimationFrame(() => {
                const target = document.getElementById('booking-date');
                if (target) {
                  target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
              });
            }
          }}
          timeSlots={timeSlots}
          timeHint={scheduleTimeHint}
          selectedTime={selectedTime}
          onSelectTime={(time) => {
            setSelectedTime(time);
            setFormErrors((prev) => ({ ...prev, time: '' }));
            setPromptNotice((prev) => (prev?.type === 'time' ? null : prev));
          }}
          phoneCountry={formState.patientPhoneCountry}
          phoneNumber={formState.patientPhoneNumber}
          onPhoneCountryChange={handlePhoneCountryChange}
          availability={{
            ...availability,
            takenTimes: normalizedTakenTimes,
          }}
          onSubmit={handlePreviewSubmit}
          isSubmitting={isSubmitting}
          submitError={submitError}
          doctorsStatus={status}
        />
      </section>

      <DoctorsSection
        clinic={clinic}
        doctors={doctors}
        status={status}
        onBookDoctor={handleBookDoctor}
        availabilityLabel={availabilityLabel}
      />
      <SiteFooter clinic={clinic} />
    </main>
  );
}

export default function Home() {
  const { t } = useI18n();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    setIsReady(true);
  }, []);

  if (!isReady) {
    return (
      <main className="page">
        <Topbar clinic={null} />
        <section className="hero">
          <div className="card clinic-status">
            <p className="status-title">{t('loading_doctors')}</p>
          </div>
        </section>
      </main>
    );
  }

  return <BookingPageContent />;
}
