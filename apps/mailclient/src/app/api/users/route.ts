import { NextRequest, NextResponse } from 'next/server';
import { getTenantDbClient, getTenantDbClientBySlug } from '@/lib/tenant-db-client';
import { getCompanyDbConfigBySlug } from '@/lib/scc-client';
import bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';

/**
 * GET /api/users
 * Liste aller Benutzer (nur für Admins)
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

    // Prüfe, ob User Admin ist
    let client;
    try {
      client = resolvedCompanyId 
        ? await getTenantDbClient(resolvedCompanyId)
        : await getTenantDbClientBySlug(companySlug!);
      
      const userResult = await client.query(
        'SELECT role FROM users WHERE id = $1',
        [payload.sub]
      );

      if (userResult.rows.length === 0) {
        if (client) client.release();
        return NextResponse.json(
          { error: 'User nicht gefunden' },
          { status: 404 }
        );
      }

      const userRole = userResult.rows[0].role;
      if (userRole !== 'admin') {
        if (client) client.release();
        return NextResponse.json(
          { error: 'Nur Administratoren können Benutzer verwalten' },
          { status: 403 }
        );
      }

      // Lade alle Benutzer mit ihren Abteilungen (visible_filter_ids falls Spalte existiert)
      let result: any;
      try {
        result = await client.query(`
          SELECT 
            u.id,
            u.username,
            u.email,
            u.first_name,
            u.last_name,
            u.role,
            u.status,
            u.last_login_at,
            u.created_at,
            u.updated_at,
            u.visible_filter_ids,
            COALESCE(
              json_agg(
                json_build_object(
                  'id', d.id,
                  'name', d.name,
                  'description', d.description
                ) ORDER BY d.name
              ) FILTER (WHERE d.id IS NOT NULL),
              '[]'::json
            ) as departments
          FROM users u
          LEFT JOIN user_departments ud ON u.id = ud.user_id
          LEFT JOIN departments d ON ud.department_id = d.id
          GROUP BY u.id, u.username, u.email, u.first_name, u.last_name, 
                   u.role, u.status, u.last_login_at, u.created_at, u.updated_at, u.visible_filter_ids
          ORDER BY u.created_at DESC
        `);
      } catch (e: any) {
        if (e.message && e.message.includes('visible_filter_ids')) {
          result = await client.query(`
            SELECT 
              u.id,
              u.username,
              u.email,
              u.first_name,
              u.last_name,
              u.role,
              u.status,
              u.last_login_at,
              u.created_at,
              u.updated_at,
              COALESCE(
                json_agg(
                  json_build_object(
                    'id', d.id,
                    'name', d.name,
                    'description', d.description
                  ) ORDER BY d.name
                ) FILTER (WHERE d.id IS NOT NULL),
                '[]'::json
              ) as departments
            FROM users u
            LEFT JOIN user_departments ud ON u.id = ud.user_id
            LEFT JOIN departments d ON ud.department_id = d.id
            GROUP BY u.id, u.username, u.email, u.first_name, u.last_name, 
                     u.role, u.status, u.last_login_at, u.created_at, u.updated_at
            ORDER BY u.created_at DESC
          `);
        } else {
          throw e;
        }
      }

      // Transformiere Ergebnis
      const usersWithDepartments = result.rows.map((row: any) => {
        const visibleFilterIds = row.visible_filter_ids != null
          ? (Array.isArray(row.visible_filter_ids) ? row.visible_filter_ids : [])
          : undefined;
        return {
          id: row.id,
          username: row.username,
          email: row.email,
          firstName: row.first_name,
          lastName: row.last_name,
          role: row.role,
          status: row.status,
          lastLoginAt: row.last_login_at,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          visibleFilterIds,
          departments: Array.isArray(row.departments) 
            ? row.departments 
            : (row.departments ? JSON.parse(row.departments) : []),
        };
      });

      if (client) client.release();
      
      return NextResponse.json({
        users: usersWithDepartments,
      });
    } catch (dbError: any) {
      if (client) client.release();
      throw dbError;
    }
  } catch (error: any) {
    console.error('Fehler beim Laden der Benutzer:', error);
    return NextResponse.json(
      { 
        error: 'Fehler beim Laden der Benutzer',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/users
 * Neuen Benutzer erstellen (nur für Admins)
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
    
    if (!resolvedCompanyId) {
      return NextResponse.json(
        { error: 'CompanyId konnte nicht aufgelöst werden' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { username, email, password, firstName, lastName, role, status, departmentIds, visibleFilterIds } = body;
    
    console.log('POST /api/users - departmentIds:', departmentIds, 'resolvedCompanyId:', resolvedCompanyId);

    // Validierung
    if (!username || !email || !password) {
      return NextResponse.json(
        { error: 'Benutzername, E-Mail und Passwort sind erforderlich' },
        { status: 400 }
      );
    }

    // Prüfe, ob User Admin ist
    const client = await getTenantDbClient(resolvedCompanyId);
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
          { error: 'Nur Administratoren können Benutzer erstellen' },
          { status: 403 }
        );
      }

      // Prüfe, ob Username oder E-Mail bereits existiert
      const existingUser = await client.query(
        'SELECT id FROM users WHERE username = $1 OR email = $2',
        [username, email]
      );

      if (existingUser.rows.length > 0) {
        return NextResponse.json(
          { error: 'Benutzername oder E-Mail existiert bereits' },
          { status: 400 }
        );
      }

      // Passwort hashen
      const passwordHash = await bcrypt.hash(password, 10);

      const visibleFilterIdsJson = JSON.stringify(Array.isArray(visibleFilterIds) ? visibleFilterIds : []);
      let result: any;
      try {
        result = await client.query(
          `INSERT INTO users (company_id, username, email, password_hash, first_name, last_name, role, status, visible_filter_ids)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
           RETURNING id, username, email, first_name, last_name, role, status, created_at`,
          [
            resolvedCompanyId || companySlug,
            username,
            email,
            passwordHash,
            firstName || '',
            lastName || '',
            role || 'user',
            status || 'active',
            visibleFilterIdsJson,
          ]
        );
      } catch (e: any) {
        if (e.message && e.message.includes('visible_filter_ids')) {
          result = await client.query(
            `INSERT INTO users (company_id, username, email, password_hash, first_name, last_name, role, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             RETURNING id, username, email, first_name, last_name, role, status, created_at`,
            [
              resolvedCompanyId || companySlug,
              username,
              email,
              passwordHash,
              firstName || '',
              lastName || '',
              role || 'user',
              status || 'active',
            ]
          );
        } else {
          throw e;
        }
      }

      const newUser = result.rows[0];

      // Abteilungen zuweisen, falls angegeben
      if (departmentIds && Array.isArray(departmentIds) && departmentIds.length > 0) {
        // Verwende immer resolvedCompanyId, da company_id ein UUID ist
        const companyIdForCheck = resolvedCompanyId;
        if (!companyIdForCheck) {
          console.error('CompanyId konnte nicht aufgelöst werden');
        } else {
          for (const deptId of departmentIds) {
            // Prüfe, ob Abteilung existiert und zur gleichen Company gehört
            const deptCheck = await client.query(
              'SELECT id FROM departments WHERE id = $1 AND company_id = $2',
              [deptId, companyIdForCheck]
            );

            if (deptCheck.rows.length > 0) {
              try {
                await client.query(
                  'INSERT INTO user_departments (user_id, department_id) VALUES ($1, $2)',
                  [newUser.id, deptId]
                );
              } catch (error: any) {
                // Ignoriere Duplikat-Fehler
                if (error.code !== '23505') {
                  console.error(`Fehler beim Zuweisen der Abteilung ${deptId}:`, error);
                }
              }
            } else {
              console.warn(`Abteilung ${deptId} nicht gefunden oder gehört nicht zur Company ${companyIdForCheck}`);
            }
          }
        }
      }

      // Lade Abteilungen für den neuen Benutzer
      const deptResult = await client.query(
        `SELECT d.id, d.name, d.description
         FROM user_departments ud
         JOIN departments d ON ud.department_id = d.id
         WHERE ud.user_id = $1
         ORDER BY d.name`,
        [newUser.id]
      );

      return NextResponse.json(
        {
          user: {
            id: newUser.id,
            username: newUser.username,
            email: newUser.email,
            firstName: newUser.first_name,
            lastName: newUser.last_name,
            role: newUser.role,
            status: newUser.status,
            createdAt: newUser.created_at,
            departments: deptResult.rows.map((d: any) => ({
              id: d.id,
              name: d.name,
              description: d.description,
            })),
          },
          message: 'Benutzer erfolgreich erstellt',
        },
        { status: 201 }
      );
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error('Fehler beim Erstellen des Benutzers:', error);
    if (error.code === '23505') {
      // Unique constraint violation
      return NextResponse.json(
        { error: 'Benutzername oder E-Mail existiert bereits' },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { 
        error: 'Fehler beim Erstellen des Benutzers',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      },
      { status: 500 }
    );
  }
}

