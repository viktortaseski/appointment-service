'use client';

import { useI18n } from '@/shared/i18n/I18nProvider';

export default function SiteFooter({ clinic }) {
  const { t } = useI18n();
  const mapQuery = clinic?.address ? encodeURIComponent(clinic.address) : '';
  const contactItems = [
    clinic?.phone
      ? { label: t('footer_phone'), value: clinic.phone, href: `tel:${clinic.phone}` }
      : null,
    clinic?.email
      ? { label: t('footer_email'), value: clinic.email, href: `mailto:${clinic.email}` }
      : null,
    clinic?.address
      ? {
          label: t('footer_address'),
          value: clinic.address,
          href: `https://www.google.com/maps/search/?api=1&query=${mapQuery}`,
        }
      : null,
  ].filter(Boolean);

  return (
    <footer className="footer">
      <div>
        <p className="footer-title">{t('footer_title')}</p>
        <p className="footer-text">{t('footer_subtitle')}</p>
      </div>
      {contactItems.length > 0 && (
        <div className="footer-contact">
          <p className="footer-contact-title">{t('footer_contact')}</p>
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
        <a href="#book">{t('book_link')}</a>
        <a href="#doctors">{t('nav_doctors')}</a>
      </div>
    </footer>
  );
}
