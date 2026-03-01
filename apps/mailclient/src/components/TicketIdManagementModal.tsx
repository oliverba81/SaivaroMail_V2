'use client';

import { useState, useEffect } from 'react';
import { FiX, FiHash, FiRefreshCw, FiEdit2, FiCopy } from 'react-icons/fi';

interface TicketIdManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedEmailIds: string[];
  onSuccess: () => void;
}

export default function TicketIdManagementModal({
  isOpen,
  onClose,
  selectedEmailIds,
  onSuccess,
}: TicketIdManagementModalProps) {
  const [mode, setMode] = useState<'regenerate' | 'manual' | 'copy'>('regenerate');
  const [manualTicketId, setManualTicketId] = useState('');
  const [sourceEmailId, setSourceEmailId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<any>(null);

  // Reset Modal-State beim Öffnen
  useEffect(() => {
    if (isOpen) {
      setMode('regenerate');
      setManualTicketId('');
      setSourceEmailId('');
      setError('');
      setResult(null);
      setLoading(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    setLoading(true);
    setError('');
    setResult(null);

    try {
      // Validierung
      if (mode === 'manual') {
        if (!manualTicketId) {
          setError('Bitte geben Sie eine Ticket-ID ein');
          setLoading(false);
          return;
        }
        if (!/^M\d{11}$/.test(manualTicketId)) {
          setError('Ungültiges Format. Muss M + 11 Ziffern sein (z.B. M26011800001)');
          setLoading(false);
          return;
        }
      }

      if (mode === 'copy' && !sourceEmailId) {
        setError('Bitte geben Sie eine Quell-E-Mail-ID ein');
        setLoading(false);
        return;
      }

      const token = localStorage.getItem('mailclient_token');
      if (!token) {
        setError('Nicht angemeldet');
        setLoading(false);
        return;
      }

      const body: any = {
        emailIds: selectedEmailIds,
        mode,
      };

      if (mode === 'manual') {
        body.ticketId = manualTicketId;
      }

      if (mode === 'copy') {
        body.sourceEmailId = sourceEmailId;
      }

      const response = await fetch('/api/emails/ticket-id', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Fehler beim Aktualisieren der Ticket-IDs');
        setLoading(false);
        return;
      }

      setResult(data);
      
      // Bei Erfolg nach kurzer Verzögerung schließen
      if (data.success) {
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 1500);
      }
    } catch (err: any) {
      setError('Netzwerkfehler beim Aktualisieren der Ticket-IDs');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        className="card"
        style={{
          width: '90%',
          maxWidth: '500px',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
          <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <FiHash size={24} />
            Ticket-ID verwalten
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '0.25rem',
              color: '#6c757d',
            }}
          >
            <FiX size={24} />
          </button>
        </div>

        {/* Info */}
        <div style={{ marginBottom: '1.5rem', padding: '0.75rem', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
          <p style={{ margin: 0, fontSize: '0.875rem', color: '#6c757d' }}>
            {selectedEmailIds.length === 1 
              ? '1 E-Mail ausgewählt'
              : `${selectedEmailIds.length} E-Mails ausgewählt`}
          </p>
        </div>

        {/* Mode-Auswahl */}
        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
            Aktion wählen:
          </label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
              <input
                type="radio"
                name="mode"
                value="regenerate"
                checked={mode === 'regenerate'}
                onChange={(e) => setMode(e.target.value as any)}
              />
              <FiRefreshCw size={16} />
              Neue Ticket-ID generieren
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
              <input
                type="radio"
                name="mode"
                value="manual"
                checked={mode === 'manual'}
                onChange={(e) => setMode(e.target.value as any)}
              />
              <FiEdit2 size={16} />
              Ticket-ID manuell eingeben
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
              <input
                type="radio"
                name="mode"
                value="copy"
                checked={mode === 'copy'}
                onChange={(e) => setMode(e.target.value as any)}
              />
              <FiCopy size={16} />
              Ticket-ID von anderer E-Mail kopieren
            </label>
          </div>
        </div>

        {/* Manuelle Eingabe */}
        {mode === 'manual' && (
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
              Ticket-ID eingeben:
            </label>
            <input
              type="text"
              className="form-control"
              placeholder="M26011800001"
              value={manualTicketId}
              onChange={(e) => setManualTicketId(e.target.value.toUpperCase())}
              maxLength={12}
              style={{ fontFamily: 'monospace', fontSize: '1rem' }}
            />
            <small style={{ display: 'block', marginTop: '0.25rem', color: '#6c757d' }}>
              Format: M + 11 Ziffern (z.B. M26011800001)
            </small>
          </div>
        )}

        {/* Quell-E-Mail-ID */}
        {mode === 'copy' && (
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
              Quell-E-Mail-ID:
            </label>
            <input
              type="text"
              className="form-control"
              placeholder="UUID der Quell-E-Mail"
              value={sourceEmailId}
              onChange={(e) => setSourceEmailId(e.target.value)}
              style={{ fontFamily: 'monospace', fontSize: '0.875rem' }}
            />
            <small style={{ display: 'block', marginTop: '0.25rem', color: '#6c757d' }}>
              Die E-Mail-ID finden Sie in der URL oder Timeline
            </small>
          </div>
        )}

        {/* Error */}
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

        {/* Result */}
        {result && (
          <div
            style={{
              padding: '0.75rem',
              backgroundColor: result.success ? '#d4edda' : '#f8d7da',
              color: result.success ? '#155724' : '#721c24',
              borderRadius: '4px',
              marginBottom: '1rem',
            }}
          >
            <div style={{ fontWeight: '600', marginBottom: '0.5rem' }}>
              {result.success ? '✓ Erfolgreich' : '✗ Fehler'}
            </div>
            <div style={{ fontSize: '0.875rem' }}>
              Verarbeitet: {result.processed} | Erfolgreich: {result.successful} | Fehlgeschlagen: {result.failed}
            </div>
          </div>
        )}

        {/* Buttons */}
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
          <button
            className="btn btn-secondary"
            onClick={onClose}
            disabled={loading}
          >
            Abbrechen
          </button>
          <button
            className="btn btn-primary"
            onClick={handleSubmit}
            disabled={loading}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            {loading ? (
              <>
                <div className="spinner" style={{ width: '16px', height: '16px' }}></div>
                Wird verarbeitet...
              </>
            ) : (
              <>
                <FiHash size={16} />
                Ticket-ID aktualisieren
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
