'use client';

import { useEffect } from 'react';

interface DepartmentDefinition {
  name: string;
  description: string;
}

interface DepartmentRestoreModalProps {
  departments: DepartmentDefinition[];
  onConfirm: () => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
}

export default function DepartmentRestoreModal({
  departments,
  onConfirm,
  onCancel,
  loading = false,
}: DepartmentRestoreModalProps) {
  // ESC-Taste zum Schließen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) {
        onCancel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onCancel, loading]);

  const handleConfirm = async () => {
    if (!loading) {
      await onConfirm();
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
        zIndex: 9999,
      }}
      onClick={!loading ? onCancel : undefined}
    >
      <div
        className="card"
        style={{
          width: '90%',
          maxWidth: '600px',
          maxHeight: '80vh',
          overflow: 'auto',
          position: 'relative',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: '600', margin: 0 }}>
            Abteilungen hinzufügen
          </h2>
          <button
            onClick={!loading ? onCancel : undefined}
            disabled={loading}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '1.5rem',
              cursor: loading ? 'not-allowed' : 'pointer',
              color: '#6c757d',
              opacity: loading ? 0.5 : 1,
            }}
            aria-label="Schließen"
          >
            ×
          </button>
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <p style={{ marginBottom: '1rem', color: '#6c757d' }}>
            Die folgenden Abteilungen werden hinzugefügt:
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {departments.map((dept, index) => (
              <div
                key={index}
                style={{
                  padding: '0.75rem',
                  borderBottom: '1px solid #e9ecef',
                  backgroundColor: '#f8f9fa',
                  borderRadius: '4px',
                }}
              >
                <div style={{ fontWeight: '600', marginBottom: '0.25rem', color: '#333' }}>
                  {dept.name}
                </div>
                <div style={{ fontSize: '0.875rem', color: '#6c757d' }}>
                  {dept.description}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
          <button
            onClick={!loading ? onCancel : undefined}
            disabled={loading}
            className="btn btn-secondary"
            style={{ opacity: loading ? 0.5 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}
          >
            Abbrechen
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading}
            className="btn btn-primary"
            style={{ 
              opacity: loading ? 0.5 : 1, 
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            {loading ? (
              <>
                <span className="spinner" style={{ width: '1rem', height: '1rem', borderWidth: '2px' }}></span>
                <span>Hinzufügen...</span>
              </>
            ) : (
              <span>Hinzufügen</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
