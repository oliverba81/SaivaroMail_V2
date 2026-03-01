import { getTenantDbClient } from './tenant-db-client';

export interface EmailNote {
  id: string;
  emailId: string;
  userId: string;
  userName?: string;
  userEmail?: string;
  content: string;
  createdAt: string;
}

const MAX_CONTENT_LENGTH = 2000;

/**
 * Prüft, ob der User die E-Mail sehen darf (user_id oder Abteilung)
 */
export async function userCanAccessEmail(
  companyId: string,
  emailId: string,
  userId: string
): Promise<boolean> {
  const client = await getTenantDbClient(companyId);
  try {
    const result = await client.query(
      `SELECT 1 FROM emails e
       LEFT JOIN user_departments ud ON e.department_id = ud.department_id AND ud.user_id = $2
       WHERE e.id = $1 AND (e.user_id = $2 OR ud.department_id IS NOT NULL)
       LIMIT 1`,
      [emailId, userId]
    );
    return result.rows.length > 0;
  } finally {
    client.release();
  }
}

/**
 * Lädt alle Kommentare zu einer E-Mail (nur wenn User die E-Mail sehen darf)
 */
export async function getEmailNotes(
  companyId: string,
  emailId: string,
  userId: string,
  limit: number = 100,
  sort: 'asc' | 'desc' = 'desc'
): Promise<EmailNote[]> {
  const canAccess = await userCanAccessEmail(companyId, emailId, userId);
  if (!canAccess) {
    return [];
  }

  const client = await getTenantDbClient(companyId);
  try {
    const result = await client.query(
      `SELECT en.id, en.email_id, en.user_id, en.content, en.created_at,
              COALESCE(
                NULLIF(TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))), ''),
                u.username,
                u.email,
                'Unbekannt'
              ) as user_name,
              u.email as user_email
       FROM email_notes en
       LEFT JOIN users u ON en.user_id = u.id
       WHERE en.email_id = $1
       ORDER BY en.created_at ${sort.toUpperCase()}
       LIMIT $2`,
      [emailId, limit]
    );

    return result.rows.map((row) => ({
      id: row.id,
      emailId: row.email_id,
      userId: row.user_id,
      userName: row.user_name || undefined,
      userEmail: row.user_email || undefined,
      content: row.content,
      createdAt:
        row.created_at instanceof Date
          ? row.created_at.toISOString()
          : row.created_at,
    }));
  } finally {
    client.release();
  }
}

/**
 * Erstellt einen neuen Kommentar (Trim + Leer-Prüfung, max 2000 Zeichen)
 */
export async function createEmailNote(
  companyId: string,
  emailId: string,
  userId: string,
  content: string
): Promise<EmailNote | null> {
  const trimmed = (content || '').trim();
  if (trimmed.length === 0) {
    return null;
  }
  if (trimmed.length > MAX_CONTENT_LENGTH) {
    return null;
  }

  const canAccess = await userCanAccessEmail(companyId, emailId, userId);
  if (!canAccess) {
    return null;
  }

  const client = await getTenantDbClient(companyId);
  try {
    const result = await client.query(
      `INSERT INTO email_notes (email_id, user_id, content)
       VALUES ($1, $2, $3)
       RETURNING id, email_id, user_id, content, created_at`,
      [emailId, userId, trimmed]
    );
    const row = result.rows[0];
    if (!row) return null;

    const userResult = await client.query(
      `SELECT COALESCE(NULLIF(TRIM(CONCAT(COALESCE(first_name, ''), ' ', COALESCE(last_name, ''))), ''), username, email, 'Unbekannt') as user_name, email as user_email
       FROM users WHERE id = $1`,
      [row.user_id]
    );
    const u = userResult.rows[0];

    return {
      id: row.id,
      emailId: row.email_id,
      userId: row.user_id,
      userName: u?.user_name || undefined,
      userEmail: u?.user_email || undefined,
      content: row.content,
      createdAt:
        row.created_at instanceof Date
          ? row.created_at.toISOString()
          : row.created_at,
    };
  } finally {
    client.release();
  }
}

/**
 * Aktualisiert einen Kommentar (nur eigener User; Trim + Leer-Prüfung, max 2000)
 */
export async function updateEmailNote(
  companyId: string,
  noteId: string,
  userId: string,
  content: string
): Promise<EmailNote | null> {
  const trimmed = (content || '').trim();
  if (trimmed.length === 0) {
    return null;
  }
  if (trimmed.length > MAX_CONTENT_LENGTH) {
    return null;
  }

  const client = await getTenantDbClient(companyId);
  try {
    const result = await client.query(
      `UPDATE email_notes SET content = $1
       WHERE id = $2 AND user_id = $3
       RETURNING id, email_id, user_id, content, created_at`,
      [trimmed, noteId, userId]
    );
    const row = result.rows[0];
    if (!row) return null;

    const userResult = await client.query(
      `SELECT COALESCE(NULLIF(TRIM(CONCAT(COALESCE(first_name, ''), ' ', COALESCE(last_name, ''))), ''), username, email, 'Unbekannt') as user_name, email as user_email
       FROM users WHERE id = $1`,
      [row.user_id]
    );
    const u = userResult.rows[0];

    return {
      id: row.id,
      emailId: row.email_id,
      userId: row.user_id,
      userName: u?.user_name || undefined,
      userEmail: u?.user_email || undefined,
      content: row.content,
      createdAt:
        row.created_at instanceof Date
          ? row.created_at.toISOString()
          : row.created_at,
    };
  } finally {
    client.release();
  }
}

/**
 * Löscht einen Kommentar (nur eigener User)
 */
export async function deleteEmailNote(
  companyId: string,
  noteId: string,
  userId: string
): Promise<boolean> {
  const client = await getTenantDbClient(companyId);
  try {
    const result = await client.query(
      `DELETE FROM email_notes WHERE id = $1 AND user_id = $2`,
      [noteId, userId]
    );
    return (result.rowCount ?? 0) > 0;
  } finally {
    client.release();
  }
}

export { MAX_CONTENT_LENGTH };
