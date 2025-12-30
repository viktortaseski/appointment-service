'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import BookingForm from '../components/BookingForm';
import DoctorsSection from '../components/DoctorsSection';
import HeroCopy from '../components/HeroCopy';
import SiteFooter from '../components/SiteFooter';
import StepsSection from '../components/StepsSection';
import Topbar from '../components/Topbar';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

const steps = [
  {
    title: 'Choose a clinic',
    detail: 'Pick the location or specialty that fits your care plan.',
  },
  {
    title: 'Select a doctor',
    detail: 'Review bios, availability, and patient focus areas.',
  },
  {
    title: 'Confirm your time',
    detail: 'Lock in a visit and get an instant email confirmation.',
  },
];

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

function buildTimeSlots(startHour, endHour, intervalMinutes) {
  const slots = [];
  const startMinutes = startHour * 60;
  const endMinutes = endHour * 60;

  for (let minutes = startMinutes; minutes <= endMinutes; minutes += intervalMinutes) {
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

function formatDisplayDate(dateKey) {
  if (!dateKey) {
    return '';
  }

  const date = new Date(`${dateKey}T00:00:00`);
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function getClinicDomain() {
  if (typeof window === 'undefined') {
    return process.env.NEXT_PUBLIC_CLINIC_DOMAIN || '';
  }

  return process.env.NEXT_PUBLIC_CLINIC_DOMAIN || window.location.hostname;
}

export default function Home() {
  const today = useMemo(() => new Date(), []);
  const todayKey = useMemo(() => formatDateKey(today), [today]);
  const [clinic, setClinic] = useState(null);
  const [doctors, setDoctors] = useState([]);
  const [status, setStatus] = useState({ loading: true, error: null });
  const [hostname, setHostname] = useState('');
  const [monthCursor, setMonthCursor] = useState(
    () => new Date(today.getFullYear(), today.getMonth(), 1)
  );
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const [selectedDoctor, setSelectedDoctor] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [formState, setFormState] = useState({
    patientName: '',
    patientEmail: '',
    patientPhone: '',
  });
  const [formErrors, setFormErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successNotice, setSuccessNotice] = useState(null);
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
      monthCursor.toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric',
      }),
    [monthCursor]
  );
  const timeSlots = useMemo(() => buildTimeSlots(9, 16, 30), []);
  const normalizedTakenTimes = useMemo(
    () => availability.takenTimes.map(normalizeTime).filter(Boolean),
    [availability.takenTimes]
  );

  const isPrevDisabled =
    monthCursor.getFullYear() === today.getFullYear() &&
    monthCursor.getMonth() === today.getMonth();

  useEffect(() => {
    setHostname(getClinicDomain());
  }, []);

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
          throw new Error(`Request failed with ${response.status}`);
        }

        const data = await response.json();

        if (!isActive) {
          return;
        }

        setClinic(data.clinic || null);
        setDoctors(data.doctors || []);
        setStatus({ loading: false, error: null });
      } catch (error) {
        if (!isActive) {
          return;
        }

        setStatus({
          loading: false,
          error: error?.message || 'Unable to load clinic data.',
        });
      }
    }

    loadClinic();

    return () => {
      isActive = false;
    };
  }, []);

  const fetchAvailability = useCallback(async (dateKey, doctorId) => {
    const clinicDomain = getClinicDomain();
    const response = await fetch(
      `${API_BASE}/appointments?date=${dateKey}&doctorId=${doctorId}`,
      {
        headers: {
          'x-clinic-domain': clinicDomain,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Request failed with ${response.status}`);
    }

    const data = await response.json();
    return (data.appointments || [])
      .map((appointment) => appointment.time)
      .filter(Boolean);
  }, []);

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
          error: error?.message || 'Unable to load availability.',
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
    setFormState((prev) => ({ ...prev, [field]: value }));
    setFormErrors((prev) => ({ ...prev, [field]: '' }));
  }

  function validateForm() {
    const errors = {};

    if (!formState.patientName.trim()) {
      errors.patientName = 'Full name is required.';
    }

    if (!formState.patientEmail.trim()) {
      errors.patientEmail = 'Email is required.';
    } else if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(formState.patientEmail)) {
      errors.patientEmail = 'Enter a valid email address.';
    }

    if (!formState.patientPhone.trim()) {
      errors.patientPhone = 'Phone number is required.';
    }

    if (!selectedDate) {
      errors.date = 'Select a date.';
    }

    if (!selectedDoctor) {
      errors.doctor = 'Select a doctor.';
    }

    if (!selectedTime) {
      errors.time = 'Select a time.';
    }

    return errors;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitError('');
    setSuccessNotice(null);

    const errors = validateForm();
    setFormErrors(errors);

    if (Object.keys(errors).length > 0) {
      return;
    }

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
          patient_name: formState.patientName,
          patient_email: formState.patientEmail,
          patient_phone: formState.patientPhone,
          date: selectedDate,
          time: selectedTime,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Unable to confirm appointment.');
      }

      const appointment = data.appointment || {};
      const appointmentDate = appointment.date
        ? appointment.date.slice(0, 10)
        : selectedDate;

      setSuccessNotice({
        clinicName: clinic?.name || 'the clinic',
        date: formatDisplayDate(appointmentDate),
        time: normalizeTime(appointment.time) || selectedTime,
        doctor: appointment.doctor_name || '',
        emailSent: data.email_sent,
        emailError: data.email_error,
      });

      setFormState({
        patientName: '',
        patientEmail: '',
        patientPhone: '',
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
      setSubmitError(error?.message || 'Unable to confirm appointment.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="page">
      <Topbar clinic={clinic} />

      {successNotice && (
        <div className="card success-banner">
          <div>
            <p className="success-title">Appointment confirmed</p>
            <p className="success-detail">
              You have an appointment at {successNotice.clinicName} on{' '}
              {successNotice.date} at {successNotice.time}.
            </p>
            {successNotice.doctor && (
              <p className="success-detail">Doctor: {successNotice.doctor}</p>
            )}
            {successNotice.emailSent ? (
              <p className="success-detail muted">
                A confirmation email has been sent.
              </p>
            ) : (
              <p className="success-detail muted">
                Email not sent: {successNotice.emailError || 'No email provided.'}
              </p>
            )}
          </div>
          <button
            type="button"
            className="ghost"
            onClick={() => setSuccessNotice(null)}
          >
            Dismiss
          </button>
        </div>
      )}

      <section className="hero">
        <HeroCopy clinic={clinic} hostname={hostname} />
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
          doctors={doctors}
          selectedDoctor={selectedDoctor}
          onSelectDoctor={(doctorId) => {
            setSelectedDoctor(doctorId);
            setSelectedTime('');
            setFormErrors((prev) => ({ ...prev, doctor: '', time: '' }));
          }}
          timeSlots={timeSlots}
          selectedTime={selectedTime}
          onSelectTime={(time) => {
            setSelectedTime(time);
            setFormErrors((prev) => ({ ...prev, time: '' }));
          }}
          availability={{
            ...availability,
            takenTimes: normalizedTakenTimes,
          }}
          onSubmit={handleSubmit}
          isSubmitting={isSubmitting}
          submitError={submitError}
        />
      </section>

      <DoctorsSection clinic={clinic} doctors={doctors} status={status} />
      <StepsSection steps={steps} />
      <SiteFooter />
    </main>
  );
}
