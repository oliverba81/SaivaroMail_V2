import { NextRequest, NextResponse } from 'next/server';
import { getTenantDbClient } from '@/lib/tenant-db-client';
import { extractTokenFromHeader, verifyToken } from '@/lib/auth';
import nodemailer from 'nodemailer';
import { generateTicketId, extractTicketIdFromSubject } from '@/lib/ticket-id-generator';
import { getCompanyConfig } from '@/lib/company-config';
import { EMAIL_REPLY_LOCK_TTL_SECONDS } from '@/lib/tenant-db-migrations';
import { looksLikeHtml, stripHtml } from '@/utils/signature-placeholders';

/**
 * GET /api/emails
 * Lädt E-Mails aus der Tenant-DB
 * Erfordert: Tenant-Context (Subdomain/Header/JWT) + Auth-Token
 */
export async function GET(request: NextRequest) {
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
    const authHeader = request.headers.get('authorization');
    const token = extractTokenFromHeader(authHeader);
    
    // Auth-Token prüfen
    if (!token) {
      return NextResponse.json(
        { error: 'Authorization-Token erforderlich' },
        { status: 401 }
      );
    }

    const payload = verifyToken(token);
    
    // companyId aus Token extrahieren, falls nicht bereits vorhanden
    if (!companyId && payload && payload.companyId) {
      companyId = payload.companyId;
    }
    
    if (!companyId && !companySlug) {
      return NextResponse.json(
        { error: 'Tenant-Context nicht gesetzt. Request muss companyId oder companySlug enthalten.' },
        { status: 400 }
      );
    }
    
    if (!payload) {
      return NextResponse.json(
        { error: 'Ungültiger Token' },
        { status: 401 }
      );
    }
    
    const tenantContext = {
      companyId: companyId || null,
      companySlug: companySlug || undefined,
    };

    // Tenant-Context companyId auflösen (falls nur Slug vorhanden)
    let resolvedCompanyId = tenantContext.companyId;
    if (!resolvedCompanyId && tenantContext.companySlug) {
      const { getCompanyDbConfigBySlug } = await import('@/lib/scc-client');
      const dbConfig = await getCompanyDbConfigBySlug(tenantContext.companySlug);
      if (dbConfig) {
        resolvedCompanyId = dbConfig.companyId;
      }
    }

    // Sicherstellen, dass Token-companyId mit Tenant-Context übereinstimmt
    if (payload.companyId && resolvedCompanyId && payload.companyId !== resolvedCompanyId) {
      return NextResponse.json(
        { error: 'Token gehört nicht zu dieser Company' },
        { status: 403 }
      );
    }

    // Tenant-DB-Client holen (unterstützt auch Slug)
    let client;
    if (resolvedCompanyId) {
      client = await getTenantDbClient(resolvedCompanyId);
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
      // User-Rolle für Sichtbarkeit: Admins sehen alle E-Mails der Company
      const roleResult = await client.query(
        `SELECT role FROM users WHERE id = $1`,
        [payload.sub]
      );
      const userRole = roleResult.rows[0]?.role ?? null;
      const isAdmin = String(userRole).toLowerCase() === 'admin';

      // Query-Parameter für Suche und Paginierung
      const { searchParams } = new URL(request.url);
      const search = searchParams.get('search');
      const filter = searchParams.get('filter'); // 'all', 'read', 'unread'

      const searchFieldsParam = searchParams.get('searchFields'); // Komma-getrennte Liste: 'subject,from,body'
      const ticketId = searchParams.get('ticketId'); // Filter nach Ticket-ID
      // Validierung: page muss nicht-negativ sein
      const pageParam = searchParams.get('page') || '0';
      const page = Math.max(0, parseInt(pageParam, 10) || 0); // Clamp auf 0+
      const limitParam = searchParams.get('limit');
      const includeBody = searchParams.get('includeBody') === 'true';

      // Lade maxEmailsPerPage aus Company metadata (Standard: 100)
      let maxEmailsPerPage = 100;
      try {
        const { getCompanyDbConfigBySlug } = await import('@/lib/scc-client');
        const dbConfig = resolvedCompanyId 
          ? await import('@/lib/scc-client').then(m => m.getCompanyDbConfig(resolvedCompanyId))
          : tenantContext.companySlug 
            ? await getCompanyDbConfigBySlug(tenantContext.companySlug)
            : null;
        if (dbConfig?.metadata?.maxEmailsPerPage) {
          const parsed = parseInt(String(dbConfig.metadata.maxEmailsPerPage), 10);
          maxEmailsPerPage = (isNaN(parsed) || parsed < 1) ? 100 : Math.min(parsed, 200); // Clamp auf 1-200
        }
      } catch (error) {
        console.warn('Fehler beim Laden der Company-Einstellung, verwende Standard-Wert 100:', error);
      }

      // Validierung: limit muss positiv sein und zwischen 1 und 200 liegen
      const limit = limitParam 
        ? Math.max(1, Math.min(parseInt(limitParam, 10) || 100, 200)) 
        : maxEmailsPerPage;
      const offset = page * limit;

      // Body-Feld nur laden wenn includeBody=true
      const bodyField = includeBody ? 'e.body,' : '';
      // Admins sehen alle E-Mails der Company; normale User nur eigene + Abteilungs-E-Mails
      const visibilityWhere = isAdmin
        ? '1=1'
        : `(e.user_id = $1 OR ud.department_id IS NOT NULL)`;
      
      let query = `SELECT DISTINCT e.id, e.subject, e.from_email, e.to_email, e.department_id, ${bodyField} e.created_at, 
                          e.deleted_at, e.spam_at, e.important_at, e.theme_id, e.has_attachment,
                          e.ticket_id, e.is_conversation_thread, e.conversation_message_count,
                          e.type, e.phone_number,
                          ers.read_at,
                          ecs.completed_at,
                          et.id as theme_id_full, et.name as theme_name, et.color as theme_color,
                          d.id as department_id_val, d.name as department_name,
                          (SELECT COUNT(*)::int FROM email_notes en WHERE en.email_id = e.id) AS note_count,
                          (SELECT LEFT(en.content, 80) FROM email_notes en WHERE en.email_id = e.id ORDER BY en.created_at DESC LIMIT 1) AS last_note_content,
                          (SELECT COALESCE(NULLIF(TRIM(CONCAT(COALESCE(u.first_name,''), ' ', COALESCE(u.last_name,''))), ''), u.username, u.email, 'Unbekannt') FROM email_notes en LEFT JOIN users u ON en.user_id = u.id WHERE en.email_id = e.id ORDER BY en.created_at DESC LIMIT 1) AS last_note_user_name,
                          (SELECT en.created_at FROM email_notes en WHERE en.email_id = e.id ORDER BY en.created_at DESC LIMIT 1) AS last_note_created_at
                   FROM emails e
                   LEFT JOIN email_read_status ers ON e.id = ers.email_id AND ers.user_id = $1
                   LEFT JOIN email_completed_status ecs ON e.id = ecs.email_id AND ecs.user_id = $1
                   LEFT JOIN email_themes et ON e.theme_id = et.id
                   LEFT JOIN departments d ON e.department_id = d.id
                   LEFT JOIN user_departments ud ON e.department_id = ud.department_id AND ud.user_id = $1
                   WHERE ${visibilityWhere}`;
      const queryParams: any[] = [payload.sub];
      let paramIndex = 2;

      // Backend-Filtering: Gelöschte E-Mails standardmäßig ausblenden
      // Nur anzeigen wenn explizit danach gefiltert wird (z.B. über customFilter)
      const showDeleted = searchParams.get('showDeleted') === 'true';
      if (!showDeleted) {
        query += ` AND e.deleted_at IS NULL`;
      }

      // Gelöschte E-Mails werden standardmäßig ausgeblendet
      // (Die Filter-Logik im Frontend kann sie wieder einblenden, wenn explizit danach gefiltert wird)
      // Für jetzt laden wir alle E-Mails, damit Filter funktionieren
      // query += ` AND (deleted_at IS NULL)`;

      // Filter nach Ticket-ID (für Konversationen)
      if (ticketId) {
        query += ` AND e.ticket_id = $${paramIndex}`;
        queryParams.push(ticketId);
        paramIndex++;
      }

      // Suchfilter - nur in ausgewählten Feldern suchen
      // Suche nur wenn mindestens 3 Zeichen eingegeben wurden
      const searchTerm = search ? String(search).trim() : '';
      if (searchTerm.length >= 3) {
        // Parse Suchfelder - filtere leere Strings und normalisiere
        const searchFields = searchFieldsParam 
          ? searchFieldsParam.split(',').map(f => f.trim().toLowerCase()).filter(f => f.length > 0)
          : ['subject', 'from', 'body']; // Standard-Felder
        
        // Debug-Log für Suchfelder (kann später entfernt werden)
        if (process.env.NODE_ENV === 'development') {
          console.log('[API] Suche in Feldern:', searchFields, 'Suchbegriff:', searchTerm);
        }
        
        const searchConditions: string[] = [];
        // Escape Sonderzeichen für ILIKE (%, _)
        const escapedSearchTerm = searchTerm.replace(/[%_]/g, '\\$&');
        const searchPattern = `%${escapedSearchTerm}%`;
        // Regex-Pattern für Zahlen in Wörtern (z.B. "test123" findet "123")
        // Escape Regex-Sonderzeichen
        const regexEscapedTerm = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regexPattern = `.*${regexEscapedTerm}.*`;
        
        // Sammle alle benötigten Parameter
        const paramsToAdd: any[] = [];
        let currentParamIndex = paramIndex;
        
        if (searchFields.includes('subject')) {
          // ILIKE für normale Suche + Regex für Zahlen in Wörtern
          searchConditions.push(`(
            e.subject ILIKE $${currentParamIndex}
            OR e.subject ~* $${currentParamIndex + 1}
          )`);
          paramsToAdd.push(searchPattern, regexPattern);
          currentParamIndex += 2;
        }
        if (searchFields.includes('from')) {
          searchConditions.push(`e.from_email ILIKE $${currentParamIndex}`);
          paramsToAdd.push(searchPattern);
          currentParamIndex += 1;
        }
        if (searchFields.includes('to')) {
          searchConditions.push(`e.to_email ILIKE $${currentParamIndex}`);
          paramsToAdd.push(searchPattern);
          currentParamIndex += 1;
        }
        if (searchFields.includes('phone') || searchFields.includes('phone_number')) {
          // Suche in phone_number nur wenn Feld nicht NULL ist
          searchConditions.push(`(e.phone_number IS NOT NULL AND e.phone_number ILIKE $${currentParamIndex})`);
          paramsToAdd.push(searchPattern);
          currentParamIndex += 1;
        }
        if (searchFields.includes('body')) {
          // Verwende Volltext-Suche (tsvector) für body, falls verfügbar
          // Fallback auf ILIKE + Regex wenn tsvector nicht verfügbar ist
          searchConditions.push(`(
            (e.body_tsvector IS NOT NULL AND e.body_tsvector @@ plainto_tsquery('german', $${currentParamIndex}))
            OR (e.body_tsvector IS NULL AND (
              e.body ILIKE $${currentParamIndex + 1}
              OR e.body ~* $${currentParamIndex + 2}
            ))
          )`);
          paramsToAdd.push(searchTerm, searchPattern, regexPattern);
          currentParamIndex += 3;
        }
        if (searchFields.includes('notes')) {
          searchConditions.push(`EXISTS (SELECT 1 FROM email_notes en WHERE en.email_id = e.id AND en.content ILIKE $${currentParamIndex})`);
          paramsToAdd.push(searchPattern);
          currentParamIndex += 1;
        }
        
        if (searchConditions.length > 0) {
          query += ` AND (${searchConditions.join(' OR ')})`;
          queryParams.push(...paramsToAdd);
          paramIndex = currentParamIndex;
        } else {
          // Wenn keine Suchfelder ausgewählt sind, keine Suche durchführen
          // (sollte eigentlich nicht passieren, aber als Fallback)
          if (process.env.NODE_ENV === 'development') {
            console.warn('[API] Keine Suchfelder ausgewählt, Suche wird ignoriert');
          }
        }
      }
      // Wenn weniger als 3 Zeichen: Suche wird ignoriert (alle E-Mails werden angezeigt)

      // Status-Filter (benutzerbezogen)
      if (filter === 'read') {
        query += ` AND ers.read_at IS NOT NULL`;
      } else if (filter === 'unread') {
        query += ` AND ers.read_at IS NULL`;
      } else if (filter === 'completed') {
        query += ` AND ecs.completed_at IS NOT NULL`;
      } else if (filter === 'not_completed') {
        query += ` AND ecs.completed_at IS NULL`;
      }

      // Count-Query für totalPages (bis zur Haupt-FROM-Klausel "FROM emails e" ersetzen, nicht bis zum ersten FROM in Subqueries)
      const countQuery = query.replace(/SELECT[\s\S]*?\s+FROM\s+emails\s+e\b/, 'SELECT COUNT(*) as total FROM emails e');
      const countResult = await client.query(countQuery, queryParams);
      const total = parseInt(countResult.rows[0].total, 10);
      const totalPages = Math.ceil(total / limit);

      // Paginierung hinzufügen
      query += ` ORDER BY e.created_at DESC OFFSET $${paramIndex} LIMIT $${paramIndex + 1}`;
      queryParams.push(offset, limit);
      paramIndex += 2;

      const result = await client.query(query, queryParams);

      // N+1 Query Problem beheben: Lade alle Abteilungen in einem Query
      const emailIds = result.rows.map((row: any) => row.id);
      const fromEmails = [...new Set(result.rows.map((row: any) => row.from_email).filter(Boolean))];
      const allToEmails = new Set<string>();
      
      // Sammle alle to_email Adressen
      result.rows.forEach((row: any) => {
        if (row.to_email) {
          const toEmails = typeof row.to_email === 'string' 
            ? row.to_email.split(',').map((e: string) => e.trim())
            : Array.isArray(row.to_email) 
              ? row.to_email 
              : [];
          toEmails.forEach((email: string) => allToEmails.add(email));
        }
      });
      const toEmailsArray = Array.from(allToEmails);

      // Lade alle Abteilungen in einem Query
      const departmentQueries: Promise<any>[] = [];

      // 1. Abteilungen für from_email (ein Query für alle)
      if (fromEmails.length > 0) {
        departmentQueries.push(
          client.query(`
            SELECT DISTINCT LOWER(u.email) as email, d.id as department_id
            FROM users u
            JOIN user_departments ud ON u.id = ud.user_id
            JOIN departments d ON ud.department_id = d.id
            WHERE LOWER(u.email) = ANY($1::text[])
          `, [fromEmails.map((e: string) => e.toLowerCase())])
        );
      }

      // 2. Abteilungen für to_email (ein Query für alle)
      if (toEmailsArray.length > 0) {
        departmentQueries.push(
          client.query(`
            SELECT DISTINCT LOWER(u.email) as email, d.id as department_id
            FROM users u
            JOIN user_departments ud ON u.id = ud.user_id
            JOIN departments d ON ud.department_id = d.id
            WHERE LOWER(u.email) = ANY($1::text[])
          `, [toEmailsArray.map((e: string) => e.toLowerCase())])
        );
      }

      // 3. Direkt zugewiesene Abteilungen (ein Query für alle E-Mails)
      if (emailIds.length > 0) {
        departmentQueries.push(
          client.query(`
            SELECT ed.email_id, d.id as department_id, d.name as department_name
            FROM email_departments ed
            JOIN departments d ON ed.department_id = d.id
            WHERE ed.email_id = ANY($1::uuid[])
            ORDER BY d.name
          `, [emailIds])
        );
      }

      // 4. Reply-Locks (welche E-Mails werden gerade von wem beantwortet)
      // Anzeigename aus users holen, falls user_name in email_reply_locks fehlt oder leer ist
      let replyLocksResult: { rows: Array<{ email_id: string; user_id: string; user_name?: string }> } = { rows: [] };
      if (emailIds.length > 0) {
        try {
          replyLocksResult = await client.query(
            `SELECT erl.email_id, erl.user_id,
             COALESCE(NULLIF(TRIM(erl.user_name), ''),
               NULLIF(TRIM(CONCAT(COALESCE(u.first_name,''), ' ', COALESCE(u.last_name,''))), ''),
               u.username, u.email, 'Unbekannt') AS user_name
             FROM email_reply_locks erl
             LEFT JOIN users u ON u.id = erl.user_id
             WHERE erl.email_id = ANY($1::uuid[]) AND erl.heartbeat_at > NOW() - INTERVAL '1 second' * $2`,
            [emailIds, EMAIL_REPLY_LOCK_TTL_SECONDS]
          );
        } catch (lockErr: any) {
          if (lockErr?.code === '42P01') { /* undefined_table – Tabelle existiert noch nicht */ }
          else if (lockErr?.code === '42703') {
            // undefined_column – Tabelle hat anderes Schema (z. B. nur email_id, user_id), mit users-JOIN Namen holen
            try {
              replyLocksResult = await client.query(
                `SELECT erl.email_id, erl.user_id,
                 COALESCE(NULLIF(TRIM(CONCAT(COALESCE(u.first_name,''), ' ', COALESCE(u.last_name,''))), ''),
                   u.username, u.email, 'Unbekannt') AS user_name
                 FROM email_reply_locks erl
                 LEFT JOIN users u ON u.id = erl.user_id
                 WHERE erl.email_id = ANY($1::uuid[])`,
                [emailIds]
              );
            } catch (fallbackErr: any) {
              if (fallbackErr?.code !== '42P01' && fallbackErr?.code !== '42703') throw fallbackErr;
            }
          } else {
            throw lockErr;
          }
        }
      }

      // Führe Abteilungs-Queries parallel aus
      const [fromDeptResult, toDeptResult, assignedDeptResult] = await Promise.all([
        fromEmails.length > 0 ? departmentQueries[0] : Promise.resolve({ rows: [] }),
        toEmailsArray.length > 0 ? departmentQueries[fromEmails.length > 0 ? 1 : 0] : Promise.resolve({ rows: [] }),
        emailIds.length > 0 ? departmentQueries[departmentQueries.length - 1] : Promise.resolve({ rows: [] }),
      ]);

      const replyLockMap = new Map<string, { userId: string; userName: string }>();
      replyLocksResult.rows.forEach((row: any) => {
        replyLockMap.set(row.email_id, { userId: row.user_id, userName: row.user_name || 'Unbekannt' });
      });

      // Erstelle Lookup-Maps
      const fromDeptMap = new Map<string, string[]>();
      fromDeptResult.rows.forEach((row: any) => {
        const email = row.email.toLowerCase();
        if (!fromDeptMap.has(email)) {
          fromDeptMap.set(email, []);
        }
        fromDeptMap.get(email)!.push(row.department_id);
      });

      const toDeptMap = new Map<string, string[]>();
      toDeptResult.rows.forEach((row: any) => {
        const email = row.email.toLowerCase();
        if (!toDeptMap.has(email)) {
          toDeptMap.set(email, []);
        }
        toDeptMap.get(email)!.push(row.department_id);
      });

      const assignedDeptMap = new Map<string, Array<{ id: string; name: string }>>();
      assignedDeptResult.rows.forEach((row: any) => {
        if (!assignedDeptMap.has(row.email_id)) {
          assignedDeptMap.set(row.email_id, []);
        }
        assignedDeptMap.get(row.email_id)!.push({
          id: row.department_id,
          name: row.department_name,
        });
      });

      // Erweitere E-Mails mit Abteilungsinformationen
      const emailsWithDepartments = result.rows.map((row: any) => {
        // Abteilungen für Absender
        const fromDepartments = fromDeptMap.get(row.from_email?.toLowerCase() || '') || [];

        // Abteilungen für Empfänger
        const toEmails = row.to_email 
          ? (typeof row.to_email === 'string' 
              ? row.to_email.split(',').map((e: string) => e.trim())
              : Array.isArray(row.to_email) 
                ? row.to_email 
                : [])
          : [];
        const toDepartments = Array.from(new Set(
          toEmails.flatMap((email: string) => toDeptMap.get(email.toLowerCase()) || [])
        ));

        // Direkt zugewiesene Abteilungen
        const assignedDepartments = assignedDeptMap.get(row.id) || [];

        // Bestimme from-Feld basierend auf type
        let from: string | null = null;
        if (row.type === 'phone_note') {
          from = row.phone_number || null;
        } else {
          from = row.from_email || null;
        }

        const replyLock = replyLockMap.get(row.id);

        return {
          ...row,
          // Konvertiere Ticket-ID Felder von snake_case zu camelCase
          ticketId: row.ticket_id,
          isConversationThread: row.is_conversation_thread,
          conversationMessageCount: row.conversation_message_count,
          department_id: row.department_id_val || row.department_id || null,
          department: row.department_id_val ? {
            id: row.department_id_val,
            name: row.department_name,
          } : (row.department_id ? { id: row.department_id, name: 'Unbekannt' } : null),
          from_departments: fromDepartments,
          to_departments: toDepartments,
          assigned_departments: assignedDepartments,
          // Erweitere um type und phoneNumber
          type: row.type || 'email',
          phoneNumber: row.phone_number || undefined,
          // from-Feld anpassen
          from: from,
          from_email: row.from_email, // Behalte original für Abteilungs-Zuordnung
          // Reply-Lock: wird die E-Mail gerade von einem anderen User beantwortet?
          replyLock: replyLock ? { userId: replyLock.userId, userName: replyLock.userName } : undefined,
        };
      });

      return NextResponse.json({
        emails: emailsWithDepartments,
        companyId: resolvedCompanyId || tenantContext.companySlug,
        page,
        limit,
        totalPages,
        total,
        hasNext: page < totalPages - 1,
        hasPrevious: page > 0,
      });
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error('Fehler beim Laden der E-Mails:', error);

    if (error.message.includes('nicht gefunden')) {
      return NextResponse.json(
        { error: error.message },
        { status: 404 }
      );
    }

    if (error.message.includes('nicht bereit')) {
      return NextResponse.json(
        { error: error.message },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { error: 'Interner Serverfehler' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/emails
 * Erstellt eine neue E-Mail (sendet sie)
 * Erfordert: Tenant-Context (Subdomain/Header/JWT) + Auth-Token
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

    const body = await request.json();
    const { to, subject, body: emailBody, cc, bcc, departmentId, themeId, type, phoneNumber } = body;

    // Bestimme Typ (Default: 'email')
    const emailType = type || 'email';

    // Validierung basierend auf Typ
    if (emailType === 'phone_note') {
      // Telefonnotiz-Validierung
      if (!phoneNumber || !subject || !emailBody) {
        return NextResponse.json(
          { error: 'Telefonnummer, Betreff und Inhalt sind erforderlich' },
          { status: 400 }
        );
      }
      
      // Telefonnummer-Validierung
      const { validatePhoneNumber } = await import('@/utils/phone-utils');
      const phoneValidation = validatePhoneNumber(phoneNumber);
      if (!phoneValidation.isValid) {
        return NextResponse.json(
          { error: phoneValidation.error || 'Ungültige Telefonnummer' },
          { status: 400 }
        );
      }
    } else {
      // E-Mail-Validierung
      if (!to || !subject || !emailBody) {
        return NextResponse.json(
          { error: 'An, Betreff und Inhalt sind erforderlich' },
          { status: 400 }
        );
      }
    }

    // Validierung: departmentId ist Pflichtfeld
    if (!departmentId) {
      return NextResponse.json(
        { error: 'Abteilung ist erforderlich' },
        { status: 400 }
      );
    }

    // Tenant-DB-Client holen (getTenantDbClientBySlug nutzt Cache, vermeidet doppelten SCC-Call)
    let client;
    let resolvedCompanyId: string;
    if (companyId) {
      client = await getTenantDbClient(companyId);
      resolvedCompanyId = companyId;
    } else if (companySlug) {
      const { getTenantDbClientBySlug } = await import('@/lib/tenant-db-client');
      client = await getTenantDbClientBySlug(companySlug);
      const { getCompanyIdBySlug } = await import('@/lib/scc-client');
      const id = await getCompanyIdBySlug(companySlug);
      if (!id) {
        return NextResponse.json(
          { error: 'Company-ID konnte nicht aufgelöst werden' },
          { status: 400 }
        );
      }
      resolvedCompanyId = id;
    } else {
      return NextResponse.json(
        { error: 'Company-ID oder Slug erforderlich' },
        { status: 400 }
      );
    }

    try {
      // Lade Company-Config für themeRequired-Validierung
      const companyConfig = await getCompanyConfig(client);
      
      // Validierung: themeRequired prüfen
      if (companyConfig.themeRequired === true && (!themeId || (typeof themeId === 'string' && themeId.trim() === ''))) {
        return NextResponse.json(
          { error: 'Bitte wählen Sie ein Thema aus' },
          { status: 400 }
        );
      }
      
      // Absender-E-Mail aus User-Daten holen
      const userResult = await client.query(
        `SELECT email, username, role FROM users WHERE id = $1`,
        [payload.sub]
      );

      if (userResult.rows.length === 0) {
        return NextResponse.json(
          { error: 'User nicht gefunden' },
          { status: 404 }
        );
      }

      const user = userResult.rows[0];
      const userRole = user.role;
      // Bei Telefonnotizen: fromEmail = NULL, bei E-Mails: aus User-Daten holen
      const fromEmail = emailType === 'phone_note' ? null : (user.email || `${user.username}@localhost`);

      // Validierung: Abteilung prüfen (Race Condition: direkt vor Versand prüfen) – name für POST-Response
      const departmentCheck = await client.query(
        `SELECT d.id, d.name, d.is_active, d.email_account_id, d.company_id
         FROM departments d
         WHERE d.id = $1 AND d.company_id = $2`,
        [departmentId, resolvedCompanyId]
      );

      if (departmentCheck.rows.length === 0) {
        return NextResponse.json(
          { error: 'Abteilung nicht gefunden' },
          { status: 404 }
        );
      }

      const department = departmentCheck.rows[0];

      // Race Condition: Prüfe, ob Abteilung noch aktiv ist
      if (!department.is_active) {
        return NextResponse.json(
          { error: 'Die Abteilung wurde zwischenzeitlich deaktiviert' },
          { status: 400 }
        );
      }

      // Validierung: User-Berechtigung prüfen (User muss der Abteilung zugewiesen sein ODER Admin sein)
      if (userRole !== 'admin') {
        const userDepartmentCheck = await client.query(
          `SELECT 1 FROM user_departments WHERE user_id = $1 AND department_id = $2`,
          [payload.sub, departmentId]
        );

        if (userDepartmentCheck.rows.length === 0) {
          return NextResponse.json(
            { error: `Sie sind nicht berechtigt, ${emailType === 'phone_note' ? 'Telefonnotizen' : 'E-Mails'} aus dieser Abteilung zu ${emailType === 'phone_note' ? 'erstellen' : 'senden'}` },
            { status: 403 }
          );
        }
      }

      // E-Mail-Konto-Validierung nur bei E-Mails (Telefonnotizen benötigen kein E-Mail-Konto)
      let account: any = null;
      if (emailType !== 'phone_note') {
        // Validierung: E-Mail-Konto der Abteilung prüfen
        if (!department.email_account_id) {
          return NextResponse.json(
            { error: 'Die Abteilung hat kein E-Mail-Konto zugewiesen. Bitte konfigurieren Sie die Abteilung.' },
            { status: 400 }
          );
        }

        // E-Mail-Konto der Abteilung laden
        const smtpAccountResult = await client.query(
          `SELECT id, email, smtp_host, smtp_port, smtp_username, smtp_password, smtp_ssl, smtp_tls, is_active
           FROM email_accounts
           WHERE id = $1`,
          [department.email_account_id]
        );

        if (smtpAccountResult.rows.length === 0) {
          return NextResponse.json(
            { error: 'E-Mail-Konto der Abteilung nicht gefunden. Bitte konfigurieren Sie die Abteilung neu.' },
            { status: 404 }
          );
        }

        account = smtpAccountResult.rows[0];

        // Validierung: E-Mail-Konto muss aktiv sein
        if (!account.is_active) {
          return NextResponse.json(
            { error: 'E-Mail-Konto der Abteilung ist inaktiv. Bitte aktivieren Sie das E-Mail-Konto.' },
            { status: 400 }
          );
        }

        // Validierung: E-Mail-Konto muss SMTP-Daten haben
        if (!account.smtp_host || !account.smtp_username || !account.smtp_password) {
          return NextResponse.json(
            { error: 'E-Mail-Konto der Abteilung hat keine SMTP-Daten. Bitte konfigurieren Sie das E-Mail-Konto.' },
            { status: 400 }
          );
        }
      }

      // CC/BCC Werte vorbereiten (bei Telefonnotizen: NULL)
      const toValue = emailType === 'phone_note' ? null : (Array.isArray(to) ? to.join(', ') : to);
      const ccValue = emailType === 'phone_note' ? null : (cc && Array.isArray(cc) && cc.length > 0 
        ? cc.join(', ') 
        : (cc && typeof cc === 'string' && cc.trim() ? cc.trim() : null));
      const bccValue = emailType === 'phone_note' ? null : (bcc && Array.isArray(bcc) && bcc.length > 0 
        ? bcc.join(', ') 
        : (bcc && typeof bcc === 'string' && bcc.trim() ? bcc.trim() : null));

      // ============================================
      // TICKET-ID GENERIERUNG/WIEDERVERWENDUNG
      // ============================================
      let ticketId: string;
      let isTicketIdReused = false;
      
      try {
        // Starte Transaktion für Ticket-ID-Generierung
        await client.query('BEGIN');
        
        // Prüfe, ob Betreff bereits eine Ticket-ID enthält (z.B. bei Antworten)
        const extractedTicketId = extractTicketIdFromSubject(subject);
        
        if (extractedTicketId) {
          // Ticket-ID aus Betreff wiederverwenden
          ticketId = extractedTicketId;
          isTicketIdReused = true;
          console.log(`🔄 Ticket-ID aus Betreff wiederverwendet: ${ticketId}`);
        } else {
          // Generiere neue Ticket-ID
          ticketId = await generateTicketId(client, resolvedCompanyId!);
          isTicketIdReused = false;
          console.log(`✅ Neue Ticket-ID generiert: ${ticketId}`);
        }
      } catch (ticketError: any) {
        console.error(`❌ Fehler bei Ticket-ID-Verarbeitung:`, ticketError);
        await client.query('ROLLBACK');
        return NextResponse.json(
          { error: 'Fehler bei Ticket-ID-Verarbeitung' },
          { status: 500 }
        );
      }

      // E-Mail/Telefonnotiz speichern (mit department_id, company_id, ticket_id, theme_id, type, phone_number)
      const result = await client.query(
        `INSERT INTO emails (user_id, from_email, to_email, cc_email, bcc_email, subject, body, department_id, company_id, ticket_id, theme_id, type, phone_number, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())
         RETURNING id, subject, from_email, to_email, cc_email, bcc_email, body, department_id, ticket_id, theme_id, type, phone_number, created_at`,
        [payload.sub, fromEmail, toValue, ccValue, bccValue, subject, emailBody, departmentId, resolvedCompanyId, ticketId, themeId || null, emailType, emailType === 'phone_note' ? phoneNumber : null]
      );

      const email = result.rows[0];

      // Sende-Abteilung auch in email_departments eintragen, damit GET /api/emails/[id]/departments und Toolbar „Abteilung“ sie anzeigen
      await client.query(
        `INSERT INTO email_departments (email_id, department_id) VALUES ($1, $2) ON CONFLICT (email_id, department_id) DO NOTHING`,
        [email.id, departmentId]
      );

      // Commit Transaktion
      await client.query('COMMIT');
      console.log(`✅ ${emailType === 'phone_note' ? 'Telefonnotiz' : 'E-Mail'} mit Ticket-ID ${ticketId} erfolgreich gespeichert`);
      
      // Timeline-Event für Ticket-Zuweisung/Wiederverwendung protokollieren (asynchron)
      if (resolvedCompanyId && email.id) {
        const companyIdForEvent = resolvedCompanyId;
        const emailIdForEvent = email.id;
        import('@/lib/email-events').then(({ logEmailEvent }) => {
          const eventType = isTicketIdReused ? 'ticket_reused' : 'ticket_assigned';
          logEmailEvent(companyIdForEvent, emailIdForEvent, payload.sub, eventType, {
            ticketId,
            assignedAt: new Date().toISOString(),
            context: emailType === 'phone_note' ? 'phone_note_creation' : 'email_creation',
            reused: isTicketIdReused,
            type: emailType,
            phoneNumber: emailType === 'phone_note' ? phoneNumber : undefined,
          }).catch((err) => {
            console.error('Fehler beim Protokollieren des Ticket-Events:', err);
          });
        });
      }

      // SMTP-Versand durchführen mit Abteilungs-E-Mail-Konto (nur bei E-Mails, nicht bei Telefonnotizen)
      let smtpSendSuccess = false;
      let smtpSendError: string | null = null;
      
      // E-Mail-Konto wurde bereits oben geladen und validiert (nur bei E-Mails)
      if (emailType !== 'phone_note' && account && account.smtp_host && account.smtp_username && account.smtp_password) {
        try {
            // Erstelle SMTP-Transporter
            const transporter = nodemailer.createTransport({
              host: account.smtp_host,
              port: account.smtp_port || 587,
              secure: account.smtp_ssl === true,
              auth: {
                user: account.smtp_username,
                pass: account.smtp_password,
              },
              tls: {
                rejectUnauthorized: false,
              },
              requireTLS: account.smtp_tls === true && account.smtp_ssl !== true,
            });

            // E-Mail senden
            // Verwende die E-Mail-Adresse aus dem SMTP-Konto als Absender (nicht admin@localhost)
            const senderEmail = account.email || account.smtp_username || fromEmail;
            
            // Empfänger-Adressen normalisieren
            let toAddresses: string | string[];
            if (Array.isArray(to)) {
              // Wenn Array, extrahiere E-Mail-Adressen aus formatierter Form
              toAddresses = to.map(addr => {
                // Entferne Anführungszeichen und extrahiere E-Mail-Adresse
                const emailMatch = addr.match(/<([^>]+)>/) || addr.match(/([^\s<>]+@[^\s<>]+)/);
                return emailMatch ? emailMatch[1] : addr.trim();
              });
            } else {
              // Wenn String, extrahiere E-Mail-Adresse
              const emailMatch = to.match(/<([^>]+)>/) || to.match(/([^\s<>]+@[^\s<>]+)/);
              toAddresses = emailMatch ? emailMatch[1] : to.trim();
            }
            
            // HTML-Versand: Wenn Body HTML enthält, als html senden und Plain-Text-Fallback setzen
            const sendAsHtml = looksLikeHtml(emailBody);
            const mailOptions: any = {
              from: senderEmail,
              to: toAddresses,
              subject: subject,
              text: sendAsHtml ? stripHtml(emailBody) || emailBody : emailBody,
              ...(sendAsHtml ? { html: emailBody } : {}),
              // Wichtige Header für bessere Zustellbarkeit
              date: new Date(),
              messageId: `<${Date.now()}-${Math.random().toString(36).substring(7)}@${senderEmail.split('@')[1] || 'localhost'}>`,
              // User-Agent für bessere Kompatibilität
              headers: {
                'X-Mailer': 'SeivaroMail v2',
                'X-Priority': '3',
                'Importance': 'normal',
              },
            };

            // Wenn User-E-Mail sich von Sender-E-Mail unterscheidet, als Reply-To setzen
            if (fromEmail && fromEmail !== senderEmail && !fromEmail.includes('@localhost')) {
              mailOptions.replyTo = fromEmail;
            }

            // CC hinzufügen, falls vorhanden
            if (ccValue) {
              // Extrahiere E-Mail-Adressen aus CC
              const ccAddresses = ccValue.split(',').map(addr => {
                const emailMatch = addr.match(/<([^>]+)>/) || addr.match(/([^\s<>]+@[^\s<>]+)/);
                return emailMatch ? emailMatch[1] : addr.trim();
              });
              mailOptions.cc = ccAddresses;
            }

            // BCC hinzufügen, falls vorhanden
            if (bccValue) {
              // Extrahiere E-Mail-Adressen aus BCC
              const bccAddresses = bccValue.split(',').map(addr => {
                const emailMatch = addr.match(/<([^>]+)>/) || addr.match(/([^\s<>]+@[^\s<>]+)/);
                return emailMatch ? emailMatch[1] : addr.trim();
              });
              mailOptions.bcc = bccAddresses;
            }

            await transporter.sendMail(mailOptions);
            smtpSendSuccess = true;
          } catch (smtpError: any) {
            smtpSendError = smtpError.message || 'Unbekannter SMTP-Fehler';
            console.error('[EmailAPI] Fehler beim SMTP-Versand:', smtpError);
            // E-Mail bleibt in DB gespeichert, auch wenn Versand fehlschlägt
          }
      }

      // Automatisierungsregeln für ausgehende E-Mails auslösen (asynchron, nicht blockierend)
      if (resolvedCompanyId && email && email.id && payload.sub) {
        const companyIdForRules = resolvedCompanyId;
        const emailForRules = email;
        const userIdForRules = payload.sub;
        // Dynamischer Import für Automation-Engine (asynchron, nicht blockierend)
        import('@/lib/automation-engine')
          .then(({ executeRulesForEmail }) => {
            return executeRulesForEmail(
              companyIdForRules,
              {
                id: emailForRules.id,
                userId: userIdForRules,
                subject: emailForRules.subject || '',
                fromEmail: emailType === 'phone_note' ? null : (emailForRules.from_email || ''),
                toEmail: emailType === 'phone_note' ? null : (emailForRules.to_email || ''),
                phoneNumber: emailType === 'phone_note' ? phoneNumber : undefined,
                type: emailType,
                body: emailForRules.body || '',
                createdAt: emailForRules.created_at || new Date(),
                read: false,
                completed: false,
                hasAttachment: !!(emailForRules as any).has_attachment,
              },
              'outgoing'
            );
          })
          .catch((err) => {
            console.error('[EmailAPI] Fehler beim Ausführen der Automatisierungsregeln für ausgehende E-Mail:', err);
          });
      } else {
        if (!resolvedCompanyId) {
          console.warn('[EmailAPI] resolvedCompanyId nicht gesetzt, Automatisierungsregeln werden nicht ausgeführt');
        }
        if (!email || !email.id || !payload.sub) {
          console.warn('[EmailAPI] E-Mail-Daten oder User-ID unvollständig, Automatisierungsregeln werden nicht ausgeführt', {
            hasEmail: !!email,
            hasEmailId: !!(email && email.id),
            hasUserId: !!payload.sub,
          });
        }
      }

      // Wenn SMTP-Versand fehlgeschlagen ist, aber E-Mail in DB gespeichert wurde, warnen
      if (!smtpSendSuccess && smtpSendError) {
        console.warn('[EmailAPI] E-Mail wurde in DB gespeichert, aber SMTP-Versand fehlgeschlagen:', smtpSendError);
      }

      const responseEmail = {
        id: email.id,
        ticketId: email.ticket_id,
        subject: email.subject,
        from: emailType === 'phone_note' ? (email.phone_number || null) : (email.from_email || null),
        to: email.to_email ? (Array.isArray(email.to_email) ? email.to_email : [email.to_email]) : [],
        cc: email.cc_email 
          ? (Array.isArray(email.cc_email) 
              ? email.cc_email 
              : typeof email.cc_email === 'string' 
                ? email.cc_email.split(',').map((e: string) => e.trim()).filter(Boolean)
                : [email.cc_email])
          : [],
        bcc: email.bcc_email 
          ? (Array.isArray(email.bcc_email) 
              ? email.bcc_email 
              : typeof email.bcc_email === 'string' 
                ? email.bcc_email.split(',').map((e: string) => e.trim()).filter(Boolean)
                : [email.bcc_email])
          : [],
        body: email.body,
        date: email.created_at,
        read: false,
        type: emailType,
        phoneNumber: emailType === 'phone_note' ? phoneNumber : undefined,
        departmentId: email.department_id ?? null,
        department: department?.id && department?.name ? { id: department.id, name: department.name } : null,
        themeId: email.theme_id ?? null,
      };
      return NextResponse.json({
        email: responseEmail,
        message: emailType === 'phone_note' ? 'Telefonnotiz erfolgreich erstellt' : 'E-Mail erfolgreich gesendet',
      }, { status: 201 });
    } catch (error: any) {
      console.error('Fehler beim Senden der E-Mail:', error);
      return NextResponse.json(
        { error: 'Interner Serverfehler' },
        { status: 500 }
      );
    } finally {
      if (client) {
        client.release();
      }
    }
  } catch (error: any) {
    console.error('Fehler beim Senden der E-Mail (äußerer Catch):', error);
    return NextResponse.json(
      { error: 'Interner Serverfehler' },
      { status: 500 }
    );
  }
}
