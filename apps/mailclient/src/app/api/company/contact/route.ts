import { NextRequest, NextResponse } from 'next/server';
import { extractTokenFromHeader, verifyToken } from '@/lib/auth';
import { getCompanyContact, getCompanyContactBySlug } from '@/lib/scc-client';

/**
 * GET /api/company/contact
 * Liefert Kontaktdaten der Company für Signatur-Platzhalter.
 * User-Daten (userName, firstName, lastName) kommen aus dem Frontend (localStorage mailclient_user).
 */
export async function GET(request: NextRequest) {
  try {
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

    let company;
    if (companyId) {
      company = await getCompanyContact(companyId);
    } else if (companySlug) {
      company = await getCompanyContactBySlug(companySlug);
    } else {
      return NextResponse.json(
        { error: 'Company-ID oder Slug erforderlich' },
        { status: 400 }
      );
    }

    if (!company) {
      return NextResponse.json({
        company: {
          name: '',
          contactAddress: null,
          contactPhone: null,
          contactEmail: null,
          contactWebsite: null,
        },
      });
    }

    return NextResponse.json({
      company: {
        name: company.name,
        contactAddress: company.contactAddress,
        contactPhone: company.contactPhone,
        contactEmail: company.contactEmail,
        contactWebsite: company.contactWebsite,
      },
    });
  } catch (error: unknown) {
    console.error('Fehler beim Laden der Company-Kontaktdaten:', error);
    return NextResponse.json(
      {
        company: {
          name: '',
          contactAddress: null,
          contactPhone: null,
          contactEmail: null,
          contactWebsite: null,
        },
      },
      { status: 200 }
    );
  }
}
