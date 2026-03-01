import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LogCronJobDto } from './dto/log-cron-job.dto';
import { CompaniesService } from '../companies/companies.service';
import { createTenantDbPool } from '../companies/database-helpers';
import { EncryptionService } from '../common/encryption.service';

@Injectable()
export class CronJobsService {
  constructor(
    private prisma: PrismaService,
    private companiesService: CompaniesService,
    private encryptionService: EncryptionService
  ) {}

  async logCronJob(dto: LogCronJobDto) {
    // Validiere Company
    const company = await this.prisma.company.findUnique({
      where: { id: dto.companyId },
    });

    if (!company) {
      throw new NotFoundException(`Company mit ID ${dto.companyId} nicht gefunden`);
    }

    // Validiere startedAt Datum
    const startedAtDate = new Date(dto.startedAt);
    if (isNaN(startedAtDate.getTime())) {
      throw new BadRequestException('Ungültiges Datum für startedAt');
    }

    // Wenn logId vorhanden, aktualisiere bestehenden Eintrag
    if (dto.logId) {
      // WICHTIG: Validiere, dass logId zur gleichen companyId gehört (Sicherheit)
      const existingLog = await this.prisma.cronJobLog.findUnique({
        where: { id: dto.logId },
        select: { companyId: true },
      });

      if (!existingLog) {
        throw new NotFoundException(`Log-Eintrag mit ID ${dto.logId} nicht gefunden`);
      }

      if (existingLog.companyId !== dto.companyId) {
        throw new ForbiddenException(`Log-Eintrag gehört nicht zur angegebenen Company`);
      }

      return await this.prisma.cronJobLog.update({
        where: { id: dto.logId },
        data: {
          status: dto.status,
          completedAt: dto.completedAt ? new Date(dto.completedAt) : null,
          executionTimeMs: dto.executionTimeMs,
          processedItems: dto.processedItems,
          errorMessage: dto.errorMessage,
          metadata: dto.metadata,
        },
      });
    }

    // Prüfe auf bestehenden Eintrag (Upsert-Logik)
    // WICHTIG: Prisma generiert den Constraint-Namen aus DB-Spaltennamen (snake_case)
    // Der tatsächliche Name ist: cron_job_logs_company_id_job_key_started_at_key
    // Aber Prisma verwendet camelCase für den WhereUniqueInput: companyId_jobKey_startedAt
    // Falls das nicht funktioniert, verwenden wir findFirst als Fallback
    let existing = null;

    try {
      // Versuche zuerst mit findUnique (Prisma sollte den Namen automatisch mappen)
      existing = await this.prisma.cronJobLog.findUnique({
        where: {
          companyId_jobKey_startedAt: {
            companyId: dto.companyId,
            jobKey: dto.jobKey,
            startedAt: startedAtDate,
          },
        },
      });
    } catch (error: any) {
      // Wenn findUnique fehlschlägt (z.B. P2019 - falscher Constraint-Name, oder Tabelle existiert nicht)
      // Verwende findFirst als Fallback
      if (
        error.code === 'P2019' ||
        error.code === 'P2003' ||
        error.message?.includes('does not exist') ||
        error.message?.includes('table') ||
        error.name === 'PrismaClientKnownRequestError'
      ) {
        // Fallback: Verwende findFirst (robuster, aber nicht atomar)
        try {
          existing = await this.prisma.cronJobLog.findFirst({
            where: {
              companyId: dto.companyId,
              jobKey: dto.jobKey,
              startedAt: startedAtDate,
            },
          });
        } catch (findFirstError: any) {
          // Wenn auch findFirst fehlschlägt (z.B. Tabelle existiert nicht), erstelle neuen Eintrag
          console.warn(
            '⚠️  findFirst fehlgeschlagen, erstelle neuen Eintrag:',
            findFirstError.message
          );
          existing = null;
        }
      } else {
        // Andere Fehler weiterwerfen
        throw error;
      }
    }

    if (existing) {
      // Aktualisiere bestehenden Eintrag
      return await this.prisma.cronJobLog.update({
        where: { id: existing.id },
        data: {
          status: dto.status,
          completedAt: dto.completedAt ? new Date(dto.completedAt) : null,
          executionTimeMs: dto.executionTimeMs,
          processedItems: dto.processedItems,
          errorMessage: dto.errorMessage,
          metadata: dto.metadata,
        },
      });
    }

    // Erstelle neuen Eintrag (wenn nicht vorhanden)
    try {
      return await this.prisma.cronJobLog.create({
        data: {
          companyId: dto.companyId,
          jobType: dto.jobType,
          jobKey: dto.jobKey,
          status: dto.status,
          startedAt: startedAtDate,
          completedAt: dto.completedAt ? new Date(dto.completedAt) : null,
          executionTimeMs: dto.executionTimeMs,
          processedItems: dto.processedItems,
          errorMessage: dto.errorMessage,
          metadata: dto.metadata,
        },
      });
    } catch (error: any) {
      // Prisma Error Code P2002: Unique constraint violation (Race Condition)
      // Eintrag wurde zwischenzeitlich von anderem Prozess erstellt, aktualisiere ihn
      if (error.code === 'P2002') {
        // Versuche mit findFirst (robuster als findUnique)
        const existing = await this.prisma.cronJobLog.findFirst({
          where: {
            companyId: dto.companyId,
            jobKey: dto.jobKey,
            startedAt: startedAtDate,
          },
        });

        if (existing) {
          return await this.prisma.cronJobLog.update({
            where: { id: existing.id },
            data: {
              status: dto.status,
              completedAt: dto.completedAt ? new Date(dto.completedAt) : null,
              executionTimeMs: dto.executionTimeMs,
              processedItems: dto.processedItems,
              errorMessage: dto.errorMessage,
              metadata: dto.metadata,
            },
          });
        }
      }
      throw error;
    }
  }

  async logCronJobsBatch(dtos: LogCronJobDto[]) {
    // Verwendet Prisma Transaction für atomare Operationen
    // Jeder Eintrag wird einzeln verarbeitet (kann Updates und Creates mischen)
    // Da logCronJob komplexe Upsert-Logik hat, führen wir die Operationen sequenziell aus
    const results = [];
    for (const dto of dtos) {
      try {
        const result = await this.logCronJob(dto);
        results.push(result);
      } catch (error: any) {
        // Bei Fehler: Logge und fahre mit nächstem Eintrag fort
        console.error(`Fehler beim Loggen von Cron-Job ${dto.jobKey}:`, error);
        results.push({ error: error.message });
      }
    }
    return results;
  }

  async getSystemLogs(
    companyId: string,
    filters: {
      logType?: string;
      jobType?: string;
      status?: string;
      limit?: number;
      offset?: number;
      startDate?: string;
      endDate?: string;
    }
  ) {
    // Validiere Company
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      include: { dbConfig: true },
    });

    if (!company) {
      throw new NotFoundException(`Company mit ID ${companyId} nicht gefunden`);
    }

    const limit = Math.min(filters.limit || 100, 1000);
    const offset = filters.offset || 0;

    // Sammle Logs aus verschiedenen Quellen
    const allLogs: Array<{
      id: string;
      logType: 'cron_job' | 'automation' | 'email_event';
      timestamp: Date;
      status?: string;
      message?: string;
      metadata?: any;
      [key: string]: any;
    }> = [];

    // 1. Cron-Job-Logs aus SCC-DB
    if (!filters.logType || filters.logType === 'cron_job') {
      const where: any = {
        companyId,
      };

      if (filters.jobType) {
        where.jobType = filters.jobType;
      }

      if (filters.status) {
        where.status = filters.status;
      }

      if (filters.startDate || filters.endDate) {
        where.startedAt = {};
        if (filters.startDate) {
          where.startedAt.gte = new Date(filters.startDate);
        }
        if (filters.endDate) {
          where.startedAt.lte = new Date(filters.endDate);
        }
      }

      const cronJobLogs = await this.prisma.cronJobLog.findMany({
        where,
        orderBy: {
          createdAt: 'desc',
        },
        take: 1000, // Mehr holen, da wir filtern werden
      });

      allLogs.push(
        ...cronJobLogs.map((log) => ({
          id: log.id,
          logType: 'cron_job' as const,
          timestamp: log.startedAt,
          status: log.status,
          jobType: log.jobType,
          jobKey: log.jobKey,
          executionTimeMs: log.executionTimeMs,
          processedItems: log.processedItems,
          errorMessage: log.errorMessage,
          completedAt: log.completedAt,
          metadata: log.metadata,
        }))
      );
    }

    // 2. Automation-Logs aus Tenant-DB (wenn DB bereit ist)
    if (
      company.dbConfig?.provisioningStatus === 'ready' &&
      (!filters.logType || filters.logType === 'automation')
    ) {
      try {
        const pool = await createTenantDbPool({
          dbHost: company.dbConfig.dbHost,
          dbPort: company.dbConfig.dbPort,
          dbName: company.dbConfig.dbName,
          dbUser: company.dbConfig.dbUser,
          dbPassword: this.encryptionService.decrypt(company.dbConfig.dbPassword),
          dbSslMode: company.dbConfig.dbSslMode,
        });

        try {
          let query = `
            SELECT 
              id,
              rule_id,
              user_id,
              email_id,
              trigger_type,
              status,
              execution_time_ms,
              error_message,
              executed_actions,
              created_at
            FROM automation_execution_logs
            WHERE 1=1
          `;

          const params: any[] = [];
          let paramIndex = 1;

          if (filters.status) {
            query += ` AND status = $${paramIndex}`;
            params.push(filters.status);
            paramIndex++;
          }

          if (filters.startDate) {
            query += ` AND created_at >= $${paramIndex}`;
            params.push(new Date(filters.startDate));
            paramIndex++;
          }

          if (filters.endDate) {
            query += ` AND created_at <= $${paramIndex}`;
            params.push(new Date(filters.endDate));
            paramIndex++;
          }

          query += ` ORDER BY created_at DESC LIMIT 500`;

          const result = await pool.query(query, params);

          allLogs.push(
            ...result.rows.map((row) => ({
              id: row.id,
              logType: 'automation' as const,
              timestamp: row.created_at,
              status: row.status,
              ruleId: row.rule_id,
              userId: row.user_id,
              emailId: row.email_id,
              triggerType: row.trigger_type,
              executionTimeMs: row.execution_time_ms,
              errorMessage: row.error_message,
              executedActions: row.executed_actions,
            }))
          );
        } finally {
          await pool.end();
        }
      } catch (error: any) {
        // Fehler beim Abrufen der Automation-Logs ist nicht kritisch
        console.warn(`[SystemLogs] Fehler beim Abrufen der Automation-Logs: ${error.message}`);
      }
    }

    // 3. E-Mail-Events aus Tenant-DB (optional, wenn gewünscht)
    // Diese sind sehr zahlreich, daher nur bei expliziter Anfrage
    if (company.dbConfig?.provisioningStatus === 'ready' && filters.logType === 'email_event') {
      try {
        const pool = await createTenantDbPool({
          dbHost: company.dbConfig.dbHost,
          dbPort: company.dbConfig.dbPort,
          dbName: company.dbConfig.dbName,
          dbUser: company.dbConfig.dbUser,
          dbPassword: this.encryptionService.decrypt(company.dbConfig.dbPassword),
          dbSslMode: company.dbConfig.dbSslMode,
        });

        try {
          let query = `
            SELECT 
              id,
              email_id,
              user_id,
              event_type,
              event_data,
              created_at
            FROM email_events
            WHERE 1=1
          `;

          const params: any[] = [];
          let paramIndex = 1;

          if (filters.startDate) {
            query += ` AND created_at >= $${paramIndex}`;
            params.push(new Date(filters.startDate));
            paramIndex++;
          }

          if (filters.endDate) {
            query += ` AND created_at <= $${paramIndex}`;
            params.push(new Date(filters.endDate));
            paramIndex++;
          }

          query += ` ORDER BY created_at DESC LIMIT 200`;

          const result = await pool.query(query, params);

          allLogs.push(
            ...result.rows.map((row) => ({
              id: row.id,
              logType: 'email_event' as const,
              timestamp: row.created_at,
              eventType: row.event_type,
              emailId: row.email_id,
              userId: row.user_id,
              eventData: row.event_data,
            }))
          );
        } finally {
          await pool.end();
        }
      } catch (error: any) {
        console.warn(`[SystemLogs] Fehler beim Abrufen der E-Mail-Events: ${error.message}`);
      }
    }

    // Sortiere alle Logs nach Timestamp (neueste zuerst)
    allLogs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    // Pagination
    const total = allLogs.length;
    const paginatedLogs = allLogs.slice(offset, offset + limit);

    return {
      logs: paginatedLogs,
      total,
      limit,
      offset,
    };
  }

  // Alias für Rückwärtskompatibilität
  async getCronJobLogs(
    companyId: string,
    filters: {
      jobType?: string;
      status?: string;
      limit?: number;
      offset?: number;
      startDate?: string;
      endDate?: string;
    }
  ) {
    return this.getSystemLogs(companyId, {
      logType: 'cron_job',
      ...filters,
    });
  }
}
