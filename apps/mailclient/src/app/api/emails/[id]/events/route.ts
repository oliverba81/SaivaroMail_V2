import { NextRequest, NextResponse } from 'next/server';
import { getTenantContext } from '@/lib/api-tenant-context';
import { getEmailEvents } from '@/lib/email-events';

/**
 * GET /api/emails/[id]/events
 * Liefert die Timeline-Events für eine E-Mail.
 * Query: include_active_rules, sort (asc|desc), limit (default 100).
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

    const { searchParams } = new URL(request.url);
    const sort = (searchParams.get('sort') === 'asc' ? 'asc' : 'desc') as 'asc' | 'desc';
    const limitParam = searchParams.get('limit');
    const limit = Math.min(Math.max(parseInt(limitParam || '100', 10) || 100, 1), 500);

    if (!resolvedCompanyId) {
      return NextResponse.json(
        { error: 'Company-Kontext nicht verfügbar' },
        { status: 400 }
      );
    }

    const events = await getEmailEvents(
      resolvedCompanyId,
      emailId,
      payload.sub,
      limit,
      sort
    );

    return NextResponse.json({ events });
  } finally {
    client.release();
  }
}
