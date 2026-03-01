'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  FiMail,
  FiEye,
  FiEyeOff,
  FiTrash2,
  FiRotateCcw,
  FiStar,
  FiAlertTriangle,
  FiCheckCircle,
  FiXCircle,
  FiTag,
  FiZap,
  FiBriefcase,
  FiArrowRight,
  FiCircle,
  FiMapPin,
  FiHash,
  FiLink2,
  FiEdit2,
  FiMessageSquare,
  FiCopy,
} from 'react-icons/fi';
import { useToast } from '@/components/ToastProvider';
import { useConfirm } from '@/components/ConfirmDialog';

interface EmailEvent {
  id: string;
  emailId: string;
  userId: string;
  userName?: string;
  userEmail?: string;
  eventType:
    | 'received'
    | 'read'
    | 'unread'
    | 'deleted'
    | 'restored'
    | 'marked_important'
    | 'marked_spam'
    | 'marked_completed'
    | 'marked_uncompleted'
    | 'theme_assigned'
    | 'urgency_set'
    | 'department_assigned'
    | 'department_removed'
    | 'forwarded'
    | 'automation_triggered'
    | 'automation_applied'
    | 'automation_rule_activated'
    | 'automation_rule_deactivated'
    | 'ticket_assigned'
    | 'ticket_reused'
    | 'ticket_changed'
    | 'conversation_created';
  eventData: {
    [key: string]: any;
    themeId?: string;
    themeName?: string;
    urgency?: 'low' | 'medium' | 'high';
    to?: string;
    subject?: string;
    ruleId?: string;
    ruleName?: string;
    actionType?: string;
    departmentId?: string;
    departmentName?: string;
    ticketId?: string;
    oldTicketId?: string;
    wasReused?: boolean;
    extractedFrom?: string;
    changeReason?: string;
    messageCount?: number;
  };
  createdAt: string;
  activeRules?: Array<{
    ruleId: string;
    ruleName: string;
    isActive: boolean;
  }>;
}

export interface EmailNoteFromApi {
  id: string;
  emailId: string;
  userId: string;
  userName?: string;
  userEmail?: string;
  content: string;
  createdAt: string;
}

type TimelineItem =
  | { type: 'event'; data: EmailEvent }
  | { type: 'note'; data: EmailNoteFromApi };

interface EmailTimelineProps {
  emailId: string | null;
  notes?: EmailNoteFromApi[] | null;
  onNotesChange?: () => void;
}

const MAX_NOTE_LENGTH = 2000;

export default function EmailTimeline({ emailId, notes: notesProp, onNotesChange }: EmailTimelineProps) {
  const router = useRouter();
  const toast = useToast();
  const { confirm } = useConfirm();
  const [events, setEvents] = useState<EmailEvent[]>([]);
  const [notes, setNotes] = useState<EmailNoteFromApi[]>([]);
  const [loading, setLoading] = useState(false);
  const [notesLoading, setNotesLoading] = useState(false);
  const [error, setError] = useState('');
  const [emailDepartment, setEmailDepartment] = useState<{ id: string; name: string } | null>(null);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [deletingNoteId, setDeletingNoteId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    try {
      const userData = typeof window !== 'undefined' ? localStorage.getItem('mailclient_user') : null;
      if (!userData) {
        setCurrentUserId(null);
        return;
      }
      const parsed = JSON.parse(userData);
      setCurrentUserId(parsed?.id ?? null);
    } catch {
      setCurrentUserId(null);
    }
  }, []);

  const loadNotes = useCallback(async () => {
    if (!emailId) return;
    try {
      setNotesLoading(true);
      const token = localStorage.getItem('mailclient_token');
      const res = await fetch(`/api/emails/${emailId}/notes?sort=desc&limit=100`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        localStorage.removeItem('mailclient_token');
        localStorage.removeItem('mailclient_user');
        router.push('/login');
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setNotes(data.notes ?? []);
      }
    } catch (err) {
      console.error('Fehler beim Laden der Kommentare:', err);
    } finally {
      setNotesLoading(false);
    }
  }, [emailId, router]);

  useEffect(() => {
    if (emailId) {
      loadEvents();
      loadEmailDepartment();
      if (notesProp !== undefined) {
        setNotes(Array.isArray(notesProp) ? notesProp : []);
      } else {
        loadNotes();
      }
    } else {
      setEvents([]);
      setNotes([]);
      setEmailDepartment(null);
      setEditingNoteId(null);
      setDeletingNoteId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emailId, notesProp]);

  const loadEmailDepartment = async () => {
    if (!emailId) return;

    try {
      const token = localStorage.getItem('mailclient_token');
      const response = await fetch(`/api/emails/${emailId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        // Gleiche Logik wie E-Mail-Liste: zuerst zugewiesene Abteilungen (assigned_departments), sonst department
        const assigned = data.email?.assigned_departments;
        if (assigned?.length > 0) {
          setEmailDepartment(assigned[0]);
        } else if (data.email?.department) {
          setEmailDepartment(data.email.department);
        } else {
          setEmailDepartment(null);
        }
      }
    } catch (err: any) {
      console.error('Fehler beim Laden der E-Mail-Abteilung:', err);
    }
  };

  const loadEvents = async () => {
    if (!emailId) return;

    try {
      setLoading(true);
      setError('');
      const token = localStorage.getItem('mailclient_token');
      const response = await fetch(`/api/emails/${emailId}/events?include_active_rules=true&sort=desc&limit=100`, {
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

      if (response.ok) {
        const data = await response.json();
        
        // Deduplizierung: Entferne semantische Duplikate (gleicher Typ innerhalb von 10 Sekunden)
        const uniqueEvents: EmailEvent[] = [];
        const seenKeys = new Set<string>();
        
        // Sortiere Events nach Datum (neueste zuerst), damit neuere Events bevorzugt werden
        const eventsSorted = [...(data.events || [])].sort((a, b) => {
          const dateA = new Date(a.createdAt).getTime();
          const dateB = new Date(b.createdAt).getTime();
          return dateB - dateA;
        });
        
        for (const event of eventsSorted) {
          // Erstelle Key basierend auf Typ + Timestamp (gerundet auf 10 Sekunden)
          const timestamp = Math.floor(new Date(event.createdAt).getTime() / 10000); // 10 Sekunden
          const semanticKey = `${event.emailId}-${event.userId}-${event.eventType}-${timestamp}`;
          
          // Prüfe, ob bereits ein Event mit diesem semantischen Key existiert
          if (!seenKeys.has(semanticKey)) {
            uniqueEvents.push(event);
            seenKeys.add(semanticKey);
            
            // Füge auch die ID hinzu, falls vorhanden
            if (event.id) {
              seenKeys.add(event.id);
            }
          }
          // Duplikat wird übersprungen (nicht zu uniqueEvents hinzugefügt)
        }
        
        // Events sind bereits sortiert (neueste zuerst), da wir eventsSorted verwendet haben
        setEvents(uniqueEvents);
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unbekannter Fehler' }));
        console.error('Fehler beim Laden der Events:', errorData);
        setError('Fehler beim Laden der Timeline: ' + (errorData.error || 'Unbekannter Fehler'));
      }
    } catch (err: any) {
      setError('Fehler beim Laden der Timeline: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const getEventIcon = (eventType: string): React.ReactNode => {
    const iconProps = { size: 16, style: { display: 'inline-block', verticalAlign: 'middle' } };
    const icons: Record<string, React.ReactNode> = {
      received: <FiMail {...iconProps} />,
      read: <FiEye {...iconProps} />,
      unread: <FiEyeOff {...iconProps} />,
      deleted: <FiTrash2 {...iconProps} />,
      restored: <FiRotateCcw {...iconProps} />,
      marked_important: <FiStar {...iconProps} style={{ ...iconProps.style, color: '#FBBF24', fill: '#FBBF24' }} />,
      marked_spam: <FiAlertTriangle {...iconProps} style={{ ...iconProps.style, color: '#DC2626' }} />,
      marked_completed: <FiCheckCircle {...iconProps} style={{ ...iconProps.style, color: '#10B981' }} />,
      marked_uncompleted: <FiXCircle {...iconProps} style={{ ...iconProps.style, color: '#DC2626' }} />,
      theme_assigned: <FiTag {...iconProps} style={{ ...iconProps.style, color: '#2563EB' }} />,
      urgency_set: <FiZap {...iconProps} style={{ ...iconProps.style, color: '#F59E0B' }} />,
      department_assigned: <FiBriefcase {...iconProps} style={{ ...iconProps.style, color: '#10B981' }} />,
      department_removed: <FiBriefcase {...iconProps} style={{ ...iconProps.style, color: '#6B7280' }} />,
      forwarded: <FiArrowRight {...iconProps} style={{ ...iconProps.style, color: '#2563EB' }} />,
      automation_triggered: <FiZap {...iconProps} style={{ ...iconProps.style, color: '#8B5CF6' }} />,
      automation_applied: <FiCheckCircle {...iconProps} style={{ ...iconProps.style, color: '#10B981' }} />,
      automation_rule_activated: <FiCircle {...iconProps} style={{ ...iconProps.style, color: '#10B981', fill: '#10B981' }} />,
      automation_rule_deactivated: <FiCircle {...iconProps} style={{ ...iconProps.style, color: '#DC2626', fill: '#DC2626' }} />,
      ticket_assigned: <FiHash {...iconProps} style={{ ...iconProps.style, color: '#007bff' }} />,
      ticket_reused: <FiLink2 {...iconProps} style={{ ...iconProps.style, color: '#6c757d' }} />,
      ticket_changed: <FiEdit2 {...iconProps} style={{ ...iconProps.style, color: '#ffc107' }} />,
      conversation_created: <FiMessageSquare {...iconProps} style={{ ...iconProps.style, color: '#28a745' }} />,
    };
    return icons[eventType] || <FiMapPin {...iconProps} />;
  };

  const getEventLabel = (event: EmailEvent): string => {
    switch (event.eventType) {
      case 'received':
        return 'E-Mail empfangen';
      case 'read':
        return 'Als gelesen markiert';
      case 'unread':
        return 'Als ungelesen markiert';
      case 'deleted':
        return 'Gelöscht';
      case 'restored':
        return 'Wiederhergestellt';
      case 'marked_important':
        return 'Als wichtig markiert';
      case 'marked_spam':
        return 'Als Spam markiert';
      case 'marked_completed':
        return 'Als erledigt markiert';
      case 'marked_uncompleted':
        return 'Als unerledigt markiert';
      case 'theme_assigned':
        return `Thema '${event.eventData.themeName || 'Unbekannt'}' zugewiesen`;
      case 'urgency_set':
        const urgencyLabels: Record<string, string> = {
          low: 'Niedrig',
          medium: 'Mittel',
          high: 'Hoch',
        };
        return `Dringlichkeit auf '${urgencyLabels[event.eventData.urgency || ''] || event.eventData.urgency}' gesetzt`;
      case 'department_assigned':
        return `Abteilung '${event.eventData.departmentName || 'Unbekannt'}' zugewiesen`;
      case 'department_removed':
        return `Abteilung '${event.eventData.departmentName || 'Unbekannt'}' entfernt`;
      case 'forwarded':
        return `Weitergeleitet an ${event.eventData.to || 'Unbekannt'}`;
      case 'automation_triggered':
        return `Automatisierungs-Workflow '${event.eventData.ruleName || 'Unbekannt'}' ausgelöst`;
      case 'automation_applied':
        return `Automatisierungs-Workflow '${event.eventData.ruleName || 'Unbekannt'}' angewendet`;
      case 'automation_rule_activated':
        return `Workflow '${event.eventData.ruleName || 'Unbekannt'}' aktiviert`;
      case 'automation_rule_deactivated':
        return `Workflow '${event.eventData.ruleName || 'Unbekannt'}' deaktiviert`;
      case 'ticket_assigned':
        return `Ticket-ID zugewiesen: ${event.eventData.ticketId || 'Unbekannt'}`;
      case 'ticket_reused':
        return `Ticket-ID wiederverwendet: ${event.eventData.ticketId || 'Unbekannt'}${event.eventData.extractedFrom ? ` (aus ${event.eventData.extractedFrom})` : ''}`;
      case 'ticket_changed':
        return `Ticket-ID geändert${event.eventData.oldTicketId && event.eventData.ticketId ? ` von ${event.eventData.oldTicketId} zu ${event.eventData.ticketId}` : ''}${event.eventData.changeReason ? ` (${event.eventData.changeReason})` : ''}`;
      case 'conversation_created':
        return `Konversation erkannt (${event.eventData.messageCount || 2} Nachrichten mit Ticket-ID ${event.eventData.ticketId || 'Unbekannt'})`;
      default:
        return event.eventType;
    }
  };
  
  const getUserDisplayName = (event: EmailEvent): string => {
    if (event.userName) {
      return event.userName;
    }
    if (event.userEmail) {
      return event.userEmail;
    }
    return 'Unbekannt';
  };

  const getNoteAuthorDisplay = (note: EmailNoteFromApi): string => {
    if (note.userName) return note.userName;
    if (note.userEmail) return note.userEmail;
    return 'Unbekannt';
  };

  const timelineItems: TimelineItem[] = [
    ...events.map((e) => ({ type: 'event' as const, data: e })),
    ...notes.map((n) => ({ type: 'note' as const, data: n })),
  ].sort((a, b) => {
    const dateA = new Date(a.type === 'event' ? a.data.createdAt : a.data.createdAt).getTime();
    const dateB = new Date(b.type === 'event' ? b.data.createdAt : b.data.createdAt).getTime();
    return dateB - dateA;
  });

  const handleCopyNote = async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      toast?.showSuccess?.('In Zwischenablage kopiert') ?? console.log('Kopiert');
    } catch (err) {
      toast?.showError?.('Kopieren fehlgeschlagen') ?? console.error(err);
    }
  };

  const handleStartEditNote = (note: EmailNoteFromApi) => {
    setEditingNoteId(note.id);
    setEditContent(note.content);
  };

  const handleSaveEditNote = async () => {
    if (!emailId || !editingNoteId || savingNote) return;
    const content = editContent.trim();
    if (content.length === 0) {
      toast?.showError?.('Kommentar darf nicht leer sein');
      return;
    }
    if (content.length > MAX_NOTE_LENGTH) {
      toast?.showError?.(`Kommentar darf maximal ${MAX_NOTE_LENGTH} Zeichen haben`);
      return;
    }
    setSavingNote(true);
    try {
      const token = localStorage.getItem('mailclient_token');
      const res = await fetch(`/api/emails/${emailId}/notes/${editingNoteId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content }),
      });
      if (res.status === 401) {
        localStorage.removeItem('mailclient_token');
        localStorage.removeItem('mailclient_user');
        router.push('/login');
        return;
      }
      if (res.ok) {
        const updated = await res.json();
        setNotes((prev) => prev.map((n) => (n.id === editingNoteId ? updated : n)));
        setEditingNoteId(null);
        setEditContent('');
        onNotesChange?.();
        toast?.showSuccess?.('Kommentar gespeichert');
      } else {
        const err = await res.json().catch(() => ({}));
        toast?.showError?.(err.error || 'Speichern fehlgeschlagen');
      }
    } catch (err) {
      toast?.showError?.('Speichern fehlgeschlagen');
    } finally {
      setSavingNote(false);
    }
  };

  const handleCancelEdit = () => {
    setEditingNoteId(null);
    setEditContent('');
  };

  const handleDeleteNote = async (note: EmailNoteFromApi) => {
    if (!emailId || deletingNoteId) return;
    if (!(await confirm({ message: 'Kommentar wirklich löschen?', variant: 'danger', confirmLabel: 'Löschen' }))) return;
    setDeletingNoteId(note.id);
    try {
      const token = localStorage.getItem('mailclient_token');
      const res = await fetch(`/api/emails/${emailId}/notes/${note.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        localStorage.removeItem('mailclient_token');
        localStorage.removeItem('mailclient_user');
        router.push('/login');
        return;
      }
      if (res.ok || res.status === 204) {
        setNotes((prev) => prev.filter((n) => n.id !== note.id));
        onNotesChange?.();
        toast?.showSuccess?.('Kommentar gelöscht');
      } else {
        const err = await res.json().catch(() => ({}));
        toast?.showError?.(err.error || 'Löschen fehlgeschlagen');
      }
    } catch (err) {
      toast?.showError?.('Löschen fehlgeschlagen');
    } finally {
      setDeletingNoteId(null);
    }
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    
    // Hilfsfunktion für Zeitformat mit Millisekunden
    const formatTimeWithMs = (d: Date): string => {
      const hours = d.getHours().toString().padStart(2, '0');
      const minutes = d.getMinutes().toString().padStart(2, '0');
      const seconds = d.getSeconds().toString().padStart(2, '0');
      const milliseconds = d.getMilliseconds().toString().padStart(3, '0');
      return `${hours}:${minutes}:${seconds}.${milliseconds}`;
    };

    // Immer Datum + Uhrzeit anzeigen, ohne Wochentag
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    const dateStr = `${day}.${month}.${year}`;
    const timeStr = formatTimeWithMs(date);
    
    return `${dateStr} ${timeStr}`;
  };

  if (!emailId) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#6c757d' }}>
        <p>Wählen Sie eine E-Mail aus, um die Timeline anzuzeigen.</p>
      </div>
    );
  }

  const isLoadingNotes = notesProp === undefined && notesLoading;
  if (loading || isLoadingNotes) {
    return <div style={{ padding: '1rem' }}>Lade Timeline…</div>;
  }

  if (error) {
    return (
      <div style={{ padding: '1rem', backgroundColor: '#f8d7da', color: '#721c24', borderRadius: '4px' }}>
        {error}
      </div>
    );
  }

  return (
    <div style={{ padding: '0.75rem', height: '100%', overflowY: 'auto', backgroundColor: '#f8f9fa', minHeight: '200px' }}>
      <h3 style={{ marginTop: 0, marginBottom: '0.75rem', fontSize: '1rem', fontWeight: '600', color: '#333' }}>E-Mail-Timeline</h3>

      {emailDepartment && (
        <div style={{ marginBottom: '1rem', padding: '0.5rem 0.75rem', backgroundColor: 'white', borderRadius: '6px', border: '1px solid #dee2e6' }}>
          <div style={{ fontSize: '0.75rem', color: '#6c757d', marginBottom: '0.25rem' }}>Abteilung</div>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.25rem',
              padding: '0.25rem 0.5rem',
              borderRadius: '4px',
              fontSize: '0.75rem',
              fontWeight: '500',
              backgroundColor: '#e3f2fd',
              color: '#1976d2',
            }}
          >
            <FiBriefcase size={14} style={{ color: '#10B981' }} />
            {emailDepartment.name}
          </span>
        </div>
      )}

      {timelineItems.length === 0 ? (
        <div style={{ padding: '1rem', textAlign: 'center', color: '#6c757d', backgroundColor: 'white', borderRadius: '6px', border: '1px solid #dee2e6' }}>
          <p style={{ margin: 0, fontSize: '0.875rem' }}>Noch keine Einträge für diese E-Mail.</p>
        </div>
      ) : (
        <div style={{ position: 'relative' }}>
          {/* Vertikale Timeline-Linie */}
          <div
            style={{
              position: 'absolute',
              left: '14px',
              top: 0,
              bottom: 0,
              width: '2px',
              backgroundColor: '#dee2e6',
            }}
          />

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {timelineItems.map((item) => {
              if (item.type === 'event') {
                const event = item.data;
                return (
                  <div
                    key={`event-${event.id}`}
                    style={{
                      position: 'relative',
                      paddingLeft: '2.25rem',
                    }}
                  >
                    <div
                      style={{
                        position: 'absolute',
                        left: '6px',
                        top: '2px',
                        width: '16px',
                        height: '16px',
                        borderRadius: '50%',
                        backgroundColor: '#007bff',
                        border: '2px solid white',
                        boxShadow: '0 0 0 1.5px #dee2e6',
                        zIndex: 1,
                      }}
                    />
                    <div
                      style={{
                        padding: '0.5rem 0.75rem',
                        backgroundColor: 'white',
                        border: '1px solid #dee2e6',
                        borderRadius: '6px',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', flex: '1', minWidth: 0 }}>
                          <span style={{ display: 'flex', alignItems: 'center', lineHeight: '1', flexShrink: 0 }}>{getEventIcon(event.eventType)}</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', flex: '1', minWidth: 0 }}>
                            <strong style={{ fontSize: '0.875rem', fontWeight: '500' }}>{getEventLabel(event)}</strong>
                            <span style={{ fontSize: '0.75rem', color: '#6c757d' }}>von {getUserDisplayName(event)}</span>
                          </div>
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#6c757d', lineHeight: '1.2', flexShrink: 0, whiteSpace: 'nowrap' }}>
                          {formatDate(event.createdAt)}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              }
              const note = item.data;
              const isOwn = currentUserId && note.userId === currentUserId;
              const isEditing = editingNoteId === note.id;
              return (
                <div
                  key={`note-${note.id}`}
                  style={{
                    position: 'relative',
                    paddingLeft: '2.25rem',
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      left: '6px',
                      top: '2px',
                      width: '16px',
                      height: '16px',
                      borderRadius: '50%',
                      backgroundColor: '#28a745',
                      border: '2px solid white',
                      boxShadow: '0 0 0 1.5px #dee2e6',
                      zIndex: 1,
                    }}
                  />
                  <div
                    style={{
                      padding: '0.5rem 0.75rem',
                      backgroundColor: 'white',
                      border: '1px solid #dee2e6',
                      borderRadius: '6px',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', flex: '1', minWidth: 0 }}>
                        <span style={{ display: 'flex', alignItems: 'center', lineHeight: '1', flexShrink: 0, color: '#28a745' }}>
                          <FiMessageSquare size={16} />
                        </span>
                        <strong style={{ fontSize: '0.875rem', fontWeight: '500' }}>Kommentar</strong>
                        <span style={{ fontSize: '0.75rem', color: '#6c757d' }}>von {getNoteAuthorDisplay(note)}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', flexShrink: 0 }}>
                        <span style={{ fontSize: '0.75rem', color: '#6c757d', whiteSpace: 'nowrap' }}>{formatDate(note.createdAt)}</span>
                        <button
                          type="button"
                          onClick={() => handleCopyNote(note.content)}
                          title="Kopieren"
                          style={{
                            padding: '0.2rem',
                            border: 'none',
                            background: 'transparent',
                            cursor: 'pointer',
                            color: '#6c757d',
                            display: 'flex',
                            alignItems: 'center',
                          }}
                          aria-label="Kommentar kopieren"
                        >
                          <FiCopy size={14} />
                        </button>
                        {isOwn && !isEditing && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleStartEditNote(note)}
                              title="Bearbeiten"
                              style={{
                                padding: '0.2rem',
                                border: 'none',
                                background: 'transparent',
                                cursor: 'pointer',
                                color: '#6c757d',
                                display: 'flex',
                                alignItems: 'center',
                              }}
                              aria-label="Kommentar bearbeiten"
                            >
                              <FiEdit2 size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteNote(note)}
                              disabled={!!deletingNoteId}
                              title="Löschen"
                              style={{
                                padding: '0.2rem',
                                border: 'none',
                                background: 'transparent',
                                cursor: deletingNoteId ? 'not-allowed' : 'pointer',
                                color: '#6c757d',
                                display: 'flex',
                                alignItems: 'center',
                              }}
                              aria-label="Kommentar löschen"
                            >
                              <FiTrash2 size={14} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                    {isEditing ? (
                      <div style={{ marginTop: '0.5rem' }}>
                        <textarea
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          maxLength={MAX_NOTE_LENGTH}
                          rows={3}
                          style={{
                            width: '100%',
                            padding: '0.375rem',
                            fontSize: '0.875rem',
                            border: '1px solid #dee2e6',
                            borderRadius: '4px',
                            resize: 'vertical',
                          }}
                          aria-label="Kommentar bearbeiten"
                        />
                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.375rem' }}>
                          <button
                            type="button"
                            onClick={handleSaveEditNote}
                            disabled={savingNote}
                            style={{
                              padding: '0.25rem 0.5rem',
                              fontSize: '0.75rem',
                              backgroundColor: '#007bff',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: savingNote ? 'not-allowed' : 'pointer',
                            }}
                          >
                            {savingNote ? 'Speichern…' : 'Speichern'}
                          </button>
                          <button
                            type="button"
                            onClick={handleCancelEdit}
                            disabled={savingNote}
                            style={{
                              padding: '0.25rem 0.5rem',
                              fontSize: '0.75rem',
                              backgroundColor: '#6c757d',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: savingNote ? 'not-allowed' : 'pointer',
                            }}
                          >
                            Abbrechen
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div
                        style={{
                          marginTop: '0.375rem',
                          fontSize: '0.875rem',
                          color: '#333',
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                        }}
                      >
                        {note.content}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

