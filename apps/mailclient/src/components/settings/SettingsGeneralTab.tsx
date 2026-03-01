'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ToastProvider';
import GeneralSettings from '@/components/GeneralSettings';
import SettingsExportImport from '@/components/SettingsExportImport';
import Card from '@/components/Card';
import Button from '@/components/Button';
import { FiVolume2 } from 'react-icons/fi';

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
  onSaveFilters,
}: SettingsGeneralTabProps) {
  const router = routerProp || useRouter();
  const toast = toastProp || useToast();
  const [fetchInterval, setFetchInterval] = useState(5);
  const [savingSettings, setSavingSettings] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [_hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const originalFetchIntervalRef = useRef<number>(5);
  
  // OpenAI & ElevenLabs Config
  const [openaiApiKey, setOpenaiApiKey] = useState('');
  const [openaiModel, setOpenaiModel] = useState('gpt-4o-mini');
  const [showOpenaiKey, setShowOpenaiKey] = useState(false);
  const [elevenlabsApiKey, setElevenlabsApiKey] = useState('');
  const [elevenlabsVoiceId, setElevenlabsVoiceId] = useState('');
  const [elevenlabsEnabled, setElevenlabsEnabled] = useState(false);
  const [showElevenlabsKey, setShowElevenlabsKey] = useState(false);
  const [themeRequired, setThemeRequired] = useState(false);
  const [permanentDeleteAfterDays, setPermanentDeleteAfterDays] = useState(0);
  
  // Refs für State-Werte, um sicherzustellen, dass handleSaveSettings immer die aktuellsten Werte hat
  const openaiApiKeyRef = useRef(openaiApiKey);
  const elevenlabsApiKeyRef = useRef(elevenlabsApiKey);
  const elevenlabsVoiceIdRef = useRef(elevenlabsVoiceId);
  const elevenlabsEnabledRef = useRef(elevenlabsEnabled);
  const themeRequiredRef = useRef(themeRequired);
  
  // Aktualisiere Refs, wenn State sich ändert
  useEffect(() => {
    openaiApiKeyRef.current = openaiApiKey;
  }, [openaiApiKey]);
  
  useEffect(() => {
    elevenlabsApiKeyRef.current = elevenlabsApiKey;
  }, [elevenlabsApiKey]);
  
  useEffect(() => {
    elevenlabsVoiceIdRef.current = elevenlabsVoiceId;
  }, [elevenlabsVoiceId]);
  
  useEffect(() => {
    elevenlabsEnabledRef.current = elevenlabsEnabled;
  }, [elevenlabsEnabled]);
  
  useEffect(() => {
    themeRequiredRef.current = themeRequired;
  }, [themeRequired]);
  
  const originalConfigRef = useRef<{
    openaiApiKey: string;
    openaiModel: string;
    elevenlabsApiKey: string;
    elevenlabsVoiceId: string;
    elevenlabsEnabled: boolean;
    themeRequired: boolean;
    permanentDeleteAfterDays: number;
  }>({
    openaiApiKey: '',
    openaiModel: 'gpt-4o-mini',
    elevenlabsApiKey: '',
    elevenlabsVoiceId: '',
    elevenlabsEnabled: false,
    themeRequired: false,
    permanentDeleteAfterDays: 0,
  });

  // Lade fetchInterval beim Mount
  const loadFetchInterval = useCallback(async () => {
    try {
      const token = localStorage.getItem('mailclient_token');
      const response = await fetch('/api/settings', {
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
        const data = await response.json().catch(() => ({}));
        if (onError) {
          onError(data.error || 'Fehler beim Laden der Einstellungen');
        }
        return;
      }

      const data = await response.json();
      if (data.settings) {
        
        if (data.settings?.fetchIntervalMinutes) {
          setFetchInterval(data.settings.fetchIntervalMinutes);
          originalFetchIntervalRef.current = data.settings.fetchIntervalMinutes;
        }
        // Lade OpenAI & ElevenLabs Config
        if (data.settings?.openaiApiKey !== undefined && data.settings?.openaiApiKey !== null) {
          setOpenaiApiKey(data.settings.openaiApiKey);
          originalConfigRef.current.openaiApiKey = data.settings.openaiApiKey;
        }
        if (data.settings?.openaiModel) {
          setOpenaiModel(data.settings.openaiModel);
          originalConfigRef.current.openaiModel = data.settings.openaiModel;
        }
        if (data.settings?.elevenlabsApiKey !== undefined && data.settings?.elevenlabsApiKey !== null) {
          setElevenlabsApiKey(data.settings.elevenlabsApiKey);
          originalConfigRef.current.elevenlabsApiKey = data.settings.elevenlabsApiKey;
        }
        if (data.settings?.elevenlabsVoiceId !== undefined && data.settings?.elevenlabsVoiceId !== null) {
          setElevenlabsVoiceId(data.settings.elevenlabsVoiceId);
          originalConfigRef.current.elevenlabsVoiceId = data.settings.elevenlabsVoiceId;
        }
        if (data.settings?.elevenlabsEnabled !== undefined) {
          setElevenlabsEnabled(data.settings.elevenlabsEnabled);
          originalConfigRef.current.elevenlabsEnabled = data.settings.elevenlabsEnabled;
        }
        if (data.settings?.themeRequired !== undefined) {
          setThemeRequired(data.settings.themeRequired);
          originalConfigRef.current.themeRequired = data.settings.themeRequired;
        }
        if (data.settings?.permanentDeleteAfterDays !== undefined) {
          const days = Math.max(0, Math.floor(Number(data.settings.permanentDeleteAfterDays)) || 0);
          setPermanentDeleteAfterDays(days);
          originalConfigRef.current.permanentDeleteAfterDays = days;
        }
      }
    } catch (err: any) {
      console.error('Fehler beim Laden der Einstellungen:', err);
      if (onError) {
        onError(err?.message || 'Fehler beim Laden der Einstellungen');
      }
    }
  }, [router, onError]);

  useEffect(() => {
    loadFetchInterval();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Track unsaved changes
  useEffect(() => {
    const hasChanges = 
      fetchInterval !== originalFetchIntervalRef.current ||
      openaiApiKey !== originalConfigRef.current.openaiApiKey ||
      openaiModel !== originalConfigRef.current.openaiModel ||
      elevenlabsApiKey !== originalConfigRef.current.elevenlabsApiKey ||
      elevenlabsVoiceId !== originalConfigRef.current.elevenlabsVoiceId ||
      elevenlabsEnabled !== originalConfigRef.current.elevenlabsEnabled ||
      themeRequired !== originalConfigRef.current.themeRequired ||
      permanentDeleteAfterDays !== originalConfigRef.current.permanentDeleteAfterDays;
    setHasUnsavedChanges(hasChanges);
    if (onHasUnsavedChanges) {
      onHasUnsavedChanges(hasChanges);
    }
  }, [fetchInterval, openaiApiKey, openaiModel, elevenlabsApiKey, elevenlabsVoiceId, elevenlabsEnabled, themeRequired, permanentDeleteAfterDays, onHasUnsavedChanges]);

  // Auto-Save mit Debounce für alle Einstellungen
  useEffect(() => {
    const hasChanges = 
      fetchInterval !== originalFetchIntervalRef.current ||
      openaiApiKey !== originalConfigRef.current.openaiApiKey ||
      openaiModel !== originalConfigRef.current.openaiModel ||
      elevenlabsApiKey !== originalConfigRef.current.elevenlabsApiKey ||
      elevenlabsVoiceId !== originalConfigRef.current.elevenlabsVoiceId ||
      elevenlabsEnabled !== originalConfigRef.current.elevenlabsEnabled ||
      themeRequired !== originalConfigRef.current.themeRequired ||
      permanentDeleteAfterDays !== originalConfigRef.current.permanentDeleteAfterDays;
    
    if (!hasChanges) return; // Keine Änderungen

    // Clear existing timer
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    // Set new timer
    autoSaveTimerRef.current = setTimeout(() => {
      handleSaveSettings(true);
    }, 2500); // 2.5 Sekunden Debounce

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchInterval, openaiApiKey, openaiModel, elevenlabsApiKey, elevenlabsVoiceId, elevenlabsEnabled, themeRequired, permanentDeleteAfterDays]);

  // Cleanup bei Unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }
    };
  }, []);

  const handleSaveSettings = useCallback(async (isAutoSave = false) => {
    if (!isAutoSave) {
      setSavingSettings(true);
    } else {
      setAutoSaveStatus('saving');
    }
    if (onError) {
      onError('');
    }

    try {
      // WICHTIG: Verwende Ref für State-Werte, um sicherzustellen, dass wir immer die aktuellsten Werte haben
      // Der useCallback kann veraltete State-Werte aus dem Closure haben
      const currentOpenaiApiKey = openaiApiKeyRef.current ?? openaiApiKey;
      const currentElevenlabsApiKey = elevenlabsApiKeyRef.current ?? elevenlabsApiKey;
      const currentElevenlabsVoiceId = elevenlabsVoiceIdRef.current ?? elevenlabsVoiceId;
      const currentElevenlabsEnabled = elevenlabsEnabledRef.current ?? elevenlabsEnabled;
      const currentThemeRequired = themeRequiredRef.current ?? themeRequired;
      
      const requestBody = {
        fetchIntervalMinutes: fetchInterval,
        openaiApiKey: currentOpenaiApiKey && currentOpenaiApiKey.trim() ? currentOpenaiApiKey.trim() : null,
        openaiModel: openaiModel,
        elevenlabsApiKey: currentElevenlabsApiKey && currentElevenlabsApiKey.trim() ? currentElevenlabsApiKey.trim() : null,
        elevenlabsVoiceId: currentElevenlabsVoiceId && currentElevenlabsVoiceId.trim() ? currentElevenlabsVoiceId.trim() : null,
        elevenlabsEnabled: currentElevenlabsEnabled,
        themeRequired: currentThemeRequired,
        permanentDeleteAfterDays: Math.max(0, Math.floor(Number(permanentDeleteAfterDays)) || 0),
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
        if (isAutoSave) {
          setAutoSaveStatus('idle');
        }
        return;
      }

      // Erfolgsmeldung nur bei manuellem Speichern
      if (!isAutoSave) {
        toast.showSuccess('Einstellungen erfolgreich gespeichert!');
      } else {
        setAutoSaveStatus('saved');
        setTimeout(() => setAutoSaveStatus('idle'), 2000);
      }
      
      originalFetchIntervalRef.current = fetchInterval;
      
      // Update original config ref mit Werten aus der Response
      // WICHTIG: Nur State aktualisieren, wenn der Response-Wert nicht null ist
      // oder wenn der aktuelle State leer ist (um gelöschte Keys zu entfernen)
      if (data.settings) {
        // OpenAI API Key: Nur aktualisieren, wenn Response einen Wert hat (nicht null)
        if (data.settings.openaiApiKey !== undefined) {
          if (data.settings.openaiApiKey !== null) {
            // Response hat einen Key - aktualisiere State und Ref
            originalConfigRef.current.openaiApiKey = data.settings.openaiApiKey;
            setOpenaiApiKey(data.settings.openaiApiKey);
          } else if (openaiApiKey === '') {
            // Response ist null UND aktueller State ist leer - aktualisiere Ref, aber nicht State
            originalConfigRef.current.openaiApiKey = '';
          }
          // Wenn Response null ist, aber State einen Wert hat, State NICHT überschreiben
          // (User hat gerade einen Key eingegeben, der noch nicht gespeichert wurde)
        }
        
        if (data.settings.openaiModel !== undefined) {
          originalConfigRef.current.openaiModel = data.settings.openaiModel;
          setOpenaiModel(data.settings.openaiModel);
        }
        
        // ElevenLabs API Key: Gleiche Logik wie OpenAI
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
      if (isAutoSave) {
        setAutoSaveStatus('idle');
      }
    } finally {
      if (!isAutoSave) {
        setSavingSettings(false);
      }
    }
  }, [fetchInterval, router, toast, onError, onHasUnsavedChanges]);

  // Keyboard Shortcut: Ctrl+S / Cmd+S
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's' && !savingSettings) {
        e.preventDefault();
        handleSaveSettings(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [savingSettings, handleSaveSettings]);

  const handleImportSettings = useCallback(async (data: any) => {
    if (data.fetchInterval) {
      setFetchInterval(data.fetchInterval);
      originalFetchIntervalRef.current = data.fetchInterval;
    }
    if (data.emailFilters && onEmailFiltersChange) {
      onEmailFiltersChange(data.emailFilters);
    }
    if (data.cardOrder && onCardOrderChange) {
      onCardOrderChange(data.cardOrder);
    }
    
    // Warte auf beide Speicher-Operationen
    await handleSaveSettings(false);
    if (data.emailFilters && onSaveFilters) {
      try {
        await onSaveFilters();
      } catch (error) {
        if (onError) {
          onError('Fehler beim Speichern der Filter');
        }
        console.error('Error saving filters:', error);
      }
    }
  }, [onEmailFiltersChange, onCardOrderChange, onSaveFilters, handleSaveSettings, onError]);

  return (
    <>
      <GeneralSettings
        fetchInterval={fetchInterval}
        onFetchIntervalChange={setFetchInterval}
        onSave={() => handleSaveSettings(false)}
        saving={savingSettings}
        autoSaveStatus={autoSaveStatus}
      />
      <div style={{ marginTop: '1.5rem' }}>
        <SettingsExportImport
          fetchInterval={fetchInterval}
          emailFilters={emailFilters}
          cardOrder={cardOrder}
          onImport={handleImportSettings}
        />
      </div>
      
      {/* OpenAI-Konfiguration */}
      <div style={{ marginTop: '1.5rem' }}>
        <Card>
          <h2 className="text-xl font-semibold mb-6">OpenAI-Konfiguration</h2>
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">
              API-Key:
            </label>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <input
                type={showOpenaiKey ? 'text' : 'password'}
                value={openaiApiKey}
                onChange={(e) => {
                  const newValue = e.target.value;
                  setOpenaiApiKey(newValue);
                  openaiApiKeyRef.current = newValue; // Aktualisiere Ref sofort
                }}
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
              Dieser API-Key wird für alle ChatGPT-Funktionen verwendet (z.B. E-Mail-Zusammenfassung)
            </small>
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">
              Modell:
            </label>
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
        </Card>
      </div>
      
      {/* ElevenLabs-Konfiguration */}
      <div style={{ marginTop: '1.5rem' }}>
        <Card>
          <h2 className="text-xl font-semibold mb-6">ElevenLabs-Konfiguration (Text-to-Speech)</h2>
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">
              ElevenLabs aktivieren:
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={() => {
                  const newValue = !elevenlabsEnabled;
                  setElevenlabsEnabled(newValue);
                  elevenlabsEnabledRef.current = newValue; // Aktualisiere Ref sofort
                }}
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
              Aktivieren Sie ElevenLabs, um bessere Text-to-Speech-Stimmen zu verwenden. Wenn deaktiviert, wird die Browser-native Speech API verwendet.
            </small>
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">
              API-Key (optional):
            </label>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <input
                type={showElevenlabsKey ? 'text' : 'password'}
                value={elevenlabsApiKey}
                onChange={(e) => {
                  const newValue = e.target.value;
                  setElevenlabsApiKey(newValue);
                  elevenlabsApiKeyRef.current = newValue; // Aktualisiere Ref sofort
                }}
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
              Optional: Für bessere Text-to-Speech-Stimmen. Wenn nicht gesetzt, wird die Browser-native Speech API verwendet.
            </small>
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">
              Voice-ID (optional):
            </label>
            <input
              type="text"
              value={elevenlabsVoiceId}
              onChange={(e) => {
                const newValue = e.target.value;
                setElevenlabsVoiceId(newValue);
                elevenlabsVoiceIdRef.current = newValue; // Aktualisiere Ref sofort
              }}
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
          
          {/* Themenzuweisung Pflicht-Einstellung */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={themeRequired}
                onChange={(e) => setThemeRequired(e.target.checked)}
                style={{ width: '1rem', height: '1rem', cursor: 'pointer' }}
              />
              <span style={{ fontWeight: '600', color: '#333', fontSize: '0.9rem' }}>
                Themenzuweisung ist Pflicht
              </span>
            </label>
            <small className="block mt-1 text-sm text-gray-500">
              Wenn aktiviert, muss bei E-Mails und Telefonnotizen ein Thema ausgewählt werden.
            </small>
          </div>

          {/* Gelöschte E-Mails endgültig löschen nach X Tagen */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: '#333', fontSize: '0.9rem' }}>
              Gelöschte E-Mails endgültig löschen nach (Tage)
            </label>
            <input
              type="number"
              min={0}
              max={36500}
              value={permanentDeleteAfterDays}
              onChange={(e) => setPermanentDeleteAfterDays(Math.max(0, Math.floor(Number(e.target.value)) || 0))}
              style={{ width: '120px', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '0.9rem' }}
            />
            <small className="block mt-1 text-sm text-gray-500">
              0 = nie (gelöscht markierte E-Mails bleiben dauerhaft im Papierkorb). Ein Cron-Job löscht E-Mails, die länger als die angegebene Anzahl Tage als gelöscht markiert sind.
            </small>
          </div>
          
          <div className="flex items-center gap-4">
            <Button
              onClick={async () => {
                // Test ElevenLabs TTS
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
    </>
  );
}

