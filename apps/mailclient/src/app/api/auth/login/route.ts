import { NextRequest, NextResponse } from 'next/server';
import { getTenantDbClient } from '@/lib/tenant-db-client';
import bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';

/**
 * POST /api/auth/login
 * Login für Firmen-User (nutzt Tenant-DB)
 */
export async function POST(request: NextRequest) {
  try {
    // Tenant-Context aus Request extrahieren (da Middleware-Context nicht verfügbar ist)
    let companyId: string | null = null;
    let companySlug: string | null = null;
    
    // 1. Subdomain-Parsing
    const hostname = request.headers.get('host') || '';
    const subdomain = hostname.split('.')[0];
    
    if (subdomain && subdomain !== 'localhost' && subdomain !== 'www') {
      companySlug = subdomain;
    }
    
    // 2. Header-Parsing
    const headerCompanyId = request.headers.get('x-company-id');
    const headerCompanySlug = request.headers.get('x-company-slug');
    
    if (headerCompanyId) {
      companyId = headerCompanyId;
    } else if (headerCompanySlug) {
      companySlug = headerCompanySlug;
    }
    
    // 3. JWT-Token-Parsing (falls vorhanden)
    if (!companyId) {
      const authHeader = request.headers.get('authorization');
      if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        try {
          const parts = token.split('.');
          if (parts.length === 3) {
            const payloadJson = Buffer.from(parts[1], 'base64').toString('utf-8');
            const payload = JSON.parse(payloadJson);
            if (payload.companyId) {
              companyId = payload.companyId;
            }
          }
        } catch (error) {
          // Token-Parsing fehlgeschlagen, ignorieren
        }
      }
    }
    
    if (!companyId && !companySlug) {
      return NextResponse.json(
        { error: 'Tenant-Context nicht gesetzt. Request muss companyId oder companySlug enthalten.' },
        { status: 400 }
      );
    }
    
    const tenantContext = {
      companyId: companyId || null,
      companySlug: companySlug || undefined,
    };

    const body = await request.json();
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json(
        { error: 'Benutzername und Passwort erforderlich' },
        { status: 400 }
      );
    }

    // Tenant-DB-Client holen (unterstützt auch Slug)
    let client;
    if (tenantContext.companyId) {
      client = await getTenantDbClient(tenantContext.companyId);
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
      // User aus Tenant-DB laden (nach username suchen, Fallback zu email für Migration)
      const result = await client.query(
        `SELECT id, username, email, password_hash, first_name, last_name, role, status 
         FROM users 
         WHERE username = $1 OR (username IS NULL AND email = $1)`,
        [username]
      );

      if (result.rows.length === 0) {
        return NextResponse.json(
          { error: 'Ungültige Anmeldedaten' },
          { status: 401 }
        );
      }

      const user = result.rows[0];

      if (user.status !== 'active') {
        return NextResponse.json(
          { error: 'Account ist nicht aktiv' },
          { status: 403 }
        );
      }

      // Passwort prüfen
      const isPasswordValid = await bcrypt.compare(password, user.password_hash);

      if (!isPasswordValid) {
        return NextResponse.json(
          { error: 'Ungültige Anmeldedaten' },
          { status: 401 }
        );
      }

      // companyId aus DB-Config holen, falls nicht im Context
      let finalCompanyId = tenantContext.companyId;
      if (!finalCompanyId && tenantContext.companySlug) {
        // companyId aus DB-Config extrahieren (wurde bereits geladen)
        const { getCompanyDbConfigBySlug } = await import('@/lib/scc-client');
        const dbConfig = await getCompanyDbConfigBySlug(tenantContext.companySlug);
        if (dbConfig) {
          finalCompanyId = dbConfig.companyId;
        }
      }

      // JWT-Token erstellen
      const token = jwt.sign(
        {
          sub: user.id,
          username: user.username || user.email,
          email: user.email,
          companyId: finalCompanyId || tenantContext.companySlug, // Fallback zu Slug
          role: user.role,
        },
        process.env.JWT_SECRET || 'dev-secret-change-in-production',
        { expiresIn: '24h' }
      );

      // Last login aktualisieren
      await client.query(
        'UPDATE users SET last_login_at = NOW() WHERE id = $1',
        [user.id]
      );

      return NextResponse.json({
        access_token: token,
        user: {
          id: user.id,
          username: user.username || user.email,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          role: user.role,
        },
      });
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error('Login-Fehler:', error);
    
    // Spezifische Fehlermeldungen für häufige Probleme
    let errorMessage = error.message || 'Interner Serverfehler';
    
    // Datenbankverbindungsfehler
    if (error.message?.includes('password authentication failed')) {
      if (error.message?.includes("user 'postgres'")) {
        errorMessage = 'Datenbankverbindungsfehler: Bitte prüfen Sie die SCC_DATABASE_URL in der .env-Datei. Der Benutzer sollte "saivaro" sein, nicht "postgres".';
      } else {
        errorMessage = 'Datenbankverbindungsfehler: Falsches Passwort oder Benutzername. Bitte prüfen Sie die SCC_DATABASE_URL in der .env-Datei.';
      }
    } else if (error.message?.includes('SCC_DATABASE_URL')) {
      errorMessage = 'Konfigurationsfehler: SCC_DATABASE_URL ist nicht gesetzt. Bitte in .env konfigurieren.';
    } else if (error.message?.includes('DB-Config')) {
      errorMessage = `Datenbankkonfiguration fehlt: ${error.message}`;
    } else if (error.message?.includes('ECONNREFUSED') || error.message?.includes('connect')) {
      errorMessage = 'Datenbankverbindungsfehler: Datenbankserver ist nicht erreichbar. Bitte prüfen Sie, ob PostgreSQL läuft.';
    }
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

