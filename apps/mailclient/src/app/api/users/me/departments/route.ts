import { NextRequest, NextResponse } from 'next/server';
import { getTenantDbClient } from '@/lib/tenant-db-client';
import { getCompanyDbConfigBySlug } from '@/lib/scc-client';
import { extractTokenFromHeader, verifyToken } from '@/lib/auth';

/**
 * GET /api/users/me/departments
 * Lädt die Abteilungen des aktuellen eingeloggten Benutzers
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

    let resolvedCompanyId = tenantContext.companyId;
    if (!resolvedCompanyId && tenantContext.companySlug) {
      const dbConfig = await getCompanyDbConfigBySlug(tenantContext.companySlug);
      if (dbConfig) {
        resolvedCompanyId = dbConfig.companyId;
      }
    }

    if (!resolvedCompanyId) {
      return NextResponse.json(
        { error: 'Company-ID konnte nicht aufgelöst werden' },
        { status: 400 }
      );
    }

    let client = await getTenantDbClient(resolvedCompanyId);

    try {
      // Lade Abteilungen des aktuellen Users
      const result = await client.query(`
        SELECT d.id, d.name, d.description
        FROM user_departments ud
        JOIN departments d ON ud.department_id = d.id
        WHERE ud.user_id = $1
        ORDER BY d.name
      `, [payload.sub]);

      return NextResponse.json({
        departments: result.rows.map((row: any) => ({
          id: row.id,
          name: row.name,
          description: row.description,
        })),
      });
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error('Fehler beim Laden der User-Abteilungen:', error);
    return NextResponse.json(
      { error: 'Fehler beim Laden der User-Abteilungen' },
      { status: 500 }
    );
  }
}


