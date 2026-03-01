/**
 * Helper-Funktionen für Email/Telefonnotiz-Display und -Mapping
 */

/**
 * Gibt das "Von"-Feld für die Anzeige zurück
 * Bei Telefonnotizen: phoneNumber, bei E-Mails: from
 */
export function getDisplayFrom(email: { from?: string; phoneNumber?: string; type?: 'email' | 'phone_note' }): string | null {
  if (email.type === 'phone_note') {
    return email.phoneNumber || null;
  }
  return email.from || null;
}

/**
 * Gibt das Label für das "Von"-Feld zurück
 * Bei Telefonnotizen: "Telefonnummer:", bei E-Mails: "Von:"
 */
export function getDisplayFromLabel(email: { type?: 'email' | 'phone_note' }): string {
  return email.type === 'phone_note' ? 'Telefonnummer:' : 'Von:';
}

/**
 * Gibt ein geparstes Objekt für das "Von"-Feld zurück
 * Ähnlich wie parseFrom(), aber unterstützt auch Telefonnotizen
 */
export function getDisplayFromParsed(email: { from?: string; phoneNumber?: string; type?: 'email' | 'phone_note' }): {
  name: string;
  email?: string;
  phoneNumber?: string;
  isPhoneNote: boolean;
} {
  if (email.type === 'phone_note') {
    return {
      name: email.phoneNumber || 'Unbekannt',
      phoneNumber: email.phoneNumber || undefined,
      isPhoneNote: true,
    };
  }

  // Für E-Mails: Parse from-Feld (ähnlich wie parseFrom())
  const from = email.from || '';
  
  // Prüfe ob Format "Name <email@example.com>" oder nur "email@example.com"
  const emailMatch = from.match(/^(.+?)\s*<(.+?)>$/);
  if (emailMatch) {
    return {
      name: emailMatch[1].trim(),
      email: emailMatch[2].trim(),
      isPhoneNote: false,
    };
  }

  // Nur E-Mail-Adresse
  return {
    name: from || 'Unbekannt',
    email: from || undefined,
    isPhoneNote: false,
  };
}

/**
 * Mappt eine Datenbank-Zeile zu einem Email-Objekt
 * Konsistentes Response-Mapping für alle API-Endpunkte
 */
export function mapEmailRow(row: any): {
  id: string;
  subject: string;
  from: string | null;
  to: string[];
  cc?: string[];
  bcc?: string[];
  body?: string;
  date: string;
  read: boolean;
  completed?: boolean;
  deleted?: boolean;
  spam?: boolean;
  important?: boolean;
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
  hasNotes?: boolean;
  noteCount?: number;
  lastNotePreview?: {
    content: string;
    userName: string;
    createdAt: string;
  };
} {
  // Bestimme from-Feld basierend auf type
  let from: string | null = null;
  if (row.type === 'phone_note') {
    from = row.phone_number || null;
  } else {
    from = row.from_email || null;
  }

  // Parse to_email
  let to: string[] = [];
  if (row.to_email) {
    if (Array.isArray(row.to_email)) {
      to = row.to_email;
    } else if (typeof row.to_email === 'string') {
      to = row.to_email.split(',').map((e: string) => e.trim()).filter(Boolean);
    }
  }

  // Parse cc_email
  let cc: string[] | undefined = undefined;
  if (row.cc_email) {
    if (Array.isArray(row.cc_email)) {
      cc = row.cc_email;
    } else if (typeof row.cc_email === 'string') {
      cc = row.cc_email.split(',').map((e: string) => e.trim()).filter(Boolean);
    }
  }

  // Parse bcc_email
  let bcc: string[] | undefined = undefined;
  if (row.bcc_email) {
    if (Array.isArray(row.bcc_email)) {
      bcc = row.bcc_email;
    } else if (typeof row.bcc_email === 'string') {
      bcc = row.bcc_email.split(',').map((e: string) => e.trim()).filter(Boolean);
    }
  }

  return {
    id: row.id,
    subject: row.subject || '(Kein Betreff)',
    from,
    to,
    cc,
    bcc,
    body: row.body,
    date: row.created_at || row.date,
    read: !!row.read_at,
    completed: !!row.completed_at,
    deleted: !!row.deleted_at,
    spam: !!row.spam_at,
    important: !!row.important_at,
    hasAttachment: row.has_attachment || false,
    ticketId: row.ticket_id || undefined,
    isConversationThread: row.is_conversation_thread || false,
    conversationMessageCount: row.conversation_message_count || 0,
    themeId: row.theme_id || row.theme_id_full || null,
    theme: row.theme_id_full ? {
      id: row.theme_id_full,
      name: row.theme_name || 'Unbekannt',
      color: row.theme_color || null,
    } : null,
    departmentId: row.department_id || row.department_id_val || null,
    department: row.department_id_val ? {
      id: row.department_id_val,
      name: row.department_name || 'Unbekannt',
    } : null,
    type: row.type || 'email',
    phoneNumber: row.phone_number || undefined,
    hasNotes: (row.note_count || 0) > 0,
    noteCount: row.note_count ?? 0,
    lastNotePreview:
      row.last_note_content != null
        ? {
            content: row.last_note_content || '',
            userName: row.last_note_user_name || 'Unbekannt',
            createdAt:
              row.last_note_created_at instanceof Date
                ? row.last_note_created_at.toISOString()
                : String(row.last_note_created_at || ''),
          }
        : undefined,
  };
}
