'use client';

import { useState, useEffect, useRef, useCallback, useMemo, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { applyFilterRules } from '@/utils/filterEmails';
import { callApiWithRetry } from '@/utils/api-client';
import { safeLocalStorage } from '@/utils/browser-compat';
import { useToast } from '@/components/ToastProvider';
import { useConfirm } from '@/components/ConfirmDialog';
import { shouldEmitAgentIngest } from '@/lib/agent-ingest-guard';
import {
  defaultTableColumns,
  formatDate,
  formatDateForTable,
  formatDateForPreview,
  FILTER_STORAGE_KEY,
  CUSTOM_FILTER_STORAGE_KEY,
  saveFilterToStorage,
  saveCustomFilterToStorage,
} from './useEmailState.utils';

export interface LayoutPreferences {
  listWidth?: number;
  timelineHeight?: number;
  isTimelineCollapsed?: boolean;
  showThreadView?: boolean;
  cardOrder?: string[] | null;
}

export interface Email {
  id: string;
  subject: string;
  from: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  date: string;
  read: boolean;
  deleted?: boolean;
  spam?: boolean;
  important?: boolean;
  completed?: boolean;
  body?: string;
  ticketId?: string;
  isConversationThread?: boolean;
  conversationMessageCount?: number;
  themeId?: string | null;
  theme?: {
    id: string;
    name: string;
    color: string | null;
  } | null;
  departmentId?: string | null;
  department?: {
    id: string;
    name: string;
  } | null;
  fromDepartments?: string[];
  toDepartments?: string[];
  assignedDepartments?: string[];
  hasAttachment?: boolean;
  type?: 'email' | 'phone_note';
  phoneNumber?: string;
  hasNotes?: boolean;
  noteCount?: number;
  lastNotePreview?: {
    content: string;
    userName: string;
    createdAt: string;
  };
  /** Wird die E-Mail gerade von einem anderen User zum Antworten gesperrt? */
  replyLock?: { userId: string; userName: string };
}

const VALID_STANDARD_FILTERS = ['read', 'unread', 'completed', 'not_completed'] as const;
type StandardFilter = 'all' | typeof VALID_STANDARD_FILTERS[number];

function getInitialFilterFromUrlAndStorage(searchParams: URLSearchParams): {
  filter: StandardFilter;
  customFilterId: string | null;
} {
  const filterParam = searchParams.get('filter');
  const customFilter = searchParams.get('customFilter');
  const customFilterTrimmed = customFilter && customFilter.trim() ? customFilter.trim() : null;

  if (filterParam && VALID_STANDARD_FILTERS.includes(filterParam as any)) {
    return { filter: filterParam as StandardFilter, customFilterId: null };
  }
  if (customFilterTrimmed) {
    return { filter: 'all', customFilterId: customFilterTrimmed };
  }
  if (typeof window === 'undefined') {
    return { filter: 'all', customFilterId: null };
  }
  const savedCustomFilter = safeLocalStorage.getItem(CUSTOM_FILTER_STORAGE_KEY);
  const savedCustomFilterTrimmed = savedCustomFilter && savedCustomFilter.trim() ? savedCustomFilter.trim() : null;
  if (savedCustomFilterTrimmed) {
    return { filter: 'all', customFilterId: savedCustomFilterTrimmed };
  }
  const savedFilter = safeLocalStorage.getItem(FILTER_STORAGE_KEY);
  if (savedFilter && savedFilter !== 'all' && VALID_STANDARD_FILTERS.includes(savedFilter as any)) {
    return { filter: savedFilter as StandardFilter, customFilterId: null };
  }
  return { filter: 'all', customFilterId: null };
}

export function useEmailState() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Initialwert nur aus erstem Render (URL/localStorage), damit erster loadEmails den richtigen Filter nutzt
  const initialFilterState = useMemo(
    () => getInitialFilterFromUrlAndStorage(searchParams),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: use only first render URL/localStorage
    []
  );

  // States
  const [emails, setEmails] = useState<Email[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'read' | 'unread' | 'completed' | 'not_completed'>(initialFilterState.filter);
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set());
  const [fetching, setFetching] = useState(false);
  const [fetchMessage, setFetchMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null);
  const [selectedEmailDetails, setSelectedEmailDetails] = useState<Email | null>(null);
  const [loadingEmailDetails, setLoadingEmailDetails] = useState(false);
  const [markingRead, setMarkingRead] = useState(false);
  const [markingCompleted, setMarkingCompleted] = useState(false);
  const [markingSpam, setMarkingSpam] = useState(false);
  const [markingImportant, setMarkingImportant] = useState(false);
  const [emailFilters, setEmailFilters] = useState<any[]>([]);
  const [filterSettingsLoaded, setFilterSettingsLoaded] = useState(false);
  // Progress-Tracking für Bulk-Aktionen
  const [bulkProgress, setBulkProgress] = useState<{
    total: number;
    completed: number;
    failed: number;
  } | null>(null);
  const [customFilterId, setCustomFilterId] = useState<string | null>(initialFilterState.customFilterId);
  const [page, setPage] = useState(0);
  const [limit, setLimit] = useState(100);
  const [totalPages, setTotalPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [hasPrevious, setHasPrevious] = useState(false);
  const [tableColumns, setTableColumns] = useState<any[]>(defaultTableColumns);
  const [searchFields, setSearchFields] = useState<string[]>(['subject', 'from', 'body']);
  const [layoutPreferences, setLayoutPreferences] = useState<LayoutPreferences | undefined>(undefined);
  const [focusNotesOnMount, setFocusNotesOnMount] = useState(false);

  const toast = useToast();
  const { confirm } = useConfirm();

  // Fokus Kommentar-Bereich nach kurzer Verzögerung zurücksetzen (z. B. nach Kontextmenü „Kommentar hinzufügen“)
  useEffect(() => {
    if (focusNotesOnMount) {
      const t = setTimeout(() => setFocusNotesOnMount(false), 1000);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [focusNotesOnMount]);

  // Refs
  const isUpdatingUrlRef = useRef(false);
  const isInitialMountRef = useRef(true);
  const hasInitialLoadRef = useRef(false);
  // LRU Cache mit Größenbegrenzung und TTL
  const MAX_CACHE_SIZE = 50;
  const CACHE_TTL = 5 * 60 * 1000; // 5 Minuten
  const emailDetailsCache = useRef<Map<string, { email: Email; timestamp: number }>>(new Map());
  
  // Helper-Funktionen für Cache-Management
  const getCachedEmail = useCallback((emailId: string): Email | null => {
    const cached = emailDetailsCache.current.get(emailId);
    if (!cached) return null;
    
    // Prüfe TTL
    if (Date.now() - cached.timestamp > CACHE_TTL) {
      emailDetailsCache.current.delete(emailId);
      return null;
    }
    
    return cached.email;
  }, []);
  
  const setCachedEmail = useCallback((emailId: string, email: Email) => {
    // LRU: Entferne ältesten Eintrag wenn Cache voll
    if (emailDetailsCache.current.size >= MAX_CACHE_SIZE) {
      const oldestKey = Array.from(emailDetailsCache.current.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp)[0][0];
      emailDetailsCache.current.delete(oldestKey);
    }
    
    emailDetailsCache.current.set(emailId, { email, timestamp: Date.now() });
  }, []);
  
  const hasCachedEmail = useCallback((emailId: string): boolean => {
    return getCachedEmail(emailId) !== null;
  }, [getCachedEmail]);
  const loadEmailDetailsAbortControllerRef = useRef<AbortController | null>(null);
  const prefetchQueueRef = useRef<Set<string>>(new Set());
  const loadingEmailDetailsRef = useRef<Set<string>>(new Set());
  // Separater Ref für Read-Requests (nicht mit loadingEmailDetailsRef kollidieren)
  const pendingReadRequests = useRef<Map<string, AbortController>>(new Map());
  const performMarkAsReadRef = useRef<(emailId: string, read: boolean, previousState: boolean) => Promise<void>>(null as any);
  // Debouncing für schnelle Status-Änderungen
  const debouncedMarkAsRead = useRef<Map<string, NodeJS.Timeout>>(new Map());
  // Undo/Redo Stack für Status-Änderungen
  const undoStack = useRef<Array<{ emailId: string; previousRead: boolean; timestamp: number }>>([]);
  const MAX_UNDO_STACK_SIZE = 50;
  const loadEmailDetailsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const selectedEmailIdRef = useRef<string | null>(null);
  /** Kürzlich per PATCH gesetzter Lese-Status, damit veraltete GET-Antworten ihn nicht überschreiben (Race bei Filter→Alle Mails). */
  const lastReadUpdateRef = useRef<Map<string, { read: boolean; timestamp: number }>>(new Map());
  /** Ref auf aktuelle loadEmails-Funktion, damit Effects nur bei echten Filter/Such-/Seitenänderungen laufen, nicht bei loadEmails-Identitätswechsel. */
  const loadEmailsRef = useRef<((showLoading?: boolean, pageToLoad?: number) => Promise<void>) | null>(null);
  const LAST_READ_PRIORITY_MS = 8000;
  const LAST_READ_CLEANUP_MS = 15000;

  // Transition für nicht-blockierende Updates
  const [, startTransition] = useTransition();

  // Computed - Memoized für Performance
  const unreadCount = useMemo(() => emails.filter(e => !e.read).length, [emails]);
  
  // Memoized E-Mail-Statistiken
  const emailStats = useMemo(() => {
    return {
      total: emails.length,
      read: emails.filter(e => e.read).length,
      unread: emails.filter(e => !e.read).length,
      completed: emails.filter(e => e.completed).length,
      deleted: emails.filter(e => e.deleted).length,
      spam: emails.filter(e => e.spam).length,
      important: emails.filter(e => e.important).length,
    };
  }, [emails]);

  // Bei Custom-Filter erst laden, wenn Filter-Definitionen da sind (verhindert Flash aller Mails)
  const filterReady = !customFilterId || emailFilters.length > 0;

  // Lade Filter aus Einstellungen
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
            if (shouldEmitAgentIngest()) { fetch('http://127.0.0.1:7242/ingest/6f6d9a88-300b-4056-b028-ab51bf2b9e32',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useEmailState.ts:loadFilters',message:'setEmailFilters called (settings loaded)',data:{filtersLen:data.settings.emailFilters?.length,timestamp:Date.now()},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A,E'})}).catch(()=>{}); }
            setEmailFilters(data.settings.emailFilters);
          }
          if (data.settings?.tableColumns && Array.isArray(data.settings.tableColumns) && data.settings.tableColumns.length > 0) {
            const hasAttachmentColumn = data.settings.tableColumns.some((col: any) => col.id === 'attachment');
            const hasDepartmentColumn = data.settings.tableColumns.some((col: any) => col.id === 'department');
            let columnsToSet = data.settings.tableColumns;
            
            if (!hasAttachmentColumn) {
              columnsToSet = [...columnsToSet, { id: 'attachment', label: 'Anhang', visible: true, order: 1 }];
            }
            if (!hasDepartmentColumn) {
              columnsToSet = [...columnsToSet, { id: 'department', label: 'Abteilung', visible: true, order: 11, width: '150px' }];
            }
            
            if (!hasAttachmentColumn || !hasDepartmentColumn) {
              columnsToSet.sort((a: any, b: any) => a.order - b.order);
            }
            setTableColumns(columnsToSet);
          } else {
            setTableColumns(defaultTableColumns);
          }
          if (data.settings?.searchFields && Array.isArray(data.settings.searchFields) && data.settings.searchFields.length > 0) {
            setSearchFields(data.settings.searchFields);
          }
          if (data.settings?.layoutPreferences != null && typeof data.settings.layoutPreferences === 'object') {
            setLayoutPreferences(data.settings.layoutPreferences as LayoutPreferences);
          }
        }
      } catch (err) {
        console.error('Fehler beim Laden der Filter:', err);
      } finally {
        setFilterSettingsLoaded(true);
      }
    };

    loadFilters();
  }, []);

  // URL-Parameter reaktiv lesen
  useEffect(() => {
    if (isUpdatingUrlRef.current) {
      isUpdatingUrlRef.current = false;
      return;
    }

    const filterParam = searchParams.get('filter');
    const customFilter = searchParams.get('customFilter');
    
    // Wenn URL-Parameter vorhanden, verwende diese (höchste Priorität)
    if (filterParam === 'read' || filterParam === 'unread' || filterParam === 'completed' || filterParam === 'not_completed') {
      setFilter(filterParam);
      // WICHTIG: Setze customFilterId zurück, wenn Standard-Filter aktiv ist
      if (customFilterId !== null) {
        setCustomFilterId(null);
      }
      saveFilterToStorage(filterParam);
      if (isInitialMountRef.current) {
        isInitialMountRef.current = false;
      }
    } else if (customFilter) {
      // Prüfe, ob Custom-Filter noch existiert
      const filterExists = emailFilters.length > 0 && emailFilters.some((f: any) => f.id === customFilter);
      if (filterExists) {
        setCustomFilterId(customFilter);
        setFilter('all');
        saveCustomFilterToStorage(customFilter);
      } else if ((emailFilters.length > 0 || filterSettingsLoaded) && !filterExists) {
        // Filter existiert nicht (Liste geladen oder Settings fertig) → bereinigen, kein Dauer-Loading
        saveCustomFilterToStorage(null);
        setCustomFilterId(null);
        setFilter('all');
        isUpdatingUrlRef.current = true;
        const newParams = new URLSearchParams(window.location.search);
        newParams.delete('customFilter');
        const newUrl = newParams.toString() ? `/emails?${newParams.toString()}` : '/emails';
        router.replace(newUrl, { scroll: false });
      } else {
        // emailFilters noch nicht geladen, warte auf nächsten Durchlauf
        setCustomFilterId(customFilter);
        setFilter('all');
      }
      if (isInitialMountRef.current && emailFilters.length > 0) {
        isInitialMountRef.current = false;
      }
    } else {
      // Keine URL-Parameter: Nur beim ersten Mount aus localStorage laden
      if (isInitialMountRef.current) {
        if (emailFilters.length > 0) {
          // emailFilters sind bereits geladen, lade Filter aus localStorage
          try {
            const savedCustomFilter = safeLocalStorage.getItem(CUSTOM_FILTER_STORAGE_KEY);
            const savedFilter = safeLocalStorage.getItem(FILTER_STORAGE_KEY) as 'all' | 'read' | 'unread' | 'completed' | 'not_completed' | null;
            
            if (savedCustomFilter) {
              // Prüfe, ob gespeicherter Filter noch existiert
              const filterExists = emailFilters.some((f: any) => f.id === savedCustomFilter);
              if (filterExists) {
                setCustomFilterId(savedCustomFilter);
                setFilter('all');
                // Aktualisiere URL
                isUpdatingUrlRef.current = true;
                const newParams = new URLSearchParams();
                newParams.set('customFilter', savedCustomFilter);
                router.replace(`/emails?${newParams.toString()}`, { scroll: false });
              } else {
                // Filter existiert nicht mehr, lösche aus localStorage
                saveCustomFilterToStorage(null);
                setFilter('all');
              }
            } else if (savedFilter && savedFilter !== 'all') {
              setFilter(savedFilter);
              // WICHTIG: Setze customFilterId zurück, wenn Standard-Filter aktiv ist
              if (customFilterId !== null) {
                setCustomFilterId(null);
              }
              // Aktualisiere URL
              isUpdatingUrlRef.current = true;
              const newParams = new URLSearchParams();
              newParams.set('filter', savedFilter);
              router.replace(`/emails?${newParams.toString()}`, { scroll: false });
            } else {
              setFilter('all');
              // WICHTIG: Setze customFilterId zurück, wenn kein Filter aktiv ist
              if (customFilterId !== null) {
                setCustomFilterId(null);
              }
            }
          } catch (err) {
            // localStorage-Fehler, verwende Default
            console.warn('Fehler beim Laden des gespeicherten Filters:', err);
            setFilter('all');
          }
          isInitialMountRef.current = false;
        }
        // Wenn emailFilters noch nicht geladen sind, warte auf nächsten Durchlauf
        // isInitialMountRef.current bleibt true, damit beim nächsten Durchlauf (wenn emailFilters geladen sind) der Filter geladen wird
      } else {
        // Nach dem ersten Mount: Keine URL-Parameter vorhanden
        // Wenn customFilterId noch gesetzt ist, setze es auf null (z.B. wenn auf "Alle Mails" geklickt wurde)
        if (customFilterId !== null) {
          setCustomFilterId(null);
          saveCustomFilterToStorage(null);
        }
        // Setze Filter auf 'all' wenn kein Filter-Parameter vorhanden ist
        if (filterParam === null && customFilter === null) {
          setFilter('all');
        }
      }
    }
  }, [searchParams, emailFilters, router, customFilterId, filterSettingsLoaded]);

  // Persistiere Standard-Filter-Änderungen
  useEffect(() => {
    // Nur speichern, wenn nicht durch URL-Parameter ausgelöst und kein Custom-Filter aktiv
    if (!isUpdatingUrlRef.current && !isInitialMountRef.current && !customFilterId) {
      saveFilterToStorage(filter);
    }
  }, [filter, customFilterId]);

  // Synchronisiere URL mit customFilterId
  useEffect(() => {
    if (isInitialMountRef.current || isUpdatingUrlRef.current) {
      // WICHTIG: isUpdatingUrlRef wird im URL-Parameter-UseEffect zurückgesetzt
      return;
    }

    const currentParams = new URLSearchParams(window.location.search);
    const currentCustomFilter = currentParams.get('customFilter');
    
    if (customFilterId && currentCustomFilter !== customFilterId) {
      isUpdatingUrlRef.current = true;
      const newParams = new URLSearchParams(window.location.search);
      newParams.set('customFilter', customFilterId);
      router.replace(`/emails?${newParams.toString()}`, { scroll: false });
      saveCustomFilterToStorage(customFilterId);
      // isUpdatingUrlRef wird im URL-Parameter-UseEffect zurückgesetzt, wenn searchParams sich ändert
    } else if (!customFilterId && currentCustomFilter) {
      isUpdatingUrlRef.current = true;
      const newParams = new URLSearchParams(window.location.search);
      newParams.delete('customFilter');
      const newUrl = newParams.toString() ? `/emails?${newParams.toString()}` : '/emails';
      router.replace(newUrl, { scroll: false });
      saveCustomFilterToStorage(null);
      // isUpdatingUrlRef wird im URL-Parameter-UseEffect zurückgesetzt, wenn searchParams sich ändert
    }
    // Wenn customFilterId bereits in URL ist, wird es bereits beim URL-Parameter-UseEffect gespeichert
    // Keine doppelte Speicherung nötig
  }, [customFilterId, router]);

  const loadEmails = useCallback(async (showLoading: boolean = true, pageToLoad: number = page) => {
    if (shouldEmitAgentIngest()) { fetch('http://127.0.0.1:7242/ingest/6f6d9a88-300b-4056-b028-ab51bf2b9e32',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useEmailState.ts:loadEmails',message:'loadEmails called',data:{showLoading,pageToLoad,emailFiltersLen:emailFilters.length,timestamp:Date.now()},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A,B,C,D'})}).catch(()=>{}); }
    try {
      if (showLoading) {
        setLoading(true);
      }
      const token = localStorage.getItem('mailclient_token');
      
      if (!token) {
        router.push('/login');
        return;
      }
      
      const params = new URLSearchParams();
      if (searchQuery) {
        params.append('search', searchQuery);
        params.append('searchFields', searchFields.join(','));
      }
      if (filter !== 'all') {
        params.append('filter', filter);
      }
      params.append('page', pageToLoad.toString());
      if (limit !== 100) {
        params.append('limit', limit.toString());
      }
      const shouldShowDeleted = !customFilterId || (customFilterId && emailFilters.length > 0 && 
        emailFilters.find((f: any) => f.id === customFilterId)?.rules?.some((r: any) => {
          if (r.field === 'status' && r.value) {
            try {
              const statuses = JSON.parse(r.value);
              return Array.isArray(statuses) && statuses.some((s: string) => s.toLowerCase() === 'gelöscht');
            } catch {
              return r.value?.toLowerCase() === 'gelöscht';
            }
          }
          return false;
        }));
      if (shouldShowDeleted) {
        params.append('showDeleted', 'true');
      }
      
      const url = `/api/emails${params.toString() ? `?${params.toString()}` : ''}`;
      const response = await fetch(url, {
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

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Fehler beim Laden der E-Mails');
        return;
      }

      if (data.page !== undefined) {
        setPage(data.page);
        setLimit(data.limit || 100);
        setTotalPages(data.totalPages || 0);
        setTotal(data.total || 0);
        setHasNext(data.hasNext || false);
        setHasPrevious(data.hasPrevious || false);
      }

      let transformedEmails = (data.emails || data || []).map((e: any) => ({
        id: e.id,
        subject: e.subject || '(Kein Betreff)',
        from: e.from_email || e.from,
        to: Array.isArray(e.to_email) ? e.to_email : (e.to_email ? [e.to_email] : []),
        body: e.body || '',
        date: e.created_at || e.date,
        read: e.read_at !== null && e.read_at !== undefined,
        completed: e.completed_at !== null && e.completed_at !== undefined,
        deleted: !!e.deleted_at,
        spam: !!e.spam_at,
        important: !!e.important_at,
        hasAttachment: !!e.has_attachment,
        ticketId: e.ticketId || e.ticket_id || undefined,
        isConversationThread: e.isConversationThread || e.is_conversation_thread || false,
        conversationMessageCount: e.conversationMessageCount || e.conversation_message_count || 0,
        themeId: e.theme_id || null,
        theme: (e.theme_id_full || e.theme_name) ? {
          id: e.theme_id_full || e.theme_id || '',
          name: e.theme_name || 'Unbekannt',
          color: e.theme_color || null,
        } : null,
        departmentId: e.department_id || null,
        department: e.department ? {
          id: e.department.id || e.department_id,
          name: e.department.name || e.department_name,
        } : (e.department_id ? { id: e.department_id, name: (e.department_name as string) || 'Unbekannt' } : null),
        fromDepartments: e.from_departments || [],
        toDepartments: e.to_departments || [],
        assignedDepartments: e.assigned_departments || [],
        type: e.type || 'email',
        phoneNumber: e.phoneNumber || e.phone_number || undefined,
        hasNotes: (e.note_count || 0) > 0,
        noteCount: e.note_count ?? 0,
        replyLock: e.replyLock ? { userId: e.replyLock.userId, userName: e.replyLock.userName || 'Unbekannt' } : undefined,
        lastNotePreview:
          e.last_note_content != null
            ? {
                content: e.last_note_content || '',
                userName: e.last_note_user_name || 'Unbekannt',
                createdAt:
                  typeof e.last_note_created_at === 'string'
                    ? e.last_note_created_at
                    : e.last_note_created_at instanceof Date
                      ? e.last_note_created_at.toISOString()
                      : String(e.last_note_created_at || ''),
              }
            : undefined,
      }));

      if (customFilterId && emailFilters.length > 0) {
        const activeFilter = emailFilters.find((f: any) => f.id === customFilterId);
        if (activeFilter && activeFilter.rules) {
          const userData = localStorage.getItem('mailclient_user');
          let userEmail = '';
          if (userData) {
            try {
              const parsed = JSON.parse(userData);
              userEmail = parsed.email || '';
            } catch { /* ignore parse error */ }
          }
          transformedEmails = applyFilterRules(transformedEmails, activeFilter.rules, userEmail);
        }
      }

      const now = Date.now();
      transformedEmails = transformedEmails.map((e: Email) => {
        const entry = lastReadUpdateRef.current.get(e.id);
        if (entry && now - entry.timestamp <= LAST_READ_PRIORITY_MS) {
          return { ...e, read: entry.read };
        }
        return e;
      });
      for (const [id, entry] of Array.from(lastReadUpdateRef.current.entries())) {
        if (now - entry.timestamp > LAST_READ_CLEANUP_MS) lastReadUpdateRef.current.delete(id);
      }
      setEmails(transformedEmails);

      // Verwende Ref für selectedEmailId, um unnötige Re-Erstellung von loadEmails zu vermeiden
      const currentSelectedEmailId = selectedEmailIdRef.current;
      if (currentSelectedEmailId && !transformedEmails.find((e: Email) => e.id === currentSelectedEmailId)) {
        setSelectedEmailId(null);
        setSelectedEmailDetails(null);
        selectedEmailIdRef.current = null;
      }
    } catch (err: any) {
      setError('Fehler beim Laden der E-Mails');
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  }, [searchQuery, filter, customFilterId, emailFilters, searchFields, limit, page, router]);

  loadEmailsRef.current = loadEmails;

  // Event-Listener für Such-Änderungen aus der Sidebar
  useEffect(() => {
    const handleSearchQueryChange = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail?.query !== undefined) {
        const newQuery = customEvent.detail.query;
        setSearchQuery(newQuery);
        if (newQuery.length === 0 || newQuery.length >= 3) {
          setPage(0);
          setTimeout(() => {
            loadEmailsRef.current?.(true, 0);
          }, 0);
        }
      }
    };

    const handleSearchFieldsChange = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail?.fields && Array.isArray(customEvent.detail.fields)) {
        setSearchFields(customEvent.detail.fields);
        if (searchQuery && searchQuery.length >= 3) {
          setPage(0);
          setTimeout(() => {
            loadEmailsRef.current?.(true, 0);
          }, 0);
        }
      }
    };

    window.addEventListener('searchQueryChanged', handleSearchQueryChange);
    window.addEventListener('searchFieldsChanged', handleSearchFieldsChange);

    return () => {
      window.removeEventListener('searchQueryChanged', handleSearchQueryChange);
      window.removeEventListener('searchFieldsChanged', handleSearchFieldsChange);
    };
  }, [searchQuery, searchFields]);

  // Event-Listener für manuelles Neuladen der E-Mails
  useEffect(() => {
    const handleReloadEmails = (event: Event) => {
      if (shouldEmitAgentIngest()) { fetch('http://127.0.0.1:7242/ingest/6f6d9a88-300b-4056-b028-ab51bf2b9e32',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useEmailState.ts:reloadEmails',message:'reloadEmails event received',data:{timestamp:Date.now()},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{}); }
      const customEvent = event as CustomEvent;
      const filterId = customEvent.detail?.filterId;
      const filterType = customEvent.detail?.filterType;
      
      if (filterId && customFilterId !== filterId) {
        return;
      }
      
      if (filterType === 'all' && customFilterId !== null) {
        return;
      }
      
      setPage(0);
      loadEmailsRef.current?.(true, 0);
    };

    window.addEventListener('reloadEmails', handleReloadEmails);

    return () => {
      window.removeEventListener('reloadEmails', handleReloadEmails);
    };
  }, [customFilterId, emailFilters]);

  // Lade E-Mails bei Änderung von Suche/Filter (nur wenn filterReady, sonst kein Flash aller Mails).
  // loadEmails nicht in Deps: sonst würde jeder Seitenwechsel loadEmails neu erzeugen und diesen Effect erneut auslösen → Zurückspringen auf Seite 0.
  useEffect(() => {
    if (shouldEmitAgentIngest()) { fetch('http://127.0.0.1:7242/ingest/6f6d9a88-300b-4056-b028-ab51bf2b9e32',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useEmailState.ts:effect-filter-search',message:'effect filter/search ran',data:{filterReady,emailFiltersLen:emailFilters.length,customFilterId,searchQuery:searchQuery?.slice(0,20)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A,B,E'})}).catch(()=>{}); }
    if (!filterReady) return;
    setPage(0);
    loadEmailsRef.current?.(true, 0);
  }, [searchQuery, filter, customFilterId, emailFilters, searchFields, filterReady]);

  // Lade E-Mails bei Seitenwechsel. loadEmails nicht in Deps, damit der Effect nur bei page-Änderung läuft (nicht bei loadEmails-Identitätswechsel).
  useEffect(() => {
    if (shouldEmitAgentIngest()) { fetch('http://127.0.0.1:7242/ingest/6f6d9a88-300b-4056-b028-ab51bf2b9e32',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useEmailState.ts:effect-page',message:'effect page ran',data:{page,hasInitialLoad:hasInitialLoadRef.current,willLoad:hasInitialLoadRef.current&&page>0},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{}); }
    // Beim ersten Mount: Initiale Ladung wird vom anderen useEffect behandelt
    if (!hasInitialLoadRef.current) {
      hasInitialLoadRef.current = true;
      return;
    }
    
    // Nur bei Seitenwechsel laden (nicht bei emails.length Änderungen)
    // WICHTIG: page > 0 check verhindert, dass beim Mount (page = 0) geladen wird
    if (page > 0) {
      loadEmailsRef.current?.(true, page);
    }
  }, [page]);

  const loadEmailDetails = useCallback(async (emailId: string) => {
    try {
      // Prüfe Cache zuerst (wird bereits in handleEmailClick geprüft, aber hier als Fallback)
      const cached = getCachedEmail(emailId);
      if (cached) {
        // Prüfe, ob die E-Mail noch ausgewählt ist (Race Condition Prevention)
        // WICHTIG: Verwende Ref statt State, da Ref sofort aktualisiert wird
        if (selectedEmailIdRef.current === emailId) {
          setSelectedEmailDetails(cached);
          setLoadingEmailDetails(false);
        }
        return;
      }
      
      // Prüfe, ob die E-Mail noch ausgewählt ist (Race Condition Prevention)
      // WICHTIG: Verwende Ref statt State, da Ref sofort aktualisiert wird
      if (selectedEmailIdRef.current !== emailId) {
        return; // User hat bereits eine andere E-Mail ausgewählt
      }
      
      // Prüfe, ob bereits geladen wird (Request Deduplication)
      if (loadingEmailDetailsRef.current.has(emailId)) {
        return; // Request läuft bereits
      }

      loadingEmailDetailsRef.current.add(emailId);

      // Erstelle AbortController für Request-Cancellation
      const abortController = new AbortController();
      loadEmailDetailsAbortControllerRef.current = abortController;

      // WICHTIG: setLoadingEmailDetails muss VOR dem fetch gesetzt werden
      // (wird bereits in handleEmailClick gesetzt, aber hier als Fallback)
      // WICHTIG: Verwende Ref statt State, da Ref sofort aktualisiert wird
      if (selectedEmailIdRef.current === emailId) {
        setLoadingEmailDetails(true);
      }

      const token = localStorage.getItem('mailclient_token');
      const response = await fetch(`/api/emails/${emailId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        signal: abortController.signal, // Request kann abgebrochen werden
      });
      
      // Prüfe, ob Request abgebrochen wurde (nach fetch, vor response.json)
      if (abortController.signal.aborted) {
        return; // Request wurde abgebrochen
      }

      if (response.status === 401) {
        localStorage.removeItem('mailclient_token');
        localStorage.removeItem('mailclient_user');
        router.push('/login');
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Fehler beim Laden der E-Mail');
        return;
      }

      // Prüfe erneut, ob die E-Mail noch ausgewählt ist (Race Condition Prevention)
      // WICHTIG: Verwende Ref statt State, da Ref sofort aktualisiert wird
      if (selectedEmailIdRef.current !== emailId) {
        return; // User hat bereits eine andere E-Mail ausgewählt
      }

      const email = data.email;
      const isRead = email.read_at !== null && email.read_at !== undefined;
      
      const emailDetails: Email = {
        id: email.id,
        subject: email.subject || '(Kein Betreff)',
        from: email.from_email || email.from || '',
        to: Array.isArray(email.to_email) ? email.to_email : (email.to_email ? [email.to_email] : []),
        cc: email.cc || [],
        bcc: email.bcc || [],
        body: email.body || '',
        date: email.created_at || email.date || '',
        read: isRead,
        completed: !!email.completed_at || email.completed || false,
        deleted: !!email.deleted_at || email.deleted || false,
        spam: !!email.spam_at || email.spam || false,
        important: !!email.important_at || email.important || false,
        ticketId: email.ticketId || email.ticket_id || undefined,
        isConversationThread: email.isConversationThread || email.is_conversation_thread || false,
        conversationMessageCount: email.conversationMessageCount || email.conversation_message_count || 0,
      };

      // Cache Details
      emailDetailsCache.current.set(emailId, { email: emailDetails, timestamp: Date.now() });
      
      // Prüfe erneut, ob die E-Mail noch ausgewählt ist (Race Condition Prevention)
      // WICHTIG: Verwende Ref statt State, da Ref sofort aktualisiert wird
      if (selectedEmailIdRef.current === emailId) {
        startTransition(() => {
          if (selectedEmailIdRef.current === emailId) {
            setSelectedEmailDetails(emailDetails);
          }
        });
        
        // WICHTIG: setEmails wurde entfernt, um unnötige Re-Renders zu vermeiden
        // Der read-Status wird nur in selectedEmailDetails aktualisiert
        // Die Liste wird nicht aktualisiert, um ein Neuladen zu vermeiden
      }
    } catch (err: any) {
      // Prüfe, ob Request abgebrochen wurde
      if (err.name === 'AbortError' || loadEmailDetailsAbortControllerRef.current?.signal.aborted) {
        return; // Request wurde abgebrochen, ignoriere Fehler
      }
      // Prüfe, ob die E-Mail noch ausgewählt ist (Race Condition Prevention)
      // WICHTIG: Verwende Ref statt State, da Ref sofort aktualisiert wird
      if (selectedEmailIdRef.current === emailId) {
        setError('Fehler beim Laden der E-Mail');
      }
    } finally {
      loadingEmailDetailsRef.current.delete(emailId);
      loadEmailDetailsAbortControllerRef.current = null;
      // Prüfe, ob die E-Mail noch ausgewählt ist (Race Condition Prevention)
      // WICHTIG: Verwende Ref statt State, da Ref sofort aktualisiert wird
      if (selectedEmailIdRef.current === emailId) {
        setLoadingEmailDetails(false);
      }
    }
  }, [router, startTransition]);

  const handleEmailClick = useCallback(async (emailId: string) => {
    // WICHTIG: setSelectedEmailId zuerst, damit der Fokus in der Liste sofort wechselt
    setSelectedEmailId(emailId);
    // Aktualisiere auch den Ref, damit loadEmails darauf zugreifen kann
    selectedEmailIdRef.current = emailId;
    
    // Breche laufenden Request ab, falls vorhanden
    if (loadEmailDetailsAbortControllerRef.current) {
      loadEmailDetailsAbortControllerRef.current.abort();
      loadEmailDetailsAbortControllerRef.current = null;
    }
    
    // Clear previous timeout (auch wenn cachedDetails vorhanden ist)
    if (loadEmailDetailsTimeoutRef.current) {
      clearTimeout(loadEmailDetailsTimeoutRef.current);
      loadEmailDetailsTimeoutRef.current = null;
    }
    
    // Optimistic Update: Zeige sofort verfügbare Details aus der Liste
    const emailFromList = emails.find(e => e.id === emailId);
    const cachedDetails = getCachedEmail(emailId);
    const isUnread = !(emailFromList?.read ?? cachedDetails?.read ?? true);

    if (cachedDetails) {
      // Verwende gecachte Details sofort (kein Loading-State nötig)
      if (isUnread) {
        startTransition(() => {
          setSelectedEmailDetails({ ...cachedDetails, read: true });
          setEmails(prev => prev.map(e => e.id === emailId ? { ...e, read: true } : e));
        });
        performMarkAsReadRef.current?.(emailId, true, false);
      } else {
        setSelectedEmailDetails(cachedDetails);
      }
      setLoadingEmailDetails(false);
      // Kein API-Call nötig, da Details bereits gecacht sind
      return;
    }
    
    if (emailFromList) {
      // Erstelle Details aus Liste-Daten (optimistic); beim Öffnen ungelesener Mails sofort als gelesen anzeigen
      const optimisticBody = emailFromList.body || '';
      const showAsRead = isUnread ? true : (emailFromList.read || false);
      startTransition(() => {
        const optimisticDetails = {
          id: emailFromList.id,
          subject: emailFromList.subject || '(Kein Betreff)',
          from: emailFromList.from || '',
          to: emailFromList.to || [],
          cc: emailFromList.cc || [],
          bcc: emailFromList.bcc || [],
          body: optimisticBody,
          date: emailFromList.date || '',
          read: showAsRead,
          completed: emailFromList.completed || false,
          deleted: emailFromList.deleted || false,
          spam: emailFromList.spam || false,
          important: emailFromList.important || false,
          ticketId: emailFromList.ticketId || undefined,
          isConversationThread: emailFromList.isConversationThread || false,
          conversationMessageCount: emailFromList.conversationMessageCount || 0,
        };
        setSelectedEmailDetails(optimisticDetails);
        if (isUnread) {
          setEmails(prev => prev.map(e => e.id === emailId ? { ...e, read: true } : e));
        }
      });
      if (isUnread) {
        performMarkAsReadRef.current?.(emailId, true, false);
      }
      setLoadingEmailDetails(true); // Lade vollständige Details im Hintergrund
    } else {
      setLoadingEmailDetails(true);
    }
    
    // Debounce loadEmailDetails (nur wenn nicht gecacht und in Liste)
    if (!cachedDetails && emailFromList) {
      loadEmailDetailsTimeoutRef.current = setTimeout(() => {
        loadEmailDetails(emailId);
        loadEmailDetailsTimeoutRef.current = null;
      }, 50); // 50ms Debounce für ultra-schnelle Klicks
    } else if (!cachedDetails) {
      // E-Mail nicht in Liste, lade sofort
      await loadEmailDetails(emailId);
    }
  }, [emails, loadEmailDetails, startTransition]);

  const handleAddNote = useCallback((emailId: string) => {
    handleEmailClick(emailId);
    setFocusNotesOnMount(true);
  }, [handleEmailClick]);

  // Interne Funktion für tatsächliche Markierung (ohne Debouncing)
  const performMarkAsRead = useCallback(async (emailId: string, read: boolean, previousState: boolean) => {
    // Prüfe ob Request bereits läuft
    const existingRequest = pendingReadRequests.current.get(emailId);
    if (existingRequest) {
      existingRequest.abort(); // Abbrechen alter Request
    }

    // Neuer Request
    const abortController = new AbortController();
    pendingReadRequests.current.set(emailId, abortController);

    try {
      setMarkingRead(true);
      const token = safeLocalStorage.getItem('mailclient_token');
      if (!token) {
        throw new Error('Nicht angemeldet');
      }

      // API-Request mit Retry und AbortController
      const response = await callApiWithRetry(
        `/api/emails/${emailId}`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ read }),
          signal: abortController.signal,
        }
      );

      if (!response.ok) {
        throw new Error('API-Fehler');
      }

      const data = await response.json();
      const updatedEmail = data.email;

      lastReadUpdateRef.current.set(emailId, { read: updatedEmail.read, timestamp: Date.now() });
      // Status bereits optimistisch aktualisiert, nur bestätigen
      setEmails(prevEmails =>
        prevEmails.map(e =>
          e.id === emailId ? { ...e, read: updatedEmail.read } : e
        )
      );

      if (selectedEmailDetails && selectedEmailDetails.id === emailId) {
        setSelectedEmailDetails({ ...selectedEmailDetails, read: updatedEmail.read });
      }

      // Cache invalidieren
      emailDetailsCache.current.delete(emailId);

      await loadEmails(false);
      window.dispatchEvent(new CustomEvent('emailsFetched'));
    } catch (error: any) {
      if (error.name === 'AbortError') {
        // Request wurde abgebrochen - ignoriere
        return;
      }

      // Rollback bei Fehler
      setEmails(prevEmails =>
        prevEmails.map(e =>
          e.id === emailId ? { ...e, read: previousState } : e
        )
      );

      if (selectedEmailDetails && selectedEmailDetails.id === emailId) {
        setSelectedEmailDetails({ ...selectedEmailDetails, read: previousState });
      }

      setError(error.message || 'Fehler beim Aktualisieren der E-Mail');
    } finally {
      setMarkingRead(false);
      pendingReadRequests.current.delete(emailId);
    }
  }, [selectedEmailDetails, loadEmails, setError]);

  performMarkAsReadRef.current = performMarkAsRead;

  const handleMarkAsRead = useCallback(async (read: boolean) => {
    if (!selectedEmailId) return;

    // Optimistic Update (sofort)
    const previousState = selectedEmailDetails?.read ?? false;
    
    // Speichere vorherigen Status für Undo
    undoStack.current.push({ 
      emailId: selectedEmailId, 
      previousRead: previousState,
      timestamp: Date.now()
    });
    
    // Limitiere Stack-Größe
    if (undoStack.current.length > MAX_UNDO_STACK_SIZE) {
      undoStack.current.shift();
    }
    
    // State-Update-Batching: Verwende startTransition für nicht-kritische Updates
    startTransition(() => {
      setEmails(prevEmails =>
        prevEmails.map(e =>
          e.id === selectedEmailId ? { ...e, read } : e
        )
      );

      if (selectedEmailDetails) {
        setSelectedEmailDetails({ ...selectedEmailDetails, read });
      }
    });

    // Debounce: 300ms für schnelle Toggle-Aktionen
    const existingTimeout = debouncedMarkAsRead.current.get(selectedEmailId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    const timeoutId = setTimeout(async () => {
      await performMarkAsRead(selectedEmailId, read, previousState);
      debouncedMarkAsRead.current.delete(selectedEmailId);
    }, 300);

    debouncedMarkAsRead.current.set(selectedEmailId, timeoutId);
  }, [selectedEmailId, selectedEmailDetails, performMarkAsRead, startTransition]);

  // Undo-Funktion
  const handleUndo = useCallback(async () => {
    const lastAction = undoStack.current.pop();
    if (lastAction && lastAction.emailId) {
      // Setze selectedEmailId temporär, falls nicht gesetzt
      const wasSelected = selectedEmailId === lastAction.emailId;
      if (!wasSelected) {
        setSelectedEmailId(lastAction.emailId);
      }
      
      // Führe umgekehrte Aktion aus
      await performMarkAsRead(lastAction.emailId, lastAction.previousRead, !lastAction.previousRead);
      
      // Stelle selectedEmailId wieder her, falls es nicht gesetzt war
      if (!wasSelected) {
        setSelectedEmailId(null);
      }
    }
  }, [selectedEmailId, performMarkAsRead]);

  // Keyboard Shortcuts (nach allen Funktionsdefinitionen)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Nur wenn keine Input-Felder fokussiert sind
      if (e.target instanceof HTMLInputElement || 
          e.target instanceof HTMLTextAreaElement ||
          (e.target instanceof HTMLElement && e.target.isContentEditable)) {
        return;
      }
      
      // Ctrl+Z / Cmd+Z für Undo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
        return;
      }
      
      // Nur wenn eine E-Mail ausgewählt ist
      if (!selectedEmailId) return;
      
      // R = Als gelesen markieren
      if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        handleMarkAsRead(true);
        return;
      }
      
      // U = Als ungelesen markieren
      if (e.key === 'u' || e.key === 'U') {
        e.preventDefault();
        handleMarkAsRead(false);
        return;
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedEmailId, handleMarkAsRead, handleUndo]);

  const handleMarkAsCompleted = useCallback(async (completed: boolean) => {
    if (!selectedEmailId) return;

    try {
      setMarkingCompleted(true);
      const token = localStorage.getItem('mailclient_token');
      const response = await fetch(`/api/emails/${selectedEmailId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ completed }),
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || 'Fehler beim Aktualisieren der E-Mail');
        return;
      }

      const data = await response.json();
      const updatedEmail = data.email;
      
      setEmails(prevEmails =>
        prevEmails.map(e =>
          e.id === selectedEmailId
            ? { ...e, completed: updatedEmail.completed }
            : e
        )
      );

      if (selectedEmailDetails) {
        setSelectedEmailDetails({
          ...selectedEmailDetails,
          completed: updatedEmail.completed,
        });
      }

      // Cache invalidieren
      if (selectedEmailId) {
        emailDetailsCache.current.delete(selectedEmailId);
      }

      await loadEmails(false);
      window.dispatchEvent(new CustomEvent('emailsFetched'));
    } catch (err: any) {
      setError('Fehler beim Aktualisieren der E-Mail');
    } finally {
      setMarkingCompleted(false);
    }
  }, [selectedEmailId, selectedEmailDetails, loadEmails]);

  const handleMarkAsSpam = useCallback(async (spam: boolean) => {
    if (!selectedEmailId) return;

    try {
      setMarkingSpam(true);
      const token = localStorage.getItem('mailclient_token');
      const response = await fetch(`/api/emails/${selectedEmailId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ spam }),
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || 'Fehler beim Aktualisieren der E-Mail');
        return;
      }

      const data = await response.json();
      const updatedEmail = data.email;
      
      setEmails(prevEmails =>
        prevEmails.map(e =>
          e.id === selectedEmailId
            ? { ...e, spam: !!updatedEmail.spam_at || updatedEmail.spam || false }
            : e
        )
      );

      if (selectedEmailDetails) {
        setSelectedEmailDetails({
          ...selectedEmailDetails,
          spam: !!updatedEmail.spam_at || updatedEmail.spam || false,
        });
      }

      // Cache invalidieren
      if (selectedEmailId) {
        emailDetailsCache.current.delete(selectedEmailId);
      }
    } catch (err: any) {
      setError('Fehler beim Aktualisieren der E-Mail');
    } finally {
      setMarkingSpam(false);
    }
  }, [selectedEmailId, selectedEmailDetails]);

  const handleMarkAsImportant = useCallback(async (important: boolean) => {
    if (!selectedEmailId) return;

    try {
      setMarkingImportant(true);
      const token = localStorage.getItem('mailclient_token');
      const response = await fetch(`/api/emails/${selectedEmailId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ important }),
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || 'Fehler beim Aktualisieren der E-Mail');
        return;
      }

      const data = await response.json();
      const updatedEmail = data.email;
      
      setEmails(prevEmails =>
        prevEmails.map(e =>
          e.id === selectedEmailId
            ? { ...e, important: !!updatedEmail.important_at || updatedEmail.important || false }
            : e
        )
      );

      if (selectedEmailDetails) {
        setSelectedEmailDetails({
          ...selectedEmailDetails,
          important: !!updatedEmail.important_at || updatedEmail.important || false,
        });
      }

      // Cache invalidieren
      if (selectedEmailId) {
        emailDetailsCache.current.delete(selectedEmailId);
      }
    } catch (err: any) {
      setError('Fehler beim Aktualisieren der E-Mail');
    } finally {
      setMarkingImportant(false);
    }
  }, [selectedEmailId, selectedEmailDetails]);

  const handleDeleteEmail = useCallback(async () => {
    if (!selectedEmailId) return;

    if (!(await confirm({ message: 'Möchten Sie diese E-Mail wirklich löschen?', variant: 'danger', confirmLabel: 'Löschen' }))) {
      return;
    }

    try {
      setMarkingRead(true);
      const token = localStorage.getItem('mailclient_token');
      const response = await fetch(`/api/emails/${selectedEmailId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ deleted: true }),
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || 'Fehler beim Löschen der E-Mail');
        return;
      }

      const data = await response.json();
      const updatedEmail = data.email;

      setEmails(prevEmails =>
        prevEmails.map(e =>
          e.id === selectedEmailId
            ? { ...e, deleted: !!updatedEmail.deleted_at || updatedEmail.deleted || false }
            : e
        )
      );

      if (selectedEmailDetails) {
        setSelectedEmailDetails({
          ...selectedEmailDetails,
          deleted: !!updatedEmail.deleted_at || updatedEmail.deleted || false,
        });
      }

      // Cache invalidieren
      if (selectedEmailId) {
        emailDetailsCache.current.delete(selectedEmailId);
      }

      await loadEmails();
    } catch (err: any) {
      setError('Fehler beim Löschen der E-Mail');
    } finally {
      setMarkingRead(false);
    }
  }, [selectedEmailId, selectedEmailDetails, loadEmails, confirm]);

  const handleRestoreEmail = useCallback(async () => {
    if (!selectedEmailId) return;

    try {
      setMarkingRead(true);
      const token = localStorage.getItem('mailclient_token');
      const response = await fetch(`/api/emails/${selectedEmailId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ deleted: false }),
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || 'Fehler beim Wiederherstellen der E-Mail');
        return;
      }

      const data = await response.json();
      const updatedEmail = data.email;

      setEmails(prevEmails =>
        prevEmails.map(e =>
          e.id === selectedEmailId
            ? { ...e, deleted: !!updatedEmail.deleted_at || updatedEmail.deleted || false }
            : e
        )
      );

      if (selectedEmailDetails) {
        setSelectedEmailDetails({
          ...selectedEmailDetails,
          deleted: !!updatedEmail.deleted_at || updatedEmail.deleted || false,
        });
      }

      // Cache invalidieren
      if (selectedEmailId) {
        emailDetailsCache.current.delete(selectedEmailId);
      }

      await loadEmails();
    } catch (err: any) {
      setError('Fehler beim Wiederherstellen der E-Mail');
    } finally {
      setMarkingRead(false);
    }
  }, [selectedEmailId, selectedEmailDetails, loadEmails]);

  const handleSelectAll = useCallback(() => {
    if (selectedEmails.size === emails.length) {
      setSelectedEmails(new Set());
    } else {
      setSelectedEmails(new Set(emails.map(e => e.id)));
    }
  }, [selectedEmails.size, emails]);

  const handleSelectEmail = useCallback((emailId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newSelected = new Set(selectedEmails);
    if (newSelected.has(emailId)) {
      newSelected.delete(emailId);
    } else {
      newSelected.add(emailId);
    }
    setSelectedEmails(newSelected);
  }, [selectedEmails]);

  const handleFetchEmails = useCallback(async () => {
    setFetching(true);
    setFetchMessage(null);

    try {
      const token = localStorage.getItem('mailclient_token');
      const response = await fetch('/api/emails/fetch', {
        method: 'POST',
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

      const data = await response.json();

      if (!response.ok) {
        setFetchMessage({
          type: 'error',
          text: data.error || 'Fehler beim Abrufen der E-Mails',
        });
        return;
      }

      const isError = !data.success || 
          (data.results && data.results.length === 0 && data.totalCount === 0) ||
          (data.message.toLowerCase().includes('fehler') && !data.message.toLowerCase().includes('keine fehler'));
      
      setFetchMessage({
        type: isError ? 'error' : 'success',
        text: data.message || `${data.totalCount} E-Mail${data.totalCount !== 1 ? 's' : ''} abgerufen`,
      });

      await loadEmails();

      setTimeout(() => {
        setFetchMessage(null);
      }, 3000);
    } catch (err: any) {
      setFetchMessage({
        type: 'error',
        text: 'Fehler beim Abrufen der E-Mails',
      });
      window.dispatchEvent(new CustomEvent('emailsFetched'));
    } finally {
      setFetching(false);
    }
  }, [router, loadEmails]);

  const handleBulkMarkAsRead = useCallback(async (read: boolean) => {
    if (selectedEmails.size === 0) return;

    const emailIds = Array.from(selectedEmails);
    const BULK_THRESHOLD = 5; // Verwende Bulk-API ab 5 E-Mails
    const SHOW_PROGRESS_THRESHOLD = 50; // Zeige Progress ab 50 E-Mails

    // Optimistic Update für alle E-Mails (mit State-Batching)
    const previousStates = new Map<string, boolean>();
    startTransition(() => {
      setEmails(prevEmails => prevEmails.map(e => {
        if (selectedEmails.has(e.id)) {
          previousStates.set(e.id, e.read);
          return { ...e, read };
        }
        return e;
      }));
    });

    // Progress-Tracking initialisieren (nur bei großen Mengen)
    if (emailIds.length >= SHOW_PROGRESS_THRESHOLD) {
      setBulkProgress({ total: emailIds.length, completed: 0, failed: 0 });
    }

    try {
      setMarkingRead(true);
      const token = safeLocalStorage.getItem('mailclient_token');
      if (!token) {
        throw new Error('Nicht angemeldet');
      }

      // Verwende Bulk-API für größere Mengen, einzelne Requests für kleinere Mengen (bessere Fehlerbehandlung)
      if (emailIds.length >= BULK_THRESHOLD) {
        // Bulk-API-Endpunkt verwenden
        const response = await callApiWithRetry(
          '/api/emails/bulk',
          {
            method: 'PATCH',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ emailIds, read }),
          }
        );

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Bulk-Update fehlgeschlagen');
        }

        const data = await response.json();
        
        // Progress aktualisieren
        if (emailIds.length >= SHOW_PROGRESS_THRESHOLD) {
          setBulkProgress(prev => prev ? {
            ...prev,
            completed: data.updated || emailIds.length,
            failed: emailIds.length - (data.updated || emailIds.length)
          } : null);
        }
        
        // Prüfe ob alle E-Mails aktualisiert wurden
        if (data.updated < emailIds.length) {
          const failedCount = emailIds.length - data.updated;
          setError(`${failedCount} von ${emailIds.length} E-Mails konnten nicht aktualisiert werden`);
          
          // Rollback für nicht aktualisierte E-Mails
          const updatedIds = new Set(data.emailIds || []);
          setEmails(prevEmails => prevEmails.map(e =>
            emailIds.includes(e.id) && !updatedIds.has(e.id)
              ? { ...e, read: previousStates.get(e.id) ?? false }
              : e
          ));
        } else {
          setError('');
        }
      } else {
        // Einzelne Requests für bessere Fehlerbehandlung bei kleinen Mengen
        const BATCH_SIZE = 10;
        const results: Array<{ emailId: string; success: boolean; error?: string }> = [];

        for (let i = 0; i < emailIds.length; i += BATCH_SIZE) {
          const batch = emailIds.slice(i, i + BATCH_SIZE);

          const batchPromises = batch.map(async (emailId) => {
            try {
              const response = await callApiWithRetry(
                `/api/emails/${emailId}`,
                {
                  method: 'PATCH',
                  headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({ read }),
                }
              );

              if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
              }

              // Progress aktualisieren
              if (emailIds.length >= SHOW_PROGRESS_THRESHOLD) {
                setBulkProgress(prev => prev ? {
                  ...prev,
                  completed: prev.completed + 1
                } : null);
              }

              return { emailId, success: true };
            } catch (error: any) {
              // Progress aktualisieren (Fehler)
              if (emailIds.length >= SHOW_PROGRESS_THRESHOLD) {
                setBulkProgress(prev => prev ? {
                  ...prev,
                  completed: prev.completed + 1,
                  failed: prev.failed + 1
                } : null);
              }

              // Rollback für diese einzelne E-Mail
              setEmails(prevEmails => prevEmails.map(e =>
                e.id === emailId ? { ...e, read: previousStates.get(emailId) ?? false } : e
              ));

              return {
                emailId,
                success: false,
                error: error.message || 'Unbekannter Fehler'
              };
            }
          });

          const batchResults = await Promise.allSettled(batchPromises);
          results.push(...batchResults.map(r => r.status === 'fulfilled' ? r.value : {
            emailId: 'unknown',
            success: false,
            error: 'Promise rejected'
          }));
        }

        // Zeige Zusammenfassung bei Fehlern
        const failed = results.filter(r => !r.success);
        if (failed.length > 0) {
          setError(`${failed.length} von ${emailIds.length} E-Mails konnten nicht aktualisiert werden`);
        } else {
          // Erfolg: Fehler zurücksetzen
          setError('');
        }
      }

      // Cache invalidieren und neu laden
      emailIds.forEach(id => emailDetailsCache.current.delete(id));
      await loadEmails(false);
      window.dispatchEvent(new CustomEvent('emailsFetched'));
    } catch (err: any) {
      // Rollback für alle E-Mails (verwende emailIds statt selectedEmails, da Set sich ändern könnte)
      setEmails(prevEmails => prevEmails.map(e =>
        emailIds.includes(e.id)
          ? { ...e, read: previousStates.get(e.id) ?? false }
          : e
      ));
      setError(err.message || 'Fehler beim Aktualisieren der E-Mails');
    } finally {
      setMarkingRead(false);
      // Progress zurücksetzen nach kurzer Verzögerung (damit User es sehen kann)
      if (emailIds.length >= SHOW_PROGRESS_THRESHOLD) {
        setTimeout(() => setBulkProgress(null), 2000);
      }
    }
  }, [selectedEmails, loadEmails, setError, startTransition, confirm]);

  const handleBulkMarkAsCompleted = useCallback(async (completed: boolean) => {
    if (selectedEmails.size === 0) return;
    
    try {
      setMarkingCompleted(true);
      const token = localStorage.getItem('mailclient_token');
      if (!token) return;

      const promises = Array.from(selectedEmails).map(emailId =>
        fetch(`/api/emails/${emailId}`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ completed }),
        })
      );

      await Promise.all(promises);
      
      setEmails(prevEmails =>
        prevEmails.map(e =>
          selectedEmails.has(e.id) ? { ...e, completed } : e
        )
      );

      if (selectedEmailDetails && selectedEmails.has(selectedEmailDetails.id)) {
        setSelectedEmailDetails({ ...selectedEmailDetails, completed });
      }

      setSelectedEmails(new Set());
      window.dispatchEvent(new CustomEvent('emailsFetched'));
    } catch (err) {
      setError('Fehler beim Aktualisieren der E-Mails');
    } finally {
      setMarkingCompleted(false);
    }
  }, [selectedEmails, selectedEmailDetails]);

  const handleBulkMarkAsSpam = useCallback(async (spam: boolean) => {
    if (selectedEmails.size === 0) return;
    
    try {
      setMarkingSpam(true);
      const token = localStorage.getItem('mailclient_token');
      if (!token) return;

      const promises = Array.from(selectedEmails).map(emailId =>
        fetch(`/api/emails/${emailId}`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ spam }),
        })
      );

      await Promise.all(promises);
      
      setEmails(prevEmails =>
        prevEmails.map(e =>
          selectedEmails.has(e.id) ? { ...e, spam } : e
        )
      );

      if (selectedEmailDetails && selectedEmails.has(selectedEmailDetails.id)) {
        setSelectedEmailDetails({ ...selectedEmailDetails, spam });
      }

      setSelectedEmails(new Set());
      window.dispatchEvent(new CustomEvent('emailsFetched'));
    } catch (err) {
      setError('Fehler beim Aktualisieren der E-Mails');
    } finally {
      setMarkingSpam(false);
    }
  }, [selectedEmails, selectedEmailDetails]);

  const handleBulkMarkAsImportant = useCallback(async (important: boolean) => {
    if (selectedEmails.size === 0) return;
    
    try {
      setMarkingImportant(true);
      const token = localStorage.getItem('mailclient_token');
      if (!token) return;

      const promises = Array.from(selectedEmails).map(emailId =>
        fetch(`/api/emails/${emailId}`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ important }),
        })
      );

      await Promise.all(promises);
      
      setEmails(prevEmails =>
        prevEmails.map(e =>
          selectedEmails.has(e.id) ? { ...e, important } : e
        )
      );

      if (selectedEmailDetails && selectedEmails.has(selectedEmailDetails.id)) {
        setSelectedEmailDetails({ ...selectedEmailDetails, important });
      }

      setSelectedEmails(new Set());
      window.dispatchEvent(new CustomEvent('emailsFetched'));
    } catch (err) {
      setError('Fehler beim Aktualisieren der E-Mails');
    } finally {
      setMarkingImportant(false);
    }
  }, [selectedEmails, selectedEmailDetails]);

  const handleBulkDelete = useCallback(async () => {
    if (selectedEmails.size === 0) return;
    
    if (!(await confirm({ message: `Möchten Sie ${selectedEmails.size} E-Mail(s) wirklich löschen?`, variant: 'danger', confirmLabel: 'Löschen' }))) {
      return;
    }

    try {
      const token = localStorage.getItem('mailclient_token');
      if (!token) return;

      const promises = Array.from(selectedEmails).map(emailId =>
        fetch(`/api/emails/${emailId}`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ deleted: true }),
        })
      );

      await Promise.all(promises);
      
      setEmails(prevEmails =>
        prevEmails.filter(e => !selectedEmails.has(e.id))
      );

      setSelectedEmails(new Set());
      if (selectedEmailDetails && selectedEmails.has(selectedEmailDetails.id)) {
        setSelectedEmailDetails(null);
        setSelectedEmailId(null);
        selectedEmailIdRef.current = null;
      }
      
      window.dispatchEvent(new CustomEvent('emailsFetched'));
    } catch (err) {
      setError('Fehler beim Löschen der E-Mails');
    }
  }, [selectedEmails, selectedEmailDetails]);

  // Wrapper-Handler für EmailToolbar
  const handleToolbarMarkAsRead = useCallback((read: boolean) => {
    if (selectedEmailId && selectedEmailDetails) {
      handleMarkAsRead(read);
    } else if (selectedEmails.size > 0) {
      handleBulkMarkAsRead(read);
    }
  }, [selectedEmailId, selectedEmailDetails, selectedEmails.size, handleMarkAsRead, handleBulkMarkAsRead]);

  const handleToolbarMarkAsCompleted = useCallback((completed: boolean) => {
    if (selectedEmailId && selectedEmailDetails) {
      handleMarkAsCompleted(completed);
    } else if (selectedEmails.size > 0) {
      handleBulkMarkAsCompleted(completed);
    }
  }, [selectedEmailId, selectedEmailDetails, selectedEmails.size, handleMarkAsCompleted, handleBulkMarkAsCompleted]);

  const handleToolbarMarkAsSpam = useCallback((spam: boolean) => {
    if (selectedEmailId && selectedEmailDetails) {
      handleMarkAsSpam(spam);
    } else if (selectedEmails.size > 0) {
      handleBulkMarkAsSpam(spam);
    }
  }, [selectedEmailId, selectedEmailDetails, selectedEmails.size, handleMarkAsSpam, handleBulkMarkAsSpam]);

  const handleToolbarMarkAsImportant = useCallback((important: boolean) => {
    if (selectedEmailId && selectedEmailDetails) {
      handleMarkAsImportant(important);
    } else if (selectedEmails.size > 0) {
      handleBulkMarkAsImportant(important);
    }
  }, [selectedEmailId, selectedEmailDetails, selectedEmails.size, handleMarkAsImportant, handleBulkMarkAsImportant]);

  const handleToolbarDelete = useCallback(() => {
    if (selectedEmailId && selectedEmailDetails) {
      handleDeleteEmail();
    } else if (selectedEmails.size > 0) {
      handleBulkDelete();
    }
  }, [selectedEmailId, selectedEmailDetails, selectedEmails.size, handleDeleteEmail, handleBulkDelete]);

  const handleSearchFieldsChange = useCallback(async (fields: string[]) => {
    setSearchFields(fields);
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
          searchFields: fields,
        }),
      });
    } catch (err) {
      console.error('Fehler beim Speichern der Suchoptionen:', err);
    }
  }, []);

  const saveLayoutPreferences = useCallback(async (prefs: Partial<LayoutPreferences>) => {
    setLayoutPreferences(prev => ({ ...prev, ...prefs }));
    try {
      const token = localStorage.getItem('mailclient_token');
      if (!token) return;

      const response = await fetch('/api/settings', {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ layoutPreferences: prefs }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        toast.showError(data.error || 'Layout konnte nicht gespeichert werden');
      }
    } catch (err) {
      console.error('Fehler beim Speichern der Layout-Preferences:', err);
      toast.showError('Layout konnte nicht gespeichert werden');
    }
  }, [toast]);

  const handleRefresh = useCallback(() => {
    // Lösche Cache für aktuell ausgewählte E-Mail, damit sie neu geladen wird
    if (selectedEmailId) {
      emailDetailsCache.current.delete(selectedEmailId);
      console.log(`🔄 Cache gelöscht für E-Mail ${selectedEmailId} - wird neu geladen`);
    }
    
    // Lade E-Mail-Liste neu
    loadEmails(true, page);
    
    // Lade Details der aktuell ausgewählten E-Mail neu
    if (selectedEmailId) {
      loadEmailDetails(selectedEmailId);
    }
  }, [loadEmails, page, selectedEmailId, loadEmailDetails]);

  const handleDepartmentChange = useCallback(() => {
    loadEmails(false, page);
  }, [loadEmails, page]);

  const handleSearchReset = useCallback(() => {
    setSearchQuery('');
    setFilter('all');
  }, []);

  // Prefetching von benachbarten E-Mails
  const prefetchEmailDetails = useCallback(async (emailId: string) => {
    // Prüfe Cache und Queue
    if (hasCachedEmail(emailId) || prefetchQueueRef.current.has(emailId)) {
      return;
    }
    
    // Prüfe, ob bereits geladen wird (Request Deduplication)
    if (loadingEmailDetailsRef.current.has(emailId)) {
      return;
    }
    
    prefetchQueueRef.current.add(emailId);
    
    try {
      const token = safeLocalStorage.getItem('mailclient_token');
      if (!token) return;
      
      const response = await fetch(`/api/emails/${emailId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (response.ok) {
        const data = await response.json();
        const email = data.email;
        // KORREKTUR: Verwende email.read statt email.read_at
        const isRead = email.read ?? false;
        
        const emailDetails: Email = {
          id: email.id,
          subject: email.subject || '(Kein Betreff)',
          from: email.from_email || email.from || '',
          to: Array.isArray(email.to_email) ? email.to_email : (email.to_email ? [email.to_email] : []),
          cc: email.cc || [],
          bcc: email.bcc || [],
          body: email.body || '',
          date: email.created_at || email.date || '',
          read: isRead,
          completed: !!email.completed_at || email.completed || false,
          deleted: !!email.deleted_at || email.deleted || false,
          spam: !!email.spam_at || email.spam || false,
          important: !!email.important_at || email.important || false,
          ticketId: email.ticketId || email.ticket_id || undefined,
          isConversationThread: email.isConversationThread || email.is_conversation_thread || false,
          conversationMessageCount: email.conversationMessageCount || email.conversation_message_count || 0,
        };
        setCachedEmail(emailId, emailDetails);
      }
    } catch (err) {
      // Ignoriere Fehler bei Prefetch
    } finally {
      prefetchQueueRef.current.delete(emailId);
    }
  }, []);

  return {
    // States
    emails,
    loading,
    error,
    searchQuery,
    setSearchQuery,
    filter,
    setFilter,
    emailFilters,
    setEmailFilters,
    customFilterId,
    setCustomFilterId,
    searchFields,
    setSearchFields,
    selectedEmails,
    setSelectedEmails,
    selectedEmailId,
    setSelectedEmailId,
    selectedEmailDetails,
    setSelectedEmailDetails,
    loadingEmailDetails,
    markingRead,
    markingCompleted,
    markingSpam,
    markingImportant,
    fetching,
    fetchMessage,
    page,
    setPage,
    limit,
    totalPages,
    total,
    hasNext,
    hasPrevious,
    tableColumns,
    setTableColumns,
    layoutPreferences,
    saveLayoutPreferences,

    // Handlers
    loadEmails,
    handleEmailClick,
    handleMarkAsRead,
    handleMarkAsCompleted,
    handleMarkAsSpam,
    handleMarkAsImportant,
    handleDeleteEmail,
    handleRestoreEmail,
    handleSelectAll,
    handleSelectEmail,
    handleFetchEmails,
    handleBulkMarkAsRead,
    handleBulkMarkAsCompleted,
    handleBulkMarkAsSpam,
    handleBulkMarkAsImportant,
    handleBulkDelete,
    formatDate,
    formatDateForTable,
    formatDateForPreview,
    handleToolbarMarkAsRead,
    handleToolbarMarkAsCompleted,
    handleToolbarMarkAsSpam,
    handleToolbarMarkAsImportant,
    handleToolbarDelete,
    handleSearchFieldsChange,
    handleRefresh,
    handleDepartmentChange,
    handleSearchReset,
    handleAddNote,

    // Fokus Kommentare (z. B. aus Kontextmenü „Kommentar hinzufügen“)
    focusNotesOnMount,

    // Computed
    unreadCount,
    emailStats,
    bulkProgress,
    
    // Undo/Redo
    handleUndo,
    
    // Prefetching
    prefetchEmailDetails,
  };
}

