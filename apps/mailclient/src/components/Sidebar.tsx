'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { FiSettings, FiSearch, FiInbox, FiLogOut } from 'react-icons/fi';
import { FilterIcon } from '@/components/FilterIcon';
import { applyFilterRules } from '@/utils/filterEmails';
import Button from './Button';

interface SidebarItem {
  label: string;
  icon: string | React.ReactNode;
  href: string;
  count?: number;
}

interface FilterRule {
  field: 'from' | 'to' | 'subject' | 'body' | 'status' | 'theme' | 'department' | 'completedStatus' | 'type' | 'phone_number' | 'hasNotes' | 'hasAttachments';
  operator: 'contains' | 'equals' | 'startsWith' | 'endsWith' | 'is';
  value: string;
}

interface EmailFilter {
  id: string;
  name: string;
  icon: string;
  rules?: FilterRule[];
  showCount?: boolean;
}

interface SidebarProps {
}

export default function Sidebar({}: SidebarProps = {}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [user, setUser] = useState<string | null>(null);
  const [emailFilters, setEmailFilters] = useState<EmailFilter[]>([]);
  const [emailCounts, setEmailCounts] = useState<Record<string, number>>({});
  const [_userDepartments, setUserDepartments] = useState<string[]>([]);
  const [isLoadingCounts, setIsLoadingCounts] = useState(false);
  
  // Aktueller customFilter aus URL-Parametern
  const customFilterId = searchParams.get('customFilter');

  // Zahl-Formatierung für große Zahlen
  const formatCount = (count: number): string => {
    if (count < 1000) return count.toString();
    if (count < 1000000) return `${(count / 1000).toFixed(1)}k`;
    return `${(count / 1000000).toFixed(1)}M`;
  };

  // Mutex für Race Condition Prevention
  const isCalculatingRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // In-Memory-Cache für API-Responses (5 Sekunden TTL)
  const emailCountsCacheRef = useRef<{
    data: Record<string, number>;
    timestamp: number;
  } | null>(null);
  const CACHE_TTL_MS = 5000; // 5 Sekunden

  useEffect(() => {
    const userData = localStorage.getItem('mailclient_user');
    if (userData) {
      try {
        const parsed = JSON.parse(userData);
        setUser(parsed.username || parsed.email || 'Benutzer');
      } catch {
        setUser('Benutzer');
      }
    }
  }, []);

  useEffect(() => {
    const loadFilters = async () => {
      try {
        const token = localStorage.getItem('mailclient_token');
        if (!token) return;

        const response = await fetch('/api/settings', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          if (data.settings?.emailFilters) {
            // Stelle sicher, dass showCount korrekt gesetzt ist
            const loadedFilters = data.settings.emailFilters.map((f: any) => ({
              ...f,
              showCount: f.showCount === true ? true : false,
            }));
            setEmailFilters(loadedFilters);
          }
        }
      } catch (err) {
        console.error('Fehler beim Laden der Filter:', err);
      }
    };

    loadFilters();

    // Lade Filter neu, wenn von Einstellungen zurückgekehrt wird
    const handleFocus = () => {
      loadFilters();
    };
    
    // Lade Filter neu, wenn Filter aktualisiert wurden
    const handleFiltersUpdated = () => {
      loadFilters();
    };
    
    window.addEventListener('focus', handleFocus);
    window.addEventListener('filtersUpdated', handleFiltersUpdated);
    
    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('filtersUpdated', handleFiltersUpdated);
    };
  }, []);

  // Lade User-Abteilungen
  useEffect(() => {
    const loadUserDepartments = async () => {
      try {
        const token = localStorage.getItem('mailclient_token');
        if (!token) return;

        const response = await fetch('/api/users/me/departments', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          if (data.departments) {
            const deptIds = data.departments.map((d: { id?: string | number } | string) => 
              String(typeof d === 'object' && d !== null ? (d.id || d) : d)
            );
            setUserDepartments(deptIds);
          }
        }
      } catch (err) {
        if (process.env.NODE_ENV === 'development') {
          console.error('Fehler beim Laden der User-Abteilungen:', err);
        }
      }
    };

    loadUserDepartments();

    // Lade User-Abteilungen neu, wenn Filter aktualisiert wurden
    const handleFiltersUpdated = () => {
      loadUserDepartments();
    };
    
    window.addEventListener('filtersUpdated', handleFiltersUpdated);
    
    return () => {
      window.removeEventListener('filtersUpdated', handleFiltersUpdated);
    };
  }, []);

  // Wiederverwendbare Funktion mit Race Condition Protection und Optimierungen
  const calculateEmailCounts = useCallback(async () => {
    // Mutex: Verhindere parallele Ausführung
    if (isCalculatingRef.current) return;
    isCalculatingRef.current = true;
    setIsLoadingCounts(true);

    // Abort vorherige Requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const filtersWithCount = emailFilters.filter(f => f.showCount === true);
      if (filtersWithCount.length === 0) {
        setEmailCounts({});
        return;
      }

      // Cache-Check: Verwende gecachte Daten wenn verfügbar und noch gültig
      const now = Date.now();
      if (emailCountsCacheRef.current && 
          (now - emailCountsCacheRef.current.timestamp) < CACHE_TTL_MS) {
        setEmailCounts(emailCountsCacheRef.current.data);
        isCalculatingRef.current = false;
        return;
      }

      const token = localStorage.getItem('mailclient_token');
      if (!token) {
        setIsLoadingCounts(false);
        isCalculatingRef.current = false;
        return;
      }

      // Pre-compute: hasDeletedFilter für alle Filter einmalig (mit Länge-Limit für Sicherheit)
      const filterDeletedMap = new Map<string, boolean>();
      filtersWithCount.forEach(filter => {
        if (!filter.id) return;
        const hasDeleted = filter.rules?.some((r: any) => {
          if (r.field === 'status' && r.value) {
            try {
              // Sicherheit: Länge-Limit für JSON.parse
              if (r.value.length > 10000) {
                if (process.env.NODE_ENV === 'development') {
                  console.warn('Filter-Wert zu lang, überspringe JSON.parse');
                }
                return r.value?.toLowerCase() === 'gelöscht';
              }
              const statuses = JSON.parse(r.value);
              return Array.isArray(statuses) && statuses.some((s: string) => s.toLowerCase() === 'gelöscht');
            } catch {
              return r.value?.toLowerCase() === 'gelöscht';
            }
          }
          return false;
        });
        filterDeletedMap.set(filter.id, hasDeleted || false);
      });

      // Immer alle E-Mails (inkl. gelöschte) für die Zählung laden, damit alle User dieselbe
      // Badge-Anzahl sehen; gelöschte werden pro Filter per hasDeletedFilter ein-/ausgeblendet.
      const params = new URLSearchParams();
      params.append('showDeleted', 'true');
      params.append('limit', '200'); // Lade bis zu 200 E-Mails für korrekte Zählung (API-Maximum)
      const queryString = params.toString();
      const url = `/api/emails?${queryString}`;

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        signal: abortController.signal,
      });

      // Fehlerbehandlung mit spezifischen Status-Codes
      if (!response.ok) {
        if (response.status === 401) {
          localStorage.removeItem('mailclient_token');
          router.push('/login');
          isCalculatingRef.current = false;
          return;
        }
        // Behalte alte Counts bei anderen Fehlern
        isCalculatingRef.current = false;
        return;
      }

      const data = await response.json();
      
      // Validierung der API-Response (defensive Programming)
      interface ApiEmail {
        id: string;
        subject?: string;
        from_email?: string;
        from?: string;
        to_email?: string | string[];
        body?: string;
        created_at?: string;
        date?: string;
        read_at?: string | null;
        completed_at?: string | null;
        deleted_at?: string | null;
        spam_at?: string | null;
        important_at?: string | null;
        theme_id?: string | null;
        theme_id_full?: string;
        theme_name?: string;
        theme_color?: string | null;
        from_departments?: string[];
        to_departments?: string[];
        assigned_departments?: Array<{ id: string; name: string } | string>;
        department_id?: string | null;
        department?: { id: string; name: string };
        type?: 'email' | 'phone_note';
        phone_number?: string;
      }

      interface EmailMapped {
        id: string;
        subject: string;
        from: string;
        to: string[];
        body: string;
        date: string;
        read: boolean;
        completed: boolean;
        deleted: boolean;
        spam: boolean;
        important: boolean;
        themeId: string | null;
        theme: { id: string; name: string; color: string | null } | null;
        fromDepartments: string[];
        toDepartments: string[];
        assignedDepartments: Array<{ id: string; name: string }>;
        departmentId: string | null;
        department: { id: string; name: string } | null;
        type: 'email' | 'phone_note';
        phoneNumber?: string;
      }

      let allEmails: ApiEmail[] = [];
      if (data && typeof data === 'object') {
        if (Array.isArray(data.emails)) {
          allEmails = data.emails;
        } else if (Array.isArray(data)) {
          allEmails = data;
        }
      }
      
      // Sicherheitsprüfung: Begrenze Array-Größe (falls mehr als 200 E-Mails zurückgegeben werden)
      if (allEmails.length > 200) {
        if (process.env.NODE_ENV === 'development') {
          console.warn(`Zu viele E-Mails erhalten (${allEmails.length}), begrenze auf 200 für Performance`);
        }
        allEmails = allEmails.slice(0, 200);
      }

      // Pre-process: User-Daten einmalig laden
      const userData = localStorage.getItem('mailclient_user');
      const userEmail = userData ? JSON.parse(userData)?.email || '' : '';

      // Pre-filter: Gelöschte E-Mails einmalig filtern
      const nonDeletedEmails = allEmails.filter((e: ApiEmail) => !e.deleted_at);

      // Mapping für E-Mail-Objekte
      const mapEmail = (e: ApiEmail): EmailMapped => ({
        id: e.id,
        subject: e.subject || '(Kein Betreff)',
        from: (e.type === 'phone_note' ? (e.phone_number || e.from_email || e.from) : (e.from_email || e.from)) ?? '',
        to: Array.isArray(e.to_email) ? e.to_email : (e.to_email ? [e.to_email] : []),
        body: e.body || '',
        date: e.created_at || e.date || '',
        read: e.read_at !== null && e.read_at !== undefined,
        completed: e.completed_at !== null && e.completed_at !== undefined,
        deleted: !!e.deleted_at,
        spam: !!e.spam_at,
        important: !!e.important_at,
        themeId: e.theme_id || null,
        theme: e.theme_id_full ? {
          id: e.theme_id_full,
          name: e.theme_name || 'Unbekannt',
          color: e.theme_color || null,
        } : null,
        fromDepartments: e.from_departments || [],
        toDepartments: e.to_departments || [],
        assignedDepartments: (e.assigned_departments || []).map((d) => (typeof d === 'string' ? { id: d, name: d } : d)),
        departmentId: e.department_id || null,
        department: e.department ? {
          id: e.department.id || e.department_id || '',
          name: e.department.name || 'Unbekannt',
        } : null,
        type: e.type || 'email',
        phoneNumber: e.phone_number || undefined,
      });

      const allEmailsMapped = allEmails.map(mapEmail);
      const nonDeletedEmailsMapped = nonDeletedEmails.map(mapEmail);

      // Batch-Verarbeitung aller Filter
      const counts: Record<string, number> = {};
      const unreadCounts: Record<string, number> = {}; // Für hasUnread

      for (const filter of filtersWithCount) {
        // Validierung: filter.id muss existieren
        if (!filter.id) {
          if (process.env.NODE_ENV === 'development') {
            console.warn('Filter ohne ID gefunden, überspringe');
          }
          continue;
        }
        
        if (!filter.rules || filter.rules.length === 0) {
          counts[filter.id] = 0;
          unreadCounts[filter.id] = 0;
          continue;
        }

        try {
          const hasDeletedFilter = filterDeletedMap.get(filter.id) || false;
          const emailsForFilter = hasDeletedFilter ? allEmailsMapped : nonDeletedEmailsMapped;

          // Wende Filterregeln an
          const filteredEmails = applyFilterRules(emailsForFilter, filter.rules, userEmail, true);
          counts[filter.id] = filteredEmails.length;
          
          // Berechne unreadCount für hasUnread (wird als `emailCounts[${filter.id}_unread]` gespeichert)
          unreadCounts[filter.id] = filteredEmails.filter((e) => !e.read).length;
        } catch (err) {
          if (process.env.NODE_ENV === 'development') {
            console.error(`Fehler beim Berechnen für Filter ${filter.id}:`, err);
          }
          counts[filter.id] = 0;
          unreadCounts[filter.id] = 0;
        }
      }

      // Nur updaten wenn sich etwas geändert hat
      // Speichere unreadCounts mit _unread Suffix für hasUnread-Berechnung im Render
      const countsWithUnread: Record<string, number> = { ...counts };
      Object.keys(unreadCounts).forEach(filterId => {
        countsWithUnread[`${filterId}_unread`] = unreadCounts[filterId];
      });
      
      // Cache aktualisieren
      emailCountsCacheRef.current = {
        data: countsWithUnread,
        timestamp: Date.now()
      };
      
      setEmailCounts(prev => {
        const hasChanged = Object.keys(countsWithUnread).some(
          key => prev[key] !== countsWithUnread[key]
        );
        return hasChanged ? countsWithUnread : prev;
      });
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== 'AbortError') {
        // Behalte alte Counts bei Fehlern
        if (process.env.NODE_ENV === 'development') {
          console.error('Fehler beim Berechnen:', err);
        }
      }
    } finally {
      setIsLoadingCounts(false);
      isCalculatingRef.current = false;
    }
  }, [emailFilters, router]);

  // Debounced Event-Handler (selbst implementiert)
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const debouncedCalculateEmailCounts = useMemo(() => ({
    call: () => {
      if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);
      debounceTimeoutRef.current = setTimeout(() => {
        calculateEmailCounts();
        debounceTimeoutRef.current = null;
      }, 500);
    },
    cancel: () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
        debounceTimeoutRef.current = null;
      }
    }
  }), [calculateEmailCounts]);

  // useEffect für initial load + polling + events (konsolidiert)
  useEffect(() => {
    calculateEmailCounts();
    
    // Polling-Intervall: 30 Sekunden (könnte später aus Settings gelesen werden)
    const interval = setInterval(calculateEmailCounts, 30000); // 30 Sekunden
    
    const handleEmailsFetched = () => {
      debouncedCalculateEmailCounts.call();
    };
    
    const handleFocus = () => {
      calculateEmailCounts();
    };
    
    window.addEventListener('emailsFetched', handleEmailsFetched);
    window.addEventListener('focus', handleFocus);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('emailsFetched', handleEmailsFetched);
      window.removeEventListener('focus', handleFocus);
      abortControllerRef.current?.abort();
      debouncedCalculateEmailCounts.cancel();
    };
  }, [calculateEmailCounts, debouncedCalculateEmailCounts]);

  const menuItems: SidebarItem[] = [
    { label: 'Einstellungen', icon: <FiSettings size={20} />, href: '/emails/settings' },
  ];

  const handleLogout = () => {
    localStorage.removeItem('mailclient_token');
    localStorage.removeItem('mailclient_user');
    router.push('/login');
  };

  const sidebarClasses = 'w-[280px] h-screen fixed left-0 top-0 overflow-y-auto z-[100] flex flex-col bg-[#F9FAFB] border-r border-[#E5E7EB]';

  const sidebarItemClasses = (isActive: boolean) => {
    return `flex items-center gap-3 px-5 py-3 cursor-pointer transition-colors text-[15px] ${
      isActive
        ? 'bg-[#F3F4F6] font-bold text-[#2563EB]'
        : 'text-[#1F2937] hover:bg-[#F3F4F6]'
    }`;
  };

  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchOptions, setShowSearchOptions] = useState(false);
  const [localSearchFields, setLocalSearchFields] = useState<string[]>(['subject', 'from', 'body']);
  const searchOptionsRef = useRef<HTMLDivElement>(null);
  const searchButtonRef = useRef<HTMLButtonElement>(null);

  // Lade Suchfelder aus localStorage oder verwende Standard
  useEffect(() => {
    const loadSearchFields = async () => {
      try {
        const token = localStorage.getItem('mailclient_token');
        if (!token) return;

        const response = await fetch('/api/settings', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          if (data.settings?.searchFields && Array.isArray(data.settings.searchFields) && data.settings.searchFields.length > 0) {
            setLocalSearchFields(data.settings.searchFields);
          }
        }
      } catch (err) {
        console.error('Fehler beim Laden der Suchfelder:', err);
      }
    };

    loadSearchFields();
  }, []);

  // Schließe Dropdown beim Klicken außerhalb
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        searchOptionsRef.current &&
        searchButtonRef.current &&
        !searchOptionsRef.current.contains(event.target as Node) &&
        !searchButtonRef.current.contains(event.target as Node)
      ) {
        setShowSearchOptions(false);
      }
    };

    if (showSearchOptions) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showSearchOptions]);

  const availableSearchFields: { id: string; label: string }[] = [
    { id: 'subject', label: 'Betreff' },
    { id: 'from', label: 'Absender' },
    { id: 'to', label: 'Empfänger' },
    { id: 'body', label: 'Inhalt' },
    { id: 'phone', label: 'Telefonnummer' },
  ];

  const handleFieldToggle = async (fieldId: string) => {
    const newFields = localSearchFields.includes(fieldId)
      ? localSearchFields.filter(f => f !== fieldId)
      : [...localSearchFields, fieldId];
    
    setLocalSearchFields(newFields);
    
    // Speichere in der Datenbank
    try {
      const token = localStorage.getItem('mailclient_token');
      if (!token) return;

      await fetch('/api/settings', {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          searchFields: newFields,
        }),
      });

      // Dispatch Event, um EmailList zu benachrichtigen
      window.dispatchEvent(new CustomEvent('searchFieldsChanged', { detail: { fields: newFields } }));
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Fehler beim Speichern der Suchfelder:', err);
      }
    }
  };

  // Event-Listener für Suche-Änderungen
  useEffect(() => {
    const handleSearchChange = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail?.query !== undefined) {
        setSearchQuery(customEvent.detail.query);
      }
    };

    window.addEventListener('searchQueryChanged', handleSearchChange);
    return () => {
      window.removeEventListener('searchQueryChanged', handleSearchChange);
    };
  }, []);

  return (
    <div className={sidebarClasses}>
      {/* Logo Section */}
      <div className="px-5 py-5 border-b border-[#E5E7EB] flex items-center justify-center">
        <img 
          src="/logo.png" 
          alt="SAIVARO VOICE-MAIL" 
          className="h-16 w-auto"
          style={{ maxWidth: '100%', objectFit: 'contain' }}
        />
      </div>

      {/* Search Section */}
      <div className="px-5 py-4 border-b border-[#E5E7EB]">
        <div className="relative flex items-center gap-2">
          <div className="relative flex-1">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-base text-[#6B7280] pointer-events-none">
              <FiSearch size={16} />
            </span>
            <input
              type="text"
              placeholder="Suche..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                // Dispatch Event für EmailList
                window.dispatchEvent(new CustomEvent('searchQueryChanged', { detail: { query: e.target.value } }));
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  // Dispatch Event für EmailList
                  window.dispatchEvent(new CustomEvent('searchQueryChanged', { detail: { query: searchQuery } }));
                }
              }}
              className="w-full pl-10 pr-3 py-2.5 border border-[#E5E7EB] rounded-[10px] text-sm bg-white box-border transition-all focus:outline-none focus:border-[#2563EB] focus:shadow-[0_0_0_3px_rgba(37,99,235,0.1)]"
            />
          </div>
          <div className="relative flex-shrink-0">
            <button
              ref={searchButtonRef}
              onClick={() => setShowSearchOptions(!showSearchOptions)}
              className="p-2.5 border border-[#E5E7EB] bg-white rounded-[10px] text-base text-[#6B7280] hover:bg-[#F3F4F6] transition-colors cursor-pointer flex items-center justify-center"
              title="Suchoptionen"
            >
              <FiSettings size={16} />
            </button>

            {/* Dropdown für Suchoptionen */}
            {showSearchOptions && (
              <div
                ref={searchOptionsRef}
                className="absolute right-0 top-full mt-1 bg-white min-w-[200px] shadow-[0px_8px_16px_rgba(0,0,0,0.1)] rounded-lg z-10 border border-[#E5E7EB]"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-3 font-semibold text-sm text-[#1F2937] border-b border-[#E5E7EB]">
                  Durchsuchbare Felder:
                </div>
                <div className="p-2 flex flex-col gap-2">
                  {availableSearchFields.map((field) => (
                    <label
                      key={field.id}
                      className="flex items-center gap-2 cursor-pointer text-sm text-[#1F2937] hover:bg-[#F3F4F6] p-2 rounded transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={localSearchFields.includes(field.id)}
                        onChange={() => handleFieldToggle(field.id)}
                        className="cursor-pointer w-4 h-4"
                      />
                      <span>{field.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Folders Section */}
      <div className="flex-1 overflow-y-auto py-2.5">
      <nav>
        {/* Button "Alle Mails" */}
        <Link
          href="/emails"
          className={sidebarItemClasses(pathname === '/emails' && !customFilterId)}
          scroll={false}
          onClick={(e) => {
            // Wenn bereits aktiv, lade E-Mails neu ohne Navigation
            if (pathname === '/emails' && !customFilterId) {
              e.preventDefault();
              e.stopPropagation();
              window.dispatchEvent(new CustomEvent('reloadEmails', { detail: { filterType: 'all' } }));
            }
          }}
        >
          <div className="w-5 text-center flex items-center justify-center">
            <FiInbox size={20} style={{ color: '#6B7280' }} />
          </div>
          <span className="flex-1">Alle Mails</span>
        </Link>

        {/* Benutzerdefinierte Filter - alle angelegten Filter anzeigen (Abteilungslogik gilt nur beim E-Mail-Filtern, nicht in der Navigation) */}
        {emailFilters.length > 0 ? (
          emailFilters.map((filter) => {
              const filterHref = `/emails?customFilter=${filter.id}`;
              const isActive = pathname === '/emails' && customFilterId === filter.id;
              const shouldShowCount = filter.showCount === true;
              const count = shouldShowCount && emailCounts[filter.id] !== undefined ? emailCounts[filter.id] : null;
              
              // Verwende bereits berechneten unreadCount (korrigierte Logik)
              const unreadCount = emailCounts[`${filter.id}_unread`] || 0;
              const hasUnread = unreadCount > 0; // KORREKT! Basierend auf tatsächlichen unreadCounts
              
              return (
                <Link
                  key={filter.id}
                  href={filterHref}
                  className={sidebarItemClasses(isActive)}
                  scroll={false}
                  onClick={(e) => {
                    // Wenn bereits aktiv, lade E-Mails neu ohne Navigation
                    if (isActive) {
                      e.preventDefault();
                      e.stopPropagation();
                      window.dispatchEvent(new CustomEvent('reloadEmails', { detail: { filterId: filter.id } }));
                    }
                  }}
                >
                  <div className="w-5 text-center flex items-center justify-center">
                    <FilterIcon icon={filter.icon} size={16} style={{ color: '#6B7280' }} />
                  </div>
                  <span className="flex-1">
                    {filter.name || 'Unbenannter Filter'}
                  </span>
                  {count !== null && count !== undefined && (
                    <span 
                      className={`inline-flex items-center justify-center px-2 py-0.5 rounded-xl text-xs font-bold ml-auto ${
                        hasUnread 
                          ? 'bg-[#DC2626] text-white' 
                          : 'bg-[#FBBF24] text-[#1F2937]'
                      } ${isLoadingCounts ? 'opacity-50' : ''}`}
                      aria-label={`${count} E-Mails in ${filter.name || 'Filter'}${hasUnread ? ', davon ungelesen' : ''}`}
                      role="status"
                      aria-live="polite"
                      title={isLoadingCounts ? 'Wird aktualisiert...' : undefined}
                    >
                      {isLoadingCounts && count === 0 ? (
                        <span className="inline-block w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      ) : (
                        formatCount(count)
                      )}
                    </span>
                  )}
                </Link>
              );
            })
        ) : (
          <div className="p-4 text-center text-gray-600 text-sm">
            <p className="mb-2">Keine Filter vorhanden</p>
            <Link href="/emails/settings">
              <Button variant="secondary" className="text-sm">
                Filter erstellen
              </Button>
            </Link>
          </div>
        )}

        {/* Einstellungen - Immer sichtbar */}
        {menuItems.map((item) => {
          const isActive = pathname === item.href || pathname?.startsWith(item.href.split('?')[0]);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={sidebarItemClasses(isActive)}
              onClick={(e) => {
                e.preventDefault();
                router.push(item.href);
              }}
            >
              <div className="w-5 text-center">{item.icon}</div>
              <span className="flex-1">{item.label}</span>
            </Link>
          );
        })}
      </nav>
      </div>

      {/* User Info Section */}
      <div className="px-5 py-4 border-t border-[#E5E7EB] text-sm text-[#6B7280]">
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 mb-2 text-[#DC2626] hover:underline"
        >
          <FiLogOut size={18} style={{ color: '#DC2626' }} />
          <span>Abmelden</span>
        </button>
        {user && (
          <div className="text-[#1F2937]">
            <strong>Angemeldet als: {user}</strong>
            <div className="text-xs text-[#6B7280] mt-1">Version: 1.0.0</div>
          </div>
        )}
      </div>
    </div>
  );
}

