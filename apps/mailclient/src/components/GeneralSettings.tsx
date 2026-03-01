'use client';

import Card from './Card';
import Button from './Button';
import Input from './Input';
import { FiSave } from 'react-icons/fi';

interface GeneralSettingsProps {
  fetchInterval: number;
  onFetchIntervalChange: (interval: number) => void;
  onSave: () => void;
  saving: boolean;
  autoSaveStatus?: 'idle' | 'saving' | 'saved';
}

export default function GeneralSettings({
  fetchInterval,
  onFetchIntervalChange,
  onSave,
  saving,
  autoSaveStatus = 'idle',
}: GeneralSettingsProps) {
  return (
    <Card>
      <h2 className="text-xl font-semibold mb-6">
        Allgemeine Einstellungen
      </h2>

      <div className="mb-8">
        <Input
          type="number"
          min="1"
          max="1440"
          value={fetchInterval.toString()}
          onChange={(e) => onFetchIntervalChange(parseInt(e.target.value) || 5)}
          label="E-Mail-Abruf-Intervall (in Minuten):"
          className="max-w-[200px]"
        />
        <small className="block mt-2 text-sm text-gray-500">
          Legen Sie fest, alle wie viele Minuten E-Mails von den aktiven Konten abgerufen werden sollen.
          <br />
          Mindestens 1 Minute, maximal 1440 Minuten (24 Stunden).
        </small>
      </div>

      <div className="flex items-center gap-4">
        <Button
          onClick={onSave}
          disabled={saving}
          variant="primary"
          className="min-w-[150px]"
        >
          {saving ? (
            <>
              <div className="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }}></div>
              <span>Speichern...</span>
            </>
          ) : (
            <>
              <FiSave size={16} />
              <span>Einstellungen speichern</span>
            </>
          )}
        </Button>
        {autoSaveStatus !== 'idle' && (
          <span
            className={`text-sm italic ${
              autoSaveStatus === 'saving' ? 'text-gray-500' : 'text-success'
            }`}
          >
            {autoSaveStatus === 'saving' ? 'Wird gespeichert...' : 'Gespeichert'}
          </span>
        )}
      </div>
    </Card>
  );
}

