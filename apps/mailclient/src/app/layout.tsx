import type { Metadata } from 'next';
import './globals.css';
import ToastProvider from '@/components/ToastProvider';
import ConfirmProvider from '@/components/ConfirmDialog';

export const metadata: Metadata = {
  title: 'Saivaro Mail',
  description: 'Multi-Tenant Mail-Client',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="de">
      <body>
        <ToastProvider>
          <ConfirmProvider>{children}</ConfirmProvider>
        </ToastProvider>
      </body>
    </html>
  );
}




