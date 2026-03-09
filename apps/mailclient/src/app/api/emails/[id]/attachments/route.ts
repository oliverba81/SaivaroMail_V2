import { NextRequest, NextResponse } from 'next/server';
import { getTenantContext } from '@/lib/api-tenant-context';

/**
 * GET /api/emails/[id]/attachments
 * Liefert die Liste der Anhänge einer E-Mail.
 * Bei fehlendem Zugriff oder ohne Anhänge: leeres Array.
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

    const accessResult = await client.query(
      `SELECT 1 FROM emails e
       LEFT JOIN user_departments ud ON e.department_id = ud.department_id AND ud.user_id = $1
       WHERE e.id = $2 AND ${visibilityWhere}`,
      [payload.sub, emailId]
    );

    if (accessResult.rows.length === 0) {
      return NextResponse.json({ error: 'E-Mail nicht gefunden' }, { status: 404 });
    }

    const attachmentsResult = await client.query(
      `SELECT id, email_id, filename, content_type, size_bytes, file_path, created_at
       FROM email_attachments
       WHERE email_id = $1
       ORDER BY created_at, filename`,
      [emailId]
    );

    const attachments = attachmentsResult.rows.map((row: {
      id: string;
      filename: string;
      content_type: string | null;
      size_bytes: number | null;
      file_path?: string;
      created_at?: string;
    }) => ({
      id: row.id,
      filename: row.filename,
      contentType: row.content_type ?? undefined,
      sizeBytes: row.size_bytes ?? 0,
    }));

    return NextResponse.json({ attachments });
  } finally {
    client.release();
  }
}
