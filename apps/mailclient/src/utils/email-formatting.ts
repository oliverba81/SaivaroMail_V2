/**
 * Utility-Funktionen für E-Mail/Telefonnotiz-Body-Formatierung
 * (Antworten, Weiterleiten)
 */

/**
 * Formatiert den Body für eine Antwort
 * @param email - Die ursprüngliche E-Mail/Telefonnotiz
 * @param userEmail - Die E-Mail-Adresse des aktuellen Benutzers
 * @param type - Optional: Typ der Antwort ('email' oder 'phone_note')
 */
export function formatReplyBody(
  email: { from?: string; phoneNumber?: string; body?: string; date?: string | Date; type?: 'email' | 'phone_note' },
  _userEmail: string,
  type?: 'email' | 'phone_note'
): string {
  const emailType = type || email.type || 'email';
  const date = email.date ? new Date(email.date) : new Date();
  const dateStr = date.toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  // HTML-Tags entfernen (einfache Lösung)
  const plainBody = email.body?.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ') || '';

  // Jede Zeile mit > einrücken
  const quotedBody = plainBody
    .split('\n')
    .map(line => `> ${line}`)
    .join('\n');

  if (emailType === 'phone_note') {
    const phoneNumber = email.phoneNumber || email.from || 'Unbekannt';
    return `Am ${dateStr} rief ${phoneNumber} an:\n\n${quotedBody}\n\n`;
  } else {
    const from = email.from || 'Unbekannt';
    return `Am ${dateStr} schrieb ${from}:\n\n${quotedBody}\n\n`;
  }
}

/**
 * Formatiert den Body für eine Weiterleitung
 * @param email - Die ursprüngliche E-Mail/Telefonnotiz
 * @param type - Optional: Typ der Weiterleitung ('email' oder 'phone_note')
 */
export function formatForwardBody(
  email: { from?: string; phoneNumber?: string; to?: string | string[]; subject?: string; body?: string; date?: string | Date; type?: 'email' | 'phone_note' },
  type?: 'email' | 'phone_note'
): string {
  const emailType = type || email.type || 'email';
  const date = email.date ? new Date(email.date) : new Date();
  const dateStr = date.toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const toStr = Array.isArray(email.to) ? email.to.join(', ') : (email.to || '');

  if (emailType === 'phone_note') {
    const phoneNumber = email.phoneNumber || email.from || 'Unbekannt';
    return `---------- Weitergeleitete Telefonnotiz ----------\nTelefonnummer: ${phoneNumber}\nDatum: ${dateStr}\nBetreff: ${email.subject || '(Kein Betreff)'}\n\n${email.body || '(Kein Inhalt)'}\n`;
  } else {
    const from = email.from || 'Unbekannt';
    return `---------- Weitergeleitete Nachricht ----------\nVon: ${from}\nDatum: ${dateStr}\nAn: ${toStr}\nBetreff: ${email.subject || '(Kein Betreff)'}\n\n${email.body || '(Kein Inhalt)'}\n`;
  }
}

export interface NoteForForward {
  userName?: string;
  userEmail?: string;
  content: string;
  createdAt: string;
}

/**
 * Formatiert einen Kommentar-Block für die Weiterleitung (Plain-Text)
 * @param notes - Liste der Kommentare (Autor, Datum, Inhalt)
 */
export function formatNotesBlock(notes: NoteForForward[]): string {
  if (!notes || notes.length === 0) return '';
  const lines: string[] = ['---------- Kommentare ----------'];
  for (const note of notes) {
    const author = note.userName || note.userEmail || 'Unbekannt';
    const date = note.createdAt
      ? new Date(note.createdAt).toLocaleString('de-DE', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      : '';
    lines.push('');
    lines.push(`${author}, ${date}:`);
    lines.push((note.content || '').trim());
  }
  lines.push('');
  return lines.join('\n');
}
