import { NextRequest, NextResponse } from 'next/server';
import { getTenantDbClient } from '@/lib/tenant-db-client';
import { extractTokenFromHeader, verifyToken } from '@/lib/auth';

/**
 * PATCH /api/emails/bulk
 * Aktualisiert Read-Status für mehrere E-Mails in einer atomaren Transaktion
 * 
 * Body: {
 *   emailIds: string[];
 *   read: boolean;
 * }
 */
export async function PATCH(request: NextRequest) {
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
    const { emailIds, read } = body;

    // Validierung
    if (!emailIds || !Array.isArray(emailIds) || emailIds.length === 0) {
      return NextResponse.json(
        { error: 'emailIds Array erforderlich und darf nicht leer sein' },
        { status: 400 }
      );
    }

    if (typeof read !== 'boolean') {
      return NextResponse.json(
        { error: 'read muss ein boolean sein' },
        { status: 400 }
      );
    }

    // Limit für Bulk-Operationen (verhindert zu große Requests)
    const MAX_BULK_SIZE = 1000;
    if (emailIds.length > MAX_BULK_SIZE) {
      return NextResponse.json(
        { error: `Maximal ${MAX_BULK_SIZE} E-Mails pro Bulk-Operation erlaubt` },
        { status: 400 }
      );
    }

    // Tenant-DB-Client holen
    let client;
    if (companyId) {
      client = await getTenantDbClient(companyId);
    } else if (companySlug) {
      const { getTenantDbClientBySlug } = await import('@/lib/tenant-db-client');
      client = await getTenantDbClientBySlug(companySlug);
    } else {
      return NextResponse.json(
        { error: 'Company-ID oder Slug erforderlich' },
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

    try {
      // Beginne Transaktion
      await client.query('BEGIN');

      // Prüfe Berechtigung für alle E-Mails (User gehört E-Mail ODER User ist in derselben Abteilung)
      const checkResult = await client.query(
        `SELECT DISTINCT e.id 
         FROM emails e
         LEFT JOIN user_departments ud ON e.department_id = ud.department_id AND ud.user_id = $1
         WHERE e.id = ANY($2::uuid[]) AND (
           e.user_id = $1 
           OR ud.department_id IS NOT NULL
         )`,
        [payload.sub, emailIds]
      );

      const authorizedEmailIds = checkResult.rows.map((row: any) => row.id);

      if (authorizedEmailIds.length === 0) {
        await client.query('ROLLBACK');
        return NextResponse.json(
          { error: 'Keine berechtigten E-Mails gefunden' },
          { status: 403 }
        );
      }

      // Aktualisiere Read-Status für alle berechtigten E-Mails in einer Transaktion
      if (read) {
        // Markiere als gelesen
        await client.query(
          `INSERT INTO email_read_status (email_id, user_id, read_at)
           SELECT unnest($1::uuid[]), $2, NOW()
           ON CONFLICT (email_id, user_id) 
           DO UPDATE SET read_at = NOW(), updated_at = NOW()`,
          [authorizedEmailIds, payload.sub]
        );
      } else {
        // Markiere als ungelesen
        await client.query(
          `DELETE FROM email_read_status 
           WHERE email_id = ANY($1::uuid[]) AND user_id = $2`,
          [authorizedEmailIds, payload.sub]
        );
      }

      // Commit Transaktion
      await client.query('COMMIT');

      // Event-Logging (asynchron, nicht blockierend)
      if (resolvedCompanyId) {
        (async () => {
          try {
            const { logEmailEvent } = await import('@/lib/email-events');
            for (const emailId of authorizedEmailIds) {
              await logEmailEvent(resolvedCompanyId, emailId, payload.sub, read ? 'read' : 'unread', {});
            }
          } catch (err) {
            console.error('Fehler beim Protokollieren der Bulk-Events:', err);
          }
        })();
      }

      return NextResponse.json({
        success: true,
        updated: authorizedEmailIds.length,
        total: emailIds.length,
        emailIds: authorizedEmailIds,
      });
    } catch (error: any) {
      await client.query('ROLLBACK');
      console.error('Fehler bei Bulk-Update:', error);
      return NextResponse.json(
        { error: 'Fehler beim Aktualisieren der E-Mails' },
        { status: 500 }
      );
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error('Fehler bei Bulk-Update (äußerer Catch):', error);
    return NextResponse.json(
      { error: 'Interner Serverfehler' },
      { status: 500 }
    );
  }
}
