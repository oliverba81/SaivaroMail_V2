'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    // Prüfe, ob User eingeloggt ist
    const token = localStorage.getItem('scc_token');
    if (token) {
      router.push('/companies');
    } else {
      router.push('/login');
    }
  }, [router]);

  return (
    <div className="container">
      <p>Lade...</p>
    </div>
  );
}






