import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Saivaro Control Center',
  description: 'Admin Interface für Saivaro Mail',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  );
}




