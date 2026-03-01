/**
 * Tenant-DB-Client: Verwaltet dynamische DB-Verbindungen zu Tenant-Datenbanken
 * Mit Connection-Pooling pro Company und Thread-Safe Caching
 * 
 * Diese Datei ist eine dünne Orchestrierungsschicht, die die folgenden Module nutzt:
 * - tenant-db-cache.ts: Thread-Safe Cache-Management
 * - tenant-db-pool.ts: Thread-Safe Connection-Pool-Management
 * - tenant-db-migrations.ts: Schema-Migrationen
 */

import { PoolClient } from 'pg';
import { getCompanyDbConfig, getCompanyDbConfigBySlug } from './scc-client';
import { 
  getCachedOrLoadDbConfig, 
  invalidateDbConfigCache as invalidateCache,
  getCacheKeyForCompanyId,
  getCacheKeyForCompanySlug
} from './tenant-db-cache';
import { getOrCreatePool, closeAllPools as closePools } from './tenant-db-pool';

/**
 * Lädt DB-Config (mit Caching) und gibt einen DB-Client zurück
 */
export async function getTenantDbClient(
  companyId: string
): Promise<PoolClient> {
  // 1. Config mit Thread-Safe Caching laden
  const cacheKey = getCacheKeyForCompanyId(companyId);
  const dbConfig = await getCachedOrLoadDbConfig(
    cacheKey,
    () => getCompanyDbConfig(companyId),
    companyId
  );

  // 2. Pool erstellen/abrufen (Migration wird automatisch beim Pool-Erstellen durchgeführt)
  const pool = await getOrCreatePool(companyId, dbConfig);

  // 3. Client aus Pool holen
  return pool.connect();
}

/**
 * Lädt DB-Config anhand des Company-Slugs
 */
export async function getTenantDbClientBySlug(
  companySlug: string
): Promise<PoolClient> {
  // 1. Config mit Thread-Safe Caching laden (über Slug)
  const cacheKey = getCacheKeyForCompanySlug(companySlug);
  const dbConfig = await getCachedOrLoadDbConfig(
    cacheKey,
    () => getCompanyDbConfigBySlug(companySlug)
    // companyId wird automatisch aus dbConfig geholt
  );

  // 2. Pool erstellen/abrufen (Migration wird automatisch beim Pool-Erstellen durchgeführt)
  const pool = await getOrCreatePool(dbConfig.companyId, dbConfig);

  // 3. Client aus Pool holen
  return pool.connect();
}

/**
 * Invalidiert den Cache für eine Company (wenn DB-Config geändert wurde)
 * Verwendet Key-Tracking für vollständige Invalidierung
 */
export function invalidateDbConfigCache(companyId: string): void {
  invalidateCache(companyId);
}

/**
 * Schließt alle Pools (beim Shutdown)
 */
export async function closeAllPools(): Promise<void> {
  await closePools();
}
