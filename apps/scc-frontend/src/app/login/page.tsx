'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('admin@saivaro.local');
  const [password, setPassword] = useState('admin123');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await axios.post(`${API_URL}/auth/login`, {
        email,
        password,
      });

      // Token speichern
      localStorage.setItem('scc_token', response.data.access_token);
      localStorage.setItem('scc_user', JSON.stringify(response.data.user));

      // Weiterleitung zu Companies
      router.push('/companies');
    } catch (err: any) {
      console.error('Login-Fehler:', err);
      console.error('Response-Daten:', err.response?.data);
      console.error('Response-Status:', err.response?.status);
      
      let errorMessage = 'Anmeldung fehlgeschlagen. Bitte versuchen Sie es erneut.';
      
      if (err.response) {
        // Server hat geantwortet
        const data = err.response.data;
        console.log('Vollständige Response-Daten:', JSON.stringify(data, null, 2));
        
        if (data?.message) {
          // NestJS gibt die Fehlermeldung in 'message' zurück
          errorMessage = Array.isArray(data.message) 
            ? data.message.join(', ') 
            : data.message;
        } else if (data?.error) {
          errorMessage = data.error;
        } else if (err.response.status === 401) {
          errorMessage = 'Ungültige Anmeldedaten. Bitte überprüfen Sie E-Mail und Passwort.';
        } else if (err.response.status === 400) {
          errorMessage = 'Ungültige Eingabe. Bitte überprüfen Sie Ihre Daten.';
        } else if (err.response.status >= 500) {
          errorMessage = 'Server-Fehler. Bitte versuchen Sie es später erneut.';
        }
      } else if (err.request) {
        // Anfrage wurde gesendet, aber keine Antwort erhalten
        errorMessage = 'Keine Verbindung zum Server. Bitte prüfen Sie, ob der SCC-Backend-Server auf http://localhost:3001 läuft.';
      } else {
        // Fehler beim Erstellen der Anfrage
        errorMessage = err.message || errorMessage;
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container" style={{ maxWidth: '400px', marginTop: '5rem' }}>
      <div className="card">
        <h1 style={{ marginBottom: '1.5rem' }}>Saivaro Control Center</h1>
        <h2 style={{ marginBottom: '1rem', fontSize: '1.2rem' }}>Anmelden</h2>

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

        <form onSubmit={handleSubmit}>
          <input
            type="email"
            className="input"
            placeholder="E-Mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            className="input"
            placeholder="Passwort"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%' }}
            disabled={loading}
          >
            {loading ? 'Anmelden...' : 'Anmelden'}
          </button>
        </form>

        <p style={{ marginTop: '1rem', fontSize: '0.85rem', color: '#666' }}>
          Standard-Login: admin@saivaro.local / admin123
        </p>
      </div>
    </div>
  );
}




