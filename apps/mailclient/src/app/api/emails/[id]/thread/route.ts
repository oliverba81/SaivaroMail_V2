import { NextRequest, NextResponse } from 'next/server';
import { getTenantContext } from '@/lib/api-tenant-context';
import { EMAIL_REPLY_LOCK_TTL_SECONDS } from '@/lib/tenant-db-migrations';
import { getEmailNotes } from '@/lib/email-notes';

/**
 * GET /api/emails/[id]/thread
 * Lädt alle Nachrichten eines Threads (Ticket) inklusive Reply-Locks und Kommentaren.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: emailId } = await params;
  if (!emailId) {
    return NextResponse.json({ error: 'E-Mail-ID erforderlich' }, { status: 400 });
  }

  const ctx = await getTenantContext(request);
  if ('error' in ctx) return ctx.error;

  const { client, payload, resolvedCompanyId } = ctx;

  if (!resolvedCompanyId) {
    return NextResponse.json(
      { error: 'Company-Kontext nicht verfügbar' },
      { status: 400 }
    );
  }

  try {
    // Rolle und Sichtbarkeit ermitteln
    const roleResult = await client.query(
      `SELECT role FROM users WHERE id = $1`,
      [payload.sub]
    );
    const userRole = roleResult.rows[0]?.role ?? null;
    const isAdmin = String(userRole).toLowerCase() === 'admin';
    const visibilityWhere = isAdmin
      ? '1=1'
      : `(e.user_id = $1 OR ud.department_id IS NOT NULL)`;

    // Basis-E-Mail laden (inkl. Ticket-ID)
    const baseEmailResult = await client.query(
      `SELECT e.id, e.ticket_id
       FROM emails e
       LEFT JOIN user_departments ud ON e.department_id = ud.department_id AND ud.user_id = $1
       WHERE ${visibilityWhere} AND e.id = $2`,
      [payload.sub, emailId]
    );

    if (baseEmailResult.rows.length === 0) {
      return NextResponse.json({ error: 'E-Mail nicht gefunden' }, { status: 404 });
    }

    const baseEmailRow = baseEmailResult.rows[0] as { id: string; ticket_id: string | null };
    const ticketId = baseEmailRow.ticket_id;

    // Thread-E-Mails laden (alle mit gleicher Ticket-ID, sonst nur diese eine)
    const threadQueryParams: any[] = [payload.sub];
    let threadWhereClause: string;

    if (ticketId) {
      threadWhereClause = `e.ticket_id = $2`;
      threadQueryParams.push(ticketId);
    } else {
      threadWhereClause = `e.id = $2`;
      threadQueryParams.push(emailId);
    }

    const threadResult = await client.query(
      `SELECT e.id,
              e.subject,
              e.from_email,
              e.to_email,
              e.cc_email,
              e.bcc_email,
              e.body,
              e.created_at,
              e.ticket_id,
              e.user_id,
              e.has_attachment,
              e.type,
              e.phone_number,
              ers.read_at
       FROM emails e
       LEFT JOIN email_read_status ers
         ON e.id = ers.email_id AND ers.user_id = $1
       LEFT JOIN user_departments ud
         ON e.department_id = ud.department_id AND ud.user_id = $1
       WHERE ${visibilityWhere} AND ${threadWhereClause}
       ORDER BY e.created_at ASC`,
      threadQueryParams
    );

    const rows: any[] = threadResult.rows;

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Keine Nachrichten im Thread gefunden' }, { status: 404 });
    }

    const emailIds = rows.map((row) => row.id as string);

    // Reply-Locks für alle E-Mails im Thread laden (nicht kritisch, Fehler werden geloggt)
    let replyLocksResult: { rows: Array<{ email_id: string; user_id: string; user_name?: string }> } = {
      rows: [],
    };

    if (emailIds.length > 0) {
      try {
        replyLocksResult = await client.query(
          `SELECT erl.email_id, erl.user_id,
             COALESCE(NULLIF(TRIM(erl.user_name), ''),
               NULLIF(TRIM(CONCAT(COALESCE(u.first_name,''), ' ', COALESCE(u.last_name,''))), ''),
               u.username, u.email, 'Unbekannt') AS user_name
           FROM email_reply_locks erl
           LEFT JOIN users u ON u.id = erl.user_id
           WHERE erl.email_id = ANY($1::uuid[])
             AND erl.heartbeat_at > NOW() - INTERVAL '1 second' * $2`,
          [emailIds, EMAIL_REPLY_LOCK_TTL_SECONDS]
        );
      } catch (lockErr: any) {
        // Tabelle/Spalten könnten (noch) nicht existieren – dieselbe defensive Behandlung wie in /api/emails
        if (lockErr?.code === '42P01') {
          // undefined_table – Tabelle existiert noch nicht
        } else if (lockErr?.code === '42703') {
          // undefined_column – Tabelle hat anderes Schema (z. B. ohne user_name/heartbeat_at)
          try {
            replyLocksResult = await client.query(
              `SELECT erl.email_id, erl.user_id,
                 COALESCE(NULLIF(TRIM(CONCAT(COALESCE(u.first_name,''), ' ', COALESCE(u.last_name,''))), ''),
                   u.username, u.email, 'Unbekannt') AS user_name
               FROM email_reply_locks erl
               LEFT JOIN users u ON u.id = erl.user_id
               WHERE erl.email_id = ANY($1::uuid[])`,
              [emailIds]
            );
          } catch (fallbackErr: any) {
            if (fallbackErr?.code !== '42P01' && fallbackErr?.code !== '42703') {
              throw fallbackErr;
            }
          }
        } else {
          throw lockErr;
        }
      }
    }

    const replyLockMap = new Map<string, { userId: string; userName: string }>();
    replyLocksResult.rows.forEach((row: any) => {
      replyLockMap.set(row.email_id, {
        userId: row.user_id,
        userName: row.user_name || 'Unbekannt',
      });
    });

    // Kommentare (Notes) für alle E-Mails im Thread laden
    const notesByEmail = new Map<
      string,
      Array<{ content: string; userName: string; createdAt: string }>
    >();

    for (const id of emailIds) {
      const notes = await getEmailNotes(resolvedCompanyId, id, payload.sub, 100, 'asc');
      notesByEmail.set(
        id,
        notes.map((note) => ({
          content: note.content,
          userName: note.userName || note.userEmail || 'Unbekannt',
          createdAt: note.createdAt,
        }))
      );
    }

    // Thread-E-Mails in API-Response-Format bringen
    const emails = rows.map((row) => {
      const id: string = row.id;

      // from: bei Telefonnotizen Telefonnummer statt E-Mail
      const from: string | null =
        row.type === 'phone_note'
          ? row.phone_number || null
          : row.from_email || null;

      // to / cc / bcc auf Arrays normalisieren
      const parseAddressField = (value: any): string[] => {
        if (!value) return [];
        if (Array.isArray(value)) return value;
        if (typeof value === 'string') {
          return value
            .split(',')
            .map((e: string) => e.trim())
            .filter(Boolean);
        }
        return [];
      };

      const to = parseAddressField(row.to_email);

      const notes = notesByEmail.get(id) || [];
      const replyLock = replyLockMap.get(id);

      return {
        id,
        subject: row.subject || '(Kein Betreff)',
        from: from || '',
        to,
        body: row.body || '',
        date:
          row.created_at instanceof Date
            ? row.created_at.toISOString()
            : row.created_at,
        read: !!row.read_at,
        ticketId: row.ticket_id || undefined,
        isOutgoing: row.user_id === payload.sub,
        type: (row.type as 'email' | 'phone_note') || 'email',
        phoneNumber: row.phone_number || undefined,
        hasAttachment: !!row.has_attachment,
        hasNotes: notes.length > 0,
        notes,
        replyLock: replyLock
          ? { userId: replyLock.userId, userName: replyLock.userName }
          : undefined,
      };
    });

    const latest = emails[emails.length - 1];

    const responseBody = {
      ticketId: ticketId || '',
      latestSubject: latest?.subject || '',
      latestType: latest?.type || 'email',
      messageCount: emails.length,
      emails,
    };

    return NextResponse.json(responseBody);
  } catch (error: any) {
    console.error('Fehler in Thread-API:', error);
    return NextResponse.json(
      {
        error: 'Interner Serverfehler beim Laden des Threads',
        details: error?.message || String(error),
      },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}

