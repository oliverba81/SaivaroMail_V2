import { NextRequest, NextResponse } from 'next/server';
import { getTenantDbClient, getTenantDbClientBySlug } from '@/lib/tenant-db-client';
import { getCompanyDbConfigBySlug } from '@/lib/scc-client';
import { extractTokenFromHeader, verifyToken } from '@/lib/auth';

export type TenantContext = {
  client: Awaited<ReturnType<typeof getTenantDbClient>>;
  payload: { sub: string; companyId?: string };
  resolvedCompanyId: string | null;
};

/**
 * Tenant-Context und Auth für API-Routen (z. B. /api/emails/[id]).
 * Gibt entweder { client, payload, resolvedCompanyId } oder { error: NextResponse }.
 */
export async function getTenantContext(
  request: NextRequest
): Promise<TenantContext | { error: NextResponse }> {
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

  if (payload.companyId && resolvedCompanyId && payload.companyId !== resolvedCompanyId) {
    return {
      error: NextResponse.json(
        { error: 'Token gehört nicht zu dieser Company' },
        { status: 403 }
      ),
    };
  }

  const client = resolvedCompanyId
    ? await getTenantDbClient(resolvedCompanyId)
    : await getTenantDbClientBySlug(companySlug!);

  return {
    client,
    payload,
    resolvedCompanyId: resolvedCompanyId || null,
  };
}
