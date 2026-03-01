import { NextRequest, NextResponse } from 'next/server';
import { getTenantDbClient, getTenantDbClientBySlug } from '@/lib/tenant-db-client';
import { getCompanyDbConfigBySlug } from '@/lib/scc-client';
import { extractTokenFromHeader, verifyToken } from '@/lib/auth';

/** Kontakt-Response-Objekt (mit phones, emails, addresses) */
function mapContactRow(row: any, phones: any[], emails: any[], addresses: any[]) {
  return {
    id: row.id,
    companyId: row.company_id,
    firstName: row.first_name ?? null,
    lastName: row.last_name ?? null,
    companyName: row.company_name ?? null,
    salutation: row.salutation ?? 'sie',
    formalTitle: row.formal_title ?? null,
    notes: row.notes ?? null,
    birthday: row.birthday ?? null,
    avatarUrl: row.avatar_url ?? null,
    customerNumber: row.customer_number ?? null,
    tags: Array.isArray(row.tags) ? row.tags : (row.tags ? JSON.parse(row.tags || '[]') : []),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    phones: phones.map((p: any) => ({
      id: p.id,
      label: p.label ?? null,
      number: p.number,
      sortOrder: p.sort_order ?? 0,
    })),
    emails: emails.map((e: any) => ({
      id: e.id,
      label: e.label ?? null,
      email: e.email,
      sortOrder: e.sort_order ?? 0,
    })),
    addresses: addresses.map((a: any) => ({
      id: a.id,
      label: a.label ?? null,
      street: a.street ?? null,
      postalCode: a.postal_code ?? null,
      city: a.city ?? null,
      country: a.country ?? null,
      sortOrder: a.sort_order ?? 0,
    })),
  };
}

async function getAuthAndResolvedCompanyId(request: NextRequest) {
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

  const token = extractTokenFromHeader(request.headers.get('authorization'));
  if (!token) {
    return { error: NextResponse.json({ error: 'Authorization-Token erforderlich' }, { status: 401 }) };
  }
  const payload = verifyToken(token);
  if (!payload) {
    return { error: NextResponse.json({ error: 'Ungültiger Token' }, { status: 401 }) };
  }
  if (!companyId && payload.companyId) companyId = payload.companyId;
  if (!companyId && !companySlug) {
    return { error: NextResponse.json({ error: 'Tenant-Context nicht gesetzt.' }, { status: 400 }) };
  }

  let resolvedCompanyId = companyId;
  if (!resolvedCompanyId && companySlug) {
    const dbConfig = await getCompanyDbConfigBySlug(companySlug);
    if (dbConfig) resolvedCompanyId = dbConfig.companyId;
  }
  if (!resolvedCompanyId) {
    return { error: NextResponse.json({ error: 'Company-ID konnte nicht aufgelöst werden' }, { status: 400 }) };
  }
  return { payload, resolvedCompanyId, companySlug };
}

/**
 * GET /api/contacts
 * Liste aller Kontakte. Query: ?q=... (Suche Name/E-Mail/Telefon), ?email=... (Lookup nach E-Mail)
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await getAuthAndResolvedCompanyId(request);
    if ('error' in authResult) return authResult.error;
    const { resolvedCompanyId, companySlug } = authResult;

    const client = resolvedCompanyId
      ? await getTenantDbClient(resolvedCompanyId)
      : await getTenantDbClientBySlug(companySlug!);
    try {
      const { searchParams } = new URL(request.url);
      const q = searchParams.get('q')?.trim() || null;
      const emailFilter = searchParams.get('email')?.trim() || null;

      let contactIds: string[] | null = null;
      if (emailFilter) {
        const emailMatch = await client.query(
          `SELECT contact_id FROM contact_emails WHERE LOWER(email) = LOWER($1)`,
          [emailFilter]
        );
        contactIds = emailMatch.rows.map((r: any) => r.contact_id);
        if (contactIds.length === 0) {
          return NextResponse.json({ contacts: [] });
        }
      }

      let sql = `
        SELECT c.id, c.company_id, c.first_name, c.last_name, c.company_name, c.salutation, c.formal_title,
               c.notes, c.birthday, c.avatar_url, c.customer_number, c.tags, c.created_at, c.updated_at
        FROM contacts c
        WHERE c.company_id = $1
      `;
      const params: any[] = [resolvedCompanyId];

      if (contactIds && contactIds.length > 0) {
        sql += ` AND c.id = ANY($2)`;
        params.push(contactIds);
      }

      if (q) {
        sql += ` AND (
          c.first_name ILIKE $${params.length + 1} OR c.last_name ILIKE $${params.length + 1} OR c.company_name ILIKE $${params.length + 1}
          OR EXISTS (SELECT 1 FROM contact_emails e WHERE e.contact_id = c.id AND e.email ILIKE $${params.length + 1})
          OR EXISTS (SELECT 1 FROM contact_phones p WHERE p.contact_id = c.id AND p.number ILIKE $${params.length + 1})
        )`;
        params.push(`%${q}%`);
      }

      sql += ` ORDER BY c.last_name ASC NULLS LAST, c.first_name ASC NULLS LAST, c.company_name ASC NULLS LAST`;

      const result = await client.query(sql, params);
      const rows = result.rows;

      if (rows.length === 0) {
        return NextResponse.json({ contacts: [] });
      }

      const ids = rows.map((r: any) => r.id);
      const [phonesResult, emailsResult, addressesResult] = await Promise.all([
        client.query('SELECT * FROM contact_phones WHERE contact_id = ANY($1) ORDER BY contact_id, sort_order', [ids]),
        client.query('SELECT * FROM contact_emails WHERE contact_id = ANY($1) ORDER BY contact_id, sort_order', [ids]),
        client.query('SELECT * FROM contact_addresses WHERE contact_id = ANY($1) ORDER BY contact_id, sort_order', [ids]),
      ]);

      const phonesByContact = new Map<string, any[]>();
      phonesResult.rows.forEach((p: any) => {
        if (!phonesByContact.has(p.contact_id)) phonesByContact.set(p.contact_id, []);
        phonesByContact.get(p.contact_id)!.push(p);
      });
      const emailsByContact = new Map<string, any[]>();
      emailsResult.rows.forEach((e: any) => {
        if (!emailsByContact.has(e.contact_id)) emailsByContact.set(e.contact_id, []);
        emailsByContact.get(e.contact_id)!.push(e);
      });
      const addressesByContact = new Map<string, any[]>();
      addressesResult.rows.forEach((a: any) => {
        if (!addressesByContact.has(a.contact_id)) addressesByContact.set(a.contact_id, []);
        addressesByContact.get(a.contact_id)!.push(a);
      });

      const contacts = rows.map((row: any) =>
        mapContactRow(
          row,
          phonesByContact.get(row.id) || [],
          emailsByContact.get(row.id) || [],
          addressesByContact.get(row.id) || []
        )
      );
      return NextResponse.json({ contacts });
    } finally {
      client.release();
    }
  } catch (err: any) {
    console.error('Fehler GET /api/contacts:', err);
    return NextResponse.json({ error: 'Fehler beim Laden der Kontakte' }, { status: 500 });
  }
}

/**
 * POST /api/contacts
 * Neuen Kontakt anlegen (inkl. phones, emails, addresses in Transaktion)
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await getAuthAndResolvedCompanyId(request);
    if ('error' in authResult) return authResult.error;
    const { resolvedCompanyId, companySlug } = authResult;

    const body = await request.json();
    const {
      firstName,
      lastName,
      companyName,
      salutation,
      formalTitle,
      notes,
      birthday,
      avatarUrl,
      customerNumber,
      tags,
      phones = [],
      emails = [],
      addresses = [],
    } = body;

    const displayName = [firstName, lastName].filter(Boolean).join(' ').trim() || companyName?.trim();
    if (!displayName) {
      return NextResponse.json(
        { error: 'Mindestens ein Anzeigename (Vorname, Nachname oder Firma) ist erforderlich' },
        { status: 400 }
      );
    }
    const salutationVal = salutation === 'du' ? 'du' : 'sie';
    const tagsArr = Array.isArray(tags) ? tags : [];

    const client = resolvedCompanyId
      ? await getTenantDbClient(resolvedCompanyId)
      : await getTenantDbClientBySlug(companySlug!);
    try {
      await client.query('BEGIN');
      const insertContact = await client.query(
        `INSERT INTO contacts (company_id, first_name, last_name, company_name, salutation, formal_title, notes, birthday, avatar_url, customer_number, tags)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING id, company_id, first_name, last_name, company_name, salutation, formal_title, notes, birthday, avatar_url, customer_number, tags, created_at, updated_at`,
        [
          resolvedCompanyId,
          firstName?.trim() || null,
          lastName?.trim() || null,
          companyName?.trim() || null,
          salutationVal,
          formalTitle?.trim() || null,
          notes?.trim() || null,
          birthday || null,
          avatarUrl?.trim() || null,
          customerNumber?.trim() || null,
          JSON.stringify(tagsArr),
        ]
      );
      const contact = insertContact.rows[0];
      const contactId = contact.id;

      for (let i = 0; i < (phones || []).length; i++) {
        const p = phones[i];
        if (p && p.number) {
          await client.query(
            `INSERT INTO contact_phones (contact_id, label, number, sort_order) VALUES ($1, $2, $3, $4)`,
            [contactId, p.label?.trim() || null, String(p.number).trim(), p.sortOrder ?? i]
          );
        }
      }
      for (let i = 0; i < (emails || []).length; i++) {
        const e = emails[i];
        if (e && e.email) {
          await client.query(
            `INSERT INTO contact_emails (contact_id, label, email, sort_order) VALUES ($1, $2, $3, $4)`,
            [contactId, e.label?.trim() || null, String(e.email).trim(), e.sortOrder ?? i]
          );
        }
      }
      for (let i = 0; i < (addresses || []).length; i++) {
        const a = addresses[i];
        await client.query(
          `INSERT INTO contact_addresses (contact_id, label, street, postal_code, city, country, sort_order) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            contactId,
            a?.label?.trim() || null,
            a?.street?.trim() || null,
            a?.postal_code?.trim() || a?.postalCode?.trim() || null,
            a?.city?.trim() || null,
            a?.country?.trim() || null,
            a?.sortOrder ?? i,
          ]
        );
      }

      const [phonesResult, emailsResult, addressesResult] = await Promise.all([
        client.query('SELECT * FROM contact_phones WHERE contact_id = $1 ORDER BY sort_order', [contactId]),
        client.query('SELECT * FROM contact_emails WHERE contact_id = $1 ORDER BY sort_order', [contactId]),
        client.query('SELECT * FROM contact_addresses WHERE contact_id = $1 ORDER BY sort_order', [contactId]),
      ]);
      await client.query('COMMIT');

      const contactResponse = mapContactRow(
        contact,
        phonesResult.rows,
        emailsResult.rows,
        addressesResult.rows
      );
      return NextResponse.json({ contact: contactResponse, message: 'Kontakt erstellt' }, { status: 201 });
    } catch (txErr: any) {
      await client.query('ROLLBACK');
      throw txErr;
    } finally {
      client.release();
    }
  } catch (err: any) {
    console.error('Fehler POST /api/contacts:', err);
    return NextResponse.json({ error: 'Fehler beim Anlegen des Kontakts' }, { status: 500 });
  }
}
