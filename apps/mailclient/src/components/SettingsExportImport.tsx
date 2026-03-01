'use client';

import { useState } from 'react';
import { useToast } from './ToastProvider';
import { useConfirm } from '@/components/ConfirmDialog';
import { FiDownload, FiUpload } from 'react-icons/fi';

interface SettingsData {
  fetchInterval: number;
  emailFilters: any[];
  cardOrder?: string[];
  exportDate: string;
  version: string;
}

interface SettingsExportImportProps {
  fetchInterval: number;
  emailFilters: any[];
  cardOrder?: string[];
  onImport: (data: SettingsData) => void;
}

export default function SettingsExportImport({
  fetchInterval,
  emailFilters,
  cardOrder,
  onImport,
}: SettingsExportImportProps) {
  const toast = useToast();
  const { confirm } = useConfirm();
  const [importing, setImporting] = useState(false);

  const handleExport = () => {
    try {
      const settingsData: SettingsData = {
        fetchInterval,
        emailFilters,
        cardOrder,
        exportDate: new Date().toISOString(),
        version: '1.0',
      };

      const blob = new Blob([JSON.stringify(settingsData, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `saivaro-mail-settings-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.showSuccess('Einstellungen erfolgreich exportiert!');
    } catch (error) {
      console.error('Fehler beim Export:', error);
      toast.showError('Fehler beim Exportieren der Einstellungen');
    }
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImporting(true);
    try {
      const text = await file.text();
      const data = JSON.parse(text) as SettingsData;

      // Validierung
      if (!data.version || !data.exportDate) {
        toast.showError('Ungültige Einstellungsdatei. Bitte wählen Sie eine gültige Datei aus.');
        setImporting(false);
        return;
      }

      // Vorschau-Dialog
      const confirmMessage = `Möchten Sie diese Einstellungen importieren?\n\n` +
        `- Abruf-Intervall: ${data.fetchInterval} Minuten\n` +
        `- Filter: ${data.emailFilters?.length || 0}\n` +
        `- Exportiert am: ${new Date(data.exportDate).toLocaleString('de-DE')}\n\n` +
        `Aktuelle Einstellungen werden überschrieben.`;

      if (await confirm({ message: confirmMessage, confirmLabel: 'Importieren' })) {
        onImport(data);
        toast.showSuccess('Einstellungen erfolgreich importiert!');
      }
    } catch (error) {
      console.error('Fehler beim Import:', error);
      toast.showError('Fehler beim Importieren der Einstellungen. Bitte überprüfen Sie die Datei.');
    } finally {
      setImporting(false);
      // Reset file input
      event.target.value = '';
    }
  };

  return (
    <div className="card">
      <h3 style={{ marginBottom: '1rem', fontSize: '1.125rem', fontWeight: '600' }}>
        Einstellungen exportieren / importieren
      </h3>
      <p style={{ marginBottom: '1.5rem', color: '#6c757d', fontSize: '0.875rem' }}>
        Erstellen Sie ein Backup Ihrer Einstellungen oder stellen Sie eine vorherige Konfiguration wieder her.
      </p>
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        <button onClick={handleExport} className="btn btn-primary">
          <FiDownload size={16} />
          <span>Exportieren</span>
        </button>
        <label className="btn btn-secondary" style={{ cursor: 'pointer' }}>
          <FiUpload size={16} />
          <span>{importing ? 'Importiere...' : 'Importieren'}</span>
          <input
            type="file"
            accept=".json"
            onChange={handleImport}
            disabled={importing}
            style={{ display: 'none' }}
          />
        </label>
      </div>
    </div>
  );
}

