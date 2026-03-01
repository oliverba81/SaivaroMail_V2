/**
 * Cron-Job-Logger: Sendet Log-Einträge an SCC-API
 * Mit Retry-Mechanismus und Fallback
 */

export interface LogCronJobDto {
  companyId: string;
  jobType: 'scheduled_trigger' | 'email_fetch';
  jobKey: string;
  status: 'running' | 'success' | 'failed';
  startedAt: string; // ISO-Date-String
  completedAt?: string; // ISO-Date-String
  executionTimeMs?: number;
  processedItems?: number;
  errorMessage?: string;
  metadata?: Record<string, any>;
  logId?: string; // Für Updates
}

export interface LogCronJobResponse {
  id: string;
  companyId: string;
  jobType: string;
  jobKey: string;
  status: string;
  startedAt: string;
  createdAt: string;
}

/**
 * Sendet einen Cron-Job-Log an die SCC-API
 * @param dto Log-Daten
 * @returns Log-Response oder null bei Fehler
 */
export async function logCronJobToScc(
  dto: LogCronJobDto
): Promise<LogCronJobResponse | null> {
  const sccApiUrl = process.env.SCC_API_URL || 'http://localhost:3001/api';
  const maxRetries = 2;
  const timeout = 5000; // 5 Sekunden

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Timeout-Handling
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(`${sccApiUrl}/system-logs/log`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(dto),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        if (attempt < maxRetries) {
          // Retry bei Fehlern (außer 4xx)
          if (response.status >= 400 && response.status < 500) {
            // 4xx-Fehler werden nicht retried
            console.warn(`⚠️  SCC-API Fehler (kein Retry): ${response.status} ${response.statusText}`);
            return null;
          }
          // Warte kurz vor Retry
          await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
          continue;
        }
        throw new Error(`SCC-API Fehler: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();

      // Validiere Response
      if (!result || !result.id) {
        throw new Error('Ungültige Response von SCC-API: id fehlt');
      }

      return result as LogCronJobResponse;
    } catch (error: any) {
      // Prüfe, ob es ein Netzwerk-Fehler ist
      if (
        error.name === 'AbortError' ||
        error.message?.includes('fetch failed') ||
        error.message?.includes('ECONNREFUSED') ||
        error.message?.includes('network')
      ) {
        if (attempt < maxRetries) {
          // Retry bei Netzwerk-Fehlern
          console.warn(`⚠️  Netzwerk-Fehler beim Loggen (Versuch ${attempt}/${maxRetries}), retry...`);
          await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
          continue;
        }
      }

      // Bei letzten Versuch oder anderen Fehlern: Logge lokal und gebe null zurück
      console.warn(`⚠️  Fehler beim Loggen des Cron-Jobs (Versuch ${attempt}/${maxRetries}):`, error.message);
      
      if (attempt === maxRetries) {
        // Lokales Logging als Fallback
        console.log(`[CronJobLog] ${dto.companyId} | ${dto.jobType} | ${dto.jobKey} | ${dto.status} | ${dto.startedAt}`);
        return null;
      }
    }
  }

  return null;
}

/**
 * Sendet mehrere Cron-Job-Logs in einem Batch an die SCC-API
 * @param dtos Array von Log-Daten
 * @returns Array von Log-Responses
 */
export async function logCronJobsBatchToScc(
  dtos: LogCronJobDto[]
): Promise<Array<LogCronJobResponse | null>> {
  const sccApiUrl = process.env.SCC_API_URL || 'http://localhost:3001/api';
  const timeout = 10000; // 10 Sekunden für Batch

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(`${sccApiUrl}/system-logs/logs/batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(dtos),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`SCC-API Fehler: ${response.status} ${response.statusText}`);
    }

    const results = await response.json();
    return results as LogCronJobResponse[];
  } catch (error: any) {
    console.warn(`⚠️  Fehler beim Batch-Logging:`, error.message);
    // Fallback: Logge einzeln
    return Promise.all(dtos.map((dto) => logCronJobToScc(dto)));
  }
}

