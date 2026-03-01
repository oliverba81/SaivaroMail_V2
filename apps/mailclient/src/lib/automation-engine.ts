/**
 * Automation Engine: Orchestrierung und öffentliche API
 * - Type-Definitionen
 * - Workflow-Caching
 * - Regel-Ausführung
 * - Fehlerbehandlung und Logging
 */

import { PoolClient } from 'pg';
import { getTenantDbClient } from './tenant-db-client';
import * as cron from 'node-cron';

// Re-Exports aus den neuen Modulen
import { executeWorkflow } from './workflow-executor';

// Type-Definitionen
export type TriggerType = 'incoming' | 'outgoing' | 'manual' | 'scheduled' | 'email_updated';

export interface WorkflowNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: {
    label?: string;
    [key: string]: any;
  };
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
}

export interface WorkflowData {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  viewport?: { x: number; y: number; zoom: number };
}

export interface AutomationWorkflow {
  id: string;
  userId: string;
  name: string;
  description?: string;
  isActive: boolean;
  priority: number;
  triggerType: TriggerType;
  triggerConfig: any;
  workflowData: WorkflowData;
  executionCount: number;
  lastExecutedAt?: Date;
}

export interface EmailDataForAutomation {
  id: string;
  userId: string;
  subject?: string;
  fromEmail?: string;
  toEmail?: string;
  phoneNumber?: string;
  type?: 'email' | 'phone_note';
  body?: string;
  createdAt?: Date;
  themeId?: string;
  urgency?: 'low' | 'medium' | 'high';
  importantAt?: Date;
  spamAt?: Date;
  deletedAt?: Date;
  /** Gelesen (read_at gesetzt) – für Bedingungen */
  read?: boolean;
  /** Erledigt (completed_at gesetzt) – für Bedingungen */
  completed?: boolean;
  /** Hat Anhang – für Bedingungen */
  hasAttachment?: boolean;
  /** E-Mail des Users (für „Gesendet“-Bedingung) */
  userEmail?: string;
}

export interface ExecutionResult {
  success: boolean;
  executedActions: string[];
  error?: string;
  executionTimeMs: number;
}

// Cache für aktive Workflows (5 Minuten TTL)
const activeWorkflowsCache = new Map<string, { workflows: AutomationWorkflow[]; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 Minuten

/**
 * Invalidiert den Workflow-Cache für eine Company/User/TriggerType-Kombination
 */
export function invalidateWorkflowsCache(
  companyId: string,
  userId: string,
  triggerType?: TriggerType
): void {
  const cacheKey = `${companyId}:${userId}:${triggerType || 'all'}`;
  activeWorkflowsCache.delete(cacheKey);
}

/**
 * Lädt aktive Workflows für einen User (mit Caching)
 */
export async function getActiveWorkflows(
  companyId: string,
  userId: string,
  triggerType?: TriggerType
): Promise<AutomationWorkflow[]> {
  // Validierung der Eingabeparameter
  if (!companyId || !userId) {
    console.warn('[AutomationEngine] getActiveWorkflows: companyId oder userId fehlt', { companyId: !!companyId, userId: !!userId });
    return [];
  }

  const cacheKey = `${companyId}:${userId}:${triggerType || 'all'}`;
  const cached = activeWorkflowsCache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.workflows;
  }

  const client = await getTenantDbClient(companyId);

  try {
    let query = `
      SELECT id, user_id, name, description, is_active, priority, trigger_type, 
             trigger_config, workflow_data, execution_count, last_executed_at
      FROM automation_rules
      WHERE user_id = $1 AND is_active = true
    `;
    const params: any[] = [userId];

    if (triggerType) {
      query += ` AND trigger_type = $2`;
      params.push(triggerType);
    }

    query += ` ORDER BY priority DESC, created_at ASC`;

    const result = await client.query(query, params);

    const workflows = result.rows
      .map((row): AutomationWorkflow | null => {
        // Validierung: workflow_data muss vorhanden und gültig sein
        if (!row.workflow_data || typeof row.workflow_data !== 'object') {
          console.warn(`[AutomationEngine] Workflow ${row.id} hat ungültige workflow_data, überspringe`);
          return null;
        }

        // Zusätzliche Sicherheitsprüfung: triggerType muss übereinstimmen (falls angegeben)
        if (triggerType && row.trigger_type !== triggerType) {
          console.warn(`[AutomationEngine] Workflow ${row.id} hat trigger_type '${row.trigger_type}', erwartet '${triggerType}', überspringe`);
          return null;
        }

        return {
          id: row.id as string,
          userId: row.user_id as string,
          name: row.name as string,
          description: row.description as string | undefined,
          isActive: row.is_active as boolean,
          priority: row.priority as number,
          triggerType: row.trigger_type as TriggerType,
          triggerConfig: (row.trigger_config || {}) as AutomationWorkflow['triggerConfig'],
          workflowData: row.workflow_data as WorkflowData,
          executionCount: row.execution_count as number,
          lastExecutedAt: row.last_executed_at as Date | undefined,
        };
      })
      .filter((workflow): workflow is AutomationWorkflow => workflow !== null);

    activeWorkflowsCache.set(cacheKey, { workflows, timestamp: Date.now() });
    return workflows;
  } finally {
    client.release();
  }
}

/**
 * Protokolliert eine Regel-Ausführung
 */
export async function logWorkflowExecution(
  companyId: string,
  workflowId: string,
  userId: string,
  emailId: string | null,
  triggerType: TriggerType,
  success: boolean,
  executedActions: string[],
  error?: string,
  executionTimeMs?: number
): Promise<void> {
  let client: PoolClient | null = null;
  
  try {
    // Validierung der Eingabeparameter
    if (!companyId || !workflowId || !userId) {
      console.warn('[AutomationEngine] Unvollständige Parameter für logWorkflowExecution, überspringe Logging', {
        companyId: !!companyId,
        workflowId: !!workflowId,
        userId: !!userId,
      });
      return;
    }

    client = await getTenantDbClient(companyId);

    try {
      await client.query(
        `INSERT INTO automation_execution_logs 
         (rule_id, user_id, email_id, trigger_type, status, execution_time_ms, 
          error_message, executed_actions, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
        [
          workflowId,
          userId,
          emailId,
          triggerType,
          success ? 'success' : 'failed',
          executionTimeMs || 0,
          error || null,
          JSON.stringify(executedActions || []),
        ]
      );
    } catch (queryError: any) {
      // DB-Fehler sollten die Ausführung nicht stoppen
      console.error(`[AutomationEngine] Fehler beim Schreiben des Execution-Logs für Workflow ${workflowId}:`, queryError);
      // Fehler wird protokolliert, aber nicht weitergeworfen
    }
  } catch (error: any) {
    // Fehler beim Abrufen des DB-Clients oder andere kritische Fehler
    console.error(`[AutomationEngine] Kritischer Fehler in logWorkflowExecution für Workflow ${workflowId}:`, error);
    // Fehler wird protokolliert, aber nicht weitergeworfen
  } finally {
    // Sicherstellen, dass Client immer freigegeben wird
    if (client) {
      try {
        client.release();
      } catch (releaseError: any) {
        console.error(`[AutomationEngine] Fehler beim Freigeben des DB-Clients in logWorkflowExecution:`, releaseError);
      }
    }
  }
}

/**
 * Wrapper-Funktion für logRuleExecution (Rückwärtskompatibilität)
 * Konvertiert ExecutionResult in die Parameter für logWorkflowExecution
 */
export async function logRuleExecution(
  companyId: string,
  ruleId: string,
  userId: string,
  emailId: string | null,
  triggerType: TriggerType,
  result: ExecutionResult
): Promise<void> {
  return logWorkflowExecution(
    companyId,
    ruleId,
    userId,
    emailId,
    triggerType,
    result.success,
    result.executedActions,
    result.error,
    result.executionTimeMs
  );
}

/**
 * Führt alle passenden Regeln für eine E-Mail aus
 */
export async function executeRulesForEmail(
  companyId: string,
  emailData: EmailDataForAutomation,
  triggerType: TriggerType
): Promise<ExecutionResult[]> {
  try {
    // Validierung der Eingabeparameter
    if (!companyId) {
      console.error('[AutomationEngine] companyId ist erforderlich');
      return [];
    }
    if (!emailData || !emailData.id || !emailData.userId) {
      console.error('[AutomationEngine] emailData mit id und userId ist erforderlich', { emailData });
      return [];
    }

    const workflows = await getActiveWorkflows(companyId, emailData.userId, triggerType);
    const results: ExecutionResult[] = [];

    // Cache invalidieren
    invalidateWorkflowsCache(companyId, emailData.userId, triggerType);

    if (workflows.length === 0) {
      // Keine Regeln gefunden - das ist OK, kein Fehler
      return results;
    }

    for (const workflow of workflows) {
      try {
        // Zusätzliche Sicherheitsprüfung: triggerType muss übereinstimmen
        if (workflow.triggerType !== triggerType) {
          console.warn(`[AutomationEngine] Workflow ${workflow.id} hat triggerType '${workflow.triggerType}', erwartet '${triggerType}', überspringe`);
          continue;
        }

        const result = await executeWorkflow(
          companyId,
          workflow,
          emailData,
          triggerType,
          false
        );

        // Log protokollieren (auch bei Fehlern)
        await logRuleExecution(
          companyId,
          workflow.id,
          workflow.userId,
          emailData.id,
          triggerType,
          result
        ).catch((logError) => {
          // Logging-Fehler sollten die Ausführung nicht stoppen
          console.error(`[AutomationEngine] Fehler beim Protokollieren der Regel-Ausführung:`, logError);
        });

        results.push(result);
      } catch (error: any) {
        const errorResult: ExecutionResult = {
          success: false,
          executedActions: [],
          error: error.message || 'Unbekannter Fehler',
          executionTimeMs: 0,
        };

        // Auch Fehler protokollieren
        await logRuleExecution(
          companyId,
          workflow.id,
          workflow.userId,
          emailData.id,
          triggerType,
          errorResult
        ).catch((logError) => {
          console.error(`[AutomationEngine] Fehler beim Protokollieren des Fehlers:`, logError);
        });

        results.push(errorResult);
      }
    }

    return results;
  } catch (error: any) {
    console.error(`[AutomationEngine] Kritischer Fehler in executeRulesForEmail:`, error);
    // Bei kritischen Fehlern leere Ergebnisse zurückgeben statt zu crashen
    return [];
  }
}

/**
 * Lädt alle eindeutigen User-IDs aus automation_rules mit trigger_type = 'scheduled'
 */
export async function getUsersWithScheduledRules(companyId: string): Promise<string[]> {
  const client = await getTenantDbClient(companyId);

  try {
    const result = await client.query(
      `SELECT DISTINCT user_id 
       FROM automation_rules 
       WHERE trigger_type = $1 AND is_active = $2`,
      ['scheduled', true]
    );

    return result.rows.map((row) => row.user_id);
  } finally {
    client.release();
  }
}

/**
 * Lädt alle User mit fetch_interval_minutes aus user_settings
 */
export async function getUsersWithFetchInterval(
  companyId: string
): Promise<Array<{ userId: string; fetchIntervalMinutes: number }>> {
  const client = await getTenantDbClient(companyId);
  let clientReleased = false;

  try {
    const result = await client.query(
      `SELECT user_id, fetch_interval_minutes 
       FROM user_settings 
       WHERE fetch_interval_minutes >= $1 
         AND fetch_interval_minutes <= $2 
         AND fetch_interval_minutes IS NOT NULL`,
      [1, 1440] // 1 Minute bis 24 Stunden
    );

    console.log(`[AutomationEngine] Gefundene User mit fetch_interval_minutes für Company ${companyId}: ${result.rows.length}`);
    if (result.rows.length > 0) {
      console.log(`[AutomationEngine] User-Details:`, result.rows.map((r: any) => ({
        userId: r.user_id,
        fetchIntervalMinutes: r.fetch_interval_minutes,
      })));
    }

    return result.rows.map((row) => ({
      userId: row.user_id,
      fetchIntervalMinutes: row.fetch_interval_minutes,
    }));
  } catch (error: any) {
    console.error(`[AutomationEngine] Fehler beim Laden der User mit fetch_interval_minutes für Company ${companyId}:`, error.message);
    return [];
  } finally {
    if (client && !clientReleased) {
      client.release();
      clientReleased = true;
    }
  }
}

/**
 * Validiert einen Cron-Ausdruck
 */
export function validateCronExpression(
  cronExpression: string
): { valid: boolean; error?: string } {
  try {
    // Prüfe Format (5 oder 6 Felder)
    const parts = cronExpression.trim().split(/\s+/);
    if (parts.length !== 5 && parts.length !== 6) {
      return {
        valid: false,
        error: `Ungültiges Cron-Format: Erwartet 5 oder 6 Felder, erhalten ${parts.length}`,
      };
    }

    // Verwende node-cron für Validierung
    if (cron.validate(cronExpression)) {
      return { valid: true };
    } else {
      return {
        valid: false,
        error: 'Ungültiger Cron-Ausdruck',
      };
    }
  } catch (error: any) {
    return {
      valid: false,
      error: error.message || 'Ungültiger Cron-Ausdruck',
    };
  }
}

// Re-Exports für externe Verwendung
export { validateWorkflow } from './workflow-validator';
export { evaluateCondition, filterEmailsByWorkflowConditions } from './condition-evaluator';
export { executeWorkflow } from './workflow-executor';

// Aliase für Rückwärtskompatibilität
export type AutomationRule = AutomationWorkflow;
export const executeRule = executeWorkflow;
export const getActiveRules = getActiveWorkflows;
