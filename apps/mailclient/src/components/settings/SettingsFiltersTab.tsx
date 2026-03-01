'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ToastProvider';
import EmailFilters from '@/components/EmailFilters';

interface SettingsFiltersTabProps {
  onError?: (error: string) => void;
  onBack?: () => void;
  toast?: ReturnType<typeof useToast>;
  router?: ReturnType<typeof useRouter>;
  emailFilters: any[];
  onFiltersChange?: (filters: any[]) => void;
}

export default function SettingsFiltersTab({
  onError,
  onBack: _onBack,
  toast: toastProp,
  router: routerProp,
  emailFilters,
  onFiltersChange,
}: SettingsFiltersTabProps) {
  const router = routerProp || useRouter();
  const toast = toastProp || useToast();
  const [savingFilters, setSavingFilters] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup bei Unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, []);

  // Keyboard Shortcut: Ctrl+S / Cmd+S
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's' && !savingFilters) {
        e.preventDefault();
        handleSaveFilters();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [savingFilters]);

  const handleSaveFilters = async () => {
    setSavingFilters(true);
    if (onError) {
      onError('');
    }

    try {
      const token = localStorage.getItem('mailclient_token');
      const response = await fetch('/api/settings', {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          emailFilters: emailFilters.map(f => ({
            ...f,
            showCount: f.showCount === true ? true : false, // Stelle sicher, dass showCount explizit gesetzt ist
          })),
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
        const errorMsg = data.error || 'Fehler beim Speichern der Filter';
        if (onError) {
          onError(errorMsg);
        }
        return;
      }

      // Löst ein Event aus, um die Sidebar zu aktualisieren
      // Warte kurz, damit die Datenbank-Transaktion abgeschlossen ist
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        window.dispatchEvent(new CustomEvent('filtersUpdated'));
      }, 100);
      
      toast.showSuccess('Filter erfolgreich gespeichert!');
      
      // Aktualisiere Filter über Callback, falls vorhanden
      if (onFiltersChange && data.settings?.emailFilters) {
        onFiltersChange(data.settings.emailFilters);
      }
    } catch (err: any) {
      const errorMsg = 'Fehler beim Speichern der Filter';
      if (onError) {
        onError(errorMsg);
      }
    } finally {
      setSavingFilters(false);
    }
  };

  return (
    <EmailFilters
      filters={emailFilters}
      onFiltersChange={onFiltersChange || (() => {})}
      onSave={handleSaveFilters}
      saving={savingFilters}
    />
  );
}

