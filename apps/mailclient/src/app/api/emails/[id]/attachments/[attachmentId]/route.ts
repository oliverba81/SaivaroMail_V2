import { NextRequest, NextResponse } from 'next/server';
import { join } from 'path';
import { existsSync, createReadStream } from 'fs';
import { Readable } from 'stream';
import { getTenantContext } from '@/lib/api-tenant-context';

/**
 * GET /api/emails/[id]/attachments/[attachmentId]
 * Liefert den Binärinhalt eines Anhangs (Download).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; attachmentId: string }> }
) {
  const { id: emailId, attachmentId } = await params;
  if (!emailId || !attachmentId) {
    return NextResponse.json({ error: 'E-Mail-ID und Anhangs-ID erforderlich' }, { status: 400 });
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

    const attResult = await client.query(
      `SELECT id, filename, content_type, file_path FROM email_attachments WHERE id = $1 AND email_id = $2`,
      [attachmentId, emailId]
    );

    if (attResult.rows.length === 0) {
      return NextResponse.json({ error: 'Anhang nicht gefunden' }, { status: 404 });
    }

    const row = attResult.rows[0];
    const storagePath = process.env.STORAGE_PATH || './storage';
    const absolutePath = join(storagePath, row.file_path);

    if (!existsSync(absolutePath)) {
      return NextResponse.json({ error: 'Anhang-Datei nicht vorhanden' }, { status: 404 });
    }

    const nodeStream = createReadStream(absolutePath);
    const webStream = Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>;
    const contentType = row.content_type || 'application/octet-stream';
    const filename = row.filename || 'attachment';

    return new NextResponse(webStream, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
      },
    });
  } finally {
    client.release();
  }
}
