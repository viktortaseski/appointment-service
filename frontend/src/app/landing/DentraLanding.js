'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Fraunces, Manrope } from 'next/font/google';

import styles from './DentraLanding.module.css';
import { defaultLanguage, languageOptions, translations } from './translations';
import StarRating from '@/shared/components/StarRating';

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

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api';
const PROTOTYPE_URL = 'https://vivadent.onrender.com/';
// TODO: Swap to https://booking.dentra.mk/ for production.

const imageSources = {
  hero: 'https://res.cloudinary.com/dfuieb3iz/image/upload/v1769091300/Dental_smiling_girl_no-copyight_lxgnue.jpg',
  schedule: 'https://res.cloudinary.com/dfuieb3iz/image/upload/v1769091132/adminpage_kbylar.png',
  brand: '/landing/brand.svg',
  cartographyLanding: 'https://res.cloudinary.com/dfuieb3iz/image/upload/v1773951788/landing_igik12.png',
  cartographyTreatments: 'https://res.cloudinary.com/dfuieb3iz/image/upload/v1773951787/treatments_vwskb0.png',
  cartographyRevenue: 'https://res.cloudinary.com/dfuieb3iz/image/upload/v1773951787/revenue_oqus4w.png',
  cartographySettings: 'https://res.cloudinary.com/dfuieb3iz/image/upload/v1773951787/settings_si100m.png',
  cartographyCalendar: 'https://res.cloudinary.com/dfuieb3iz/image/upload/v1773951787/calendar_ozlyd4.png',
};

function normalizeLanguage(value) {
  if (!value) return '';
  const trimmed = String(value).toLowerCase();
  return translations[trimmed] ? trimmed : '';
}

function getClinicInitials(name) {
  if (!name) return 'DC';
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  const letters = parts.slice(0, 2).map((part) => part[0].toUpperCase());
  return letters.join('') || 'DC';
}

export default function DentraLanding() {
  const [language, setLanguage] = useState(defaultLanguage);
  const [isMobile, setIsMobile] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [lightbox, setLightbox] = useState(null);
  const [clinics, setClinics] = useState([]);
  const [clinicStatus, setClinicStatus] = useState({ loading: true, error: false });
  const headerRef = useRef(null);
  const sectionRefs = useRef([]);
  const highlightGridRef = useRef(null);
  const offeringsGridRef = useRef(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = normalizeLanguage(window.localStorage.getItem('dentraLandingLanguage'));
    const browser = normalizeLanguage((navigator.language || '').slice(0, 2));
    const nextLanguage = stored || browser || defaultLanguage;
    if (nextLanguage !== language) setLanguage(nextLanguage);
  }, [language]);

  const content = translations[language] || translations[defaultLanguage];

  const highlights = useMemo(
    () => [
      { title: content.highlight1Title, description: content.highlight1Body },
      { title: content.highlight2Title, description: content.highlight2Body },
      { title: content.highlight3Title, description: content.highlight3Body },
    ],
    [content]
  );

  const offerings = useMemo(
    () => [
      { title: content.offering1Title, description: content.offering1Body },
      { title: content.offering2Title, description: content.offering2Body },
      { title: content.offering3Title, description: content.offering3Body },
      { title: content.offering4Title, description: content.offering4Body },
      { title: content.offering5Title, description: content.offering5Body },
      { title: content.offering6Title, description: content.offering6Body },
    ],
    [content]
  );

  const steps = useMemo(
    () => [
      { title: content.step1Title, description: content.step1Body },
      { title: content.step2Title, description: content.step2Body },
      { title: content.step3Title, description: content.step3Body },
    ],
    [content]
  );

  const highlightItems = useMemo(
    () => (isMobile ? [...highlights, ...highlights, ...highlights] : highlights),
    [highlights, isMobile]
  );

  const offeringItems = useMemo(
    () => (isMobile ? [...offerings, ...offerings, ...offerings] : offerings),
    [offerings, isMobile]
  );

  const marqueeClinics = useMemo(() => {
    if (!clinics.length) return [];
    const minimum = 8;
    const repeats = Math.max(1, Math.ceil(minimum / clinics.length));
    const expanded = Array.from({ length: repeats }, () => clinics).flat();
    return [...expanded, ...expanded];
  }, [clinics]);

  const marqueeDuration = useMemo(() => {
    const base = clinics.length || 6;
    return Math.min(80, Math.max(28, base * 6));
  }, [clinics.length]);

  const handleNavClick = useCallback((event) => {
    const targetId = event.currentTarget.getAttribute('data-target');
    if (!targetId) return;
    event.preventDefault();
    setIsMenuOpen(false);
    const target = document.getElementById(targetId);
    if (target) {
      const headerOffset = headerRef.current?.offsetHeight ?? 0;
      const elementTop = target.getBoundingClientRect().top + window.scrollY;
      const offsetPosition = Math.max(0, elementTop - headerOffset - 16);
      window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
      target.focus({ preventScroll: true });
    } else {
      window.location.hash = targetId;
    }
  }, []);

  const handleLanguageChange = useCallback((event) => {
    const nextLanguage = normalizeLanguage(event.target.value) || defaultLanguage;
    setLanguage(nextLanguage);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('dentraLandingLanguage', nextLanguage);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const mediaQuery = window.matchMedia('(max-width: 768px)');
    const updateMatch = () => setIsMobile(mediaQuery.matches);
    updateMatch();
    mediaQuery.addEventListener('change', updateMatch);
    return () => mediaQuery.removeEventListener('change', updateMatch);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add(styles.sectionVisible);
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1 }
    );
    const observed = sectionRefs.current.filter(Boolean);
    observed.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isMobile) return undefined;
    const setupInfiniteScroll = (container) => {
      if (!container || container.scrollWidth <= container.clientWidth) return () => {};
      const segment = container.scrollWidth / 3;
      container.scrollLeft = segment;
      let isAdjusting = false;
      const handleScroll = () => {
        if (isAdjusting) return;
        const leftEdge = segment * 0.5;
        const rightEdge = segment * 1.5;
        const current = container.scrollLeft;
        if (current <= leftEdge) {
          isAdjusting = true;
          container.scrollLeft = current + segment;
          requestAnimationFrame(() => { isAdjusting = false; });
        } else if (current >= rightEdge) {
          isAdjusting = true;
          container.scrollLeft = current - segment;
          requestAnimationFrame(() => { isAdjusting = false; });
        }
      };
      container.addEventListener('scroll', handleScroll);
      return () => container.removeEventListener('scroll', handleScroll);
    };
    const cleanups = [
      setupInfiniteScroll(highlightGridRef.current),
      setupInfiniteScroll(offeringsGridRef.current),
    ];
    return () => { cleanups.forEach((cleanup) => cleanup()); };
  }, [isMobile, highlightItems, offeringItems]);

  useEffect(() => {
    let isActive = true;
    async function loadClinics() {
      setClinicStatus({ loading: true, error: false });
      try {
        const response = await fetch(`${API_BASE}/clinics`);
        if (!response.ok) throw new Error('Clinic fetch failed');
        const data = await response.json();
        if (!isActive) return;
        const normalized = (data.clinics || [])
          .filter((clinic) => {
            const d = (clinic.domain || '').toLowerCase();
            return d && !/localhost|\.local$|127\.0\.0\.1|::1/.test(d);
          })
          .map((clinic) => ({
            id: clinic.id || clinic.domain || clinic.name,
            name: clinic.name || clinic.domain || 'Clinic',
            domain: clinic.domain || '',
            address: clinic.address || '',
            phone: clinic.phone || '',
            logo: clinic.logo || '',
            rating_avg: Number(clinic.rating_avg ?? clinic.ratingAvg ?? 0),
            rating_count: Number(clinic.rating_count ?? clinic.ratingCount ?? 0),
          }));
        setClinics(normalized);
        setClinicStatus({ loading: false, error: false });
      } catch {
        if (!isActive) return;
        setClinics([]);
        setClinicStatus({ loading: false, error: true });
      }
    }
    loadClinics();
    return () => { isActive = false; };
  }, []);

  const cartographyThumbs = [
    { src: imageSources.cartographyTreatments, label: content.cartographyThumb1 },
    { src: imageSources.cartographyRevenue, label: content.cartographyThumb2 },
    { src: imageSources.cartographySettings, label: content.cartographyThumb3 },
    { src: imageSources.cartographyCalendar, label: content.cartographyThumb4 },
  ];

  const cartographyFeatures = [
    content.cartographyFeature1,
    content.cartographyFeature2,
    content.cartographyFeature3,
    content.cartographyFeature4,
    content.cartographyFeature5,
    content.cartographyFeature6,
  ];

  return (
    <>
      {lightbox && (
        <div
          className={styles.lightboxOverlay}
          onClick={() => setLightbox(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Image preview"
        >
          <button
            type="button"
            className={styles.lightboxClose}
            onClick={() => setLightbox(null)}
            aria-label="Close preview"
          >
            ×
          </button>
          <img
            className={styles.lightboxImg}
            src={lightbox}
            alt="Preview"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      <main className={`${styles.page} ${displayFont.variable} ${bodyFont.variable}`}>

        {/* ── Header ── */}
        <header className={styles.header} ref={headerRef}>
          <div className={styles.headerInner}>
            <a className={styles.brand} href="/">
              <img
                className={styles.logoImage}
                src="https://res.cloudinary.com/dfuieb3iz/image/upload/v1769096434/logo_y76eph.png"
                alt={content.brandName}
              />
              <span className={styles.brandName}>{content.brandName}</span>
            </a>

            <nav className={styles.nav} aria-label="Main navigation">
              <a href="#about" data-target="about" onClick={handleNavClick}>
                {content.navAbout}
              </a>
              <a href="#cartography" data-target="cartography" onClick={handleNavClick}>
                {content.navCartography}
              </a>
              <a href="/clinics">{content.navClinics}</a>
            </nav>

            <div className={styles.headerRight}>
              <select
                className={styles.languageSelect}
                value={language}
                onChange={handleLanguageChange}
                aria-label={content.navLanguageLabel}
              >
                {languageOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <a className={styles.contactBtn} href="mailto:info@dentra.mk">
                {content.navContact}
              </a>
            </div>

            <button
              type="button"
              className={styles.menuButton}
              aria-label="Toggle menu"
              aria-expanded={isMenuOpen}
              onClick={() => setIsMenuOpen((prev) => !prev)}
            >
              <span />
              <span />
              <span />
            </button>
          </div>

          {isMenuOpen && (
            <div className={styles.mobileMenu}>
              <nav className={styles.mobileNav}>
                <a href="#about" data-target="about" onClick={handleNavClick}>
                  {content.navAbout}
                </a>
                <a href="#cartography" data-target="cartography" onClick={handleNavClick}>
                  {content.navCartography}
                </a>
                <a href="/clinics">{content.navClinics}</a>
              </nav>
              <div className={styles.mobileActions}>
                <select
                  className={styles.languageSelect}
                  value={language}
                  onChange={handleLanguageChange}
                >
                  {languageOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                <a className={styles.contactBtn} href="mailto:info@dentra.mk">
                  {content.navContact}
                </a>
              </div>
            </div>
          )}
        </header>

        {/* ── Hero ── */}
        <section className={styles.hero}>
          <div className={styles.heroContent}>
            <p className={styles.heroEyebrow}>{content.heroEyebrow}</p>
            <h1 className={styles.heroTitle}>{content.heroTitle}</h1>
            <p className={styles.heroBody}>{content.heroBody}</p>
            <div className={styles.heroActions}>
              <a
                className={styles.btnPrimary}
                href="#cartography"
                data-target="cartography"
                onClick={handleNavClick}
              >
                {content.heroPrimary}
              </a>
              <a
                className={styles.btnSecondary}
                href={PROTOTYPE_URL}
                target="_blank"
                rel="noreferrer"
              >
                {content.heroSecondary}
              </a>
            </div>
          </div>
          <div className={styles.heroVisual}>
            <img src={imageSources.hero} alt={content.imgAltHero} />
          </div>
        </section>

        {/* ── Booking Platform — dark section ── */}
        <section
          id="about"
          className={`${styles.bookingSection} ${styles.scrollAnchor} ${styles.sectionReveal}`}
          tabIndex={-1}
          ref={(node) => { sectionRefs.current[1] = node; }}
        >
          <div className={styles.bookingInner}>
            <div className={styles.bookingText}>
              <p className={styles.eyebrowLight}>{content.aboutEyebrow}</p>
              <h2 className={styles.productTitle}>{content.aboutTitle}</h2>
              <p className={styles.productBody}>{content.aboutBody}</p>
              <ul className={styles.highlightList}>
                {highlights.map((h) => (
                  <li key={h.title} className={styles.highlightItem}>
                    <span className={styles.highlightDot} />
                    <div>
                      <strong>{h.title}</strong>
                      <p>{h.description}</p>
                    </div>
                  </li>
                ))}
              </ul>
              <a className={styles.btnPrimaryLight} href={PROTOTYPE_URL} target="_blank" rel="noreferrer">
                {content.prototypePrimary}
              </a>
            </div>
            <div className={styles.bookingVisual}>
              <img
                src={imageSources.schedule}
                alt={content.imgAltSchedule}
                loading="lazy"
                className={styles.clickableImage}
                onClick={() => setLightbox(imageSources.schedule)}
              />
            </div>
          </div>
        </section>

        {/* ── Dental Cartography — light section ── */}
        <section
          id="cartography"
          className={`${styles.cartographySection} ${styles.scrollAnchor} ${styles.sectionReveal}`}
          tabIndex={-1}
          ref={(node) => { sectionRefs.current[6] = node; }}
        >
          <div className={styles.cartographyInner}>
            <p className={styles.eyebrow}>{content.cartographyEyebrow}</p>
            <h2 className={styles.cartographyTitle}>{content.cartographyTitle}</h2>
            <p className={styles.cartographyTagline}>{content.cartographyBody}</p>

            <div className={styles.cartographyHeroShot}>
              <img
                src={imageSources.cartographyLanding}
                alt="Dental Cartography"
                loading="lazy"
                className={styles.clickableImage}
                onClick={() => setLightbox(imageSources.cartographyLanding)}
              />
            </div>

            <div className={styles.cartographyStrip}>
              {cartographyThumbs.map(({ src, label }) => (
                <button
                  key={label}
                  type="button"
                  className={styles.cartographyThumb}
                  onClick={() => setLightbox(src)}
                >
                  <img src={src} alt={label} loading="lazy" />
                  <span>{label}</span>
                </button>
              ))}
            </div>

            <div className={styles.cartographyMeta}>
              <ul className={styles.cartographyFeatureList}>
                {cartographyFeatures.map((feat) => (
                  <li key={feat}>{feat}</li>
                ))}
              </ul>
              <a className={styles.btnPrimary} href="mailto:info@dentra.mk">
                {content.cartographyCta}
              </a>
            </div>
          </div>
        </section>

        {/* ── Clinics Marquee ── */}
        <section
          id="clinics"
          className={`${styles.clinicsSection} ${styles.scrollAnchor} ${styles.sectionReveal}`}
          tabIndex={-1}
          ref={(node) => { sectionRefs.current[0] = node; }}
        >
          <div className={styles.clinicsHeader}>
            <p className={styles.eyebrow}>{content.clinicsEyebrow}</p>
            <h2 className={styles.clinicsTitle}>{content.clinicsTitle}</h2>
          </div>
          <div className={styles.clinicMarquee} aria-live="polite">
            {clinicStatus.loading && (
              <p className={styles.clinicStatus}>{content.clinicsLoading}</p>
            )}
            {!clinicStatus.loading && clinicStatus.error && (
              <p className={styles.clinicStatus}>{content.clinicsLoadError}</p>
            )}
            {!clinicStatus.loading && !clinicStatus.error && clinics.length === 0 && (
              <p className={styles.clinicStatus}>{content.clinicsEmpty}</p>
            )}
            {!clinicStatus.loading && !clinicStatus.error && clinics.length > 0 && (
              <div
                className={styles.clinicTrack}
                style={{ '--marquee-duration': `${marqueeDuration}s` }}
              >
                {marqueeClinics.map((clinic, index) => {
                  const isExternal = Boolean(clinic.domain);
                  const href = isExternal ? `https://${clinic.domain}` : '/clinics';
                  return (
                    <a
                      key={`${clinic.id}-${index}`}
                      className={styles.clinicCard}
                      href={href}
                      target={isExternal ? '_blank' : undefined}
                      rel={isExternal ? 'noreferrer' : undefined}
                    >
                      <div className={styles.clinicMedia}>
                        {clinic.logo ? (
                          <img src={clinic.logo} alt={`${clinic.name} logo`} loading="lazy" />
                        ) : (
                          <div className={styles.clinicBadge}>{getClinicInitials(clinic.name)}</div>
                        )}
                      </div>
                      <div className={styles.clinicInfo}>
                        <p className={styles.clinicName}>{clinic.name}</p>
                        <p className={styles.clinicMeta}>
                          {clinic.address || clinic.domain || content.clinicsFallbackMeta}
                        </p>
                        <div className={styles.clinicRating}>
                          <StarRating value={clinic.rating_avg} size={14} />
                          <span>
                            {clinic.rating_count
                              ? `${Number(clinic.rating_avg).toFixed(1)} (${clinic.rating_count})`
                              : content.clinicsRatingNew}
                          </span>
                        </div>
                      </div>
                    </a>
                  );
                })}
              </div>
            )}
          </div>
          <div className={styles.clinicsFooter}>
            <a className={styles.btnSecondary} href="/clinics">{content.clinicsAction}</a>
          </div>
        </section>

        {/* ── How it works ── */}
        <section
          id="timeline"
          className={`${styles.timelineSection} ${styles.scrollAnchor} ${styles.sectionReveal}`}
          tabIndex={-1}
          ref={(node) => { sectionRefs.current[3] = node; }}
        >
          <div className={styles.timelineInner}>
            <p className={styles.eyebrow}>{content.timelineEyebrow}</p>
            <h2 className={styles.timelineHeading}>{content.timelineTitle}</h2>
            <div className={styles.timelineSteps}>
              {steps.map((step, i) => (
                <div key={step.title} className={styles.timelineStep}>
                  <span className={styles.stepNum}>{String(i + 1).padStart(2, '0')}</span>
                  <h3 className={styles.stepTitle}>{step.title}</h3>
                  <p className={styles.stepBody}>{step.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA Band ── */}
        <section
          className={`${styles.ctaBand} ${styles.sectionReveal}`}
          ref={(node) => { sectionRefs.current[5] = node; }}
        >
          <div className={styles.ctaInner}>
            <h2 className={styles.ctaTitle}>{content.ctaTitle}</h2>
            <p className={styles.ctaBody}>{content.ctaBody}</p>
            <a className={styles.btnPrimaryLight} href="mailto:info@dentra.mk">
              {content.ctaButton}
            </a>
          </div>
        </section>

        {/* ── Footer ── */}
        <footer className={styles.footer}>
          <p>© {new Date().getFullYear()} {content.footerSuffix}</p>
          <p>
            {content.footerContactLabel}{' '}
            <a href="mailto:info@dentra.mk">info@dentra.mk</a>
            {' · '}
            <a href="mailto:support@dentra.mk">support@dentra.mk</a>
          </p>
        </footer>

      </main>
    </>
  );
}
