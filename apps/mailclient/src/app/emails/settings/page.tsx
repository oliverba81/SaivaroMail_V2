'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { useToast } from '@/components/ToastProvider';
import { useConfirm } from '@/components/ConfirmDialog';
import SettingsDashboard from '@/components/SettingsDashboard';
import SettingsAccountsTab from '@/components/settings/SettingsAccountsTab';
import SettingsGeneralTab from '@/components/settings/SettingsGeneralTab';
import SettingsFiltersTab from '@/components/settings/SettingsFiltersTab';
import SettingsThemesTab from '@/components/settings/SettingsThemesTab';
import SettingsAutomationTab from '@/components/settings/SettingsAutomationTab';
import SettingsUsersTab from '@/components/settings/SettingsUsersTab';
import SettingsDepartmentsTab from '@/components/settings/SettingsDepartmentsTab';
import SettingsContactsTab from '@/components/settings/SettingsContactsTab';

interface EmailAccount {
  id: string;
  name: string;
  email: string;
  imap: {
    host?: string;
    port?: number;
    username?: string;
    password?: string;
    ssl?: boolean;
  };
  smtp: {
    host?: string;
    port?: number;
    username?: string;
    password?: string;
    ssl?: boolean;
    tls?: boolean;
  };
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface User {
  id: string;
  username: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role: string;
  status: string;
  lastLoginAt?: string;
  createdAt?: string;
  updatedAt?: string;
  departments?: Array<{ id: string; name: string }>;
  visibleFilterIds?: string[];
}

interface Department {
  id: string;
  name: string;
  description?: string;
  isActive?: boolean;
  managerId?: string;
  emailAccountId?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface EmailFilter {
  id: string;
  name: string;
  rules: any[];
  showCount?: boolean;
}

export interface ContactPhone {
  id?: string;
  label?: string | null;
  number: string;
  sortOrder?: number;
}
export interface ContactEmail {
  id?: string;
  label?: string | null;
  email: string;
  sortOrder?: number;
}
export interface ContactAddress {
  id?: string;
  label?: string | null;
  street?: string | null;
  postalCode?: string | null;
  city?: string | null;
  country?: string | null;
  sortOrder?: number;
}
export interface Contact {
  id: string;
  companyId?: string;
  firstName?: string | null;
  lastName?: string | null;
  companyName?: string | null;
  salutation?: 'du' | 'sie';
  formalTitle?: string | null;
  notes?: string | null;
  birthday?: string | null;
  avatarUrl?: string | null;
  customerNumber?: string | null;
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
  phones: ContactPhone[];
  emails: ContactEmail[];
  addresses: ContactAddress[];
}

type SettingsTab = 'accounts' | 'general' | 'filters' | 'themes' | 'automation' | 'users' | 'departments' | 'contacts';

const TAB_TITLES: Record<SettingsTab, string> = {
  accounts: 'E-Mail Konten',
  general: 'Allgemeine Einstellungen',
  filters: 'Filter',
  themes: 'Themen',
  automation: 'Automatisierung',
  users: 'Benutzer',
  departments: 'Abteilungen',
  contacts: 'Kontakte',
};

const SIDEBAR_WIDTH = '280px';
const FILTER_UPDATE_DELAY_MS = 100;

// Helper-Funktion für localStorage mit Fehlerbehandlung
const getLocalStorageItem = (key: string): string | null => {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return null;
  }
  try {
    return localStorage.getItem(key);
  } catch (err) {
    console.warn('Fehler beim Zugriff auf localStorage:', err);
    return null;
  }
};

const removeLocalStorageItem = (key: string): void => {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return;
  }
  try {
    localStorage.removeItem(key);
  } catch (err) {
    console.warn('Fehler beim Entfernen aus localStorage:', err);
  }
};

// Helper-Funktion für CustomEvent mit Fallback
const dispatchCustomEvent = (eventName: string, detail?: any): void => {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    if (typeof CustomEvent !== 'undefined') {
      window.dispatchEvent(new CustomEvent(eventName, { detail }));
    } else {
      // Fallback für ältere Browser
      const event = document.createEvent('Event');
      event.initEvent(eventName, false, true);
      if (detail) {
        (event as any).detail = detail;
      }
      window.dispatchEvent(event);
    }
  } catch (err) {
    console.warn('Fehler beim Dispatch des Events:', err);
  }
};

const VALID_TABS: SettingsTab[] = ['accounts', 'general', 'filters', 'themes', 'automation', 'users', 'departments', 'contacts'];

export default function SettingsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const { confirm } = useConfirm();
  const [activeTab, setActiveTab] = useState<SettingsTab | null>(null);
  const [showDashboard, setShowDashboard] = useState(true);

  // Tab aus URL lesen (z.B. ?tab=filters für direkte Navigation)
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam && VALID_TABS.includes(tabParam as SettingsTab)) {
      setActiveTab(tabParam as SettingsTab);
      setShowDashboard(false);
    }
  }, [searchParams]);
  const [error, setError] = useState('');

  // Loaded-Flags: vermeidet Doppelladung (leere Arrays sind gültig)
  const [accountsLoaded, setAccountsLoaded] = useState(false);
  const [filtersLoaded, setFiltersLoaded] = useState(false);
  const [usersLoaded, setUsersLoaded] = useState(false);
  const [departmentsLoaded, setDepartmentsLoaded] = useState(false);
  const [contactsLoaded, setContactsLoaded] = useState(false);

  // Tab-spezifische Lade-Anzeige
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [loadingFilters, setLoadingFilters] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingDepartments, setLoadingDepartments] = useState(false);
  const [loadingContacts, setLoadingContacts] = useState(false);

  // Gemeinsamer State für Tab-Daten
  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [emailFilters, setEmailFilters] = useState<EmailFilter[]>([]);
  const [cardOrder, setCardOrder] = useState<string[] | null>(null);
  const [initialSettings, setInitialSettings] = useState<{
    fetchIntervalMinutes?: number;
    openaiApiKey?: string | null;
    openaiModel?: string;
    elevenlabsApiKey?: string | null;
    elevenlabsVoiceId?: string | null;
    elevenlabsEnabled?: boolean;
    themeRequired?: boolean;
    permanentDeleteAfterDays?: number;
    aiProvider?: 'openai' | 'google';
    geminiApiKey?: string | null;
    geminiModel?: string;
  } | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);

  // State für unsaved changes
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // AbortController für Fetch-Requests
  const abortControllerRef = useRef<AbortController | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Lade Accounts für Dashboard-Statistiken
  const loadAccounts = useCallback(async (signal?: AbortSignal) => {
    try {
      const token = getLocalStorageItem('mailclient_token');
      if (!token) {
        router.push('/login');
        return;
      }

      const response = await fetch('/api/email-accounts', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        signal,
      });

      if (signal?.aborted) return;

      if (response.status === 401) {
        removeLocalStorageItem('mailclient_token');
        removeLocalStorageItem('mailclient_user');
        router.push('/login');
        return;
      }

      if (!response.ok) {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const data = await response.json();
          setError(data.error || 'Fehler beim Laden der Konten');
        } else {
          setError('Fehler beim Laden der Konten');
        }
        return;
      }

      const data = await response.json();
      setAccounts(data.accounts || []);
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      setError('Fehler beim Laden der Konten');
    }
  }, [router]);

  // Lade emailFilters
  const loadEmailFilters = useCallback(async (signal?: AbortSignal) => {
    try {
      const token = getLocalStorageItem('mailclient_token');
      if (!token) {
        return;
      }

      const response = await fetch('/api/settings', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        signal,
      });

      if (signal?.aborted) return;

      if (response.status === 401) {
        removeLocalStorageItem('mailclient_token');
        removeLocalStorageItem('mailclient_user');
        router.push('/login');
        return;
      }

      const contentType = response.headers.get('content-type');
      const data = contentType?.includes('application/json')
        ? await response.json().catch(() => ({}))
        : {};

      if (!response.ok) {
        setError(data?.error || 'Fehler beim Laden der Filter');
        return;
      }

      if (data?.settings) {
        // Für Filter-Tab: Company-Filter (alle) verwenden, falls Admin; sonst nur eigene sichtbare
        if (data.settings?.companyEmailFilters != null && Array.isArray(data.settings.companyEmailFilters)) {
          setEmailFilters(data.settings.companyEmailFilters);
        } else if (data.settings?.emailFilters) {
          setEmailFilters(data.settings.emailFilters);
        }
        if (data.settings?.layoutPreferences != null && Array.isArray(data.settings.layoutPreferences?.cardOrder)) {
          setCardOrder(data.settings.layoutPreferences.cardOrder);
        } else if (data.settings?.layoutPreferences != null && data.settings.layoutPreferences?.cardOrder === null) {
          setCardOrder(null);
        }
        // Allgemein-Tab: initialSettings setzen, um redundanten GET /api/settings zu vermeiden
        setInitialSettings({
          fetchIntervalMinutes: data.settings.fetchIntervalMinutes,
          openaiApiKey: data.settings.openaiApiKey ?? null,
          openaiModel: data.settings.openaiModel,
          elevenlabsApiKey: data.settings.elevenlabsApiKey ?? null,
          elevenlabsVoiceId: data.settings.elevenlabsVoiceId ?? null,
          elevenlabsEnabled: data.settings.elevenlabsEnabled,
          themeRequired: data.settings.themeRequired,
          permanentDeleteAfterDays: data.settings.permanentDeleteAfterDays,
          aiProvider: data.settings.aiProvider,
          geminiApiKey: data.settings.geminiApiKey ?? null,
          geminiModel: data.settings.geminiModel,
        });
      } else {
        setError('Ungültige Antwort vom Server');
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      setError('Fehler beim Laden der Filter');
    }
  }, [router]);

  // Lade Users
  const loadUsers = useCallback(async (signal?: AbortSignal) => {
    try {
      const token = getLocalStorageItem('mailclient_token');
      if (!token) {
        return;
      }

      const response = await fetch('/api/users', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        signal,
      });

      if (signal?.aborted) return;

      if (response.status === 401) {
        removeLocalStorageItem('mailclient_token');
        removeLocalStorageItem('mailclient_user');
        router.push('/login');
        return;
      }

      if (response.status === 403) {
        // Nicht-Admin User - setze leeres Array
        setUsers([]);
        return;
      }

      if (!response.ok) {
        return;
      }

      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const data = await response.json();
        setUsers(data.users || []);
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      // Silent fail für Users (kann fehlschlagen wenn kein Admin)
    }
  }, [router]);

  // Lade Departments
  const loadDepartments = useCallback(async (signal?: AbortSignal) => {
    try {
      const token = getLocalStorageItem('mailclient_token');
      if (!token) {
        return;
      }

      const response = await fetch('/api/departments', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        signal,
      });

      if (signal?.aborted) return;

      if (response.status === 401) {
        removeLocalStorageItem('mailclient_token');
        removeLocalStorageItem('mailclient_user');
        router.push('/login');
        return;
      }

      if (!response.ok) {
        return;
      }

      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const data = await response.json();
        setDepartments(data.departments || []);
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      // Silent fail für Departments
    }
  }, [router]);

  // Lade Kontakte
  const loadContacts = useCallback(async (signal?: AbortSignal) => {
    try {
      const token = getLocalStorageItem('mailclient_token');
      if (!token) return;

      const response = await fetch('/api/contacts', {
        headers: { Authorization: `Bearer ${token}` },
        signal,
      });

      if (signal?.aborted) return;

      if (response.status === 401) {
        removeLocalStorageItem('mailclient_token');
        removeLocalStorageItem('mailclient_user');
        router.push('/login');
        return;
      }

      if (!response.ok) return;

      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        const data = await response.json();
        setContacts(data.contacts || []);
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return;
    }
  }, [router]);

  // Token-Check beim Mount
  useEffect(() => {
    const token = getLocalStorageItem('mailclient_token');
    if (!token) {
      router.push('/login');
    }
  }, [router]);

  // Tab-lazy-load: Daten laden wenn Tab gesetzt (Klick oder ?tab=)
  useEffect(() => {
    const token = getLocalStorageItem('mailclient_token');
    if (!token || !activeTab) return;

    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    const signal = abortController.signal;

    const run = async () => {
      if (activeTab === 'accounts' && !accountsLoaded) {
        setLoadingAccounts(true);
        try {
          await loadAccounts(signal);
        } finally {
          if (!signal.aborted) {
            setAccountsLoaded(true);
            setLoadingAccounts(false);
          }
        }
      }
      if ((activeTab === 'general' || activeTab === 'filters') && !filtersLoaded) {
        setLoadingFilters(true);
        try {
          await loadEmailFilters(signal);
        } finally {
          if (!signal.aborted) {
            setFiltersLoaded(true);
            setLoadingFilters(false);
          }
        }
      }
      if (activeTab === 'users') {
        const promises: Promise<void>[] = [];
        if (!filtersLoaded) {
          setLoadingFilters(true);
          promises.push(loadEmailFilters(signal).finally(() => {
            if (!signal.aborted) {
              setFiltersLoaded(true);
              setLoadingFilters(false);
            }
          }));
        }
        if (!usersLoaded) {
          setLoadingUsers(true);
          promises.push(loadUsers(signal).finally(() => {
            if (!signal.aborted) {
              setUsersLoaded(true);
              setLoadingUsers(false);
            }
          }));
        }
        await Promise.all(promises);
      }
      if (activeTab === 'departments' && !departmentsLoaded) {
        setLoadingDepartments(true);
        try {
          await loadDepartments(signal);
        } finally {
          if (!signal.aborted) {
            setDepartmentsLoaded(true);
            setLoadingDepartments(false);
          }
        }
      }
      if (activeTab === 'contacts' && !contactsLoaded) {
        setLoadingContacts(true);
        try {
          await loadContacts(signal);
        } finally {
          if (!signal.aborted) {
            setContactsLoaded(true);
            setLoadingContacts(false);
          }
        }
      }
    };

    run();

    return () => {
      abortController.abort();
    };
  }, [
    activeTab,
    accountsLoaded,
    filtersLoaded,
    usersLoaded,
    departmentsLoaded,
    contactsLoaded,
    loadAccounts,
    loadEmailFilters,
    loadUsers,
    loadDepartments,
    loadContacts,
  ]);

  // Handler für Dashboard-Kategorie-Klick
  const handleCategoryClick = (categoryId: string) => {
    setActiveTab(categoryId as SettingsTab);
    setShowDashboard(false);
  };

  // Handler für Zurück-Button
  const handleBackToDashboard = useCallback(async () => {
    if (hasUnsavedChanges) {
      const ok = await confirm({ message: 'Sie haben ungespeicherte Änderungen. Möchten Sie wirklich zurück zum Dashboard?' });
      if (!ok) return;
    }
    setShowDashboard(true);
    setActiveTab(null);
    setHasUnsavedChanges(false);
  }, [hasUnsavedChanges, confirm]);

  // Callbacks für Dashboard-Updates
  const handleAccountsChange = useCallback((newAccounts: EmailAccount[]) => {
    setAccounts(newAccounts);
  }, []);

  const handleUsersChange = useCallback((newUsers: User[]) => {
    setUsers(newUsers);
  }, []);

  const handleDepartmentsChange = useCallback((newDepartments: Department[]) => {
    setDepartments(newDepartments);
  }, []);

  const handleContactsChange = useCallback((newContacts: Contact[]) => {
    setContacts(newContacts);
  }, []);

  const handleEmailFiltersChange = useCallback((newFilters: EmailFilter[]) => {
    setEmailFilters(newFilters);
  }, []);

  const handleCardOrderChange = useCallback(async (newOrder: string[]) => {
    setCardOrder(newOrder);
    try {
      const token = getLocalStorageItem('mailclient_token');
      if (!token) return;
      const response = await fetch('/api/settings', {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ layoutPreferences: { cardOrder: newOrder } }),
      });
      if (response.status === 401) {
        removeLocalStorageItem('mailclient_token');
        removeLocalStorageItem('mailclient_user');
        router.push('/login');
        return;
      }
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        toast.showError(data.error || 'Karten-Reihenfolge konnte nicht gespeichert werden');
      }
    } catch (err: any) {
      console.error('Fehler beim Speichern der Karten-Reihenfolge:', err);
      toast.showError('Karten-Reihenfolge konnte nicht gespeichert werden');
    }
  }, [router, toast]);

  // Callback für onSaveFilters
  const handleSaveFilters = useCallback(async () => {
    try {
      const token = getLocalStorageItem('mailclient_token');
      if (!token) {
        router.push('/login');
        return;
      }

      const response = await fetch('/api/settings', {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          emailFilters: emailFilters.map(f => ({
            ...f,
            showCount: f.showCount === true,
          })),
        }),
      });

      if (response.status === 401) {
        removeLocalStorageItem('mailclient_token');
        removeLocalStorageItem('mailclient_user');
        router.push('/login');
        return;
      }

      if (!response.ok) {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const data = await response.json();
          throw new Error(data.error || 'Fehler beim Speichern der Filter');
        } else {
          throw new Error('Fehler beim Speichern der Filter');
        }
      }

      await response.json();

      // Lade Filter neu
      await loadEmailFilters();
      
      // Löst ein Event aus, um die Sidebar zu aktualisieren
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        dispatchCustomEvent('filtersUpdated');
      }, FILTER_UPDATE_DELAY_MS);
    } catch (err: any) {
      throw err;
    }
  }, [emailFilters, router, loadEmailFilters]);

  // Cleanup für setTimeout
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // Warnung bei ungespeicherten Änderungen
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = 'Sie haben ungespeicherte Änderungen. Möchten Sie die Seite wirklich verlassen?';
        return e.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // Keyboard Shortcuts
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !showDashboard) {
        e.preventDefault();
        handleBackToDashboard();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        // Suchfeld-Fokus wird später implementiert
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showDashboard, handleBackToDashboard]);

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar />
      <div className="main-content" style={{ flex: 1, marginLeft: SIDEBAR_WIDTH }}>
        <Header />
        <div className="content-area">
          {showDashboard ? (
            <>
              {error && (
                <div className="alert alert-error" style={{ marginBottom: '1rem' }} role="alert" aria-live="polite">
                  {error}
                </div>
              )}

              <SettingsDashboard
                onCategoryClick={handleCategoryClick}
                cardOrder={cardOrder || undefined}
                onCardOrderChange={handleCardOrderChange}
              />
            </>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
                <button
                  onClick={handleBackToDashboard}
                  className="btn btn-secondary"
                  style={{ padding: '0.5rem 1rem' }}
                  aria-label="Zurück zum Dashboard"
                >
                  ← Zurück
                </button>
                <h1 style={{ fontSize: '1.75rem', fontWeight: '600', color: '#333', margin: 0 }}>
                  {activeTab
                    ? activeTab === 'contacts'
                      ? `Kontakte (${contacts.length})`
                      : TAB_TITLES[activeTab]
                    : 'Einstellungen'}
                </h1>
              </div>

              {error && (
                <div className="alert alert-error" style={{ marginBottom: '1rem' }} role="alert" aria-live="polite">
                  {error}
                </div>
              )}

              {/* Tab-Komponenten */}
              {activeTab === 'accounts' && (
                loadingAccounts ? (
                  <div className="flex items-center justify-center py-16">
                    <div className="spinner" style={{ width: '32px', height: '32px' }} />
                  </div>
                ) : (
                  <SettingsAccountsTab
                    onError={setError}
                    onBack={handleBackToDashboard}
                    toast={toast}
                    router={router}
                    accounts={accounts}
                    onAccountsChange={handleAccountsChange}
                  />
                )
              )}

              {activeTab === 'general' && (
                loadingFilters ? (
                  <div className="flex items-center justify-center py-16">
                    <div className="spinner" style={{ width: '32px', height: '32px' }} />
                  </div>
                ) : (
                <SettingsGeneralTab
                  onError={setError}
                  onBack={handleBackToDashboard}
                  toast={toast}
                  router={router}
                  onHasUnsavedChanges={setHasUnsavedChanges}
                  emailFilters={emailFilters}
                  onEmailFiltersChange={handleEmailFiltersChange}
                  cardOrder={cardOrder || undefined}
                  onCardOrderChange={handleCardOrderChange}
                  onSaveFilters={handleSaveFilters}
                  initialSettings={initialSettings ?? undefined}
                />
                )
              )}

              {activeTab === 'filters' && (
                loadingFilters ? (
                  <div className="flex items-center justify-center py-16">
                    <div className="spinner" style={{ width: '32px', height: '32px' }} />
                  </div>
                ) : (
                  <SettingsFiltersTab
                    onError={setError}
                    onBack={handleBackToDashboard}
                    toast={toast}
                    router={router}
                    emailFilters={emailFilters}
                    onFiltersChange={handleEmailFiltersChange}
                  />
                )
              )}

              {activeTab === 'themes' && (
                <SettingsThemesTab
                  onError={setError}
                  onBack={handleBackToDashboard}
                />
              )}

              {activeTab === 'automation' && (
                <SettingsAutomationTab
                  onError={setError}
                  onBack={handleBackToDashboard}
                />
              )}

              {activeTab === 'users' && (
                (loadingFilters || loadingUsers) ? (
                  <div className="flex items-center justify-center py-16">
                    <div className="spinner" style={{ width: '32px', height: '32px' }} />
                  </div>
                ) : (
                  <SettingsUsersTab
                    onError={setError}
                    onBack={handleBackToDashboard}
                    toast={toast}
                    router={router}
                    users={users}
                    onUsersChange={handleUsersChange}
                    companyFilters={emailFilters.map((f) => ({ id: f.id, name: f.name }))}
                  />
                )
              )}

              {activeTab === 'departments' && (
                loadingDepartments ? (
                  <div className="flex items-center justify-center py-16">
                    <div className="spinner" style={{ width: '32px', height: '32px' }} />
                  </div>
                ) : (
                  <SettingsDepartmentsTab
                    onError={setError}
                    onBack={handleBackToDashboard}
                    toast={toast}
                    router={router}
                    departments={departments}
                    onDepartmentsChange={handleDepartmentsChange}
                  />
                )
              )}

              {activeTab === 'contacts' && (
                loadingContacts ? (
                  <div className="flex items-center justify-center py-16">
                    <div className="spinner" style={{ width: '32px', height: '32px' }} />
                  </div>
                ) : (
                  <SettingsContactsTab
                    contacts={contacts}
                    onContactsChange={handleContactsChange}
                    onBack={handleBackToDashboard}
                    toast={toast}
                    router={router}
                    onError={setError}
                  />
                )
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
