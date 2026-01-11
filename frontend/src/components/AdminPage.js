'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import LanguageSwitcher from './LanguageSwitcher';
import { useI18n } from './I18nProvider';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api';
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

function getClinicDomain() {
  if (typeof window === 'undefined') {
    return process.env.NEXT_PUBLIC_CLINIC_DOMAIN || '';
  }

  return process.env.NEXT_PUBLIC_CLINIC_DOMAIN || window.location.hostname;
}

function AdminPageContent() {
  const { t, localeTag, setLocale } = useI18n();
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
  const [clinicDisabled, setClinicDisabled] = useState(false);
  const [clinicStatus, setClinicStatus] = useState({ status: '', error: '' });
  const [clinicSchedule, setClinicSchedule] = useState({
    opensAt: '09:00',
    closesAt: '16:00',
    slotMinutes: 30,
  });
  const [settingsPanel, setSettingsPanel] = useState('clinic');
  const [scheduleStatus, setScheduleStatus] = useState({ status: '', error: '' });
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
  const [availabilityRecords, setAvailabilityRecords] = useState([]);
  const [availabilityForm, setAvailabilityForm] = useState({
    doctorId: '',
    startDate: '',
    endDate: '',
    startTime: '',
    endTime: '',
  });
  const [availabilityStatus, setAvailabilityStatus] = useState({
    status: '',
    error: '',
  });
  const [doctorForm, setDoctorForm] = useState({
    doctorId: '',
    name: '',
    username: '',
    specialty: '',
    description: '',
    password: '',
    isDisabled: false,
  });
  const [doctorFormStatus, setDoctorFormStatus] = useState({
    status: '',
    error: '',
  });
  const [patients, setPatients] = useState([]);
  const [patientsStatus, setPatientsStatus] = useState({ loading: false, error: '' });
  const [patientSearch, setPatientSearch] = useState('');
  const [blockedTimes, setBlockedTimes] = useState({
    loading: false,
    error: '',
    times: [],
  });
  const [scopeFilter, setScopeFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [doctorFilter, setDoctorFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [appointmentsView, setAppointmentsView] = useState('list');
  const [selectedAppointmentId, setSelectedAppointmentId] = useState(null);
  const [selectedAppointmentIds, setSelectedAppointmentIds] = useState(() => new Set());
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
  const selectAllRef = useRef(null);
  const [calendarCursor, setCalendarCursor] = useState(
    () => new Date(today.getFullYear(), today.getMonth(), 1)
  );

  const timeSlots = useMemo(
    () =>
      buildTimeSlots(
        clinicSchedule.opensAt,
        clinicSchedule.closesAt,
        clinicSchedule.slotMinutes
      ),
    [clinicSchedule]
  );
  const scheduleStartLabel = formatTimeDisplay(clinicSchedule.opensAt, localeTag);
  const scheduleEndLabel = formatTimeDisplay(clinicSchedule.closesAt, localeTag);
  const scheduleTimeHint = t('admin_time_hint', {
    start: scheduleStartLabel,
    end: scheduleEndLabel,
    interval: clinicSchedule.slotMinutes || 30,
  });
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

  const allFilteredSelected =
    filteredAppointments.length > 0 &&
    filteredAppointments.every((appointment) => selectedAppointmentIds.has(appointment.id));
  const someFilteredSelected =
    filteredAppointments.some((appointment) => selectedAppointmentIds.has(appointment.id)) &&
    !allFilteredSelected;

  const appointmentsByDate = useMemo(() => {
    const map = new Map();
    filteredAppointments.forEach((appointment) => {
      if (!map.has(appointment.dateKey)) {
        map.set(appointment.dateKey, []);
      }
      map.get(appointment.dateKey).push(appointment);
    });
    map.forEach((items) => items.sort((a, b) => a.time.localeCompare(b.time)));
    return map;
  }, [filteredAppointments]);

  const selectedAppointment = useMemo(() => {
    if (!selectedAppointmentId) {
      return null;
    }
    return appointments.find((appointment) => appointment.id === selectedAppointmentId) || null;
  }, [appointments, selectedAppointmentId]);

  const filteredPatients = useMemo(() => {
    if (!patientSearch) {
      return patients;
    }

    const query = patientSearch.toLowerCase();
    return patients.filter((patient) =>
      (patient.name || '').toLowerCase().includes(query)
    );
  }, [patients, patientSearch]);

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

  const calendarGrid = useMemo(
    () =>
      buildMonthGrid(calendarCursor).map((slot) =>
        slot ? { ...slot, isPast: slot.key < todayKey } : slot
      ),
    [calendarCursor, todayKey]
  );

  const calendarLabel = useMemo(
    () =>
      calendarCursor.toLocaleDateString(localeTag, {
        month: 'long',
        year: 'numeric',
      }),
    [calendarCursor, localeTag]
  );

  const isCalendarPrevDisabled =
    calendarCursor.getFullYear() === today.getFullYear() &&
    calendarCursor.getMonth() === today.getMonth();

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
    if (appointmentsView !== 'calendar') {
      setSelectedAppointmentId(null);
    }
  }, [appointmentsView]);

  useEffect(() => {
    if (appointmentsView !== 'list' && selectedAppointmentIds.size > 0) {
      setSelectedAppointmentIds(new Set());
    }
  }, [appointmentsView, selectedAppointmentIds]);

  useEffect(() => {
    if (!selectAllRef.current) {
      return;
    }

    selectAllRef.current.indeterminate = someFilteredSelected;
  }, [someFilteredSelected]);

  useEffect(() => {
    setSelectedAppointmentIds((prev) => {
      if (prev.size === 0) {
        return prev;
      }

      const availableIds = new Set(filteredAppointments.map((item) => item.id));
      const next = new Set([...prev].filter((id) => availableIds.has(id)));

      if (next.size === prev.size) {
        return prev;
      }

      return next;
    });
  }, [filteredAppointments]);

  useEffect(() => {
    if (!selectedAppointmentId) {
      return;
    }

    const isVisible = filteredAppointments.some(
      (appointment) => appointment.id === selectedAppointmentId
    );

    if (!isVisible) {
      setSelectedAppointmentId(null);
    }
  }, [filteredAppointments, selectedAppointmentId]);

  useEffect(() => {
    const storedToken = window.localStorage.getItem('adminToken') || '';
    setAuthToken(storedToken);
    setAuthReady(true);
  }, []);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setLoadError('');
      setPatientsStatus({ loading: true, error: '' });

      try {
        const clinicDomain = getClinicDomain();
        const headers = {
          'x-clinic-domain': clinicDomain,
        };

        const [appointmentsResponse, doctorsResponse, patientsResponse] = await Promise.all([
          fetch(`${API_BASE}/appointments`, { headers }),
          fetch(`${API_BASE}/doctors`, { headers }),
          fetch(`${API_BASE}/patients`, {
            headers: {
              ...headers,
              Authorization: `Bearer ${authToken}`,
            },
          }),
        ]);

        if (!appointmentsResponse.ok) {
          throw new Error(
            t('request_failed', { status: appointmentsResponse.status })
          );
        }

        if (!doctorsResponse.ok) {
          throw new Error(t('request_failed', { status: doctorsResponse.status }));
        }

        if (!patientsResponse.ok) {
          throw new Error(t('request_failed', { status: patientsResponse.status }));
        }

        const appointmentsData = await appointmentsResponse.json();
        const doctorsData = await doctorsResponse.json();
        const patientsData = await patientsResponse.json();

        const resolvedClinic = appointmentsData.clinic || doctorsData.clinic || null;
        setClinicName(resolvedClinic?.name || '');
        setClinicLogo(resolvedClinic?.logo || '');
        setClinicDisabled(Boolean(resolvedClinic?.is_disabled));
        setClinicSchedule({
          opensAt: resolvedClinic?.opens_at || '09:00',
          closesAt: resolvedClinic?.closes_at || '16:00',
          slotMinutes: resolvedClinic?.slot_minutes || 30,
        });
        const preferredLocale = resolvedClinic?.default_language;
        if (preferredLocale) {
          const stored = window.localStorage.getItem('locale');
          const supportedLocales = ['en', 'mk', 'al', 'sl'];
          if (!stored && supportedLocales.includes(preferredLocale)) {
            setLocale(preferredLocale, 'auto');
          }
        }
        setAppointments((appointmentsData.appointments || []).map(normalizeAppointment));
        setDoctors(doctorsData.doctors || []);
        setPatients(patientsData.patients || []);
        setPatientsStatus({ loading: false, error: '' });
        setLoading(false);
      } catch (error) {
        setLoadError(error?.message || t('admin_load_error'));
        setPatientsStatus({ loading: false, error: error?.message || t('admin_load_error') });
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

  useEffect(() => {
    if (!doctorForm.doctorId) {
      return;
    }

    const selected = doctorOptions.find((doctor) => doctor.id === doctorForm.doctorId);
    if (!selected) {
      setDoctorForm({
        doctorId: '',
        name: '',
        username: '',
        specialty: '',
        description: '',
        password: '',
        isDisabled: false,
      });
      return;
    }

    setDoctorForm((prev) => ({
      ...prev,
      name: selected.name || '',
      username: selected.username || '',
      specialty: selected.specialty || '',
      description: selected.description || '',
      isDisabled: Boolean(selected.is_disabled),
    }));
  }, [doctorForm.doctorId, doctorOptions]);

  useEffect(() => {
    let isActive = true;

    if (!showForm || !formState.doctorId || !formState.date) {
      setBlockedTimes({ loading: false, error: '', times: [] });
      return () => {
        isActive = false;
      };
    }

    async function loadBlockedTimes() {
      setBlockedTimes({ loading: true, error: '', times: [] });

      try {
        const response = await fetch(
          `${API_BASE}/availability?date=${formState.date}&doctorId=${formState.doctorId}`,
          {
            headers: {
              'x-clinic-domain': getClinicDomain(),
            },
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || t('availability_error'));
        }

        if (isActive) {
          setBlockedTimes({
            loading: false,
            error: '',
            times: data.unavailableTimes || [],
          });
        }
      } catch (error) {
        if (isActive) {
          setBlockedTimes({
            loading: false,
            error: error?.message || t('availability_error'),
            times: [],
          });
        }
      }
    }

    loadBlockedTimes();

    return () => {
      isActive = false;
    };
  }, [formState.date, formState.doctorId, showForm, t]);

  useEffect(() => {
    if (authToken) {
      loadAvailabilityRecords();
    }
  }, [authToken, t]);

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

    if (bookedTimes.includes(formState.time) || blockedTimes.times.includes(formState.time)) {
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
        Authorization: `Bearer ${authToken}`,
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
          Authorization: `Bearer ${authToken}`,
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

  function toggleAppointmentSelection(appointmentId) {
    setSelectedAppointmentIds((prev) => {
      const next = new Set(prev);
      if (next.has(appointmentId)) {
        next.delete(appointmentId);
      } else {
        next.add(appointmentId);
      }
      return next;
    });
  }

  function handleSelectAllAppointments() {
    if (allFilteredSelected) {
      setSelectedAppointmentIds(new Set());
      return;
    }

    setSelectedAppointmentIds(new Set(filteredAppointments.map((appointment) => appointment.id)));
  }

  function handleClearSelection() {
    setSelectedAppointmentIds(new Set());
  }

  function handleBulkCancelEmail() {
    const selected = filteredAppointments.filter((appointment) =>
      selectedAppointmentIds.has(appointment.id)
    );
    const recipients = Array.from(
      new Set(selected.map((appointment) => appointment.email).filter(Boolean))
    );

    if (recipients.length === 0) {
      window.alert(t('admin_bulk_email_missing'));
      return;
    }

    const clinicLabel = clinicName || t('brand_title_fallback');
    const subject = t('admin_bulk_cancel_subject', { clinic: clinicLabel });
    const body = t('admin_bulk_cancel_body', { clinic: clinicLabel });
    const mailto = `mailto:?bcc=${encodeURIComponent(recipients.join(','))}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailto;
    setSelectedAppointmentIds(new Set());
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
          Authorization: `Bearer ${authToken}`,
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
    setClinicDisabled(false);
    setAvailabilityRecords([]);
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

  async function loadAvailabilityRecords() {
    try {
      const response = await fetch(`${API_BASE}/availability/records`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
          'x-clinic-domain': getClinicDomain(),
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || t('admin_availability_error'));
      }

      setAvailabilityRecords(data.records || []);
    } catch (error) {
      setAvailabilityStatus((prev) => ({
        ...prev,
        error: error?.message || t('admin_availability_error'),
      }));
    }
  }

  async function handleAvailabilitySubmit(event) {
    event.preventDefault();
    setAvailabilityStatus({ status: '', error: '' });

    if (!availabilityForm.doctorId || !availabilityForm.startDate || !availabilityForm.endDate) {
      setAvailabilityStatus({ status: '', error: t('admin_availability_required') });
      return;
    }

    if ((availabilityForm.startTime && !availabilityForm.endTime)
      || (!availabilityForm.startTime && availabilityForm.endTime)) {
      setAvailabilityStatus({ status: '', error: t('admin_availability_time_required') });
      return;
    }

    if (
      availabilityForm.startTime &&
      availabilityForm.startDate !== availabilityForm.endDate
    ) {
      setAvailabilityStatus({ status: '', error: t('admin_availability_time_date_match') });
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/availability/records`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'x-clinic-domain': getClinicDomain(),
        },
        body: JSON.stringify({
          doctor_id: availabilityForm.doctorId,
          start_date: availabilityForm.startDate,
          end_date: availabilityForm.endDate,
          start_time: availabilityForm.startTime || null,
          end_time: availabilityForm.endTime || null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || t('admin_availability_error'));
      }

      setAvailabilityForm({
        doctorId: availabilityForm.doctorId,
        startDate: '',
        endDate: '',
        startTime: '',
        endTime: '',
      });
      setAvailabilityStatus({ status: t('admin_availability_success'), error: '' });
      await loadAvailabilityRecords();
    } catch (error) {
      setAvailabilityStatus({ status: '', error: error?.message || t('admin_availability_error') });
    }
  }

  async function handleAvailabilityDelete(recordId) {
    if (!window.confirm(t('admin_availability_delete_confirm'))) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/availability/records/${recordId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'x-clinic-domain': getClinicDomain(),
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || t('admin_availability_delete_error'));
      }

      setAvailabilityRecords((prev) =>
        prev.filter((record) => record.id !== recordId)
      );
    } catch (error) {
      setAvailabilityStatus((prev) => ({
        ...prev,
        error: error?.message || t('admin_availability_delete_error'),
      }));
    }
  }

  async function handleClinicStatusChange(nextValue) {
    setClinicStatus({ status: '', error: '' });

    try {
      const response = await fetch(`${API_BASE}/clinic`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'x-clinic-domain': getClinicDomain(),
        },
        body: JSON.stringify({ is_disabled: nextValue }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || t('admin_clinic_status_error'));
      }

      setClinicDisabled(Boolean(data.clinic?.is_disabled));
      setClinicStatus({ status: t('admin_clinic_status_success'), error: '' });
    } catch (error) {
      setClinicStatus({ status: '', error: error?.message || t('admin_clinic_status_error') });
      setClinicDisabled((prev) => prev);
    }
  }

  async function handleScheduleSubmit(event) {
    event.preventDefault();
    setScheduleStatus({ status: '', error: '' });

    const startMinutes = parseTimeToMinutes(clinicSchedule.opensAt);
    const endMinutes = parseTimeToMinutes(clinicSchedule.closesAt);
    const slotMinutes = Number(clinicSchedule.slotMinutes);

    if (startMinutes === null || endMinutes === null || !clinicSchedule.slotMinutes) {
      setScheduleStatus({ status: '', error: t('admin_schedule_required') });
      return;
    }

    if (startMinutes > endMinutes) {
      setScheduleStatus({ status: '', error: t('admin_schedule_invalid') });
      return;
    }

    if (!Number.isInteger(slotMinutes) || slotMinutes <= 0) {
      setScheduleStatus({ status: '', error: t('admin_schedule_slot_error') });
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/clinic`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'x-clinic-domain': getClinicDomain(),
        },
        body: JSON.stringify({
          opens_at: clinicSchedule.opensAt,
          closes_at: clinicSchedule.closesAt,
          slot_minutes: slotMinutes,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || t('admin_schedule_error'));
      }

      setClinicSchedule({
        opensAt: data.clinic?.opens_at || clinicSchedule.opensAt,
        closesAt: data.clinic?.closes_at || clinicSchedule.closesAt,
        slotMinutes: data.clinic?.slot_minutes || slotMinutes,
      });
      setScheduleStatus({ status: t('admin_schedule_success'), error: '' });
    } catch (error) {
      setScheduleStatus({ status: '', error: error?.message || t('admin_schedule_error') });
    }
  }

  function handleDoctorSelect(doctorId) {
    if (!doctorId) {
      setDoctorForm({
        doctorId: '',
        name: '',
        username: '',
        specialty: '',
        description: '',
        password: '',
        isDisabled: false,
      });
      setDoctorFormStatus({ status: '', error: '' });
      return;
    }

    setDoctorForm((prev) => ({
      ...prev,
      doctorId,
      password: '',
    }));
    setDoctorFormStatus({ status: '', error: '' });
  }

  async function handleDoctorUpdateSubmit(event) {
    event.preventDefault();
    setDoctorFormStatus({ status: '', error: '' });

    if (!doctorForm.doctorId) {
      setDoctorFormStatus({ status: '', error: t('admin_doctor_update_required') });
      return;
    }

    if (!doctorForm.name.trim() || !doctorForm.specialty.trim()) {
      setDoctorFormStatus({ status: '', error: t('admin_doctor_update_required') });
      return;
    }

    const payload = {
      name: doctorForm.name.trim(),
      username: doctorForm.username.trim() || null,
      specialty: doctorForm.specialty.trim(),
      description: doctorForm.description.trim() || null,
      is_disabled: doctorForm.isDisabled,
    };

    if (doctorForm.password.trim()) {
      payload.password = doctorForm.password.trim();
    }

    try {
      const response = await fetch(`${API_BASE}/doctors/${doctorForm.doctorId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'x-clinic-domain': getClinicDomain(),
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || t('admin_doctor_update_error'));
      }

      setDoctors((prev) =>
        prev.map((doctor) =>
          doctor.id === data.doctor?.id ? { ...doctor, ...data.doctor } : doctor
        )
      );
      setDoctorForm((prev) => ({
        ...prev,
        password: '',
        isDisabled: Boolean(data.doctor?.is_disabled),
      }));
      setDoctorFormStatus({ status: t('admin_doctor_update_success'), error: '' });
    } catch (error) {
      setDoctorFormStatus({
        status: '',
        error: error?.message || t('admin_doctor_update_error'),
      });
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
          className={activePanel === 'patients' ? 'active' : ''}
          onClick={() => setActivePanel('patients')}
        >
          {t('admin_tab_patients')}
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
              <div className="admin-section-actions">
                <div className="view-toggle">
                  <button
                    type="button"
                    className={appointmentsView === 'list' ? 'active' : ''}
                    onClick={() => setAppointmentsView('list')}
                  >
                    {t('admin_view_list')}
                  </button>
                  <button
                    type="button"
                    className={appointmentsView === 'calendar' ? 'active' : ''}
                    onClick={() => setAppointmentsView('calendar')}
                  >
                    {t('admin_view_calendar')}
                  </button>
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
                    <span className="field-hint">{scheduleTimeHint}</span>
                  </div>
                  {!formState.doctorId && (
                    <p className="inline-hint">{t('admin_select_doctor_hint')}</p>
                  )}
                  {blockedTimes.loading && formState.doctorId && (
                    <p className="inline-hint">{t('loading_times')}</p>
                  )}
                  {blockedTimes.error && (
                    <p className="inline-hint error">{blockedTimes.error}</p>
                  )}
                  {formError && <p className="inline-hint error">{formError}</p>}
                  <div className="time-grid">
                    {timeSlots.map((slot) => {
                      const isTaken = bookedTimes.includes(slot.value);
                      const isBlocked = blockedTimes.times.includes(slot.value);
                      const isDisabled = !formState.doctorId || isTaken || isBlocked;

                      return (
                        <button
                          type="button"
                          key={slot.value}
                          className={`slot-button time-slot${
                            formState.time === slot.value ? ' selected' : ''
                          }${isTaken || isBlocked ? ' taken' : ''}`}
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

            {appointmentsView === 'list' && (
              <div className="card bulk-actions">
                <div className="bulk-actions-info">
                  <p className="row-title">
                    {t('admin_bulk_selected', { count: selectedAppointmentIds.size })}
                  </p>
                  <div className="bulk-actions-controls">
                    <button
                      type="button"
                      className="ghost"
                      onClick={handleSelectAllAppointments}
                      disabled={filteredAppointments.length === 0}
                    >
                      {t('admin_select_all')}
                    </button>
                    <button
                      type="button"
                      className="ghost"
                      onClick={handleClearSelection}
                      disabled={selectedAppointmentIds.size === 0}
                    >
                      {t('admin_clear_selection')}
                    </button>
                  </div>
                </div>
                <div className="actions-grid bulk-actions-grid">
                  <button
                    type="button"
                    className="icon-pill danger"
                    onClick={handleBulkCancelEmail}
                    disabled={selectedAppointmentIds.size === 0}
                  >
                    <img src="/icons/mail.svg" alt="" />
                    {t('admin_bulk_email_cancel')}
                  </button>
                </div>
              </div>
            )}

            {appointmentsView === 'list' ? (
              <div className="card appointment-table">
                <div className="table-head">
                  <span className="table-select">
                    <input
                      ref={selectAllRef}
                      type="checkbox"
                      checked={allFilteredSelected}
                      onChange={handleSelectAllAppointments}
                      aria-label={t('admin_select_all')}
                    />
                  </span>
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
                      className={`table-row${appointment.completed ? ' completed' : ''}${selectedAppointmentIds.has(appointment.id) ? ' selected' : ''}`}
                    >
                      <div className="table-select">
                        <input
                          type="checkbox"
                          checked={selectedAppointmentIds.has(appointment.id)}
                          onChange={() => toggleAppointmentSelection(appointment.id)}
                          aria-label={t('admin_select_appointment')}
                        />
                      </div>
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
            ) : (
              <>
                <div className="card appointment-calendar">
                  <div className="calendar-header">
                    <button
                      type="button"
                      className="icon-button"
                      onClick={() =>
                        setCalendarCursor(
                          (current) => new Date(current.getFullYear(), current.getMonth() - 1, 1)
                        )
                      }
                      disabled={isCalendarPrevDisabled}
                      aria-label={t('prev_month')}
                    >
                      {'<'}
                    </button>
                    <span className="calendar-title">{calendarLabel}</span>
                    <button
                      type="button"
                      className="icon-button"
                      onClick={() =>
                        setCalendarCursor(
                          (current) => new Date(current.getFullYear(), current.getMonth() + 1, 1)
                        )
                      }
                      aria-label={t('next_month')}
                    >
                      {'>'}
                    </button>
                  </div>
                  {loading && <p className="status">{t('admin_loading_appointments')}</p>}
                  {!loading && loadError && <p className="status error">{loadError}</p>}
                  {!loading && !loadError && filteredAppointments.length === 0 && (
                    <p className="status">{t('admin_no_matches')}</p>
                  )}
                  <div className="calendar-grid calendar-weekdays">
                    {weekdayLabels.map((label) => (
                      <span key={label} className="weekday">
                        {label}
                      </span>
                    ))}
                  </div>
                  <div className="admin-calendar-grid">
                    {calendarGrid.map((slot, index) => {
                      if (!slot) {
                        return (
                          <div key={`blank-${index}`} className="admin-calendar-blank" />
                        );
                      }

                      const dayAppointments = appointmentsByDate.get(slot.key) || [];
                      const isToday = slot.key === todayKey;

                      return (
                        <div
                          key={slot.key}
                          className={`admin-calendar-day${isToday ? ' today' : ''}${slot.isPast ? ' past' : ''}`}
                        >
                          <div className="admin-calendar-date">
                            <span>{slot.day}</span>
                          </div>
                          <div className="admin-calendar-events">
                            {dayAppointments.length === 0 ? (
                              <span className="admin-calendar-empty">—</span>
                            ) : (
                              dayAppointments.map((appointment) => (
                                <button
                                  key={appointment.id}
                                  type="button"
                                  className={`admin-calendar-event${
                                    appointment.completed ? ' completed' : ''
                                  }`}
                                  onClick={() => setSelectedAppointmentId(appointment.id)}
                                >
                                  <span className="admin-calendar-time">
                                    {appointment.time}
                                  </span>
                                  <span className="admin-calendar-patient">
                                    {appointment.patient}
                                  </span>
                                  <span className="admin-calendar-doctor">
                                    {appointment.doctor}
                                  </span>
                                </button>
                              ))
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                {selectedAppointment && (
                  <div
                    className="notice-overlay admin-modal-overlay"
                    onClick={(event) => {
                      if (event.target === event.currentTarget) {
                        setSelectedAppointmentId(null);
                      }
                    }}
                  >
                    <div
                      className="card admin-modal-card"
                      role="dialog"
                      aria-modal="true"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <div className="appointment-detail-header">
                        <div>
                          <p className="eyebrow">{t('admin_appointment_details')}</p>
                          <p className="row-title">
                            {selectedAppointment.patient}
                            {selectedAppointment.completed && (
                              <span className="badge">{t('admin_badge_completed')}</span>
                            )}
                          </p>
                          <p className="row-subtitle">
                            {selectedAppointment.doctor} · {selectedAppointment.specialty}
                          </p>
                        </div>
                        <button
                          type="button"
                          className="ghost"
                          onClick={() => setSelectedAppointmentId(null)}
                        >
                          {t('admin_close')}
                        </button>
                      </div>
                      <div className="appointment-detail-grid">
                        <div>
                          <p className="detail-label">{t('admin_table_date')}</p>
                          <p className="detail-value">
                            {formatDisplayDate(selectedAppointment.dateKey, localeTag)}
                          </p>
                          <p className="detail-subvalue">{selectedAppointment.time}</p>
                        </div>
                        <div>
                          <p className="detail-label">{t('admin_table_contact')}</p>
                          <p className="detail-value">{selectedAppointment.email || '—'}</p>
                          <p className="detail-subvalue">{selectedAppointment.phone || '—'}</p>
                        </div>
                        <div>
                          <p className="detail-label">{t('admin_notes_label')}</p>
                          <p className="detail-value">
                            {selectedAppointment.reason || '—'}
                          </p>
                        </div>
                      </div>
                      <div className="actions-grid">
                        <button
                          type="button"
                          className="icon-pill"
                          aria-label={t('admin_action_toggle')}
                          onClick={() => handleToggleCompleted(selectedAppointment)}
                        >
                          <img src="/icons/check.svg" alt="" />
                          {selectedAppointment.completed ? t('admin_undo') : t('admin_done')}
                        </button>
                        <button
                          type="button"
                          className="icon-pill"
                          aria-label={t('admin_action_email')}
                          onClick={() => handleEmail(selectedAppointment)}
                        >
                          <img src="/icons/mail.svg" alt="" />
                          {t('admin_action_email_label')}
                        </button>
                        <button
                          type="button"
                          className="icon-pill"
                          aria-label={t('admin_action_edit')}
                          onClick={() => {
                            handleEdit(selectedAppointment);
                            setSelectedAppointmentId(null);
                          }}
                        >
                          <img src="/icons/edit.svg" alt="" />
                          {t('admin_action_edit_label')}
                        </button>
                        <button
                          type="button"
                          className="icon-pill danger"
                          aria-label={t('admin_action_delete')}
                          onClick={() => {
                            handleDelete(selectedAppointment);
                            setSelectedAppointmentId(null);
                          }}
                        >
                          <img src="/icons/trash.svg" alt="" />
                          {t('admin_action_delete_label')}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </section>
        </>
      )}

      {activePanel === 'patients' && (
        <section className="admin-section">
          <div className="admin-section-header">
            <div>
              <p className="eyebrow">{t('admin_patients_title')}</p>
              <h2>{t('admin_patients_subtitle')}</h2>
            </div>
          </div>

          <div className="card filter-card">
            <div className="field">
              <label htmlFor="patientSearch">{t('admin_patients_search_label')}</label>
              <input
                id="patientSearch"
                value={patientSearch}
                onChange={(event) => setPatientSearch(event.target.value)}
                placeholder={t('admin_patients_search_placeholder')}
              />
            </div>
          </div>

          <div className="card patient-list-card">
            {patientsStatus.loading && <p className="status">{t('admin_patients_loading')}</p>}
            {!patientsStatus.loading && patientsStatus.error && (
              <p className="status error">{patientsStatus.error}</p>
            )}
            {!patientsStatus.loading && !patientsStatus.error && filteredPatients.length === 0 && (
              <p className="status">{t('admin_patients_empty')}</p>
            )}
            {!patientsStatus.loading && !patientsStatus.error && filteredPatients.length > 0 && (
              <div className="patients-list">
                <div className="patients-header">
                  <span>{t('admin_patients_name')}</span>
                  <span>{t('admin_patients_email')}</span>
                  <span>{t('admin_patients_phone')}</span>
                </div>
                {filteredPatients.map((patient) => (
                  <div key={patient.id} className="patient-row">
                    <span className="row-title">{patient.name}</span>
                    <span className="row-subtitle">{patient.email || '—'}</span>
                    <span className="row-subtitle">{patient.phone || '—'}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {activePanel === 'settings' && (
        <section className="admin-section">
          <div className="admin-section-header">
            <div>
              <p className="eyebrow">{t('admin_settings_title')}</p>
              <h2>{t('admin_settings_subtitle')}</h2>
            </div>
          </div>

          <div className="settings-tabs">
            <button
              type="button"
              className={settingsPanel === 'clinic' ? 'active' : ''}
              onClick={() => setSettingsPanel('clinic')}
            >
              {t('admin_settings_clinic')}
            </button>
            <button
              type="button"
              className={settingsPanel === 'doctor' ? 'active' : ''}
              onClick={() => setSettingsPanel('doctor')}
            >
              {t('admin_settings_doctor')}
            </button>
          </div>

          {settingsPanel === 'clinic' && (
            <>
              <div className="card clinic-status-card">
                <div className="upload-header">
                  <div>
                    <p className="row-title">{t('admin_clinic_status_title')}</p>
                    <p className="row-subtitle">{t('admin_clinic_status_subtitle')}</p>
                  </div>
                  <label className="clinic-toggle">
                    <input
                      type="checkbox"
                      checked={clinicDisabled}
                      onChange={(event) => handleClinicStatusChange(event.target.checked)}
                    />
                    <span>{t('admin_clinic_disable_label')}</span>
                  </label>
                </div>
                {clinicStatus.status && <p className="status success">{clinicStatus.status}</p>}
                {clinicStatus.error && <p className="status error">{clinicStatus.error}</p>}
              </div>

              <div className="card clinic-schedule-card">
                <div className="upload-header">
                  <div>
                    <p className="row-title">{t('admin_schedule_title')}</p>
                    <p className="row-subtitle">{t('admin_schedule_subtitle')}</p>
                  </div>
                </div>
                <form className="availability-form" onSubmit={handleScheduleSubmit}>
                  <div className="filter-grid">
                    <div className="field">
                      <label htmlFor="clinicOpen">{t('admin_schedule_open')}</label>
                      <input
                        id="clinicOpen"
                        type="time"
                        value={clinicSchedule.opensAt}
                        onChange={(event) =>
                          setClinicSchedule((prev) => ({
                            ...prev,
                            opensAt: event.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="clinicClose">{t('admin_schedule_close')}</label>
                      <input
                        id="clinicClose"
                        type="time"
                        value={clinicSchedule.closesAt}
                        onChange={(event) =>
                          setClinicSchedule((prev) => ({
                            ...prev,
                            closesAt: event.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="slotMinutes">{t('admin_schedule_slot')}</label>
                      <input
                        id="slotMinutes"
                        type="number"
                        min="5"
                        step="5"
                        value={clinicSchedule.slotMinutes}
                        onChange={(event) =>
                          setClinicSchedule((prev) => ({
                            ...prev,
                            slotMinutes: event.target.value,
                          }))
                        }
                      />
                    </div>
                  </div>
                  <p className="inline-hint">{scheduleTimeHint}</p>
                  <button type="submit" className="cta">
                    {t('admin_schedule_save')}
                  </button>
                  {scheduleStatus.status && (
                    <p className="status success">{scheduleStatus.status}</p>
                  )}
                  {scheduleStatus.error && (
                    <p className="status error">{scheduleStatus.error}</p>
                  )}
                </form>
              </div>

              <div className="card availability-card">
                <div className="upload-header">
                  <div>
                    <p className="row-title">{t('admin_availability_title')}</p>
                    <p className="row-subtitle">{t('admin_availability_subtitle')}</p>
                  </div>
                </div>
                <form className="availability-form" onSubmit={handleAvailabilitySubmit}>
                  <div className="filter-grid">
                    <div className="field">
                      <label htmlFor="availabilityDoctor">{t('admin_doctor_label')}</label>
                      <select
                        id="availabilityDoctor"
                        value={availabilityForm.doctorId}
                        onChange={(event) =>
                          setAvailabilityForm((prev) => ({
                            ...prev,
                            doctorId: event.target.value,
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
                      <label htmlFor="availabilityStartDate">
                        {t('admin_availability_start_date')}
                      </label>
                      <input
                        id="availabilityStartDate"
                        type="date"
                        value={availabilityForm.startDate}
                        onChange={(event) =>
                          setAvailabilityForm((prev) => ({
                            ...prev,
                            startDate: event.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="availabilityEndDate">
                        {t('admin_availability_end_date')}
                      </label>
                      <input
                        id="availabilityEndDate"
                        type="date"
                        value={availabilityForm.endDate}
                        onChange={(event) =>
                          setAvailabilityForm((prev) => ({
                            ...prev,
                            endDate: event.target.value,
                          }))
                        }
                      />
                    </div>
                  </div>
                  <div className="filter-grid">
                    <div className="field">
                      <label htmlFor="availabilityStartTime">
                        {t('admin_availability_start_time')}
                      </label>
                      <input
                        id="availabilityStartTime"
                        type="time"
                        value={availabilityForm.startTime}
                        onChange={(event) =>
                          setAvailabilityForm((prev) => ({
                            ...prev,
                            startTime: event.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="availabilityEndTime">
                        {t('admin_availability_end_time')}
                      </label>
                      <input
                        id="availabilityEndTime"
                        type="time"
                        value={availabilityForm.endTime}
                        onChange={(event) =>
                          setAvailabilityForm((prev) => ({
                            ...prev,
                            endTime: event.target.value,
                          }))
                        }
                      />
                    </div>
                  </div>
                  <p className="inline-hint">{t('admin_availability_hint')}</p>
                  <button type="submit" className="cta">
                    {t('admin_availability_add')}
                  </button>
                  {availabilityStatus.status && (
                    <p className="status success">{availabilityStatus.status}</p>
                  )}
                  {availabilityStatus.error && (
                    <p className="status error">{availabilityStatus.error}</p>
                  )}
                </form>
                {availabilityRecords.length > 0 && (
                  <div className="availability-list">
                    {availabilityRecords.map((record) => {
                      const startDate = record.start_date
                        ? new Date(record.start_date)
                        : null;
                      const endDate = record.end_date
                        ? new Date(record.end_date)
                        : null;
                      const dateLabel = startDate && endDate
                        ? startDate.toLocaleDateString(localeTag, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        }) === endDate.toLocaleDateString(localeTag, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })
                          ? startDate.toLocaleDateString(localeTag, {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })
                          : `${startDate.toLocaleDateString(localeTag, {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })} - ${endDate.toLocaleDateString(localeTag, {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}`
                        : '';
                      const timeLabel = record.start_time && record.end_time
                        ? `${record.start_time.slice(0, 5)} - ${record.end_time.slice(0, 5)}`
                        : t('admin_availability_all_day');

                      return (
                        <div key={record.id} className="availability-item">
                          <div>
                            <p className="row-title">{record.doctor_name || t('doctor_label')}</p>
                            <p className="row-subtitle">
                              {dateLabel}{dateLabel ? ' · ' : ''}{timeLabel}
                            </p>
                          </div>
                          <button
                            type="button"
                            className="ghost"
                            onClick={() => handleAvailabilityDelete(record.id)}
                          >
                            {t('admin_availability_remove')}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
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
            </>
          )}

          {settingsPanel === 'doctor' && (
            <>
              <div className="card doctor-edit-card">
                <div className="upload-header">
                  <div>
                    <p className="row-title">{t('admin_doctor_update_title')}</p>
                    <p className="row-subtitle">{t('admin_doctor_update_subtitle')}</p>
                  </div>
                </div>
                <form className="availability-form" onSubmit={handleDoctorUpdateSubmit}>
                  <div className="filter-grid">
                    <div className="field">
                      <label htmlFor="doctorEditSelect">{t('admin_doctor_select_label')}</label>
                      <select
                        id="doctorEditSelect"
                        value={doctorForm.doctorId}
                        onChange={(event) => handleDoctorSelect(event.target.value)}
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
                      <label htmlFor="doctorName">{t('admin_doctor_name_label')}</label>
                      <input
                        id="doctorName"
                        value={doctorForm.name}
                        onChange={(event) =>
                          setDoctorForm((prev) => ({
                            ...prev,
                            name: event.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="doctorUsername">{t('admin_doctor_username_label')}</label>
                      <input
                        id="doctorUsername"
                        value={doctorForm.username}
                        onChange={(event) =>
                          setDoctorForm((prev) => ({
                            ...prev,
                            username: event.target.value,
                          }))
                        }
                      />
                    </div>
                  </div>
                  <div className="filter-grid">
                    <div className="field">
                      <label htmlFor="doctorSpecialty">
                        {t('admin_doctor_specialty_label')}
                      </label>
                      <input
                        id="doctorSpecialty"
                        value={doctorForm.specialty}
                        onChange={(event) =>
                          setDoctorForm((prev) => ({
                            ...prev,
                            specialty: event.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="doctorPassword">
                        {t('admin_doctor_password_label')}
                      </label>
                      <input
                        id="doctorPassword"
                        type="password"
                        value={doctorForm.password}
                        onChange={(event) =>
                          setDoctorForm((prev) => ({
                            ...prev,
                            password: event.target.value,
                          }))
                        }
                      />
                    </div>
                  </div>
                  <div className="field">
                    <label htmlFor="doctorDescription">
                      {t('admin_doctor_description_label')}
                    </label>
                    <textarea
                      id="doctorDescription"
                      rows={3}
                      value={doctorForm.description}
                      onChange={(event) =>
                        setDoctorForm((prev) => ({
                          ...prev,
                          description: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <label className="danger-toggle">
                    <div className="toggle-row">
                      <input
                        type="checkbox"
                        checked={doctorForm.isDisabled}
                        onChange={(event) =>
                          setDoctorForm((prev) => ({
                            ...prev,
                            isDisabled: event.target.checked,
                          }))
                        }
                      />
                      <span className="toggle-text">{t('admin_doctor_disable_label')}</span>
                    </div>
                    <span className="toggle-hint">{t('admin_doctor_disable_hint')}</span>
                  </label>
                  <button type="submit" className="cta">
                    {t('admin_doctor_update_button')}
                  </button>
                  {doctorFormStatus.status && (
                    <p className="status success">{doctorFormStatus.status}</p>
                  )}
                  {doctorFormStatus.error && (
                    <p className="status error">{doctorFormStatus.error}</p>
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
            </>
          )}
        </section>
      )}
    </main>
  );
}

export default function AdminPage() {
  const { t } = useI18n();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    setIsReady(true);
  }, []);

  if (!isReady) {
    return (
      <main className="page admin-page">
        <div className="admin-language-bar">
          <LanguageSwitcher />
        </div>
        <section className="hero">
          <div className="card clinic-status">
            <p className="status-title">{t('admin_checking')}</p>
          </div>
        </section>
      </main>
    );
  }

  return <AdminPageContent />;
}
