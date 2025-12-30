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

export default function DoctorsSection({ clinic, doctors, status, onBookDoctor }) {
  return (
    <section className="section" id="doctors">
      <div className="section-header">
        <div>
          <p className="eyebrow">Meet your care team</p>
          <h2>{clinic?.name || 'Clinic'} care team.</h2>
          <p className="section-subtitle">
            Healthy smiles start with people you can trust.
          </p>
        </div>
      </div>
      {status.loading && <p className="status">Loading doctors...</p>}
      {!status.loading && status.error && (
        <p className="status error">
          {status.error}. Make sure a clinic exists for this domain.
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
                <p className="doctor-clinic">{clinic?.name}</p>
                <p className="doctor-availability">Available 9:00 AM - 4:00 PM</p>
              </div>
              <button
                type="button"
                className="ghost"
                onClick={() => onBookDoctor?.(doctor.id)}
              >
                Book with this doctor
              </button>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
