'use client';

import { useEffect, useState } from 'react';
import { Space_Grotesk, IBM_Plex_Mono } from 'next/font/google';

import styles from './SuperAdminPage.module.css';

const displayFont = Space_Grotesk({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-display',
});

const monoFont = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-mono',
});

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api';

const clinicDefaults = {
  name: '',
  domain: '',
  phone: '',
  email: '',
  address: '',
  default_language: 'en',
  opens_at: '09:00',
  closes_at: '16:00',
  slot_minutes: '30',
  theme_primary: '#0F62FE',
  theme_secondary: '#FF832B',
  logo: '',
  is_disabled: false,
};

const doctorDefaults = {
  clinic_domain: '',
  name: '',
  username: '',
  specialty: '',
  description: '',
  password: '',
  avatar: '',
  is_disabled: false,
};

const auditFilterDefaults = {
  clinicId: '',
  doctorId: '',
  action: '',
  from: '',
  to: '',
  limit: '100',
};

const auditLimitOptions = [50, 100, 250, 500];

export default function SuperAdminPage() {
  const [authReady, setAuthReady] = useState(false);
  const [isAuthed, setIsAuthed] = useState(false);
  const [authForm, setAuthForm] = useState({ username: '', password: '' });
  const [authError, setAuthError] = useState('');
  const [clinics, setClinics] = useState([]);
  const [selectedClinicId, setSelectedClinicId] = useState('');
  const [clinicForm, setClinicForm] = useState(clinicDefaults);
  const [doctorForm, setDoctorForm] = useState(doctorDefaults);
  const [doctorOptions, setDoctorOptions] = useState([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [clinicStatus, setClinicStatus] = useState({ type: '', message: '' });
  const [doctorStatus, setDoctorStatus] = useState({ type: '', message: '' });
  const [loading, setLoading] = useState({ clinics: false, doctor: false });
  const [auditFilters, setAuditFilters] = useState({ ...auditFilterDefaults });
  const [auditDoctorOptions, setAuditDoctorOptions] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditMeta, setAuditMeta] = useState({ total: 0, limit: 100, offset: 0 });
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditStatus, setAuditStatus] = useState({ type: '', message: '' });
  const [auditLoadedAt, setAuditLoadedAt] = useState(null);

  useEffect(() => {
    async function checkSession() {
      try {
        const response = await fetch(`${API_BASE}/super/auth/session`, {
          credentials: 'include',
        });
        if (!response.ok) {
          setIsAuthed(false);
          return;
        }
        setIsAuthed(true);
      } catch (error) {
        setIsAuthed(false);
      } finally {
        setAuthReady(true);
      }
    }

    checkSession();
  }, []);

  async function loadClinics() {
    try {
      const response = await fetch(`${API_BASE}/clinics`);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'Unable to load clinics.');
      }
      const normalized = (data.clinics || [])
        .map((clinic) => ({
          id: clinic.id,
          name: clinic.name,
          domain: clinic.domain,
          phone: clinic.phone || '',
          email: clinic.email || '',
          address: clinic.address || '',
          default_language: clinic.default_language || 'en',
          opens_at: clinic.opens_at || '09:00',
          closes_at: clinic.closes_at || '16:00',
          slot_minutes: clinic.slot_minutes || 30,
          theme_primary: clinic.theme_primary || clinicDefaults.theme_primary,
          theme_secondary: clinic.theme_secondary || clinicDefaults.theme_secondary,
          logo: clinic.logo || '',
          is_disabled: Boolean(clinic.is_disabled),
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
      setClinics(normalized);
    } catch (error) {
      setClinics([]);
    }
  }

  useEffect(() => {
    if (isAuthed) {
      loadClinics();
    }
  }, [isAuthed]);

  useEffect(() => {
    if (isAuthed) {
      loadAuditLogs({ nextOffset: 0 });
    } else {
      setAuditLogs([]);
      setAuditMeta({ total: 0, limit: Number(auditFilterDefaults.limit), offset: 0 });
      setAuditLoadedAt(null);
    }
  }, [isAuthed]);

  function updateClinicField(field, value) {
    setClinicForm((prev) => ({ ...prev, [field]: value }));
  }

  function updateDoctorField(field, value) {
    setDoctorForm((prev) => ({ ...prev, [field]: value }));
  }

  function updateAuditFilter(field, value) {
    setAuditFilters((prev) => {
      const next = { ...prev, [field]: value };
      if (field === 'clinicId') {
        next.doctorId = '';
      }
      return next;
    });
  }

  function applyClinicSelection(nextClinicId) {
    setSelectedClinicId(nextClinicId);
    setSelectedDoctorId('');
    setDoctorOptions([]);

    if (!nextClinicId) {
      setClinicForm(clinicDefaults);
      return;
    }

    const selected = clinics.find((clinic) => clinic.id === nextClinicId);
    if (!selected) {
      return;
    }

    setClinicForm({
      name: selected.name || '',
      domain: selected.domain || '',
      phone: selected.phone || '',
      email: selected.email || '',
      address: selected.address || '',
      default_language: selected.default_language || 'en',
      opens_at: selected.opens_at || '09:00',
      closes_at: selected.closes_at || '16:00',
      slot_minutes: selected.slot_minutes ? String(selected.slot_minutes) : '',
      theme_primary: selected.theme_primary || clinicDefaults.theme_primary,
      theme_secondary: selected.theme_secondary || clinicDefaults.theme_secondary,
      logo: selected.logo || '',
      is_disabled: Boolean(selected.is_disabled),
    });
    setDoctorForm((prev) => ({
      ...prev,
      clinic_domain: selected.domain || '',
    }));
  }

  async function loadDoctors(nextClinicId) {
    if (!isAuthed || !nextClinicId) {
      setDoctorOptions([]);
      return;
    }

    try {
      const response = await fetch(
        `${API_BASE}/super/doctors?clinic_id=${encodeURIComponent(nextClinicId)}`,
        {
          credentials: 'include',
        }
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'Unable to load doctors.');
      }
      setDoctorOptions(data.doctors || []);
    } catch (error) {
      setDoctorOptions([]);
    }
  }

  useEffect(() => {
    if (!selectedClinicId) {
      setDoctorOptions([]);
      setSelectedDoctorId('');
      return;
    }
    loadDoctors(selectedClinicId);
  }, [selectedClinicId, isAuthed]);

  useEffect(() => {
    if (!isAuthed || !auditFilters.clinicId) {
      setAuditDoctorOptions([]);
      return;
    }

    loadAuditDoctors(auditFilters.clinicId);
  }, [auditFilters.clinicId, isAuthed]);

  function applyDoctorSelection(nextDoctorId) {
    setSelectedDoctorId(nextDoctorId);
    if (!nextDoctorId) {
      setDoctorForm((prev) => ({
        ...doctorDefaults,
        clinic_domain: prev.clinic_domain,
      }));
      return;
    }

    const selected = doctorOptions.find((doctor) => doctor.id === nextDoctorId);
    if (!selected) {
      return;
    }

    setDoctorForm({
      clinic_domain: clinicForm.domain || '',
      name: selected.name || '',
      username: selected.username || '',
      specialty: selected.specialty || '',
      description: selected.description || '',
      password: '',
      avatar: selected.avatar || '',
      is_disabled: Boolean(selected.is_disabled),
    });
  }

  async function loadAuditDoctors(clinicId) {
    try {
      const response = await fetch(
        `${API_BASE}/super/doctors?clinic_id=${encodeURIComponent(clinicId)}`,
        {
          credentials: 'include',
        }
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'Unable to load doctors.');
      }
      setAuditDoctorOptions(data.doctors || []);
    } catch (error) {
      setAuditDoctorOptions([]);
    }
  }

  async function loadAuditLogs({ nextOffset = auditMeta.offset || 0, filters } = {}) {
    if (!isAuthed) {
      return;
    }

    const activeFilters = filters || auditFilters;
    const params = new URLSearchParams();

    if (activeFilters.clinicId) {
      params.set('clinic_id', activeFilters.clinicId);
    }
    if (activeFilters.doctorId) {
      params.set('doctor_id', activeFilters.doctorId);
    }
    const actionValue = String(activeFilters.action || '').trim();
    if (actionValue) {
      params.set('action', actionValue);
    }
    if (activeFilters.from) {
      params.set('from', activeFilters.from);
    }
    if (activeFilters.to) {
      params.set('to', activeFilters.to);
    }

    const limitValue = activeFilters.limit || auditFilterDefaults.limit;
    params.set('limit', limitValue);
    params.set('offset', String(nextOffset || 0));

    setAuditLoading(true);
    setAuditStatus({ type: '', message: '' });

    try {
      const response = await fetch(
        `${API_BASE}/super/audit-logs?${params.toString()}`,
        {
          credentials: 'include',
        }
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'Unable to load audit logs.');
      }
      setAuditLogs(data.logs || []);
      const meta = data.meta || {};
      const resolvedLimit = Number(meta.limit) || Number(limitValue) || 100;
      const resolvedOffset = Number(meta.offset) || 0;
      setAuditMeta({
        total: Number(meta.total) || 0,
        limit: resolvedLimit,
        offset: resolvedOffset,
      });
      setAuditLoadedAt(new Date());
    } catch (error) {
      setAuditLogs([]);
      setAuditMeta({ total: 0, limit: Number(limitValue) || 100, offset: 0 });
      setAuditStatus({
        type: 'error',
        message: error.message || 'Unable to load audit logs.',
      });
    } finally {
      setAuditLoading(false);
    }
  }

  function handleAuditSubmit(event) {
    event.preventDefault();
    loadAuditLogs({ nextOffset: 0 });
  }

  function handleAuditReset() {
    const nextFilters = { ...auditFilterDefaults };
    setAuditFilters(nextFilters);
    setAuditDoctorOptions([]);
    setAuditMeta((prev) => ({ ...prev, offset: 0, limit: Number(nextFilters.limit) }));
    loadAuditLogs({ nextOffset: 0, filters: nextFilters });
  }

  function handleAuditPage(direction) {
    const limit = Number(auditMeta.limit) || Number(auditFilters.limit) || 100;
    const total = Number(auditMeta.total) || 0;
    const maxOffset = Math.max(0, total - limit);
    const nextOffset = Math.min(
      maxOffset,
      Math.max(0, (auditMeta.offset || 0) + direction * limit)
    );
    loadAuditLogs({ nextOffset });
  }

  function formatAuditTimestamp(value) {
    if (!value) {
      return '';
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return String(value);
    }
    return date.toLocaleString();
  }

  function formatAuditMetadata(metadata) {
    if (!metadata) {
      return '-';
    }
    if (typeof metadata === 'string') {
      return metadata.length > 200 ? `${metadata.slice(0, 200)}...` : metadata;
    }
    if (typeof metadata !== 'object') {
      return String(metadata);
    }
    const keys = Object.keys(metadata);
    if (keys.length === 0) {
      return '-';
    }
    try {
      const serialized = JSON.stringify(metadata);
      return serialized.length > 200 ? `${serialized.slice(0, 200)}...` : serialized;
    } catch (error) {
      return '-';
    }
  }

  async function handleClinicSubmit(event) {
    event.preventDefault();
    setClinicStatus({ type: '', message: '' });

    if (!clinicForm.name.trim() || !clinicForm.domain.trim()) {
      setClinicStatus({ type: 'error', message: 'Clinic name and domain are required.' });
      return;
    }

    setLoading((prev) => ({ ...prev, clinics: true }));
    try {
      const response = await fetch(`${API_BASE}/super/clinics`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          ...clinicForm,
          slot_minutes: clinicForm.slot_minutes ? Number(clinicForm.slot_minutes) : null,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'Unable to save clinic.');
      }
      const savedClinic = data.clinic || {};
      setClinicStatus({ type: 'success', message: 'Clinic saved successfully.' });
      setSelectedClinicId(savedClinic.id || '');
      setClinicForm({
        name: savedClinic.name || clinicForm.name,
        domain: savedClinic.domain || clinicForm.domain,
        phone: savedClinic.phone || '',
        email: savedClinic.email || '',
        address: savedClinic.address || '',
        default_language: savedClinic.default_language || clinicForm.default_language,
        opens_at: savedClinic.opens_at || clinicForm.opens_at,
        closes_at: savedClinic.closes_at || clinicForm.closes_at,
        slot_minutes: savedClinic.slot_minutes
          ? String(savedClinic.slot_minutes)
          : clinicForm.slot_minutes,
        theme_primary: savedClinic.theme_primary || clinicForm.theme_primary,
        theme_secondary: savedClinic.theme_secondary || clinicForm.theme_secondary,
        logo: savedClinic.logo || clinicForm.logo,
        is_disabled: Boolean(savedClinic.is_disabled),
      });
      loadClinics();
    } catch (error) {
      setClinicStatus({ type: 'error', message: error.message || 'Unable to save clinic.' });
    } finally {
      setLoading((prev) => ({ ...prev, clinics: false }));
    }
  }

  async function handleDoctorSubmit(event) {
    event.preventDefault();
    setDoctorStatus({ type: '', message: '' });

    if (!doctorForm.clinic_domain.trim()) {
      setDoctorStatus({ type: 'error', message: 'Clinic domain is required.' });
      return;
    }
    if (!doctorForm.name.trim() || !doctorForm.specialty.trim()) {
      setDoctorStatus({
        type: 'error',
        message: 'Doctor name and specialty are required.',
      });
      return;
    }

    setLoading((prev) => ({ ...prev, doctor: true }));
    try {
      const response = await fetch(`${API_BASE}/super/doctors`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(doctorForm),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'Unable to save doctor.');
      }
      const savedDoctor = data.doctor || {};
      setDoctorStatus({ type: 'success', message: 'Doctor saved successfully.' });
      setSelectedDoctorId(savedDoctor.id || '');
      setDoctorForm({
        clinic_domain: doctorForm.clinic_domain,
        name: savedDoctor.name || doctorForm.name,
        username: savedDoctor.username || doctorForm.username,
        specialty: savedDoctor.specialty || doctorForm.specialty,
        description: savedDoctor.description || doctorForm.description,
        password: '',
        avatar: savedDoctor.avatar || doctorForm.avatar,
        is_disabled: Boolean(savedDoctor.is_disabled),
      });
      if (selectedClinicId) {
        loadDoctors(selectedClinicId);
      }
    } catch (error) {
      setDoctorStatus({ type: 'error', message: error.message || 'Unable to save doctor.' });
    } finally {
      setLoading((prev) => ({ ...prev, doctor: false }));
    }
  }

  async function handleLoginSubmit(event) {
    event.preventDefault();
    setAuthError('');

    if (!authForm.username.trim() || !authForm.password.trim()) {
      setAuthError('Username and password are required.');
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/super/auth/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          username: authForm.username,
          password: authForm.password,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'Unable to sign in.');
      }

      setIsAuthed(true);
      setAuthForm({ username: '', password: '' });
    } catch (error) {
      setAuthError(error?.message || 'Unable to sign in.');
    }
  }

  async function handleLogout() {
    await fetch(`${API_BASE}/super/auth/logout`, {
      method: 'POST',
      credentials: 'include',
    });
    setIsAuthed(false);
    setSelectedClinicId('');
    setSelectedDoctorId('');
    setClinics([]);
    setDoctorOptions([]);
    setAuditFilters({ ...auditFilterDefaults });
    setAuditDoctorOptions([]);
    setAuditLogs([]);
    setAuditMeta({ total: 0, limit: Number(auditFilterDefaults.limit), offset: 0 });
    setAuditStatus({ type: '', message: '' });
    setAuditLoadedAt(null);
  }

  if (!authReady) {
    return (
      <main className={`${styles.page} ${displayFont.variable} ${monoFont.variable}`}>
        <div className={styles.backdrop} aria-hidden="true" />
        <div className={styles.loading}>Checking access…</div>
      </main>
    );
  }

  if (!isAuthed) {
    return (
      <main className={`${styles.page} ${displayFont.variable} ${monoFont.variable}`}>
        <div className={styles.backdrop} aria-hidden="true" />
        <section className={styles.loginPanel}>
          <p className={styles.eyebrow}>Super Admin</p>
          <h1 className={styles.title}>Restricted Access</h1>
          <p className={styles.subtitle}>
            Sign in with your super admin credentials to continue.
          </p>
          <form className={styles.loginForm} onSubmit={handleLoginSubmit}>
            <label>
              Username
              <input
                value={authForm.username}
                onChange={(event) =>
                  setAuthForm((prev) => ({ ...prev, username: event.target.value }))
                }
                placeholder="superadmin"
              />
            </label>
            <label>
              Password
              <input
                type="password"
                value={authForm.password}
                onChange={(event) =>
                  setAuthForm((prev) => ({ ...prev, password: event.target.value }))
                }
                placeholder="••••••••"
              />
            </label>
            {authError ? <p className={styles.authError}>{authError}</p> : null}
            <button type="submit">Sign in</button>
          </form>
        </section>
      </main>
    );
  }

  const auditTotal = Number(auditMeta.total) || 0;
  const auditLimit = Number(auditMeta.limit) || Number(auditFilters.limit) || 100;
  const auditOffset = Number(auditMeta.offset) || 0;
  const auditStart = auditTotal ? auditOffset + 1 : 0;
  const auditEnd = auditTotal ? Math.min(auditOffset + auditLimit, auditTotal) : 0;

  return (
    <main className={`${styles.page} ${displayFont.variable} ${monoFont.variable}`}>
      <div className={styles.backdrop} aria-hidden="true" />
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Super Admin</p>
          <h1 className={styles.title}>Clinic Control Hub</h1>
          <p className={styles.subtitle}>
            Create or update clinics and doctors without touching SQL.
          </p>
        </div>
        <div className={styles.sessionPanel}>
          <span className={styles.sessionStatus}>Authenticated</span>
          <button type="button" onClick={handleLogout}>
            Log out
          </button>
        </div>
      </header>

      <section className={styles.grid}>
        <form className={styles.panel} onSubmit={handleClinicSubmit}>
          <div className={styles.panelHeader}>
            <div>
              <h2>Create / Update Clinic</h2>
              <p>Upsert by domain. Safe to re-run.</p>
            </div>
            <span className={styles.pill}>Clinic</span>
          </div>

          <div className={styles.fieldGrid}>
            <label className={styles.fullRow}>
              Load existing clinic
              <select
                value={selectedClinicId}
                onChange={(event) => applyClinicSelection(event.target.value)}
              >
                <option value="">Create a new clinic</option>
                {clinics.map((clinic) => (
                  <option key={clinic.id} value={clinic.id}>
                    {clinic.name} ({clinic.domain})
                  </option>
                ))}
              </select>
            </label>
            <label>
              Clinic name *
              <input
                value={clinicForm.name}
                onChange={(event) => updateClinicField('name', event.target.value)}
                placeholder="Dentra Smile Studio"
              />
            </label>
            <label>
              Domain *
              <input
                value={clinicForm.domain}
                onChange={(event) => updateClinicField('domain', event.target.value)}
                placeholder="clinic.example.com"
              />
            </label>
            <label>
              Phone
              <input
                value={clinicForm.phone}
                onChange={(event) => updateClinicField('phone', event.target.value)}
                placeholder="+389 77 534 304"
              />
            </label>
            <label>
              Email
              <input
                value={clinicForm.email}
                onChange={(event) => updateClinicField('email', event.target.value)}
                placeholder="info@clinic.com"
              />
            </label>
            <label className={styles.fullRow}>
              Address
              <input
                value={clinicForm.address}
                onChange={(event) => updateClinicField('address', event.target.value)}
                placeholder="Street 1, Skopje"
              />
            </label>
            <label>
              Default language
              <select
                value={clinicForm.default_language}
                onChange={(event) => updateClinicField('default_language', event.target.value)}
              >
                <option value="en">English</option>
                <option value="mk">Macedonian</option>
                <option value="al">Albanian</option>
                <option value="sl">Slovenian</option>
              </select>
            </label>
            <label>
              Opens at
              <input
                type="time"
                value={clinicForm.opens_at}
                onChange={(event) => updateClinicField('opens_at', event.target.value)}
              />
            </label>
            <label>
              Closes at
              <input
                type="time"
                value={clinicForm.closes_at}
                onChange={(event) => updateClinicField('closes_at', event.target.value)}
              />
            </label>
            <label>
              Slot minutes
              <input
                type="number"
                min="5"
                step="5"
                value={clinicForm.slot_minutes}
                onChange={(event) => updateClinicField('slot_minutes', event.target.value)}
              />
            </label>
            <label>
              Theme primary
              <input
                type="color"
                value={clinicForm.theme_primary}
                onChange={(event) => updateClinicField('theme_primary', event.target.value)}
              />
            </label>
            <label>
              Theme secondary
              <input
                type="color"
                value={clinicForm.theme_secondary}
                onChange={(event) => updateClinicField('theme_secondary', event.target.value)}
              />
            </label>
            <label className={styles.fullRow}>
              Logo URL
              <input
                value={clinicForm.logo}
                onChange={(event) => updateClinicField('logo', event.target.value)}
                placeholder="https://cdn.example.com/logo.png"
              />
            </label>
            <label className={styles.toggle}>
              <input
                type="checkbox"
                checked={clinicForm.is_disabled}
                onChange={(event) => updateClinicField('is_disabled', event.target.checked)}
              />
              Disable online appointments
            </label>
          </div>

          {clinicStatus.message ? (
            <p className={`${styles.status} ${styles[clinicStatus.type]}`}>
              {clinicStatus.message}
            </p>
          ) : null}
          <button type="submit" disabled={loading.clinics}>
            {loading.clinics ? 'Saving clinic…' : 'Save clinic'}
          </button>
        </form>

        <form className={styles.panel} onSubmit={handleDoctorSubmit}>
          <div className={styles.panelHeader}>
            <div>
              <h2>Create / Update Doctor</h2>
              <p>Upsert by clinic domain + username.</p>
            </div>
            <span className={styles.pill}>Doctor</span>
          </div>

          <div className={styles.fieldGrid}>
            <label className={styles.fullRow}>
              Load existing doctor
              <select
                value={selectedDoctorId}
                onChange={(event) => applyDoctorSelection(event.target.value)}
                disabled={!selectedClinicId || doctorOptions.length === 0}
              >
                <option value="">Create a new doctor</option>
                {doctorOptions.map((doctor) => (
                  <option key={doctor.id} value={doctor.id}>
                    {doctor.name}
                    {doctor.username ? ` (${doctor.username})` : ''}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.fullRow}>
              Clinic domain *
              <input
                value={doctorForm.clinic_domain}
                onChange={(event) => updateDoctorField('clinic_domain', event.target.value)}
                placeholder="clinic.example.com"
                list="clinicDomains"
              />
              <datalist id="clinicDomains">
                {clinics.map((clinic) => (
                  <option key={clinic.id} value={clinic.domain}>
                    {clinic.name}
                  </option>
                ))}
              </datalist>
            </label>
            <label>
              Doctor name *
              <input
                value={doctorForm.name}
                onChange={(event) => updateDoctorField('name', event.target.value)}
                placeholder="Dr. Ana Petrova"
              />
            </label>
            <label>
              Username (recommended)
              <input
                value={doctorForm.username}
                onChange={(event) => updateDoctorField('username', event.target.value)}
                placeholder="ana"
              />
            </label>
            <label>
              Specialty *
              <input
                value={doctorForm.specialty}
                onChange={(event) => updateDoctorField('specialty', event.target.value)}
                placeholder="Orthodontics"
              />
            </label>
            <label className={styles.fullRow}>
              Description
              <input
                value={doctorForm.description}
                onChange={(event) => updateDoctorField('description', event.target.value)}
                placeholder="Short bio"
              />
            </label>
            <label>
              Password
              <input
                type="password"
                value={doctorForm.password}
                onChange={(event) => updateDoctorField('password', event.target.value)}
                placeholder="Set login password"
              />
            </label>
            <label>
              Avatar URL
              <input
                value={doctorForm.avatar}
                onChange={(event) => updateDoctorField('avatar', event.target.value)}
                placeholder="https://cdn.example.com/doctor.png"
              />
            </label>
            <label className={styles.toggle}>
              <input
                type="checkbox"
                checked={doctorForm.is_disabled}
                onChange={(event) => updateDoctorField('is_disabled', event.target.checked)}
              />
              Disable doctor appointments
            </label>
          </div>

          {doctorStatus.message ? (
            <p className={`${styles.status} ${styles[doctorStatus.type]}`}>
              {doctorStatus.message}
            </p>
          ) : null}
          <button type="submit" disabled={loading.doctor}>
            {loading.doctor ? 'Saving doctor…' : 'Save doctor'}
          </button>
        </form>

        <section className={`${styles.panel} ${styles.auditPanel}`}>
          <div className={styles.panelHeader}>
            <div>
              <h2>Audit Log Reporting</h2>
              <p>Track actions across clinics, doctors, and patient records.</p>
            </div>
            <span className={styles.pill}>Audit</span>
          </div>

          <form className={styles.auditForm} onSubmit={handleAuditSubmit}>
            <div className={styles.fieldGrid}>
              <label className={styles.fullRow}>
                Clinic scope
                <select
                  value={auditFilters.clinicId}
                  onChange={(event) => updateAuditFilter('clinicId', event.target.value)}
                >
                  <option value="">All clinics</option>
                  {clinics.map((clinic) => (
                    <option key={clinic.id} value={clinic.id}>
                      {clinic.name} ({clinic.domain})
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Doctor
                <select
                  value={auditFilters.doctorId}
                  onChange={(event) => updateAuditFilter('doctorId', event.target.value)}
                  disabled={!auditFilters.clinicId || auditDoctorOptions.length === 0}
                >
                  <option value="">All doctors</option>
                  {auditDoctorOptions.map((doctor) => (
                    <option key={doctor.id} value={doctor.id}>
                      {doctor.name}
                      {doctor.username ? ` (${doctor.username})` : ''}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Action contains
                <input
                  value={auditFilters.action}
                  onChange={(event) => updateAuditFilter('action', event.target.value)}
                  placeholder="appointments.cancel"
                />
              </label>
              <label>
                From date
                <input
                  type="date"
                  value={auditFilters.from}
                  onChange={(event) => updateAuditFilter('from', event.target.value)}
                />
              </label>
              <label>
                To date
                <input
                  type="date"
                  value={auditFilters.to}
                  onChange={(event) => updateAuditFilter('to', event.target.value)}
                />
              </label>
              <label>
                Rows per page
                <select
                  value={auditFilters.limit}
                  onChange={(event) => updateAuditFilter('limit', event.target.value)}
                >
                  {auditLimitOptions.map((value) => (
                    <option key={value} value={String(value)}>
                      {value}
                    </option>
                  ))}
                </select>
              </label>
              <div className={`${styles.fullRow} ${styles.auditActions}`}>
                <button type="submit" disabled={auditLoading}>
                  {auditLoading ? 'Loading logs...' : 'Run report'}
                </button>
                <button
                  type="button"
                  className={styles.ghostButton}
                  onClick={handleAuditReset}
                  disabled={auditLoading}
                >
                  Reset filters
                </button>
              </div>
            </div>
          </form>

          {auditStatus.message ? (
            <p className={`${styles.status} ${styles[auditStatus.type]}`}>
              {auditStatus.message}
            </p>
          ) : null}

          <div className={styles.auditMeta}>
            <span>
              {auditTotal
                ? `Showing ${auditStart}-${auditEnd} of ${auditTotal} entries`
                : 'No audit entries yet.'}
            </span>
            <span>
              {auditLoadedAt
                ? `Updated ${formatAuditTimestamp(auditLoadedAt)}`
                : 'Run the report to load entries.'}
            </span>
          </div>

          {auditLogs.length ? (
            <div className={styles.auditTableWrap}>
              <table className={styles.auditTable}>
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Clinic</th>
                    <th>Doctor</th>
                    <th>Action</th>
                    <th>Metadata</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.map((log) => (
                    <tr key={log.id}>
                      <td>{formatAuditTimestamp(log.created_at)}</td>
                      <td>
                        {log.clinic_name || 'Unknown'}
                        {log.clinic_domain ? ` (${log.clinic_domain})` : ''}
                      </td>
                      <td>
                        {log.doctor_name || '-'}
                        {log.doctor_username ? ` (${log.doctor_username})` : ''}
                      </td>
                      <td className={styles.auditAction}>{log.action}</td>
                      <td className={styles.auditMetadata}>
                        {formatAuditMetadata(log.metadata)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className={styles.auditEmpty}>
              No audit entries match these filters. Try expanding the date range.
            </p>
          )}

          <div className={styles.auditPagination}>
            <button
              type="button"
              className={styles.ghostButton}
              onClick={() => handleAuditPage(-1)}
              disabled={auditLoading || auditOffset <= 0}
            >
              Previous
            </button>
            <button
              type="button"
              className={styles.ghostButton}
              onClick={() => handleAuditPage(1)}
              disabled={auditLoading || auditOffset + auditLimit >= auditTotal}
            >
              Next
            </button>
          </div>
        </section>
      </section>
    </main>
  );
}
