import { NextRequest, NextResponse } from 'next/server';
import { getTenantContext } from '@/lib/api-tenant-context';

/**
 * GET /api/emails/[id]
 * Lädt eine einzelne E-Mail (Detail-Ansicht).
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

  const { client, payload } = ctx;

  try {
    const roleResult = await client.query(
      `SELECT role FROM users WHERE id = $1`,
      [payload.sub]
    );
    const userRole = roleResult.rows[0]?.role ?? null;
    const isAdmin = String(userRole).toLowerCase() === 'admin';

    const visibilityWhere = isAdmin
      ? '1=1'
      : `(e.user_id = $1 OR ud.department_id IS NOT NULL)`;

    const query = `SELECT DISTINCT e.id, e.subject, e.from_email, e.to_email, e.department_id, e.body, e.created_at,
                          e.deleted_at, e.spam_at, e.important_at, e.theme_id, e.has_attachment,
                          e.ticket_id, e.is_conversation_thread, e.conversation_message_count,
                          e.type, e.phone_number,
                          ers.read_at,
                          ecs.completed_at,
                          et.id as theme_id_full, et.name as theme_name, et.color as theme_color,
                          d.id as department_id_val, d.name as department_name,
                          (SELECT COUNT(*)::int FROM email_notes en WHERE en.email_id = e.id) AS note_count,
                          (SELECT LEFT(en.content, 80) FROM email_notes en WHERE en.email_id = e.id ORDER BY en.created_at DESC LIMIT 1) AS last_note_content,
                          (SELECT COALESCE(NULLIF(TRIM(CONCAT(COALESCE(u.first_name,''), ' ', COALESCE(u.last_name,''))), ''), u.username, u.email, 'Unbekannt') FROM email_notes en LEFT JOIN users u ON en.user_id = u.id WHERE en.email_id = e.id ORDER BY en.created_at DESC LIMIT 1) AS last_note_user_name,
                          (SELECT en.created_at FROM email_notes en WHERE en.email_id = e.id ORDER BY en.created_at DESC LIMIT 1) AS last_note_created_at
                   FROM emails e
                   LEFT JOIN email_read_status ers ON e.id = ers.email_id AND ers.user_id = $1
                   LEFT JOIN email_completed_status ecs ON e.id = ecs.email_id AND ecs.user_id = $1
                   LEFT JOIN email_themes et ON e.theme_id = et.id
                   LEFT JOIN departments d ON e.department_id = d.id
                   LEFT JOIN user_departments ud ON e.department_id = ud.department_id AND ud.user_id = $1
                   WHERE ${visibilityWhere} AND e.id = $2`;

    const result = await client.query(query, [payload.sub, emailId]);

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'E-Mail nicht gefunden' }, { status: 404 });
    }

    const row = result.rows[0];

    // Zugewiesene Abteilungen
    const assignedDeptResult = await client.query(
      `SELECT ed.email_id, d.id as department_id, d.name as department_name
       FROM email_departments ed
       JOIN departments d ON ed.department_id = d.id
       WHERE ed.email_id = $1 ORDER BY d.name`,
      [emailId]
    );
    const assignedDepartments = assignedDeptResult.rows.map((r: { department_id: string; department_name: string }) => ({
      id: r.department_id,
      name: r.department_name,
    }));

    const fromEmail = row.from_email?.toLowerCase() || '';
    const toEmails = row.to_email
      ? (typeof row.to_email === 'string'
          ? row.to_email.split(',').map((e: string) => e.trim())
          : Array.isArray(row.to_email)
            ? row.to_email
            : [])
      : [];

    let fromDepartments: string[] = [];
    let toDepartments: string[] = [];
    if (fromEmail || toEmails.length > 0) {
      const deptResult = await client.query(
        `SELECT DISTINCT LOWER(u.email) as email, d.id as department_id
         FROM users u
         JOIN user_departments ud ON u.id = ud.user_id
         JOIN departments d ON ud.department_id = d.id
         WHERE LOWER(u.email) = ANY($1::text[])`,
        [[fromEmail, ...toEmails.map((e: string) => e.toLowerCase())].filter(Boolean)]
      );
      const emailToDepts = new Map<string, string[]>();
      deptResult.rows.forEach((r: { email: string; department_id: string }) => {
        const email = r.email?.toLowerCase() || '';
        if (!emailToDepts.has(email)) emailToDepts.set(email, []);
        emailToDepts.get(email)!.push(r.department_id);
      });
      fromDepartments = emailToDepts.get(fromEmail) || [];
      toDepartments = Array.from(new Set(toEmails.flatMap((email: string) => emailToDepts.get(email.toLowerCase()) || [])));
    }

    let from: string | null = null;
    if (row.type === 'phone_note') {
      from = row.phone_number || null;
    } else {
      from = row.from_email || null;
    }

    const email = {
      ...row,
      ticketId: row.ticket_id,
      isConversationThread: row.is_conversation_thread,
      conversationMessageCount: row.conversation_message_count,
      department_id: row.department_id_val || row.department_id || null,
      department: row.department_id_val
        ? { id: row.department_id_val, name: row.department_name }
        : row.department_id
          ? { id: row.department_id, name: 'Unbekannt' }
          : null,
      from_departments: fromDepartments,
      to_departments: toDepartments,
      assigned_departments: assignedDepartments,
      type: row.type || 'email',
      phoneNumber: row.phone_number || undefined,
      from,
      from_email: row.from_email,
    };

    return NextResponse.json({ email });
  } finally {
    client.release();
  }
}

/**
 * PATCH /api/emails/[id]
 * Aktualisiert Status-Felder einer einzelnen E-Mail.
 * Body: { read?: boolean, completed?: boolean, themeId?: string | null, deleted?: boolean, spam?: boolean, important?: boolean }
 * – mindestens eines muss gesetzt sein.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: emailId } = await params;
  if (!emailId) {
    return NextResponse.json({ error: 'E-Mail-ID erforderlich' }, { status: 400 });
  }

  const ctx = await getTenantContext(request);
  if ('error' in ctx) return ctx.error;

  const { client, payload } = ctx;

  let body: {
    read?: boolean;
    completed?: boolean;
    themeId?: string | null;
    deleted?: boolean;
    spam?: boolean;
    important?: boolean;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Ungültiger JSON-Body' }, { status: 400 });
  }

  const read = body.read;
  const completed = body.completed;
  const themeId = body.themeId;
  const deleted = body.deleted;
  const spam = body.spam;
  const important = body.important;

  if (read !== undefined && typeof read !== 'boolean') {
    return NextResponse.json({ error: 'read muss ein boolean sein' }, { status: 400 });
  }
  if (completed !== undefined && typeof completed !== 'boolean') {
    return NextResponse.json({ error: 'completed muss ein boolean sein' }, { status: 400 });
  }
  if (themeId !== undefined && themeId !== null && typeof themeId !== 'string') {
    return NextResponse.json({ error: 'themeId muss ein string oder null sein' }, { status: 400 });
  }
  if (deleted !== undefined && typeof deleted !== 'boolean') {
    return NextResponse.json({ error: 'deleted muss ein boolean sein' }, { status: 400 });
  }
  if (spam !== undefined && typeof spam !== 'boolean') {
    return NextResponse.json({ error: 'spam muss ein boolean sein' }, { status: 400 });
  }
  if (important !== undefined && typeof important !== 'boolean') {
    return NextResponse.json({ error: 'important muss ein boolean sein' }, { status: 400 });
  }
  if (
    read === undefined &&
    completed === undefined &&
    themeId === undefined &&
    deleted === undefined &&
    spam === undefined &&
    important === undefined
  ) {
    return NextResponse.json(
      { error: 'read, completed, themeId, deleted, spam oder important muss gesetzt sein' },
      { status: 400 }
    );
  }

  try {
    const roleResult = await client.query(
      `SELECT role FROM users WHERE id = $1`,
      [payload.sub]
    );
    const userRole = roleResult.rows[0]?.role ?? null;
    const isAdmin = String(userRole).toLowerCase() === 'admin';

    const visibilityWhere = isAdmin
      ? '1=1'
      : `(e.user_id = $1 OR ud.department_id IS NOT NULL)`;

    const checkQuery = `SELECT e.id FROM emails e
      LEFT JOIN user_departments ud ON e.department_id = ud.department_id AND ud.user_id = $1
      WHERE ${visibilityWhere} AND e.id = $2`;

    const checkResult = await client.query(checkQuery, [payload.sub, emailId]);
    if (checkResult.rows.length === 0) {
      return NextResponse.json({ error: 'E-Mail nicht gefunden' }, { status: 404 });
    }

    let updatedRead: boolean | undefined;
    let updatedCompleted: boolean | undefined;
    let updatedThemeId: string | null | undefined;
    let updatedDeleted: boolean | undefined;
    let updatedSpam: boolean | undefined;
    let updatedImportant: boolean | undefined;

    if (read !== undefined) {
      if (read) {
        await client.query(
          `INSERT INTO email_read_status (email_id, user_id, read_at)
           VALUES ($1, $2, NOW())
           ON CONFLICT (email_id, user_id)
           DO UPDATE SET read_at = NOW(), updated_at = NOW()`,
          [emailId, payload.sub]
        );
      } else {
        await client.query(
          `DELETE FROM email_read_status WHERE email_id = $1 AND user_id = $2`,
          [emailId, payload.sub]
        );
      }
      updatedRead = read;
    }

    if (completed !== undefined) {
      if (completed) {
        await client.query(
          `INSERT INTO email_completed_status (email_id, user_id, completed_at)
           VALUES ($1, $2, NOW())
           ON CONFLICT (email_id, user_id)
           DO UPDATE SET completed_at = NOW(), updated_at = NOW()`,
          [emailId, payload.sub]
        );
      } else {
        await client.query(
          `DELETE FROM email_completed_status WHERE email_id = $1 AND user_id = $2`,
          [emailId, payload.sub]
        );
      }
      updatedCompleted = completed;
    }

    if (themeId !== undefined) {
      const finalThemeId = themeId === null || themeId === '' ? null : themeId;
      await client.query(
        `UPDATE emails SET theme_id = $1 WHERE id = $2`,
        [finalThemeId, emailId]
      );
      updatedThemeId = finalThemeId;
    }

    if (deleted !== undefined) {
      await client.query(
        `UPDATE emails SET deleted_at = CASE WHEN $1 THEN NOW() ELSE NULL END WHERE id = $2`,
        [deleted, emailId]
      );
      updatedDeleted = deleted;
    }

    if (spam !== undefined) {
      await client.query(
        `UPDATE emails SET spam_at = CASE WHEN $1 THEN NOW() ELSE NULL END WHERE id = $2`,
        [spam, emailId]
      );
      updatedSpam = spam;
    }

    if (important !== undefined) {
      await client.query(
        `UPDATE emails SET important_at = CASE WHEN $1 THEN NOW() ELSE NULL END WHERE id = $2`,
        [important, emailId]
      );
      updatedImportant = important;
    }

    const responseEmail: {
      id: string;
      read?: boolean;
      completed?: boolean;
      themeId?: string | null;
      deleted?: boolean;
      spam?: boolean;
      important?: boolean;
    } = { id: emailId };
    if (updatedRead !== undefined) responseEmail.read = updatedRead;
    if (updatedCompleted !== undefined) responseEmail.completed = updatedCompleted;
    if (updatedThemeId !== undefined) responseEmail.themeId = updatedThemeId;
    if (updatedDeleted !== undefined) responseEmail.deleted = updatedDeleted;
    if (updatedSpam !== undefined) responseEmail.spam = updatedSpam;
    if (updatedImportant !== undefined) responseEmail.important = updatedImportant;

    return NextResponse.json({ email: responseEmail });
  } finally {
    client.release();
  }
}
