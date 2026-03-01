'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { addTicketIdToSubject } from '@/lib/ticket-id-generator';
import { formatReplyBody } from '@/utils/email-formatting';
import {
  replaceSignaturePlaceholders,
  looksLikeHtml,
  stripHtml,
  isEmptyEditorHtml,
  trimTrailingEmptyParagraphs,
  collapseEmptyParagraphsBeforeHr,
  collapseConsecutiveEmptyParagraphs,
} from '@/utils/signature-placeholders';
import SignatureEditor from '@/components/SignatureEditor';

export type ReplyComposerContext = {
  kind: 'email' | 'phone_note';
  /** Fehlt = neue E-Mail/Telefonnotiz */
  replyToId?: string;
  replyType?: 'email' | 'phone_note';
};

function plainToHtml(plain: string): string {
  if (!plain || !plain.trim()) return '<p></p>';
  const escaped = plain
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return escaped
    .split(/\n\n+/)
    .map((p) => '<p>' + p.replace(/\n/g, '<br>') + '</p>')
    .join('');
}

function addSubjectPrefix(subject: string, prefix: string): string {
  const trimmed = (subject || '').trim();
  const upperPrefix = prefix.toUpperCase().trim();
  if (trimmed.toUpperCase().startsWith(upperPrefix)) return trimmed;
  return `${prefix.trim()} ${trimmed}`;
}

/** Eine Leerzeile im HTML-Editor (für Abstand oberhalb Signatur / um Trennlinie). */
const BLANK_LINE_HTML = '<p><br></p>';
/** Horizontale Linie + Leerzeile darunter (keine Leerzeile vor dem hr). */
const SIGNATURE_SEPARATOR_HTML = '<hr>' + BLANK_LINE_HTML;

interface ReplyComposerProps {
  replyContext: ReplyComposerContext;
  onSent: () => void;
  onCloseReply: () => void;
  onDraftDirtyChange: (dirty: boolean) => void;
  /** Bei neuer E-Mail/Telefonnotiz: Betreff-Änderungen für Tab-Label durchreichen */
  onSubjectChange?: (subject: string) => void;
  /** Bei Antwort-Tab: Betreff der geantworteten E-Mail für Tab-Label "Antwort: <Betreff>" durchreichen */
  onReplyToSubjectLoaded?: (subject: string) => void;
  onRefresh: () => void;
  focusOnMount?: boolean;
  /** Wenn true, Editor fokussieren (auch beim Zurückwechseln in den Reply-Tab). */
  isReplyTabActive?: boolean;
}

export default function ReplyComposer({
  replyContext,
  onSent,
  onCloseReply,
  onDraftDirtyChange,
  onSubjectChange,
  onReplyToSubjectLoaded,
  onRefresh,
  focusOnMount = true,
  isReplyTabActive = true,
}: ReplyComposerProps) {
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [cc, setCc] = useState('');
  const [showCcBcc, setShowCcBcc] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingEmail, setLoadingEmail] = useState(true);
  const [error, setError] = useState('');
  const [originalEmail, setOriginalEmail] = useState<any>(null);
  const [departmentId, setDepartmentId] = useState('');
  const [departments, setDepartments] = useState<
    { id: string; name: string; isActive: boolean; signature?: string | null; signaturePlain?: string | null; signatureEnabled?: boolean }[]
  >([]);
  const [loadingDepartments, setLoadingDepartments] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [markOriginalCompletedOnSend, setMarkOriginalCompletedOnSend] = useState(true);
  const [markCurrentCompletedOnSend, setMarkCurrentCompletedOnSend] = useState(true);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [patchErrorMessage, setPatchErrorMessage] = useState<string | null>(null);
  const [themeRequired, setThemeRequired] = useState(false);
  const [themes, setThemes] = useState<{ id: string; name: string; color?: string | null }[]>([]);
  const [themeId, setThemeId] = useState<string>('');
  const [loadingThemes, setLoadingThemes] = useState(false);
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const patchErrorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialSetRef = useRef(false);
  const signatureAppendedForNewRef = useRef(false);
  const signatureAppendedForReplyIdRef = useRef<string | null>(null);
  const prevReplyToIdRef = useRef<string | undefined>(undefined);
  const isNewCompose = !replyContext.replyToId;
  const isNewPhoneNote = isNewCompose && replyContext.kind === 'phone_note';
  /** Antwort als Telefonnotiz (egal ob Quelle E-Mail oder Telefonnotiz) */
  const replyAsPhoneNote = Boolean(replyContext.replyToId && replyContext.replyType === 'phone_note');

  const loadEmail = useCallback(async () => {
    if (!replyContext.replyToId) {
      setLoadingEmail(false);
      return;
    }
    try {
      setLoadingEmail(true);
      setError('');
      const token = localStorage.getItem('mailclient_token');
      if (!token) return;
      const response = await fetch(`/api/emails/${replyContext.replyToId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.status === 401) {
        localStorage.removeItem('mailclient_token');
        localStorage.removeItem('mailclient_user');
        return;
      }
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || 'Fehler beim Laden der E-Mail');
        return;
      }
      const email = data.email;
      setOriginalEmail(email);
      onReplyToSubjectLoaded?.(email.subject || '');

      const userData = localStorage.getItem('mailclient_user');
      let userEmailForReply = '';
      if (userData) {
        try {
          const parsed = JSON.parse(userData);
          userEmailForReply = parsed.email || '';
        } catch { /* ignore parse error */ }
      }

      if (replyContext.kind === 'phone_note' && replyContext.replyType === 'phone_note') {
        setTo('');
      } else {
        setTo(email.from || '');
      }
      if (replyContext.replyType === 'phone_note' && email.phoneNumber) {
        setPhoneNumber(email.phoneNumber);
      }
      let replySubject = addSubjectPrefix(email.subject || '', 'Re:');
      if (email.ticketId) {
        replySubject = addTicketIdToSubject(replySubject, email.ticketId);
      }
      setSubject(replySubject);
      // Bei E-Mail-Antwort Body nicht hier setzen – ein Effect setzt ihn einmalig mit Signatur + Zitat
      // Bei Antwort als Notiz weder Zitat noch Signatur – Body leer lassen
      if (replyContext.kind !== 'email' && replyContext.replyType !== 'phone_note') {
        setBody(plainToHtml(formatReplyBody(email, userEmailForReply, replyContext.replyType || replyContext.kind)));
      }
      if (replyContext.replyType === 'phone_note') {
        setBody(BLANK_LINE_HTML);
      }
      if (email.departmentId) setDepartmentId(email.departmentId);
      setThemeId(email.themeId ?? '');
    } catch (err) {
      setError('Fehler beim Laden der E-Mail');
    } finally {
      setLoadingEmail(false);
    }
  }, [replyContext.replyToId, replyContext.kind, replyContext.replyType]);

  useEffect(() => {
    loadEmail();
  }, [loadEmail]);

  const loadDepartments = useCallback(async () => {
    try {
      setLoadingDepartments(true);
      const token = localStorage.getItem('mailclient_token');
      if (!token) return;
      const response = await fetch('/api/departments', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        const active = (data.departments || []).filter((d: any) => d.isActive);
        setDepartments(active);
        setDepartmentId((prev) => {
          if (prev && active.some((d: any) => d.id === prev)) return prev;
          if (active.length === 0) return '';
          const defaultId = localStorage.getItem('lastUsedDepartmentId');
          const found = active.find((d: any) => d.id === defaultId);
          return found ? found.id : active[0].id;
        });
      }
    } catch (err) {
      console.error('Fehler beim Laden der Abteilungen:', err);
    } finally {
      setLoadingDepartments(false);
    }
  }, []);

  useEffect(() => {
    loadDepartments();
  }, [loadDepartments]);

  const loadSettings = useCallback(async () => {
    const token = localStorage.getItem('mailclient_token');
    if (!token) return;
    try {
      const response = await fetch('/api/settings', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        const required = Boolean(data.settings?.themeRequired);
        setThemeRequired(required);
        if (required) {
          setLoadingThemes(true);
          try {
            const themesRes = await fetch('/api/themes', {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (themesRes.ok) {
              const themesData = await themesRes.json();
              setThemes(themesData.themes ?? []);
            }
          } finally {
            setLoadingThemes(false);
          }
        }
      }
    } catch (err) {
      console.error('Fehler beim Laden der Einstellungen:', err);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // Ref zurücksetzen, wenn Abteilung wechselt (andere Signatur)
  useEffect(() => {
    signatureAppendedForNewRef.current = false;
  }, [departmentId]);

  // Ref nur zurücksetzen, wenn replyToId sich geändert hat (anderer Tab), nicht bei jedem Re-Render
  useEffect(() => {
    if (prevReplyToIdRef.current !== replyContext.replyToId) {
      signatureAppendedForReplyIdRef.current = null;
      prevReplyToIdRef.current = replyContext.replyToId;
    }
  }, [replyContext.replyToId]);

  // Hilfsfunktion: Abteilung und Signatur-HTML ermitteln
  const getSignatureHtml = useCallback(() => {
    const dept = departments.find((d) => d.id === departmentId) ?? departments[0];
    const plainSignature =
      dept?.signaturePlain?.trim() ||
      (!looksLikeHtml(dept?.signature ?? '') ? dept?.signature?.trim() : stripHtml(dept?.signature ?? '')?.trim()) ||
      '';
    const hasHtmlSignature =
      !isEmptyEditorHtml(dept?.signature ?? '') && (dept?.signature?.trim()?.length ?? 0) > 0;
    const hasSignature =
      dept?.signatureEnabled && (plainSignature.length > 0 || hasHtmlSignature);
    if (!dept || !hasSignature) return '';
    const userData = localStorage.getItem('mailclient_user');
    let user: { userName?: string; firstName?: string; lastName?: string } = {};
    if (userData) {
      try {
        const parsed = JSON.parse(userData);
        user = {
          userName: parsed.username ?? parsed.userName ?? '',
          firstName: parsed.firstName ?? '',
          lastName: parsed.lastName ?? '',
        };
      } catch {
        /* ignore */
      }
    }
    const context = { company: null, user };
    return hasHtmlSignature && dept.signature
      ? replaceSignaturePlaceholders(dept.signature, context)
      : plainSignature
        ? plainToHtml(replaceSignaturePlaceholders(plainSignature, context))
        : '';
  }, [departmentId, departments]);

  // Signatur bei neuer E-Mail: Leerzeile + Signatur (bei neuer Telefonnotiz keine Signatur)
  useEffect(() => {
    if (!isNewCompose || loadingDepartments || departments.length === 0 || signatureAppendedForNewRef.current) {
      return;
    }
    if (replyContext.kind === 'phone_note') return;
    const signatureHtml = getSignatureHtml();
    if (!signatureHtml || isEmptyEditorHtml(signatureHtml)) return;
    signatureAppendedForNewRef.current = true;
    const normalized = collapseConsecutiveEmptyParagraphs(signatureHtml);
    const trimmedSignature = trimTrailingEmptyParagraphs(normalized);
    setBody((prev) => (isEmptyEditorHtml(prev) ? BLANK_LINE_HTML + trimmedSignature : prev));
  }, [isNewCompose, replyContext.kind, departmentId, departments, loadingDepartments, getSignatureHtml]);

  // Einmalig: Reply-Body = Signatur + Linie + Zitat (nur bei E-Mail-Antwort).
  // Kein zweiter Effect mehr – Body wird an einer Stelle gesetzt, sobald E-Mail + Abteilungen da sind (keine Race Condition).
  useEffect(() => {
    if (
      isNewCompose ||
      replyContext.kind !== 'email' ||
      loadingDepartments ||
      departments.length === 0 ||
      loadingEmail ||
      replyContext.replyToId == null ||
      !originalEmail ||
      signatureAppendedForReplyIdRef.current === replyContext.replyToId
    ) {
      return;
    }
    let userEmailForReply = '';
    try {
      const userData = localStorage.getItem('mailclient_user');
      if (userData) {
        const parsed = JSON.parse(userData);
        userEmailForReply = parsed.email ?? parsed.userName ?? '';
      }
    } catch {
      /* ignore */
    }
    const quotedHtml = plainToHtml(
      formatReplyBody(originalEmail, userEmailForReply, replyContext.replyType || replyContext.kind)
    );
    // Bei Antwort als Notiz weder Signatur noch Zitat einfügen
    if (replyContext.replyType === 'phone_note') {
      setBody(BLANK_LINE_HTML);
      signatureAppendedForReplyIdRef.current = replyContext.replyToId;
      return;
    }
    const signatureHtml = getSignatureHtml();
    if (!signatureHtml || isEmptyEditorHtml(signatureHtml)) {
      setBody(quotedHtml);
      signatureAppendedForReplyIdRef.current = replyContext.replyToId;
      return;
    }
    const normalized = collapseConsecutiveEmptyParagraphs(signatureHtml);
    const trimmedSignature = trimTrailingEmptyParagraphs(normalized);
    const prefix =
      BLANK_LINE_HTML + trimmedSignature + SIGNATURE_SEPARATOR_HTML;
    const expectedHrIndex = prefix.indexOf('<hr');
    const beforeCollapse = prefix + quotedHtml;
    const fullBody = collapseEmptyParagraphsBeforeHr(beforeCollapse, expectedHrIndex);
    setBody(fullBody);
    signatureAppendedForReplyIdRef.current = replyContext.replyToId;
  }, [
    isNewCompose,
    replyContext.kind,
    replyContext.replyToId,
    replyContext.replyType,
    originalEmail,
    departmentId,
    departments,
    loadingDepartments,
    loadingEmail,
    getSignatureHtml,
  ]);

  useEffect(() => {
    if (initialSetRef.current) return;
    if (!loadingEmail && (to || subject || body)) {
      initialSetRef.current = true;
      onDraftDirtyChange(false);
    }
  }, [loadingEmail, to, subject, body, onDraftDirtyChange]);

  // Timer-Cleanup beim Unmount (kein setState nach Unmount)
  useEffect(() => {
    return () => {
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
      if (patchErrorTimerRef.current) clearTimeout(patchErrorTimerRef.current);
    };
  }, []);

  const markDirty = useCallback(() => {
    onDraftDirtyChange(true);
  }, [onDraftDirtyChange]);

  const handleToChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTo(e.target.value);
    markDirty();
  };
  const handleSubjectChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSubject(value);
    onSubjectChange?.(value);
    markDirty();
  };
  const handleBodyChange = (html: string) => {
    setBody(html);
    markDirty();
  };
  const handleCcChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCc(e.target.value);
    markDirty();
  };
  const handlePhoneNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhoneNumber(e.target.value);
    markDirty();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const sendAsPhoneNote = isNewPhoneNote || replyAsPhoneNote;
    if (sendAsPhoneNote) {
      if (!phoneNumber.trim() || !subject.trim() || isEmptyEditorHtml(body)) {
        setError('Bitte füllen Sie Telefonnummer, Betreff und Inhalt aus.');
        return;
      }
    } else {
      if (!to.trim() || !subject.trim() || isEmptyEditorHtml(body)) {
        setError('Bitte füllen Sie An, Betreff und Inhalt aus.');
        return;
      }
    }
    if (!departmentId) {
      setError('Bitte wählen Sie eine Abteilung aus.');
      return;
    }
    if (themeRequired && (!themeId || (typeof themeId === 'string' && themeId.trim() === ''))) {
      setError('Bitte wählen Sie ein Thema aus');
      return;
    }
    if (sendAsPhoneNote) {
      const { validatePhoneNumber } = await import('@/utils/phone-utils');
      const phoneValidation = validatePhoneNumber(phoneNumber.trim());
      if (!phoneValidation.isValid) {
        setError(phoneValidation.error || 'Ungültige Telefonnummer');
        return;
      }
    }
    try {
      setLoading(true);
      const token = localStorage.getItem('mailclient_token');
      if (!token) return;
      const payload = sendAsPhoneNote
        ? {
            type: 'phone_note',
            phoneNumber: phoneNumber.trim(),
            subject: subject.trim(),
            body,
            departmentId,
            themeId: themeId?.trim() || null,
          }
        : {
            to: to.split(',').map((e) => e.trim()).filter(Boolean),
            cc: cc ? cc.split(',').map((e) => e.trim()).filter(Boolean) : [],
            bcc: [],
            subject: subject.trim(),
            body,
            departmentId,
            themeId: themeId?.trim() || null,
          };
      const response = await fetch('/api/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || 'Fehler beim Senden');
        return;
      }

      // Erfolgsbestätigung anzeigen (auto-ausblendend)
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
      setSuccessMessage(sendAsPhoneNote ? 'Telefonnotiz erstellt' : 'E-Mail gesendet');
      successTimerRef.current = setTimeout(() => {
        successTimerRef.current = null;
        setSuccessMessage(null);
      }, 2500);

      // PATCH: Ursprung und/oder aktuelle Nachricht als erledigt markieren (parallel)
      const patchPromises: Promise<Response>[] = [];
      if (markOriginalCompletedOnSend && replyContext.replyToId) {
        patchPromises.push(
          fetch(`/api/emails/${replyContext.replyToId}`, {
            method: 'PATCH',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ completed: true }),
          })
        );
      }
      if (markCurrentCompletedOnSend && data.email?.id) {
        patchPromises.push(
          fetch(`/api/emails/${data.email.id}`, {
            method: 'PATCH',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ completed: true }),
          })
        );
      }
      if (patchPromises.length > 0) {
        const results = await Promise.allSettled(patchPromises);
        const anyFailed = results.some(
          (r) => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.ok)
        );
        if (anyFailed) {
          if (patchErrorTimerRef.current) clearTimeout(patchErrorTimerRef.current);
          setPatchErrorMessage('Ursprung oder aktuelle Nachricht konnte nicht als erledigt markiert werden.');
          patchErrorTimerRef.current = setTimeout(() => {
            patchErrorTimerRef.current = null;
            setPatchErrorMessage(null);
          }, 4000);
        }
      }

      if (departmentId) localStorage.setItem('lastUsedDepartmentId', departmentId);
      onDraftDirtyChange(false);
      onSent();
      onRefresh();
    } catch (err) {
      setError(sendAsPhoneNote ? 'Fehler beim Erstellen der Telefonnotiz' : 'Fehler beim Senden der E-Mail');
    } finally {
      setLoading(false);
    }
  };

  if (loadingEmail) {
    return (
      <div className="p-4 text-sm text-[#6B7280]">
        {isNewCompose ? 'Lade Abteilungen…' : 'E-Mail wird geladen…'}
      </div>
    );
  }

  const isPhoneNoteSource = replyContext.kind === 'phone_note' && replyContext.replyToId;
  const showPhoneNoteForm = isNewPhoneNote || replyAsPhoneNote;

  return (
    <div className="flex flex-col min-h-0">
      {isPhoneNoteSource && !replyAsPhoneNote && (
        <div className="mb-3 text-sm text-[#6B7280]">
          Antwort auf Telefonnotiz – Sie antworten per E-Mail.
        </div>
      )}
      {replyAsPhoneNote && replyContext.kind === 'email' && (
        <div className="mb-3 text-sm text-[#6B7280]">
          Antwort als Telefonnotiz (Bezug zur E-Mail).
        </div>
      )}
      {error && (
        <div className="mb-3 p-2 rounded bg-red-50 text-red-700 text-sm">
          {error}
        </div>
      )}
      <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 gap-3">
        {departments.length > 0 && (
          <div>
            <label htmlFor="reply-departmentId" className="block text-sm font-medium text-[#374151] mb-1">
              Abteilung: <span className="text-red-500">*</span>
            </label>
            <select
              id="reply-departmentId"
              value={departmentId}
              onChange={(e) => {
                setDepartmentId(e.target.value);
                markDirty();
              }}
              required
              className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2 text-sm"
            >
              <option value="">Bitte wählen</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
        )}
        {loadingDepartments && departments.length === 0 && (
          <div className="text-sm text-[#6B7280]">Lade Abteilungen…</div>
        )}
        {!loadingDepartments && departments.length === 0 && (
          <div className="text-sm text-amber-700">Keine aktive Abteilung. Bitte zuerst eine Abteilung anlegen.</div>
        )}
        {themeRequired && (
          <div>
            <label htmlFor="reply-themeId" className="block text-sm font-medium text-[#374151] mb-1">
              Thema: <span className="text-red-500">*</span>
            </label>
            {loadingThemes ? (
              <div className="text-sm text-[#6B7280]">Lade Themen…</div>
            ) : themes.length === 0 ? (
              <div className="text-sm text-amber-700">Bitte legen Sie unter Einstellungen zuerst Themen an.</div>
            ) : (
              <select
                id="reply-themeId"
                value={themeId}
                onChange={(e) => {
                  setThemeId(e.target.value);
                  markDirty();
                }}
                required
                className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2 text-sm"
              >
                <option value="">Bitte wählen</option>
                {themes.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            )}
          </div>
        )}
        {showPhoneNoteForm ? (
          <div>
            <label htmlFor="reply-phoneNumber" className="block text-sm font-medium text-[#374151] mb-1">
              Telefonnummer: <span className="text-red-500">*</span>
            </label>
            <input
              id="reply-phoneNumber"
              type="tel"
              value={phoneNumber}
              onChange={handlePhoneNumberChange}
              placeholder="+49 123 456789"
              className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2 text-sm"
              required
            />
          </div>
        ) : (
          <>
            <div>
              <label htmlFor="reply-to" className="block text-sm font-medium text-[#374151] mb-1">
                An: <span className="text-red-500">*</span>
              </label>
              <input
                id="reply-to"
                type="text"
                value={to}
                onChange={handleToChange}
                placeholder="empfaenger@example.com"
                className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2 text-sm"
                required
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowCcBcc(!showCcBcc)}
                className="text-sm text-[#2563EB] hover:underline"
              >
                {showCcBcc ? '▼' : '▶'} CC/BCC
              </button>
            </div>
            {showCcBcc && (
              <div>
                <label htmlFor="reply-cc" className="block text-sm font-medium text-[#374151] mb-1">CC:</label>
                <input
                  id="reply-cc"
                  type="text"
                  value={cc}
                  onChange={handleCcChange}
                  placeholder="cc@example.com"
                  className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2 text-sm"
                />
              </div>
            )}
          </>
        )}
        <div>
          <label htmlFor="reply-subject" className="block text-sm font-medium text-[#374151] mb-1">
            Betreff: <span className="text-red-500">*</span>
          </label>
          <input
            id="reply-subject"
            type="text"
            value={subject}
            onChange={handleSubjectChange}
            className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2 text-sm"
            required
          />
        </div>
        <div className="flex-1 flex flex-col min-h-0">
          <label className="block text-sm font-medium text-[#374151] mb-1">
            Nachricht: <span className="text-red-500">*</span>
          </label>
          <div className="flex-1 min-h-[120px] border border-[#E5E7EB] rounded-lg overflow-hidden bg-white">
            <SignatureEditor
              value={body}
              onChange={handleBodyChange}
              placeholder="Nachricht eingeben…"
              minHeight="120px"
              focusOnMount={focusOnMount}
              focusTrigger={isReplyTabActive}
            />
          </div>
        </div>
        {successMessage && (
          <div className="shrink-0 py-1.5 px-2 rounded bg-green-50 text-green-800 text-sm" role="status">
            {successMessage}
          </div>
        )}
        {patchErrorMessage && (
          <div className="shrink-0 py-1.5 px-2 rounded bg-amber-50 text-amber-800 text-sm" role="alert">
            {patchErrorMessage}
          </div>
        )}
        <div className="flex gap-2 shrink-0 pt-2">
          <button
            type="submit"
            disabled={
              loading ||
              departments.length === 0 ||
              (themeRequired && (themes.length === 0 || !themeId?.trim()))
            }
            className="px-4 py-2 bg-[#2563EB] text-white rounded-lg text-sm font-medium hover:bg-[#1D4ED8] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (showPhoneNoteForm ? 'Wird erstellt…' : 'Wird gesendet…') : showPhoneNoteForm ? 'Telefonnotiz erstellen' : 'Senden'}
          </button>
          <button
            type="button"
            onClick={onCloseReply}
            className="px-4 py-2 border border-[#E5E7EB] rounded-lg text-sm font-medium text-[#374151] hover:bg-[#F3F4F6]"
          >
            Abbrechen
          </button>
        </div>
        <div className="shrink-0 pt-2 flex flex-wrap items-center gap-4">
          <span className="text-sm font-medium text-[#374151]">Beim Senden erledigen:</span>
          {replyContext.replyToId && (
            <label
              className="flex items-center gap-2.5 cursor-pointer select-none group"
              tabIndex={0}
              role="switch"
              aria-checked={markOriginalCompletedOnSend}
              aria-label="Ursprung beim Senden erledigen"
              onMouseDown={(e) => e.preventDefault()}
              onClick={(e) => {
                e.preventDefault();
                setMarkOriginalCompletedOnSend((prev) => !prev);
              }}
              onKeyDown={(e) => {
                if (e.key === ' ' || e.key === 'Enter') {
                  e.preventDefault();
                  setMarkOriginalCompletedOnSend((prev) => !prev);
                }
              }}
            >
              <input
                type="checkbox"
                checked={markOriginalCompletedOnSend}
                readOnly
                tabIndex={-1}
                onChange={() => {}}
                disabled={loading}
                className="sr-only"
                aria-hidden
              />
              <span className="relative inline-block h-6 w-11 shrink-0 rounded-full bg-[#D1D5DB] transition-colors duration-200 ease-out group-has-[:checked]:bg-[#2563EB] group-has-[:disabled]:opacity-50 group-focus-within:outline group-focus-within:outline-2 group-focus-within:outline-[#2563EB] group-focus-within:outline-offset-2">
                <span className="absolute left-1 top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200 ease-out group-has-[:checked]:translate-x-5" />
              </span>
              <span className="text-sm text-[#374151] group-hover:text-[#111827]">Ursprung erledigen</span>
            </label>
          )}
          <label
            className="flex items-center gap-2.5 cursor-pointer select-none group"
            tabIndex={0}
            role="switch"
            aria-checked={markCurrentCompletedOnSend}
            aria-label="Aktuelle Nachricht nach dem Senden erledigen"
            onMouseDown={(e) => e.preventDefault()}
            onClick={(e) => {
              e.preventDefault();
              setMarkCurrentCompletedOnSend((prev) => !prev);
            }}
            onKeyDown={(e) => {
              if (e.key === ' ' || e.key === 'Enter') {
                e.preventDefault();
                setMarkCurrentCompletedOnSend((prev) => !prev);
              }
            }}
          >
            <input
              type="checkbox"
              checked={markCurrentCompletedOnSend}
              readOnly
              tabIndex={-1}
              onChange={() => {}}
              disabled={loading}
              className="sr-only"
              aria-hidden
            />
            <span className="relative inline-block h-6 w-11 shrink-0 rounded-full bg-[#D1D5DB] transition-colors duration-200 ease-out group-has-[:checked]:bg-[#2563EB] group-has-[:disabled]:opacity-50 group-focus-within:outline group-focus-within:outline-2 group-focus-within:outline-[#2563EB] group-focus-within:outline-offset-2">
              <span className="absolute left-1 top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200 ease-out group-has-[:checked]:translate-x-5" />
            </span>
            <span className="text-sm text-[#374151] group-hover:text-[#111827]">Diese Nachricht erledigen</span>
          </label>
        </div>
      </form>
    </div>
  );
}
