'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();
  const [showInfo, setShowInfo] = useState(false);

  useEffect(() => {
    // Prüfe, ob Tenant-Context gesetzt ist (über Middleware)
    const hostname = window.location.hostname;
    const subdomain = hostname.split('.')[0];
    const companyParam = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('company') : null;

    // Prüfe, ob User eingeloggt ist
    const token = localStorage.getItem('mailclient_token');
    if (token) {
      const preserveParams = companyParam ? `?company=${encodeURIComponent(companyParam)}` : '';
      router.push(`/emails${preserveParams}`);
      return;
    }

    // Subdomain ODER ?company=slug vorhanden → zur Login-Seite
    if ((subdomain && subdomain !== 'localhost' && subdomain !== 'www') || companyParam) {
      const loginUrl = companyParam ? `/login?company=${encodeURIComponent(companyParam)}` : '/login';
      setTimeout(() => {
        router.push(loginUrl);
      }, 100);
    } else {
      // Keine Subdomain und kein company-Param → Info-Seite anzeigen
      setShowInfo(true);
    }
  }, [router]);

  if (!showInfo) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <p>Lade...</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <h1 style={{ marginBottom: '1rem' }}>Saivaro Mail</h1>
      <h2 style={{ marginBottom: '1.5rem', fontSize: '1.2rem', color: '#666' }}>
        Multi-Tenant Mail-Client
      </h2>
      <p style={{ marginTop: '1rem', color: '#666', lineHeight: '1.6' }}>
        Diese App läuft im Multi-Tenant-Modus. Bitte über Subdomain zugreifen
        (z. B. <code style={{ backgroundColor: '#f0f0f0', padding: '0.2rem 0.4rem', borderRadius: '3px' }}>firma1.localhost:3000</code>) oder JWT-Token mit companyId verwenden.
      </p>
      <div style={{ marginTop: '2rem', padding: '1rem', backgroundColor: '#fff3cd', borderRadius: '4px', border: '1px solid #ffc107' }}>
        <p style={{ margin: 0, color: '#856404' }}>
          <strong>Hinweis:</strong> Für lokales Testing müssen Subdomains in der hosts-Datei konfiguriert sein.
        </p>
      </div>
    </div>
  );
}
