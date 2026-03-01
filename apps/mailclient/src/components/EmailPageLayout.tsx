'use client';

import { useRef, useCallback, useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { SidebarErrorBoundary } from '@/components/SidebarErrorBoundary';
import EmailList from '@/components/EmailList';
import EmailPreviewPane from '@/components/EmailPreviewPane';
import EmailToolbar from '@/components/EmailToolbar';
import { useToast } from '@/components/ToastProvider';
import { useConfirm } from '@/components/ConfirmDialog';
import { Email } from '@/hooks/useEmailState';

export type ReplyContext = {
  kind: 'email' | 'phone_note';
  /** Fehlt = neue E-Mail/Telefonnotiz; gesetzt = Antwort auf diese E-Mail */
  replyToId?: string;
  replyType?: 'email' | 'phone_note';
};

/** Reply- oder Neu-Compose-Tab mit eindeutiger id */
export type ReplyTab = ReplyContext & { id: string };

interface EmailPageLayoutProps {
  // States (von useEmailState)
  emails: Email[];
  loading: boolean;
  error: string;
  searchQuery: string;
  filter: 'all' | 'read' | 'unread' | 'completed' | 'not_completed';
  selectedEmails: Set<string>;
  selectedEmailId: string | null;
  selectedEmailDetails: Email | null;
  loadingEmailDetails: boolean;
  markingRead: boolean;
  markingCompleted: boolean;
  markingSpam: boolean;
  markingImportant: boolean;
  fetching: boolean;
  fetchMessage: { type: 'success' | 'error'; text: string } | null;
  page: number;
  limit: number;
  totalPages: number;
  total: number;
  hasNext: boolean;
  hasPrevious: boolean;
  searchFields: string[];
  tableColumns: any[];
  unreadCount: number;
  customFilterId: string | null;
  
  // Handlers (von useEmailState)
  onSearchQueryChange: (query: string) => void;
  onFilterChange: (filter: 'all' | 'read' | 'unread' | 'completed' | 'not_completed') => void;
  onEmailClick: (emailId: string) => void;
  onSelectAll: () => void;
  onSelectEmail: (emailId: string, e: React.MouseEvent) => void;
  onToolbarMarkAsRead: (read: boolean) => void;
  onToolbarMarkAsCompleted: (completed: boolean) => void;
  onToolbarMarkAsSpam: (spam: boolean) => void;
  onToolbarMarkAsImportant: (important: boolean) => void;
  onToolbarDelete: () => void;
  onRestoreEmail: () => void;
  onFetchEmails: () => void;
  onRefresh: () => void;
  onDepartmentChange: () => void;
  onPageChange: (newPage: number) => void;
  onSearchFieldsChange: (fields: string[]) => void;
  onSearchReset: () => void;
  onMarkAsRead: (read: boolean) => void;
  onDeleteEmail: () => void;
  formatDate: (dateString: string) => string;
  formatDateForTable: (dateString: string) => string;
  formatDateForPreview: (dateString: string) => string;
  onEmailHover?: (emailId: string) => void;
  focusNotesOnMount?: boolean;
  onAddNote?: (emailId: string) => void;
  
  // Resize (von useEmailResize)
  listWidth: number;
  timelineHeight: number;
  isTimelineCollapsed: boolean;
  isResizing: 'horizontal' | 'vertical' | null;
  onHorizontalResizeStart: (e: React.MouseEvent) => void;
  onVerticalResizeStart: (e: React.MouseEvent) => void;
  onResizeMove: (e: MouseEvent, containerElement?: HTMLElement) => void;
  onResizeEnd: () => void;
  onResizeLeave: () => void;
  onToggleTimeline: () => void;
  showThreadView: boolean;
  onShowThreadViewChange: (value: boolean) => void;
}

export default function EmailPageLayout({
  emails,
  loading,
  error,
  searchQuery,
  filter,
  selectedEmails,
  selectedEmailId,
  selectedEmailDetails,
  loadingEmailDetails,
  markingRead,
  markingCompleted,
  markingSpam,
  markingImportant,
  fetching,
  fetchMessage,
  page,
  limit,
  totalPages,
  total,
  hasNext,
  hasPrevious,
  searchFields,
  tableColumns,
  unreadCount,
  customFilterId,
  onSearchQueryChange,
  onFilterChange,
  onEmailClick,
  onSelectAll,
  onSelectEmail,
  onToolbarMarkAsRead,
  onToolbarMarkAsCompleted,
  onToolbarMarkAsSpam,
  onToolbarMarkAsImportant,
  onToolbarDelete,
  onRestoreEmail,
  onFetchEmails,
  onRefresh,
  onDepartmentChange,
  onPageChange,
  onSearchFieldsChange,
  onSearchReset,
  onMarkAsRead,
  onDeleteEmail,
  formatDate,
  formatDateForTable,
  formatDateForPreview,
  onEmailHover,
  focusNotesOnMount,
  onAddNote,
  listWidth,
  timelineHeight,
  isTimelineCollapsed,
  isResizing,
  onHorizontalResizeStart,
  onVerticalResizeStart,
  onResizeMove,
  onResizeEnd,
  onResizeLeave,
  onToggleTimeline,
  showThreadView,
  onShowThreadViewChange,
}: EmailPageLayoutProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const toast = useToast();
  const { confirm } = useConfirm();
  const pathname = usePathname();
  const replyContextsRef = useRef<ReplyTab[]>([]);

  const [activeRightPane, setActiveRightPane] = useState<'preview' | string>('preview');
  const [replyContexts, setReplyContexts] = useState<ReplyTab[]>([]);
  const prevReplyContextsLengthRef = useRef(0);
  const [replyDraftDirty, setReplyDraftDirty] = useState<Record<string, boolean>>({});
  /** Betreff pro Tab (nur neue E-Mail/Telefonnotiz), für Tab-Label – wird vom ReplyComposer aktualisiert */
  const [tabSubjects, setTabSubjects] = useState<Record<string, string>>({});
  /** Betreff der geantworteten E-Mail pro Antwort-Tab – für Tab-Label "Antwort: <Betreff>" */
  const [tabReplyToSubjects, setTabReplyToSubjects] = useState<Record<string, string>>({});

  replyContextsRef.current = replyContexts;

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem('mailclient_user');
      if (raw) setCurrentUserId((JSON.parse(raw) as { id?: string }).id ?? null);
    } catch {
      setCurrentUserId(null);
    }
  }, []);

  const releaseReplyLock = useCallback(async (emailId: string) => {
    if (typeof window === 'undefined') return;
    const token = localStorage.getItem('mailclient_token');
    if (!token) return;
    try {
      await fetch(`/api/emails/${emailId}/reply-lock`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {
      // still release state; lock may already be expired
    }
  }, []);

  const handleStartReply = useCallback(async (context: ReplyContext) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('mailclient_token') : null;
    if (!token) {
      toast.showError('Nicht angemeldet');
      return;
    }
    if (context.replyToId) {
      // Bereits ein Antwort-Tab für diese E-Mail offen? Dann nur zu diesem Tab wechseln, keinen zweiten öffnen.
      const existingTab = replyContexts.find((rc) => rc.replyToId === context.replyToId);
      if (existingTab) {
        setActiveRightPane(existingTab.id);
        return;
      }
      try {
        const res = await fetch(`/api/emails/${context.replyToId}/reply-lock`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.status === 409) {
          toast.showWarning('Diese E-Mail wird bereits von einem anderen Benutzer beantwortet.');
          return;
        }
        if (!res.ok) {
          toast.showError('Sperre konnte nicht gesetzt werden');
          return;
        }
      } catch {
        toast.showError('Fehler beim Setzen der Sperre');
        return;
      }
    }
    const id = context.replyToId ? `${context.replyToId}-${Date.now()}` : `new-${context.kind}-${Date.now()}`;
    const tab: ReplyTab = { ...context, id };
    setReplyContexts((prev) => [...prev, tab]);
    setActiveRightPane(id);
    setReplyDraftDirty((prev) => ({ ...prev, [id]: false }));
  }, [toast, replyContexts]);

  const handleCloseReply = useCallback(async (tabId: string, skipDirtyCheck?: boolean) => {
    if (!skipDirtyCheck) {
      const dirty = replyDraftDirty[tabId];
      if (dirty) {
        const ok = await confirm({ message: 'Entwurf verwerfen?' });
        if (!ok) return;
      }
    }
    const toClose = replyContexts.find((rc) => rc.id === tabId);
    if (toClose?.replyToId) {
      releaseReplyLock(toClose.replyToId);
    }
    setReplyContexts((prev) => prev.filter((rc) => rc.id !== tabId));
    setReplyDraftDirty((prev) => {
      const next = { ...prev };
      delete next[tabId];
      return next;
    });
    setTabSubjects((prev) => {
      const next = { ...prev };
      delete next[tabId];
      return next;
    });
    setTabReplyToSubjects((prev) => {
      const next = { ...prev };
      delete next[tabId];
      return next;
    });
    setActiveRightPane((current) => (current === tabId ? 'preview' : current));
  }, [replyDraftDirty, replyContexts, releaseReplyLock, confirm]);

  const handleTabSubjectChange = useCallback((tabId: string, subject: string) => {
    setTabSubjects((prev) => (prev[tabId] === subject ? prev : { ...prev, [tabId]: subject }));
  }, []);

  const handleTabReplyToSubject = useCallback((tabId: string, subject: string) => {
    setTabReplyToSubjects((prev) => (prev[tabId] === subject ? prev : { ...prev, [tabId]: subject }));
  }, []);

  useEffect(() => {
    return () => {
      replyContextsRef.current.forEach((rc) => {
        if (rc.replyToId) releaseReplyLock(rc.replyToId);
      });
    };
  }, [releaseReplyLock]);

  useEffect(() => {
    if (pathname !== '/emails') {
      replyContextsRef.current.forEach((rc) => {
        if (rc.replyToId) releaseReplyLock(rc.replyToId);
      });
      setReplyContexts([]);
      setActiveRightPane('preview');
      setReplyDraftDirty({});
    }
  }, [pathname, releaseReplyLock]);

  // Nach Schließen eines Tabs: aktiven Bereich aktualisieren, damit das List-Highlight wechselt
  useEffect(() => {
    if (activeRightPane === 'preview') return;
    const tabStillExists = replyContexts.some((rc) => rc.id === activeRightPane);
    if (!tabStillExists) {
      setActiveRightPane('preview');
    }
  }, [replyContexts, activeRightPane]);

  // Nach Öffnen eines Tabs: aktiven Bereich auf den neuen Tab setzen, damit das List-Highlight wechselt
  useEffect(() => {
    const len = replyContexts.length;
    if (len > prevReplyContextsLengthRef.current && activeRightPane === 'preview') {
      const newTab = replyContexts[len - 1];
      if (newTab) setActiveRightPane(newTab.id);
    }
    prevReplyContextsLengthRef.current = len;
  }, [replyContexts, activeRightPane]);

  const handleTabChange = useCallback((tab: 'preview' | string) => {
    setActiveRightPane(tab);
  }, []);

  const handleOpenNewCompose = useCallback((kind: 'email' | 'phone_note') => {
    handleStartReply({ kind, replyToId: undefined });
  }, [handleStartReply]);

  const handleReplyToEmail = useCallback((emailId: string) => {
    handleStartReply({ kind: 'email', replyToId: emailId, replyType: 'email' });
  }, [handleStartReply]);

  const handleDraftDirtyChange = useCallback((tabId: string, dirty: boolean) => {
    setReplyDraftDirty((prev) => ({ ...prev, [tabId]: dirty }));
  }, []);

  const handleResizeMoveWithContainer = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const container = containerRef.current || document.querySelector('.main-content') as HTMLElement;
    onResizeMove(e.nativeEvent, container);
  }, [onResizeMove]);

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <SidebarErrorBoundary>
        <Sidebar />
      </SidebarErrorBoundary>
      <div 
        ref={containerRef}
        className="main-content" 
        style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', marginLeft: '280px' }}
      >
        {error && (
          <div className="alert alert-error" style={{ flexShrink: 0, margin: '1rem' }}>
            {error}
          </div>
        )}

        {fetchMessage && (
          <div
            className={`alert ${fetchMessage.type === 'success' ? 'alert-success' : 'alert-error'}`}
            style={{ margin: '1rem', flexShrink: 0 }}
          >
            {fetchMessage.text}
          </div>
        )}

        {/* Toolbar - Immer sichtbar */}
        <EmailToolbar
          selectedEmails={selectedEmails}
          emails={emails}
          selectedEmail={selectedEmailDetails}
          selectedEmailId={selectedEmailId}
          customFilterId={customFilterId}
          currentUserId={currentUserId}
          onMarkAsRead={onToolbarMarkAsRead}
          onMarkAsCompleted={onToolbarMarkAsCompleted}
          onMarkAsSpam={onToolbarMarkAsSpam}
          onMarkAsImportant={onToolbarMarkAsImportant}
          onDelete={onToolbarDelete}
          onRestore={selectedEmailId && selectedEmailDetails ? onRestoreEmail : undefined}
          onRefresh={onRefresh}
          onDepartmentChange={onDepartmentChange}
          markingRead={markingRead}
          markingCompleted={markingCompleted}
          markingSpam={markingSpam}
          markingImportant={markingImportant}
          fetching={fetching}
          onReply={handleStartReply}
          onNewCompose={handleOpenNewCompose}
        />

        {/* Liste und Preview nebeneinander */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0, position: 'relative' }}>
          {/* E-Mail-Liste (Links) */}
          <div style={{ width: `${listWidth}%`, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <EmailList
              emails={emails}
              loading={loading}
              searchQuery={searchQuery}
              filter={filter as 'all' | 'read' | 'unread'}
              selectedEmails={selectedEmails}
              customFilterId={customFilterId}
              onSelectAll={onSelectAll}
              onSelectEmail={onSelectEmail}
              onEmailClick={(emailId) => {
                setActiveRightPane('preview');
                onEmailClick(emailId);
              }}
              formatDate={formatDate}
              formatDateForTable={formatDateForTable}
              selectedEmailId={selectedEmailId}
              selectedEmail={selectedEmailDetails}
              replyToIds={replyContexts.map((rc) => rc.replyToId).filter((id): id is string => Boolean(id))}
              activeReplyToId={activeRightPane !== 'preview' ? replyContexts.find((rc) => rc.id === activeRightPane)?.replyToId : undefined}
              currentUserId={currentUserId}
              onNewCompose={handleOpenNewCompose}
              page={page}
              limit={limit}
              totalPages={totalPages}
              total={total}
              hasNext={hasNext}
              hasPrevious={hasPrevious}
              onPageChange={onPageChange}
              onSearchChange={onSearchQueryChange}
              onEmailHover={onEmailHover}
              onFilterChange={onFilterChange}
              onSearchReset={onSearchReset}
              unreadCount={unreadCount}
              onFetchEmails={onFetchEmails}
              fetching={fetching}
              searchFields={searchFields}
              onSearchFieldsChange={onSearchFieldsChange}
              tableColumns={tableColumns}
              showThreadView={showThreadView}
              onShowThreadViewChange={onShowThreadViewChange}
              onAddNote={onAddNote}
            />
          </div>

          {/* Resize-Handle zwischen Liste und Preview */}
          <div
            onMouseDown={onHorizontalResizeStart}
            style={{
              width: '4px',
              backgroundColor: isResizing === 'horizontal' ? '#2563EB' : '#E5E7EB',
              cursor: 'col-resize',
              flexShrink: 0,
              zIndex: 10,
            }}
          />
          
          {/* Preview-Pane (Rechts) */}
          <div style={{ width: `${100 - listWidth}%`, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
            <EmailPreviewPane
              email={selectedEmailDetails}
              loading={loadingEmailDetails}
              onMarkAsRead={onMarkAsRead}
              markingRead={markingRead}
              formatDate={formatDateForPreview}
              onDelete={onDeleteEmail}
              timelineHeight={isTimelineCollapsed ? 0 : timelineHeight}
              isTimelineCollapsed={isTimelineCollapsed}
              onToggleTimeline={onToggleTimeline}
              onTimelineResizeStart={onVerticalResizeStart}
              showThreadView={showThreadView}
              focusNotesOnMount={focusNotesOnMount}
              onRefreshEmailList={onRefresh}
              activeTab={activeRightPane}
              replyContexts={replyContexts}
              tabSubjects={tabSubjects}
              tabReplyToSubjects={tabReplyToSubjects}
              onTabSubjectChange={handleTabSubjectChange}
              onTabReplyToSubject={handleTabReplyToSubject}
              onTabChange={handleTabChange}
              onCloseReply={handleCloseReply}
              onDraftDirtyChange={handleDraftDirtyChange}
              onEmailClick={onEmailClick}
              onRefresh={onRefresh}
              onReplyToEmail={handleReplyToEmail}
              currentUserId={currentUserId}
            />
          </div>
        </div>
      </div>
      
      {/* Resize-Handler für Mouse-Move */}
      {isResizing && (
        <div
          onMouseMove={handleResizeMoveWithContainer}
          onMouseUp={onResizeEnd}
          onMouseLeave={onResizeLeave}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 9999,
            cursor: isResizing === 'horizontal' ? 'col-resize' : 'row-resize',
          }}
        />
      )}
    </div>
  );
}

