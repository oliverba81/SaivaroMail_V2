/**
 * Tenant-DB-Pool: Thread-Safe Connection-Pool-Management
 * Verhindert Race Conditions bei paralleler Pool-Erstellung
 */

import { Pool } from 'pg';
import type { CompanyDbConfig } from '@/lib/scc-client';
import { ensureUsersTableSchema, ensureEmailReplyLocksTableSchema, ensureCompanyConfigTableSchema } from './tenant-db-migrations';

// Connection-Pools pro Company (wird nicht gecacht, da Pools persistent sind)
const dbPools = new Map<string, Pool>();

// Track, welche Companies bereits migriert wurden (um doppelte Migrationen zu vermeiden)
const migratedCompanies = new Set<string>();

// Mutex-Pattern: Verhindert doppelte Pool-Erstellung bei parallelen Requests
const poolCreationLocks = new Map<string, Promise<Pool>>();

/**
 * Validiert eine DB-Config
 */
export function validateDbConfig(dbConfig: CompanyDbConfig, companyId: string): void {
  // Stelle sicher, dass dbPassword ein String ist
  if (!dbConfig.dbPassword || typeof dbConfig.dbPassword !== 'string') {
    console.error(`❌ DB-Config für Company ${companyId}:`, {
      hasPassword: !!dbConfig.dbPassword,
      passwordType: typeof dbConfig.dbPassword,
      passwordValue: dbConfig.dbPassword ? '***' : 'null/undefined',
      dbHost: dbConfig.dbHost,
      dbUser: dbConfig.dbUser,
      dbName: dbConfig.dbName,
    });
    throw new Error(`Datenbank-Passwort für Company ${companyId} ist nicht verfügbar oder ungültig (Typ: ${typeof dbConfig.dbPassword})`);
  }

  // Stelle sicher, dass alle erforderlichen Felder vorhanden sind
  if (!dbConfig.dbHost || !dbConfig.dbUser || !dbConfig.dbName) {
    throw new Error(`Unvollständige DB-Config für Company ${companyId}`);
  }
}

/**
 * Erstellt oder gibt einen bestehenden Connection-Pool für eine Company zurück
 * Führt automatisch Schema-Migration beim ersten Erstellen des Pools durch
 * Thread-Safe: Verwendet Mutex-Pattern, um Race Conditions zu vermeiden
 */
export async function getOrCreatePool(companyId: string, dbConfig: CompanyDbConfig): Promise<Pool> {
  // 1. Prüfe ob Pool bereits existiert (schneller Pfad)
  if (dbPools.has(companyId)) {
    return dbPools.get(companyId)!;
  }

  // 2. Prüfe ob bereits ein Lock existiert (anderer Request erstellt Pool)
  let lockPromise = poolCreationLocks.get(companyId);
  if (lockPromise) {
    // Warte auf anderen Request
    return lockPromise;
  }

  // 3. Erstelle Lock-Promise
  lockPromise = (async () => {
    try {
      // Double-Check: Nochmal prüfen ob Pool existiert (könnte inzwischen von anderem Request erstellt worden sein)
      if (dbPools.has(companyId)) {
        return dbPools.get(companyId)!;
      }

      // 4. Validierung
      validateDbConfig(dbConfig, companyId);

      // 5. Pool erstellen
      const needsSsl = /require|verify/i.test(String(dbConfig.dbSslMode || ''));
      const pool = new Pool({
        host: String(dbConfig.dbHost),
        port: Number(dbConfig.dbPort) || 5432,
        database: String(dbConfig.dbName),
        user: String(dbConfig.dbUser),
        password: String(dbConfig.dbPassword), // Explizit als String casten
        ssl: needsSsl ? { rejectUnauthorized: false } : false,
        max: 20, // Max. Connections im Pool
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      });

      // 6. Migration mit Lock (verhindert doppelte Migrationen)
      if (!migratedCompanies.has(companyId)) {
        const migrationClient = await pool.connect();
        try {
          console.log(`🔄 [${companyId}] Führe Schema-Migration beim Pool-Erstellen durch...`);
          await ensureUsersTableSchema(migrationClient, companyId);
          await ensureEmailReplyLocksTableSchema(migrationClient, companyId);
          await ensureCompanyConfigTableSchema(migrationClient, companyId);
          migratedCompanies.add(companyId); // Set VOR Pool-Set
          console.log(`✅ [${companyId}] Schema-Migration erfolgreich abgeschlossen`);
        } catch (error: any) {
          console.error(`❌ [${companyId}] Fehler bei Schema-Migration:`, error);
          migrationClient.release();
          pool.end(); // Pool schließen, da Migration fehlgeschlagen ist
          throw new Error(`Datenbank-Schema-Migration fehlgeschlagen: ${error.message}`);
        } finally {
          migrationClient.release();
        }
      }

      // 7. Pool setzen (erst nach erfolgreicher Migration)
      dbPools.set(companyId, pool);
      return pool;
    } finally {
      // Lock entfernen (immer, auch bei Fehlern)
      poolCreationLocks.delete(companyId);
    }
  })();

  // Lock speichern
  poolCreationLocks.set(companyId, lockPromise);
  
  return lockPromise;
}

/**
 * Schließt alle aktiven Connection-Pools
 */
export async function closeAllPools(): Promise<void> {
  const closePromises: Promise<void>[] = [];
  
  for (const [companyId, pool] of dbPools.entries()) {
    console.log(`🔒 Schließe Pool für Company ${companyId}...`);
    closePromises.push(pool.end());
  }
  
  await Promise.all(closePromises);
  dbPools.clear();
  migratedCompanies.clear();
  console.log('✅ Alle Pools geschlossen');
}

