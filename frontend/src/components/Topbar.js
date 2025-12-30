export default function Topbar({ clinic }) {
  return (
    <header className="topbar">
      <div className="brand">
        <span className="brand-mark">DC</span>
        <div>
          <p className="brand-title">{clinic?.name || 'Dental Clinic Network'}</p>
          <p className="brand-subtitle">
            {clinic?.domain || 'Appointment Service'}
          </p>
        </div>
      </div>
      <nav className="nav">
        <a href="#clinics">Clinic</a>
        <a href="#doctors">Doctors</a>
        <a href="#book">Book</a>
      </nav>
      <button className="cta">Call Concierge</button>
    </header>
  );
}
