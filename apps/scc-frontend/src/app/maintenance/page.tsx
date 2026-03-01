'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';

export default function MaintenancePage() {
  const router = useRouter();
  const [restarting, setRestarting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const token = localStorage.getItem('scc_token');
    const userStr = localStorage.getItem('scc_user');
    
    if (!token) {
      router.push('/login');
      return;
    }

    if (userStr) {
      try {
        const userData = JSON.parse(userStr);
        setUser(userData);
        
        // Prüfe, ob User super_admin ist
        if (userData.role !== 'super_admin') {
          setError('Nur Super-Administratoren haben Zugriff auf die Wartungsfunktionen.');
        }
      } catch (e) {
        console.error('Fehler beim Parsen der Benutzerdaten:', e);
      }
    }
  }, [router]);

  const handleRestart = async () => {
    if (!confirm('Möchten Sie den SCC-Service wirklich neu starten? Der Service wird für einige Sekunden nicht verfügbar sein.')) {
      return;
    }

    setRestarting(true);
    setError('');
    setSuccess(false);

    try {
      await api.post('/maintenance/restart');
      setSuccess(true);
      
      // Nach 3 Sekunden zur Login-Seite weiterleiten (Service wird neu gestartet)
      setTimeout(() => {
        localStorage.removeItem('scc_token');
        localStorage.removeItem('scc_user');
        router.push('/login');
      }, 3000);
    } catch (err: any) {
      console.error('Fehler beim Neustart:', err);
      
      let errorMessage = 'Fehler beim Neustart des Services';
      
      if (err.response) {
        if (err.response.status === 403) {
          errorMessage = 'Unzureichende Berechtigung. Nur Super-Administratoren können den Service neu starten.';
        } else if (err.response.status === 401) {
          errorMessage = 'Nicht autorisiert. Bitte melden Sie sich erneut an.';
          localStorage.removeItem('scc_token');
          localStorage.removeItem('scc_user');
          router.push('/login');
          return;
        } else if (err.response.data?.message) {
          errorMessage = err.response.data.message;
        } else {
          errorMessage = `Server-Fehler (Status: ${err.response.status})`;
        }
      } else if (err.request) {
        errorMessage = 'Keine Verbindung zum Server. Bitte prüfen Sie, ob der SCC-Backend-Server läuft.';
      }
      
      setError(errorMessage);
    } finally {
      setRestarting(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('scc_token');
    localStorage.removeItem('scc_user');
    router.push('/login');
  };

  const isSuperAdmin = user?.role === 'super_admin';

  return (
    <div className="container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1>Wartung</h1>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn" onClick={() => router.push('/companies')}>
            Zurück zu Companies
          </button>
          <button className="btn btn-danger" onClick={handleLogout}>
            Abmelden
          </button>
        </div>
      </div>

      {error && (
        <div
          style={{
            padding: '0.75rem',
            backgroundColor: '#f8d7da',
            color: '#721c24',
            borderRadius: '4px',
            marginBottom: '1rem',
          }}
        >
          {error}
        </div>
      )}

      {success && (
        <div
          style={{
            padding: '0.75rem',
            backgroundColor: '#d4edda',
            color: '#155724',
            borderRadius: '4px',
            marginBottom: '1rem',
          }}
        >
          <strong>✅ Service-Neustart wurde angefordert.</strong>
          <p style={{ marginTop: '0.5rem', marginBottom: 0 }}>
            Der Service wird in Kürze beendet. 
            {process.env.NODE_ENV === 'development' && (
              <strong> Bitte starten Sie den Service manuell neu (z.B. mit &quot;pnpm dev&quot; im Terminal).</strong>
            )}
            Sie werden zur Login-Seite weitergeleitet...
          </p>
        </div>
      )}

      <div className="card">
        <h2 style={{ marginBottom: '1rem' }}>Service-Neustart</h2>
        <p style={{ marginBottom: '1.5rem', color: '#666' }}>
          Startet den SCC-Service neu. Ein Process Manager (PM2, systemd, Docker, etc.) sollte den Service automatisch neu starten.
        </p>

        <div
          style={{
            padding: '0.75rem',
            backgroundColor: '#fff3cd',
            color: '#856404',
            borderRadius: '4px',
            marginBottom: '1rem',
          }}
        >
          <strong>⚠️ Wichtiger Hinweis:</strong>
          <ul style={{ marginTop: '0.5rem', marginBottom: 0, paddingLeft: '1.5rem' }}>
            <li>In der <strong>Entwicklungsumgebung</strong> wird der Service beendet, aber <strong>nicht automatisch neu gestartet</strong>.</li>
            <li>Sie müssen den Service <strong>manuell neu starten</strong> (z.B. mit <code>pnpm dev</code> im Terminal).</li>
            <li>In der <strong>Produktion</strong> mit Process Manager (PM2, systemd, Docker) wird der Service automatisch neu gestartet.</li>
          </ul>
        </div>

        {!isSuperAdmin && (
          <div
            style={{
              padding: '0.75rem',
              backgroundColor: '#fff3cd',
              color: '#856404',
              borderRadius: '4px',
              marginBottom: '1rem',
            }}
          >
            ⚠️ Nur Super-Administratoren können den Service neu starten.
          </div>
        )}

        <button
          className="btn btn-danger"
          onClick={handleRestart}
          disabled={restarting || !isSuperAdmin}
          style={{ opacity: restarting || !isSuperAdmin ? 0.6 : 1, cursor: restarting || !isSuperAdmin ? 'not-allowed' : 'pointer' }}
        >
          {restarting ? 'Service wird neu gestartet...' : 'Service neu starten'}
        </button>
      </div>

      <div className="card" style={{ marginTop: '2rem' }}>
        <h3 style={{ marginBottom: '1rem' }}>Zukünftige Wartungsfunktionen</h3>
        <p style={{ color: '#666', fontStyle: 'italic' }}>
          Weitere Wartungsfunktionen werden hier in Zukunft verfügbar sein:
        </p>
        <ul style={{ marginTop: '0.5rem', paddingLeft: '1.5rem', color: '#666' }}>
          <li>Cache leeren</li>
          <li>Log-Rotation</li>
          <li>Datenbank-Wartung</li>
          <li>Config-Reload</li>
        </ul>
      </div>
    </div>
  );
}

