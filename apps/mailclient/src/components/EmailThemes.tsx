'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FiTag, FiPlus, FiEdit, FiTrash2, FiSave } from 'react-icons/fi';
import { useConfirm } from '@/components/ConfirmDialog';

interface EmailTheme {
  id: string;
  name: string;
  color: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function EmailThemes() {
  const router = useRouter();
  const { confirm } = useConfirm();
  const [themes, setThemes] = useState<EmailTheme[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingTheme, setEditingTheme] = useState<EmailTheme | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    color: '',
  });
  const [saving, setSaving] = useState(false);

  const loadThemes = async () => {
    try {
      setLoading(true);
      setError('');
      const token = localStorage.getItem('mailclient_token');
      
      if (!token) {
        router.push('/login');
        return;
      }

      const response = await fetch('/api/themes', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.status === 401) {
        localStorage.removeItem('mailclient_token');
        localStorage.removeItem('mailclient_user');
        router.push('/login');
        return;
      }

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || 'Fehler beim Laden der Themen');
        return;
      }

      const data = await response.json();
      setThemes(data.themes || []);
    } catch (err: any) {
      setError('Fehler beim Laden der Themen');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadThemes();
  }, []);

  const handleCreate = () => {
    setEditingTheme(null);
    setFormData({ name: '', color: '' });
    setError('');
  };

  const handleEdit = (theme: EmailTheme) => {
    setEditingTheme(theme);
    setFormData({
      name: theme.name,
      color: theme.color || '',
    });
    setError('');
  };

  const handleCancel = () => {
    setEditingTheme(null);
    setFormData({ name: '', color: '' });
    setError('');
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      setError('Bitte geben Sie einen Themenamen ein.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const token = localStorage.getItem('mailclient_token');
      
      if (!token) {
        router.push('/login');
        return;
      }

      const url = editingTheme ? `/api/themes/${editingTheme.id}` : '/api/themes';
      const method = editingTheme ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name.trim(),
          color: formData.color.trim() || null,
        }),
      });

      if (response.status === 401) {
        localStorage.removeItem('mailclient_token');
        localStorage.removeItem('mailclient_user');
        router.push('/login');
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Fehler beim Speichern des Themas');
        return;
      }

      // Erfolgreich gespeichert
      setEditingTheme(null);
      setFormData({ name: '', color: '' });
      await loadThemes();
    } catch (err: any) {
      setError('Fehler beim Speichern des Themas');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (themeId: string) => {
    if (!(await confirm({ message: 'Möchten Sie dieses Thema wirklich löschen?', variant: 'danger', confirmLabel: 'Löschen' }))) {
      return;
    }

    try {
      setError('');
      const token = localStorage.getItem('mailclient_token');
      
      if (!token) {
        router.push('/login');
        return;
      }

      const response = await fetch(`/api/themes/${themeId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.status === 401) {
        localStorage.removeItem('mailclient_token');
        localStorage.removeItem('mailclient_user');
        router.push('/login');
        return;
      }

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || 'Fehler beim Löschen des Themas');
        return;
      }

      await loadThemes();
    } catch (err: any) {
      setError('Fehler beim Löschen des Themas');
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="card">
        <div className="empty-state">
          <div className="spinner" style={{ margin: '0 auto' }}></div>
          <p style={{ marginTop: '1rem', color: '#6c757d' }}>Lade Themen...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '600' }}>
          E-Mail-Themen
        </h2>
        {!editingTheme && (
          <button
            onClick={handleCreate}
            className="btn btn-primary"
            style={{ fontSize: '0.875rem', padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <FiPlus size={16} />
            <span>Thema hinzufügen</span>
          </button>
        )}
      </div>

      {error && (
        <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
          {error}
        </div>
      )}

      {themes.length === 0 && !editingTheme ? (
        <div className="empty-state">
          <div className="empty-state-icon" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <FiTag size={48} style={{ color: '#6c757d' }} />
          </div>
          <div className="empty-state-title">Keine Themen vorhanden</div>
          <div className="empty-state-text">
            Erstellen Sie Themen, um E-Mails später zu kategorisieren.
          </div>
          <button
            onClick={handleCreate}
            className="btn btn-primary"
            style={{ marginTop: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <FiPlus size={16} />
            <span>Erstes Thema erstellen</span>
          </button>
        </div>
      ) : (
        <>
          {/* Themen-Liste */}
          {themes.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.5rem' }}>
              {themes.map((theme) => (
                <div
                  key={theme.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem',
                    padding: '1rem',
                    border: '1px solid #e9ecef',
                    borderRadius: '8px',
                    backgroundColor: '#fff',
                  }}
                >
                  {theme.color && (
                    <div
                      style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '4px',
                        backgroundColor: theme.color,
                        border: '1px solid #ddd',
                        flexShrink: 0,
                      }}
                    />
                  )}
                  <div style={{ flex: 1, fontWeight: '500' }}>
                    {theme.name}
                  </div>
                  <button
                    onClick={() => handleEdit(theme)}
                    className="btn btn-secondary"
                    style={{ fontSize: '0.875rem', padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                  >
                    <FiEdit size={16} />
                    <span>Bearbeiten</span>
                  </button>
                  <button
                    onClick={() => handleDelete(theme.id)}
                    className="btn btn-danger"
                    style={{ fontSize: '0.875rem', padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                  >
                    <FiTrash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Popup für Bearbeitung/Erstellung */}
          {editingTheme !== null && (
            <>
              {/* Overlay */}
              <div
                style={{
                  position: 'fixed',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: 'rgba(0, 0, 0, 0.5)',
                  zIndex: 9998,
                }}
                onClick={handleCancel}
              />
              {/* Popup */}
              <div
                style={{
                  position: 'fixed',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  backgroundColor: '#fff',
                  border: '1px solid #e9ecef',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                  padding: '1.5rem',
                  minWidth: '400px',
                  maxWidth: '90vw',
                  zIndex: 9999,
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                  <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '600' }}>
                    {editingTheme ? 'Thema bearbeiten' : 'Neues Thema'}
                  </h3>
                  <button
                    onClick={handleCancel}
                    style={{
                      background: 'none',
                      border: 'none',
                      fontSize: '1.5rem',
                      cursor: 'pointer',
                      color: '#6c757d',
                      padding: 0,
                      width: '30px',
                      height: '30px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                    disabled={saving}
                  >
                    ×
                  </button>
                </div>

                {error && (
                  <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
                    {error}
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: '600', color: '#333' }}>
                      Themenname *
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="input"
                      placeholder="z.B. Arbeit, Privat, Wichtig"
                      maxLength={255}
                      autoFocus
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: '600', color: '#333' }}>
                      Farbe (optional)
                    </label>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <input
                        type="color"
                        value={formData.color || '#007bff'}
                        onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                        style={{
                          width: '60px',
                          height: '40px',
                          border: '1px solid #ddd',
                          borderRadius: '4px',
                          cursor: 'pointer',
                        }}
                      />
                      <input
                        type="text"
                        value={formData.color}
                        onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                        className="input"
                        placeholder="#FF5733"
                        pattern="^#[0-9A-Fa-f]{6}$"
                        style={{ flex: 1, fontFamily: 'monospace' }}
                      />
                      {formData.color && (
                        <div
                          style={{
                            width: '40px',
                            height: '40px',
                            borderRadius: '4px',
                            backgroundColor: formData.color,
                            border: '1px solid #ddd',
                            flexShrink: 0,
                          }}
                        />
                      )}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#6c757d', marginTop: '0.25rem' }}>
                      Hex-Format: #FF5733
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                  <button
                    onClick={handleCancel}
                    className="btn btn-secondary"
                    style={{ fontSize: '0.875rem', padding: '0.5rem 1rem' }}
                    disabled={saving}
                  >
                    Abbrechen
                  </button>
                  <button
                    onClick={handleSave}
                    className="btn btn-primary"
                    style={{ fontSize: '0.875rem', padding: '0.5rem 1rem' }}
                    disabled={saving}
                  >
                    {saving ? (
                      <>
                        <div className="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px', marginRight: '0.5rem' }}></div>
                        <span>Speichern...</span>
                      </>
                    ) : (
                      <>
                        <FiSave size={16} />
                        <span>Speichern</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

