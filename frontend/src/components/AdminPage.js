'use client';

import { useEffect, useMemo, useState } from 'react';

const initialAppointments = [
  {
    patient: 'John Smith',
    reason: 'Regular checkup',
    status: 'Completed',
    doctor: 'Dr. Sarah Johnson',
    specialty: 'General Dentistry',
    date: 'Dec 30, 2025',
    time: '09:30',
    email: 'john.smith@email.com',
    phone: '+1 (555) 123-4567',
    highlight: true,
  },
  {
    patient: 'Emma Johnson',
    reason: 'Braces adjustment',
    status: 'Pending',
    doctor: 'Dr. Michael Chen',
    specialty: 'Orthodontics',
    date: 'Dec 30, 2025',
    time: '14:00',
    email: 'emma.j@email.com',
    phone: '+1 (555) 234-5678',
  },
  {
    patient: 'Michael Brown',
    reason: 'Teeth whitening consultation',
    status: 'Pending',
    doctor: 'Dr. Emily Rodriguez',
    specialty: 'Cosmetic Dentistry',
    date: 'Dec 31, 2025',
    time: '10:00',
    email: 'mbrown@email.com',
    phone: '+1 (555) 345-6789',
  },
  {
    patient: 'Sarah Davis',
    reason: 'Wisdom tooth extraction',
    status: 'Pending',
    doctor: 'Dr. James Wilson',
    specialty: 'Oral Surgery',
    date: 'Jan 2, 2026',
    time: '11:30',
    email: 'sarah.davis@email.com',
    phone: '+1 (555) 456-7890',
  },
  {
    patient: 'David Wilson',
    reason: 'Dental cleaning',
    status: 'Pending',
    doctor: 'Dr. Sarah Johnson',
    specialty: 'General Dentistry',
    date: 'Jan 4, 2026',
    time: '15:00',
    email: 'dwilson@email.com',
    phone: '+1 (555) 567-8901',
  },
  {
    patient: 'Lisa Martinez',
    reason: 'Orthodontic consultation',
    status: 'Pending',
    doctor: 'Dr. Michael Chen',
    specialty: 'Orthodontics',
    date: 'Jan 7, 2026',
    time: '13:30',
    email: 'lisa.m@email.com',
    phone: '+1 (555) 678-9012',
  },
];

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

const weekdayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function formatDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDisplayDate(dateKey) {
  const date = new Date(`${dateKey}T00:00:00`);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function normalizeAppointment(appointment) {
  const isIso = /^\d{4}-\d{2}-\d{2}$/.test(appointment.date);
  const dateKey = isIso
    ? appointment.date
    : formatDateKey(new Date(appointment.date));

  return {
    id: `${appointment.patient}-${appointment.time}-${dateKey}`,
    ...appointment,
    dateKey,
  };
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

export default function AdminPage() {
  const today = useMemo(() => new Date(), []);
  const todayKey = useMemo(() => formatDateKey(today), [today]);
  const [appointments, setAppointments] = useState(() =>
    initialAppointments.map(normalizeAppointment)
  );
  const [scopeFilter, setScopeFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [doctorFilter, setDoctorFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formState, setFormState] = useState({
    patient: '',
    doctor: '',
    date: '',
    time: '',
    email: '',
    phone: '',
    notes: '',
  });
  const [formError, setFormError] = useState('');
  const [monthCursor, setMonthCursor] = useState(
    () => new Date(today.getFullYear(), today.getMonth(), 1)
  );
  const timeSlots = useMemo(() => buildTimeSlots(9, 16, 30), []);

  const weekEnd = useMemo(() => {
    const date = new Date();
    date.setDate(date.getDate() + 6);
    return formatDateKey(date);
  }, []);

  const doctorOptions = useMemo(() => {
    const map = new Map();
    appointments.forEach((item) => {
      if (!map.has(item.doctor)) {
        map.set(item.doctor, item.specialty || 'General Dentistry');
      }
    });
    return Array.from(map, ([name, specialty]) => ({ name, specialty }));
  }, [appointments]);

  const activeDoctorCount = doctorOptions.length;

  const totalCount = appointments.length;
  const todayCount = appointments.filter(
    (appointment) => appointment.dateKey === todayKey
  ).length;
  const weekCount = appointments.filter(
    (appointment) =>
      appointment.dateKey >= todayKey && appointment.dateKey <= weekEnd
  ).length;

  const filteredAppointments = useMemo(() => {
    return appointments
      .filter((appointment) => {
        if (scopeFilter === 'today') {
          return appointment.dateKey === todayKey;
        }
        if (scopeFilter === 'week') {
          return (
            appointment.dateKey >= todayKey && appointment.dateKey <= weekEnd
          );
        }
        return true;
      })
      .filter((appointment) => {
        if (!searchQuery) {
          return true;
        }
        const query = searchQuery.toLowerCase();
        return (
          appointment.patient.toLowerCase().includes(query) ||
          (appointment.email || '').toLowerCase().includes(query) ||
          (appointment.phone || '').toLowerCase().includes(query)
        );
      })
      .filter((appointment) => {
        if (!doctorFilter) {
          return true;
        }
        return appointment.doctor === doctorFilter;
      })
      .filter((appointment) => {
        if (!dateFilter) {
          return true;
        }
        return appointment.dateKey === dateFilter;
      })
      .sort((a, b) => {
        if (a.dateKey === b.dateKey) {
          return a.time.localeCompare(b.time);
        }
        return a.dateKey.localeCompare(b.dateKey);
      });
  }, [appointments, scopeFilter, searchQuery, doctorFilter, dateFilter, todayKey, weekEnd]);

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

  const isPrevDisabled =
    monthCursor.getFullYear() === today.getFullYear() &&
    monthCursor.getMonth() === today.getMonth();

  const bookedTimes = useMemo(() => {
    if (!formState.date || !formState.doctor) {
      return [];
    }

    return appointments
      .filter(
        (appointment) =>
          appointment.doctor === formState.doctor &&
          appointment.dateKey === formState.date &&
          appointment.id !== editingId
      )
      .map((appointment) => appointment.time);
  }, [appointments, formState.date, formState.doctor, editingId]);

  useEffect(() => {
    if (formState.time && bookedTimes.includes(formState.time)) {
      setFormState((prev) => ({ ...prev, time: '' }));
    }
  }, [bookedTimes, formState.time]);

  function resetForm(nextDoctor) {
    setMonthCursor(new Date(today.getFullYear(), today.getMonth(), 1));
    setFormState({
      patient: '',
      doctor: nextDoctor || '',
      date: todayKey,
      time: '',
      email: '',
      phone: '',
      notes: '',
    });
  }

  function handleFormChange(field, value) {
    setFormState((prev) => ({ ...prev, [field]: value }));
  }

  function handleFormSubmit(event) {
    event.preventDefault();
    setFormError('');

    if (!formState.patient || !formState.doctor || !formState.date || !formState.time) {
      setFormError('Patient, doctor, date, and time are required.');
      return;
    }

    if (bookedTimes.includes(formState.time)) {
      setFormError('That time is already booked for this doctor.');
      return;
    }

    const specialty =
      doctorOptions.find((doctor) => doctor.name === formState.doctor)
        ?.specialty || 'General Dentistry';
    const reason = formState.notes || 'Appointment created by receptionist';

    if (editingId) {
      setAppointments((prev) =>
        prev.map((appointment) =>
          appointment.id === editingId
            ? {
                ...appointment,
                patient: formState.patient,
                doctor: formState.doctor,
                specialty,
                date: formState.date,
                dateKey: formState.date,
                time: formState.time,
                email: formState.email,
                phone: formState.phone,
                reason,
              }
            : appointment
        )
      );
    } else {
      const newAppointment = normalizeAppointment({
        patient: formState.patient,
        reason,
        status: 'Pending',
        doctor: formState.doctor,
        specialty,
        date: formState.date,
        time: formState.time,
        email: formState.email,
        phone: formState.phone,
        highlight: false,
      });

      setAppointments((prev) => [newAppointment, ...prev]);
    }

    setShowForm(false);
    setEditingId(null);
    resetForm(formState.doctor);
  }

  function handleToggleCompleted(id) {
    setAppointments((prev) =>
      prev.map((appointment) =>
        appointment.id === id
          ? {
              ...appointment,
              status: appointment.status === 'Completed' ? 'Pending' : 'Completed',
            }
          : appointment
      )
    );
  }

  function handleEmail(appointment) {
    if (!appointment.email) {
      window.alert('No email on file for this patient.');
      return;
    }

    window.location.href = `mailto:${appointment.email}`;
  }

  function handleEdit(appointment) {
    setEditingId(appointment.id);
    setShowForm(true);
    setFormState({
      patient: appointment.patient,
      doctor: appointment.doctor,
      date: appointment.dateKey,
      time: appointment.time,
      email: appointment.email || '',
      phone: appointment.phone || '',
      notes: appointment.reason || '',
    });

    const editDate = new Date(`${appointment.dateKey}T00:00:00`);
    setMonthCursor(new Date(editDate.getFullYear(), editDate.getMonth(), 1));
  }

  function handleDelete(id) {
    if (!window.confirm('Delete this appointment?')) {
      return;
    }

    setAppointments((prev) => prev.filter((appointment) => appointment.id !== id));
  }

  return (
    <main className="page admin-page">
      <header className="admin-topbar">
        <div>
          <p className="admin-title">Bright Smile Dental Clinic</p>
          <p className="admin-subtitle">Receptionist Dashboard</p>
        </div>
        <button className="cta admin-cta">Patient View</button>
      </header>

      <section className="stats-grid">
        <button
          type="button"
          className={`stat-card stat-button${scopeFilter === 'all' ? ' active' : ''}`}
          onClick={() => setScopeFilter('all')}
        >
          <p className="stat-label">Total Appointments</p>
          <p className="stat-value">{totalCount}</p>
        </button>
        <button
          type="button"
          className={`stat-card stat-button${scopeFilter === 'today' ? ' active' : ''}`}
          onClick={() => setScopeFilter('today')}
        >
          <p className="stat-label">Today&apos;s Appointments</p>
          <p className="stat-value">{todayCount}</p>
        </button>
        <button
          type="button"
          className={`stat-card stat-button${scopeFilter === 'week' ? ' active' : ''}`}
          onClick={() => setScopeFilter('week')}
        >
          <p className="stat-label">This Week</p>
          <p className="stat-value">{weekCount}</p>
        </button>
        <div className="stat-card">
          <p className="stat-label">Active Doctors</p>
          <p className="stat-value">{activeDoctorCount}</p>
        </div>
      </section>

      <section className="admin-section">
        <div className="admin-section-header">
          <div>
            <p className="eyebrow">Appointment Management</p>
            <h2>Manage incoming visits.</h2>
          </div>
          <button
            className="cta"
            type="button"
            onClick={() => {
              if (!showForm) {
                resetForm(formState.doctor);
              }
              setShowForm((prev) => !prev);
              setEditingId(null);
            }}
          >
            + New Appointment
          </button>
        </div>

        {showForm && (
          <form className="card admin-form" onSubmit={handleFormSubmit}>
            <div className="form-header">
              <h2>{editingId ? 'Edit Appointment' : 'New Appointment'}</h2>
              <p>Capture a booking on behalf of a patient.</p>
            </div>
            <div className="filter-grid">
              <div className="field">
                <label htmlFor="patient">Patient name</label>
                <input
                  id="patient"
                  value={formState.patient}
                  onChange={(event) => handleFormChange('patient', event.target.value)}
                  placeholder="Jordan Smith"
                />
              </div>
              <div className="field">
                <label htmlFor="doctor">Doctor</label>
                <select
                  id="doctor"
                  value={formState.doctor}
                  onChange={(event) => handleFormChange('doctor', event.target.value)}
                >
                  <option value="" disabled>
                    Select a doctor
                  </option>
                  {doctorOptions.map((doctor) => (
                    <option key={doctor.name} value={doctor.name}>
                      {doctor.name} ({doctor.specialty})
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="field">
              <div className="field-heading">
                <label>Choose a date</label>
                <span className="field-hint">Next available dates only</span>
              </div>
              <div className="calendar">
                <div className="calendar-header">
                  <button
                    type="button"
                    className="icon-button"
                    onClick={() =>
                      setMonthCursor(
                        (current) => new Date(current.getFullYear(), current.getMonth() - 1, 1)
                      )
                    }
                    disabled={isPrevDisabled}
                    aria-label="Previous month"
                  >
                    {'<'}
                  </button>
                  <span className="calendar-title">{monthLabel}</span>
                  <button
                    type="button"
                    className="icon-button"
                    onClick={() =>
                      setMonthCursor(
                        (current) => new Date(current.getFullYear(), current.getMonth() + 1, 1)
                      )
                    }
                    aria-label="Next month"
                  >
                    {'>'}
                  </button>
                </div>
                <div className="calendar-grid calendar-weekdays">
                  {weekdayLabels.map((label) => (
                    <span key={label} className="weekday">
                      {label}
                    </span>
                  ))}
                </div>
                <div className="calendar-grid">
                  {monthGrid.map((slot, index) => {
                    if (!slot) {
                      return <div key={`blank-${index}`} className="calendar-blank" />;
                    }

                    const isSelected = formState.date === slot.key;

                    return (
                      <button
                        type="button"
                        key={slot.key}
                        className={`calendar-day${isSelected ? ' selected' : ''}`}
                        onClick={() => handleFormChange('date', slot.key)}
                        disabled={slot.isPast}
                      >
                        {slot.day}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="field">
              <div className="field-heading">
                <label>Choose a time</label>
                <span className="field-hint">9:00 AM - 4:00 PM, 30 min slots</span>
              </div>
              {!formState.doctor && (
                <p className="inline-hint">Select a doctor to see availability.</p>
              )}
              {formError && <p className="inline-hint error">{formError}</p>}
              <div className="time-grid">
                {timeSlots.map((slot) => {
                  const isTaken = bookedTimes.includes(slot.value);
                  const isDisabled = !formState.doctor || isTaken;

                  return (
                    <button
                      type="button"
                      key={slot.value}
                      className={`slot-button time-slot${
                        formState.time === slot.value ? ' selected' : ''
                      }${isTaken ? ' taken' : ''}`}
                      onClick={() => handleFormChange('time', slot.value)}
                      disabled={isDisabled}
                    >
                      {slot.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="filter-grid">
              <div className="field">
                <label htmlFor="email">Email (optional)</label>
                <input
                  id="email"
                  type="email"
                  value={formState.email}
                  onChange={(event) => handleFormChange('email', event.target.value)}
                  placeholder="patient@email.com"
                />
              </div>
              <div className="field">
                <label htmlFor="phone">Phone (optional)</label>
                <input
                  id="phone"
                  value={formState.phone}
                  onChange={(event) => handleFormChange('phone', event.target.value)}
                  placeholder="+1 (555) 000-0000"
                />
              </div>
              <div className="field">
                <label htmlFor="notes">Notes (optional)</label>
                <input
                  id="notes"
                  value={formState.notes}
                  onChange={(event) => handleFormChange('notes', event.target.value)}
                  placeholder="Any important context"
                />
              </div>
            </div>
            <div className="form-actions">
              <button
                type="button"
                className="ghost"
                onClick={() => {
                  setShowForm(false);
                  setEditingId(null);
                  setFormError('');
                }}
              >
                Cancel
              </button>
              <button type="submit" className="cta">
                {editingId ? 'Update appointment' : 'Create appointment'}
              </button>
            </div>
          </form>
        )}

        <div className="card filter-card">
          <div className="filter-header">
            <span className="filter-title">Filter Appointments</span>
          </div>
          <div className="filter-grid">
            <div className="field">
              <label htmlFor="search">Search patient</label>
              <input
                id="search"
                placeholder="Name, email, or phone"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="doctorFilter">Filter by doctor</label>
              <select
                id="doctorFilter"
                value={doctorFilter}
                onChange={(event) => setDoctorFilter(event.target.value)}
              >
                <option value="">All doctors</option>
                {doctorOptions.map((doctor) => (
                  <option key={doctor.name} value={doctor.name}>
                    {doctor.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="dateFilter">Filter by date</label>
              <input
                id="dateFilter"
                type="date"
                value={dateFilter}
                onChange={(event) => setDateFilter(event.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="card appointment-table">
          <div className="table-head">
            <span>Patient</span>
            <span>Doctor</span>
            <span>Date & Time</span>
            <span>Contact</span>
            <span>Actions</span>
          </div>
          {filteredAppointments.length === 0 && (
            <div className="table-row empty">
              <p className="row-title">No appointments match the filters.</p>
            </div>
          )}
          {filteredAppointments.map((appointment) => (
            <div
              key={appointment.id}
              className={`table-row${appointment.highlight ? ' highlight' : ''}`}
            >
              <div>
                <p className="row-title">
                  {appointment.patient}
                  {appointment.status === 'Completed' && (
                    <span className="badge">Completed</span>
                  )}
                </p>
                <p className="row-subtitle">{appointment.reason}</p>
              </div>
              <div>
                <p className="row-title">{appointment.doctor}</p>
                <p className="row-subtitle">{appointment.specialty}</p>
              </div>
              <div>
                <p className="row-title">
                  {formatDisplayDate(appointment.dateKey)}
                </p>
                <p className="row-subtitle">{appointment.time}</p>
              </div>
              <div>
                <p className="row-title">{appointment.email || '—'}</p>
                <p className="row-subtitle">{appointment.phone || '—'}</p>
              </div>
              <div className="actions-grid">
                <button
                  type="button"
                  className="icon-pill"
                  aria-label="Mark completed"
                  onClick={() => handleToggleCompleted(appointment.id)}
                >
                  <img src="/icons/check.svg" alt="" />
                  Done
                </button>
                <button
                  type="button"
                  className="icon-pill"
                  aria-label="Send email"
                  onClick={() => handleEmail(appointment)}
                >
                  <img src="/icons/mail.svg" alt="" />
                  Email
                </button>
                <button
                  type="button"
                  className="icon-pill"
                  aria-label="Edit appointment"
                  onClick={() => handleEdit(appointment)}
                >
                  <img src="/icons/edit.svg" alt="" />
                  Edit
                </button>
                <button
                  type="button"
                  className="icon-pill danger"
                  aria-label="Delete appointment"
                  onClick={() => handleDelete(appointment.id)}
                >
                  <img src="/icons/trash.svg" alt="" />
                  Del
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
