import { NextRequest, NextResponse } from 'next/server';
import { extractTokenFromHeader, verifyToken } from '@/lib/auth';
import { getTenantDbClient } from '@/lib/tenant-db-client';

/**
 * GET /api/themes
 * Lädt alle Themen des Benutzers
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

    // Tenant-Context companyId auflösen
    let resolvedCompanyId = companyId;
    if (!resolvedCompanyId && companySlug) {
      const { getCompanyDbConfigBySlug } = await import('@/lib/scc-client');
      const dbConfig = await getCompanyDbConfigBySlug(companySlug);
      if (dbConfig) {
        resolvedCompanyId = dbConfig.companyId;
      }
    }

    if (!resolvedCompanyId) {
      return NextResponse.json(
        { error: 'Company-ID oder Slug erforderlich' },
        { status: 400 }
      );
    }

    const client = await getTenantDbClient(resolvedCompanyId);

    try {
      // Lade alle Themen des Benutzers
      let result = await client.query(
        `SELECT id, name, color, created_at, updated_at
         FROM email_themes
         WHERE user_id = $1
         ORDER BY created_at ASC`,
        [payload.sub]
      );

      // Wenn keine Themen vorhanden sind, erstelle Standard-Themen
      if (result.rows.length === 0) {
        const defaultThemes = [
          { name: 'Arbeit', color: '#007bff' },
          { name: 'Privat', color: '#28a745' },
          { name: 'Wichtig', color: '#ffc107' },
          { name: 'Projekte', color: '#17a2b8' },
          { name: 'Rechnungen', color: '#dc3545' },
          { name: 'Bestellungen', color: '#6f42c1' },
          { name: 'Support', color: '#fd7e14' },
          { name: 'Marketing', color: '#e83e8c' },
          { name: 'Vertrieb', color: '#20c997' },
          { name: 'Personal', color: '#6c757d' },
        ];

        // Erstelle alle Standard-Themen
        for (const theme of defaultThemes) {
          await client.query(
            `INSERT INTO email_themes (user_id, name, color, created_at, updated_at)
             VALUES ($1, $2, $3, NOW(), NOW())`,
            [payload.sub, theme.name, theme.color]
          );
        }

        // Lade die erstellten Themen erneut
        result = await client.query(
          `SELECT id, name, color, created_at, updated_at
           FROM email_themes
           WHERE user_id = $1
           ORDER BY created_at ASC`,
          [payload.sub]
        );
      }

      return NextResponse.json({
        themes: result.rows.map((row) => ({
          id: row.id,
          name: row.name,
          color: row.color || null,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        })),
      });
    } catch (error: any) {
      console.error('Fehler beim Laden der Themen:', error);
      return NextResponse.json(
        { error: 'Fehler beim Laden der Themen' },
        { status: 500 }
      );
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error('Fehler in GET /api/themes:', error);
    return NextResponse.json(
      { error: error.message || 'Interner Serverfehler' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/themes
 * Erstellt ein neues Thema
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

    // Tenant-Context companyId auflösen
    let resolvedCompanyId = companyId;
    if (!resolvedCompanyId && companySlug) {
      const { getCompanyDbConfigBySlug } = await import('@/lib/scc-client');
      const dbConfig = await getCompanyDbConfigBySlug(companySlug);
      if (dbConfig) {
        resolvedCompanyId = dbConfig.companyId;
      }
    }

    if (!resolvedCompanyId) {
      return NextResponse.json(
        { error: 'Company-ID oder Slug erforderlich' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { name, color } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Themenname ist erforderlich' },
        { status: 400 }
      );
    }

    if (name.length > 255) {
      return NextResponse.json(
        { error: 'Themenname darf maximal 255 Zeichen lang sein' },
        { status: 400 }
      );
    }

    // Validiere Farbe (Hex-Format)
    if (color && typeof color === 'string' && !/^#[0-9A-Fa-f]{6}$/.test(color)) {
      return NextResponse.json(
        { error: 'Ungültiges Farbformat. Erwartet wird ein Hex-Wert (z.B. #FF5733)' },
        { status: 400 }
      );
    }

    const client = await getTenantDbClient(resolvedCompanyId);

    try {
      // Erstelle neues Thema
      const result = await client.query(
        `INSERT INTO email_themes (user_id, name, color, created_at, updated_at)
         VALUES ($1, $2, $3, NOW(), NOW())
         RETURNING id, name, color, created_at, updated_at`,
        [payload.sub, name.trim(), color || null]
      );

      const theme = result.rows[0];

      return NextResponse.json({
        theme: {
          id: theme.id,
          name: theme.name,
          color: theme.color || null,
          createdAt: theme.created_at,
          updatedAt: theme.updated_at,
        },
      }, { status: 201 });
    } catch (error: any) {
      console.error('Fehler beim Erstellen des Themas:', error);
      
      // Prüfe auf Duplikat-Fehler
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'Ein Thema mit diesem Namen existiert bereits' },
          { status: 409 }
        );
      }
      
      return NextResponse.json(
        { error: 'Fehler beim Erstellen des Themas' },
        { status: 500 }
      );
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error('Fehler in POST /api/themes:', error);
    return NextResponse.json(
      { error: error.message || 'Interner Serverfehler' },
      { status: 500 }
    );
  }
}

