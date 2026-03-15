'use client';

import React from 'react';
import { FiStar, FiCheckCircle, FiTrash2, FiPhone, FiMail, FiMessageSquare, FiPaperclip, FiAlertTriangle } from 'react-icons/fi';

interface Email {
  id: string;
  subject: string;
  from: string;
  to: string[];
  date: string;
  read: boolean;
  completed?: boolean;
  deleted?: boolean;
  spam?: boolean;
  important?: boolean;
  department?: {
    id: string;
    name: string;
  } | null;
  assignedDepartments?: Array<{
    id: string;
    name: string;
  }>;
  departmentId?: string | null;
  theme?: {
    id: string;
    name: string;
    color: string | null;
  } | null;
  themeId?: string | null;
  type?: 'email' | 'phone_note';
  phoneNumber?: string;
  hasAttachment?: boolean;
  hasNotes?: boolean;
  lastNotePreview?: {
    content: string;
    userName: string;
    createdAt: string;
  };
  replyLock?: { userId: string; userName?: string };
}

interface EmailListItemProps {
  email: Email;
  isSelected: boolean;
  onSelect: (emailId: string, e: React.MouseEvent) => void;
  onClick: (emailId: string) => void;
  formatDate: (dateString: string) => string;
  isActive?: boolean;
  index?: number;
  onEmailHover?: (emailId: string) => void;
  onContextMenu?: (emailId: string, clientX: number, clientY: number) => void;
  /** E-Mail-IDs, auf die aktuell geantwortet wird (mehrere Tabs) – Eintrag wird als „Antwort offen“ markiert wenn id dabei ist */
  replyToIds?: string[];
  /** E-Mail-ID, deren Antwort-Tab gerade aktiv ist – kräftigeres Gelb für Fokus */
  activeReplyToId?: string | null;
  /** Aktueller User – wenn E-Mail replyLock von anderem User hat: „In Bearbeitung: XY“ anzeigen */
  currentUserId?: string | null;
}

function EmailListItem({
  email,
  isSelected: _isSelected,
  onSelect: _onSelect,
  onClick,
  formatDate,
  isActive,
  index = 0,
  onEmailHover,
  onContextMenu,
  replyToIds = [],
  activeReplyToId,
  currentUserId,
}: EmailListItemProps) {
  // Parse Absender-Name und E-Mail-Adresse
  const { getDisplayFromParsed } = require('@/utils/email-helpers');
  const { formatPhoneNumberForDisplay } = require('@/utils/phone-utils');
  
  const fromParsed = getDisplayFromParsed(email);
  
  // Tags aus Abteilungen erstellen
  const tags = email.assignedDepartments?.map(dept => dept.name) || 
               (email.department ? [email.department.name] : []);

  const isReplyOpen = Array.isArray(replyToIds) && replyToIds.includes(email.id);
  const isReplyTabActive = isReplyOpen && activeReplyToId === email.id;
  const isLockedByOther = Boolean(
    email.replyLock &&
    currentUserId &&
    email.replyLock.userId !== currentUserId
  );

  // Dezent abwechselnder Hintergrund für bessere Lesbarkeit
  const isEven = index % 2 === 0;
  const baseBg = isEven ? 'bg-white' : 'bg-[#FAFAFA]';
  const activeBg = 'bg-[#C7D2FE]'; // Kräftiger Blau – Vorschau ist für diese E-Mail geöffnet
  const hoverBg = 'hover:bg-[#F3F4F6]';
  const replyOpenBg = 'bg-amber-50'; // Antwort offen (Tab nicht aktiv)
  const replyTabActiveBg = 'bg-amber-100'; // Antwort-Tab ist aktiv – kräftigeres Gelb
  const lockedByOtherBg = 'bg-red-50'; // Wird von anderem User beantwortet

  return (
    <div
      className={`relative px-4 py-1.5 min-h-[70px] border-b border-[#E5E7EB] flex gap-2 cursor-pointer transition-colors ${
        isLockedByOther ? `${lockedByOtherBg} border-l-4 border-l-red-400` : isActive ? `${activeBg} border-l-4 border-l-blue-600` : isReplyTabActive ? `${replyTabActiveBg} border-l-4 border-l-amber-600` : isReplyOpen ? `${replyOpenBg} border-l-4 border-l-amber-500` : `${baseBg} ${hoverBg}`
      } ${!email.read ? 'font-bold' : ''}`}
      onClick={(e) => {
        e.stopPropagation();
        onClick(email.id);
      }}
      onMouseEnter={() => {
        // Prefetch Details für diese E-Mail
        if (onEmailHover) {
          onEmailHover(email.id);
        }
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        onContextMenu?.(email.id, e.clientX, e.clientY);
      }}
      style={!email.read && !isActive && !isReplyOpen && !isReplyTabActive ? { borderLeft: '4px solid #FBBF24' } : undefined}
    >
      {isLockedByOther && (
        <span className="absolute top-1.5 right-2 text-[10px] font-medium px-1.5 py-0.5 rounded bg-red-200 text-red-900" title={`In Bearbeitung: ${email.replyLock?.userName || 'anderer Benutzer'}`}>
          In Bearbeitung: {email.replyLock?.userName || '…'}
        </span>
      )}
      {isReplyOpen && !isLockedByOther && (
        <span className={`absolute top-1.5 right-2 text-[10px] font-medium px-1.5 py-0.5 rounded ${isReplyTabActive ? 'bg-amber-300 text-amber-950' : 'bg-amber-200 text-amber-900'}`} title={isReplyTabActive ? 'Antwort-Tab aktiv' : 'Antwort offen'}>
          {isReplyTabActive ? 'Aktiv' : 'Antwort offen'}
        </span>
      )}
      {/* Email Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex justify-between items-start gap-2 w-full">
          <div className="flex-1 min-w-0">
            <div className="text-[14px] text-[#1F2937] flex items-center gap-1.5 min-w-0">
              {email.type === 'phone_note' ? (
                <FiPhone size={14} className="text-[#2563EB] flex-shrink-0" title="Telefonnotiz" />
              ) : (
                <FiMail size={14} className="text-[#6B7280] flex-shrink-0" title="E-Mail" />
              )}
              {email.hasAttachment && (
                <span className="flex-shrink-0" title="Hat Anhang" aria-label="Hat Anhang">
                  <FiPaperclip size={14} className="text-[#6B7280]" />
                </span>
              )}
              {email.hasNotes && (
                <span
                  className="flex-shrink-0"
                  title={
                    email.lastNotePreview
                      ? `${email.lastNotePreview.userName}, ${new Date(email.lastNotePreview.createdAt).toLocaleString('de-DE')}: ${email.lastNotePreview.content}${email.lastNotePreview.content.length >= 80 ? '…' : ''}`
                      : 'Hat Kommentare'
                  }
                  aria-label="Hat Kommentare"
                >
                  <FiMessageSquare size={14} className="text-[#CA8A04]" style={{ color: '#CA8A04' }} />
                </span>
              )}
              <span className="truncate flex-1 min-w-0">
                {email.subject || '(Kein Betreff)'}
              </span>
            </div>
            <div className="text-xs text-[#6B7280] truncate mt-0.5 flex items-center gap-1">
              {fromParsed.isPhoneNote && fromParsed.phoneNumber ? (
                <span
                  className="truncate"
                  title={formatPhoneNumberForDisplay(fromParsed.phoneNumber)}
                >
                  {formatPhoneNumberForDisplay(fromParsed.phoneNumber)}
                </span>
              ) : (
                <span className="truncate">{fromParsed.name || fromParsed.email}</span>
              )}
            </div>
            {/* Symbolzeile unter dem Text */}
            <div className="flex items-center gap-2 mt-1">
              {/* Star Icon (Important) */}
              {email.important ? (
                <FiStar className="text-[#FBBF24] text-xs fill-[#FBBF24]" size={14} title="Wichtig" />
              ) : (
                <FiStar className="text-gray-400 text-xs" size={14} title="Nicht wichtig" />
              )}
              
              {/* Spam Symbol */}
              {email.spam && (
                <FiAlertTriangle className="text-[#DC2626] text-xs" size={14} title="Spam" />
              )}
              
              {/* Erledigt Symbol */}
              {email.completed && (
                <FiCheckCircle className="text-[#10B981] text-xs" size={14} title="Erledigt" />
              )}
              
              {/* Gelöscht Symbol */}
              {email.deleted && (
                <FiTrash2 className="text-[#DC2626] text-xs" size={14} title="Gelöscht" />
              )}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1 min-w-[120px] flex-shrink-0">
            <div className="text-xs text-[#6B7280] whitespace-nowrap">
              {formatDate(email.date)}
            </div>
            {tags.length > 0 && (
              <div className="flex flex-nowrap overflow-hidden max-h-[18px] gap-1 justify-end">
                {tags.map((tag, index) => (
                  <span
                    key={index}
                    className="text-[11px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap truncate flex items-center justify-center"
                    style={{
                      background: '#10B981',
                      color: '#FFFFFF',
                    }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
            {email.theme && (
              <div 
                className="flex flex-nowrap overflow-hidden max-h-[18px] gap-1 justify-end mt-0.5" 
                style={{ marginBottom: '2px' }}
              >
                <span
                  className="text-[11px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap truncate flex items-center justify-center"
                  style={{
                    background: email.theme.color || '#2563EB',
                    color: '#FFFFFF',
                  }}
                >
                  {email.theme.name}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Memo mit Custom-Comparator: nur neu rendern wenn sich Anzeige-relevante Props ändern
export default React.memo(EmailListItem, (prevProps, nextProps) => {
  return (
    prevProps.email?.id === nextProps.email?.id &&
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.isActive === nextProps.isActive &&
    prevProps.index === nextProps.index &&
    prevProps.email?.read === nextProps.email?.read &&
    prevProps.email?.important === nextProps.email?.important &&
    prevProps.email?.completed === nextProps.email?.completed &&
    prevProps.email?.deleted === nextProps.email?.deleted &&
    prevProps.email?.spam === nextProps.email?.spam &&
    prevProps.email?.subject === nextProps.email?.subject &&
    prevProps.email?.date === nextProps.email?.date
  );
});