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

export default function SuperAdminPage() {
  const [token, setToken] = useState('');
  const [clinics, setClinics] = useState([]);
  const [clinicForm, setClinicForm] = useState(clinicDefaults);
  const [doctorForm, setDoctorForm] = useState(doctorDefaults);
  const [clinicStatus, setClinicStatus] = useState({ type: '', message: '' });
  const [doctorStatus, setDoctorStatus] = useState({ type: '', message: '' });
  const [loading, setLoading] = useState({ clinics: false, doctor: false });

  useEffect(() => {
    const saved = window.localStorage.getItem('super_admin_token');
    if (saved) {
      setToken(saved);
    }
  }, []);

  useEffect(() => {
    if (!token) {
      window.localStorage.removeItem('super_admin_token');
      return;
    }
    window.localStorage.setItem('super_admin_token', token);
  }, [token]);

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
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
      setClinics(normalized);
    } catch (error) {
      setClinics([]);
    }
  }

  useEffect(() => {
    loadClinics();
  }, []);

  function updateClinicField(field, value) {
    setClinicForm((prev) => ({ ...prev, [field]: value }));
  }

  function updateDoctorField(field, value) {
    setDoctorForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleClinicSubmit(event) {
    event.preventDefault();
    setClinicStatus({ type: '', message: '' });

    if (!token.trim()) {
      setClinicStatus({ type: 'error', message: 'Super admin token is required.' });
      return;
    }
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
          'x-super-admin-token': token.trim(),
        },
        body: JSON.stringify({
          ...clinicForm,
          slot_minutes: clinicForm.slot_minutes ? Number(clinicForm.slot_minutes) : null,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'Unable to save clinic.');
      }
      setClinicStatus({ type: 'success', message: 'Clinic saved successfully.' });
      setClinicForm((prev) => ({ ...prev, ...clinicDefaults, domain: prev.domain }));
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

    if (!token.trim()) {
      setDoctorStatus({ type: 'error', message: 'Super admin token is required.' });
      return;
    }
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
          'x-super-admin-token': token.trim(),
        },
        body: JSON.stringify(doctorForm),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'Unable to save doctor.');
      }
      setDoctorStatus({ type: 'success', message: 'Doctor saved successfully.' });
      setDoctorForm((prev) => ({ ...prev, ...doctorDefaults, clinic_domain: prev.clinic_domain }));
    } catch (error) {
      setDoctorStatus({ type: 'error', message: error.message || 'Unable to save doctor.' });
    } finally {
      setLoading((prev) => ({ ...prev, doctor: false }));
    }
  }

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
        <div className={styles.tokenPanel}>
          <label htmlFor="adminToken">Super admin token</label>
          <input
            id="adminToken"
            type="password"
            value={token}
            onChange={(event) => setToken(event.target.value)}
            placeholder="Paste token here"
          />
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
                <option value="sq">Albanian</option>
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
      </section>
    </main>
  );
}
