'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { FiBriefcase, FiList, FiLayers, FiMessageSquare, FiInbox, FiMail } from 'react-icons/fi';
import EmailListItem from './EmailListItem';
import EmailContextMenu from './EmailContextMenu';
import EmailListGrouped from './EmailListGrouped';
import { useToast } from '@/components/ToastProvider';
import Card from './Card';
import Button from './Button';

interface Email {
  id: string;
  subject: string;
  from: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  date: string;
  read: boolean;
  completed?: boolean;
  deleted?: boolean;
  spam?: boolean;
  important?: boolean;
  body?: string;
  hasAttachment?: boolean;
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
  type?: 'email' | 'phone_note';
  phoneNumber?: string;
  replyLock?: { userId: string; userName: string };
}

interface TableColumn {
  id: string;
  label: string;
  visible: boolean;
  order: number;
  width?: string | number;
}

export interface EmailListProps {
  emails: Email[];
  loading: boolean;
  loadingMore?: boolean;
  searchQuery: string;
  filter: 'all' | 'read' | 'unread';
  selectedEmails: Set<string>;
  customFilterId?: string | null;
  onSelectAll: () => void;
  onSelectEmail: (emailId: string, e: React.MouseEvent) => void;
  onEmailClick: (emailId: string) => void;
  formatDate: (dateString: string) => string;
  selectedEmailId?: string | null;
  tableColumns?: TableColumn[];
  onColumnsChange?: (columns: TableColumn[]) => void;
  formatDateForTable?: (dateString: string) => string;
  selectedEmail?: Email | null;
  onMarkAsRead?: (read: boolean) => void;
  onMarkAsSpam?: (spam: boolean) => void;
  onMarkAsImportant?: (important: boolean) => void;
  onDelete?: () => void;
  onRestore?: () => void;
  markingRead?: boolean;
  markingSpam?: boolean;
  markingImportant?: boolean;
  onRefresh?: () => void;
  onSearchChange?: (query: string) => void;
  onFilterChange?: (filter: 'all' | 'read' | 'unread') => void;
  onSearchReset?: () => void;
  unreadCount?: number;
  onFetchEmails?: () => void;
  fetching?: boolean;
  searchFields?: string[];
  onSearchFieldsChange?: (fields: string[]) => void | Promise<void>;
  page?: number;
  limit?: number;
  totalPages?: number;
  total?: number;
  hasNext?: boolean;
  hasPrevious?: boolean;
  onPageChange?: (newPage: number) => void;
  /** Optionaler expliziter Nachlade-Handler (wird vom Plan später über handleLoadMore befüllt) */
  onLoadMore?: () => void;
  onEmailHover?: (emailId: string) => void;
  showThreadView?: boolean;
  onShowThreadViewChange?: (value: boolean) => void;
  onAddNote?: (emailId: string) => void;
  /** E-Mail-IDs, auf die aktuell geantwortet wird (mehrere Tabs möglich) – Listeneinträge werden als „Antwort offen“ markiert */
  replyToIds?: string[];
  /** E-Mail-ID, deren Antwort-Tab gerade aktiv ist – wird kräftiger hervorgehoben */
  activeReplyToId?: string | null;
  /** Aktueller User – für Anzeige „In Bearbeitung: XY“ wenn E-Mail von anderem User gesperrt */
  currentUserId?: string | null;
  /** Wenn gesetzt: „Neue E-Mail“ öffnet Tab rechts (ReplyComposer) statt Navigation zu /emails/compose */
  onNewCompose?: (kind: 'email' | 'phone_note') => void;
}

const EmailList: React.FC<EmailListProps> = ({
  emails,
  loading,
  loadingMore = false,
  searchQuery,
  filter,
  selectedEmails,
  customFilterId,
  onSelectAll: _onSelectAll,
  onSelectEmail,
  onEmailClick,
  formatDate,
  formatDateForTable: _formatDateForTable,
  selectedEmailId,
  tableColumns: _tableColumns = [],
  onColumnsChange: _onColumnsChange,
  selectedEmail,
  onMarkAsRead: _onMarkAsRead,
  onMarkAsSpam: _onMarkAsSpam,
  onMarkAsImportant: _onMarkAsImportant,
  onDelete: _onDelete,
  onRestore: _onRestore,
  markingRead: _markingRead = false,
  markingSpam: _markingSpam = false,
  markingImportant: _markingImportant = false,
  onRefresh,
  onSearchChange: _onSearchChange,
  onFilterChange: _onFilterChange,
  onSearchReset: _onSearchReset,
  unreadCount: _unreadCount,
  onFetchEmails: _onFetchEmails,
  fetching: _fetching,
  searchFields: _searchFields,
  onSearchFieldsChange: _onSearchFieldsChange,
  page = 0,
  limit: _limit = 100,
  totalPages = 0,
  total = 0,
  hasNext = false,
  hasPrevious = false,
  onPageChange,
  onEmailHover,
  showThreadView = false,
  onShowThreadViewChange,
  onAddNote: _onAddNote,
  replyToIds = [],
  activeReplyToId,
  currentUserId,
  onNewCompose,
  onLoadMore,
}: EmailListProps) => {
  const toast = useToast();
  const [contextMenu, setContextMenu] = useState<{ emailId: string; x: number; y: number } | null>(null);
  const [showDepartmentModal, setShowDepartmentModal] = useState(false);
  const [departments, setDepartments] = useState<any[]>([]);
  const [emailDepartments, setEmailDepartments] = useState<string[]>([]);
  const [loadingDepartments, setLoadingDepartments] = useState(false);
  const [savingDepartments, setSavingDepartments] = useState(false);
  const [viewMode, setViewMode] = useState<'normal' | 'grouped'>('normal');

  const toggleThreadView = () => {
    onShowThreadViewChange?.(!showThreadView);
  };

  // Lade Abteilungen beim Öffnen des Modals
  useEffect(() => {
    if (showDepartmentModal && selectedEmail) {
      loadDepartments();
      loadEmailDepartments();
    }
  }, [showDepartmentModal, selectedEmail]);

  const loadDepartments = async () => {
    try {
      setLoadingDepartments(true);
      const token = localStorage.getItem('mailclient_token');
      if (!token) return;

      const response = await fetch('/api/departments', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setDepartments(data.departments || []);
      }
    } catch (err) {
      console.error('Fehler beim Laden der Abteilungen:', err);
    } finally {
      setLoadingDepartments(false);
    }
  };

  const loadEmailDepartments = async () => {
    if (!selectedEmail) return;
    
    try {
      const token = localStorage.getItem('mailclient_token');
      if (!token) return;

      const response = await fetch(`/api/emails/${selectedEmail.id}/departments`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setEmailDepartments(data.departments?.map((d: any) => d.id) || []);
      }
    } catch (err) {
      console.error('Fehler beim Laden der E-Mail-Abteilungen:', err);
    }
  };

  const handleSaveDepartments = async () => {
    if (!selectedEmail) return;

    try {
      setSavingDepartments(true);
      const token = localStorage.getItem('mailclient_token');
      if (!token) return;

      const response = await fetch(`/api/emails/${selectedEmail.id}/departments`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          departmentIds: emailDepartments,
        }),
      });

      if (response.ok) {
        setShowDepartmentModal(false);
        if (onRefresh) {
          onRefresh();
        }
      } else {
        const data = await response.json();
        toast.showError(data.error || 'Fehler beim Speichern der Abteilungen');
      }
    } catch (err) {
      console.error('Fehler beim Speichern der Abteilungen:', err);
      toast.showError('Fehler beim Speichern der Abteilungen');
    } finally {
      setSavingDepartments(false);
    }
  };


  const handleContextMenu = useCallback((emailId: string, x: number, y: number) => {
    setContextMenu({ emailId, x, y });
  }, []);

  // Aktiver Eintrag in der Liste = aktuell sichtbarer Tab (Vorschau → selectedEmailId, Antwort-Tab → activeReplyToId)
  const listActiveId = activeReplyToId ?? selectedEmailId ?? null;

  // Bei schmaler Listenbreite nur Symbole, keine Button-Texte
  const listContainerRef = useRef<HTMLDivElement>(null);
  const [showButtonLabels, setShowButtonLabels] = useState(true);
  const BUTTON_LABELS_MIN_WIDTH = 360;
  useEffect(() => {
    const el = listContainerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect?.width ?? 0;
      setShowButtonLabels(w >= BUTTON_LABELS_MIN_WIDTH);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [loading, emails.length]);

  if (loading) {
    return (
      <div className="h-full flex flex-col bg-white">
        <div className="flex flex-col items-center justify-center p-8">
          <div className="spinner" style={{ margin: '0 auto' }}></div>
          <p className="mt-4 text-[#6B7280]">Lade E-Mails...</p>
        </div>
      </div>
    );
  }

  return (
    <div ref={listContainerRef} className="h-full flex flex-col bg-white">
      {/* Leerer Zustand - nur anzeigen wenn keine E-Mails und nicht beim Laden */}
      {emails.length === 0 && !loading ? (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="flex flex-col items-center justify-center text-center">
            <FiInbox size={56} className="mb-4 text-[#9CA3AF]" style={{ display: 'block', marginLeft: 'auto', marginRight: 'auto' }} />
            <div className="text-xl font-semibold text-[#1F2937] mb-2">Keine E-Mails gefunden</div>
            <div className="text-[#6B7280] mb-6">
              {searchQuery || filter !== 'all'
                ? 'Versuchen Sie, Ihre Suchkriterien zu ändern.'
                : 'Ihr Posteingang ist leer. Schreiben Sie Ihre erste E-Mail!'}
            </div>
            {!searchQuery && filter === 'all' && (
              onNewCompose ? (
                <Button
                  variant="primary"
                  className="mt-6 flex items-center gap-2 justify-center"
                  onClick={() => onNewCompose('email')}
                >
                  <FiMail size={18} />
                  Neue E-Mail schreiben
                </Button>
              ) : (
                <Link href={customFilterId ? `/emails?filterId=${customFilterId}` : "/emails"}>
                  <Button variant="primary" className="mt-6 flex items-center gap-2 justify-center">
                    <FiMail size={18} />
                    Neue E-Mail schreiben
                  </Button>
                </Link>
              )
            )}
          </div>
        </div>
      ) : (
        <>
          {/* View Mode Toggle + Thread-View Toggle */}
          <div style={{ padding: '0.5rem 1rem', borderBottom: '1px solid #e9ecef', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', alignItems: 'center' }}>
            {/* View Mode Buttons */}
            <button
              onClick={() => setViewMode('normal')}
              style={{
                padding: showButtonLabels ? '0.25rem 0.75rem' : '0.25rem 0.5rem',
                border: '1px solid #e9ecef',
                borderRadius: '4px',
                backgroundColor: viewMode === 'normal' ? '#007bff' : '#ffffff',
                color: viewMode === 'normal' ? '#ffffff' : '#6c757d',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem',
                fontSize: '0.875rem',
                transition: 'all 0.15s',
              }}
              title="Normale Listenansicht"
            >
              <FiList size={14} />
              {showButtonLabels && <span>Liste</span>}
            </button>
            <button
              onClick={() => setViewMode('grouped')}
              style={{
                padding: showButtonLabels ? '0.25rem 0.75rem' : '0.25rem 0.5rem',
                border: '1px solid #e9ecef',
                borderRadius: '4px',
                backgroundColor: viewMode === 'grouped' ? '#007bff' : '#ffffff',
                color: viewMode === 'grouped' ? '#ffffff' : '#6c757d',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem',
                fontSize: '0.875rem',
                transition: 'all 0.15s',
              }}
              title="Gruppierte Konversationsansicht"
            >
              <FiLayers size={14} />
              {showButtonLabels && <span>Konversationen</span>}
            </button>
            
            {/* Separator */}
            <div style={{ width: '1px', height: '24px', backgroundColor: '#dee2e6', margin: '0 0.25rem' }} />
            
            {/* Thread-View Toggle Button */}
            <button
              onClick={toggleThreadView}
              style={{
                padding: showButtonLabels ? '0.25rem 0.75rem' : '0.25rem 0.5rem',
                border: showThreadView ? '2px solid #28a745' : '1px solid #e9ecef',
                borderRadius: '4px',
                backgroundColor: showThreadView ? '#d4edda' : '#ffffff',
                color: showThreadView ? '#155724' : '#6c757d',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.375rem',
                fontSize: '0.875rem',
                fontWeight: showThreadView ? '600' : '400',
                transition: 'all 0.2s',
              }}
              title={showThreadView ? 'Thread-Ansicht deaktivieren' : 'Thread-Ansicht aktivieren'}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = showThreadView ? '#c3e6cb' : '#f8f9fa';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = showThreadView ? '#d4edda' : '#ffffff';
              }}
            >
              <FiMessageSquare size={14} />
              {showButtonLabels && <span>{showThreadView ? 'Thread AN' : 'Thread AUS'}</span>}
            </button>
          </div>

          {/* E-Mail-Liste */}
          <div
            className="flex-1 overflow-y-auto bg-white"
            style={{
              minHeight: 0,
            }}
          >
            {emails.length === 0 ? (
              <div className="text-center py-8 text-[#6B7280]">
                {loading ? 'Lade E-Mails...' : 'Keine E-Mails gefunden'}
              </div>
            ) : viewMode === 'grouped' ? (
              <EmailListGrouped
                emails={emails}
                selectedEmailId={selectedEmailId || null}
                activeReplyToId={activeReplyToId}
                onEmailClick={(email) => onEmailClick(email.id)}
                formatDate={formatDate}
                onContextMenu={handleContextMenu}
                replyToIds={replyToIds}
                currentUserId={currentUserId}
              />
            ) : (
              <>
                {emails.map((email, index) => (
                  <EmailListItem
                    key={email.id}
                    email={email}
                    isSelected={selectedEmails.has(email.id)}
                    onSelect={onSelectEmail}
                    onClick={onEmailClick}
                    formatDate={formatDate}
                    isActive={listActiveId !== null && email.id === listActiveId}
                    index={index}
                    onEmailHover={onEmailHover}
                    onContextMenu={handleContextMenu}
                    replyToIds={replyToIds}
                    activeReplyToId={activeReplyToId}
                    currentUserId={currentUserId}
                  />
                ))}
              </>
            )}
          </div>

          {loadingMore && hasNext && (
            <div className="py-3 text-center text-sm text-gray-500">
              Weitere Elemente werden geladen...
            </div>
          )}

          {hasNext && !loadingMore && (
            <div className="py-3 text-center">
              <Button
                variant="secondary"
                onClick={onLoadMore}
                disabled={!onLoadMore}
              >
                Weitere E-Mails laden
              </Button>
            </div>
          )}

          {!hasNext && total > 0 && (
            <div className="py-3 text-center text-xs text-gray-400">
              Alle Elemente geladen.
            </div>
          )}
        </>
      )}

      {contextMenu && (
        <EmailContextMenu
          emailId={contextMenu.emailId}
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          onRefresh={onRefresh}
        />
      )}

      {/* Abteilungs-Modal */}
      {showDepartmentModal && selectedEmail && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setShowDepartmentModal(false)}
        >
          <Card
            className="max-w-[500px] w-[90%] max-h-[80vh] overflow-auto"
            onClick={(e) => e?.stopPropagation()}
          >
            <h3 className="mt-0 mb-4">
              Abteilungen zuweisen
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              E-Mail: {selectedEmail.subject || '(Kein Betreff)'}
            </p>

            {loadingDepartments ? (
              <div style={{ textAlign: 'center', padding: '2rem' }}>
                <div className="spinner" style={{ margin: '0 auto' }}></div>
                <p style={{ marginTop: '1rem', color: '#6c757d' }}>Lade Abteilungen...</p>
              </div>
            ) : departments.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#6c757d' }}>
                Keine Abteilungen vorhanden
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
                {departments.map((department) => {
                  const isChecked = emailDepartments.includes(department.id);
                  return (
                    <label
                      key={department.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        cursor: 'pointer',
                        padding: '0.75rem',
                        backgroundColor: isChecked ? '#f0f7ff' : '#f8f9fa',
                        borderRadius: '4px',
                        border: `1px solid ${isChecked ? '#007bff' : '#e9ecef'}`,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setEmailDepartments([...emailDepartments, department.id]);
                          } else {
                            setEmailDepartments(emailDepartments.filter(id => id !== department.id));
                          }
                        }}
                        style={{ cursor: 'pointer', width: '18px', height: '18px' }}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: isChecked ? '600' : '400', color: isChecked ? '#007bff' : '#333' }}>
                          <FiBriefcase size={14} className="inline mr-1" />
                          {department.name}
                        </div>
                        {department.description && (
                          <div style={{ fontSize: '0.875rem', color: '#6c757d', marginTop: '0.25rem' }}>
                            {department.description}
                          </div>
                        )}
                      </div>
                    </label>
                  );
                })}
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <Button
                onClick={() => setShowDepartmentModal(false)}
                variant="secondary"
                disabled={savingDepartments}
              >
                Abbrechen
              </Button>
              <Button
                onClick={handleSaveDepartments}
                variant="primary"
                disabled={savingDepartments || loadingDepartments}
              >
                {savingDepartments ? (
                  <>
                    <div className="spinner" style={{ width: '14px', height: '14px', borderWidth: '2px' }}></div>
                    <span>Speichern...</span>
                  </>
                ) : (
                  'Speichern'
                )}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default EmailList;

