import { NextRequest, NextResponse } from 'next/server';
import { extractTokenFromHeader, verifyToken } from '@/lib/auth';
import { getTenantDbClient } from '@/lib/tenant-db-client';
import { validateWorkflow, WorkflowData } from '@/lib/automation-engine';

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
 * POST /api/automation-rules/import
 * Importiert eine Regel aus JSON
 */
export async function POST(request: NextRequest) {
  try {
    const context = await extractContext(request);
    if ('error' in context) {
      return NextResponse.json({ error: context.error }, { status: context.status });
    }

    const { companyId, userId } = context;

    let importData: any;
    try {
      const body = await request.json();
      importData = body;
    } catch (error) {
      return NextResponse.json(
        { error: 'Ungültiges JSON-Format' },
        { status: 400 }
      );
    }

    const { name, description, isActive, priority, triggerType, triggerConfig, workflowData, autoRename } = importData;

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

    const client = await getTenantDbClient(companyId);

    try {
      // Name-Prüfung
      let finalName = name.trim();
      const warnings: string[] = [];

      if (!autoRename) {
        const nameCheck = await client.query(
          `SELECT id FROM automation_rules WHERE user_id = $1 AND name = $2`,
          [userId, finalName]
        );

        if (nameCheck.rows.length > 0) {
          return NextResponse.json(
            { error: 'Eine Regel mit diesem Namen existiert bereits. Verwende autoRename=true zum automatischen Umbenennen.' },
            { status: 400 }
          );
        }
      } else {
        // Automatisches Umbenennen
        let counter = 1;
        for (;;) {
          const nameCheck = await client.query(
            `SELECT id FROM automation_rules WHERE user_id = $1 AND name = $2`,
            [userId, finalName]
          );
          if (nameCheck.rows.length === 0) break;
          counter++;
          finalName = `${name.trim()} ${counter}`;
        }
        if (counter > 1) {
          warnings.push(`Name wurde automatisch zu "${finalName}" geändert`);
        }
      }

      // Prüfe, ob referenzierte Themen existieren (wenn set_theme Aktion vorhanden)
      const themeNodes = workflowData.nodes.filter((n: any) => 
        n.type === 'setThemeAction' || n.data?.actionType === 'set_theme'
      );
      for (const node of themeNodes) {
        const themeId = node.data?.themeId;
        if (themeId) {
          const themeCheck = await client.query(
            `SELECT id FROM email_themes WHERE id = $1 AND user_id = $2`,
            [themeId, userId]
          );
          if (themeCheck.rows.length === 0) {
            warnings.push(`Thema mit ID ${themeId} existiert nicht und muss manuell zugewiesen werden`);
          }
        }
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
          finalName,
          description || null,
          isActive !== false,
          priority || 0,
          triggerType,
          JSON.stringify(triggerConfig || {}),
          JSON.stringify(workflowData),
        ]
      );

      const rule = result.rows[0];

      return NextResponse.json({
        id: rule.id,
        rule: {
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
        },
        warnings: warnings.length > 0 ? warnings : undefined,
      }, { status: 201 });
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error('Fehler beim Importieren der Regel:', error);
    return NextResponse.json(
      { error: 'Fehler beim Importieren der Regel' },
      { status: 500 }
    );
  }
}



