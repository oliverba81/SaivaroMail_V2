import { NextRequest, NextResponse } from 'next/server';
import { getTenantDbClient, getTenantDbClientBySlug } from '@/lib/tenant-db-client';
import { getCompanyDbConfigBySlug } from '@/lib/scc-client';
import { extractTokenFromHeader, verifyToken } from '@/lib/auth';
import * as jwt from 'jsonwebtoken';

/**
 * GET /api/departments
 * Liste aller Abteilungen (für alle Benutzer, da für Filter benötigt)
 */
export async function GET(request: NextRequest) {
  try {
    // Tenant-Context aus Request extrahieren
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

    // JWT-Token aus Header extrahieren
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
    
    // companyId aus Token extrahieren, falls nicht bereits vorhanden
    if (!companyId && payload.companyId) {
      companyId = payload.companyId;
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

    // Tenant-Context companyId auflösen (falls nur Slug vorhanden)
    let resolvedCompanyId = tenantContext.companyId;
    if (!resolvedCompanyId && tenantContext.companySlug) {
      const dbConfig = await getCompanyDbConfigBySlug(tenantContext.companySlug);
      if (dbConfig) {
        resolvedCompanyId = dbConfig.companyId;
      }
    }

    // Tenant-DB-Client holen
    let client;
    if (resolvedCompanyId) {
      client = await getTenantDbClient(resolvedCompanyId);
    } else if (tenantContext.companySlug) {
      client = await getTenantDbClientBySlug(tenantContext.companySlug);
    } else {
      return NextResponse.json(
        { error: 'Company-ID oder Slug erforderlich' },
        { status: 400 }
      );
    }

    try {
      // Sicherstellen, dass wir eine UUID haben (company_id ist UUID, nicht Slug)
      if (!resolvedCompanyId) {
        return NextResponse.json(
          { error: 'Company-ID konnte nicht aufgelöst werden' },
          { status: 400 }
        );
      }

      // Query-Parameter für includeInactive
      const { searchParams } = new URL(request.url);
      const includeInactive = searchParams.get('includeInactive') === 'true';

      // Lade Abteilungen mit Manager- und E-Mail-Konto-Informationen
      // Optimiert: Separate Query für usage_count statt Subquery für jede Zeile
      const result = await client.query(`
        SELECT 
          d.id,
          d.name,
          d.description,
          d.manager_id,
          d.is_active,
          d.email_account_id,
          d.signature,
          d.signature_plain,
          d.signature_enabled,
          d.created_at,
          d.updated_at,
          u.username as manager_username,
          u.email as manager_email,
          u.first_name as manager_first_name,
          u.last_name as manager_last_name,
          ea.id as email_account_id_val,
          ea.name as email_account_name,
          ea.email as email_account_email,
          ea.is_active as email_account_is_active
        FROM departments d
        LEFT JOIN users u ON d.manager_id = u.id
        LEFT JOIN email_accounts ea ON d.email_account_id = ea.id
        WHERE d.company_id = $1
        ${includeInactive ? '' : 'AND d.is_active = true'}
        ORDER BY d.name ASC
      `, [resolvedCompanyId]);

      // Berechne usage_count in einem einzigen Query statt Subquery für jede Zeile
      const usageCountResult = await client.query(`
        SELECT 
          email_account_id,
          COUNT(*) as usage_count
        FROM departments
        WHERE email_account_id IS NOT NULL
          AND company_id = $1
        GROUP BY email_account_id
      `, [resolvedCompanyId]);

      const usageCountMap = new Map(
        usageCountResult.rows.map((row: any) => [
          row.email_account_id,
          parseInt(row.usage_count || '0', 10)
        ])
      );

      return NextResponse.json({
        departments: result.rows.map((row: any) => ({
          id: row.id,
          name: row.name,
          description: row.description,
          managerId: row.manager_id,
          isActive: row.is_active || false,
          emailAccountId: row.email_account_id_val,
          signature: row.signature ?? null,
          signaturePlain: row.signature_plain ?? null,
          signatureEnabled: row.signature_enabled ?? false,
          emailAccount: row.email_account_id_val ? {
            id: row.email_account_id_val,
            name: row.email_account_name,
            email: row.email_account_email,
            isActive: row.email_account_is_active || false,
            usageCount: usageCountMap.get(row.email_account_id_val) || 0,
          } : null,
          manager: row.manager_id ? {
            id: row.manager_id,
            username: row.manager_username,
            email: row.manager_email,
            firstName: row.manager_first_name,
            lastName: row.manager_last_name,
          } : null,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        })),
      });
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error('Fehler beim Laden der Abteilungen:', error);
    return NextResponse.json(
      { error: 'Fehler beim Laden der Abteilungen' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/departments
 * Neue Abteilung erstellen (nur für Admins)
 */
export async function POST(request: NextRequest) {
  try {
    // Tenant-Context aus Request extrahieren
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

    // JWT-Token aus Header extrahieren
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Nicht autorisiert' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    let payload: any;
    try {
      payload = jwt.verify(
        token,
        process.env.JWT_SECRET || 'dev-secret-change-in-production'
      ) as any;
      
      // 3. companyId aus Token extrahieren, falls nicht bereits vorhanden
      if (!companyId && payload && payload.companyId) {
        companyId = payload.companyId;
      }
    } catch {
      return NextResponse.json(
        { error: 'Ungültiger Token' },
        { status: 401 }
      );
    }

    if (!companyId && !companySlug) {
      return NextResponse.json(
        { error: 'Tenant-Context nicht gesetzt. Request muss companyId oder companySlug enthalten.' },
        { status: 400 }
      );
    }

    // Tenant-Context companyId auflösen (falls nur Slug vorhanden)
    let resolvedCompanyId = companyId;
    if (!resolvedCompanyId && companySlug) {
      const dbConfig = await getCompanyDbConfigBySlug(companySlug);
      if (dbConfig) {
        resolvedCompanyId = dbConfig.companyId;
      }
    }

    const body = await request.json();
    const { name, description, managerId, emailAccountId, isActive, signature, signaturePlain, signatureEnabled } = body;

    // Validierung
    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: 'Name der Abteilung ist erforderlich' },
        { status: 400 }
      );
    }

    // Validierung: Wenn isActive = true, muss emailAccountId vorhanden sein
    if (isActive === true && !emailAccountId) {
      return NextResponse.json(
        { error: 'Abteilung kann nicht aktiviert werden: Kein E-Mail-Konto zugewiesen' },
        { status: 400 }
      );
    }

    // Prüfe, ob User Admin ist
    const client = resolvedCompanyId 
      ? await getTenantDbClient(resolvedCompanyId)
      : await getTenantDbClientBySlug(companySlug!);
    try {
      const userResult = await client.query(
        'SELECT role FROM users WHERE id = $1',
        [payload.sub]
      );

      if (userResult.rows.length === 0) {
        return NextResponse.json(
          { error: 'User nicht gefunden' },
          { status: 404 }
        );
      }

      const userRole = userResult.rows[0].role;
      if (userRole !== 'admin') {
        return NextResponse.json(
          { error: 'Nur Administratoren können Abteilungen erstellen' },
          { status: 403 }
        );
      }

      // Prüfe, ob Abteilung mit diesem Namen bereits existiert
      const existingDept = await client.query(
        'SELECT id FROM departments WHERE company_id = $1 AND name = $2',
        [resolvedCompanyId || companySlug, name.trim()]
      );

      if (existingDept.rows.length > 0) {
        return NextResponse.json(
          { error: 'Eine Abteilung mit diesem Namen existiert bereits' },
          { status: 400 }
        );
      }

      // Prüfe, ob Manager existiert (falls angegeben)
      if (managerId) {
        const managerCheck = await client.query(
          'SELECT id FROM users WHERE id = $1 AND company_id = $2',
          [managerId, resolvedCompanyId || companySlug]
        );

        if (managerCheck.rows.length === 0) {
          return NextResponse.json(
            { error: 'Manager nicht gefunden' },
            { status: 404 }
          );
        }
      }

      // Validierung: E-Mail-Konto prüfen (falls angegeben)
      if (emailAccountId) {
        // Prüfe, ob E-Mail-Konto existiert
        const emailAccountCheck = await client.query(
          `SELECT ea.id, ea.is_active, ea.smtp_host, ea.smtp_username, ea.smtp_password, u.company_id
           FROM email_accounts ea
           JOIN users u ON ea.user_id = u.id
           WHERE ea.id = $1 AND u.company_id = $2`,
          [emailAccountId, resolvedCompanyId || companySlug]
        );

        if (emailAccountCheck.rows.length === 0) {
          return NextResponse.json(
            { error: 'E-Mail-Konto nicht gefunden oder gehört nicht zu dieser Company' },
            { status: 404 }
          );
        }

        const account = emailAccountCheck.rows[0];
        
        // Prüfe, ob E-Mail-Konto aktiv ist
        if (!account.is_active) {
          return NextResponse.json(
            { error: 'E-Mail-Konto ist inaktiv und kann nicht verwendet werden' },
            { status: 400 }
          );
        }

        // Prüfe, ob E-Mail-Konto SMTP-Daten hat
        if (!account.smtp_host || !account.smtp_username || !account.smtp_password) {
          return NextResponse.json(
            { error: 'E-Mail-Konto hat keine SMTP-Daten und kann nicht für Abteilungen verwendet werden' },
            { status: 400 }
          );
        }

        // Prüfe, ob E-Mail-Konto bereits einer anderen Abteilung zugeordnet ist
        const existingDeptCheck = await client.query(
          `SELECT id, name FROM departments WHERE email_account_id = $1 AND company_id = $2`,
          [emailAccountId, resolvedCompanyId || companySlug]
        );

        if (existingDeptCheck.rows.length > 0) {
          return NextResponse.json(
            { error: `Dieses E-Mail-Konto ist bereits der Abteilung "${existingDeptCheck.rows[0].name}" zugeordnet. Ein E-Mail-Konto kann nur einer Abteilung zugeordnet werden.` },
            { status: 400 }
          );
        }
      }

      // Abteilung erstellen
      const result = await client.query(
        `INSERT INTO departments (company_id, name, description, manager_id, email_account_id, is_active, signature, signature_plain, signature_enabled)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING id, name, description, manager_id, email_account_id, is_active, signature, signature_plain, signature_enabled, created_at, updated_at`,
        [
          resolvedCompanyId || companySlug,
          name.trim(),
          description?.trim() || null,
          managerId || null,
          emailAccountId || null,
          isActive === true ? true : false,
          signature?.trim() || null,
          signaturePlain?.trim() || null,
          signatureEnabled === true,
        ]
      );

      const newDept = result.rows[0];

      // Lade Manager-Informationen, falls vorhanden
      let manager = null;
      if (newDept.manager_id) {
        const managerResult = await client.query(
          'SELECT id, username, email, first_name, last_name FROM users WHERE id = $1',
          [newDept.manager_id]
        );
        if (managerResult.rows.length > 0) {
          const m = managerResult.rows[0];
          manager = {
            id: m.id,
            username: m.username,
            email: m.email,
            firstName: m.first_name,
            lastName: m.last_name,
          };
        }
      }

      // Lade E-Mail-Konto-Informationen, falls vorhanden
      let emailAccount = null;
      if (newDept.email_account_id) {
        const emailAccountResult = await client.query(
          `SELECT id, name, email, is_active,
           (SELECT COUNT(*) FROM departments d2 WHERE d2.email_account_id = email_accounts.id AND d2.email_account_id IS NOT NULL) as usage_count
           FROM email_accounts WHERE id = $1`,
          [newDept.email_account_id]
        );
        if (emailAccountResult.rows.length > 0) {
          const ea = emailAccountResult.rows[0];
          emailAccount = {
            id: ea.id,
            name: ea.name,
            email: ea.email,
            isActive: ea.is_active || false,
            usageCount: parseInt(ea.usage_count || '0', 10),
          };
        }
      }

      return NextResponse.json(
        {
          department: {
            id: newDept.id,
            name: newDept.name,
            description: newDept.description,
            managerId: newDept.manager_id,
            manager,
            isActive: newDept.is_active || false,
            emailAccountId: newDept.email_account_id,
            emailAccount,
            signature: newDept.signature ?? null,
            signaturePlain: newDept.signature_plain ?? null,
            signatureEnabled: newDept.signature_enabled ?? false,
            createdAt: newDept.created_at,
            updatedAt: newDept.updated_at,
          },
          message: 'Abteilung erfolgreich erstellt',
        },
        { status: 201 }
      );
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error('Fehler beim Erstellen der Abteilung:', error);
    if (error.code === '23505') {
      return NextResponse.json(
        { error: 'Eine Abteilung mit diesem Namen existiert bereits' },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Fehler beim Erstellen der Abteilung' },
      { status: 500 }
    );
  }
}

