'use client';

import { useI18n } from '@/shared/i18n/I18nProvider';

function getInitials(name) {
  if (!name) {
    return '';
  }

  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');
}

export default function DoctorsSection({
  clinic,
  doctors,
  status,
  onBookDoctor,
  availabilityLabel,
}) {
  const { t } = useI18n();
  const clinicName = clinic?.name || t('brand_title_fallback');
  const doctorSkeletons = Array.from({ length: 4 });

  return (
    <section className="section" id="doctors">
      <div className="section-header">
        <div>
          <p className="eyebrow">{t('meet_care_team')}</p>
          <h2>{t('care_team_title', { clinic: clinicName })}</h2>
          <p className="section-subtitle">
            {t('care_team_subtitle')}
          </p>
        </div>
      </div>
      {status.loading && (
        <>
          <div className="card-grid skeleton-grid" aria-hidden="true">
            {doctorSkeletons.map((_, index) => (
              <div key={`doctor-skeleton-${index}`} className="card skeleton-card">
                <div className="doctor-card-profile">
                  <div className="doctor-card-avatar skeleton" />
                  <div className="skeleton-stack">
                    <div className="skeleton-line skeleton medium" />
                    <div className="skeleton-line skeleton short" />
                    <div className="skeleton-line skeleton" />
                  </div>
                </div>
                <div className="skeleton-stack">
                  <div className="skeleton-line skeleton short" />
                  <div className="skeleton-line skeleton medium" />
                </div>
                <div className="skeleton-line skeleton pill" />
              </div>
            ))}
          </div>
          <span className="sr-only">{t('loading_doctors')}</span>
        </>
      )}
      {!status.loading && status.error && (
        <p className="status error">
          {status.error}. {t('doctors_load_error')}
        </p>
      )}
      {!status.loading && !status.error && (
        <div className="card-grid">
          {doctors.map((doctor, index) => (
            <article
              className="card doctor"
              key={doctor.id}
              style={{ animationDelay: `${index * 120}ms` }}
            >
              <div className="doctor-card-profile">
                <div className="doctor-card-avatar">
                  {doctor.avatar ? (
                    <img src={doctor.avatar} alt={doctor.name} />
                  ) : (
                    <span>{getInitials(doctor.name)}</span>
                  )}
                </div>
                <div>
                  <p className="doctor-name">{doctor.name}</p>
                  <p className="doctor-specialty">{doctor.specialty}</p>
                  <p
                    className={`doctor-description${doctor.description ? '' : ' placeholder'}`}
                  >
                    {doctor.description || ' '}
                  </p>
                </div>
              </div>
              <div>
                <p className="doctor-clinic">{clinicName}</p>
                <p className="doctor-availability">
                  {availabilityLabel || t('availability_label')}
                </p>
              </div>
              <button
                type="button"
                className="ghost"
                onClick={() => onBookDoctor?.(doctor.id)}
                disabled={doctor.is_disabled}
              >
                {t('book_with_doctor')}
              </button>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
