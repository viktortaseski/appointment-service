import './globals.css';
import { I18nProvider } from '@/shared/i18n/I18nProvider';

export const metadata = {
  title: 'Dental Clinic Appointment Service',
  description: 'Book trusted dental care across multiple clinics in one place.',
  icons: {
    icon: 'https://res.cloudinary.com/dfuieb3iz/image/upload/v1769096434/logo_y76eph.png',
  },
  alternates: {
    canonical: 'https://dentra.mk/',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <I18nProvider>{children}</I18nProvider>
      </body>
    </html>
  );
}
