const doctors = [
  {
    name: 'Dr. Sarah Johnson',
    specialty: 'General Dentistry',
    clinic: 'Smile Dental Clinic',
    availability: 'Next: Today at 3:00 PM',
  },
  {
    name: 'Dr. Michael Chen',
    specialty: 'Orthodontics',
    clinic: 'Smile Dental Clinic',
    availability: 'Next: Tomorrow at 10:30 AM',
  },
  {
    name: 'Dr. Emily Rodriguez',
    specialty: 'Cosmetic Dentistry',
    clinic: 'Bright Teeth Dental',
    availability: 'Next: Thu at 1:00 PM',
  },
];

const steps = [
  {
    title: 'Choose a clinic',
    detail: 'Pick the location or specialty that fits your care plan.',
  },
  {
    title: 'Select a doctor',
    detail: 'Review bios, availability, and patient focus areas.',
  },
  {
    title: 'Confirm your time',
    detail: 'Lock in a visit and get an instant email confirmation.',
  },
];

export default function Home() {
  return (
    <main className="page">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">DC</span>
          <div>
            <p className="brand-title">Dental Clinic Network</p>
            <p className="brand-subtitle">Appointment Service</p>
          </div>
        </div>
        <nav className="nav">
          <a href="#clinics">Clinics</a>
          <a href="#doctors">Doctors</a>
          <a href="#book">Book</a>
        </nav>
        <button className="cta">Call Concierge</button>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Multi-clinic booking</p>
          <h1>Dental appointments designed for calm, confident visits.</h1>
          <p className="lead">
            Book trusted dental care across locations, with real-time availability,
            physician profiles, and a frictionless intake flow.
          </p>
          <div className="hero-actions">
            <button className="cta">Find a time</button>
            <button className="ghost">Explore clinics</button>
          </div>
          <div className="highlight-grid" id="clinics">
            <div className="highlight">
              <p className="highlight-title">2 locations</p>
              <p className="highlight-text">Smile Dental + Bright Teeth</p>
            </div>
            <div className="highlight">
              <p className="highlight-title">12-minute intake</p>
              <p className="highlight-text">Paperless, mobile friendly</p>
            </div>
          </div>
        </div>

        <form className="card form" id="book">
          <div className="form-header">
            <h2>Reserve your visit</h2>
            <p>We will confirm by email within minutes.</p>
          </div>
          <div className="field">
            <label htmlFor="patientName">Full name</label>
            <input id="patientName" placeholder="Jordan Smith" />
          </div>
          <div className="field">
            <label htmlFor="patientEmail">Email</label>
            <input id="patientEmail" type="email" placeholder="you@email.com" />
          </div>
          <div className="field">
            <label htmlFor="patientPhone">Phone</label>
            <input id="patientPhone" type="tel" placeholder="+1 (555) 000-0000" />
          </div>
          <div className="field-row">
            <div className="field">
              <label htmlFor="visitDate">Date</label>
              <input id="visitDate" type="date" />
            </div>
            <div className="field">
              <label htmlFor="visitTime">Time</label>
              <input id="visitTime" type="time" />
            </div>
          </div>
          <div className="field">
            <label htmlFor="doctor">Doctor</label>
            <select id="doctor">
              <option>Dr. Sarah Johnson (General)</option>
              <option>Dr. Michael Chen (Orthodontics)</option>
              <option>Dr. Emily Rodriguez (Cosmetic)</option>
            </select>
          </div>
          <button type="button" className="cta full">Confirm appointment</button>
          <p className="form-footnote">
            Secure scheduling. No credit card required.
          </p>
        </form>
      </section>

      <section className="section" id="doctors">
        <div className="section-header">
          <div>
            <p className="eyebrow">Doctors you can trust</p>
            <h2>Meet the care team across clinics.</h2>
          </div>
          <button className="ghost">View all doctors</button>
        </div>
        <div className="card-grid">
          {doctors.map((doctor, index) => (
            <article
              className="card doctor"
              key={doctor.name}
              style={{ animationDelay: `${index * 120}ms` }}
            >
              <div>
                <p className="doctor-name">{doctor.name}</p>
                <p className="doctor-specialty">{doctor.specialty}</p>
              </div>
              <p className="doctor-clinic">{doctor.clinic}</p>
              <p className="doctor-availability">{doctor.availability}</p>
              <button className="ghost">Book with this doctor</button>
            </article>
          ))}
        </div>
      </section>

      <section className="section steps">
        <div className="section-header">
          <div>
            <p className="eyebrow">How it works</p>
            <h2>Three steps to a brighter smile.</h2>
          </div>
        </div>
        <div className="card-grid">
          {steps.map((step, index) => (
            <article
              className="card step"
              key={step.title}
              style={{ animationDelay: `${index * 140}ms` }}
            >
              <p className="step-index">0{index + 1}</p>
              <p className="step-title">{step.title}</p>
              <p className="step-detail">{step.detail}</p>
            </article>
          ))}
        </div>
      </section>

      <footer className="footer">
        <div>
          <p className="footer-title">Dental Clinic Appointment Service</p>
          <p className="footer-text">
            Built for multi-clinic scheduling and high-touch patient care.
          </p>
        </div>
        <div className="footer-links">
          <a href="#book">Book</a>
          <a href="#doctors">Doctors</a>
          <a href="#clinics">Clinics</a>
        </div>
      </footer>
    </main>
  );
}
