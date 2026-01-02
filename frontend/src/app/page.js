'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import BookingForm from '../components/BookingForm';
import DoctorsSection from '../components/DoctorsSection';
import SiteFooter from '../components/SiteFooter';
import Topbar from '../components/Topbar';
import { useI18n } from '../components/I18nProvider';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api';

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
  const { t, localeTag } = useI18n();
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
  const timeSlots = useMemo(
    () => buildTimeSlots(clinic?.opens_at, clinic?.closes_at, clinic?.slot_minutes),
    [clinic?.opens_at, clinic?.closes_at, clinic?.slot_minutes]
  );
  const scheduleStart = clinic?.opens_at || '09:00';
  const scheduleEnd = clinic?.closes_at || '16:00';
  const scheduleInterval = clinic?.slot_minutes || 30;
  const scheduleStartLabel = formatTimeDisplay(scheduleStart, localeTag);
  const scheduleEndLabel = formatTimeDisplay(scheduleEnd, localeTag);
  const scheduleTimeHint = t('time_hint', {
    start: scheduleStartLabel,
    end: scheduleEndLabel,
    interval: scheduleInterval,
  });
  const availabilityLabel = t('availability_label', {
    start: scheduleStartLabel,
    end: scheduleEndLabel,
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

    if (!selectedDate || !selectedDoctor) {
      setAvailability({ loading: false, error: null, takenTimes: [] });
      return () => {
        isActive = false;
      };
    }

    async function loadAvailability() {
      setAvailability({ loading: true, error: null, takenTimes: [] });

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

        setAvailability({
          loading: false,
          error: error?.message || t('availability_error'),
          takenTimes: [],
        });
      }
    }

    loadAvailability();

    return () => {
      isActive = false;
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
