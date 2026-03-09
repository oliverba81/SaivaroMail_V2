import { NextRequest, NextResponse } from 'next/server';
import { getTenantDbClient, getTenantDbClientBySlug } from '@/lib/tenant-db-client';
import { getCompanyDbConfigBySlug } from '@/lib/scc-client';
import { extractTokenFromHeader, verifyToken } from '@/lib/auth';

function isEmptyEditorHtml(html: string | null | undefined): boolean {
  if (!html || !html.trim()) return true;
  const stripped = html.replace(/<[^>]*>/g, '').trim();
  return stripped.length === 0;
}

/**
 * PATCH /api/departments/[id]
 * Abteilung aktualisieren (nur für Admins)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: departmentId } = await params;
  if (!departmentId) {
    return NextResponse.json({ error: 'Abteilungs-ID erforderlich' }, { status: 400 });
  }

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
    if (headerCompanyId) companyId = headerCompanyId;
    else if (headerCompanySlug) companySlug = headerCompanySlug;

    const authHeader = request.headers.get('authorization');
    const token = extractTokenFromHeader(authHeader);
    if (!token) {
      return NextResponse.json({ error: 'Authorization-Token erforderlich' }, { status: 401 });
    }

    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Ungültiger Token' }, { status: 401 });
    }

    if (!companyId && payload.companyId) companyId = payload.companyId;
    if (!companyId && !companySlug) {
      return NextResponse.json(
        { error: 'Tenant-Context nicht gesetzt. Request muss companyId oder companySlug enthalten.' },
        { status: 400 }
      );
    }

    let resolvedCompanyId = companyId;
    if (!resolvedCompanyId && companySlug) {
      const dbConfig = await getCompanyDbConfigBySlug(companySlug);
      if (dbConfig) resolvedCompanyId = dbConfig.companyId;
    }

    const client = resolvedCompanyId
      ? await getTenantDbClient(resolvedCompanyId)
      : await getTenantDbClientBySlug(companySlug!);

    try {
      const userResult = await client.query(
        'SELECT role FROM users WHERE id = $1',
        [payload.sub]
      );
      if (userResult.rows.length === 0) {
        return NextResponse.json({ error: 'User nicht gefunden' }, { status: 404 });
      }
      const userRole = userResult.rows[0].role;
      if (userRole !== 'admin') {
        return NextResponse.json(
          { error: 'Nur Administratoren können Abteilungen bearbeiten' },
          { status: 403 }
        );
      }

      const existingDept = await client.query(
        'SELECT id, name FROM departments WHERE id = $1 AND company_id = $2',
        [departmentId, resolvedCompanyId || companySlug]
      );
      if (existingDept.rows.length === 0) {
        return NextResponse.json({ error: 'Abteilung nicht gefunden' }, { status: 404 });
      }

      const body = await request.json();
      const {
        name,
        description,
        managerId,
        emailAccountId,
        isActive,
        signature,
        signaturePlain,
        signatureEnabled,
      } = body;

      if (name !== undefined && (!name || !String(name).trim())) {
        return NextResponse.json(
          { error: 'Name der Abteilung ist erforderlich' },
          { status: 400 }
        );
      }

      if (isActive === true && emailAccountId === undefined) {
        const current = await client.query(
          'SELECT email_account_id FROM departments WHERE id = $1',
          [departmentId]
        );
        if (!current.rows[0]?.email_account_id) {
          return NextResponse.json(
            { error: 'Abteilung kann nicht aktiviert werden: Kein E-Mail-Konto zugewiesen' },
            { status: 400 }
          );
        }
      }
      if (isActive === true && emailAccountId === null) {
        return NextResponse.json(
          { error: 'Abteilung kann nicht aktiviert werden: Kein E-Mail-Konto zugewiesen' },
          { status: 400 }
        );
      }

      if (name && name.trim() && name.trim() !== existingDept.rows[0].name) {
        const dupCheck = await client.query(
          'SELECT id FROM departments WHERE company_id = $1 AND name = $2 AND id != $3',
          [resolvedCompanyId || companySlug, name.trim(), departmentId]
        );
        if (dupCheck.rows.length > 0) {
          return NextResponse.json(
            { error: 'Eine Abteilung mit diesem Namen existiert bereits' },
            { status: 400 }
          );
        }
      }

      if (managerId !== undefined && managerId) {
        const managerCheck = await client.query(
          'SELECT id FROM users WHERE id = $1 AND company_id = $2',
          [managerId, resolvedCompanyId || companySlug]
        );
        if (managerCheck.rows.length === 0) {
          return NextResponse.json({ error: 'Manager nicht gefunden' }, { status: 404 });
        }
      }

      if (emailAccountId !== undefined && emailAccountId) {
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
        if (!account.is_active) {
          return NextResponse.json(
            { error: 'E-Mail-Konto ist inaktiv und kann nicht verwendet werden' },
            { status: 400 }
          );
        }
        if (!account.smtp_host || !account.smtp_username || !account.smtp_password) {
          return NextResponse.json(
            { error: 'E-Mail-Konto hat keine SMTP-Daten und kann nicht für Abteilungen verwendet werden' },
            { status: 400 }
          );
        }
        const existingDeptCheck = await client.query(
          `SELECT id, name FROM departments WHERE email_account_id = $1 AND company_id = $2 AND id != $3`,
          [emailAccountId, resolvedCompanyId || companySlug, departmentId]
        );
        if (existingDeptCheck.rows.length > 0) {
          return NextResponse.json(
            { error: `Dieses E-Mail-Konto ist bereits der Abteilung "${existingDeptCheck.rows[0].name}" zugeordnet.` },
            { status: 400 }
          );
        }
      }

      const updates: string[] = [];
      const values: any[] = [];
      let idx = 1;

      if (name !== undefined) {
        updates.push(`name = $${idx++}`);
        values.push(name.trim());
      }
      if (description !== undefined) {
        updates.push(`description = $${idx++}`);
        values.push(description?.trim() || null);
      }
      if (managerId !== undefined) {
        updates.push(`manager_id = $${idx++}`);
        values.push(managerId || null);
      }
      if (emailAccountId !== undefined) {
        updates.push(`email_account_id = $${idx++}`);
        values.push(emailAccountId || null);
      }
      if (isActive !== undefined) {
        updates.push(`is_active = $${idx++}`);
        values.push(isActive === true);
      }
      if (signature !== undefined) {
        updates.push(`signature = $${idx++}`);
        values.push(isEmptyEditorHtml(signature) ? null : (signature?.trim() || null));
      }
      if (signaturePlain !== undefined) {
        updates.push(`signature_plain = $${idx++}`);
        values.push(signaturePlain?.trim() || null);
      }
      if (signatureEnabled !== undefined) {
        updates.push(`signature_enabled = $${idx++}`);
        values.push(signatureEnabled === true);
      }

      if (updates.length === 0) {
        return NextResponse.json(
          { error: 'Keine gültigen Felder zum Aktualisieren' },
          { status: 400 }
        );
      }

      updates.push(`updated_at = NOW()`);

      const result = await client.query(
        `UPDATE departments
         SET ${updates.join(', ')}
         WHERE id = $${idx} AND company_id = $${idx + 1}
         RETURNING id, name, description, manager_id, email_account_id, is_active,
                   signature, signature_plain, signature_enabled, created_at, updated_at`,
        [...values, departmentId, resolvedCompanyId || companySlug]
      );

      if (result.rows.length === 0) {
        return NextResponse.json({ error: 'Abteilung nicht gefunden' }, { status: 404 });
      }

      const row = result.rows[0];
      return NextResponse.json({
        department: {
          id: row.id,
          name: row.name,
          description: row.description,
          managerId: row.manager_id,
          emailAccountId: row.email_account_id,
          isActive: row.is_active || false,
          signature: row.signature ?? null,
          signaturePlain: row.signature_plain ?? null,
          signatureEnabled: row.signature_enabled ?? false,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        },
        message: 'Abteilung erfolgreich aktualisiert',
      });
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error('Fehler beim Aktualisieren der Abteilung:', error);
    return NextResponse.json(
      { error: 'Fehler beim Aktualisieren der Abteilung' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/departments/[id]
 * Abteilung löschen (nur für Admins)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: departmentId } = await params;
  if (!departmentId) {
    return NextResponse.json({ error: 'Abteilungs-ID erforderlich' }, { status: 400 });
  }

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
    if (headerCompanyId) companyId = headerCompanyId;
    else if (headerCompanySlug) companySlug = headerCompanySlug;

    const authHeader = request.headers.get('authorization');
    const token = extractTokenFromHeader(authHeader);
    if (!token) {
      return NextResponse.json({ error: 'Authorization-Token erforderlich' }, { status: 401 });
    }

    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Ungültiger Token' }, { status: 401 });
    }

    if (!companyId && payload.companyId) companyId = payload.companyId;
    if (!companyId && !companySlug) {
      return NextResponse.json(
        { error: 'Tenant-Context nicht gesetzt. Request muss companyId oder companySlug enthalten.' },
        { status: 400 }
      );
    }

    let resolvedCompanyId = companyId;
    if (!resolvedCompanyId && companySlug) {
      const dbConfig = await getCompanyDbConfigBySlug(companySlug);
      if (dbConfig) resolvedCompanyId = dbConfig.companyId;
    }

    const client = resolvedCompanyId
      ? await getTenantDbClient(resolvedCompanyId)
      : await getTenantDbClientBySlug(companySlug!);

    try {
      const userResult = await client.query(
        'SELECT role FROM users WHERE id = $1',
        [payload.sub]
      );
      if (userResult.rows.length === 0) {
        return NextResponse.json({ error: 'User nicht gefunden' }, { status: 404 });
      }
      const userRole = userResult.rows[0].role;
      if (userRole !== 'admin') {
        return NextResponse.json(
          { error: 'Nur Administratoren können Abteilungen löschen' },
          { status: 403 }
        );
      }

      const checkDept = await client.query(
        'SELECT id FROM departments WHERE id = $1 AND company_id = $2',
        [departmentId, resolvedCompanyId || companySlug]
      );
      if (checkDept.rows.length === 0) {
        return NextResponse.json({ error: 'Abteilung nicht gefunden' }, { status: 404 });
      }

      await client.query('DELETE FROM departments WHERE id = $1 AND company_id = $2', [
        departmentId,
        resolvedCompanyId || companySlug,
      ]);

      return NextResponse.json({ message: 'Abteilung erfolgreich gelöscht' });
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error('Fehler beim Löschen der Abteilung:', error);
    if (error.code === '23503') {
      return NextResponse.json(
        { error: 'Abteilung kann nicht gelöscht werden, da sie noch referenziert wird' },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Fehler beim Löschen der Abteilung' },
      { status: 500 }
    );
  }
}
