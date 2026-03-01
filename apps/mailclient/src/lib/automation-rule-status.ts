import { PoolClient } from 'pg';
import { getTenantDbClient } from './tenant-db-client';

/**
 * Protokolliert eine Status-Änderung einer Automatisierungsregel
 */
export async function logRuleStatusChange(
  companyId: string,
  ruleId: string,
  userId: string,
  changedBy: string,
  isActive: boolean
): Promise<void> {
  const client = await getTenantDbClient(companyId);

  try {
    await client.query(
      `INSERT INTO automation_rule_status_history (rule_id, user_id, is_active, changed_at, changed_by)
       VALUES ($1, $2, $3, NOW(), $4)`,
      [ruleId, userId, isActive, changedBy]
    );
  } finally {
    client.release();
  }
}

/**
 * Protokolliert eine Status-Änderung direkt mit einem Client (für Transaktionen)
 */
export async function logRuleStatusChangeWithClient(
  client: PoolClient,
  ruleId: string,
  userId: string,
  changedBy: string,
  isActive: boolean
): Promise<void> {
  await client.query(
    `INSERT INTO automation_rule_status_history (rule_id, user_id, is_active, changed_at, changed_by)
     VALUES ($1, $2, $3, NOW(), $4)`,
    [ruleId, userId, isActive, changedBy]
  );
}

/**
 * Lädt die Status-Historie einer Regel
 */
export async function getRuleStatusHistory(
  companyId: string,
  ruleId: string,
  userId: string,
  limit: number = 50,
  offset: number = 0
): Promise<Array<{
  id: string;
  ruleId: string;
  userId: string;
  isActive: boolean;
  changedAt: Date;
  changedBy: string;
}>> {
  const client = await getTenantDbClient(companyId);

  try {
    const result = await client.query(
      `SELECT id, rule_id, user_id, is_active, changed_at, changed_by
       FROM automation_rule_status_history
       WHERE rule_id = $1 AND user_id = $2
       ORDER BY changed_at DESC
       LIMIT $3 OFFSET $4`,
      [ruleId, userId, limit, offset]
    );

    return result.rows.map((row) => ({
      id: row.id,
      ruleId: row.rule_id,
      userId: row.user_id,
      isActive: row.is_active,
      changedAt: row.changed_at,
      changedBy: row.changed_by,
    }));
  } finally {
    client.release();
  }
}

/**
 * Ermittelt, welche Regeln zu einem bestimmten Zeitpunkt aktiv waren
 */
export async function getActiveRulesAtTime(
  companyId: string,
  userId: string,
  timestamp: Date
): Promise<Array<{
  ruleId: string;
  ruleName: string;
  isActive: boolean;
}>> {
  const client = await getTenantDbClient(companyId);

  try {
    // Finde die letzte Status-Änderung vor dem Zeitpunkt für jede Regel
    const result = await client.query(
      `SELECT DISTINCT ON (ar.id)
         ar.id as rule_id,
         ar.name as rule_name,
         COALESCE(arsh.is_active, ar.is_active) as is_active
       FROM automation_rules ar
       LEFT JOIN automation_rule_status_history arsh ON ar.id = arsh.rule_id
         AND arsh.user_id = $1
         AND arsh.changed_at <= $2
       WHERE ar.user_id = $1
       ORDER BY ar.id, arsh.changed_at DESC NULLS LAST`,
      [userId, timestamp]
    );

    return result.rows
      .filter((row) => row.is_active === true)
      .map((row) => ({
        ruleId: row.rule_id,
        ruleName: row.rule_name,
        isActive: row.is_active,
      }));
  } finally {
    client.release();
  }
}



