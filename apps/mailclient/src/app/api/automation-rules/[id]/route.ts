import { NextRequest, NextResponse } from 'next/server';
import { extractTokenFromHeader, verifyToken } from '@/lib/auth';
import { getTenantDbClient } from '@/lib/tenant-db-client';
import { validateWorkflow, WorkflowData, validateCronExpression } from '@/lib/automation-engine';

async function extractContext(request: NextRequest) {
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
    return { error: 'Authorization-Token erforderlich', status: 401 };
  }

  const payload = verifyToken(token);

  if (!payload) {
    return { error: 'Ungültiger Token', status: 401 };
  }

  if (!companyId && payload.companyId) {
    companyId = payload.companyId;
  }

  if (!companyId && !companySlug) {
    return { error: 'Tenant-Context nicht gesetzt', status: 400 };
  }

  let resolvedCompanyId = companyId;
  if (!resolvedCompanyId && companySlug) {
    const { getCompanyDbConfigBySlug } = await import('@/lib/scc-client');
    const dbConfig = await getCompanyDbConfigBySlug(companySlug);
    if (dbConfig) {
      resolvedCompanyId = dbConfig.companyId;
    }
  }

  if (!resolvedCompanyId) {
    return { error: 'Company-ID oder Slug erforderlich', status: 400 };
  }

  return { companyId: resolvedCompanyId, userId: payload.sub };
}

/**
 * GET /api/automation-rules/[id]
 * Lädt eine einzelne Regel inkl. Workflow-Daten und zugehöriger Abteilungen
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const context = await extractContext(request);
    if ('error' in context) {
      return NextResponse.json({ error: context.error }, { status: context.status });
    }

    const { companyId, userId } = context;
    const { id } = await params;

    const client = await getTenantDbClient(companyId);

    try {
      const result = await client.query(
        `SELECT id, user_id, name, description, is_active, priority, trigger_type, 
                trigger_config, workflow_data, execution_count, last_executed_at,
                created_at, updated_at
         FROM automation_rules
         WHERE id = $1 AND user_id = $2`,
        [id, userId]
      );

      if (result.rows.length === 0) {
        return NextResponse.json({ error: 'Regel nicht gefunden' }, { status: 404 });
      }

      const row = result.rows[0];

      const deptResult = await client.query(
        `SELECT d.id
         FROM automation_rule_departments ard
         JOIN departments d ON ard.department_id = d.id
         WHERE ard.automation_rule_id = $1`,
        [row.id]
      );
      const departmentIds = deptResult.rows.map((r: any) => r.id);

      return NextResponse.json({
        id: row.id,
        userId: row.user_id,
        name: row.name,
        description: row.description,
        isActive: row.is_active,
        priority: row.priority,
        triggerType: row.trigger_type,
        triggerConfig: row.trigger_config || {},
        workflowData: row.workflow_data,
        executionCount: row.execution_count,
        lastExecutedAt: row.last_executed_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        departmentIds,
      });
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error('Fehler beim Laden der Regel:', error);
    return NextResponse.json(
      { error: 'Fehler beim Laden der Regel' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/automation-rules/[id]
 * Aktualisiert eine bestehende Regel (vollständiges oder teilweises Update)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const context = await extractContext(request);
    if ('error' in context) {
      return NextResponse.json({ error: context.error }, { status: context.status });
    }

    const { companyId, userId } = context;
    const { id } = await params;

    const body = await request.json();

    const client = await getTenantDbClient(companyId);

    try {
      const existingResult = await client.query(
        `SELECT id, user_id, name, description, is_active, priority, trigger_type, 
                trigger_config, workflow_data
         FROM automation_rules
         WHERE id = $1 AND user_id = $2`,
        [id, userId]
      );

      if (existingResult.rows.length === 0) {
        return NextResponse.json({ error: 'Regel nicht gefunden' }, { status: 404 });
      }

      const current = existingResult.rows[0];

      const merged = {
        name: body.name ?? current.name,
        description: body.description ?? current.description,
        isActive: body.isActive ?? current.is_active,
        priority: body.priority ?? current.priority,
        triggerType: body.triggerType ?? current.trigger_type,
        // Klammern nötig, um ?? und || eindeutig zu kombinieren
        triggerConfig: (body.triggerConfig ?? current.trigger_config) || {},
        workflowData: body.workflowData ?? current.workflow_data,
        departmentIds: Array.isArray(body.departmentIds) ? body.departmentIds : undefined,
      };

      if (!merged.name || typeof merged.name !== 'string' || merged.name.trim().length === 0) {
        return NextResponse.json(
          { error: 'Name ist erforderlich' },
          { status: 400 }
        );
      }

      if (
        !merged.triggerType ||
        !['incoming', 'outgoing', 'manual', 'scheduled', 'email_updated'].includes(
          merged.triggerType
        )
      ) {
        return NextResponse.json(
          { error: 'Ungültiger Trigger-Typ' },
          { status: 400 }
        );
      }

      if (!merged.workflowData || !merged.workflowData.nodes || !merged.workflowData.edges) {
        return NextResponse.json(
          { error: 'Workflow-Daten sind erforderlich' },
          { status: 400 }
        );
      }

      // Workflow validieren
      const validation = validateWorkflow(merged.workflowData as WorkflowData);
      if (!validation.valid) {
        return NextResponse.json(
          { error: `Workflow ungültig: ${validation.errors.join(', ')}` },
          { status: 400 }
        );
      }

      // Start-Block prüfen
      const startNodes = merged.workflowData.nodes.filter(
        (n: { type?: string }) =>
          n.type === 'workflowStartNode' || (n.type?.includes?.('Start') ?? false)
      );

      if (startNodes.length === 0) {
        return NextResponse.json(
          { error: 'Workflow muss genau einen Start-Block enthalten' },
          { status: 400 }
        );
      }

      if (startNodes.length > 1) {
        return NextResponse.json(
          { error: 'Workflow darf nur einen Start-Block enthalten' },
          { status: 400 }
        );
      }

      // Cron-Expression validieren (wenn scheduled)
      if (merged.triggerType === 'scheduled') {
        if (!merged.triggerConfig?.cronExpression) {
          return NextResponse.json(
            { error: 'Cron-Expression ist erforderlich für Scheduled Rules' },
            { status: 400 }
          );
        }

        const cronValidation = validateCronExpression(merged.triggerConfig.cronExpression);
        if (!cronValidation.valid) {
          return NextResponse.json(
            { error: `Ungültige Cron-Expression: ${cronValidation.error || 'Unbekannter Fehler'}` },
            { status: 400 }
          );
        }
      }

      // Name-Kollision prüfen (andere Regel mit gleichem Namen)
      const nameCheck = await client.query(
        `SELECT id FROM automation_rules WHERE user_id = $1 AND name = $2 AND id <> $3`,
        [userId, merged.name.trim(), id]
      );

      if (nameCheck.rows.length > 0) {
        return NextResponse.json(
          { error: 'Eine andere Regel mit diesem Namen existiert bereits' },
          { status: 400 }
        );
      }

      // Regel aktualisieren
      const updateResult = await client.query(
        `UPDATE automation_rules
         SET name = $1,
             description = $2,
             is_active = $3,
             priority = $4,
             trigger_type = $5,
             trigger_config = $6,
             workflow_data = $7,
             updated_at = NOW()
         WHERE id = $8 AND user_id = $9
         RETURNING id, user_id, name, description, is_active, priority, trigger_type,
                   trigger_config, workflow_data, execution_count, last_executed_at,
                   created_at, updated_at`,
        [
          merged.name.trim(),
          merged.description || null,
          merged.isActive !== false,
          merged.priority || 0,
          merged.triggerType,
          JSON.stringify(merged.triggerConfig || {}),
          JSON.stringify(merged.workflowData),
          id,
          userId,
        ]
      );

      const updated = updateResult.rows[0];

      // Abteilungs-Zuordnungen aktualisieren (falls departmentIds übergeben wurden)
      if (merged.departmentIds) {
        await client.query(
          'DELETE FROM automation_rule_departments WHERE automation_rule_id = $1',
          [id]
        );

        if (merged.departmentIds.length > 0) {
          for (const deptId of merged.departmentIds) {
            const deptCheck = await client.query(
              'SELECT id FROM departments WHERE id = $1 AND company_id = $2',
              [deptId, companyId]
            );

            if (deptCheck.rows.length > 0) {
              try {
                await client.query(
                  'INSERT INTO automation_rule_departments (automation_rule_id, department_id) VALUES ($1, $2)',
                  [id, deptId]
                );
              } catch (error: any) {
                if (error.code !== '23505') {
                  console.error(
                    `Fehler beim Zuweisen der Abteilung ${deptId} an Regel ${id}:`,
                    error
                  );
                }
              }
            }
          }
        }
      }

      const deptResult = await client.query(
        `SELECT d.id
         FROM automation_rule_departments ard
         JOIN departments d ON ard.department_id = d.id
         WHERE ard.automation_rule_id = $1`,
        [id]
      );
      const departmentIds = deptResult.rows.map((r: any) => r.id);

      return NextResponse.json({
        id: updated.id,
        userId: updated.user_id,
        name: updated.name,
        description: updated.description,
        isActive: updated.is_active,
        priority: updated.priority,
        triggerType: updated.trigger_type,
        triggerConfig: updated.trigger_config || {},
        workflowData: updated.workflow_data,
        executionCount: updated.execution_count,
        lastExecutedAt: updated.last_executed_at,
        createdAt: updated.created_at,
        updatedAt: updated.updated_at,
        departmentIds,
      });
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error('Fehler beim Aktualisieren der Regel:', error);
    return NextResponse.json(
      { error: 'Fehler beim Aktualisieren der Regel' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/automation-rules/[id]
 * Löscht eine Regel und zugehörige Abteilungs-Zuordnungen
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const context = await extractContext(request);
    if ('error' in context) {
      return NextResponse.json({ error: context.error }, { status: context.status });
    }

    const { companyId, userId } = context;
    const { id } = await params;

    const client = await getTenantDbClient(companyId);

    try {
      const existingResult = await client.query(
        `SELECT id FROM automation_rules WHERE id = $1 AND user_id = $2`,
        [id, userId]
      );

      if (existingResult.rows.length === 0) {
        return NextResponse.json({ error: 'Regel nicht gefunden' }, { status: 404 });
      }

      await client.query(
        'DELETE FROM automation_rule_departments WHERE automation_rule_id = $1',
        [id]
      );

      await client.query('DELETE FROM automation_rules WHERE id = $1 AND user_id = $2', [
        id,
        userId,
      ]);

      return NextResponse.json({ success: true });
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error('Fehler beim Löschen der Regel:', error);
    return NextResponse.json(
      { error: 'Fehler beim Löschen der Regel' },
      { status: 500 }
    );
  }
}

