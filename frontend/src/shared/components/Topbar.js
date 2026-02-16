'use client';

import LanguageSwitcher from './LanguageSwitcher';
import { useI18n } from '@/shared/i18n/I18nProvider';

export default function Topbar({ clinic }) {
  const { t } = useI18n();

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
          <p className="brand-title">{clinic?.name || t('brand_title_fallback')}</p>
          <p className="brand-subtitle">
            {clinic?.domain || t('brand_subtitle_fallback')}
          </p>
        </div>
      </div>
      <nav className="nav">
        <a href="#doctors">{t('nav_doctors')}</a>
        <a href="#book">{t('nav_book')}</a>
      </nav>
      <LanguageSwitcher />
    </header>
  );
}
