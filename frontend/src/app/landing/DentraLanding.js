'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Fraunces, Manrope } from 'next/font/google';

import styles from './DentraLanding.module.css';
import { defaultLanguage, languageOptions, translations } from './translations';

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

export default function DentraLanding() {
  const [language, setLanguage] = useState(defaultLanguage);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const headerRef = useRef(null);
  const sectionRefs = useRef([]);

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

  const steps = useMemo(
    () => [
      { title: content.step1Title, description: content.step1Body },
      { title: content.step2Title, description: content.step2Body },
      { title: content.step3Title, description: content.step3Body },
    ],
    [content]
  );

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
          <a href="#prototype" data-target="prototype" onClick={handleNavClick}>
            {content.navPrototype}
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
            <a href="#prototype" data-target="prototype" onClick={handleNavClick}>
              {content.navPrototype}
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
        id="about"
        className={`${styles.section} ${styles.scrollAnchor} ${styles.sectionReveal}`}
        tabIndex={-1}
        ref={(node) => {
          sectionRefs.current[0] = node;
        }}
      >
        <div className={styles.sectionHeader}>
          <p className={styles.sectionEyebrow}>{content.aboutEyebrow}</p>
          <h2 className={styles.sectionTitle}>{content.aboutTitle}</h2>
          <p className={styles.sectionBody}>{content.aboutBody}</p>
        </div>
        <div className={styles.highlightGrid}>
          <div className={styles.highlightCard}>
            <p className={styles.highlightTitle}>{content.highlight1Title}</p>
            <p>{content.highlight1Body}</p>
          </div>
          <div className={styles.highlightCard}>
            <p className={styles.highlightTitle}>{content.highlight2Title}</p>
            <p>{content.highlight2Body}</p>
          </div>
          <div className={styles.highlightCard}>
            <p className={styles.highlightTitle}>{content.highlight3Title}</p>
            <p>{content.highlight3Body}</p>
          </div>
        </div>
      </section>

      <section
        id="offerings"
        className={`${styles.section} ${styles.scrollAnchor} ${styles.sectionReveal}`}
        tabIndex={-1}
        ref={(node) => {
          sectionRefs.current[1] = node;
        }}
      >
        <div className={styles.sectionHeader}>
          <p className={styles.sectionEyebrow}>{content.offeringsEyebrow}</p>
          <h2 className={styles.sectionTitle}>{content.offeringsTitle}</h2>
        </div>
        <div className={styles.offeringsGrid}>
          {offerings.map((item) => (
            <div key={item.title} className={styles.offeringCard}>
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
          sectionRefs.current[2] = node;
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
          sectionRefs.current[3] = node;
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
          sectionRefs.current[4] = node;
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
