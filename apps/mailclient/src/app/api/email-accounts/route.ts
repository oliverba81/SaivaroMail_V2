import { NextRequest, NextResponse } from 'next/server';
import { getTenantDbClient } from '@/lib/tenant-db-client';
import { extractTokenFromHeader, verifyToken } from '@/lib/auth';

/**
 * GET /api/email-accounts
 * Lädt alle E-Mail-Konten (IMAP/SMTP) für den eingeloggten User
 */
export async function GET(request: NextRequest) {
  try {
    // Tenant-Context aus Request extrahieren
    let companyId: string | null = null;
    let companySlug: string | null = null;
    
    const hostname = request.headers.get('host') || '';
    const subdomain = hostname.split('.')[0];
    
    if (subdomain && subdomain !== 'localhost' && subdomain !== 'www') {
      companySlug = subdomain;
    }
    
    const headerCompanyId = request.headers.get('x-company-id');
    const headerCompanySlug = request.headers.get('x-company-slug');
    
    if (headerCompanyId) {
      companyId = headerCompanyId;
    } else if (headerCompanySlug) {
      companySlug = headerCompanySlug;
    }
    
    const authHeader = request.headers.get('authorization');
    const token = extractTokenFromHeader(authHeader);
    
    if (!token) {
      return NextResponse.json(
        { error: 'Authorization-Token erforderlich' },
        { status: 401 }
      );
    }

    const payload = verifyToken(token);
    
    if (!payload) {
      return NextResponse.json(
        { error: 'Ungültiger Token' },
        { status: 401 }
      );
    }
    
    if (!companyId && payload.companyId) {
      companyId = payload.companyId;
    }
    
    if (!companyId && !companySlug) {
      return NextResponse.json(
        { error: 'Tenant-Context nicht gesetzt' },
        { status: 400 }
      );
    }
    
    const tenantContext = {
      companyId: companyId || null,
      companySlug: companySlug || undefined,
    };

    // Tenant-Context companyId auflösen
    let resolvedCompanyId = tenantContext.companyId;
    if (!resolvedCompanyId && tenantContext.companySlug) {
      const { getCompanyDbConfigBySlug } = await import('@/lib/scc-client');
      const dbConfig = await getCompanyDbConfigBySlug(tenantContext.companySlug);
      if (dbConfig) {
        resolvedCompanyId = dbConfig.companyId;
      }
    }

    // Tenant-DB-Client holen
    let client;
    if (resolvedCompanyId) {
      client = await getTenantDbClient(resolvedCompanyId);
    } else if (tenantContext.companySlug) {
      const { getTenantDbClientBySlug } = await import('@/lib/tenant-db-client');
      client = await getTenantDbClientBySlug(tenantContext.companySlug);
    } else {
      return NextResponse.json(
        { error: 'Company-ID oder Slug erforderlich' },
        { status: 400 }
      );
    }

    try {
      // Prüfe User-Rolle
      const userResult = await client.query(
        'SELECT role, company_id FROM users WHERE id = $1',
        [payload.sub]
      );

      if (userResult.rows.length === 0) {
        return NextResponse.json(
          { error: 'User nicht gefunden' },
          { status: 404 }
        );
      }

      const userRole = userResult.rows[0].role;
      const userCompanyId = userResult.rows[0].company_id;

      // E-Mail-Konten laden: Admins sehen alle Konten der Company, normale User nur eigene
      let result;
      if (userRole === 'admin') {
        // Lade alle E-Mail-Konten der Company
        result = await client.query(
          `SELECT ea.id, ea.name, ea.email, ea.imap_host, ea.imap_port, ea.imap_username, ea.imap_folder, ea.imap_ssl,
                  ea.smtp_host, ea.smtp_port, ea.smtp_username, ea.smtp_ssl, ea.smtp_tls, ea.is_active,
                  ea.created_at, ea.updated_at,
                  (SELECT COUNT(*) FROM departments d WHERE d.email_account_id = ea.id AND d.email_account_id IS NOT NULL) as department_usage_count
           FROM email_accounts ea
           JOIN users u ON ea.user_id = u.id
           WHERE u.company_id = $1
           ORDER BY ea.created_at DESC`,
          [userCompanyId]
        );
      } else {
        // Nur eigene E-Mail-Konten
        result = await client.query(
          `SELECT id, name, email, imap_host, imap_port, imap_username, imap_folder, imap_ssl,
                  smtp_host, smtp_port, smtp_username, smtp_ssl, smtp_tls, is_active,
                  created_at, updated_at,
                  (SELECT COUNT(*) FROM departments d WHERE d.email_account_id = email_accounts.id AND d.email_account_id IS NOT NULL) as department_usage_count
           FROM email_accounts
           WHERE user_id = $1
           ORDER BY created_at DESC`,
          [payload.sub]
        );
      }

      // Passwörter nicht zurückgeben (aus Sicherheitsgründen)
      const accounts = result.rows.map((row: any) => ({
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
        departmentUsageCount: parseInt(row.department_usage_count || '0', 10),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));

      return NextResponse.json({ accounts });
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error('Fehler beim Laden der E-Mail-Konten:', error);
    return NextResponse.json(
      { error: 'Interner Serverfehler' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/email-accounts
 * Erstellt einen neuen E-Mail-Konto (IMAP/SMTP)
 */
export async function POST(request: NextRequest) {
  try {
    // Tenant-Context aus Request extrahieren
    let companyId: string | null = null;
    let companySlug: string | null = null;
    
    const hostname = request.headers.get('host') || '';
    const subdomain = hostname.split('.')[0];
    
    if (subdomain && subdomain !== 'localhost' && subdomain !== 'www') {
      companySlug = subdomain;
    }
    
    const headerCompanyId = request.headers.get('x-company-id');
    const headerCompanySlug = request.headers.get('x-company-slug');
    
    if (headerCompanyId) {
      companyId = headerCompanyId;
    } else if (headerCompanySlug) {
      companySlug = headerCompanySlug;
    }
    
    const authHeader = request.headers.get('authorization');
    const token = extractTokenFromHeader(authHeader);
    
    if (!token) {
      return NextResponse.json(
        { error: 'Authorization-Token erforderlich' },
        { status: 401 }
      );
    }

    const payload = verifyToken(token);
    
    if (!payload) {
      return NextResponse.json(
        { error: 'Ungültiger Token' },
        { status: 401 }
      );
    }
    
    if (!companyId && payload.companyId) {
      companyId = payload.companyId;
    }
    
    if (!companyId && !companySlug) {
      return NextResponse.json(
        { error: 'Tenant-Context nicht gesetzt' },
        { status: 400 }
      );
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

    // Validierung
    if (!name || !email) {
      return NextResponse.json(
        { error: 'Name und E-Mail-Adresse sind erforderlich' },
        { status: 400 }
      );
    }

    // Tenant-Context companyId auflösen
    let resolvedCompanyId = companyId;
    if (!resolvedCompanyId && companySlug) {
      const { getCompanyDbConfigBySlug } = await import('@/lib/scc-client');
      const dbConfig = await getCompanyDbConfigBySlug(companySlug);
      if (dbConfig) {
        resolvedCompanyId = dbConfig.companyId;
      }
    }

    // Tenant-DB-Client holen
    let client;
    if (resolvedCompanyId) {
      client = await getTenantDbClient(resolvedCompanyId);
    } else if (companySlug) {
      const { getTenantDbClientBySlug } = await import('@/lib/tenant-db-client');
      client = await getTenantDbClientBySlug(companySlug);
    } else {
      return NextResponse.json(
        { error: 'Company-ID oder Slug erforderlich' },
        { status: 400 }
      );
    }

    try {
      // E-Mail-Konto speichern
      const result = await client.query(
        `INSERT INTO email_accounts (
          user_id, name, email,
          imap_host, imap_port, imap_username, imap_password, imap_folder, imap_ssl,
          smtp_host, smtp_port, smtp_username, smtp_password, smtp_ssl, smtp_tls,
          is_active, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NOW(), NOW())
        RETURNING id, name, email, imap_host, imap_port, imap_username, imap_folder, imap_ssl,
                  smtp_host, smtp_port, smtp_username, smtp_ssl, smtp_tls, is_active,
                  created_at, updated_at`,
        [
          payload.sub,
          name,
          email,
          imapHost || null,
          imapPort || 993,
          imapUsername || null,
          imapPassword || null,
          imapFolder || 'INBOX',
          imapSsl !== undefined ? imapSsl : true,
          smtpHost || null,
          smtpPort || 587,
          smtpUsername || null,
          smtpPassword || null,
          smtpSsl !== undefined ? smtpSsl : true,
          smtpTls !== undefined ? smtpTls : true,
          isActive !== undefined ? isActive : true, // is_active aus Request
        ]
      );

      const account = result.rows[0];

      return NextResponse.json({
        account: {
          id: account.id,
          name: account.name,
          email: account.email,
          imap: {
            host: account.imap_host,
            port: account.imap_port,
            username: account.imap_username,
            ssl: account.imap_ssl,
          },
          smtp: {
            host: account.smtp_host,
            port: account.smtp_port,
            username: account.smtp_username,
            ssl: account.smtp_ssl,
            tls: account.smtp_tls,
          },
          isActive: account.is_active,
          createdAt: account.created_at,
          updatedAt: account.updated_at,
        },
      }, { status: 201 });
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error('Fehler beim Erstellen des E-Mail-Kontos:', error);
    return NextResponse.json(
      { error: 'Interner Serverfehler' },
      { status: 500 }
    );
  }
}

