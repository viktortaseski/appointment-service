'use client';

import { useI18n } from './I18nProvider';

const languages = [
  { code: 'en', label: 'EN' },
  { code: 'mk', label: 'MK' },
  { code: 'al', label: 'AL' },
];

export default function LanguageSwitcher({ className = '' }) {
  const { locale, setLocale } = useI18n();

  return (
    <div className={`lang-switcher ${className}`.trim()}>
      {languages.map((lang, index) => (
        <div key={lang.code} className="lang-item">
          <button
            type="button"
            className={locale === lang.code ? 'active' : ''}
            onClick={() => setLocale(lang.code)}
          >
            {lang.label}
          </button>
          {index < languages.length - 1 && (
            <span className="lang-divider">|</span>
          )}
        </div>
      ))}
    </div>
  );
}
