import { NextRequest, NextResponse } from 'next/server';
import { extractTokenFromHeader, verifyToken } from '@/lib/auth';
import { getTenantDbClient } from '@/lib/tenant-db-client';
import { validateWorkflow, WorkflowData, validateCronExpression } from '@/lib/automation-engine';

/**
 * Hilfsfunktion: Tenant-Context und Auth extrahieren
 */
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
 * GET /api/automation-rules
 * Lädt alle Regeln des Benutzers (sortiert nach Priorität)
 */
export async function GET(request: NextRequest) {
  try {
    const context = await extractContext(request);
    if ('error' in context) {
      return NextResponse.json({ error: context.error }, { status: context.status });
    }

    const { companyId, userId } = context;

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const isActive = searchParams.get('is_active');
    const triggerType = searchParams.get('trigger_type');

    const client = await getTenantDbClient(companyId);

    try {
      let query = `
        SELECT id, user_id, name, description, is_active, priority, trigger_type, 
               trigger_config, workflow_data, execution_count, last_executed_at,
               created_at, updated_at
        FROM automation_rules
        WHERE user_id = $1
      `;
      const params: any[] = [userId];
      let paramIndex = 2;

      if (isActive !== null) {
        query += ` AND is_active = $${paramIndex}`;
        params.push(isActive === 'true');
        paramIndex++;
      }

      if (triggerType) {
        query += ` AND trigger_type = $${paramIndex}`;
        params.push(triggerType);
        paramIndex++;
      }

      query += ` ORDER BY priority DESC, created_at ASC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(limit, offset);

      const result = await client.query(query, params);

      // Lade Abteilungen für jede Regel
      const rules = await Promise.all(
        result.rows.map(async (row) => {
          const deptResult = await client.query(
            `SELECT d.id
             FROM automation_rule_departments ard
             JOIN departments d ON ard.department_id = d.id
             WHERE ard.automation_rule_id = $1`,
            [row.id]
          );
          const departmentIds = deptResult.rows.map((r: any) => r.id);

          return {
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
          };
        })
      );

      return NextResponse.json({ rules });
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error('Fehler beim Laden der Regeln:', error);
    return NextResponse.json(
      { error: 'Fehler beim Laden der Regeln' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/automation-rules
 * Erstellt eine neue Regel
 */
export async function POST(request: NextRequest) {
  try {
    const context = await extractContext(request);
    if ('error' in context) {
      return NextResponse.json({ error: context.error }, { status: context.status });
    }

    const { companyId, userId } = context;

    const body = await request.json();
    const { name, description, isActive, priority, triggerType, triggerConfig, workflowData, departmentIds = [] } = body;

    // Validierung
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Name ist erforderlich' },
        { status: 400 }
      );
    }

    if (!triggerType || !['incoming', 'outgoing', 'manual', 'scheduled', 'email_updated'].includes(triggerType)) {
      return NextResponse.json(
        { error: 'Ungültiger Trigger-Typ' },
        { status: 400 }
      );
    }

    if (!workflowData || !workflowData.nodes || !workflowData.edges) {
      return NextResponse.json(
        { error: 'Workflow-Daten sind erforderlich' },
        { status: 400 }
      );
    }

    // Workflow validieren
    const validation = validateWorkflow(workflowData as WorkflowData);
    if (!validation.valid) {
      return NextResponse.json(
        { error: `Workflow ungültig: ${validation.errors.join(', ')}` },
        { status: 400 }
      );
    }

    // Prüfe, ob genau ein Start-Block vorhanden ist
    const startNodes = workflowData.nodes.filter((n: { type?: string }) =>
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
    if (triggerType === 'scheduled') {
      if (!triggerConfig?.cronExpression) {
        return NextResponse.json(
          { error: 'Cron-Expression ist erforderlich für Scheduled Rules' },
          { status: 400 }
        );
      }

      const validation = validateCronExpression(triggerConfig.cronExpression);
      if (!validation.valid) {
        return NextResponse.json(
          { error: `Ungültige Cron-Expression: ${validation.error || 'Unbekannter Fehler'}` },
          { status: 400 }
        );
      }
    }

    const client = await getTenantDbClient(companyId);

    try {
      // Prüfe, ob Name bereits existiert
      const nameCheck = await client.query(
        `SELECT id FROM automation_rules WHERE user_id = $1 AND name = $2`,
        [userId, name.trim()]
      );

      if (nameCheck.rows.length > 0) {
        return NextResponse.json(
          { error: 'Eine Regel mit diesem Namen existiert bereits' },
          { status: 400 }
        );
      }

      // Regel erstellen
      const result = await client.query(
        `INSERT INTO automation_rules 
         (user_id, name, description, is_active, priority, trigger_type, trigger_config, workflow_data, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
         RETURNING id, user_id, name, description, is_active, priority, trigger_type, 
                   trigger_config, workflow_data, execution_count, last_executed_at,
                   created_at, updated_at`,
        [
          userId,
          name.trim(),
          description || null,
          isActive !== false,
          priority || 0,
          triggerType,
          JSON.stringify(triggerConfig || {}),
          JSON.stringify(workflowData),
        ]
      );

      const rule = result.rows[0];

      // Speichere Abteilungen, falls angegeben
      if (Array.isArray(departmentIds) && departmentIds.length > 0) {
        for (const deptId of departmentIds) {
          // Prüfe, ob Abteilung existiert und zur gleichen Company gehört
          const deptCheck = await client.query(
            'SELECT id FROM departments WHERE id = $1 AND company_id = $2',
            [deptId, companyId]
          );

          if (deptCheck.rows.length > 0) {
            try {
              await client.query(
                'INSERT INTO automation_rule_departments (automation_rule_id, department_id) VALUES ($1, $2)',
                [rule.id, deptId]
              );
            } catch (error: any) {
              // Ignoriere Duplikat-Fehler
              if (error.code !== '23505') {
                console.error(`Fehler beim Zuweisen der Abteilung ${deptId}:`, error);
              }
            }
          }
        }
      }

      // Lade zugewiesene Abteilungen
      const deptResult = await client.query(
        `SELECT d.id
         FROM automation_rule_departments ard
         JOIN departments d ON ard.department_id = d.id
         WHERE ard.automation_rule_id = $1`,
        [rule.id]
      );
      const ruleDepartmentIds = deptResult.rows.map((r: any) => r.id);

      return NextResponse.json({
        id: rule.id,
        userId: rule.user_id,
        name: rule.name,
        description: rule.description,
        isActive: rule.is_active,
        priority: rule.priority,
        triggerType: rule.trigger_type,
        triggerConfig: rule.trigger_config || {},
        workflowData: rule.workflow_data,
        executionCount: rule.execution_count,
        lastExecutedAt: rule.last_executed_at,
        createdAt: rule.created_at,
        updatedAt: rule.updated_at,
        departmentIds: ruleDepartmentIds,
      }, { status: 201 });
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error('Fehler beim Erstellen der Regel:', error);
    return NextResponse.json(
      { error: 'Fehler beim Erstellen der Regel' },
      { status: 500 }
    );
  }
}

