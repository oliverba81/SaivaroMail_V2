'use client';

import { useState, useMemo } from 'react';
import { FiMessageSquare, FiChevronDown, FiChevronRight, FiHash, FiPhone, FiMail, FiInbox, FiPaperclip } from 'react-icons/fi';
import { getDisplayFromParsed } from '@/utils/email-helpers';
import { formatPhoneNumberForDisplay } from '@/utils/phone-utils';

interface Email {
  id: string;
  subject: string;
  from: string;
  date: string;
  read: boolean;
  ticketId?: string;
  isConversationThread?: boolean;
  conversationMessageCount?: number;
  department?: {
    id: string;
    name: string;
  } | null;
  theme?: {
    id: string;
    name: string;
    color: string | null;
  } | null;
  departmentId?: string | null;
  themeId?: string | null;
  type?: 'email' | 'phone_note';
  phoneNumber?: string;
  hasNotes?: boolean;
  lastNotePreview?: {
    content: string;
    userName: string;
    createdAt: string;
  };
  [key: string]: any;
}

interface EmailListGroupedProps {
  emails: Email[];
  selectedEmailId: string | null;
  onEmailClick: (email: Email) => void;
  formatDate: (dateString: string) => string;
  onContextMenu?: (emailId: string, clientX: number, clientY: number) => void;
  /** E-Mail-IDs, auf die aktuell geantwortet wird (mehrere Tabs) – Einträge werden als „Antwort offen“ markiert */
  replyToIds?: string[];
  /** E-Mail-ID, deren Antwort-Tab gerade aktiv ist – kräftigeres Gelb für Fokus */
  activeReplyToId?: string | null;
  currentUserId?: string | null;
}

interface ConversationGroup {
  ticketId: string;
  emails: Email[];
  latestSubject: string;
  latestDate: string;
  latestType?: 'email' | 'phone_note';
  messageCount: number;
  hasUnread: boolean;
  hasNotes: boolean;
}

export default function EmailListGrouped({
  emails,
  selectedEmailId,
  onEmailClick,
  formatDate,
  onContextMenu,
  replyToIds = [],
  activeReplyToId,
  currentUserId,
}: EmailListGroupedProps) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Gruppiere E-Mails nach Ticket-ID
  const { conversations, singleEmails } = useMemo(() => {
    const grouped = new Map<string, Email[]>();
    const singles: Email[] = [];

    // Gruppiere nach Ticket-ID
    emails.forEach((email) => {
      if (email.ticketId && email.isConversationThread && email.conversationMessageCount && email.conversationMessageCount > 1) {
        if (!grouped.has(email.ticketId)) {
          grouped.set(email.ticketId, []);
        }
        grouped.get(email.ticketId)!.push(email);
      } else {
        singles.push(email);
      }
    });

    // Erstelle Konversations-Objekte
    const convs: ConversationGroup[] = Array.from(grouped.entries()).map(([ticketId, groupEmails]) => {
      // Sortiere E-Mails chronologisch
      const sorted = [...groupEmails].sort((a, b) => 
        new Date(b.date).getTime() - new Date(a.date).getTime()
      );
      
      const latest = sorted[0];
      const hasUnread = sorted.some(e => !e.read);
      const hasNotes = sorted.some(e => e.hasNotes === true);

      return {
        ticketId,
        emails: sorted,
        latestSubject: latest.subject,
        latestDate: latest.date,
        latestType: latest.type || 'email',
        messageCount: sorted.length,
        hasUnread,
        hasNotes,
      };
    });

    // Sortiere Konversationen nach neuestem Datum
    convs.sort((a, b) => new Date(b.latestDate).getTime() - new Date(a.latestDate).getTime());

    return { conversations: convs, singleEmails: singles };
  }, [emails]);

  // Flache Liste: zuerst Konversationen, dann Einzeleinträge (ohne Virtualizer – vermeidet setState-während-Render)
  const flatItems = useMemo(() => {
    const convItems = conversations.map((data) => ({ type: 'conversation' as const, data }));
    const singleItems = singleEmails.map((data) => ({ type: 'single' as const, data }));
    return [...convItems, ...singleItems];
  }, [conversations, singleEmails]);

  const toggleGroup = (ticketId: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(ticketId)) {
      newExpanded.delete(ticketId);
    } else {
      newExpanded.add(ticketId);
    }
    setExpandedGroups(newExpanded);
  };

  // Aktiver Eintrag in der Liste = aktuell sichtbarer Tab (Vorschau → selectedEmailId, Antwort-Tab → activeReplyToId)
  const listActiveId = activeReplyToId ?? selectedEmailId ?? null;

  const renderEmail = (email: Email, isNested = false) => {
    const isSelected = listActiveId !== null && email.id === listActiveId;
    const isReplyOpen = Array.isArray(replyToIds) && replyToIds.includes(email.id);
    const isReplyTabActive = isReplyOpen && activeReplyToId === email.id;
    const isLockedByOther = Boolean(
      email.replyLock &&
      currentUserId &&
      email.replyLock.userId !== currentUserId
    );
    // Vorschau geöffnet (isSelected) = stärkstes Highlight; danach Reply-Tab, Reply offen, dann normal
    const bgColor = isLockedByOther ? '#FEE2E2' : (isSelected ? '#C7D2FE' : (isReplyTabActive ? '#FEF3C7' : (isReplyOpen ? '#FFFBEB' : (email.read ? '#ffffff' : '#F9FAFB'))));
    const borderLeft = isNested ? '3px solid #E5E7EB' : (isLockedByOther ? '3px solid #F87171' : (isSelected ? '4px solid #2563EB' : (isReplyTabActive ? '3px solid #D97706' : (isReplyOpen ? '3px solid #F59E0B' : (!email.read ? '3px solid #6366F1' : '3px solid transparent')))));

    return (
      <div
        key={email.id}
        onClick={(e) => {
          e.stopPropagation();
          onEmailClick(email);
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          onContextMenu?.(email.id, e.clientX, e.clientY);
        }}
        style={{
          padding: isNested ? '0.625rem 1rem' : '0.875rem 1rem',
          paddingLeft: isNested ? '3.5rem' : '1rem',
          marginBottom: '0',
          borderBottom: '1px solid #E5E7EB',
          cursor: 'pointer',
          backgroundColor: bgColor,
          transition: 'background-color 0.15s',
          borderLeft,
          display: 'flex',
          alignItems: 'flex-start',
          gap: '0.75rem',
          position: 'relative' as const,
        }}
        onMouseEnter={(e) => {
          if (!isSelected && !isReplyOpen && !isLockedByOther) {
            e.currentTarget.style.backgroundColor = '#F9FAFB';
          }
        }}
        onMouseLeave={(e) => {
          if (isSelected) {
            e.currentTarget.style.backgroundColor = '#C7D2FE';
          } else if (isLockedByOther) {
            e.currentTarget.style.backgroundColor = '#FEE2E2';
          } else if (isReplyTabActive) {
            e.currentTarget.style.backgroundColor = '#FEF3C7';
          } else if (isReplyOpen) {
            e.currentTarget.style.backgroundColor = '#FFFBEB';
          } else {
            e.currentTarget.style.backgroundColor = email.read ? '#ffffff' : '#F9FAFB';
          }
        }}
      >
        {isLockedByOther && !isNested && (
          <span style={{ position: 'absolute', top: '0.375rem', right: '0.75rem', fontSize: '10px', fontWeight: 600, padding: '2px 6px', borderRadius: '4px', background: '#FECACA', color: '#991B1B' }} title={`In Bearbeitung: ${email.replyLock?.userName || 'anderer Benutzer'}`}>
            In Bearbeitung: {email.replyLock?.userName || '…'}
          </span>
        )}
        {isReplyOpen && !isLockedByOther && !isNested && (
          <span style={{ position: 'absolute', top: '0.375rem', right: '0.75rem', fontSize: '10px', fontWeight: 600, padding: '2px 6px', borderRadius: '4px', background: isReplyTabActive ? '#FCD34D' : '#FDE68A', color: isReplyTabActive ? '#78350F' : '#92400E' }} title={isReplyTabActive ? 'Antwort-Tab aktiv' : 'Antwort offen'}>
            {isReplyTabActive ? 'Aktiv' : 'Antwort offen'}
          </span>
        )}
        {/* Unread Indicator (nur für nicht-nested E-Mails) */}
        {!isNested && (
          <>
            {!email.read && (
              <div style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: '#3B82F6',
                flexShrink: 0,
                marginTop: '0.375rem',
              }} />
            )}
            {email.read && (
              <div style={{ width: '8px', flexShrink: 0 }} />
            )}
          </>
        )}

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem' }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ 
              fontWeight: email.read ? '400' : '600', 
              fontSize: '0.875rem', 
              color: '#111827',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              marginBottom: '0.375rem',
            }}>
              {(() => {
                const fromParsed = getDisplayFromParsed(email);
                if (fromParsed.isPhoneNote && fromParsed.phoneNumber) {
                  return (
                    <span className="flex items-center gap-1" title={formatPhoneNumberForDisplay(fromParsed.phoneNumber)}>
                      <FiPhone size={12} className="text-[#2563EB]" />
                      {formatPhoneNumberForDisplay(fromParsed.phoneNumber)}
                    </span>
                  );
                }
                return fromParsed.name || fromParsed.email || email.from;
              })()}
            </div>
            <div style={{ 
              display: 'flex',
              alignItems: 'center',
              overflow: 'hidden',
              fontSize: '0.8125rem', 
              color: email.read ? '#6B7280' : '#111827',
              fontWeight: email.read ? '400' : '500',
            }}>
              {email.type !== 'phone_note' && (
                <FiMail size={14} style={{ color: email.isSent ? '#DC2626' : '#6B7280', flexShrink: 0, marginRight: '0.5rem' }} title={email.isSent ? 'Gesendet' : 'E-Mail'} />
              )}
              {email.hasAttachment && (
                <span style={{ flexShrink: 0, marginRight: '0.375rem' }} title="Hat Anhang" aria-label="Hat Anhang">
                  <FiPaperclip size={14} style={{ color: '#6c757d' }} />
                </span>
              )}
              {email.hasNotes && (
                <span
                  style={{ flexShrink: 0, marginRight: '0.375rem' }}
                  title={
                    email.lastNotePreview
                      ? `${email.lastNotePreview.userName}, ${new Date(email.lastNotePreview.createdAt).toLocaleString('de-DE')}: ${email.lastNotePreview.content}${email.lastNotePreview.content.length >= 80 ? '…' : ''}`
                    : 'Hat Kommentare'
                  }
                  aria-label="Hat Kommentare"
                >
                  <FiMessageSquare size={14} style={{ color: '#CA8A04' }} />
                </span>
              )}
              <span style={{ minWidth: 0, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {email.subject || '(Kein Betreff)'}
              </span>
            </div>
          </div>
          {/* Rechte Spalte: Datum und Tags untereinander */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.375rem', flexShrink: 0 }}>
            <div style={{ fontSize: '0.75rem', color: '#9CA3AF', whiteSpace: 'nowrap' }}>
              {formatDate(email.date)}
            </div>
            {!isNested && (email.department || email.theme) && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.375rem' }}>
                {email.department && (
                  <span style={{
                    fontSize: '0.6875rem',
                    padding: '2px 6px',
                    borderRadius: '10px',
                    backgroundColor: '#10B981',
                    color: '#FFFFFF',
                    fontWeight: '500',
                  }}>
                    {email.department.name}
                  </span>
                )}
                {email.theme && (
                  <span style={{
                    fontSize: '0.6875rem',
                    padding: '2px 6px',
                    borderRadius: '10px',
                    backgroundColor: email.theme.color || '#2563EB',
                    color: '#FFFFFF',
                    fontWeight: '500',
                  }}>
                    {email.theme.name}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderConversation = (conv: ConversationGroup) => {
    const isExpanded = expandedGroups.has(conv.ticketId);
    const isAnySelected = conv.emails.some(e => e.id === selectedEmailId);
    const isAnyLockedByOther = conv.emails.some(e => e.replyLock && currentUserId && e.replyLock.userId !== currentUserId);
    const firstLockedByOther = isAnyLockedByOther ? conv.emails.find(e => e.replyLock && currentUserId && e.replyLock.userId !== currentUserId) : null;
    const lockedByName = firstLockedByOther?.replyLock?.userName;

    return (
      <div 
        key={conv.ticketId}
        style={{
          marginBottom: '1px',
          borderLeft: '3px solid #E5E7EB',
          backgroundColor: '#ffffff',
        }}
      >
        {/* Konversations-Header */}
        <div
          onClick={() => {
            // Beim Klick auf Header: Toggle expand und wähle neueste E-Mail
            toggleGroup(conv.ticketId);
            if (!isExpanded) {
              onEmailClick(conv.emails[0]);
            }
          }}
          onContextMenu={(e) => {
            e.preventDefault();
            onContextMenu?.(conv.emails[0].id, e.clientX, e.clientY);
          }}
          style={{
            padding: '0.875rem 1rem',
            borderBottom: '1px solid #E5E7EB',
            cursor: 'pointer',
            backgroundColor: isAnySelected ? '#EFF6FF' : (conv.hasUnread ? '#FAFAFA' : '#ffffff'),
            transition: 'background-color 0.15s',
            borderLeft: isAnySelected ? '3px solid #3B82F6' : (conv.hasUnread ? '3px solid #6366F1' : '3px solid #E5E7EB'),
          }}
          onMouseEnter={(e) => {
            if (!isAnySelected) {
              e.currentTarget.style.backgroundColor = '#F9FAFB';
            }
          }}
          onMouseLeave={(e) => {
            if (!isAnySelected) {
              e.currentTarget.style.backgroundColor = conv.hasUnread ? '#FAFAFA' : '#ffffff';
            }
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {/* Unread Indicator Dot */}
            {conv.hasUnread && (
              <div style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: '#3B82F6',
                flexShrink: 0,
              }} />
            )}
            
            {!conv.hasUnread && (
              <div style={{ width: '8px', flexShrink: 0 }} />
            )}

            {/* Expand/Collapse Icon */}
            <div style={{ color: '#6B7280', flexShrink: 0 }}>
              {isExpanded ? <FiChevronDown size={18} /> : <FiChevronRight size={18} />}
            </div>

            {/* Content */}
            <div style={{ flex: 1, minWidth: 0, display: 'flex', gap: '0.75rem' }}>
              {/* Left: Text Content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                {/* First line: From + Count + In Bearbeitung Badge */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.375rem', flexWrap: 'wrap' }}>
                  <span style={{ 
                    fontWeight: conv.hasUnread ? '600' : '400', 
                    fontSize: '0.875rem',
                    color: '#111827',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {conv.emails[0].from}
                  </span>
                  <span style={{ 
                    backgroundColor: '#F3F4F6',
                    color: '#6B7280',
                    padding: '1px 6px',
                    borderRadius: '10px',
                    fontSize: '0.6875rem',
                    fontWeight: '500',
                    flexShrink: 0,
                  }}>
                    {conv.messageCount}
                  </span>
                  {isAnyLockedByOther && (
                    <span
                      style={{
                        fontSize: '0.6875rem',
                        fontWeight: 600,
                        padding: '1px 6px',
                        borderRadius: '10px',
                        background: '#FECACA',
                        color: '#991B1B',
                        flexShrink: 0,
                      }}
                      title={lockedByName ? `In Bearbeitung: ${lockedByName}` : 'In Bearbeitung'}
                    >
                      In Bearbeitung{lockedByName ? `: ${lockedByName}` : ''}
                    </span>
                  )}
                </div>
                
                {/* Second line: Subject */}
                <div style={{ 
                  display: 'flex',
                  alignItems: 'center',
                  overflow: 'hidden',
                  fontSize: '0.8125rem', 
                  color: conv.hasUnread ? '#111827' : '#6B7280',
                  marginBottom: '0.25rem',
                  fontWeight: conv.hasUnread ? '500' : '400',
                }}>
                  {conv.latestType !== 'phone_note' && (
                    <FiMail size={14} style={{ color: '#6B7280', flexShrink: 0, marginRight: '0.5rem' }} title="E-Mail" />
                  )}
                  {conv.hasNotes && (
                    <span
                      style={{ flexShrink: 0, marginRight: '0.375rem' }}
                      title="Konversation hat Kommentare"
                      aria-label="Hat Kommentare"
                    >
                      <FiMessageSquare size={14} style={{ color: '#CA8A04' }} />
                    </span>
                  )}
                  <span style={{ minWidth: 0, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {conv.latestSubject || '(Kein Betreff)'}
                  </span>
                </div>
                
                {/* Third line: Ticket-ID */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <FiHash size={11} style={{ color: '#9CA3AF' }} />
                  <span style={{ 
                    fontFamily: 'ui-monospace, monospace', 
                    fontSize: '0.6875rem', 
                    color: '#9CA3AF',
                    letterSpacing: '0.01em',
                  }}>
                    {conv.ticketId}
                  </span>
                </div>
              </div>

              {/* Right: Date + Tags */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.375rem', flexShrink: 0, minWidth: '120px' }}>
                <div style={{ fontSize: '0.75rem', color: '#9CA3AF', whiteSpace: 'nowrap' }}>
                  {formatDate(conv.latestDate)}
                </div>
                {/* Abteilung */}
                {conv.emails[0].department && (
                  <span style={{
                    fontSize: '0.6875rem',
                    padding: '2px 6px',
                    borderRadius: '10px',
                    backgroundColor: '#10B981',
                    color: '#FFFFFF',
                    fontWeight: '500',
                  }}>
                    {conv.emails[0].department.name}
                  </span>
                )}
                {/* Thema */}
                {conv.emails[0].theme && (
                  <span style={{
                    fontSize: '0.6875rem',
                    padding: '2px 6px',
                    borderRadius: '10px',
                    backgroundColor: conv.emails[0].theme.color || '#2563EB',
                    color: '#FFFFFF',
                    fontWeight: '500',
                  }}>
                    {conv.emails[0].theme.name}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Erweiterte E-Mails */}
        {isExpanded && (
          <div style={{ backgroundColor: '#FAFAFA', borderLeft: '3px solid #E5E7EB' }}>
            {conv.emails.map(email => renderEmail(email, true))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      style={{ overflowY: 'auto', height: '100%', backgroundColor: '#ffffff' }}
    >
      {flatItems.length === 0 ? (
        <div style={{ padding: '3rem 1rem', textAlign: 'center' }}>
          <FiInbox size={48} style={{ color: '#D1D5DB', margin: '0 auto 1rem', display: 'block' }} />
          <p style={{ margin: 0, color: '#9CA3AF', fontSize: '0.875rem' }}>Keine E-Mails gefunden</p>
        </div>
      ) : (
        <div>
          {flatItems.map((item, index) => (
            <div
              key={item.type === 'conversation' ? `conv-${item.data.ticketId}` : `single-${item.data.id}`}
              data-index={index}
            >
              {item.type === 'conversation'
                ? renderConversation(item.data)
                : renderEmail(item.data, false)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
