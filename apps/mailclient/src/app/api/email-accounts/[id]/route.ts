import { NextRequest, NextResponse } from 'next/server';
import { getTenantDbClient, getTenantDbClientBySlug } from '@/lib/tenant-db-client';
import { getCompanyDbConfigBySlug } from '@/lib/scc-client';
import { extractTokenFromHeader, verifyToken } from '@/lib/auth';

async function getTenantContext(request: NextRequest) {
  let companyId: string | null = null;
  let companySlug: string | null = null;

  const hostname = request.headers.get('host') || '';
  const subdomain = hostname.split('.')[0];
  if (subdomain && subdomain !== 'localhost' && subdomain !== 'www') {
    companySlug = subdomain;
  }

  const headerCompanyId = request.headers.get('x-company-id');
  const headerCompanySlug = request.headers.get('x-company-slug');
  if (headerCompanyId) companyId = headerCompanyId;
  else if (headerCompanySlug) companySlug = headerCompanySlug;

  const authHeader = request.headers.get('authorization');
  const token = extractTokenFromHeader(authHeader);
  if (!token) {
    return { error: NextResponse.json({ error: 'Authorization-Token erforderlich' }, { status: 401 }) };
  }

  const payload = verifyToken(token);
  if (!payload) {
    return { error: NextResponse.json({ error: 'Ungültiger Token' }, { status: 401 }) };
  }

  if (!companyId && payload.companyId) companyId = payload.companyId;
  if (!companyId && !companySlug) {
    return {
      error: NextResponse.json(
        { error: 'Tenant-Context nicht gesetzt' },
        { status: 400 }
      ),
    };
  }

  let resolvedCompanyId = companyId;
  if (!resolvedCompanyId && companySlug) {
    const dbConfig = await getCompanyDbConfigBySlug(companySlug);
    if (dbConfig) resolvedCompanyId = dbConfig.companyId;
  }

  const client = resolvedCompanyId
    ? await getTenantDbClient(resolvedCompanyId)
    : await getTenantDbClientBySlug(companySlug!);

  return { client, payload, resolvedCompanyId: resolvedCompanyId || companySlug };
}

/**
 * GET /api/email-accounts/[id]
 * Lädt ein einzelnes E-Mail-Konto inkl. Passwörter (für Bearbeitung)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: accountId } = await params;
  if (!accountId) {
    return NextResponse.json({ error: 'Konto-ID erforderlich' }, { status: 400 });
  }

  try {
    const ctx = await getTenantContext(request);
    if ('error' in ctx) return ctx.error;

    const { client, payload } = ctx;

    try {
      const userResult = await client.query(
        'SELECT role, company_id FROM users WHERE id = $1',
        [payload.sub]
      );
      if (userResult.rows.length === 0) {
        return NextResponse.json({ error: 'User nicht gefunden' }, { status: 404 });
      }

      const userRole = userResult.rows[0].role;
      const userCompanyId = userResult.rows[0].company_id;

      const result = await client.query(
        `SELECT ea.id, ea.user_id, ea.name, ea.email,
                ea.imap_host, ea.imap_port, ea.imap_username, ea.imap_password, ea.imap_folder, ea.imap_ssl,
                ea.smtp_host, ea.smtp_port, ea.smtp_username, ea.smtp_password, ea.smtp_ssl, ea.smtp_tls,
                ea.is_active, ea.created_at, ea.updated_at
         FROM email_accounts ea
         JOIN users u ON ea.user_id = u.id
         WHERE ea.id = $1 AND u.company_id = $2`,
        [accountId, userCompanyId]
      );

      if (result.rows.length === 0) {
        return NextResponse.json({ error: 'E-Mail-Konto nicht gefunden' }, { status: 404 });
      }

      if (userRole !== 'admin' && result.rows[0].user_id !== payload.sub) {
        return NextResponse.json({ error: 'Kein Zugriff auf dieses Konto' }, { status: 403 });
      }

      const row = result.rows[0];
      return NextResponse.json({
        account: {
          id: row.id,
          name: row.name,
          email: row.email,
          imap: {
            host: row.imap_host,
            port: row.imap_port,
            username: row.imap_username,
            password: row.imap_password || '',
            folder: row.imap_folder || 'INBOX',
            ssl: row.imap_ssl,
          },
          smtp: {
            host: row.smtp_host,
            port: row.smtp_port,
            username: row.smtp_username,
            password: row.smtp_password || '',
            ssl: row.smtp_ssl,
            tls: row.smtp_tls,
          },
          isActive: row.is_active,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        },
      });
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error('Fehler beim Laden des E-Mail-Kontos:', error);
    return NextResponse.json(
      { error: 'Fehler beim Laden der Kontodaten' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/email-accounts/[id]
 * E-Mail-Konto aktualisieren
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: accountId } = await params;
  if (!accountId) {
    return NextResponse.json({ error: 'Konto-ID erforderlich' }, { status: 400 });
  }

  try {
    const ctx = await getTenantContext(request);
    if ('error' in ctx) return ctx.error;

    const { client, payload } = ctx;

    try {
      const userResult = await client.query(
        'SELECT role, company_id FROM users WHERE id = $1',
        [payload.sub]
      );
      if (userResult.rows.length === 0) {
        return NextResponse.json({ error: 'User nicht gefunden' }, { status: 404 });
      }

      const userRole = userResult.rows[0].role;
      const userCompanyId = userResult.rows[0].company_id;

      const checkResult = await client.query(
        `SELECT ea.id, ea.user_id FROM email_accounts ea
         JOIN users u ON ea.user_id = u.id
         WHERE ea.id = $1 AND u.company_id = $2`,
        [accountId, userCompanyId]
      );

      if (checkResult.rows.length === 0) {
        return NextResponse.json({ error: 'E-Mail-Konto nicht gefunden' }, { status: 404 });
      }

      if (userRole !== 'admin' && checkResult.rows[0].user_id !== payload.sub) {
        return NextResponse.json({ error: 'Kein Zugriff auf dieses Konto' }, { status: 403 });
      }

      const body = await request.json();
      const {
        name,
        email,
        imapHost,
        imapPort,
        imapUsername,
        imapPassword,
        imapFolder,
        imapSsl,
        smtpHost,
        smtpPort,
        smtpUsername,
        smtpPassword,
        smtpSsl,
        smtpTls,
        isActive,
      } = body;

      if (!name || !email) {
        return NextResponse.json(
          { error: 'Name und E-Mail-Adresse sind erforderlich' },
          { status: 400 }
        );
      }

      await client.query(
        `UPDATE email_accounts SET
          name = $1, email = $2,
          imap_host = $3, imap_port = $4, imap_username = $5,
          imap_password = CASE WHEN $6 IS NOT NULL AND $6 != '' THEN $6 ELSE imap_password END,
          imap_folder = COALESCE($7, 'INBOX'), imap_ssl = COALESCE($8, true),
          smtp_host = $9, smtp_port = $10, smtp_username = $11,
          smtp_password = CASE WHEN $12 IS NOT NULL AND $12 != '' THEN $12 ELSE smtp_password END,
          smtp_ssl = COALESCE($13, true), smtp_tls = COALESCE($14, true),
          is_active = COALESCE($15, true),
          updated_at = NOW()
         WHERE id = $16`,
        [
          name,
          email,
          imapHost || null,
          imapPort ?? 993,
          imapUsername || null,
          imapPassword || null,
          imapFolder || 'INBOX',
          imapSsl !== undefined ? imapSsl : true,
          smtpHost || null,
          smtpPort ?? 587,
          smtpUsername || null,
          smtpPassword || null,
          smtpSsl !== undefined ? smtpSsl : true,
          smtpTls !== undefined ? smtpTls : true,
          isActive !== undefined ? isActive : true,
          accountId,
        ]
      );

      const updated = await client.query(
        `SELECT id, name, email, imap_host, imap_port, imap_username, imap_folder, imap_ssl,
                smtp_host, smtp_port, smtp_username, smtp_ssl, smtp_tls, is_active, created_at, updated_at
         FROM email_accounts WHERE id = $1`,
        [accountId]
      );

      const row = updated.rows[0];
      return NextResponse.json({
        account: {
          id: row.id,
          name: row.name,
          email: row.email,
          imap: {
            host: row.imap_host,
            port: row.imap_port,
            username: row.imap_username,
            folder: row.imap_folder || 'INBOX',
            ssl: row.imap_ssl,
          },
          smtp: {
            host: row.smtp_host,
            port: row.smtp_port,
            username: row.smtp_username,
            ssl: row.smtp_ssl,
            tls: row.smtp_tls,
          },
          isActive: row.is_active,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        },
      });
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error('Fehler beim Aktualisieren des E-Mail-Kontos:', error);
    return NextResponse.json(
      { error: 'Fehler beim Speichern des Kontos' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/email-accounts/[id]
 * E-Mail-Konto löschen
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: accountId } = await params;
  if (!accountId) {
    return NextResponse.json({ error: 'Konto-ID erforderlich' }, { status: 400 });
  }

  try {
    const ctx = await getTenantContext(request);
    if ('error' in ctx) return ctx.error;

    const { client, payload } = ctx;

    try {
      const userResult = await client.query(
        'SELECT role, company_id FROM users WHERE id = $1',
        [payload.sub]
      );
      if (userResult.rows.length === 0) {
        return NextResponse.json({ error: 'User nicht gefunden' }, { status: 404 });
      }

      const userRole = userResult.rows[0].role;
      const userCompanyId = userResult.rows[0].company_id;

      const checkResult = await client.query(
        `SELECT ea.id, ea.user_id FROM email_accounts ea
         JOIN users u ON ea.user_id = u.id
         WHERE ea.id = $1 AND u.company_id = $2`,
        [accountId, userCompanyId]
      );

      if (checkResult.rows.length === 0) {
        return NextResponse.json({ error: 'E-Mail-Konto nicht gefunden' }, { status: 404 });
      }

      if (userRole !== 'admin' && checkResult.rows[0].user_id !== payload.sub) {
        return NextResponse.json({ error: 'Kein Zugriff auf dieses Konto' }, { status: 403 });
      }

      await client.query('DELETE FROM email_accounts WHERE id = $1', [accountId]);

      return NextResponse.json({ message: 'Konto erfolgreich gelöscht' });
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error('Fehler beim Löschen des E-Mail-Kontos:', error);
    return NextResponse.json(
      { error: 'Fehler beim Löschen des Kontos' },
      { status: 500 }
    );
  }
}
