import { NextRequest, NextResponse } from 'next/server';
import { extractTokenFromHeader, verifyToken } from '@/lib/auth';
import { getCompanyFeatures, getCompanyFeaturesBySlug } from '@/lib/company-features';

/**
 * GET /api/company/features
 * Lädt Feature-Flags für die aktuelle Company
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

    // Lade Feature-Flags
    let features;
    if (companyId) {
      features = await getCompanyFeatures(companyId);
    } else if (companySlug) {
      features = await getCompanyFeaturesBySlug(companySlug);
    } else {
      return NextResponse.json(
        { error: 'Company-ID oder Slug erforderlich' },
        { status: 400 }
      );
    }

    return NextResponse.json({ features });
  } catch (error: any) {
    console.error('Fehler beim Laden der Feature-Flags:', error);
    // Bei Fehler: Standardwerte zurückgeben (Features deaktiviert)
    return NextResponse.json({
      features: {
        textToSpeech: false,
        emailSummary: false,
        audioFeatures: false,
      },
    });
  }
}
