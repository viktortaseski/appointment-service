export default function SiteFooter({ clinic }) {
  const contactItems = [
    clinic?.phone ? { label: 'Phone', value: clinic.phone, href: `tel:${clinic.phone}` } : null,
    clinic?.email ? { label: 'Email', value: clinic.email, href: `mailto:${clinic.email}` } : null,
    clinic?.address ? { label: 'Address', value: clinic.address } : null,
  ].filter(Boolean);

  return (
    <footer className="footer">
      <div>
        <p className="footer-title">Dental Clinic Appointments</p>
        <p className="footer-text">
          Gentle care, bright smiles, and easy scheduling.
        </p>
      </div>
      {contactItems.length > 0 && (
        <div className="footer-contact">
          <p className="footer-contact-title">Contact</p>
          <div className="footer-contact-list">
            {contactItems.map((item) => (
              <div key={item.label} className="footer-contact-item">
                <span className="footer-contact-label">{item.label}</span>
                {item.href ? (
                  <a href={item.href} className="footer-contact-value">
                    {item.value}
                  </a>
                ) : (
                  <span className="footer-contact-value">{item.value}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="footer-links">
        <a href="#book">Book</a>
        <a href="#doctors">Doctors</a>
      </div>
    </footer>
  );
}
