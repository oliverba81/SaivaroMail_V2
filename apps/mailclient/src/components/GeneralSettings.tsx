'use client';

import Card from './Card';
import Input from './Input';

interface GeneralSettingsProps {
  fetchInterval: number;
  onFetchIntervalChange: (interval: number) => void;
  themeRequired: boolean;
  onThemeRequiredChange: (required: boolean) => void;
}

export default function GeneralSettings({
  fetchInterval,
  onFetchIntervalChange,
  themeRequired,
  onThemeRequiredChange,
}: GeneralSettingsProps) {
  return (
    <Card className="p-8 space-y-8">
      <h2 className="text-xl font-semibold mb-6">
        Allgemeine Einstellungen
      </h2>

      <div>
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

      <div className="pt-5 mt-2 border-t border-gray-200">
        <label className="flex items-center gap-2 mb-1 cursor-pointer">
          <input
            type="checkbox"
            checked={themeRequired}
            onChange={(e) => onThemeRequiredChange(e.target.checked)}
            className="w-4 h-4 cursor-pointer"
          />
          <span className="font-semibold text-sm text-gray-800">
            Themenzuweisung ist Pflicht
          </span>
        </label>
        <small className="block mt-1 text-sm text-gray-500">
          Wenn aktiviert, muss bei E-Mails und Telefonnotizen ein Thema ausgewählt werden.
        </small>
      </div>
    </Card>
  );
}


