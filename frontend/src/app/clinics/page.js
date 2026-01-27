'use client';

import { useEffect, useMemo, useState } from 'react';
import { Fraunces, Manrope } from 'next/font/google';

import styles from './ClinicsPage.module.css';
import StarRating from '@/components/StarRating';

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

function getShortAddress(address) {
  if (!address) {
    return 'Address coming soon';
  }

  const trimmed = String(address).trim();
  if (!trimmed) {
    return 'Address coming soon';
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

  const statusLabel = status.loading
    ? 'Loading clinics...'
    : status.error
      ? 'Unable to load clinics right now.'
      : `${filteredClinics.length} clinic${filteredClinics.length === 1 ? '' : 's'} found`;

  return (
    <main className={`${styles.page} ${displayFont.variable} ${bodyFont.variable}`}>
      <div className={styles.backdrop} aria-hidden="true" />
      <header className={styles.header}>
        <a className={styles.brand} href="/">
          Dentra
        </a>
        <div className={styles.headerActions}>
          <a className={styles.ghostButton} href="/">
            Back to Dentra
          </a>
          <a className={styles.primaryButton} href="mailto:info@dentra.mk">
            Contact
          </a>
        </div>
      </header>

      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>Clinic directory</p>
          <h1 className={styles.title}>Find a Dentra clinic</h1>
          <p className={styles.subtitle}>
            Search by clinic name, city, or domain to discover where Dentra is live.
          </p>
        </div>
        <div className={styles.searchCard}>
          <label className={styles.searchLabel} htmlFor="clinic-search">
            Search clinics
          </label>
          <div className={styles.searchBar}>
            <input
              id="clinic-search"
              className={styles.searchInput}
              type="search"
              placeholder="Search clinics, cities, or domains"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <button className={styles.searchButton} type="button">
              Search
            </button>
          </div>
          <p className={styles.searchHint}>Try: Skopje, vivadent, dentra.mk</p>
        </div>
      </section>

      <section className={styles.resultsSection}>
        <div className={styles.resultsHeader}>
          <p className={styles.resultsLabel}>{statusLabel}</p>
          {!status.loading && !status.error && (
            <span className={styles.resultsPill}>Updated live</span>
          )}
        </div>
        {status.loading && (
          <div className={styles.stateCard}>
            <p>Loading the Dentra clinic directory...</p>
          </div>
        )}
        {!status.loading && status.error && (
          <div className={styles.stateCard}>
            <p>We could not load clinics. Please try again soon.</p>
          </div>
        )}
        {!status.loading && !status.error && filteredClinics.length === 0 && (
          <div className={styles.stateCard}>
            <p>No clinics match your search yet.</p>
          </div>
        )}
        {!status.loading && !status.error && filteredClinics.length > 0 && (
          <div className={styles.resultsGrid}>
            {filteredClinics.map((clinic) => {
              const shortAddress = getShortAddress(clinic.address);
              const cardContent = (
                <>
                  <div className={styles.cardTop}>
                    <div className={styles.clinicMedia}>
                      {clinic.logo ? (
                        <img src={clinic.logo} alt={`${clinic.name} logo`} loading="lazy" />
                      ) : (
                        <div className={styles.clinicBadge}>
                          {getClinicInitials(clinic.name)}
                        </div>
                      )}
                    </div>
                    <div className={styles.cardDetails}>
                      <h3 className={styles.clinicName}>{clinic.name}</h3>
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
          aria-label={`${activeClinic.name} details`}
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
              aria-label="Close clinic details"
            >
              Close
            </button>
            <div className={styles.modalHeader}>
              <div className={styles.modalMedia}>
                {activeClinic.logo ? (
                  <img src={activeClinic.logo} alt={`${activeClinic.name} logo`} />
                ) : (
                  <div className={styles.modalBadge}>{getClinicInitials(activeClinic.name)}</div>
                )}
              </div>
              <div>
                <h2 className={styles.modalName}>{activeClinic.name}</h2>
                <div className={styles.modalRating}>
                  <StarRating value={activeClinic.rating_avg} size={18} />
                  {activeClinic.rating_count ? (
                    <span className={styles.modalRatingValue}>
                      {`${Number(activeClinic.rating_avg).toFixed(1)} (${activeClinic.rating_count})`}
                    </span>
                  ) : null}
                </div>
                <p className={styles.modalAddress}>
                  {activeClinic.address || 'Address coming soon'}
                </p>
              </div>
            </div>
            <div className={styles.modalDetails}>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Phone</span>
                <span className={styles.detailValue}>{activeClinic.phone || '—'}</span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Email</span>
                <span className={styles.detailValue}>{activeClinic.email || '—'}</span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Domain</span>
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
                  Open booking page
                </a>
              ) : null}
              <button
                type="button"
                className={styles.ghostButton}
                onClick={() => setActiveClinic(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
