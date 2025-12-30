'use client';

import { useEffect, useMemo, useState } from 'react';

import LanguageSwitcher from './LanguageSwitcher';
import { useI18n } from './I18nProvider';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
function formatDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDisplayDate(dateKey, localeTag) {
  const date = new Date(`${dateKey}T00:00:00`);
  return date.toLocaleDateString(localeTag || 'en-US', {
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
    reason: raw.notes || '',
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

function getClinicDomain() {
  if (typeof window === 'undefined') {
    return process.env.NEXT_PUBLIC_CLINIC_DOMAIN || '';
  }

  return process.env.NEXT_PUBLIC_CLINIC_DOMAIN || window.location.hostname;
}

export default function AdminPage() {
  const { t, localeTag } = useI18n();
  const today = useMemo(() => new Date(), []);
  const todayKey = useMemo(() => formatDateKey(today), [today]);
  const [authToken, setAuthToken] = useState('');
  const [authReady, setAuthReady] = useState(false);
  const [loginForm, setLoginForm] = useState({
    clinicName: '',
    username: '',
    password: '',
  });
  const [loginError, setLoginError] = useState('');
  const [activePanel, setActivePanel] = useState('appointments');
  const [appointments, setAppointments] = useState([]);
  const [clinicName, setClinicName] = useState('');
  const [clinicLogo, setClinicLogo] = useState('');
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [uploadState, setUploadState] = useState({
    doctorId: '',
    file: null,
    preview: '',
    status: '',
    error: '',
  });
  const [logoUploadState, setLogoUploadState] = useState({
    file: null,
    preview: '',
    status: '',
    error: '',
  });
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
  const weekdayLabels = useMemo(
    () => [
      t('weekday_sun'),
      t('weekday_mon'),
      t('weekday_tue'),
      t('weekday_wed'),
      t('weekday_thu'),
      t('weekday_fri'),
      t('weekday_sat'),
    ],
    [t]
  );

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
      monthCursor.toLocaleDateString(localeTag, {
        month: 'long',
        year: 'numeric',
      }),
    [monthCursor, localeTag]
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
    const storedToken = window.localStorage.getItem('adminToken') || '';
    setAuthToken(storedToken);
    setAuthReady(true);
  }, []);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setLoadError('');

      try {
        const clinicDomain = getClinicDomain();
        const headers = {
          'x-clinic-domain': clinicDomain,
        };

        const [appointmentsResponse, doctorsResponse] = await Promise.all([
          fetch(`${API_BASE}/appointments`, { headers }),
          fetch(`${API_BASE}/doctors`, { headers }),
        ]);

        if (!appointmentsResponse.ok) {
          throw new Error(
            t('request_failed', { status: appointmentsResponse.status })
          );
        }

        if (!doctorsResponse.ok) {
          throw new Error(t('request_failed', { status: doctorsResponse.status }));
        }

        const appointmentsData = await appointmentsResponse.json();
        const doctorsData = await doctorsResponse.json();

        const resolvedClinic = appointmentsData.clinic || doctorsData.clinic || null;
        setClinicName(resolvedClinic?.name || '');
        setClinicLogo(resolvedClinic?.logo || '');
        setAppointments((appointmentsData.appointments || []).map(normalizeAppointment));
        setDoctors(doctorsData.doctors || []);
        setLoading(false);
      } catch (error) {
        setLoadError(error?.message || t('admin_load_error'));
        setLoading(false);
      }
    }

    if (authToken) {
      loadData();
    }
  }, [authToken, t]);

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
      setFormError(t('admin_form_required_error'));
      return;
    }

    if (bookedTimes.includes(formState.time)) {
      setFormError(t('admin_time_taken'));
      return;
    }

    try {
      const clinicDomain = getClinicDomain();
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
        'x-clinic-domain': clinicDomain,
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
        throw new Error(errorData.error || t('admin_save_error'));
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
      setFormError(error?.message || t('admin_save_error'));
    }
  }

  async function handleToggleCompleted(appointment) {
    try {
      const response = await fetch(`${API_BASE}/appointments/${appointment.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-clinic-domain': getClinicDomain(),
        },
        body: JSON.stringify({ completed: !appointment.completed }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || t('admin_update_error'));
      }

      const data = await response.json();
      const updated = normalizeAppointment(data.appointment);

      setAppointments((prev) =>
        prev.map((item) => (item.id === appointment.id ? updated : item))
      );
    } catch (error) {
      window.alert(error?.message || t('admin_update_error'));
    }
  }

  function handleEmail(appointment) {
    if (!appointment.email) {
      window.alert(t('admin_email_missing'));
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
    if (!window.confirm(t('admin_delete_confirm'))) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/appointments/${appointment.id}`, {
        method: 'DELETE',
        headers: {
          'x-clinic-domain': getClinicDomain(),
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || t('admin_delete_error'));
      }

      setAppointments((prev) =>
        prev.filter((item) => item.id !== appointment.id)
      );
    } catch (error) {
      window.alert(error?.message || t('admin_delete_error'));
    }
  }

  async function handleLoginSubmit(event) {
    event.preventDefault();
    setLoginError('');

    if (!loginForm.clinicName || !loginForm.username || !loginForm.password) {
      setLoginError(t('admin_login_required_error'));
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-clinic-domain': getClinicDomain(),
        },
        body: JSON.stringify({
          clinicName: loginForm.clinicName,
          username: loginForm.username,
          password: loginForm.password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || t('admin_sign_in_error'));
      }

      window.localStorage.setItem('adminToken', data.token);
      setAuthToken(data.token);
      setLoginForm({ clinicName: '', username: '', password: '' });
    } catch (error) {
      setLoginError(error?.message || t('admin_sign_in_error'));
    }
  }

  function handleLogout() {
    window.localStorage.removeItem('adminToken');
    setAuthToken('');
    setAppointments([]);
    setDoctors([]);
    setClinicLogo('');
  }

  async function handleAvatarUpload(event) {
    event.preventDefault();
    setUploadState((prev) => ({ ...prev, status: '', error: '' }));

    if (!uploadState.doctorId || !uploadState.file) {
      setUploadState((prev) => ({
        ...prev,
        error: t('admin_avatar_missing'),
      }));
      return;
    }

    try {
      const formData = new FormData();
      formData.append('doctorId', uploadState.doctorId);
      formData.append('image', uploadState.file);

      const response = await fetch(`${API_BASE}/uploads/doctor-avatar`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'x-clinic-domain': getClinicDomain(),
        },
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || t('admin_avatar_error'));
      }

      setDoctors((prev) =>
        prev.map((doctor) =>
          doctor.id === data.doctor.id
            ? { ...doctor, avatar: data.doctor.avatar }
            : doctor
        )
      );
      setUploadState((prev) => ({
        ...prev,
        status: t('admin_avatar_success'),
        error: '',
        preview: data.url,
      }));
    } catch (error) {
      setUploadState((prev) => ({
        ...prev,
        error: error?.message || t('admin_avatar_error'),
      }));
    }
  }

  async function handleLogoUpload(event) {
    event.preventDefault();
    setLogoUploadState((prev) => ({ ...prev, status: '', error: '' }));

    if (!logoUploadState.file) {
      setLogoUploadState((prev) => ({
        ...prev,
        error: t('admin_logo_missing'),
      }));
      return;
    }

    try {
      const formData = new FormData();
      formData.append('image', logoUploadState.file);

      const response = await fetch(`${API_BASE}/uploads/clinic-logo`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'x-clinic-domain': getClinicDomain(),
        },
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || t('admin_logo_error'));
      }

      setClinicLogo(data.clinic?.logo || data.url || '');
      setLogoUploadState((prev) => ({
        ...prev,
        status: t('admin_logo_success'),
        error: '',
        preview: data.url,
      }));
    } catch (error) {
      setLogoUploadState((prev) => ({
        ...prev,
        error: error?.message || t('admin_logo_error'),
      }));
    }
  }

  if (!authReady) {
    return (
      <main className="page admin-page">
        <p className="status">{t('admin_checking')}</p>
      </main>
    );
  }

  if (!authToken) {
    return (
      <main className="page admin-page">
        <div className="admin-language-bar">
          <LanguageSwitcher />
        </div>
        <div className="card login-card">
          <div className="form-header">
            <h2>{t('admin_sign_in')}</h2>
            <p>{t('admin_sign_in_subtitle')}</p>
          </div>
          <form className="login-form" onSubmit={handleLoginSubmit}>
            <div className="field">
              <label htmlFor="clinicName">{t('admin_clinic_name_label')}</label>
              <input
                id="clinicName"
                value={loginForm.clinicName}
                onChange={(event) =>
                  setLoginForm((prev) => ({ ...prev, clinicName: event.target.value }))
                }
                placeholder="Viva Dent"
              />
            </div>
            <div className="field">
              <label htmlFor="username">{t('admin_username_label')}</label>
              <input
                id="username"
                value={loginForm.username}
                onChange={(event) =>
                  setLoginForm((prev) => ({ ...prev, username: event.target.value }))
                }
                placeholder="dr.sarah"
              />
            </div>
            <div className="field">
              <label htmlFor="password">{t('admin_password_label')}</label>
              <input
                id="password"
                type="password"
                value={loginForm.password}
                onChange={(event) =>
                  setLoginForm((prev) => ({ ...prev, password: event.target.value }))
                }
              />
            </div>
            {loginError && <p className="status error">{loginError}</p>}
            <button className="cta full" type="submit">
              {t('admin_sign_in_button')}
            </button>
          </form>
        </div>
      </main>
    );
  }

  return (
    <main className="page admin-page">
      <header className="admin-topbar">
        <div>
          <p className="admin-title">{clinicName || t('brand_title_fallback')}</p>
          <p className="admin-subtitle">{t('admin_dashboard_title')}</p>
        </div>
        <div className="admin-actions">
          <LanguageSwitcher />
          <button type="button" className="ghost" onClick={handleLogout}>
            {t('admin_logout')}
          </button>
        </div>
      </header>

      <nav className="admin-nav">
        <button
          type="button"
          className={activePanel === 'appointments' ? 'active' : ''}
          onClick={() => setActivePanel('appointments')}
        >
          {t('admin_tab_appointments')}
        </button>
        <button
          type="button"
          className={activePanel === 'settings' ? 'active' : ''}
          onClick={() => setActivePanel('settings')}
        >
          {t('admin_tab_settings')}
        </button>
      </nav>

      {activePanel === 'appointments' && (
        <>
          <section className="stats-grid">
            <button
              type="button"
              className={`stat-card stat-button${scopeFilter === 'all' ? ' active' : ''}`}
              onClick={() => setScopeFilter('all')}
            >
              <p className="stat-label">{t('admin_total_appointments')}</p>
              <p className="stat-value">{totalCount}</p>
            </button>
            <button
              type="button"
              className={`stat-card stat-button${scopeFilter === 'today' ? ' active' : ''}`}
              onClick={() => setScopeFilter('today')}
            >
              <p className="stat-label">{t('admin_today_appointments')}</p>
              <p className="stat-value">{todayCount}</p>
            </button>
            <button
              type="button"
              className={`stat-card stat-button${scopeFilter === 'week' ? ' active' : ''}`}
              onClick={() => setScopeFilter('week')}
            >
              <p className="stat-label">{t('admin_week_appointments')}</p>
              <p className="stat-value">{weekCount}</p>
            </button>
            <div className="stat-card">
              <p className="stat-label">{t('admin_active_doctors')}</p>
              <p className="stat-value">{activeDoctorCount}</p>
            </div>
          </section>

          <section className="admin-section">
            <div className="admin-section-header">
              <div>
                <p className="eyebrow">{t('admin_appointment_management')}</p>
                <h2>{t('admin_manage_visits')}</h2>
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
                + {t('admin_new_appointment')}
              </button>
            </div>

            {showForm && (
              <form className="card admin-form" onSubmit={handleFormSubmit}>
                <div className="form-header">
                  <h2>
                    {editingId
                      ? t('admin_edit_appointment_title')
                      : t('admin_new_appointment_title')}
                  </h2>
                  <p>{t('admin_booking_help')}</p>
                </div>
                <div className="filter-grid">
                  <div className="field">
                    <label htmlFor="patient">{t('admin_patient_name_label')}</label>
                    <input
                      id="patient"
                      value={formState.patient}
                      onChange={(event) => handleFormChange('patient', event.target.value)}
                      placeholder={t('admin_patient_placeholder')}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="doctor">{t('admin_doctor_label')}</label>
                    <select
                      id="doctor"
                      value={formState.doctorId}
                      onChange={(event) => handleFormChange('doctorId', event.target.value)}
                    >
                      <option value="" disabled>
                        {t('admin_select_doctor')}
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
                    <label>{t('admin_choose_date')}</label>
                    <span className="field-hint">{t('admin_date_hint')}</span>
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
                        aria-label={t('prev_month')}
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
                        aria-label={t('next_month')}
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
                    <label>{t('admin_choose_time')}</label>
                    <span className="field-hint">{t('admin_time_hint')}</span>
                  </div>
                  {!formState.doctorId && (
                    <p className="inline-hint">{t('admin_select_doctor_hint')}</p>
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
                    <label htmlFor="email">{t('admin_email_optional')}</label>
                    <input
                      id="email"
                      type="email"
                      value={formState.email}
                      onChange={(event) => handleFormChange('email', event.target.value)}
                      placeholder={t('admin_email_placeholder')}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="phone">{t('admin_phone_optional')}</label>
                    <input
                      id="phone"
                      value={formState.phone}
                      onChange={(event) => handleFormChange('phone', event.target.value)}
                      placeholder={t('admin_phone_placeholder')}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="notes">{t('admin_notes_optional')}</label>
                    <input
                      id="notes"
                      value={formState.notes}
                      onChange={(event) => handleFormChange('notes', event.target.value)}
                      placeholder={t('admin_notes_placeholder')}
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
                    {t('admin_cancel')}
                  </button>
                  <button type="submit" className="cta">
                    {editingId
                      ? t('admin_update_appointment')
                      : t('admin_create_appointment')}
                  </button>
                </div>
              </form>
            )}

            <div className="card filter-card">
              <div className="filter-header">
                <span className="filter-title">{t('admin_filter_title')}</span>
              </div>
              <div className="filter-grid">
                <div className="field">
                  <label htmlFor="search">{t('admin_search_patient')}</label>
                  <input
                    id="search"
                    placeholder={t('admin_search_placeholder')}
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="doctorFilter">{t('admin_filter_doctor')}</label>
                  <select
                    id="doctorFilter"
                    value={doctorFilter}
                    onChange={(event) => setDoctorFilter(event.target.value)}
                  >
                    <option value="">{t('admin_all_doctors')}</option>
                    {doctorOptions.map((doctor) => (
                      <option key={doctor.id} value={doctor.id}>
                        {doctor.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="dateFilter">{t('admin_filter_date')}</label>
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
                <span>{t('admin_table_patient')}</span>
                <span>{t('admin_table_doctor')}</span>
                <span>{t('admin_table_date')}</span>
                <span>{t('admin_table_contact')}</span>
                <span>{t('admin_table_actions')}</span>
              </div>
              {loading && (
                <div className="table-row empty">
                  <p className="row-title">{t('admin_loading_appointments')}</p>
                </div>
              )}
              {!loading && loadError && (
                <div className="table-row empty">
                  <p className="row-title">{loadError}</p>
                </div>
              )}
              {!loading && !loadError && filteredAppointments.length === 0 && (
                <div className="table-row empty">
                  <p className="row-title">{t('admin_no_matches')}</p>
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
                          <span className="badge">{t('admin_badge_completed')}</span>
                        )}
                      </p>
                      <p className="row-subtitle">
                        {appointment.reason || t('appointment_default_reason')}
                      </p>
                    </div>
                    <div>
                      <p className="row-title">{appointment.doctor}</p>
                      <p className="row-subtitle">{appointment.specialty}</p>
                    </div>
                    <div>
                      <p className="row-title">
                        {formatDisplayDate(appointment.dateKey, localeTag)}
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
                        aria-label={t('admin_action_toggle')}
                        onClick={() => handleToggleCompleted(appointment)}
                      >
                        <img src="/icons/check.svg" alt="" />
                        {appointment.completed ? t('admin_undo') : t('admin_done')}
                      </button>
                      <button
                        type="button"
                        className="icon-pill"
                        aria-label={t('admin_action_email')}
                        onClick={() => handleEmail(appointment)}
                      >
                        <img src="/icons/mail.svg" alt="" />
                        {t('admin_action_email_label')}
                      </button>
                      <button
                        type="button"
                        className="icon-pill"
                        aria-label={t('admin_action_edit')}
                        onClick={() => handleEdit(appointment)}
                      >
                        <img src="/icons/edit.svg" alt="" />
                        {t('admin_action_edit_label')}
                      </button>
                      <button
                        type="button"
                        className="icon-pill danger"
                        aria-label={t('admin_action_delete')}
                        onClick={() => handleDelete(appointment)}
                      >
                        <img src="/icons/trash.svg" alt="" />
                        {t('admin_action_delete_label')}
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          </section>
        </>
      )}

      {activePanel === 'settings' && (
        <section className="admin-section">
          <div className="admin-section-header">
            <div>
              <p className="eyebrow">{t('admin_settings_title')}</p>
              <h2>{t('admin_settings_subtitle')}</h2>
            </div>
          </div>

          <div className="card upload-card">
            <div className="upload-header">
              <div>
                <p className="row-title">{t('admin_logo_title')}</p>
                <p className="row-subtitle">{t('admin_logo_subtitle')}</p>
              </div>
              {(logoUploadState.preview || clinicLogo) && (
                <img
                  src={logoUploadState.preview || clinicLogo}
                  alt={t('admin_logo_title')}
                  className="upload-preview"
                />
              )}
            </div>
            <form className="upload-form" onSubmit={handleLogoUpload}>
              <div className="field">
                <label htmlFor="clinicLogo">{t('admin_logo_label')}</label>
                <input
                  id="clinicLogo"
                  type="file"
                  accept="image/*"
                  onChange={(event) => {
                    const file = event.target.files?.[0] || null;
                    const preview = file ? URL.createObjectURL(file) : '';
                    setLogoUploadState((prev) => ({
                      ...prev,
                      file,
                      preview,
                      error: '',
                      status: '',
                    }));
                  }}
                />
              </div>
              <button className="cta" type="submit">
                {t('admin_logo_button')}
              </button>
              {logoUploadState.status && (
                <p className="status success">{logoUploadState.status}</p>
              )}
              {logoUploadState.error && (
                <p className="status error">{logoUploadState.error}</p>
              )}
            </form>
          </div>

          <div className="card upload-card">
            <div className="upload-header">
              <div>
                <p className="row-title">{t('admin_avatar_title')}</p>
                <p className="row-subtitle">{t('admin_avatar_subtitle')}</p>
              </div>
              {uploadState.preview && (
                <img
                  src={uploadState.preview}
                  alt={t('admin_avatar_title')}
                  className="upload-preview"
                />
              )}
            </div>
            <form className="upload-form" onSubmit={handleAvatarUpload}>
              <div className="field">
                <label htmlFor="avatarDoctor">{t('admin_avatar_doctor_label')}</label>
                <select
                  id="avatarDoctor"
                  value={uploadState.doctorId}
                  onChange={(event) =>
                    setUploadState((prev) => ({
                      ...prev,
                      doctorId: event.target.value,
                      error: '',
                      status: '',
                    }))
                  }
                >
                  <option value="">{t('admin_select_doctor')}</option>
                  {doctorOptions.map((doctor) => (
                    <option key={doctor.id} value={doctor.id}>
                      {doctor.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="avatarFile">{t('admin_avatar_image_label')}</label>
                <input
                  id="avatarFile"
                  type="file"
                  accept="image/*"
                  onChange={(event) => {
                    const file = event.target.files?.[0] || null;
                    const preview = file ? URL.createObjectURL(file) : '';
                    setUploadState((prev) => ({
                      ...prev,
                      file,
                      preview,
                      error: '',
                      status: '',
                    }));
                  }}
                />
              </div>
              <button type="submit" className="cta">
                {t('admin_avatar_button')}
              </button>
            </form>
            {uploadState.error && <p className="status error">{uploadState.error}</p>}
            {uploadState.status && <p className="status">{uploadState.status}</p>}
          </div>
        </section>
      )}
    </main>
  );
}
