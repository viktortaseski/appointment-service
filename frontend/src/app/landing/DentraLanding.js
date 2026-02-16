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
};

function normalizeLanguage(value) {
  if (!value) {
    return '';
  }

  const trimmed = String(value).toLowerCase();
  return translations[trimmed] ? trimmed : '';
}

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

export default function DentraLanding() {
  const [language, setLanguage] = useState(defaultLanguage);
  const [isMobile, setIsMobile] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [clinics, setClinics] = useState([]);
  const [clinicStatus, setClinicStatus] = useState({ loading: true, error: false });
  const headerRef = useRef(null);
  const sectionRefs = useRef([]);
  const highlightGridRef = useRef(null);
  const offeringsGridRef = useRef(null);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const stored = normalizeLanguage(window.localStorage.getItem('dentraLandingLanguage'));
    const browser = normalizeLanguage((navigator.language || '').slice(0, 2));
    const nextLanguage = stored || browser || defaultLanguage;

    if (nextLanguage !== language) {
      setLanguage(nextLanguage);
    }
  }, [language]);

  const content = translations[language] || translations[defaultLanguage];

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

  const highlights = useMemo(
    () => [
      { title: content.highlight1Title, description: content.highlight1Body },
      { title: content.highlight2Title, description: content.highlight2Body },
      { title: content.highlight3Title, description: content.highlight3Body },
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
    if (!clinics.length) {
      return [];
    }

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
    if (!targetId) {
      return;
    }

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
    if (typeof window === 'undefined') {
      return undefined;
    }

    const mediaQuery = window.matchMedia('(max-width: 768px)');
    const updateMatch = () => setIsMobile(mediaQuery.matches);
    updateMatch();
    mediaQuery.addEventListener('change', updateMatch);
    return () => mediaQuery.removeEventListener('change', updateMatch);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add(styles.sectionVisible);
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 }
    );

    const observed = sectionRefs.current.filter(Boolean);
    observed.forEach((node) => observer.observe(node));

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isMobile) {
      return undefined;
    }

    const setupInfiniteScroll = (container) => {
      if (!container || container.scrollWidth <= container.clientWidth) {
        return () => {};
      }

      const segment = container.scrollWidth / 3;
      container.scrollLeft = segment;
      let isAdjusting = false;

      const handleScroll = () => {
        if (isAdjusting) {
          return;
        }

        const leftEdge = segment * 0.5;
        const rightEdge = segment * 1.5;
        const current = container.scrollLeft;

        if (current <= leftEdge) {
          isAdjusting = true;
          container.scrollLeft = current + segment;
          requestAnimationFrame(() => {
            isAdjusting = false;
          });
        } else if (current >= rightEdge) {
          isAdjusting = true;
          container.scrollLeft = current - segment;
          requestAnimationFrame(() => {
            isAdjusting = false;
          });
        }
      };

      container.addEventListener('scroll', handleScroll);
      return () => container.removeEventListener('scroll', handleScroll);
    };

    const cleanups = [
      setupInfiniteScroll(highlightGridRef.current),
      setupInfiniteScroll(offeringsGridRef.current),
    ];

    return () => {
      cleanups.forEach((cleanup) => cleanup());
    };
  }, [isMobile, highlightItems, offeringItems]);

  useEffect(() => {
    let isActive = true;

    async function loadClinics() {
      setClinicStatus({ loading: true, error: false });

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
          logo: clinic.logo || '',
          rating_avg: Number(clinic.rating_avg ?? clinic.ratingAvg ?? 0),
          rating_count: Number(clinic.rating_count ?? clinic.ratingCount ?? 0),
        }));
        setClinics(normalized);
        setClinicStatus({ loading: false, error: false });
      } catch (error) {
        if (!isActive) {
          return;
        }
        setClinics([]);
        setClinicStatus({ loading: false, error: true });
      }
    }

    loadClinics();

    return () => {
      isActive = false;
    };
  }, []);

  return (
    <main className={`${styles.page} ${displayFont.variable} ${bodyFont.variable}`}>
      <div className={styles.backdrop} aria-hidden="true" />
      <header className={styles.header} ref={headerRef}>
        <div className={styles.brand}>
          <img
            className={styles.logoImage}
            src="https://res.cloudinary.com/dfuieb3iz/image/upload/v1769096434/logo_y76eph.png"
            alt={`${content.brandName} logo`}
          />
          <div>
            <p className={styles.brandName}>{content.brandName}</p>
            <p className={styles.brandTagline}>{content.brandTagline}</p>
          </div>
        </div>
        <nav className={styles.nav} aria-label="Landing navigation">
          <a href="#about" data-target="about" onClick={handleNavClick}>
            {content.navAbout}
          </a>
          <a href="#offerings" data-target="offerings" onClick={handleNavClick}>
            {content.navOfferings}
          </a>
          <a href="/clinics">
            {content.navClinics}
          </a>
        </nav>
        <button
          type="button"
          className={styles.menuButton}
          aria-label="Open navigation menu"
          aria-expanded={isMenuOpen}
          onClick={() => setIsMenuOpen((prev) => !prev)}
        >
          <span />
          <span />
          <span />
        </button>
        <div className={styles.headerActions}>
          <label className={styles.languageLabel} htmlFor="landing-language">
            {content.navLanguageLabel}
          </label>
          <select
            id="landing-language"
            className={styles.languageSelect}
            value={language}
            onChange={handleLanguageChange}
          >
            {languageOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <a className={styles.primaryButton} href={PROTOTYPE_URL} target="_blank" rel="noreferrer">
            {content.headerCta}
          </a>
        </div>
        <div className={`${styles.mobileMenu} ${isMenuOpen ? styles.mobileMenuOpen : ''}`}>
          <nav className={styles.mobileNav} aria-label="Mobile navigation">
            <a href="#about" data-target="about" onClick={handleNavClick}>
              {content.navAbout}
            </a>
            <a href="#offerings" data-target="offerings" onClick={handleNavClick}>
              {content.navOfferings}
            </a>
            <a href="/clinics">
              {content.navClinics}
            </a>
          </nav>
          <div className={styles.mobileActions}>
            <label className={styles.languageLabel} htmlFor="landing-language-mobile">
              {content.navLanguageLabel}
            </label>
            <select
              id="landing-language-mobile"
              className={styles.languageSelect}
              value={language}
              onChange={handleLanguageChange}
            >
              {languageOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <a className={styles.primaryButton} href={PROTOTYPE_URL} target="_blank" rel="noreferrer">
              {content.headerCta}
            </a>
          </div>
        </div>
      </header>

      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <span className={styles.heroEyebrow}>{content.heroEyebrow}</span>
          <h1 className={styles.heroTitle}>{content.heroTitle}</h1>
          <p className={styles.heroBody}>{content.heroBody}</p>
          <div className={styles.heroActions}>
            <a className={styles.primaryButton} href={PROTOTYPE_URL} target="_blank" rel="noreferrer">
              {content.heroPrimary}
            </a>
            <a className={styles.secondaryButton} href="#prototype" data-target="prototype" onClick={handleNavClick}>
              {content.heroSecondary}
            </a>
          </div>
          <div className={styles.heroImageWrap}>
            <img className={styles.heroImage} src={imageSources.hero} alt={content.imgAltHero} />
          </div>
          <div className={styles.heroStats}>
            <div>
              <p className={styles.statValue}>{content.stat1Value}</p>
              <p className={styles.statLabel}>{content.stat1Label}</p>
            </div>
            <div>
              <p className={styles.statValue}>{content.stat2Value}</p>
              <p className={styles.statLabel}>{content.stat2Label}</p>
            </div>
            <div>
              <p className={styles.statValue}>{content.stat3Value}</p>
              <p className={styles.statLabel}>{content.stat3Label}</p>
            </div>
          </div>
        </div>
        <div className={styles.heroMedia}>
          <div className={styles.heroThumbs}>
            <div className={styles.thumbCard}>
              <img src={imageSources.schedule} alt={content.imgAltSchedule} />
              <p>{content.galleryCaption2}</p>
            </div>
          </div>
          <div className={styles.heroCard} style={{ height: 'fit-content' }}>
            <p className={styles.cardTitle}>{content.heroCardTitle}</p>
            <ul className={styles.cardList}>
              <li>{content.heroCardItem1}</li>
              <li>{content.heroCardItem2}</li>
              <li>{content.heroCardItem3}</li>
              <li>{content.heroCardItem4}</li>
              <li>{content.heroCardItem5}</li>
            </ul>
            <div className={styles.cardFooter}>
              <span>{content.heroCardFooter}</span>
              <a href={PROTOTYPE_URL} target="_blank" rel="noreferrer">
                vivadent.onrender.com
              </a>
            </div>
          </div>
        </div>
      </section>

      <section
        id="clinics"
        className={`${styles.section} ${styles.scrollAnchor} ${styles.sectionReveal}`}
        tabIndex={-1}
        ref={(node) => {
          sectionRefs.current[0] = node;
        }}
      >
        <div className={styles.sectionHeader}>
          <p className={styles.sectionEyebrow}>{content.clinicsEyebrow}</p>
          <h2 className={styles.sectionTitle}>{content.clinicsTitle}</h2>
          <p className={styles.sectionBody}>{content.clinicsBody}</p>
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
                const cardContent = (
                  <>
                    <div className={styles.clinicMedia}>
                      {clinic.logo ? (
                        <img
                          src={clinic.logo}
                          alt={`${clinic.name} logo`}
                          loading="lazy"
                        />
                      ) : (
                        <div className={styles.clinicBadge}>
                          {getClinicInitials(clinic.name)}
                        </div>
                      )}
                    </div>
                    <div className={styles.clinicInfo}>
                      <p className={styles.clinicName}>{clinic.name}</p>
                      <p className={styles.clinicMeta}>
                        {clinic.address || clinic.domain || content.clinicsFallbackMeta}
                      </p>
                      <div className={styles.clinicRating}>
                        <StarRating value={clinic.rating_avg} size={16} />
                        <span className={styles.clinicRatingValue}>
                          {clinic.rating_count
                            ? `${Number(clinic.rating_avg).toFixed(1)} (${clinic.rating_count})`
                            : content.clinicsRatingNew}
                        </span>
                      </div>
                      <span className={styles.clinicDomain}>
                        {clinic.domain || content.clinicsFallbackDomain}
                      </span>
                    </div>
                  </>
                );

                const isExternal = Boolean(clinic.domain);
                const href = isExternal ? `https://${clinic.domain}` : '/clinics';

                return (
                  <a
                    key={`${clinic.id}-${index}`}
                    className={`${styles.clinicCard} ${styles.clinicCardLink}`}
                    href={href}
                    target={isExternal ? '_blank' : undefined}
                    rel={isExternal ? 'noreferrer' : undefined}
                  >
                    {cardContent}
                  </a>
                );
              })}
            </div>
          )}
        </div>
        <div className={styles.clinicActions}>
          <a className={`${styles.secondaryButton} ${styles.clinicActionButton}`} href="/clinics">
            {content.clinicsAction}
          </a>
        </div>
      </section>

      <section
        id="about"
        className={`${styles.section} ${styles.scrollAnchor} ${styles.sectionReveal}`}
        tabIndex={-1}
        ref={(node) => {
          sectionRefs.current[1] = node;
        }}
      >
        <div className={styles.sectionHeader}>
          <p className={styles.sectionEyebrow}>{content.aboutEyebrow}</p>
          <h2 className={styles.sectionTitle}>{content.aboutTitle}</h2>
          <p className={styles.sectionBody}>{content.aboutBody}</p>
        </div>
        <div className={styles.highlightGrid} ref={highlightGridRef}>
          {highlightItems.map((item, index) => (
            <div key={`${item.title}-${index}`} className={styles.highlightCard}>
              <p className={styles.highlightTitle}>{item.title}</p>
              <p>{item.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section
        id="offerings"
        className={`${styles.section} ${styles.scrollAnchor} ${styles.sectionReveal}`}
        tabIndex={-1}
        ref={(node) => {
          sectionRefs.current[2] = node;
        }}
      >
        <div className={styles.sectionHeader}>
          <p className={styles.sectionEyebrow}>{content.offeringsEyebrow}</p>
          <h2 className={styles.sectionTitle}>{content.offeringsTitle}</h2>
        </div>
        <div className={styles.offeringsGrid} ref={offeringsGridRef}>
          {offeringItems.map((item, index) => (
            <div key={`${item.title}-${index}`} className={styles.offeringCard}>
              <h3 className={styles.offeringTitle}>{item.title}</h3>
              <p>{item.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section
        className={`${styles.section} ${styles.scrollAnchor} ${styles.sectionReveal} ${styles.hideOnMobile}`}
        id="timeline"
        tabIndex={-1}
        ref={(node) => {
          sectionRefs.current[3] = node;
        }}
      >
        <div className={styles.sectionHeader}>
          <p className={styles.sectionEyebrow}>{content.timelineEyebrow}</p>
          <h2 className={styles.sectionTitle}>{content.timelineTitle}</h2>
        </div>
        <div className={styles.timeline}>
          {steps.map((step, index) => (
            <div key={step.title} className={styles.timelineStep}>
              <span className={styles.stepIndex}>{String(index + 1).padStart(2, '0')}</span>
              <div>
                <h3 className={styles.offeringTitle}>{step.title}</h3>
                <p>{step.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section
        id="prototype"
        className={`${styles.section} ${styles.scrollAnchor} ${styles.sectionReveal}`}
        tabIndex={-1}
        ref={(node) => {
          sectionRefs.current[4] = node;
        }}
      >
        <div className={styles.prototypeCard}>
          <div>
            <p className={styles.sectionEyebrow}>{content.prototypeEyebrow}</p>
            <h2 className={styles.sectionTitle}>{content.prototypeTitle}</h2>
            <p className={styles.sectionBody}>{content.prototypeBody}</p>
            <div className={styles.heroActions}>
              <a className={styles.primaryButton} href={PROTOTYPE_URL} target="_blank" rel="noreferrer">
                {content.prototypePrimary}
              </a>
              <a className={styles.secondaryButton} href="#offerings" data-target="offerings" onClick={handleNavClick}>
                {content.prototypeSecondary}
              </a>
            </div>
          </div>
          <div className={styles.prototypeDetails}>
            <p className={styles.cardTitle}>{content.prototypeDetailsTitle}</p>
            <ul className={styles.cardList}>
              <li>{content.prototypeItem1}</li>
              <li>{content.prototypeItem2}</li>
              <li>{content.prototypeItem3}</li>
              <li>{content.prototypeItem4}</li>
            </ul>
          </div>
        </div>
      </section>

      <section
        className={`${styles.ctaBand} ${styles.sectionReveal}`}
        ref={(node) => {
          sectionRefs.current[5] = node;
        }}
      >
        <div>
          <h2 className={styles.sectionTitle}>{content.ctaTitle}</h2>
          <p className={styles.sectionBody}>{content.ctaBody}</p>
        </div>
        <a className={styles.primaryButton} href="mailto:info@dentra.mk">
          {content.ctaButton}
        </a>
      </section>

      <footer className={styles.footer}>
        <p>(c) {new Date().getFullYear()} {content.footerSuffix}</p>
        <p className={styles.footerContacts}>
          {content.footerContactLabel}{' '}
          <a href="mailto:info@dentra.mk">info@dentra.mk</a> ·{' '}
          <a href="mailto:support@dentra.mk">support@dentra.mk</a>
        </p>
      </footer>
    </main>
  );
}
