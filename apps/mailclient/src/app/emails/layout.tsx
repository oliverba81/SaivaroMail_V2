import { Suspense } from 'react';

export default function EmailsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center">Laden…</div>}>
      {children}
    </Suspense>
  );
}
