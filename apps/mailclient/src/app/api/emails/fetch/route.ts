import { NextRequest, NextResponse } from 'next/server';
import { extractTokenFromHeader, verifyToken, verifyServiceToken } from '@/lib/auth';
import { fetchEmailsForUser } from '@/lib/email-fetcher';

/**
 * POST /api/emails/fetch
 * Ruft E-Mails von allen aktiven E-Mail-Konten des eingeloggten Users ab
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
    
    // Service-Token-Support (für Cron-Service)
    const serviceToken = request.headers.get('x-service-token');
    let userId: string | null = null;
    let payload: any = null;
    let requestBody: any = null;

    // Request-Body einmalig lesen (kann nur einmal gelesen werden)
    try {
      requestBody = await request.json();
    } catch (error) {
      // Body ist optional
      requestBody = {};
    }

    if (serviceToken) {
      // Prüfe Service-Token
      if (!verifyServiceToken(serviceToken)) {
        return NextResponse.json(
          { error: 'Ungültiger Service-Token' },
          { status: 401 }
        );
      }
      
      // Service-Token ist gültig, verwende userId aus Request-Body
      userId = requestBody.userId;
      
      if (!userId) {
        return NextResponse.json(
          { error: 'userId erforderlich bei Service-Token-Authentifizierung' },
          { status: 400 }
        );
      }

      // Bei Service-Token muss x-company-id im Header vorhanden sein
      if (!companyId) {
        return NextResponse.json(
          { error: 'x-company-id Header erforderlich bei Service-Token-Authentifizierung' },
          { status: 400 }
        );
      }
    } else {
      // Normale JWT-Authentifizierung
      const authHeader = request.headers.get('authorization');
      const token = extractTokenFromHeader(authHeader);
      
      if (!token) {
        return NextResponse.json(
          { error: 'Authorization-Token oder Service-Token erforderlich' },
          { status: 401 }
        );
      }

      payload = verifyToken(token);
      
      if (!payload) {
        return NextResponse.json(
          { error: 'Ungültiger Token' },
          { status: 401 }
        );
      }
      
      userId = payload.sub;
      
      if (!companyId && payload.companyId) {
        companyId = payload.companyId;
      }
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

    if (!userId) {
      return NextResponse.json(
        { error: 'User-ID erforderlich' },
        { status: 400 }
      );
    }

    // E-Mails von allen aktiven Konten abrufen
    const result = await fetchEmailsForUser(userId, resolvedCompanyId);

    // Prüfe, ob es einen Fehler beim Abrufen der Konten gab
    if (result.error) {
      return NextResponse.json(
        { 
          error: result.error,
          success: false,
          results: [],
          totalCount: 0,
        },
        { status: 500 }
      );
    }

    // Prüfe, ob keine Konten gefunden wurden
    if (result.results.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Keine aktiven E-Mail-Konten gefunden. Bitte konfigurieren Sie ein E-Mail-Konto in den Einstellungen.',
        results: [],
        totalCount: 0,
      });
    }

    const totalCount = result.results.reduce((sum, r) => sum + r.count, 0);
    const successCount = result.results.filter((r) => !r.error).length;
    const errorCount = result.results.filter((r) => r.error).length;
    const totalAccounts = result.results.length;

    // Spezielle Behandlung für den Fall, dass alle Konten fehlgeschlagen sind
    if (totalAccounts > 0 && successCount === 0 && errorCount > 0) {
      const errorMessages = result.results
        .filter((r) => r.error)
        .map((r) => `${r.accountName}: ${r.error}`)
        .join('; ');
      
      return NextResponse.json({
        success: false,
        message: `Fehler beim Abrufen von ${totalAccounts} Konto(en): ${errorMessages}`,
        results: result.results,
        totalCount: 0,
      });
    }

    // Normale Erfolgsmeldung
    let message = '';
    if (totalCount === 0) {
      if (successCount > 0) {
        // Erfolgreich abgerufen, aber keine neuen E-Mails gefunden
        message = `Abruf erfolgreich: Keine neuen E-Mails in ${successCount} Konto(en) gefunden`;
      } else if (errorCount > 0) {
        // Fehler beim Abrufen
        message = 'Keine E-Mails abgerufen';
      } else {
        message = 'Keine E-Mails abgerufen';
      }
    } else {
      message = `${totalCount} E-Mail${totalCount !== 1 ? 's' : ''} von ${successCount} Konto${successCount !== 1 ? 'en' : ''} abgerufen`;
    }
    
    if (errorCount > 0) {
      message += `, ${errorCount} Fehler`;
    }

    return NextResponse.json({
      success: result.success && errorCount === 0,
      message,
      results: result.results,
      totalCount,
    });
  } catch (error: any) {
    console.error('Fehler beim Abrufen der E-Mails:', error);
    return NextResponse.json(
      { error: 'Interner Serverfehler beim Abrufen der E-Mails' },
      { status: 500 }
    );
  }
}


