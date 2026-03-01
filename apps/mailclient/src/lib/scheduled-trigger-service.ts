/**
 * Scheduled Trigger Service: Verwaltet Cron-Jobs für Scheduled Triggers und E-Mail-Abruf
 * - Multi-Tenant-Handling
 * - Job-Management (Erstellen, Aktualisieren, Löschen)
 * - Refresh-Mechanismus
 * - Graceful Shutdown
 */

import * as cron from 'node-cron';
import { getAllCompanies } from './scc-client';
import { getTenantDbClient } from './tenant-db-client';
import {
  getUsersWithFetchInterval,
  AutomationRule,
} from './automation-engine';
import { logCronJobToScc } from './cron-job-logger';

interface JobConfig {
  companyId: string;
  ruleId?: string; // Für Scheduled Triggers
  userId?: string; // Für E-Mail-Abruf
  cronExpression: string;
  type: 'scheduled_trigger' | 'email_fetch';
}

interface JobEntry {
  job: cron.ScheduledTask;
  config: JobConfig;
}

// Job-Storage: Map<JobKey, JobEntry>
const jobs = new Map<string, JobEntry>();

// Refresh-Intervall (Standard: 5 Minuten)
const REFRESH_INTERVAL_MS = parseInt(process.env.CRON_REFRESH_INTERVAL_MS || '300000', 10);

// Mailclient-URL
const MAILCLIENT_URL = process.env.MAILCLIENT_URL || 'http://localhost:3000';

// WICHTIG: SERVICE_TOKEN wird erst beim ersten Zugriff gelesen, nicht beim Import!
// Dies ermöglicht, dass die .env-Datei VOR dem Import geladen werden kann
function getServiceToken(): string {
  const token = process.env.CRON_SERVICE_TOKEN || '';
  if (!token || token.trim() === '') {
    console.warn('⚠️  CRON_SERVICE_TOKEN ist nicht gesetzt. Service-Token-Authentifizierung wird fehlschlagen.');
    console.warn('⚠️  Bitte setze CRON_SERVICE_TOKEN in der .env-Datei des Mailclients.');
    return '';
  }
  // Entferne Anführungszeichen falls vorhanden
  return token.replace(/^["']|["']$/g, '');
}

// API-Timeout
const API_TIMEOUT_MS = parseInt(process.env.CRON_API_TIMEOUT_MS || '30000', 10);
const MAX_RETRIES = parseInt(process.env.CRON_MAX_RETRIES || '3', 10);

/**
 * Loggt eine Nachricht mit Timestamp und Level
 */
function log(level: 'INFO' | 'WARN' | 'ERROR', message: string, ...args: any[]) {
  const timestamp = new Date().toISOString();
  console.log(`[CronService] ${timestamp} ${level}`, message, ...args);
}

/**
 * Führt einen API-Aufruf mit Retry-Mechanismus aus
 */
async function callApiWithRetry(
  url: string,
  options: RequestInit,
  retries: number = MAX_RETRIES
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        return response;
      }

      // Bei 4xx-Fehlern nicht retry
      if (response.status >= 400 && response.status < 500) {
        throw new Error(`API-Fehler: ${response.status} ${response.statusText}`);
      }

      // Bei 5xx-Fehlern retry
      lastError = new Error(`API-Fehler: ${response.status} ${response.statusText}`);
    } catch (error: any) {
      lastError = error;

      if (attempt < retries) {
        // Exponential Backoff
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 15000);
        log('WARN', `API-Aufruf fehlgeschlagen (Versuch ${attempt}/${retries}), retry in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new Error('API-Aufruf fehlgeschlagen');
}

/**
 * Führt eine Scheduled Rule aus
 */
async function executeScheduledRule(companyId: string, ruleId: string, ruleName?: string) {
  const startTime = new Date();

  // Logge Job-Start
  let logId: string | undefined;
  try {
    const logResponse = await logCronJobToScc({
      companyId,
      jobType: 'scheduled_trigger',
      jobKey: `scheduled-rule:${companyId}:${ruleId}`,
      status: 'running',
      startedAt: startTime.toISOString(),
      metadata: { ruleId, ruleName },
    });
    if (logResponse) {
      logId = logResponse.id;
    }
  } catch (error) {
    log('WARN', `Fehler beim Loggen des Job-Starts für Regel ${ruleId}:`, error);
  }

  try {
    const serviceToken = getServiceToken();
    if (!serviceToken) {
      throw new Error('CRON_SERVICE_TOKEN ist nicht gesetzt');
    }
    
    const url = `${MAILCLIENT_URL}/api/automation-rules/scheduled/execute`;
    const response = await callApiWithRetry(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-service-token': serviceToken,
        'x-company-id': companyId,
      },
    });

    const result = await response.json();

    // Logge Job-Erfolg
    if (logId) {
      try {
        await logCronJobToScc({
          companyId,
          jobType: 'scheduled_trigger',
          jobKey: `scheduled-rule:${companyId}:${ruleId}`,
          status: 'success',
          startedAt: startTime.toISOString(),
          completedAt: new Date().toISOString(),
          executionTimeMs: Date.now() - startTime.getTime(),
          processedItems: result.processedEmails || 0,
          metadata: { ruleId, ruleName },
          logId,
        });
      } catch (error) {
        log('WARN', `Fehler beim Loggen des Job-Erfolgs für Regel ${ruleId}:`, error);
      }
    }

    log('INFO', `Regel '${ruleName || ruleId}' (${ruleId}) erfolgreich ausgeführt: ${result.processedEmails || 0} E-Mails verarbeitet`);
  } catch (error: any) {
    // Logge Job-Fehler
    if (logId) {
      try {
        await logCronJobToScc({
          companyId,
          jobType: 'scheduled_trigger',
          jobKey: `scheduled-rule:${companyId}:${ruleId}`,
          status: 'failed',
          startedAt: startTime.toISOString(),
          completedAt: new Date().toISOString(),
          executionTimeMs: Date.now() - startTime.getTime(),
          errorMessage: error.message || 'Unbekannter Fehler',
          metadata: { ruleId, ruleName },
          logId,
        });
      } catch (logError) {
        log('WARN', `Fehler beim Loggen des Job-Fehlers für Regel ${ruleId}:`, logError);
      }
    }

    log('ERROR', `Fehler beim Ausführen der Regel '${ruleName || ruleId}' (${ruleId}):`, error.message);
  }
}

/**
 * Führt einen E-Mail-Abruf aus
 */
async function executeEmailFetch(companyId: string, userId: string) {
  const startTime = new Date();

  // Logge Job-Start
  let logId: string | undefined;
  try {
    const logResponse = await logCronJobToScc({
      companyId,
      jobType: 'email_fetch',
      jobKey: `email-fetch:${companyId}:${userId}`,
      status: 'running',
      startedAt: startTime.toISOString(),
      metadata: { userId },
    });
    if (logResponse) {
      logId = logResponse.id;
    }
  } catch (error) {
    log('WARN', `Fehler beim Loggen des Job-Starts für E-Mail-Abruf ${userId}:`, error);
  }

  try {
      const url = `${MAILCLIENT_URL}/api/emails/fetch`;
      
      // Hole Service-Token (wird erst jetzt gelesen, nachdem .env geladen wurde)
      const serviceToken = getServiceToken();
      if (!serviceToken || serviceToken.trim() === '') {
        log('ERROR', `Service-Token ist nicht gesetzt. Kann E-Mail-Abruf nicht ausführen.`);
        throw new Error('CRON_SERVICE_TOKEN ist nicht gesetzt');
      }
      
      log('INFO', `Rufe E-Mails ab für User ${userId} (Company: ${companyId})`);
      const response = await callApiWithRetry(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-service-token': serviceToken,
          'x-company-id': companyId,
        },
        body: JSON.stringify({ userId }),
      });

    const result = await response.json();

    // Logge Job-Erfolg
    if (logId) {
      try {
        await logCronJobToScc({
          companyId,
          jobType: 'email_fetch',
          jobKey: `email-fetch:${companyId}:${userId}`,
          status: 'success',
          startedAt: startTime.toISOString(),
          completedAt: new Date().toISOString(),
          executionTimeMs: Date.now() - startTime.getTime(),
          processedItems: result.totalCount || 0,
          metadata: { userId },
          logId,
        });
      } catch (error) {
        log('WARN', `Fehler beim Loggen des Job-Erfolgs für E-Mail-Abruf ${userId}:`, error);
      }
    }

    log('INFO', `E-Mail-Abruf für User ${userId} erfolgreich: ${result.totalCount || 0} E-Mails abgerufen`);
  } catch (error: any) {
    // Logge Job-Fehler
    if (logId) {
      try {
        await logCronJobToScc({
          companyId,
          jobType: 'email_fetch',
          jobKey: `email-fetch:${companyId}:${userId}`,
          status: 'failed',
          startedAt: startTime.toISOString(),
          completedAt: new Date().toISOString(),
          executionTimeMs: Date.now() - startTime.getTime(),
          errorMessage: error.message || 'Unbekannter Fehler',
          metadata: { userId },
          logId,
        });
      } catch (logError) {
        log('WARN', `Fehler beim Loggen des Job-Fehlers für E-Mail-Abruf ${userId}:`, logError);
      }
    }

    log('ERROR', `Fehler beim E-Mail-Abruf für User ${userId}:`, error.message);
  }
}

/**
 * Generiert Cron-Ausdruck für fetch_interval_minutes
 */
function generateCronExpression(fetchIntervalMinutes: number): string {
  if (fetchIntervalMinutes < 60) {
    // Alle X Minuten
    return `*/${fetchIntervalMinutes} * * * *`;
  } else {
    // Alle X Stunden
    const hours = Math.floor(fetchIntervalMinutes / 60);
    return `0 */${hours} * * *`;
  }
}

/**
 * Lädt Scheduled Rules für eine Company
 */
async function loadScheduledRules(companyId: string): Promise<Array<{ rule: AutomationRule; config: JobConfig }>> {
  let client;
  try {
    client = await getTenantDbClient(companyId);
  } catch (error: any) {
    log('ERROR', `Fehler beim Verbinden zur Tenant-DB für Company ${companyId}:`, error.message);
    return [];
  }

  try {
    const result = await client.query(
      `SELECT id, user_id, name, description, is_active, priority, trigger_type, 
              trigger_config, workflow_data, execution_count, last_executed_at 
       FROM automation_rules 
       WHERE trigger_type = $1 AND is_active = $2 
       ORDER BY priority DESC, created_at ASC`,
      ['scheduled', true]
    );

    const rules: Array<{ rule: AutomationRule; config: JobConfig }> = [];

    for (const row of result.rows) {
      const rule: AutomationRule = {
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
      };

      const cronExpression = rule.triggerConfig?.cronExpression;
      if (!cronExpression) {
        log('WARN', `Regel ${rule.id} hat keine Cron-Expression, überspringe`);
        continue;
      }

      rules.push({
        rule,
        config: {
          companyId,
          ruleId: rule.id,
          cronExpression,
          type: 'scheduled_trigger',
        },
      });
    }

    return rules;
  } catch (error: any) {
    log('ERROR', `Fehler beim Laden der Scheduled Rules für Company ${companyId}:`, error.message);
    return [];
  } finally {
    if (client) {
      client.release();
    }
  }
}

/**
 * Lädt E-Mail-Abruf-Jobs für eine Company
 */
async function loadEmailFetchJobs(companyId: string): Promise<JobConfig[]> {
  try {
    const users = await getUsersWithFetchInterval(companyId);
    log('INFO', `Lade E-Mail-Abruf-Jobs für Company ${companyId}: ${users.length} User gefunden`);
    
    const jobs: JobConfig[] = [];

    for (const user of users) {
      const cronExpression = generateCronExpression(user.fetchIntervalMinutes);
      log('INFO', `Erstelle E-Mail-Abruf-Job für User ${user.userId}: ${cronExpression} (${user.fetchIntervalMinutes} Min)`);
      jobs.push({
        companyId,
        userId: user.userId,
        cronExpression,
        type: 'email_fetch',
      });
    }

    return jobs;
  } catch (error: any) {
    log('ERROR', `Fehler beim Laden der E-Mail-Abruf-Jobs für Company ${companyId}:`, error.message);
    return [];
  }
}

/**
 * Erstellt einen Job-Key
 */
function getJobKey(config: JobConfig): string {
  if (config.type === 'scheduled_trigger' && config.ruleId) {
    return `scheduled-rule:${config.companyId}:${config.ruleId}`;
  } else if (config.type === 'email_fetch' && config.userId) {
    return `email-fetch:${config.companyId}:${config.userId}`;
  }
  throw new Error('Ungültige Job-Config: ruleId oder userId fehlt');
}

/**
 * Erstellt einen Cron-Job
 */
async function createJob(config: JobConfig): Promise<cron.ScheduledTask> {
  getJobKey(config); // für zukünftige Nutzung (z. B. Job-Registry)

  if (config.type === 'scheduled_trigger' && config.ruleId) {
    // Lade Regel-Name für Logging
    const client = await getTenantDbClient(config.companyId);
    let ruleName: string | undefined;
    try {
      const result = await client.query(
        `SELECT name FROM automation_rules WHERE id = $1`,
        [config.ruleId]
      );
      if (result.rows.length > 0) {
        ruleName = result.rows[0].name;
      }
    } catch (error) {
      // Ignoriere Fehler, verwende undefined
    } finally {
      client.release();
    }

    return cron.schedule(config.cronExpression, () => {
      executeScheduledRule(config.companyId, config.ruleId!, ruleName);
    });
  } else if (config.type === 'email_fetch' && config.userId) {
    return cron.schedule(config.cronExpression, () => {
      executeEmailFetch(config.companyId, config.userId!);
    });
  }

  throw new Error('Ungültige Job-Config');
}

/**
 * Aktualisiert Jobs für alle Companies
 */
async function refreshJobs() {
  try {
    log('INFO', 'Starte Job-Refresh...');

    // Lade alle Companies
    const companyIds = await getAllCompanies();
    if (companyIds.length === 0) {
      log('WARN', 'Keine Companies gefunden. Prüfe SCC-API und SCC_DATABASE_URL.');
      return;
    }
    
    log('INFO', `Geladene ${companyIds.length} Companies`);

    // Sammle alle neuen Jobs
    const newJobConfigs = new Map<string, JobConfig>();

    for (const companyId of companyIds) {
      try {
        // Lade Scheduled Rules
        const scheduledRules = await loadScheduledRules(companyId);
        for (const { rule: _rule, config } of scheduledRules) {
          const jobKey = getJobKey(config);
          newJobConfigs.set(jobKey, config);
        }

        // Lade E-Mail-Abruf-Jobs
        const emailFetchJobs = await loadEmailFetchJobs(companyId);
        log('INFO', `Company ${companyId}: ${emailFetchJobs.length} E-Mail-Abruf-Jobs geladen`);
        for (const config of emailFetchJobs) {
          const jobKey = getJobKey(config);
          newJobConfigs.set(jobKey, config);
        }
      } catch (error: any) {
        log('ERROR', `Fehler beim Laden der Jobs für Company ${companyId}:`, error.message);
      }
    }

    // Stoppe Jobs, die nicht mehr existieren
    for (const [jobKey, entry] of jobs.entries()) {
      if (!newJobConfigs.has(jobKey)) {
        log('INFO', `Stoppe Job: ${jobKey}`);
        entry.job.stop();
        jobs.delete(jobKey);
      }
    }

    // Erstelle/aktualisiere Jobs
    let createdJobs = 0;
    let updatedJobs = 0;
    for (const [jobKey, newConfig] of newJobConfigs.entries()) {
      const existing = jobs.get(jobKey);

      if (!existing) {
        // Neuer Job
        log('INFO', `Erstelle neuen Job: ${jobKey} (${newConfig.type}, ${newConfig.cronExpression})`);
        try {
          const job = await createJob(newConfig);
          jobs.set(jobKey, { job, config: newConfig });
          createdJobs++;
        } catch (error: any) {
          log('ERROR', `Fehler beim Erstellen des Jobs ${jobKey}:`, error.message);
        }
      } else {
        // Prüfe, ob Config sich geändert hat
        if (existing.config.cronExpression !== newConfig.cronExpression) {
          log('INFO', `Aktualisiere Job: ${jobKey} (neue Cron-Expression: ${newConfig.cronExpression})`);
          existing.job.stop();
          try {
            const newJob = await createJob(newConfig);
            jobs.set(jobKey, { job: newJob, config: newConfig });
            updatedJobs++;
          } catch (error: any) {
            log('ERROR', `Fehler beim Aktualisieren des Jobs ${jobKey}:`, error.message);
          }
        }
      }
    }

    log('INFO', `Job-Refresh abgeschlossen: ${jobs.size} aktive Jobs (${createdJobs} erstellt, ${updatedJobs} aktualisiert)`);
  } catch (error: any) {
    log('ERROR', 'Fehler beim Job-Refresh:', error.message);
  }
}

/**
 * Startet den Cron-Service
 */
export async function startCronService() {
  log('INFO', 'Starte Cron-Service...');
  
  // Prüfe Service-Token beim Start
  const serviceToken = getServiceToken();
  if (serviceToken) {
    log('INFO', `Service-Token konfiguriert (${serviceToken.length} Zeichen)`);
  } else {
    log('WARN', 'Service-Token nicht gesetzt - E-Mail-Abruf wird fehlschlagen');
  }

  // Initialer Job-Load
  await refreshJobs();

  // Periodischer Refresh
  const refreshInterval = setInterval(refreshJobs, REFRESH_INTERVAL_MS);
  log('INFO', `Refresh-Intervall: ${REFRESH_INTERVAL_MS / 1000} Sekunden`);

  // Graceful Shutdown
  const shutdown = () => {
    log('INFO', 'Shutdown signalisiert, stoppe alle Jobs...');
    clearInterval(refreshInterval);

    for (const [jobKey, entry] of jobs.entries()) {
      log('INFO', `Stoppe Job: ${jobKey}`);
      entry.job.stop();
    }

    jobs.clear();
    log('INFO', 'Cron-Service beendet');
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  log('INFO', `Cron-Service gestartet mit ${jobs.size} Jobs`);
}

