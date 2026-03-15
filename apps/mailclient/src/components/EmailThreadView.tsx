'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { FiMessageSquare, FiHash, FiPhone, FiMail, FiPaperclip, FiDownload, FiCornerUpLeft } from 'react-icons/fi';
import { getDisplayFrom, getDisplayFromParsed } from '@/utils/email-helpers';
import { normalizePhoneNumberForTel, formatPhoneNumberForDisplay } from '@/utils/phone-utils';
import {
  bodyLooksLikeHtml,
  sanitizeEmailHtml,
  hasExternalImages,
  extractExternalContentSources,
} from '@/utils/email-html';
import ExternalContentBanner from './ExternalContentBanner';
import EmailHtmlBody from './EmailHtmlBody';

interface ThreadNote {
  content: string;
  userName: string;
  createdAt: string;
}

interface ThreadAttachment {
  id: string;
  filename: string;
  sizeBytes: number;
  contentType: string;
}

interface ThreadEmail {
  id: string;
  subject: string;
  from: string;
  to: string[];
  body: string;
  date: string;
  read: boolean;
  ticketId: string;
  isOutgoing: boolean;
  type?: 'email' | 'phone_note';
  phoneNumber?: string;
  hasAttachment?: boolean;
  hasNotes?: boolean;
  notes?: ThreadNote[];
  replyLock?: { userId: string; userName: string };
}

interface EmailThreadViewProps {
  emailId: string;
  formatDate: (dateString: string) => string;
  /** Aktueller User – für Badge „In Bearbeitung“ und Deaktivierung des Antworten-Buttons */
  currentUserId?: string | null;
  /** Callback zum Öffnen eines Antwort-Tabs für diese E-Mail */
  onReplyToEmail?: (emailId: string) => void;
  layoutPreferences?: import('@/hooks/useEmailState').LayoutPreferences;
  saveLayoutPreferences?: (prefs: Partial<import('@/hooks/useEmailState').LayoutPreferences>) => void;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

function ThreadMessageAttachments({ messageEmailId, isOutgoing }: { messageEmailId: string; isOutgoing: boolean }) {
  const [attachments, setAttachments] = useState<ThreadAttachment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const token = localStorage.getItem('mailclient_token');
      if (!token) return;
      try {
        const res = await fetch(`/api/emails/${messageEmailId}/attachments`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (!cancelled) setAttachments(data.attachments || []);
      } catch {
        if (!cancelled) setAttachments([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [messageEmailId]);

  const handleDownload = async (attachmentId: string, filename: string) => {
    const token = localStorage.getItem('mailclient_token');
    if (!token) return;
    try {
      const res = await fetch(`/api/emails/${messageEmailId}/attachments/${attachmentId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (e) {
      console.error(e);
    }
  };

  if (loading) {
    return (
      <div style={{ fontSize: '0.75rem', opacity: 0.8, marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
        <FiPaperclip size={12} />
        <span>Anhänge werden geladen…</span>
      </div>
    );
  }
  if (attachments.length === 0) return null;
  return (
    <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
      <div style={{ fontSize: '0.7rem', opacity: 0.9, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
        <FiPaperclip size={12} />
        <span>Anhänge</span>
      </div>
      {attachments.map((att) => (
        <button
          key={att.id}
          type="button"
          onClick={() => handleDownload(att.id, att.filename)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.375rem',
            padding: '0.25rem 0.5rem',
            fontSize: '0.8rem',
            background: isOutgoing ? 'rgba(255,255,255,0.2)' : '#f1f5f9',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            color: 'inherit',
            textAlign: 'left',
            maxWidth: '100%',
          }}
          title={`${att.filename} (${formatFileSize(att.sizeBytes)})`}
        >
          <FiDownload size={12} style={{ flexShrink: 0 }} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{att.filename}</span>
          <span style={{ flexShrink: 0, opacity: 0.8 }}>{formatFileSize(att.sizeBytes)}</span>
        </button>
      ))}
    </div>
  );
}

export default function EmailThreadView({
  emailId,
  formatDate,
  currentUserId,
  onReplyToEmail,
  layoutPreferences,
  saveLayoutPreferences,
}: EmailThreadViewProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [ticketId, setTicketId] = useState('');
  const [latestSubject, setLatestSubject] = useState('');
  const [latestType, setLatestType] = useState<'email' | 'phone_note'>('email');
  const [messageCount, setMessageCount] = useState(0);
  const [emails, setEmails] = useState<ThreadEmail[]>([]);
  const [showExternalForMessage, setShowExternalForMessage] = useState<Record<string, boolean>>({});
  const [savingExternalPrefs, setSavingExternalPrefs] = useState(false);

  const loadThread = async () => {
    try {
      setLoading(true);
      setError('');

      const token = localStorage.getItem('mailclient_token');
      if (!token) {
        router.push('/login');
        return;
      }

      const response = await fetch(`/api/emails/${emailId}/thread`, {
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

      const contentType = response.headers.get('content-type') || '';
      const rawText = await response.text();

      let data: any = null;

      if (contentType.includes('application/json')) {
        if (rawText && rawText.trim().length > 0) {
          try {
            data = JSON.parse(rawText);
          } catch (parseError) {
            console.error(
              'EmailThreadView: Fehler beim Parsen der JSON-Antwort für den Thread',
              parseError
            );
          }
        }
      } else if (process.env.NODE_ENV === 'development') {
        console.warn('EmailThreadView: Unerwarteter Content-Type beim Laden des Threads', {
          status: response.status,
          contentType,
          preview: rawText.slice(0, 200),
        });
      }

      if (!response.ok) {
        const errorMessage =
          (data && typeof data.error === 'string' && data.error.trim().length > 0)
            ? data.error
            : 'Fehler beim Laden des Threads';
        setError(errorMessage);
        return;
      }

      if (!data) {
        setError('Fehler beim Laden des Threads');
        return;
      }

      setTicketId(data.ticketId || '');
      setLatestSubject(data.latestSubject || '');
      setLatestType(data.latestType || 'email');
      setMessageCount(data.messageCount || 0);
      setEmails(Array.isArray(data.emails) ? data.emails : []);
    } catch (err: any) {
      setError('Fehler beim Laden des Threads');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (emailId) {
      loadThread();
    }
  }, [emailId]);

  useEffect(() => {
    setShowExternalForMessage({});
  }, [emailId]);

  const getAllowExternalForEmail = useCallback(
    (email: ThreadEmail): boolean => {
      if (showExternalForMessage[email.id]) return true;
      if (layoutPreferences?.externalContentAlwaysAllow) return true;
      if (email.type === 'phone_note') return false;
      const parsed = getDisplayFromParsed(email);
      const senderEmail = parsed.email?.toLowerCase();
      if (
        senderEmail &&
        (layoutPreferences?.externalContentAllowedSenders ?? []).some((s) => s.toLowerCase() === senderEmail)
      )
        return true;
      const domains = extractExternalContentSources(email.body);
      if (domains.length > 0) {
        const allowed = (layoutPreferences?.externalContentAllowedDomains ?? []).map((d) => d.toLowerCase());
        if (domains.every((d) => allowed.includes(d))) return true;
      }
      return false;
    },
    [
      showExternalForMessage,
      layoutPreferences?.externalContentAlwaysAllow,
      layoutPreferences?.externalContentAllowedSenders,
      layoutPreferences?.externalContentAllowedDomains,
    ]
  );

  const handleAllowDomain = useCallback(
    (domain: string) => {
      if (!saveLayoutPreferences || !layoutPreferences) return;
      const existing = layoutPreferences.externalContentAllowedDomains ?? [];
      const normalized = domain.toLowerCase().trim();
      if (existing.some((d) => d.toLowerCase() === normalized)) return;
      setSavingExternalPrefs(true);
      Promise.resolve(
        saveLayoutPreferences({
          externalContentAllowedDomains: [...existing, normalized],
        })
      ).finally(() => setSavingExternalPrefs(false));
    },
    [saveLayoutPreferences, layoutPreferences]
  );

  const handleAllowSender = useCallback(
    (sender: string) => {
      if (!saveLayoutPreferences || !sender.includes('@')) return;
      const existing = layoutPreferences?.externalContentAllowedSenders ?? [];
      const normalized = sender.toLowerCase().trim();
      if (existing.some((s) => s.toLowerCase() === normalized)) return;
      setSavingExternalPrefs(true);
      Promise.resolve(
        saveLayoutPreferences({
          externalContentAllowedSenders: [...existing, normalized],
        })
      ).finally(() => setSavingExternalPrefs(false));
    },
    [saveLayoutPreferences, layoutPreferences]
  );

  const handleAllowAllDomains = useCallback(
    (domains: string[]) => {
      if (!saveLayoutPreferences) return;
      const existing = (layoutPreferences?.externalContentAllowedDomains ?? []).map((d) => d.toLowerCase());
      const newDomains = domains
        .map((d) => d.toLowerCase().trim())
        .filter((d) => d && !existing.includes(d));
      if (newDomains.length === 0) return;
      setSavingExternalPrefs(true);
      Promise.resolve(
        saveLayoutPreferences({
          externalContentAllowedDomains: [...existing, ...newDomains],
        })
      ).finally(() => setSavingExternalPrefs(false));
    },
    [saveLayoutPreferences, layoutPreferences]
  );

  const renderEmailBody = (email: ThreadEmail) => {
    if (!email.body) {
      return '(Kein Inhalt)';
    }

    const isHtml = bodyLooksLikeHtml(email.body);
    const allowExternal = getAllowExternalForEmail(email);
    const sanitized = isHtml
      ? sanitizeEmailHtml(email.body, { allowExternalContent: allowExternal, preserveMailLayout: true })
      : email.body;

    return <EmailHtmlBody html={sanitized} isHtml={isHtml} />;
  };

  const renderMessageContent = (email: ThreadEmail) => {
    if (!email.body) return '(Kein Inhalt)';
    if (!bodyLooksLikeHtml(email.body)) return email.body;

    const allowExternal = getAllowExternalForEmail(email);
    const hasExtImages = hasExternalImages(email.body);
    const showBanner = hasExtImages && !allowExternal;

    const parsedSender =
      email.type !== 'phone_note' ? getDisplayFromParsed(email).email : undefined;
    const domains = extractExternalContentSources(email.body);

    return (
      <>
        {showBanner && (
          <ExternalContentBanner
            domains={domains}
            sender={parsedSender}
            onShowForThisMessage={() =>
              setShowExternalForMessage((prev) => ({ ...prev, [email.id]: true }))
            }
            onAllowDomain={saveLayoutPreferences ? handleAllowDomain : undefined}
            onAllowSender={
              saveLayoutPreferences && parsedSender?.includes('@') ? handleAllowSender : undefined
            }
            onAllowAllDomains={
              saveLayoutPreferences && domains.length >= 2 ? handleAllowAllDomains : undefined
            }
            saving={savingExternalPrefs}
          />
        )}
        {renderEmailBody(email)}
      </>
    );
  };

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <div className="spinner" style={{ margin: '0 auto' }}></div>
        <p style={{ marginTop: '1rem', color: '#6c757d' }}>Lade Konversation...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#dc3545' }}>
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="card" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header mit Betreff der letzten E-Mail */}
      <div 
        style={{ 
          padding: '1rem',
          borderBottom: '2px solid #e9ecef',
          backgroundColor: '#f8f9fa',
          position: 'sticky',
          top: 0,
          zIndex: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <FiMessageSquare size={20} style={{ color: '#28a745' }} />
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '600', flex: 1, display: 'flex', alignItems: 'center', gap: '0.5rem', overflow: 'hidden' }}>
            {latestType === 'phone_note' ? (
              <FiPhone size={16} style={{ color: '#2563EB', flexShrink: 0 }} title="Telefonnotiz" />
            ) : (
              <FiMail size={16} style={{ color: '#6B7280', flexShrink: 0 }} title="E-Mail" />
            )}
            <span style={{ minWidth: 0, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {latestSubject}
            </span>
          </h2>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.875rem', color: '#6c757d' }}>
          <span 
            style={{ 
              display: 'inline-flex', 
              alignItems: 'center', 
              gap: '0.25rem',
              backgroundColor: '#e7f1ff',
              padding: '0.25rem 0.5rem',
              borderRadius: '4px',
            }}
          >
            <FiHash size={14} />
            <span style={{ fontFamily: 'monospace', fontWeight: '600', color: '#007bff' }}>
              {ticketId}
            </span>
          </span>
          <span>
            {messageCount} {messageCount === 1 ? 'Nachricht' : 'Nachrichten'}
          </span>
        </div>
      </div>

      {/* Nachrichten-Container (scrollbar) */}
      <div 
        style={{ 
          flex: 1, 
          overflowY: 'auto', 
          padding: '1rem',
          backgroundColor: '#f8f9fa',
        }}
      >
        {emails.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#6c757d' }}>
            <p>Keine Nachrichten in dieser Konversation.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {emails.map((email) => (
              <div
                key={email.id}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: email.isOutgoing ? 'flex-end' : 'flex-start',
                }}
              >
                {/* Nachricht */}
                <div
                  style={{
                    maxWidth: '70%',
                    padding: '0.75rem 1rem',
                    borderRadius: '12px',
                    backgroundColor: email.isOutgoing ? '#007bff' : '#ffffff',
                    color: email.isOutgoing ? '#ffffff' : '#333',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                  }}
                >
                  {/* Symbol und Betreff/Absender */}
                  <div 
                    style={{ 
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.375rem',
                      marginBottom: '0.5rem',
                    }}
                  >
                    {/* Symbol für Typ (immer anzeigen) */}
                    {email.type === 'phone_note' ? (
                      <FiPhone size={12} style={{ color: email.isOutgoing ? '#ffffff' : '#2563EB', flexShrink: 0, opacity: email.isOutgoing ? 0.9 : 1 }} title="Telefonnotiz" />
                    ) : (
                      <FiMail size={12} style={{ color: email.isOutgoing ? '#ffffff' : '#6B7280', flexShrink: 0, opacity: email.isOutgoing ? 0.9 : 1 }} title="E-Mail" />
                    )}
                    {email.hasAttachment && (
                      <FiPaperclip size={12} style={{ color: email.isOutgoing ? 'rgba(255,255,255,0.9)' : '#6c757d', flexShrink: 0, opacity: email.isOutgoing ? 0.9 : 1 }} title="Hat Anhang" />
                    )}
                    {/* Original-Betreff (wenn unterschiedlich vom Header) */}
                    {email.subject !== latestSubject ? (
                      <div 
                        style={{ 
                          display: 'flex',
                          alignItems: 'center',
                          overflow: 'hidden',
                          fontSize: '0.75rem', 
                          opacity: email.isOutgoing ? 0.9 : 0.8,
                          fontWeight: '600',
                          flex: 1,
                        }}
                      >
                        <span style={{ minWidth: 0, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {email.subject}
                        </span>
                      </div>
                    ) : (
                      /* Absender (bei eingehenden Nachrichten) */
                      !email.isOutgoing && (
                        <div 
                          style={{ 
                            fontSize: '0.75rem', 
                            fontWeight: '600',
                            color: '#007bff',
                            flex: 1,
                          }}
                        >
                          {email.type === 'phone_note' && email.phoneNumber ? (
                            <a
                              href={`tel:${normalizePhoneNumberForTel(email.phoneNumber)}`}
                              style={{ color: '#007bff', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                              onClick={(e) => e.stopPropagation()}
                              title={`Anrufen: ${formatPhoneNumberForDisplay(email.phoneNumber)}`}
                            >
                              {formatPhoneNumberForDisplay(email.phoneNumber)}
                            </a>
                          ) : (
                            getDisplayFrom(email) || email.from
                          )}
                        </div>
                      )
                    )}
                  </div>

                  {/* Nachrichteninhalt */}
                  <div
                    style={{
                      whiteSpace: bodyLooksLikeHtml(email.body) ? 'normal' : 'pre-wrap',
                      wordBreak: 'break-word',
                      fontSize: '0.9rem',
                      lineHeight: '1.5',
                    }}
                  >
                    {renderMessageContent(email)}
                  </div>

                  {/* Anhänge */}
                  {email.hasAttachment && (
                    <ThreadMessageAttachments messageEmailId={email.id} isOutgoing={email.isOutgoing} />
                  )}

                  {/* Empfänger (bei ausgehenden Nachrichten, nur bei E-Mails) */}
                  {email.isOutgoing && email.type !== 'phone_note' && email.to.length > 0 && (
                    <div
                      style={{
                        fontSize: '0.7rem',
                        marginTop: '0.5rem',
                        opacity: 0.8,
                      }}
                    >
                      An: {email.to.join(', ')}
                    </div>
                  )}

                  {/* Zeitstempel */}
                  <div
                    style={{
                      fontSize: '0.7rem',
                      marginTop: '0.5rem',
                      opacity: 0.7,
                      textAlign: email.isOutgoing ? 'right' : 'left',
                    }}
                  >
                    {formatDate(email.date)}
                  </div>
                </div>

                {/* In Bearbeitung (von anderem User gesperrt) */}
                {email.replyLock && currentUserId && email.replyLock.userId !== currentUserId && (
                  <div
                    style={{
                      marginTop: '0.375rem',
                      fontSize: '0.7rem',
                      padding: '0.25rem 0.5rem',
                      borderRadius: '4px',
                      backgroundColor: '#FEE2E2',
                      color: '#991B1B',
                      alignSelf: email.isOutgoing ? 'flex-end' : 'flex-start',
                      fontWeight: 500,
                    }}
                    title={`In Bearbeitung: ${email.replyLock.userName || 'anderer Benutzer'}`}
                  >
                    In Bearbeitung: {email.replyLock.userName || '…'}
                  </div>
                )}

                {/* Antworten-Button (nur wenn Callback vorhanden) */}
                {onReplyToEmail && (
                  <div style={{ marginTop: '0.5rem', alignSelf: email.isOutgoing ? 'flex-end' : 'flex-start' }}>
                    <button
                      type="button"
                      onClick={() => onReplyToEmail(email.id)}
                      disabled={Boolean(email.replyLock && currentUserId && email.replyLock.userId !== currentUserId)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.375rem',
                        padding: '0.375rem 0.625rem',
                        fontSize: '0.8125rem',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        backgroundColor: email.replyLock && currentUserId && email.replyLock.userId !== currentUserId ? '#f3f4f6' : '#ffffff',
                        color: email.replyLock && currentUserId && email.replyLock.userId !== currentUserId ? '#9ca3af' : '#374151',
                        cursor: email.replyLock && currentUserId && email.replyLock.userId !== currentUserId ? 'not-allowed' : 'pointer',
                      }}
                      title={email.replyLock && currentUserId && email.replyLock.userId !== currentUserId ? `In Bearbeitung: ${email.replyLock.userName}` : 'Auf diese Nachricht antworten'}
                    >
                      <FiCornerUpLeft size={14} />
                      Antworten
                    </button>
                  </div>
                )}

                {/* Kommentare: hellgelbe Sprechblase(n) unter der Nachricht mit Inhalt, User, Datum */}
                {email.notes && email.notes.length > 0 && (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.5rem',
                      marginTop: '0.5rem',
                      maxWidth: '70%',
                      alignSelf: email.isOutgoing ? 'flex-end' : 'flex-start',
                    }}
                  >
                    {email.notes.map((note, noteIndex) => (
                      <div
                        key={noteIndex}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.25rem',
                          padding: '0.5rem 0.625rem',
                          borderRadius: '8px',
                          backgroundColor: '#FEF9C3',
                          border: '1px solid #FDE047',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.375rem',
                            flexWrap: 'wrap',
                            fontSize: '0.7rem',
                            color: '#854D0E',
                          }}
                        >
                          <FiMessageSquare size={12} style={{ color: '#A16207', flexShrink: 0 }} />
                          <span style={{ fontWeight: 600 }}>{note.userName}</span>
                          <span style={{ opacity: 0.9 }}>·</span>
                          <span>{formatDate(note.createdAt)}</span>
                        </div>
                        <div
                          style={{
                            fontSize: '0.8125rem',
                            color: '#713F12',
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word',
                            lineHeight: 1.4,
                          }}
                        >
                          {note.content}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
