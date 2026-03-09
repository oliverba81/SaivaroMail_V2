'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { StorageUsageErrorBoundary } from './StorageUsageErrorBoundary';

// Fallback-Type falls @saivaro/shared noch nicht gebaut ist
type StorageUsage = {
  database: {
    totalSizeBytes: number;
    totalSize: string;
    tableSizeBytes: number;
    indexSizeBytes: number;
    tables: Array<{
      tableName: string;
      sizeBytes: number;
      totalSizeBytes: number;
      indexSizeBytes: number;
      size: string;
      totalSize: string;
      rowCount: number;
    }>;
  };
  files: {
    totalSizeBytes: number;
    totalSize: string;
    attachments: { sizeBytes: number; size: string; count: number };
    uploads: { sizeBytes: number; size: string; count: number };
    other: { sizeBytes: number; size: string; count: number };
  };
  total: { sizeBytes: number; size: string };
  lastUpdated: string;
};

interface StorageUsageProps {
  companyId: string;
}

export default function StorageUsage({ companyId }: StorageUsageProps) {
  const [storageUsage, setStorageUsage] = useState<StorageUsage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadStorageUsage = async (refresh: boolean = false) => {
    try {
      if (refresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);
      const url = `/companies/${companyId}/storage-usage`;
      const params = refresh ? { refresh: 'true' } : {};
      console.log(`[StorageUsage] Lade Daten von: ${url}`, params);
      const response = await api.get(url, { params });
      setStorageUsage(response.data);
    } catch (err: any) {
      const code = err.code || err.response?.status;
      const msg = err.message || err.response?.data?.message || String(err.response?.data);
      console.error(`[StorageUsage] Fehler: ${msg} (code: ${code})`);

      // Detaillierte Fehlermeldung extrahieren
      let errorMessage = 'Fehler beim Laden der Speicherplatz-Daten';
      
      if (err.response?.data) {
        const data = err.response.data;
        if (typeof data === 'string') {
          errorMessage = data;
        } else if (data.message) {
          errorMessage = Array.isArray(data.message) 
            ? data.message.join(', ') 
            : data.message;
        } else if (data.error) {
          errorMessage = data.error;
        }
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      // Status-Code hinzufügen, falls vorhanden
      if (err.response?.status) {
        errorMessage = `[${err.response.status}] ${errorMessage}`;
      }

      // Hinweis bei fehlender Tenant-DB
      if (errorMessage.includes('does not exist') || errorMessage.includes('existiert nicht')) {
        errorMessage += '. Bitte klicken Sie auf "DB-Config aktualisieren" in der Datenbank-Konfiguration oben, um die Tenant-Datenbank anzulegen.';
      }

      setError(errorMessage);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadStorageUsage();
  }, [companyId]);

  if (loading) {
    return (
      <div className="card">
        <h2>Speicherplatz</h2>
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <p style={{ color: '#666' }}>Lade Speicherplatz-Daten...</p>
          <div style={{ 
            width: '100%', 
            height: '4px', 
            backgroundColor: '#e0e0e0', 
            borderRadius: '2px', 
            marginTop: '1rem',
            overflow: 'hidden'
          }}>
            <div style={{
              width: '30%',
              height: '100%',
              backgroundColor: '#007bff',
              animation: 'pulse 1.5s ease-in-out infinite',
            }} />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card">
        <h2>Speicherplatz</h2>
        <div style={{ padding: '2rem', textAlign: 'center', backgroundColor: '#f8d7da', borderRadius: '4px', border: '1px solid #f5c6cb' }}>
          <p style={{ color: '#721c24', marginBottom: '1rem' }}>
            <strong>Fehler:</strong> {error}
          </p>
          <button
            className="btn btn-primary"
            onClick={() => loadStorageUsage(true)}
            disabled={refreshing}
          >
            {refreshing ? 'Lädt...' : 'Erneut versuchen'}
          </button>
        </div>
      </div>
    );
  }

  if (!storageUsage) {
    return (
      <div className="card">
        <h2>Speicherplatz</h2>
        <p style={{ color: '#666' }}>Keine Speicherplatz-Daten verfügbar.</p>
      </div>
    );
  }

  return (
    <StorageUsageErrorBoundary>
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ margin: 0 }}>Speicherplatz</h2>
          <button
            className="btn btn-primary"
            onClick={() => loadStorageUsage(true)}
            disabled={refreshing}
            style={{ fontSize: '0.9rem', padding: '0.4rem 0.8rem' }}
          >
            {refreshing ? '🔄 Aktualisiere...' : '🔄 Aktualisieren'}
          </button>
        </div>

        {/* Gesamtübersicht */}
        <div style={{ 
          padding: '1rem', 
          backgroundColor: '#e7f3ff', 
          borderRadius: '4px', 
          marginBottom: '1.5rem',
          border: '1px solid #b3d9ff'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#0066cc' }}>Gesamt-Speicherplatz</h3>
              <p style={{ margin: '0.5rem 0 0 0', fontSize: '1.5rem', fontWeight: 'bold', color: '#004499' }}>
                {storageUsage.total.size}
              </p>
            </div>
            <div style={{ textAlign: 'right', fontSize: '0.9rem', color: '#666' }}>
              <p style={{ margin: 0 }}>Letzte Aktualisierung:</p>
              <p style={{ margin: '0.25rem 0 0 0', fontWeight: '500' }}>
                {new Date(storageUsage.lastUpdated).toLocaleString('de-DE')}
              </p>
            </div>
          </div>
        </div>

        {/* Datenbank-Speicherplatz */}
        <div style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ marginBottom: '1rem', fontSize: '1rem' }}>Datenbank-Speicherplatz</h3>
          <div style={{ 
            padding: '1rem', 
            backgroundColor: '#f8f9fa', 
            borderRadius: '4px',
            marginBottom: '1rem'
          }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#666' }}>Gesamtgröße</p>
                <p style={{ margin: '0.25rem 0 0 0', fontSize: '1.2rem', fontWeight: 'bold' }}>
                  {storageUsage.database.totalSize}
                </p>
              </div>
              <div>
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#666' }}>Tabellengröße</p>
                <p style={{ margin: '0.25rem 0 0 0', fontSize: '1.2rem', fontWeight: 'bold' }}>
                  {formatBytes(storageUsage.database.tableSizeBytes)}
                </p>
              </div>
              <div>
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#666' }}>Index-Größe</p>
                <p style={{ margin: '0.25rem 0 0 0', fontSize: '1.2rem', fontWeight: 'bold' }}>
                  {formatBytes(storageUsage.database.indexSizeBytes)}
                </p>
              </div>
            </div>
            <p style={{ margin: 0, fontSize: '0.8rem', color: '#666', fontStyle: 'italic' }}>
              Hinweis: Tabellengröße enthält TOAST-Tabellen
            </p>
          </div>

          {storageUsage.database.tables.length > 0 ? (
            <div style={{ overflowX: 'auto' }}>
              <table className="table" style={{ fontSize: '0.9rem' }}>
                <thead>
                  <tr>
                    <th>Tabelle</th>
                    <th style={{ textAlign: 'right' }}>Größe</th>
                    <th style={{ textAlign: 'right' }}>Gesamt</th>
                    <th style={{ textAlign: 'right' }}>Indizes</th>
                    <th style={{ textAlign: 'right' }}>Zeilen</th>
                  </tr>
                </thead>
                <tbody>
                  {storageUsage.database.tables.map((table) => (
                    <tr key={table.tableName}>
                      <td>
                        <code style={{ 
                          backgroundColor: '#e7f3ff', 
                          padding: '0.2rem 0.4rem', 
                          borderRadius: '3px',
                          fontSize: '0.85rem'
                        }}>
                          {table.tableName}
                        </code>
                      </td>
                      <td style={{ textAlign: 'right' }}>{table.size}</td>
                      <td style={{ textAlign: 'right' }}>{table.totalSize}</td>
                      <td style={{ textAlign: 'right' }}>{formatBytes(table.indexSizeBytes)}</td>
                      <td style={{ textAlign: 'right' }}>{table.rowCount.toLocaleString('de-DE')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ padding: '1rem', backgroundColor: '#fff3cd', borderRadius: '4px', border: '1px solid #ffc107' }}>
              <p style={{ margin: 0, color: '#856404' }}>Keine Tabellen gefunden.</p>
            </div>
          )}
        </div>

        {/* Dateispeicherplatz */}
        <div>
          <h3 style={{ marginBottom: '1rem', fontSize: '1rem' }}>Dateispeicherplatz</h3>
          <div style={{ 
            padding: '1rem', 
            backgroundColor: '#f8f9fa', 
            borderRadius: '4px',
            marginBottom: '1rem'
          }}>
            <p style={{ margin: 0, fontSize: '0.85rem', color: '#666', marginBottom: '0.5rem' }}>Gesamtgröße</p>
            <p style={{ margin: 0, fontSize: '1.2rem', fontWeight: 'bold' }}>
              {storageUsage.files.totalSize}
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
            <div style={{ 
              padding: '1rem', 
              backgroundColor: '#e7f3ff', 
              borderRadius: '4px',
              border: '1px solid #b3d9ff'
            }}>
              <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', color: '#0066cc' }}>E-Mail-Anhänge</h4>
              <p style={{ margin: 0, fontSize: '1.1rem', fontWeight: 'bold', color: '#004499' }}>
                {storageUsage.files.attachments.size}
              </p>
              <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8rem', color: '#666' }}>
                {storageUsage.files.attachments.count.toLocaleString('de-DE')} Dateien
              </p>
            </div>
            <div style={{ 
              padding: '1rem', 
              backgroundColor: '#fff3cd', 
              borderRadius: '4px',
              border: '1px solid #ffc107'
            }}>
              <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', color: '#856404' }}>Uploads</h4>
              <p style={{ margin: 0, fontSize: '1.1rem', fontWeight: 'bold', color: '#856404' }}>
                {storageUsage.files.uploads.size}
              </p>
              <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8rem', color: '#666' }}>
                {storageUsage.files.uploads.count.toLocaleString('de-DE')} Dateien
              </p>
            </div>
            <div style={{ 
              padding: '1rem', 
              backgroundColor: '#f8f9fa', 
              borderRadius: '4px',
              border: '1px solid #dee2e6'
            }}>
              <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', color: '#666' }}>Sonstige</h4>
              <p style={{ margin: 0, fontSize: '1.1rem', fontWeight: 'bold', color: '#495057' }}>
                {storageUsage.files.other.size}
              </p>
              <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8rem', color: '#666' }}>
                {storageUsage.files.other.count.toLocaleString('de-DE')} Dateien
              </p>
            </div>
          </div>

          {storageUsage.files.totalSizeBytes === 0 && (
            <div style={{ 
              marginTop: '1rem', 
              padding: '1rem', 
              backgroundColor: '#fff3cd', 
              borderRadius: '4px', 
              border: '1px solid #ffc107' 
            }}>
              <p style={{ margin: 0, color: '#856404' }}>Keine Dateien gefunden.</p>
            </div>
          )}
        </div>
      </div>
    </StorageUsageErrorBoundary>
  );
}

// Helper-Funktion für formatBytes (falls nicht aus shared importiert werden kann)
function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return '0 Bytes';
  if (bytes < 0 || !Number.isFinite(bytes) || bytes < 1) return '0 Bytes';
  
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const index = Math.min(Math.max(0, i), sizes.length - 1);
  
  return parseFloat((bytes / Math.pow(k, index)).toFixed(dm)) + ' ' + sizes[index];
}

