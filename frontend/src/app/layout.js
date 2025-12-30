import './globals.css';

export const metadata = {
  title: 'Dental Clinic Appointment Service',
  description: 'Book trusted dental care across multiple clinics in one place.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
