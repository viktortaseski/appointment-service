'use client';

import { useEffect, useMemo, useState } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
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

function normalizeTime(value) {
  if (!value) {
    return '';
  }

  return value.slice(0, 5);
}

function normalizeAppointment(raw) {
  const dateKey = typeof raw.date === 'string'
    ? raw.date.slice(0, 10)
    : formatDateKey(new Date(raw.date));

  return {
    id: raw.id,
    doctorId: raw.doctor_id,
    doctor: raw.doctor_name,
    specialty: raw.doctor_specialty,
    patient: raw.patient_name,
    email: raw.patient_email,
    phone: raw.patient_phone,
    reason: raw.notes || 'Appointment',
    dateKey,
    time: normalizeTime(raw.time),
    completed: Boolean(raw.completed),
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

export default function AdminPage() {
  const today = useMemo(() => new Date(), []);
  const todayKey = useMemo(() => formatDateKey(today), [today]);
  const [appointments, setAppointments] = useState([]);
  const [clinicName, setClinicName] = useState('');
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [scopeFilter, setScopeFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [doctorFilter, setDoctorFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formState, setFormState] = useState({
    patient: '',
    doctorId: '',
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

  const doctorOptions = useMemo(() => doctors, [doctors]);

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
        return appointment.doctorId === doctorFilter;
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
    if (!formState.date || !formState.doctorId) {
      return [];
    }

    return appointments
      .filter(
        (appointment) =>
          appointment.doctorId === formState.doctorId &&
          appointment.dateKey === formState.date &&
          appointment.id !== editingId
      )
      .map((appointment) => appointment.time);
  }, [appointments, formState.date, formState.doctorId, editingId]);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setLoadError('');

      try {
        const headers = {
          'x-clinic-domain': window.location.hostname,
        };

        const [appointmentsResponse, doctorsResponse] = await Promise.all([
          fetch(`${API_BASE}/appointments`, { headers }),
          fetch(`${API_BASE}/doctors`, { headers }),
        ]);

        if (!appointmentsResponse.ok) {
          throw new Error(`Appointments request failed (${appointmentsResponse.status}).`);
        }

        if (!doctorsResponse.ok) {
          throw new Error(`Doctors request failed (${doctorsResponse.status}).`);
        }

        const appointmentsData = await appointmentsResponse.json();
        const doctorsData = await doctorsResponse.json();

        setClinicName(appointmentsData.clinic?.name || doctorsData.clinic?.name || '');
        setAppointments((appointmentsData.appointments || []).map(normalizeAppointment));
        setDoctors(doctorsData.doctors || []);
        setLoading(false);
      } catch (error) {
        setLoadError(error?.message || 'Unable to load appointments.');
        setLoading(false);
      }
    }

    loadData();
  }, []);

  useEffect(() => {
    if (formState.time && bookedTimes.includes(formState.time)) {
      setFormState((prev) => ({ ...prev, time: '' }));
    }
  }, [bookedTimes, formState.time]);

  function resetForm(doctorId) {
    setMonthCursor(new Date(today.getFullYear(), today.getMonth(), 1));
    setFormState({
      patient: '',
      doctorId: doctorId || '',
      date: todayKey,
      time: '',
      email: '',
      phone: '',
      notes: '',
    });
    setFormError('');
  }

  function handleFormChange(field, value) {
    setFormState((prev) => ({ ...prev, [field]: value }));
  }

  async function handleFormSubmit(event) {
    event.preventDefault();
    setFormError('');

    if (!formState.patient || !formState.doctorId || !formState.date || !formState.time) {
      setFormError('Patient, doctor, date, and time are required.');
      return;
    }

    if (bookedTimes.includes(formState.time)) {
      setFormError('That time is already booked for this doctor.');
      return;
    }

    try {
      const payload = {
        doctor_id: formState.doctorId,
        patient_name: formState.patient,
        patient_email: formState.email || '',
        patient_phone: formState.phone || '',
        date: formState.date,
        time: formState.time,
        notes: formState.notes || null,
      };

      const headers = {
        'Content-Type': 'application/json',
        'x-clinic-domain': window.location.hostname,
      };

      const response = await fetch(
        `${API_BASE}/appointments${editingId ? `/${editingId}` : ''}`,
        {
          method: editingId ? 'PUT' : 'POST',
          headers,
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Unable to save appointment.');
      }

      const data = await response.json();
      const updated = normalizeAppointment(data.appointment);

      setAppointments((prev) => {
        if (editingId) {
          return prev.map((appointment) =>
            appointment.id === editingId ? updated : appointment
          );
        }

        return [updated, ...prev];
      });

      setShowForm(false);
      setEditingId(null);
      resetForm(formState.doctorId);
    } catch (error) {
      setFormError(error?.message || 'Unable to save appointment.');
    }
  }

  async function handleToggleCompleted(appointment) {
    try {
      const response = await fetch(`${API_BASE}/appointments/${appointment.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-clinic-domain': window.location.hostname,
        },
        body: JSON.stringify({ completed: !appointment.completed }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Unable to update appointment.');
      }

      const data = await response.json();
      const updated = normalizeAppointment(data.appointment);

      setAppointments((prev) =>
        prev.map((item) => (item.id === appointment.id ? updated : item))
      );
    } catch (error) {
      window.alert(error?.message || 'Unable to update appointment.');
    }
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
      doctorId: appointment.doctorId,
      date: appointment.dateKey,
      time: appointment.time,
      email: appointment.email || '',
      phone: appointment.phone || '',
      notes: appointment.reason || '',
    });

    const editDate = new Date(`${appointment.dateKey}T00:00:00`);
    setMonthCursor(new Date(editDate.getFullYear(), editDate.getMonth(), 1));
  }

  async function handleDelete(appointment) {
    if (!window.confirm('Delete this appointment?')) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/appointments/${appointment.id}`, {
        method: 'DELETE',
        headers: {
          'x-clinic-domain': window.location.hostname,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Unable to delete appointment.');
      }

      setAppointments((prev) =>
        prev.filter((item) => item.id !== appointment.id)
      );
    } catch (error) {
      window.alert(error?.message || 'Unable to delete appointment.');
    }
  }

  return (
    <main className="page admin-page">
      <header className="admin-topbar">
        <div>
          <p className="admin-title">{clinicName || 'Dental Clinic'}</p>
          <p className="admin-subtitle">Receptionist Dashboard</p>
        </div>
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
                resetForm(formState.doctorId);
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
                  value={formState.doctorId}
                  onChange={(event) => handleFormChange('doctorId', event.target.value)}
                >
                  <option value="" disabled>
                    Select a doctor
                  </option>
                  {doctorOptions.map((doctor) => (
                    <option key={doctor.id} value={doctor.id}>
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
              {!formState.doctorId && (
                <p className="inline-hint">Select a doctor to see availability.</p>
              )}
              {formError && <p className="inline-hint error">{formError}</p>}
              <div className="time-grid">
                {timeSlots.map((slot) => {
                  const isTaken = bookedTimes.includes(slot.value);
                  const isDisabled = !formState.doctorId || isTaken;

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
                  <option key={doctor.id} value={doctor.id}>
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
          {loading && (
            <div className="table-row empty">
              <p className="row-title">Loading appointments...</p>
            </div>
          )}
          {!loading && loadError && (
            <div className="table-row empty">
              <p className="row-title">{loadError}</p>
            </div>
          )}
          {!loading && !loadError && filteredAppointments.length === 0 && (
            <div className="table-row empty">
              <p className="row-title">No appointments match the filters.</p>
            </div>
          )}
          {!loading && !loadError &&
            filteredAppointments.map((appointment) => (
              <div
                key={appointment.id}
                className={`table-row${appointment.completed ? ' completed' : ''}`}
              >
                <div>
                  <p className="row-title">
                    {appointment.patient}
                    {appointment.completed && (
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
                    aria-label="Toggle completed"
                    onClick={() => handleToggleCompleted(appointment)}
                  >
                    <img src="/icons/check.svg" alt="" />
                    {appointment.completed ? 'Undo' : 'Done'}
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
                    onClick={() => handleDelete(appointment)}
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
