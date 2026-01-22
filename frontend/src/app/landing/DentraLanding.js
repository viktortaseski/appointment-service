'use client';

import { Fraunces, Manrope } from 'next/font/google';

import styles from './DentraLanding.module.css';

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

const offerings = [
  {
    title: 'Smart booking flow',
    description: 'Real-time availability, doctor profiles, and instant confirmations that patients trust.',
  },
  {
    title: 'Clinic operations hub',
    description: 'Centralize schedules, patient notes, and daily capacity so teams stay coordinated.',
  },
  {
    title: 'Patient reminders',
    description: 'Automated reminders and follow-ups to cut no-shows and keep chairs full.',
  },
  {
    title: 'Multi-clinic ready',
    description: 'One system that scales across locations with custom branding per clinic.',
  },
  {
    title: 'Actionable insights',
    description: 'Track demand, peak hours, and conversion trends to plan staffing with confidence.',
  },
  {
    title: 'Localized by default',
    description: 'Built for the region with language support and flexible clinic settings.',
  },
];

const steps = [
  {
    title: 'Discover',
    description: 'Share your clinic flow and priorities. We map Dentra to your daily routine.',
  },
  {
    title: 'Configure',
    description: 'Set schedules, services, and team availability in minutes, not weeks.',
  },
  {
    title: 'Launch',
    description: 'Go live with a branded booking page and keep iterating with real data.',
  },
];

export default function DentraLanding() {
  return (
    <main className={`${styles.page} ${displayFont.variable} ${bodyFont.variable}`}>
      <div className={styles.backdrop} aria-hidden="true" />
      <header className={styles.header}>
        <div className={styles.brand}>
          <span className={styles.logoMark} aria-hidden="true" />
          <div>
            <p className={styles.brandName}>Dentra</p>
            <p className={styles.brandTagline}>Dental appointment service</p>
          </div>
        </div>
        <nav className={styles.nav}>
          <a href="#about">What is Dentra</a>
          <a href="#offerings">What we offer</a>
          <a href="#prototype">Prototype</a>
        </nav>
        <a className={styles.primaryButton} href="https://vivadent.onrender.com/">
          Open booking prototype
        </a>
      </header>

      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <span className={styles.heroEyebrow}>Built for modern dental clinics</span>
          <h1 className={styles.heroTitle}>
            A calmer, smarter way to book dental care.
          </h1>
          <p className={styles.heroBody}>
            Dentra is a dental appointment platform that unifies booking, clinic operations, and patient
            engagement. It keeps schedules tidy, reduces no-shows, and gives every clinic a premium
            booking experience.
          </p>
          <div className={styles.heroActions}>
            <a className={styles.primaryButton} href="https://vivadent.onrender.com/">
              Try the booking flow
            </a>
            <a className={styles.secondaryButton} href="#prototype">
              See what's included
            </a>
          </div>
          <div className={styles.heroStats}>
            <div>
              <p className={styles.statValue}>Real-time</p>
              <p className={styles.statLabel}>availability updates</p>
            </div>
            <div>
              <p className={styles.statValue}>Automated</p>
              <p className={styles.statLabel}>patient reminders</p>
            </div>
            <div>
              <p className={styles.statValue}>Multi-clinic</p>
              <p className={styles.statLabel}>ready infrastructure</p>
            </div>
          </div>
        </div>
        <div className={styles.heroCard}>
          <p className={styles.cardTitle}>What Dentra does</p>
          <ul className={styles.cardList}>
            <li>Connects patients to the right doctor and time slot instantly.</li>
            <li>Gives clinics a single view of bookings, capacity, and workflows.</li>
            <li>Automates confirmation and follow-up so staff can focus on care.</li>
          </ul>
          <div className={styles.cardFooter}>
            <span>Prototype lives at</span>
            <a href="https://vivadent.onrender.com/">vivadent.onrender.com</a>
          </div>
        </div>
      </section>

      <section id="about" className={styles.section}>
        <div className={styles.sectionHeader}>
          <p className={styles.sectionEyebrow}>What is Dentra?</p>
          <h2 className={styles.sectionTitle}>A full-service platform for dental bookings.</h2>
          <p className={styles.sectionBody}>
            Dentra sits between patients and clinics, giving both sides a seamless experience. Patients
            find the right clinic, book instantly, and get reminders. Clinics gain a branded booking
            page, smarter scheduling tools, and better visibility into demand.
          </p>
        </div>
        <div className={styles.highlightGrid}>
          <div className={styles.highlightCard}>
            <p className={styles.highlightTitle}>Patient experience</p>
            <p>
              A clean, mobile-first booking flow with clear doctor profiles, services, and immediate
              confirmation.
            </p>
          </div>
          <div className={styles.highlightCard}>
            <p className={styles.highlightTitle}>Clinic control</p>
            <p>
              Adjust schedules, handle reschedules, and see availability updates without manual
              spreadsheets.
            </p>
          </div>
          <div className={styles.highlightCard}>
            <p className={styles.highlightTitle}>Operational clarity</p>
            <p>
              Capacity planning and demand signals built directly into the booking workflow.
            </p>
          </div>
        </div>
      </section>

      <section id="offerings" className={styles.section}>
        <div className={styles.sectionHeader}>
          <p className={styles.sectionEyebrow}>What we offer</p>
          <h2 className={styles.sectionTitle}>Everything clinics need to run smoother.</h2>
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

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <p className={styles.sectionEyebrow}>How it works</p>
          <h2 className={styles.sectionTitle}>Launch in weeks, not months.</h2>
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

      <section id="prototype" className={styles.section}>
        <div className={styles.prototypeCard}>
          <div>
            <p className={styles.sectionEyebrow}>Prototype</p>
            <h2 className={styles.sectionTitle}>Preview the booking experience.</h2>
            <p className={styles.sectionBody}>
              The live prototype is available at vivadent.onrender.com and showcases the full patient
              journey, doctor selection, and availability flow.
            </p>
            <div className={styles.heroActions}>
              <a className={styles.primaryButton} href="https://vivadent.onrender.com/">
                Open vivadent.onrender.com
              </a>
              <a className={styles.secondaryButton} href="#offerings">
                Review features
              </a>
            </div>
          </div>
          <div className={styles.prototypeDetails}>
            <p className={styles.cardTitle}>Included in the prototype</p>
            <ul className={styles.cardList}>
              <li>Doctor availability and schedule windows.</li>
              <li>Appointment booking and confirmation flow.</li>
              <li>Clinic-branded theme and details.</li>
              <li>End-to-end reminders powered by Dentra.</li>
            </ul>
          </div>
        </div>
      </section>

      <section className={styles.ctaBand}>
        <div>
          <h2 className={styles.sectionTitle}>Ready to bring Dentra to your clinic?</h2>
          <p className={styles.sectionBody}>
            Start with the live prototype and tell us what matters most for your team.
          </p>
        </div>
        <a className={styles.primaryButton} href="https://vivadent.onrender.com/">
          Explore Dentra now
        </a>
      </section>

      <footer className={styles.footer}>
        <p>(c) {new Date().getFullYear()} Dentra. Designed for modern dental clinics.</p>
      </footer>
    </main>
  );
}
