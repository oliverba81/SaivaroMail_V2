import { NextRequest, NextResponse } from 'next/server';
import { getTenantDbClient, getTenantDbClientBySlug } from '@/lib/tenant-db-client';
import { getCompanyDbConfigBySlug } from '@/lib/scc-client';
import { BUSINESS_DEPARTMENTS, PRIVATE_DEPARTMENTS } from '@/lib/department-constants';
import * as jwt from 'jsonwebtoken';

/**
 * POST /api/departments/default
 * Erstellt Standard-Abteilungen (nur für Admins)
 * Query-Parameter: type=business (Standard) oder type=private
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
          { error: 'Nur Administratoren können Standard-Abteilungen erstellen' },
          { status: 403 }
        );
      }

      // Bestimme Typ der Abteilungen aus Query-Parameter
      const type = request.nextUrl.searchParams.get('type') || 'business';
      const defaultDepartments = type === 'private' ? PRIVATE_DEPARTMENTS : BUSINESS_DEPARTMENTS;

      const createdDepartments: any[] = [];
      const skippedDepartments: string[] = [];

      // Erstelle Standard-Abteilungen
      for (const dept of defaultDepartments) {
        try {
          // Prüfe, ob Abteilung bereits existiert
          const existingCheck = await client.query(
            'SELECT id FROM departments WHERE company_id = $1 AND name = $2',
            [resolvedCompanyId || companySlug, dept.name]
          );

          if (existingCheck.rows.length > 0) {
            skippedDepartments.push(dept.name);
            continue;
          }

          // Abteilung erstellen
          const result = await client.query(
            `INSERT INTO departments (company_id, name, description, created_at, updated_at)
             VALUES ($1, $2, $3, NOW(), NOW())
             RETURNING id, name, description, manager_id, created_at, updated_at`,
            [resolvedCompanyId || companySlug, dept.name, dept.description]
          );

          const newDept = result.rows[0];
          createdDepartments.push({
            id: newDept.id,
            name: newDept.name,
            description: newDept.description,
            managerId: newDept.manager_id,
            manager: null,
            createdAt: newDept.created_at,
            updatedAt: newDept.updated_at,
          });
        } catch (error: any) {
          if (error.code === '23505') {
            // Duplikat-Fehler
            skippedDepartments.push(dept.name);
          } else {
            console.error(`Fehler beim Erstellen der Abteilung "${dept.name}":`, error);
          }
        }
      }

      return NextResponse.json({
        created: createdDepartments.length,
        skipped: skippedDepartments.length,
        createdDepartments,
        skippedDepartments,
        message: `${createdDepartments.length} Standard-Abteilung(en) erstellt, ${skippedDepartments.length} bereits vorhanden`,
      });
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error('Fehler beim Erstellen der Standard-Abteilungen:', error);
    return NextResponse.json(
      { error: 'Fehler beim Erstellen der Standard-Abteilungen' },
      { status: 500 }
    );
  }
}



