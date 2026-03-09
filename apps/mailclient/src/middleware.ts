import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { setTenantContext } from './lib/tenant-context';

/**
 * Middleware für Multi-Tenant-Routing
 * Erkennt companyId aus:
 * 1. Subdomain (z. B. acme-corp.localhost:3000) → wird als Slug gespeichert
 * 2. JWT-Token (Authorization Header) → companyId wird aus Token extrahiert
 * 3. Header (X-Company-Id oder X-Company-Slug)
 * 
 * WICHTIG: Keine DB-Calls in der Middleware!
 * Die Middleware läuft im Edge Runtime, der keine Node.js-Module wie 'pg' unterstützt.
 * DB-Calls erfolgen später in den API-Routes.
 */
export async function middleware(request: NextRequest) {
  let companyId: string | null = null;
  let companySlug: string | null = null;

  // 1. Subdomain-Parsing
  const hostname = request.headers.get('host') || '';
  const subdomain = hostname.split('.')[0];

  // Ignoriere "localhost" und "www"
  if (subdomain && subdomain !== 'localhost' && subdomain !== 'www') {
    companySlug = subdomain;
    // companyId wird später in den API-Routes aus dem Slug aufgelöst
  }

  // 1b. Query-Parameter ?company=slug (Fallback für Windows/ohne hosts-Setup)
  if (!companySlug && !companyId) {
    const slugParam = request.nextUrl.searchParams.get('company');
    if (slugParam && typeof slugParam === 'string' && /^[a-z0-9-]+$/.test(slugParam)) {
      companySlug = slugParam;
    }
  }

  // 1c. Cookie saivaro_company (wird gesetzt, wenn ?company= verwendet wird)
  if (!companySlug && !companyId) {
    const cookieSlug = request.cookies.get('saivaro_company')?.value;
    if (cookieSlug && /^[a-z0-9-]+$/.test(cookieSlug)) {
      companySlug = cookieSlug;
    }
  }

  // 2. Header-Parsing (X-Company-Id oder X-Company-Slug)
  if (!companyId) {
    const headerCompanyId = request.headers.get('x-company-id');
    const headerCompanySlug = request.headers.get('x-company-slug');

    if (headerCompanyId) {
      companyId = headerCompanyId;
    } else if (headerCompanySlug) {
      companySlug = headerCompanySlug;
      // companyId wird später in den API-Routes aus dem Slug aufgelöst
    }
  }

  // 3. JWT-Token-Parsing (wenn vorhanden)
  if (!companyId) {
    const authHeader = request.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      try {
        // Einfaches JWT-Parsing (ohne Verifizierung in Middleware)
        // Vollständige Verifizierung erfolgt in den API-Routes
        const parts = token.split('.');
        if (parts.length === 3) {
          // Base64-Decoding im Edge Runtime (ohne Buffer)
          const payloadJson = atob(parts[1]);
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

  // Wenn companyId oder companySlug gefunden, setze Tenant-Context
  if (companyId || companySlug) {
    setTenantContext({
      companyId: companyId || null,
      companySlug: companySlug || undefined,
    });
  } else {
    // Keine companyId/Slug gefunden - für API-Routes Fehler werfen
    if (request.nextUrl.pathname.startsWith('/api/')) {
      return NextResponse.json(
        { error: 'Company-ID nicht gefunden. Bitte Subdomain, Header oder JWT-Token verwenden.' },
        { status: 400 }
      );
    }
    // Für normale Seiten: Context auf null setzen (wird später behandelt)
    setTenantContext(null);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};

