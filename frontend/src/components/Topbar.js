export default function Topbar({ clinic }) {
  return (
    <header className="topbar">
      <div className="brand">
        <span className="brand-mark">
          {clinic?.logo ? (
            <img src={clinic.logo} alt={`${clinic.name} logo`} className="brand-logo" />
          ) : (
            'DC'
          )}
        </span>
        <div>
          <p className="brand-title">{clinic?.name || 'Dental Clinic'}</p>
          <p className="brand-subtitle">
            {clinic?.domain || 'Appointment Service'}
          </p>
        </div>
      </div>
      <nav className="nav">
        <a href="#doctors">Doctors</a>
        <a href="#book">Book</a>
      </nav>
    </header>
  );
}
