import { NextRequest, NextResponse } from 'next/server';
import { getTenantDbClient } from '@/lib/tenant-db-client';
import { verifyServiceToken } from '@/lib/auth';
import {
  AutomationRule,
  EmailDataForAutomation,
  executeRule,
  logRuleExecution,
  filterEmailsByWorkflowConditions,
} from '@/lib/automation-engine';

/**
 * POST /api/automation-rules/scheduled/execute
 * Führt alle aktiven Scheduled Rules für eine Company aus
 * Wird vom Cron-Service aufgerufen
 */
export async function POST(request: NextRequest) {
  try {
    // Service-Token-Authentifizierung
    const serviceToken = request.headers.get('x-service-token');
    if (!serviceToken || !verifyServiceToken(serviceToken)) {
      return NextResponse.json(
        { error: 'Service-Token erforderlich oder ungültig' },
        { status: 401 }
      );
    }

    // Tenant-Context aus Header extrahieren
    const companyId = request.headers.get('x-company-id');
    if (!companyId) {
      return NextResponse.json(
        { error: 'x-company-id Header erforderlich' },
        { status: 400 }
      );
    }

    const client = await getTenantDbClient(companyId);

    try {
      // Lade alle aktiven Scheduled Rules für die Company
      const rulesResult = await client.query(
        `SELECT id, user_id, name, description, is_active, priority, trigger_type, 
                trigger_config, workflow_data, execution_count, last_executed_at 
         FROM automation_rules 
         WHERE trigger_type = $1 AND is_active = $2 
         ORDER BY priority DESC, created_at ASC`,
        ['scheduled', true]
      );

      if (rulesResult.rows.length === 0) {
        return NextResponse.json({
          success: true,
          message: 'Keine aktiven Scheduled Rules gefunden',
          processedRules: 0,
          processedEmails: 0,
        });
      }

      // Transformiere DB-Rows zu AutomationRule Objekten
      const rules: AutomationRule[] = rulesResult.rows.map((row) => ({
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
      }));

      // Sammle alle eindeutigen user_id aus den Regeln
      const userIds = [...new Set(rules.map((r) => r.userId))];

      // Lade E-Mails für alle User in einem Batch
      const maxBatchSize = parseInt(process.env.CRON_MAX_EMAILS_BATCH_SIZE || '10000', 10);
      const emailsResult = await client.query(
        `SELECT e.id, e.user_id, e.subject, e.from_email, e.to_email, e.body, e.created_at, 
                e.theme_id, e.urgency, e.important_at, e.spam_at, e.deleted_at, e.has_attachment,
                (ers.read_at IS NOT NULL) as read,
                (ecs.completed_at IS NOT NULL) as completed
         FROM emails e
         LEFT JOIN email_read_status ers ON e.id = ers.email_id AND ers.user_id = e.user_id
         LEFT JOIN email_completed_status ecs ON e.id = ecs.email_id AND ecs.user_id = e.user_id
         WHERE e.user_id = ANY($1::uuid[]) AND e.deleted_at IS NULL 
         ORDER BY e.created_at DESC 
         LIMIT $2`,
        [userIds, maxBatchSize]
      );

      // Transformiere DB-Rows zu EmailDataForAutomation Objekten
      const allEmails: EmailDataForAutomation[] = emailsResult.rows.map((row) => ({
        id: row.id,
        userId: row.user_id,
        subject: row.subject,
        fromEmail: row.from_email,
        toEmail: row.to_email,
        body: row.body,
        createdAt: row.created_at,
        themeId: row.theme_id,
        urgency: row.urgency,
        importantAt: row.important_at,
        spamAt: row.spam_at,
        deletedAt: row.deleted_at,
        read: !!row.read,
        completed: !!row.completed,
        hasAttachment: !!row.has_attachment,
      }));

      // Gruppiere E-Mails nach user_id
      const emailsByUser = new Map<string, EmailDataForAutomation[]>();
      for (const email of allEmails) {
        if (!emailsByUser.has(email.userId)) {
          emailsByUser.set(email.userId, []);
        }
        emailsByUser.get(email.userId)!.push(email);
      }

      // Verarbeite jede Regel
      const maxEmailsPerRule = parseInt(process.env.CRON_MAX_EMAILS_PER_RULE || '100', 10);
      const maxParallelEmails = parseInt(process.env.CRON_MAX_PARALLEL_EMAILS || '5', 10);
      let totalProcessedEmails = 0;
      const results: any[] = [];

      for (const rule of rules) {
        try {
          // Hole E-Mails für diesen User
          const userEmails = emailsByUser.get(rule.userId) || [];

          // Filtere E-Mails basierend auf Workflow-Bedingungen
          const filteredEmails = filterEmailsByWorkflowConditions(userEmails, rule.workflowData);

          // Rate Limiting: Begrenze auf max E-Mails pro Regel
          const emailsToProcess = filteredEmails.slice(0, maxEmailsPerRule);

          if (emailsToProcess.length === 0) {
            results.push({
              ruleId: rule.id,
              ruleName: rule.name,
              success: true,
              processedEmails: 0,
              message: 'Keine passenden E-Mails gefunden',
            });
            continue;
          }

          // Verarbeite E-Mails parallel (in Batches)
          let processedCount = 0;
          for (let i = 0; i < emailsToProcess.length; i += maxParallelEmails) {
            const batch = emailsToProcess.slice(i, i + maxParallelEmails);
            const batchResults = await Promise.all(
              batch.map(async (emailData) => {
                try {
                  const result = await executeRule(
                    companyId,
                    rule,
                    emailData,
                    'scheduled',
                    false
                  );

                  // Protokolliere Ausführung
                  await logRuleExecution(
                    companyId,
                    rule.id,
                    rule.userId,
                    emailData.id,
                    'scheduled',
                    result
                  );

                  return { success: result.success, emailId: emailData.id };
                } catch (error: any) {
                  console.error(`Fehler beim Ausführen der Regel ${rule.id} für E-Mail ${emailData.id}:`, error);
                  return { success: false, emailId: emailData.id, error: error.message };
                }
              })
            );

            processedCount += batchResults.filter((r) => r.success).length;
          }

          totalProcessedEmails += processedCount;

          results.push({
            ruleId: rule.id,
            ruleName: rule.name,
            success: true,
            processedEmails: processedCount,
            totalEmails: filteredEmails.length,
          });
        } catch (error: any) {
          console.error(`Fehler beim Verarbeiten der Regel ${rule.id}:`, error);
          results.push({
            ruleId: rule.id,
            ruleName: rule.name,
            success: false,
            error: error.message || 'Unbekannter Fehler',
          });
        }
      }

      return NextResponse.json({
        success: true,
        message: `${rules.length} Regel(n) verarbeitet, ${totalProcessedEmails} E-Mail(s) bearbeitet`,
        processedRules: rules.length,
        processedEmails: totalProcessedEmails,
        results,
      });
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error('Fehler beim Ausführen der Scheduled Rules:', error);
    return NextResponse.json(
      { error: 'Fehler beim Ausführen der Scheduled Rules: ' + (error.message || 'Unbekannter Fehler') },
      { status: 500 }
    );
  }
}


