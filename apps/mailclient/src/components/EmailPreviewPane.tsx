'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { FiMessageSquare, FiClock, FiMail, FiX, FiPhone, FiSearch } from 'react-icons/fi';
import EmailPreview from './EmailPreview';
import EmailTimeline from './EmailTimeline';
import EmailNotesSection from './EmailNotesSection';
import ReplyComposer from './reply/ReplyComposer';
import type { EmailNoteFromApi } from './EmailTimeline';

interface Email {
  id: string;
  subject: string;
  from: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  body?: string;
  date: string;
  read: boolean;
  deleted?: boolean;
  spam?: boolean;
  important?: boolean;
  hasAttachment?: boolean;
  type?: 'email' | 'phone_note';
  phoneNumber?: string;
  hasNotes?: boolean;
}

interface EmailPreviewPaneProps {
  email: Email | null;
  loading: boolean;
  onMarkAsRead: (read: boolean) => void;
  markingRead: boolean;
  formatDate: (dateString: string) => string;
  onDelete?: () => void;
  timelineHeight?: number;
  isTimelineCollapsed?: boolean;
  onToggleTimeline?: () => void;
  onTimelineResizeStart?: (e: React.MouseEvent) => void;
  showThreadView?: boolean;
  focusNotesOnMount?: boolean;
  /** Wird nach Hinzufügen/Löschen eines Kommentars aufgerufen, damit die Mailliste (Kommentar-Symbol) aktualisiert wird */
  onRefreshEmailList?: () => void;
  /** Reply-Tab-UI: aktivierter Tab – 'preview' oder Tab-id (string) */
  activeTab?: 'preview' | string;
  /** Mehrere Reply-Tabs: wenn nicht leer, Tab-Leiste (Vorschau + pro Tab ein Tab) anzeigen */
  replyContexts?: Array<{ id: string; kind: 'email' | 'phone_note'; replyToId?: string; replyType?: 'email' | 'phone_note' }>;
  /** Betreff pro Tab (für neue E-Mail/Telefonnotiz) – wird im Tab-Label angezeigt, Platz-abhängig gekürzt */
  tabSubjects?: Record<string, string>;
  /** Betreff der geantworteten E-Mail pro Antwort-Tab – für Tab-Label "Antwort: <Betreff>" */
  tabReplyToSubjects?: Record<string, string>;
  onTabSubjectChange?: (tabId: string, subject: string) => void;
  onTabReplyToSubject?: (tabId: string, subject: string) => void;
  onTabChange?: (tab: 'preview' | string) => void;
  /** Beim Schließen nach Senden skipDirtyCheck=true übergeben, damit kein "Entwurf verwerfen?" erscheint */
  onCloseReply?: (tabId: string, skipDirtyCheck?: boolean) => void;
  onDraftDirtyChange?: (tabId: string, dirty: boolean) => void;
  onEmailClick?: (emailId: string) => void;
  onRefresh?: () => void;
  /** Öffnet einen Antwort-Tab für die angegebene E-Mail (z. B. aus Thread-Ansicht) */
  onReplyToEmail?: (emailId: string) => void;
  /** Aktueller User – für Thread-Ansicht (Badge „In Bearbeitung“, Antworten-Button) */
  currentUserId?: string | null;
}

function EmailPreviewPane({
  email,
  loading,
  onMarkAsRead,
  markingRead,
  formatDate,
  onDelete,
  timelineHeight = 300,
  isTimelineCollapsed = false,
  onToggleTimeline,
  onTimelineResizeStart,
  showThreadView = false,
  focusNotesOnMount = false,
  onRefreshEmailList,
  activeTab = 'preview',
  replyContexts = [],
  tabSubjects = {},
  tabReplyToSubjects = {},
  onTabSubjectChange,
  onTabReplyToSubject,
  onTabChange,
  onCloseReply,
  onDraftDirtyChange,
  onEmailClick,
  onRefresh,
  onReplyToEmail,
  currentUserId,
}: EmailPreviewPaneProps) {
  const router = useRouter();
  const [notes, setNotes] = useState<EmailNoteFromApi[]>([]);
  const [_notesLoading, setNotesLoading] = useState(false);
  const [isNotesCollapsed, setIsNotesCollapsed] = useState(true);

  // Bei E-Mail-Wechsel: Kommentar-Bereich öffnen wenn E-Mail Kommentare hat, sonst eingeklappt lassen
  useEffect(() => {
    if (email?.hasNotes === true) {
      setIsNotesCollapsed(false);
    } else {
      setIsNotesCollapsed(true);
    }
  }, [email?.id, email?.hasNotes]);

  // Fokus auf Kommentare (z. B. Kontextmenü "Kommentar hinzufügen") → Bereich öffnen
  useEffect(() => {
    if (focusNotesOnMount) {
      setIsNotesCollapsed(false);
    }
  }, [focusNotesOnMount]);

  // Wenn Kommentare nachgeladen werden und es welche gibt, Bereich öffnen (z. B. nach Hinzufügen des ersten Kommentars)
  useEffect(() => {
    if (notes.length > 0) {
      setIsNotesCollapsed(false);
    }
  }, [notes.length]);

  const handleToggleNotes = useCallback(() => {
    setIsNotesCollapsed((prev) => !prev);
  }, []);

  const loadNotes = useCallback(async () => {
    if (!email?.id) {
      setNotes([]);
      return;
    }
    try {
      setNotesLoading(true);
      const token = localStorage.getItem('mailclient_token');
      const res = await fetch(`/api/emails/${email.id}/notes?sort=desc&limit=100`, {
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
      } else {
        setNotes([]);
      }
    } catch (err) {
      console.error('Fehler beim Laden der Kommentare:', err);
      setNotes([]);
    } finally {
      setNotesLoading(false);
    }
  }, [email?.id, router]);

  useEffect(() => {
    if (email?.id) {
      loadNotes();
    } else {
      setNotes([]);
    }
  }, [email?.id, loadNotes]);

  const renderPreviewContent = () => !email ? null : (
    <>
      {/* E-Mail-Vorschau */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <EmailPreview
          email={email}
          loading={loading}
          onMarkAsRead={onMarkAsRead}
          markingRead={markingRead}
          formatDate={formatDate}
          onDelete={onDelete}
          showThreadView={showThreadView}
          onReplyToEmail={onReplyToEmail}
          currentUserId={currentUserId}
        />
      </div>

      {/* Kommentar-Bereich: bei Thread-Ansicht komplett ausblenden (nicht nur einklappen) */}
      {!showThreadView && (
        <>
          <div
            onClick={handleToggleNotes}
            className="border-t border-[#E5E7EB] bg-[#F9FAFB] px-4 py-2 flex items-center justify-between cursor-pointer hover:bg-[#F3F4F6] transition-colors"
            style={{ minHeight: '40px' }}
          >
            <span className="text-sm font-medium text-[#1F2937] flex items-center gap-2">
              <FiMessageSquare size={16} className="text-[#28a745]" />
              Kommentare
              {notes.length > 0 && (
                <span className="text-xs text-[#6B7280] font-normal">({notes.length})</span>
              )}
            </span>
            <span className="text-[#6B7280] text-lg">
              {isNotesCollapsed ? '▼' : '▲'}
            </span>
          </div>
          {!isNotesCollapsed && (
            <div style={{ flexShrink: 0, minHeight: 0 }}>
              <EmailNotesSection
                emailId={email.id}
                notes={notes}
                onNotesChange={loadNotes}
                focusNotesOnMount={focusNotesOnMount}
                onNoteAdded={onRefreshEmailList}
              />
            </div>
          )}
        </>
      )}

      {/* Timeline Toggle-Button */}
      {onToggleTimeline && (
        <div
          onClick={onToggleTimeline}
          className="border-t border-[#E5E7EB] bg-[#F9FAFB] px-4 py-2 flex items-center justify-between cursor-pointer hover:bg-[#F3F4F6] transition-colors"
          style={{ minHeight: '40px' }}
        >
          <span className="text-sm font-medium text-[#1F2937] flex items-center gap-2">
            <FiClock size={16} className="text-[#6B7280]" />
            Timeline
          </span>
          <span className="text-[#6B7280] text-lg">
            {isTimelineCollapsed ? '▼' : '▲'}
          </span>
        </div>
      )}
      
      {/* Timeline unter der Vorschau */}
      {!isTimelineCollapsed && (
        <>
          {/* Resize-Handle für Timeline */}
          {onTimelineResizeStart && (
            <div
              onMouseDown={onTimelineResizeStart}
              style={{
                height: '4px',
                backgroundColor: '#E5E7EB',
                cursor: 'row-resize',
                flexShrink: 0,
                zIndex: 10,
              }}
            />
          )}
          
          <div 
            className="border-t border-[#E5E7EB] flex-shrink-0 overflow-hidden bg-[#F9FAFB]"
            style={{ height: `${timelineHeight}px`, minHeight: timelineHeight > 0 ? '200px' : '0' }}
          >
            <EmailTimeline
              emailId={email.id}
              notes={notes}
              onNotesChange={loadNotes}
            />
          </div>
        </>
      )}
    </>
  );

  const noEmailPlaceholder = (
    <div className="w-full h-full border-l border-[#E5E7EB] flex flex-col items-center justify-center text-[#6B7280] bg-[#FAFAFA]">
      <FiMail size={60} className="mb-5 text-[#CBD5E1]" style={{ display: 'block', marginLeft: 'auto', marginRight: 'auto' }} />
      <h3 className="text-lg font-semibold mb-2">Keine E-Mail ausgewählt</h3>
      <p className="text-sm text-center px-8">
        Wählen Sie eine E-Mail aus der Liste aus, um die Vorschau anzuzeigen.
      </p>
    </div>
  );

  // Tab-UI wenn mindestens ein Reply-Tab offen
  if (replyContexts.length > 0) {
    return (
      <div className="w-full h-full border-l border-[#E5E7EB] flex flex-col bg-white overflow-hidden">
        <div className="flex border-b border-[#E5E7EB] bg-[#F9FAFB] shrink-0 overflow-x-auto">
          <div
            role="tab"
            aria-selected={activeTab === 'preview'}
            className={`flex items-center gap-1 px-2 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px flex-shrink-0 ${
              activeTab === 'preview'
                ? 'text-[#2563EB] border-[#2563EB] bg-white'
                : 'text-[#6B7280] hover:text-[#1F2937] border-transparent'
            }`}
          >
            <span className="flex-shrink-0 mt-0.5 opacity-80" aria-hidden style={{ color: 'inherit' }}>
              <FiSearch size={14} />
            </span>
            <button type="button" onClick={() => onTabChange?.('preview')} className="py-0.5">
              Vorschau
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); }}
              className="p-0.5 rounded hover:bg-[#E5E7EB] opacity-0 cursor-default pointer-events-none"
              aria-hidden
            >
              <FiX size={14} />
            </button>
          </div>
          {replyContexts.map((rc) => {
            const defaultNewLabel = rc.kind === 'phone_note' ? 'Neue Telefonnotiz' : 'Neue E-Mail';
            const subjectTrimmed = tabSubjects[rc.id]?.trim();
            const replyToSubjectTrimmed = tabReplyToSubjects[rc.id]?.trim();
            const tabLabel = rc.replyToId
              ? (replyToSubjectTrimmed ? `Antwort: ${replyToSubjectTrimmed}` : `Antwort: ${rc.replyToId.slice(0, 8)}…`)
              : subjectTrimmed || defaultNewLabel;
            const tabTitle = rc.replyToId ? (replyToSubjectTrimmed ? `Antwort: ${replyToSubjectTrimmed}` : tabLabel) : (subjectTrimmed ? subjectTrimmed : defaultNewLabel);
            return (
            <div
              key={rc.id}
              role="tab"
              aria-selected={activeTab === rc.id}
              className={`flex items-center gap-1 px-2 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px flex-shrink-0 min-w-0 max-w-[180px] ${
                activeTab === rc.id
                  ? 'text-[#2563EB] border-[#2563EB] bg-white'
                  : 'text-[#6B7280] hover:text-[#1F2937] border-transparent'
              }`}
            >
              <span className="flex-shrink-0 mt-0.5 opacity-80" aria-hidden style={{ color: 'inherit' }}>
                {rc.kind === 'phone_note' ? <FiPhone size={14} /> : <FiMail size={14} />}
              </span>
              <button type="button" onClick={() => onTabChange?.(rc.id)} className="py-0.5 truncate min-w-0 flex-1 text-left" title={tabTitle}>
                <span className="block truncate">{tabLabel}</span>
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onCloseReply?.(rc.id); }}
                className="p-0.5 rounded hover:bg-[#E5E7EB] flex-shrink-0"
                aria-label="Tab schließen"
              >
                <FiX size={14} />
              </button>
            </div>
          );
          })}
        </div>
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden" role="tabpanel">
          {/* Vorschau-Panel: nur sichtbar wenn Vorschau-Tab aktiv; scrollbarer Bereich */}
          <div
            style={{ display: activeTab === 'preview' ? 'flex' : 'none' }}
            className="w-full h-full min-h-0 flex flex-col overflow-hidden"
          >
            {email ? (
              <div className="flex-1 min-h-0 overflow-y-auto flex flex-col">
                {renderPreviewContent()}
              </div>
            ) : (
              noEmailPlaceholder
            )}
          </div>
          {/* Pro Antwort-Tab ein eigenes Panel – alle bleiben gemountet, damit Entwürfe beim Tab-Wechsel erhalten bleiben */}
          {replyContexts.map((rc) => (
            <div
              key={rc.id}
              style={{ display: activeTab === rc.id ? 'flex' : 'none' }}
              className="w-full h-full min-h-0 flex flex-col overflow-hidden"
            >
              <div className="flex items-center justify-between gap-2 px-2 py-2 bg-[#F3F4F6] border-b border-[#E5E7EB] shrink-0">
                <span className="text-sm text-[#374151]">
                  {rc.replyToId ? `Antwort auf: E-Mail ${rc.replyToId}` : rc.kind === 'phone_note' ? 'Neue Telefonnotiz' : 'Neue E-Mail'}
                </span>
                <div className="flex gap-2">
                  {rc.replyToId && (
                    <button
                      type="button"
                      onClick={() => {
                        onEmailClick?.(rc.replyToId!);
                        onTabChange?.('preview');
                      }}
                      className="text-sm font-medium text-[#2563EB] hover:underline"
                    >
                      Zur Mail springen
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onCloseReply?.(rc.id)}
                    className="text-sm font-medium text-[#374151] hover:underline"
                  >
                    {rc.replyToId ? 'Antwort schließen' : 'Schließen'}
                  </button>
                </div>
              </div>
              <div className="flex-1 min-h-0 overflow-auto p-4 bg-[#FAFAFA]">
                <ReplyComposer
                  replyContext={rc}
                  onSent={() => onCloseReply?.(rc.id, true)}
                  onCloseReply={() => onCloseReply?.(rc.id)}
                  onDraftDirtyChange={(dirty) => onDraftDirtyChange?.(rc.id, dirty)}
                  onSubjectChange={!rc.replyToId ? (subject) => onTabSubjectChange?.(rc.id, subject) : undefined}
                  onReplyToSubjectLoaded={rc.replyToId ? (subject) => onTabReplyToSubject?.(rc.id, subject) : undefined}
                  onRefresh={onRefresh ?? (() => {})}
                  focusOnMount={true}
                  isReplyTabActive={activeTab === rc.id}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!email) {
    return noEmailPlaceholder;
  }

  return (
    <div className="w-full h-full border-l border-[#E5E7EB] flex flex-col bg-white overflow-hidden">
      {renderPreviewContent()}
    </div>
  );
}

// Memoize EmailPreviewPane für bessere Performance
const EmailPreviewPaneMemo = React.memo(EmailPreviewPane, (prevProps, nextProps) => {
  // Nur neu rendern, wenn sich wichtige Props ändern
  // Gibt true zurück, wenn KEIN Re-Render nötig ist (Props sind gleich)
  const sameReplyContexts =
    (prevProps.replyContexts?.length ?? 0) === (nextProps.replyContexts?.length ?? 0) &&
    (prevProps.replyContexts ?? []).every(
      (rc, i) =>
        nextProps.replyContexts?.[i]?.id === rc.id &&
        nextProps.replyContexts?.[i]?.replyToId === rc.replyToId &&
        nextProps.replyContexts?.[i]?.kind === rc.kind
    );
  const sameTabSubjects =
    Object.keys(prevProps.tabSubjects ?? {}).length === Object.keys(nextProps.tabSubjects ?? {}).length &&
    (Object.keys(prevProps.tabSubjects ?? {}) as string[]).every(
      (id) => (prevProps.tabSubjects ?? {})[id] === (nextProps.tabSubjects ?? {})[id]
    );
  const sameTabReplyToSubjects =
    Object.keys(prevProps.tabReplyToSubjects ?? {}).length === Object.keys(nextProps.tabReplyToSubjects ?? {}).length &&
    (Object.keys(prevProps.tabReplyToSubjects ?? {}) as string[]).every(
      (id) => (prevProps.tabReplyToSubjects ?? {})[id] === (nextProps.tabReplyToSubjects ?? {})[id]
    );
  return (
    prevProps.email?.id === nextProps.email?.id &&
    prevProps.loading === nextProps.loading &&
    prevProps.markingRead === nextProps.markingRead &&
    prevProps.isTimelineCollapsed === nextProps.isTimelineCollapsed &&
    prevProps.timelineHeight === nextProps.timelineHeight &&
    prevProps.showThreadView === nextProps.showThreadView &&
    prevProps.focusNotesOnMount === nextProps.focusNotesOnMount &&
    prevProps.onRefreshEmailList === nextProps.onRefreshEmailList &&
    prevProps.activeTab === nextProps.activeTab &&
    prevProps.onReplyToEmail === nextProps.onReplyToEmail &&
    prevProps.currentUserId === nextProps.currentUserId &&
    sameReplyContexts &&
    sameTabSubjects &&
    sameTabReplyToSubjects
  );
});

export default EmailPreviewPaneMemo;

