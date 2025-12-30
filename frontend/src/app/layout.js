import './globals.css';
import { I18nProvider } from '../components/I18nProvider';

export const metadata = {
  title: 'Dental Clinic Appointment Service',
  description: 'Book trusted dental care across multiple clinics in one place.',
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
