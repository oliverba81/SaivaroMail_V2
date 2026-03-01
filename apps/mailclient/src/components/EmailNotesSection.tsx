'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { FiEdit2, FiTrash2, FiCopy } from 'react-icons/fi';
import { useToast } from '@/components/ToastProvider';
import { useConfirm } from '@/components/ConfirmDialog';
import type { EmailNoteFromApi } from './EmailTimeline';

const MAX_NOTE_LENGTH = 2000;

interface EmailNotesSectionProps {
  emailId: string;
  notes: EmailNoteFromApi[];
  onNotesChange: () => void;
  focusNotesOnMount?: boolean;
  /** Wird nach Hinzufügen/Löschen eines Kommentars aufgerufen, damit die Mailliste (Kommentar-Symbol) aktualisiert wird */
  onNoteAdded?: () => void;
}

function getNoteAuthorDisplay(note: EmailNoteFromApi): string {
  if (note.userName) return note.userName;
  if (note.userEmail) return note.userEmail;
  return 'Unbekannt';
}

function formatNoteDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function EmailNotesSection({
  emailId,
  notes,
  onNotesChange,
  focusNotesOnMount = false,
  onNoteAdded,
}: EmailNotesSectionProps) {
  const router = useRouter();
  const toast = useToast();
  const { confirm } = useConfirm();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [newContent, setNewContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
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

  useEffect(() => {
    if (focusNotesOnMount && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [focusNotesOnMount]);

  const handleAddNote = useCallback(async () => {
    const content = newContent.trim();
    if (content.length === 0) {
      toast?.showError?.('Bitte Text eingeben');
      return;
    }
    if (content.length > MAX_NOTE_LENGTH) {
      toast?.showError?.(`Kommentar darf maximal ${MAX_NOTE_LENGTH} Zeichen haben`);
      return;
    }
    setSubmitting(true);
    try {
      const token = localStorage.getItem('mailclient_token');
      const res = await fetch(`/api/emails/${emailId}/notes`, {
        method: 'POST',
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
        setNewContent('');
        onNotesChange();
        onNoteAdded?.();
        toast?.showSuccess?.('Kommentar hinzugefügt');
      } else {
        const err = await res.json().catch(() => ({}));
        toast?.showError?.(err.error || 'Hinzufügen fehlgeschlagen');
      }
    } catch (err) {
      toast?.showError?.('Hinzufügen fehlgeschlagen');
    } finally {
      setSubmitting(false);
    }
  }, [emailId, newContent, onNotesChange, onNoteAdded, router, toast]);

  const handleCopyNote = useCallback(
    async (content: string) => {
      try {
        await navigator.clipboard.writeText(content);
        toast?.showSuccess?.('In Zwischenablage kopiert') ?? console.log('Kopiert');
      } catch (err) {
        toast?.showError?.('Kopieren fehlgeschlagen') ?? console.error(err);
      }
    },
    [toast]
  );

  const handleStartEdit = useCallback((note: EmailNoteFromApi) => {
    setEditingNoteId(note.id);
    setEditContent(note.content);
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (!editingNoteId || savingNote) return;
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
        setEditingNoteId(null);
        setEditContent('');
        onNotesChange();
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
  }, [emailId, editingNoteId, editContent, onNotesChange, router, toast, savingNote]);

  const handleCancelEdit = useCallback(() => {
    setEditingNoteId(null);
    setEditContent('');
  }, []);

  const handleDeleteNote = useCallback(
    async (note: EmailNoteFromApi) => {
      if (deletingNoteId) return;
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
          onNotesChange();
          onNoteAdded?.();
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
    },
    [emailId, deletingNoteId, onNotesChange, onNoteAdded, router, toast, confirm]
  );

  return (
    <div className="border-t border-[#E5E7EB] bg-[#F9FAFB] flex-shrink-0 shrink-0" style={{ pointerEvents: 'auto' }}>
      <div className="px-4 py-3">
        {notes.length === 0 ? (
          <p className="text-sm text-[#6B7280] mb-3">Noch keine Kommentare. Fügen Sie einen hinzu.</p>
        ) : (
          <ul className="mb-4">
            {notes.map((note, index) => {
              const isOwn = currentUserId && note.userId === currentUserId;
              const isEditing = editingNoteId === note.id;
              return (
                <li
                  key={note.id}
                  className="bg-white border border-[#E5E7EB] rounded-md p-3 shadow-sm"
                  style={{ marginBottom: index < notes.length - 1 ? '0.5rem' : 0 }}
                >
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <span className="text-xs text-[#6B7280]">
                        {getNoteAuthorDisplay(note)} · {formatNoteDate(note.createdAt)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => handleCopyNote(note.content)}
                        title="Kopieren"
                        className="p-1 rounded text-[#6B7280] hover:bg-[#E5E7EB]"
                        aria-label="Kommentar kopieren"
                      >
                        <FiCopy size={14} />
                      </button>
                      {isOwn && !isEditing && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleStartEdit(note)}
                            title="Bearbeiten"
                            className="p-1 rounded text-[#6B7280] hover:bg-[#E5E7EB]"
                            aria-label="Kommentar bearbeiten"
                          >
                            <FiEdit2 size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteNote(note)}
                            disabled={!!deletingNoteId}
                            title="Löschen"
                            className="p-1 rounded text-[#6B7280] hover:bg-[#E5E7EB] disabled:opacity-50"
                            aria-label="Kommentar löschen"
                          >
                            <FiTrash2 size={14} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  {isEditing ? (
                    <div className="mt-2">
                      <textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        maxLength={MAX_NOTE_LENGTH}
                        rows={3}
                        className="w-full px-3 py-2 text-sm border border-[#E5E7EB] rounded-md resize-y"
                        aria-label="Kommentar bearbeiten"
                      />
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-xs text-[#6B7280]">
                          {editContent.length} / {MAX_NOTE_LENGTH}
                        </span>
                        <button
                          type="button"
                          onClick={handleSaveEdit}
                          disabled={savingNote}
                          className="px-3 py-1 text-xs bg-[#007bff] text-white rounded hover:bg-[#0056b3] disabled:opacity-50"
                        >
                          {savingNote ? 'Speichern…' : 'Speichern'}
                        </button>
                        <button
                          type="button"
                          onClick={handleCancelEdit}
                          disabled={savingNote}
                          className="px-3 py-1 text-xs bg-[#6B7280] text-white rounded hover:bg-[#4B5563] disabled:opacity-50"
                        >
                          Abbrechen
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-1 text-sm text-[#1F2937] whitespace-pre-wrap break-words">
                      {note.content}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        <div style={{ marginTop: '0.5rem' }}>
          <textarea
            ref={textareaRef}
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            maxLength={MAX_NOTE_LENGTH}
            rows={3}
            placeholder="Neuer Kommentar (max. 2000 Zeichen)"
            className="w-full px-3 py-2 text-sm border border-[#E5E7EB] rounded-md resize-y bg-white"
            aria-label="Neuer Kommentar (max. 2000 Zeichen)"
            readOnly={false}
          />
          <div className="flex items-center justify-between mt-2 gap-2 flex-wrap">
            <span className="text-xs text-[#6B7280]">
              {newContent.length} / {MAX_NOTE_LENGTH}
            </span>
            <button
              type="button"
              onClick={handleAddNote}
              disabled={submitting}
              className="px-4 py-2 text-sm font-medium bg-[#28a745] text-white rounded-md hover:bg-[#218838] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Wird hinzugefügt…' : 'Kommentar hinzufügen'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
