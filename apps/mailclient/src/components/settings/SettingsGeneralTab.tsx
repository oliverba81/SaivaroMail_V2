'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ToastProvider';
import GeneralSettings from '@/components/GeneralSettings';
import SettingsExportImport from '@/components/SettingsExportImport';
import Card from '@/components/Card';
import Button from '@/components/Button';
import { FiSave, FiVolume2, FiPlus, FiTrash2 } from 'react-icons/fi';

export type AiProvider = 'openai' | 'google';

function ExternalContentList({
  items,
  placeholder,
  onAdd,
  onRemove,
}: {
  items: string[];
  placeholder: string;
  onAdd: (value: string) => void;
  onRemove: (value: string) => void;
}) {
  const [inputValue, setInputValue] = useState('');

  const handleAdd = () => {
    const trimmed = inputValue.trim();
    if (trimmed) {
      onAdd(trimmed);
      setInputValue('');
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAdd())}
          placeholder={placeholder}
          style={{
            flex: 1,
            padding: '0.5rem',
            border: '1px solid #d1d5db',
            borderRadius: '4px',
            fontSize: '0.9rem',
          }}
        />
        <button
          type="button"
          onClick={handleAdd}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.25rem',
            padding: '0.5rem 0.75rem',
            border: '1px solid #d1d5db',
            borderRadius: '4px',
            backgroundColor: '#f8f9fa',
            cursor: 'pointer',
            fontSize: '0.875rem',
          }}
        >
          <FiPlus size={14} />
          Hinzufügen
        </button>
      </div>
      {items.length > 0 && (
        <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
          {items.map((item) => (
            <li
              key={item}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.375rem 0',
                borderBottom: '1px solid #eee',
                fontSize: '0.875rem',
              }}
            >
              <span style={{ wordBreak: 'break-all' }}>{item}</span>
              <button
                type="button"
                onClick={() => onRemove(item)}
                aria-label={`${item} entfernen`}
                style={{
                  padding: '0.25rem',
                  border: 'none',
                  backgroundColor: 'transparent',
                  cursor: 'pointer',
                  color: '#dc2626',
                  flexShrink: 0,
                }}
              >
                <FiTrash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export interface InitialSettings {
  fetchIntervalMinutes?: number;
  openaiApiKey?: string | null;
  openaiModel?: string;
  elevenlabsApiKey?: string | null;
  elevenlabsVoiceId?: string | null;
  elevenlabsEnabled?: boolean;
  themeRequired?: boolean;
  permanentDeleteAfterDays?: number;
  aiProvider?: AiProvider;
  geminiApiKey?: string | null;
  geminiModel?: string;
   spamSenderWhitelist?: string[];
}

interface SettingsGeneralTabProps {
  onError?: (error: string) => void;
  onBack?: () => void;
  toast?: ReturnType<typeof useToast>;
  router?: ReturnType<typeof useRouter>;
  onHasUnsavedChanges?: (hasChanges: boolean) => void;
  emailFilters?: any[];
  onEmailFiltersChange?: (filters: any[]) => void;
  cardOrder?: string[];
  onCardOrderChange?: (order: string[]) => void;
  onSaveFilters?: () => Promise<void>;
  initialSettings?: InitialSettings;
  externalContentAlwaysAllow?: boolean;
  externalContentAllowedDomains?: string[];
  externalContentAllowedSenders?: string[];
  onExternalContentPrefsChange?: (prefs: {
    externalContentAlwaysAllow?: boolean;
    externalContentAllowedDomains?: string[];
    externalContentAllowedSenders?: string[];
  }) => void;
}

export default function SettingsGeneralTab({
  onError,
  onBack: _onBack,
  toast: toastProp,
  router: routerProp,
  onHasUnsavedChanges,
  emailFilters = [],
  onEmailFiltersChange,
  cardOrder,
  onCardOrderChange,
  onSaveFilters: _onSaveFilters,
  initialSettings,
  externalContentAlwaysAllow = false,
  externalContentAllowedDomains = [],
  externalContentAllowedSenders = [],
  onExternalContentPrefsChange,
}: SettingsGeneralTabProps) {
  const router = routerProp || useRouter();
  const toast = toastProp || useToast();

  // Sektion 1: System & Abruf
  const [fetchInterval, setFetchInterval] = useState(5);
  const originalFetchIntervalRef = useRef<number>(5);

  // AI Provider & OpenAI & Gemini & ElevenLabs Config
  const [aiProvider, setAiProvider] = useState<AiProvider>('openai');
  const [openaiApiKey, setOpenaiApiKey] = useState('');
  const [openaiModel, setOpenaiModel] = useState('gpt-4o-mini');
  const [showOpenaiKey, setShowOpenaiKey] = useState(false);
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [geminiModel, setGeminiModel] = useState('gemini-2.0-flash');
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [elevenlabsApiKey, setElevenlabsApiKey] = useState('');
  const [elevenlabsVoiceId, setElevenlabsVoiceId] = useState('');
  const [elevenlabsEnabled, setElevenlabsEnabled] = useState(false);
  const [showElevenlabsKey, setShowElevenlabsKey] = useState(false);
  const [themeRequired, setThemeRequired] = useState(false);
  const [permanentDeleteAfterDays, setPermanentDeleteAfterDays] = useState(0);
  const [spamSenderWhitelist, setSpamSenderWhitelist] = useState<string[]>([]);

  // Original-Konfiguration zum Erkennen ungespeicherter Änderungen
  const originalConfigRef = useRef<{
    aiProvider: AiProvider;
    openaiApiKey: string;
    openaiModel: string;
    geminiApiKey: string;
    geminiModel: string;
    elevenlabsApiKey: string;
    elevenlabsVoiceId: string;
    elevenlabsEnabled: boolean;
    themeRequired: boolean;
    permanentDeleteAfterDays: number;
    spamSenderWhitelist: string[];
  }>({
    aiProvider: 'openai',
    openaiApiKey: '',
    openaiModel: 'gpt-4o-mini',
    geminiApiKey: '',
    geminiModel: 'gemini-2.0-flash',
    elevenlabsApiKey: '',
    elevenlabsVoiceId: '',
    elevenlabsEnabled: false,
    themeRequired: false,
    permanentDeleteAfterDays: 0,
    spamSenderWhitelist: [],
  });

  const [_hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  // Initialwerte aus parent (`initialSettings`) übernehmen
  useEffect(() => {
    if (!initialSettings) return;

    if (initialSettings.fetchIntervalMinutes !== undefined) {
      const minutes = Math.min(1440, Math.max(1, Number(initialSettings.fetchIntervalMinutes) || 5));
      setFetchInterval(minutes);
      originalFetchIntervalRef.current = minutes;
    }
    if (initialSettings.openaiApiKey !== undefined && initialSettings.openaiApiKey !== null) {
      setOpenaiApiKey(initialSettings.openaiApiKey);
      originalConfigRef.current.openaiApiKey = initialSettings.openaiApiKey;
    }
    if (initialSettings.openaiModel) {
      setOpenaiModel(initialSettings.openaiModel);
      originalConfigRef.current.openaiModel = initialSettings.openaiModel;
    }
    if (initialSettings.aiProvider === 'openai' || initialSettings.aiProvider === 'google') {
      setAiProvider(initialSettings.aiProvider);
      originalConfigRef.current.aiProvider = initialSettings.aiProvider;
    }
    if (initialSettings.geminiApiKey !== undefined && initialSettings.geminiApiKey !== null) {
      setGeminiApiKey(initialSettings.geminiApiKey);
      originalConfigRef.current.geminiApiKey = initialSettings.geminiApiKey;
    }
    if (initialSettings.geminiModel) {
      setGeminiModel(initialSettings.geminiModel);
      originalConfigRef.current.geminiModel = initialSettings.geminiModel;
    }
    if (initialSettings.elevenlabsApiKey !== undefined && initialSettings.elevenlabsApiKey !== null) {
      setElevenlabsApiKey(initialSettings.elevenlabsApiKey);
      originalConfigRef.current.elevenlabsApiKey = initialSettings.elevenlabsApiKey;
    }
    if (initialSettings.elevenlabsVoiceId !== undefined && initialSettings.elevenlabsVoiceId !== null) {
      setElevenlabsVoiceId(initialSettings.elevenlabsVoiceId);
      originalConfigRef.current.elevenlabsVoiceId = initialSettings.elevenlabsVoiceId;
    }
    if (initialSettings.elevenlabsEnabled !== undefined) {
      setElevenlabsEnabled(initialSettings.elevenlabsEnabled);
      originalConfigRef.current.elevenlabsEnabled = initialSettings.elevenlabsEnabled;
    }
    if (initialSettings.themeRequired !== undefined) {
      setThemeRequired(initialSettings.themeRequired);
      originalConfigRef.current.themeRequired = initialSettings.themeRequired;
    }
    if (initialSettings.permanentDeleteAfterDays !== undefined) {
      const days = Math.max(0, Math.floor(Number(initialSettings.permanentDeleteAfterDays)) || 0);
      setPermanentDeleteAfterDays(days);
      originalConfigRef.current.permanentDeleteAfterDays = days;
    }
    if (Array.isArray(initialSettings.spamSenderWhitelist)) {
      const normalized = initialSettings.spamSenderWhitelist.map((s) =>
        String(s).toLowerCase().trim()
      );
      setSpamSenderWhitelist(normalized);
      originalConfigRef.current.spamSenderWhitelist = normalized;
    }
  }, [initialSettings]);

  // Unsaved-Changes-Tracking
  useEffect(() => {
    const hasChanges =
      fetchInterval !== originalFetchIntervalRef.current ||
      aiProvider !== originalConfigRef.current.aiProvider ||
      openaiApiKey !== originalConfigRef.current.openaiApiKey ||
      openaiModel !== originalConfigRef.current.openaiModel ||
      geminiApiKey !== originalConfigRef.current.geminiApiKey ||
      geminiModel !== originalConfigRef.current.geminiModel ||
      elevenlabsApiKey !== originalConfigRef.current.elevenlabsApiKey ||
      elevenlabsVoiceId !== originalConfigRef.current.elevenlabsVoiceId ||
      elevenlabsEnabled !== originalConfigRef.current.elevenlabsEnabled ||
      themeRequired !== originalConfigRef.current.themeRequired ||
      permanentDeleteAfterDays !== originalConfigRef.current.permanentDeleteAfterDays ||
      JSON.stringify(spamSenderWhitelist) !==
        JSON.stringify(originalConfigRef.current.spamSenderWhitelist);

    setHasUnsavedChanges(hasChanges);
    if (onHasUnsavedChanges) {
      onHasUnsavedChanges(hasChanges);
    }
  }, [
    fetchInterval,
    aiProvider,
    openaiApiKey,
    openaiModel,
    geminiApiKey,
    geminiModel,
    elevenlabsApiKey,
    elevenlabsVoiceId,
    elevenlabsEnabled,
    themeRequired,
    permanentDeleteAfterDays,
    onHasUnsavedChanges,
  ]);

  const handleSaveSettings = useCallback(async () => {
    setSavingSettings(true);
    if (onError) {
      onError('');
    }

    try {
      const requestBody = {
        fetchIntervalMinutes: fetchInterval,
        aiProvider,
        openaiApiKey: openaiApiKey && openaiApiKey.trim() ? openaiApiKey.trim() : null,
        openaiModel,
        geminiApiKey: geminiApiKey && geminiApiKey.trim() ? geminiApiKey.trim() : null,
        geminiModel,
        elevenlabsApiKey: elevenlabsApiKey && elevenlabsApiKey.trim() ? elevenlabsApiKey.trim() : null,
        elevenlabsVoiceId: elevenlabsVoiceId && elevenlabsVoiceId.trim() ? elevenlabsVoiceId.trim() : null,
        elevenlabsEnabled,
        themeRequired,
        permanentDeleteAfterDays: Math.max(0, Math.floor(Number(permanentDeleteAfterDays)) || 0),
      spamSenderWhitelist,
      };

      const token = localStorage.getItem('mailclient_token');
      const response = await fetch('/api/settings', {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (response.status === 401) {
        localStorage.removeItem('mailclient_token');
        localStorage.removeItem('mailclient_user');
        router.push('/login');
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        const errorMsg = data.error || 'Fehler beim Speichern der Einstellungen';
        if (onError) {
          onError(errorMsg);
        }
        return;
      }

      toast.showSuccess('Einstellungen erfolgreich gespeichert!');

      originalFetchIntervalRef.current = fetchInterval;

      if (data.settings) {
        if (data.settings.openaiApiKey !== undefined) {
          if (data.settings.openaiApiKey !== null) {
            originalConfigRef.current.openaiApiKey = data.settings.openaiApiKey;
            setOpenaiApiKey(data.settings.openaiApiKey);
          } else if (openaiApiKey === '') {
            originalConfigRef.current.openaiApiKey = '';
          }
        }

        if (data.settings.openaiModel !== undefined) {
          originalConfigRef.current.openaiModel = data.settings.openaiModel;
          setOpenaiModel(data.settings.openaiModel);
        }

        if (data.settings.elevenlabsApiKey !== undefined) {
          if (data.settings.elevenlabsApiKey !== null) {
            originalConfigRef.current.elevenlabsApiKey = data.settings.elevenlabsApiKey;
            setElevenlabsApiKey(data.settings.elevenlabsApiKey);
          } else if (elevenlabsApiKey === '') {
            originalConfigRef.current.elevenlabsApiKey = '';
          }
        }

        if (data.settings.elevenlabsVoiceId !== undefined && data.settings.elevenlabsVoiceId !== null) {
          originalConfigRef.current.elevenlabsVoiceId = data.settings.elevenlabsVoiceId;
          setElevenlabsVoiceId(data.settings.elevenlabsVoiceId);
        }
        if (data.settings.elevenlabsEnabled !== undefined) {
          originalConfigRef.current.elevenlabsEnabled = data.settings.elevenlabsEnabled;
          setElevenlabsEnabled(data.settings.elevenlabsEnabled);
        }
        if (data.settings.themeRequired !== undefined) {
          originalConfigRef.current.themeRequired = data.settings.themeRequired;
          setThemeRequired(data.settings.themeRequired);
        }
        if (data.settings.permanentDeleteAfterDays !== undefined) {
          const days = Math.max(0, Math.floor(Number(data.settings.permanentDeleteAfterDays)) || 0);
          originalConfigRef.current.permanentDeleteAfterDays = days;
          setPermanentDeleteAfterDays(days);
        }
        if (data.settings.aiProvider === 'openai' || data.settings.aiProvider === 'google') {
          originalConfigRef.current.aiProvider = data.settings.aiProvider;
          setAiProvider(data.settings.aiProvider);
        }
        if (data.settings.geminiApiKey !== undefined) {
          if (data.settings.geminiApiKey !== null) {
            originalConfigRef.current.geminiApiKey = data.settings.geminiApiKey;
            setGeminiApiKey(data.settings.geminiApiKey);
          } else if (geminiApiKey === '') {
            originalConfigRef.current.geminiApiKey = '';
          }
        }
        if (data.settings.geminiModel !== undefined) {
          originalConfigRef.current.geminiModel = data.settings.geminiModel;
          setGeminiModel(data.settings.geminiModel);
        }
        if (Array.isArray(data.settings.spamSenderWhitelist)) {
          const normalized = data.settings.spamSenderWhitelist.map((s: any) =>
            String(s).toLowerCase().trim()
          );
          originalConfigRef.current.spamSenderWhitelist = normalized;
          setSpamSenderWhitelist(normalized);
        }
      }

      setHasUnsavedChanges(false);
      if (onHasUnsavedChanges) {
        onHasUnsavedChanges(false);
      }
    } catch (err: any) {
      const errorMsg = 'Fehler beim Speichern der Einstellungen';
      if (onError) {
        onError(errorMsg);
      }
    } finally {
      setSavingSettings(false);
    }
  }, [
    aiProvider,
    elevenlabsApiKey,
    elevenlabsEnabled,
    elevenlabsVoiceId,
    fetchInterval,
    geminiApiKey,
    geminiModel,
    onError,
    onHasUnsavedChanges,
    openaiApiKey,
    openaiModel,
    permanentDeleteAfterDays,
    router,
    themeRequired,
    toast,
  ]);

  // Keyboard Shortcut: Ctrl+S / Cmd+S für globales Speichern
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's' && !savingSettings) {
        e.preventDefault();
        handleSaveSettings();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSaveSettings, savingSettings]);

  const handleFetchIntervalChange = useCallback((interval: number) => {
    const clamped = Math.min(1440, Math.max(1, interval || 1));
    setFetchInterval(clamped);
  }, []);

  const handleImportSettings = useCallback(
    async (data: any) => {
      if (data.fetchInterval) {
        const minutes = Math.min(1440, Math.max(1, Number(data.fetchInterval) || 5));
        setFetchInterval(minutes);
      }
      if (data.emailFilters && onEmailFiltersChange) {
        onEmailFiltersChange(data.emailFilters);
      }
      if (data.cardOrder && onCardOrderChange) {
        onCardOrderChange(data.cardOrder);
      }

      setHasUnsavedChanges(true);
      if (onHasUnsavedChanges) {
        onHasUnsavedChanges(true);
      }

      toast.showSuccess(
        'Einstellungen importiert. Bitte unten auf „Alle Einstellungen speichern“ klicken, um sie zu übernehmen.',
      );
    },
    [onCardOrderChange, onEmailFiltersChange, onHasUnsavedChanges, toast],
  );

  return (
    <>
      {/* Sektion 1: System & Abruf / Allgemeine Einstellungen */}
      <GeneralSettings
        fetchInterval={fetchInterval}
        onFetchIntervalChange={handleFetchIntervalChange}
        themeRequired={themeRequired}
        onThemeRequiredChange={setThemeRequired}
      />

      {/* Sektion 2: Daten & Wartung */}
      <div style={{ marginTop: '1.5rem' }}>
        <SettingsExportImport
          fetchInterval={fetchInterval}
          emailFilters={emailFilters}
          cardOrder={cardOrder}
          onImport={handleImportSettings}
        />
      </div>
      <div style={{ marginTop: '1.5rem' }}>
        <Card className="p-8 space-y-4">
          <h2 className="text-xl font-semibold mb-3">Papierkorb & Aufräumregeln</h2>
          <div style={{ marginBottom: '1.5rem' }}>
            <label
              style={{
                display: 'block',
                marginBottom: '0.5rem',
                fontWeight: '600',
                color: '#333',
                fontSize: '0.9rem',
              }}
            >
              Gelöschte E-Mails endgültig löschen nach (Tage)
            </label>
            <input
              type="number"
              min={0}
              max={36500}
              value={permanentDeleteAfterDays}
              onChange={(e) =>
                setPermanentDeleteAfterDays(Math.max(0, Math.floor(Number(e.target.value)) || 0))
              }
              style={{
                width: '120px',
                padding: '0.5rem',
                border: '1px solid #d1d5db',
                borderRadius: '4px',
                fontSize: '0.9rem',
              }}
            />
            <small className="block mt-1 text-sm text-gray-500">
              0 = nie (gelöscht markierte E-Mails bleiben dauerhaft im Papierkorb). Ein Cron-Job löscht E-Mails,
              die länger als die angegebene Anzahl Tage als gelöscht markiert sind.
            </small>
          </div>
        </Card>
      </div>

      {/* Sektion: Externe E-Mail-Inhalte (Datenschutz) */}
      {onExternalContentPrefsChange && (
        <div style={{ marginTop: '1.5rem' }}>
          <Card className="p-8 space-y-4">
            <h2 className="text-xl font-semibold mb-3">Externe E-Mail-Inhalte</h2>
            <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '1rem' }}>
              Externe Inhalte (z. B. Bilder von Servern wie tracking-Domains) werden standardmäßig blockiert, um
              Ihre Privatsphäre zu schützen. Sie können sie hier global oder für bestimmte Domains und Absender
              erlauben.
            </p>

            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() =>
                    onExternalContentPrefsChange({ externalContentAlwaysAllow: !externalContentAlwaysAllow })
                  }
                  style={{
                    width: '48px',
                    height: '24px',
                    borderRadius: '12px',
                    backgroundColor: externalContentAlwaysAllow ? '#4CAF50' : '#ccc',
                    position: 'relative',
                    cursor: 'pointer',
                    border: 'none',
                    transition: 'background-color 0.2s',
                  }}
                >
                  <div
                    style={{
                      width: '20px',
                      height: '20px',
                      borderRadius: '50%',
                      backgroundColor: '#fff',
                      position: 'absolute',
                      top: '2px',
                      left: externalContentAlwaysAllow ? '26px' : '2px',
                      transition: 'left 0.2s',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                    }}
                  />
                </button>
                <span style={{ fontSize: '0.875rem', color: '#333' }}>
                  Externe Inhalte (z. B. Bilder) standardmäßig anzeigen
                </span>
              </div>
              <small className="block mt-1 text-sm text-gray-500">
                Wenn aktiviert, werden externe Bilder in allen E-Mails angezeigt. Deaktiviert empfohlen für mehr
                Datenschutz.
              </small>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label
                style={{
                  display: 'block',
                  marginBottom: '0.5rem',
                  fontWeight: '600',
                  color: '#333',
                  fontSize: '0.9rem',
                }}
              >
                Erlaubte Domains
              </label>
              <p style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: '0.5rem' }}>
                Domains, von denen Bilder und externe Inhalte geladen werden dürfen (z. B. amazon.de,
                m.media-amazon.com).
              </p>
              <ExternalContentList
                items={externalContentAllowedDomains}
                placeholder="z. B. amazon.de"
                onAdd={(domain) => {
                  const normalized = domain.toLowerCase().trim();
                  if (!normalized) return;
                  const existing = externalContentAllowedDomains.map((d) => d.toLowerCase());
                  if (existing.includes(normalized)) return;
                  onExternalContentPrefsChange({
                    externalContentAllowedDomains: [...externalContentAllowedDomains, normalized],
                  });
                }}
                onRemove={(domain) => {
                  onExternalContentPrefsChange({
                    externalContentAllowedDomains: externalContentAllowedDomains.filter(
                      (d) => d.toLowerCase() !== domain.toLowerCase()
                    ),
                  });
                }}
              />
            </div>

            <div>
              <label
                style={{
                  display: 'block',
                  marginBottom: '0.5rem',
                  fontWeight: '600',
                  color: '#333',
                  fontSize: '0.9rem',
                }}
              >
                Erlaubte Absender
              </label>
              <p style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: '0.5rem' }}>
                E-Mail-Adressen von Absendern, deren externe Inhalte immer angezeigt werden (z. B.
                versandbestaetigung@amazon.de).
              </p>
              <ExternalContentList
                items={externalContentAllowedSenders}
                placeholder="z. B. newsletter@example.com"
                onAdd={(sender) => {
                  const normalized = sender.toLowerCase().trim();
                  if (!normalized || !normalized.includes('@')) return;
                  const existing = externalContentAllowedSenders.map((s) => s.toLowerCase());
                  if (existing.includes(normalized)) return;
                  onExternalContentPrefsChange({
                    externalContentAllowedSenders: [...externalContentAllowedSenders, normalized],
                  });
                }}
                onRemove={(sender) => {
                  onExternalContentPrefsChange({
                    externalContentAllowedSenders: externalContentAllowedSenders.filter(
                      (s) => s.toLowerCase() !== sender.toLowerCase()
                    ),
                  });
                }}
              />
            </div>
          </Card>
        </div>
      )}

      {/* Sektion 3: AI-Einstellungen */}
      <div style={{ marginTop: '1.5rem' }}>
        <Card className="p-8">
          <h2 className="text-xl font-semibold mb-6">AI-Provider für E-Mail-Zusammenfassung</h2>
          <div className="mb-6">
            <label className="block text-sm font-medium mb-2">API-Provider:</label>
            <select
              value={aiProvider}
              onChange={(e) => setAiProvider(e.target.value as AiProvider)}
              style={{
                width: '100%',
                maxWidth: '300px',
                padding: '0.5rem',
                border: '1px solid #ddd',
                borderRadius: '4px',
              }}
            >
              <option value="openai">OpenAI (GPT)</option>
              <option value="google">Google Gemini</option>
            </select>
            <small className="block mt-2 text-sm text-gray-500">
              Wählen Sie den AI-Provider für die E-Mail-Zusammenfassung.
            </small>
          </div>

          {aiProvider === 'openai' && (
            <>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">OpenAI API-Key:</label>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <input
                    type={showOpenaiKey ? 'text' : 'password'}
                    value={openaiApiKey}
                    onChange={(e) => setOpenaiApiKey(e.target.value)}
                    placeholder="sk-..."
                    style={{
                      flex: 1,
                      padding: '0.5rem',
                      border: '1px solid #ddd',
                      borderRadius: '4px',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowOpenaiKey(!showOpenaiKey)}
                    style={{
                      padding: '0.5rem 1rem',
                      border: '1px solid #ddd',
                      borderRadius: '4px',
                      backgroundColor: '#f8f9fa',
                      cursor: 'pointer',
                    }}
                  >
                    {showOpenaiKey ? 'Verbergen' : 'Anzeigen'}
                  </button>
                </div>
                <small className="block mt-2 text-sm text-gray-500">
                  Dieser API-Key wird für E-Mail-Zusammenfassungen verwendet.
                </small>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">OpenAI Modell:</label>
                <select
                  value={openaiModel}
                  onChange={(e) => setOpenaiModel(e.target.value)}
                  style={{
                    width: '100%',
                    maxWidth: '300px',
                    padding: '0.5rem',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                  }}
                >
                  <option value="gpt-4o-mini">GPT-4o Mini (Empfohlen, kostengünstig)</option>
                  <option value="gpt-3.5-turbo">GPT-3.5 Turbo (Schnell, kostengünstig)</option>
                  <option value="gpt-4">GPT-4 (Bessere Qualität, teurer)</option>
                  <option value="gpt-4-turbo">GPT-4 Turbo (Beste Qualität, teuer)</option>
                </select>
              </div>
            </>
          )}

          {aiProvider === 'google' && (
            <>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Google Gemini API-Key:</label>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <input
                    type={showGeminiKey ? 'text' : 'password'}
                    value={geminiApiKey}
                    onChange={(e) => setGeminiApiKey(e.target.value)}
                    placeholder="AIza..."
                    style={{
                      flex: 1,
                      padding: '0.5rem',
                      border: '1px solid #ddd',
                      borderRadius: '4px',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowGeminiKey(!showGeminiKey)}
                    style={{
                      padding: '0.5rem 1rem',
                      border: '1px solid #ddd',
                      borderRadius: '4px',
                      backgroundColor: '#f8f9fa',
                      cursor: 'pointer',
                    }}
                  >
                    {showGeminiKey ? 'Verbergen' : 'Anzeigen'}
                  </button>
                </div>
                <small className="block mt-2 text-sm text-gray-500">
                  API-Key aus Google AI Studio. Wird für E-Mail-Zusammenfassungen verwendet.
                </small>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Gemini Modell:</label>
                <select
                  value={geminiModel}
                  onChange={(e) => setGeminiModel(e.target.value)}
                  style={{
                    width: '100%',
                    maxWidth: '300px',
                    padding: '0.5rem',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                  }}
                >
                  <option value="gemini-2.0-flash">Gemini 2.0 Flash (Schnell, günstig)</option>
                  <option value="gemini-2.5-flash">Gemini 2.5 Flash (Gutes Preis-Leistungs-Verhältnis)</option>
                  <option value="gemini-2.5-pro">Gemini 2.5 Pro (Höhere Qualität)</option>
                  <option value="gemini-1.5-flash">Gemini 1.5 Flash (Stabiler Fallback)</option>
                </select>
              </div>
            </>
          )}

          {/* Spam-Whitelist für Absender */}
          <div style={{ marginTop: '1.5rem' }}>
            <h3 className="text-lg font-semibold mb-2">Spam-Whitelist für Absender</h3>
            <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.5rem' }}>
              Absender (E-Mail-Adressen oder Domains), die <strong>niemals als Spam eingestuft</strong> werden sollen.
              Ein Eintrag pro Zeile, z. B.:
            </p>
            <ul style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: '0.5rem', paddingLeft: '1.25rem' }}>
              <li><code>newsletter@example.com</code> – exakte Adresse</li>
              <li><code>@firma.de</code> – alle Absender mit dieser Domain</li>
              <li><code>firma.de</code> – alle Absender mit Domain <code>firma.de</code></li>
            </ul>
            <textarea
              value={spamSenderWhitelist.join('\n')}
              onChange={(e) =>
                setSpamSenderWhitelist(
                  e.target.value
                    .split('\n')
                    .map((s) => s.toLowerCase().trim())
                    .filter((s) => s.length > 0)
                )
              }
              rows={5}
              style={{
                width: '100%',
                maxWidth: '480px',
                padding: '0.5rem',
                border: '1px solid #d1d5db',
                borderRadius: '4px',
                fontSize: '0.875rem',
                fontFamily: 'monospace',
                whiteSpace: 'pre',
              }}
              placeholder={'newsletter@example.com\n@firma.de\nfirma.de'}
            />
            <small className="block mt-1 text-sm text-gray-500">
              Treffer werden vor dem AI-Spam-Check geprüft. Bei Übereinstimmung wird die Nachricht immer als „kein Spam“
              behandelt und der AI-Aufruf entfällt.
            </small>
          </div>
        </Card>
      </div>

      {/* Sektion 4: ElevenLabs & Regeln */}
      <div style={{ marginTop: '1.5rem' }}>
        <Card className="p-8">
          <h2 className="text-xl font-semibold mb-6">ElevenLabs & Arbeitsregeln</h2>

          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">ElevenLabs aktivieren:</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={() => setElevenlabsEnabled((prev) => !prev)}
                style={{
                  width: '48px',
                  height: '24px',
                  borderRadius: '12px',
                  backgroundColor: elevenlabsEnabled ? '#4CAF50' : '#ccc',
                  position: 'relative',
                  cursor: 'pointer',
                  border: 'none',
                  transition: 'background-color 0.2s',
                }}
              >
                <div
                  style={{
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    backgroundColor: '#fff',
                    position: 'absolute',
                    top: '2px',
                    left: elevenlabsEnabled ? '26px' : '2px',
                    transition: 'left 0.2s',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                  }}
                />
              </button>
              <span style={{ fontSize: '0.875rem', color: '#333' }}>
                {elevenlabsEnabled ? 'Aktiviert' : 'Deaktiviert'}
              </span>
            </div>
            <small className="block mt-2 text-sm text-gray-500">
              Aktivieren Sie ElevenLabs, um bessere Text-to-Speech-Stimmen zu verwenden. Wenn deaktiviert, wird die
              Browser-native Speech API verwendet.
            </small>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">API-Key (optional):</label>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <input
                type={showElevenlabsKey ? 'text' : 'password'}
                value={elevenlabsApiKey}
                onChange={(e) => setElevenlabsApiKey(e.target.value)}
                placeholder="ElevenLabs API-Key"
                style={{
                  flex: 1,
                  padding: '0.5rem',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                }}
              />
              <button
                type="button"
                onClick={() => setShowElevenlabsKey(!showElevenlabsKey)}
                style={{
                  padding: '0.5rem 1rem',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  backgroundColor: '#f8f9fa',
                  cursor: 'pointer',
                }}
              >
                {showElevenlabsKey ? 'Verbergen' : 'Anzeigen'}
              </button>
            </div>
            <small className="block mt-2 text-sm text-gray-500">
              Optional: Für bessere Text-to-Speech-Stimmen. Wenn nicht gesetzt, wird die Browser-native Speech API
              verwendet.
            </small>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Voice-ID (optional):</label>
            <input
              type="text"
              value={elevenlabsVoiceId}
              onChange={(e) => setElevenlabsVoiceId(e.target.value)}
              placeholder="z.B. pNInz6obpgDQGcFmaJgB"
              style={{
                width: '100%',
                maxWidth: '300px',
                padding: '0.5rem',
                border: '1px solid #ddd',
                borderRadius: '4px',
              }}
            />
            <small className="block mt-2 text-sm text-gray-500">
              Optional: Voice-ID für ElevenLabs. Wenn nicht gesetzt, wird eine Standard-Voice verwendet.
            </small>
          </div>

          <div className="flex items-center gap-4">
            <Button
              onClick={async () => {
                const token = localStorage.getItem('mailclient_token');
                if (!token) {
                  toast.showError('Bitte zuerst speichern, um den Test durchzuführen.');
                  return;
                }

                if (!elevenlabsApiKey || !elevenlabsApiKey.trim()) {
                  toast.showError('Bitte geben Sie zuerst einen ElevenLabs API-Key ein.');
                  return;
                }

                try {
                  const response = await fetch('/api/settings/test-elevenlabs', {
                    method: 'POST',
                    headers: {
                      Authorization: `Bearer ${token}`,
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                      elevenlabsApiKey: elevenlabsApiKey.trim(),
                      elevenlabsVoiceId: elevenlabsVoiceId.trim() || undefined,
                    }),
                  });

                  if (response.ok) {
                    const audioBlob = await response.blob();
                    const audioUrl = URL.createObjectURL(audioBlob);
                    const audio = new Audio(audioUrl);
                    audio.play();
                    audio.onended = () => {
                      URL.revokeObjectURL(audioUrl);
                      toast.showSuccess('Test erfolgreich! ElevenLabs funktioniert.');
                    };
                    audio.onerror = () => {
                      URL.revokeObjectURL(audioUrl);
                      toast.showError('Fehler beim Abspielen des Test-Audios.');
                    };
                  } else {
                    const errorData = await response.json().catch(() => ({}));
                    toast.showError(errorData.error || 'Fehler beim Testen von ElevenLabs.');
                  }
                } catch (err: any) {
                  console.error('Fehler beim Testen von ElevenLabs:', err);
                  toast.showError('Fehler beim Testen von ElevenLabs.');
                }
              }}
              disabled={!elevenlabsApiKey || !elevenlabsApiKey.trim()}
              variant="secondary"
              className="min-w-[150px]"
            >
              <FiVolume2 size={16} />
              <span>Test</span>
            </Button>
          </div>
        </Card>
      </div>

      {/* Globales Aktions-Panel: Einziger Speichern-Button */}
      <div
        style={{
          marginTop: '2rem',
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'center',
          gap: '1rem',
        }}
      >
        {_hasUnsavedChanges && (
          <span className="text-sm text-gray-500 italic">Es gibt ungespeicherte Änderungen.</span>
        )}
        <Button
          onClick={handleSaveSettings}
          disabled={savingSettings || !_hasUnsavedChanges}
          variant="primary"
          className="min-w-[220px]"
        >
          {savingSettings ? (
            <>
              <div
                className="spinner"
                style={{ width: '16px', height: '16px', borderWidth: '2px' }}
              />
              <span>Speichern...</span>
            </>
          ) : (
            <>
              <FiSave size={16} />
              <span>Alle Einstellungen speichern</span>
            </>
          )}
        </Button>
      </div>
    </>
  );
}

