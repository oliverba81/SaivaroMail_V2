'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      // Prüfe, ob die Antwort JSON ist
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        setError('Server-Fehler: Die API hat keine JSON-Antwort zurückgegeben. Bitte prüfen Sie die Server-Logs.');
        console.error('Ungültige Antwort von /api/auth/login:', text.substring(0, 200));
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        const errorMessage = data.error || 'Anmeldung fehlgeschlagen';
        setError(errorMessage);
        console.error('Login-Fehler:', data);
        return;
      }

      // Token und User-Daten speichern
      localStorage.setItem('mailclient_token', data.access_token || data.token);
      localStorage.setItem('mailclient_user', JSON.stringify(data.user));

      // Weiterleitung zur E-Mail-Liste
      router.push('/emails');
    } catch (err: any) {
      // Prüfe, ob es ein JSON-Parse-Fehler ist
      if (err.message && err.message.includes('JSON')) {
        setError('Server-Fehler: Die API hat keine gültige JSON-Antwort zurückgegeben. Bitte prüfen Sie die Server-Logs.');
        console.error('JSON-Parse-Fehler beim Login:', err);
      } else {
        setError('Fehler bei der Anmeldung. Bitte versuchen Sie es erneut.');
        console.error('Login-Fehler:', err);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        padding: '2rem',
      }}
    >
      <div
        className="card"
        style={{
          maxWidth: '400px',
          width: '100%',
          boxShadow: '0 10px 40px rgba(0, 0, 0, 0.2)',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <img 
            src="/logo.png" 
            alt="SAIVARO VOICE-MAIL" 
            style={{ 
              height: '80px', 
              width: 'auto', 
              maxWidth: '100%', 
              marginBottom: '1rem',
              objectFit: 'contain'
            }}
          />
          <p style={{ color: '#6c757d', fontSize: '0.9rem', marginTop: '0.5rem' }}>Multi-Tenant E-Mail-Client</p>
        </div>

        {error && (
          <div className="alert alert-error" style={{ marginBottom: '1.5rem' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1.25rem' }}>
            <label
              htmlFor="username"
              style={{
                display: 'block',
                marginBottom: '0.5rem',
                fontWeight: '600',
                color: '#333',
                fontSize: '0.9rem',
              }}
            >
              Benutzername
            </label>
            <input
              type="text"
              id="username"
              placeholder="Ihr Benutzername"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="input"
              autoFocus
            />
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label
              htmlFor="password"
              style={{
                display: 'block',
                marginBottom: '0.5rem',
                fontWeight: '600',
                color: '#333',
                fontSize: '0.9rem',
              }}
            >
              Passwort
            </label>
            <input
              type="password"
              id="password"
              placeholder="Ihr Passwort"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="input"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary"
            style={{
              width: '100%',
              justifyContent: 'center',
              opacity: loading ? 0.6 : 1,
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? (
              <>
                <div className="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }}></div>
                <span>Wird angemeldet...</span>
              </>
            ) : (
              <>
                <span>🔐</span>
                <span>Anmelden</span>
              </>
            )}
          </button>
        </form>

        <div
          style={{
            marginTop: '2rem',
            padding: '1rem',
            backgroundColor: '#f8f9fa',
            borderRadius: '6px',
            fontSize: '0.875rem',
            color: '#6c757d',
            textAlign: 'center',
          }}
        >
          <p style={{ margin: 0 }}>
            Für Test-Zugang: <strong>admin</strong> / <strong>f9k^Sy8yQGfo</strong>
          </p>
        </div>
      </div>
    </div>
  );
}
