/**
 * Tenant-DB-Cache: Thread-Safe Cache-Management für DB-Configs
 * Verhindert Race Conditions beim parallelen Laden von Configs
 */

import NodeCache from 'node-cache';
import type { CompanyDbConfig } from '@/lib/scc-client';

// Cache für DB-Configs (5 Minuten TTL)
const dbConfigCache = new NodeCache({ stdTTL: 300, checkperiod: 60 });

// Mutex-Pattern: Verhindert doppelte Config-Loads bei parallelen Requests
const cacheLoadLocks = new Map<string, Promise<CompanyDbConfig>>();

// Key-Tracking: Track alle Cache-Keys pro Company für vollständige Invalidierung
const cacheKeyMapping = new Map<string, Set<string>>(); // companyId -> Set<cacheKeys>

/**
 * Lädt eine DB-Config mit Thread-Safe Caching
 * Verwendet Mutex-Pattern, um Race Conditions zu vermeiden
 * @param cacheKey Der Cache-Key für diese Config
 * @param loader Funktion zum Laden der Config
 * @param companyId Optional: Company-ID (wird aus Config geholt, wenn nicht angegeben)
 */
export async function getCachedOrLoadDbConfig(
  cacheKey: string,
  loader: () => Promise<CompanyDbConfig | null>,
  companyId?: string
): Promise<CompanyDbConfig> {
  // 1. Prüfe Cache (schneller Pfad)
  let dbConfig: CompanyDbConfig | undefined | null = dbConfigCache.get<CompanyDbConfig>(cacheKey);
  if (dbConfig) {
    return dbConfig;
  }

  // 2. Prüfe ob bereits ein Lock existiert (anderer Request lädt Config)
  let lockPromise = cacheLoadLocks.get(cacheKey);
  if (lockPromise) {
    // Warte auf anderen Request
    return lockPromise;
  }

  // 3. Erstelle Lock-Promise
  lockPromise = (async () => {
    try {
      // Double-Check: Nochmal Cache prüfen (könnte inzwischen von anderem Request gesetzt worden sein)
      dbConfig = dbConfigCache.get<CompanyDbConfig>(cacheKey);
      if (dbConfig) {
        return dbConfig;
      }

      // 4. Config laden
      dbConfig = await loader();
      if (!dbConfig) {
        throw new Error('DB-Config nicht gefunden');
      }

      // 5. Validierung
      if (dbConfig.provisioningStatus !== 'ready') {
        throw new Error(`DB noch nicht bereit: ${dbConfig.provisioningStatus}`);
      }

      // 6. Hole companyId aus Config, falls nicht angegeben
      const finalCompanyId = companyId || dbConfig.companyId;
      if (!finalCompanyId) {
        throw new Error('Company-ID nicht verfügbar');
      }

      // 7. Cache setzen
      dbConfigCache.set(cacheKey, dbConfig);
      
      // 8. Track Cache-Keys für Company (für vollständige Invalidierung)
      if (!cacheKeyMapping.has(finalCompanyId)) {
        cacheKeyMapping.set(finalCompanyId, new Set());
      }
      cacheKeyMapping.get(finalCompanyId)!.add(cacheKey);

      // 9. Wenn Config über Slug geladen wurde, cache auch mit companyId
      if (cacheKey.startsWith('dbconfig:slug:')) {
        const companyIdKey = `dbconfig:${finalCompanyId}`;
        dbConfigCache.set(companyIdKey, dbConfig);
        cacheKeyMapping.get(finalCompanyId)!.add(companyIdKey);
      }

      return dbConfig;
    } finally {
      // Lock entfernen (immer, auch bei Fehlern)
      cacheLoadLocks.delete(cacheKey);
    }
  })();

  // Lock speichern
  cacheLoadLocks.set(cacheKey, lockPromise);
  
  return lockPromise;
}

/**
 * Invalidiert alle Cache-Einträge für eine Company
 * Verwendet Key-Tracking für vollständige Invalidierung
 */
export function invalidateDbConfigCache(companyId: string): void {
  // Lösche alle Cache-Keys für diese Company
  const keys = cacheKeyMapping.get(companyId);
  if (keys) {
    keys.forEach(key => dbConfigCache.del(key));
    cacheKeyMapping.delete(companyId);
  }
  
  // Lösche auch direkt mit companyId (falls nicht getrackt)
  dbConfigCache.del(`dbconfig:${companyId}`);
}

/**
 * Gibt den Cache-Key für eine Company-ID zurück
 */
export function getCacheKeyForCompanyId(companyId: string): string {
  return `dbconfig:${companyId}`;
}

/**
 * Gibt den Cache-Key für einen Company-Slug zurück
 */
export function getCacheKeyForCompanySlug(companySlug: string): string {
  return `dbconfig:slug:${companySlug}`;
}

