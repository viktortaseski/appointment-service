'use client';

import { useEffect, useMemo, useState } from 'react';
import { Fraunces, Manrope } from 'next/font/google';

import styles from './ClinicsPage.module.css';
import StarRating from '@/shared/components/StarRating';
import { useI18n } from '@/shared/i18n/I18nProvider';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api';

const displayFont = Fraunces({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  variable: '--font-display',
});

const bodyFont = Manrope({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-body',
});

function getClinicInitials(name) {
  if (!name) {
    return 'DC';
  }

  const parts = String(name)
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const letters = parts.slice(0, 2).map((part) => part[0].toUpperCase());
  return letters.join('') || 'DC';
}

function getShortAddress(address, fallback) {
  if (!address) {
    return fallback;
  }

  const trimmed = String(address).trim();
  if (!trimmed) {
    return fallback;
  }

  const parts = trimmed
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0]}, ${parts[1]}`;
  }

  if (trimmed.length > 44) {
    return `${trimmed.slice(0, 41)}...`;
  }

  return trimmed;
}

export default function ClinicsPage() {
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const [clinics, setClinics] = useState([]);
  const [status, setStatus] = useState({ loading: true, error: false });
  const [activeClinic, setActiveClinic] = useState(null);

  useEffect(() => {
    let isActive = true;

    async function loadClinics() {
      setStatus({ loading: true, error: false });

      try {
        const response = await fetch(`${API_BASE}/clinics`);
        if (!response.ok) {
          throw new Error('Clinic fetch failed');
        }

        const data = await response.json();
        if (!isActive) {
          return;
        }

        const normalized = (data.clinics || []).map((clinic) => ({
          id: clinic.id || clinic.domain || clinic.name,
          name: clinic.name || clinic.domain || 'Clinic',
          domain: clinic.domain || '',
          address: clinic.address || '',
          phone: clinic.phone || '',
          email: clinic.email || '',
          logo: clinic.logo || '',
          rating_avg: Number(clinic.rating_avg ?? clinic.ratingAvg ?? 0),
          rating_count: Number(clinic.rating_count ?? clinic.ratingCount ?? 0),
        }));

        normalized.sort((a, b) => a.name.localeCompare(b.name));
        setClinics(normalized);
        setStatus({ loading: false, error: false });
      } catch (error) {
        if (!isActive) {
          return;
        }

        setClinics([]);
        setStatus({ loading: false, error: true });
      }
    }

    loadClinics();

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    if (!activeClinic) {
      return undefined;
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setActiveClinic(null);
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [activeClinic]);

  const filteredClinics = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return clinics;
    }

    return clinics.filter((clinic) => {
      return [
        clinic.name,
        clinic.address,
        clinic.domain,
        clinic.phone,
        clinic.email,
      ]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(normalizedQuery));
    });
  }, [clinics, query]);

  const resultsCount = filteredClinics.length;
  const statusLabel = status.loading
    ? t('clinics_status_loading')
    : status.error
      ? t('clinics_status_error')
      : resultsCount === 1
        ? t('clinics_status_results_one', { count: resultsCount })
        : t('clinics_status_results_many', { count: resultsCount });

  return (
    <main className={`${styles.page} ${displayFont.variable} ${bodyFont.variable}`}>
      <div className={styles.backdrop} aria-hidden="true" />
      <header className={styles.header}>
        <a className={styles.brand} href="/">
          Dentra
        </a>
        <div className={styles.headerActions}>
          <a className={styles.ghostButton} href="/">
            {t('clinics_back_to_dentra')}
          </a>
          <a className={styles.primaryButton} href="mailto:info@dentra.mk">
            {t('clinics_contact')}
          </a>
        </div>
      </header>

      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>{t('clinics_eyebrow')}</p>
          <h1 className={styles.title}>{t('clinics_title')}</h1>
          <p className={styles.subtitle}>
            {t('clinics_subtitle')}
          </p>
        </div>
        <div className={styles.searchCard}>
          <label className={styles.searchLabel} htmlFor="clinic-search">
            {t('clinics_search_label')}
          </label>
          <div className={styles.searchBar}>
            <input
              id="clinic-search"
              className={styles.searchInput}
              type="search"
              placeholder={t('clinics_search_placeholder')}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <button className={styles.searchButton} type="button">
              {t('clinics_search_button')}
            </button>
          </div>
          <p className={styles.searchHint}>{t('clinics_search_hint')}</p>
        </div>
      </section>

      <section className={styles.resultsSection}>
        <div className={styles.resultsHeader}>
          <p className={styles.resultsLabel}>{statusLabel}</p>
          {!status.loading && !status.error && (
            <span className={styles.resultsPill}>{t('clinics_updated_live')}</span>
          )}
        </div>
        {status.loading && (
          <div className={styles.stateCard}>
            <p>{t('clinics_state_loading')}</p>
          </div>
        )}
        {!status.loading && status.error && (
          <div className={styles.stateCard}>
            <p>{t('clinics_state_error')}</p>
          </div>
        )}
        {!status.loading && !status.error && filteredClinics.length === 0 && (
          <div className={styles.stateCard}>
            <p>{t('clinics_state_empty')}</p>
          </div>
        )}
        {!status.loading && !status.error && filteredClinics.length > 0 && (
          <div className={styles.resultsGrid}>
            {filteredClinics.map((clinic) => {
              const clinicName = clinic.name || t('clinics_generic_name');
              const shortAddress = getShortAddress(
                clinic.address,
                t('clinics_address_placeholder')
              );
              const cardContent = (
                <>
                  <div className={styles.cardTop}>
                    <div className={styles.clinicMedia}>
                      {clinic.logo ? (
                        <img src={clinic.logo} alt={`${clinicName} logo`} loading="lazy" />
                      ) : (
                        <div className={styles.clinicBadge}>
                          {getClinicInitials(clinicName)}
                        </div>
                      )}
                    </div>
                    <div className={styles.cardDetails}>
                      <h3 className={styles.clinicName}>{clinicName}</h3>
                      <p className={styles.clinicMeta}>
                        {shortAddress}
                      </p>
                      <div className={styles.clinicRating}>
                        <StarRating value={clinic.rating_avg} size={16} />
                        {clinic.rating_count ? (
                          <span className={styles.clinicRatingValue}>
                            {`${Number(clinic.rating_avg).toFixed(1)} (${clinic.rating_count})`}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </>
              );

              return (
                <button
                  key={clinic.id}
                  type="button"
                  className={`${styles.clinicCard} ${styles.cardButton}`}
                  onClick={() => setActiveClinic(clinic)}
                >
                  {cardContent}
                </button>
              );
            })}
          </div>
        )}
      </section>
      {activeClinic ? (
        <div
          className={styles.modalOverlay}
          role="dialog"
          aria-modal="true"
          aria-label={t('clinics_modal_aria_label', {
            name: activeClinic.name || t('clinics_generic_name'),
          })}
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setActiveClinic(null);
            }
          }}
        >
          <div className={styles.modalCard} onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              className={styles.modalClose}
              onClick={() => setActiveClinic(null)}
              aria-label={t('clinics_modal_close_label')}
            >
              {t('clinics_modal_close')}
            </button>
            <div className={styles.modalHeader}>
              <div className={styles.modalMedia}>
                {activeClinic.logo ? (
                  <img
                    src={activeClinic.logo}
                    alt={`${activeClinic.name || t('clinics_generic_name')} logo`}
                  />
                ) : (
                  <div className={styles.modalBadge}>
                    {getClinicInitials(activeClinic.name || t('clinics_generic_name'))}
                  </div>
                )}
              </div>
              <div>
                <h2 className={styles.modalName}>
                  {activeClinic.name || t('clinics_generic_name')}
                </h2>
                <div className={styles.modalRating}>
                  <StarRating value={activeClinic.rating_avg} size={18} />
                  {activeClinic.rating_count ? (
                    <span className={styles.modalRatingValue}>
                      {`${Number(activeClinic.rating_avg).toFixed(1)} (${activeClinic.rating_count})`}
                    </span>
                  ) : null}
                </div>
                <p className={styles.modalAddress}>
                  {activeClinic.address || t('clinics_address_placeholder')}
                </p>
              </div>
            </div>
            <div className={styles.modalDetails}>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>{t('clinics_detail_phone')}</span>
                <span className={styles.detailValue}>{activeClinic.phone || '—'}</span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>{t('clinics_detail_email')}</span>
                <span className={styles.detailValue}>{activeClinic.email || '—'}</span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>{t('clinics_detail_domain')}</span>
                <span className={styles.detailValue}>{activeClinic.domain || '—'}</span>
              </div>
            </div>
            <div className={styles.modalActions}>
              {activeClinic.domain ? (
                <a
                  className={styles.primaryButton}
                  href={`https://${activeClinic.domain}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {t('clinics_open_booking')}
                </a>
              ) : null}
              <button
                type="button"
                className={styles.ghostButton}
                onClick={() => setActiveClinic(null)}
              >
                {t('clinics_modal_close')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
