export default function HeroCopy({ clinic, hostname }) {
  return (
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
          <p className="highlight-title">Current clinic</p>
          <p className="highlight-text">
            {clinic?.name || 'Detecting your clinic...'}
          </p>
        </div>
        <div className="highlight">
          <p className="highlight-title">Clinic domain</p>
          <p className="highlight-text">
            {clinic?.domain || hostname || 'Loading...'}
          </p>
        </div>
      </div>
    </div>
  );
}
