/**
 * SCC-Client: Lädt CompanyDbConfig aus der zentralen SCC-Datenbank
 * Nutzt direkte PostgreSQL-Verbindung (kein Prisma, da wir kein Schema hier haben)
 */

import { Pool } from 'pg';
import * as crypto from 'crypto';

/** DB-Konfiguration einer Company (entspricht @saivaro/shared CompanyDbConfig) */
export interface CompanyDbConfig {
  id: string;
  companyId: string;
  dbHost: string;
  dbPort: number;
  dbName: string;
  dbUser: string;
  dbPassword?: string;
  dbSslMode: string;
  provisioningStatus: string;
  healthStatus: string;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, unknown>;
}

// Connection-Pool für SCC-DB (nur erstellen, wenn SCC_DATABASE_URL gesetzt ist)
let sccPool: Pool | null = null;

function getSccPool(): Pool {
  if (!sccPool) {
    if (!process.env.SCC_DATABASE_URL) {
      throw new Error('SCC_DATABASE_URL ist nicht gesetzt. Bitte in .env konfigurieren.');
    }
    let connectionString = process.env.SCC_DATABASE_URL;
    const useSsl = /sslmode=require/i.test(connectionString) || /sslmode=verify-full/i.test(connectionString);
    // sslmode in Connection-String überschreibt ssl-Config (node-postgres #2375) – entfernen, SSL separat setzen
    connectionString = connectionString
      .replace(/[?&]sslmode=[^&]*/gi, '')
      .replace(/\?&/, '?')
      .replace(/&$/, '')
      .replace(/\?$/, '');
    sccPool = new Pool({
      connectionString,
      max: 10,
      ...(useSsl && {
        ssl: { rejectUnauthorized: false },
      }),
    });
  }
  return sccPool;
}

/**
 * Entschlüsselt ein verschlüsseltes Passwort (Fallback, wenn SCC-API nicht erreichbar ist)
 * Verwendet die gleiche Logik wie der EncryptionService im SCC-Backend
 */
function decryptPassword(encryptedText: string): string {
  const encryptionKey = process.env.ENCRYPTION_KEY || 'dev-encryption-key-change-in-production-min-32-chars';
  const parts = encryptedText.split(':');

  if (parts.length !== 4) {
    throw new Error('Ungültiges Verschlüsselungsformat');
  }

  const [saltHex, ivHex, tagHex, encrypted] = parts;
  const salt = Buffer.from(saltHex, 'hex');
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');

  // Key-Derivation mit PBKDF2
  const key = crypto.pbkdf2Sync(
    encryptionKey,
    salt,
    100000, // Iterations
    32, // keyLength
    'sha256',
  );

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/** Default SCC-API-URL (127.0.0.1 statt localhost, um IPv6-Probleme unter Windows zu vermeiden) */
const DEFAULT_SCC_API_URL = 'http://127.0.0.1:3001/api';

/**
 * Führt fetch aus, bei ECONNREFUSED/fetch failed einmal nach kurzer Wartezeit erneut (SCC startet ggf. nach Mailclient).
 */
async function fetchWithRetry(url: string, options: RequestInit, retryDelayMs = 1500): Promise<Response> {
  try {
    return await fetch(url, options);
  } catch (firstErr: any) {
    const isConnectionError = firstErr?.message?.includes('fetch failed') ||
      firstErr?.cause?.code === 'ECONNREFUSED' ||
      (firstErr?.cause && Array.isArray(firstErr.cause?.errors));
    if (!isConnectionError) throw firstErr;
    await new Promise((r) => setTimeout(r, retryDelayMs));
    return fetch(url, options);
  }
}

/**
 * Lädt DB-Config für eine Company aus der SCC-DB
 * @param companyId UUID der Company
 * @returns DB-Config oder null wenn nicht gefunden
 */
export async function getCompanyDbConfig(
  companyId: string
): Promise<CompanyDbConfig | null> {
  const sccApiUrl = process.env.SCC_API_URL || DEFAULT_SCC_API_URL;
  try {
    const response = await fetchWithRetry(
      `${sccApiUrl}/companies/${companyId}/db-config/with-password`,
      {
        headers: {
          'Authorization': `Bearer ${process.env.SCC_API_TOKEN || ''}`,
        },
      }
    );

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('SCC-API-Authentifizierung fehlgeschlagen. Bitte SCC_API_TOKEN in .env setzen oder SCC-Backend konfigurieren.');
      }
      throw new Error(`SCC-API Fehler: ${response.status} ${response.statusText}`);
    }

    const dbConfig = await response.json();
    
    // Stelle sicher, dass dbPassword ein String ist
    if (!dbConfig.dbPassword || typeof dbConfig.dbPassword !== 'string') {
      throw new Error('Datenbank-Passwort ist nicht verfügbar oder ungültig');
    }

    // Lade Company metadata separat
    const pool = getSccPool();
    const companyResult = await pool.query(
      `SELECT metadata FROM companies WHERE id = $1`,
      [companyId]
    );
    const companyMetadata = companyResult.rows[0]?.metadata || {};

    return {
      id: dbConfig.id,
      companyId: dbConfig.companyId || companyId,
      dbHost: dbConfig.dbHost,
      dbPort: dbConfig.dbPort,
      dbName: dbConfig.dbName,
      dbUser: dbConfig.dbUser,
      dbPassword: dbConfig.dbPassword, // Entschlüsselt von SCC-API
      dbSslMode: dbConfig.dbSslMode,
      provisioningStatus: dbConfig.provisioningStatus,
      healthStatus: dbConfig.healthStatus,
      createdAt: dbConfig.createdAt || new Date().toISOString(),
      updatedAt: dbConfig.updatedAt || new Date().toISOString(),
      metadata: companyMetadata,
    };
  } catch (error: any) {
    console.error('Fehler beim Laden der DB-Config über SCC-API:', error);
    
      // Fallback: Versuche direkt aus DB zu laden und Passwort zu entschlüsseln
      if (error.message?.includes('fetch failed') || error.message?.includes('ECONNREFUSED')) {
        console.warn('⚠️  SCC-API nicht erreichbar, verwende Fallback: Direkter DB-Zugriff mit Entschlüsselung');
        
        try {
          const pool = getSccPool();
          const result = await pool.query(
          `SELECT 
            id, "companyId", "dbHost", "dbPort", "dbName", "dbUser", "dbPassword", 
            "dbSslMode", "provisioningStatus", "healthStatus", "createdAt", "updatedAt"
           FROM company_db_configs
           WHERE "companyId" = $1`,
          [companyId]
        );

        if (result.rows.length === 0) {
          return null;
        }

        const row = result.rows[0];
        
        // Lade Company metadata
        const companyResult = await pool.query(
          `SELECT metadata FROM companies WHERE id = $1`,
          [companyId]
        );
        const companyMetadata = companyResult.rows[0]?.metadata || {};
        
        // Prüfe, ob Passwort vorhanden ist
        if (!row.dbPassword || typeof row.dbPassword !== 'string') {
          throw new Error('Datenbank-Passwort ist nicht verfügbar oder ungültig');
        }

        // Passwort entschlüsseln
        let decryptedPassword: string;
        try {
          decryptedPassword = decryptPassword(row.dbPassword);
        } catch (decryptError: any) {
          throw new Error(`Fehler beim Entschlüsseln des Passworts: ${decryptError.message}`);
        }

        return {
          id: row.id,
          companyId: row.companyId,
          dbHost: row.dbHost,
          dbPort: row.dbPort,
          dbName: row.dbName,
          dbUser: row.dbUser,
          dbPassword: decryptedPassword,
          dbSslMode: row.dbSslMode,
          provisioningStatus: row.provisioningStatus as any,
          healthStatus: row.healthStatus as any,
          createdAt: row.createdAt?.toISOString() || new Date().toISOString(),
          updatedAt: row.updatedAt?.toISOString() || new Date().toISOString(),
          metadata: companyMetadata,
        };
      } catch (fallbackError: any) {
        throw new Error(`Fehler beim Laden der DB-Config (Fallback): ${fallbackError.message}`);
      }
    }
    
    throw new Error(`Fehler beim Laden der DB-Config: ${error.message || 'Unbekannter Fehler'}`);
  }
}

/**
 * Lädt nur die Company-ID anhand des Slugs (leichte SCC-DB-Abfrage, kein API-Call)
 * @param companySlug Slug der Company (z. B. "acme-corp")
 * @returns Company-ID oder null wenn nicht gefunden
 */
export async function getCompanyIdBySlug(companySlug: string): Promise<string | null> {
  const pool = getSccPool();
  const result = await pool.query(`SELECT id FROM companies WHERE slug = $1`, [companySlug]);
  return result.rows.length > 0 ? result.rows[0].id : null;
}

/**
 * Lädt DB-Config für eine Company anhand des Slugs
 * @param companySlug Slug der Company (z. B. "acme-corp")
 * @returns DB-Config oder null wenn nicht gefunden
 */
export async function getCompanyDbConfigBySlug(
  companySlug: string
): Promise<CompanyDbConfig | null> {
  // Lade Company-ID und metadata zuerst
  const pool = getSccPool();
  const companyResult = await pool.query(
    `SELECT id, metadata FROM companies WHERE slug = $1`,
    [companySlug]
  );

  if (companyResult.rows.length === 0) {
    return null;
  }

  const companyId = companyResult.rows[0].id;
  const companyMetadata = companyResult.rows[0].metadata || {};

  // Lade DB-Config mit entschlüsseltem Passwort über SCC-API
  const sccApiUrl = process.env.SCC_API_URL || DEFAULT_SCC_API_URL;
  try {
    const response = await fetch(`${sccApiUrl}/companies/${companyId}/db-config/with-password`, {
      headers: {
        'Authorization': `Bearer ${process.env.SCC_API_TOKEN || ''}`, // Optional, falls Auth benötigt wird
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        console.warn('⚠️  SCC-API-Authentifizierung fehlgeschlagen, verwende Fallback');
      } else {
        console.error(`SCC-API Fehler: ${response.status} ${response.statusText}`);
      }
      // Fallback: Versuche direkt aus DB zu laden (mit Entschlüsselung)
      return await getCompanyDbConfig(companyId);
    }

    const dbConfig = await response.json();
    
    // Stelle sicher, dass dbPassword ein String ist
    if (!dbConfig.dbPassword || typeof dbConfig.dbPassword !== 'string') {
      throw new Error('Datenbank-Passwort ist nicht verfügbar oder ungültig');
    }

    return {
      id: dbConfig.id,
      companyId: dbConfig.companyId || companyId,
      dbHost: dbConfig.dbHost,
      dbPort: dbConfig.dbPort,
      dbName: dbConfig.dbName,
      dbUser: dbConfig.dbUser,
      dbPassword: dbConfig.dbPassword, // Entschlüsselt von SCC-API
      dbSslMode: dbConfig.dbSslMode,
      provisioningStatus: dbConfig.provisioningStatus,
      healthStatus: dbConfig.healthStatus,
      createdAt: dbConfig.createdAt || new Date().toISOString(),
      updatedAt: dbConfig.updatedAt || new Date().toISOString(),
      metadata: companyMetadata, // Company metadata für maxEmailsPerPage
    };
  } catch (error: any) {
    console.error('Fehler beim Laden der DB-Config über SCC-API:', error);
    // Fallback: Versuche direkt aus DB zu laden (mit Entschlüsselung)
    if (error.message?.includes('fetch failed') || error.message?.includes('ECONNREFUSED')) {
      console.warn('⚠️  SCC-API nicht erreichbar, verwende Fallback: Direkter DB-Zugriff mit Entschlüsselung');
    }
    const fallbackConfig = await getCompanyDbConfig(companyId);
    if (fallbackConfig) {
      return { ...fallbackConfig, metadata: companyMetadata };
    }
    return null;
  }
}

export interface CompanyContact {
  name: string;
  contactAddress: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  contactWebsite: string | null;
}

/**
 * Lädt Kontaktdaten einer Company aus der SCC-API (für Signatur-Platzhalter).
 * @param companyId UUID der Company
 * @returns Kontaktdaten oder null wenn nicht gefunden
 */
export async function getCompanyContact(companyId: string): Promise<CompanyContact | null> {
  const sccApiUrl = process.env.SCC_API_URL || DEFAULT_SCC_API_URL;
  try {
    const response = await fetch(`${sccApiUrl}/companies/${companyId}`, {
      headers: {
        Authorization: `Bearer ${process.env.SCC_API_TOKEN || ''}`,
      },
    });
    if (!response.ok) {
      try {
        const dbResult = await getCompanyContactFromDb(companyId);
        if (dbResult) return dbResult;
      } catch {
        // DB-Fallback fehlgeschlagen
      }
      if (response.status === 404) return null;
      throw new Error(`SCC-API Fehler: ${response.status} ${response.statusText}`);
    }
    const company = await response.json();
    // SCC-API kann camelCase oder snake_case liefern
    return {
      name: company.name ?? '',
      contactAddress: company.contactAddress ?? company.contact_address ?? null,
      contactPhone: company.contactPhone ?? company.contact_phone ?? null,
      contactEmail: company.contactEmail ?? company.contact_email ?? null,
      contactWebsite: company.contactWebsite ?? company.contact_website ?? null,
    };
  } catch (error: any) {
    console.error('Fehler beim Laden der Company-Kontaktdaten über SCC-API:', error);
    if (error.message?.includes('fetch failed') || error.message?.includes('ECONNREFUSED')) {
      try {
        return await getCompanyContactFromDb(companyId);
      } catch {
        return null;
      }
    }
    return null;
  }
}

/**
 * Lädt Kontaktdaten einer Company anhand des Slugs (für Signatur-Platzhalter).
 */
export async function getCompanyContactBySlug(companySlug: string): Promise<CompanyContact | null> {
  try {
    if (!process.env.SCC_DATABASE_URL) return null;
    const pool = getSccPool();
    const row = await pool.query(
      `SELECT id FROM companies WHERE slug = $1`,
      [companySlug]
    );
    if (row.rows.length === 0) return null;
    const companyId = row.rows[0].id;
    return getCompanyContact(companyId);
  } catch (error: any) {
    console.error('Fehler beim Laden der Company-Kontaktdaten by Slug:', error);
    return null;
  }
}

async function getCompanyContactFromDb(companyId: string): Promise<CompanyContact | null> {
  if (!process.env.SCC_DATABASE_URL) return null;
  const pool = getSccPool();
  const result = await pool.query(
    `SELECT name, "contactAddress", "contactPhone", "contactEmail", "contactWebsite" FROM companies WHERE id = $1`,
    [companyId]
  );
  if (result.rows.length === 0) return null;
  const row = result.rows[0];
  return {
    name: row.name ?? '',
    contactAddress: row.contactAddress ?? row.contact_address ?? null,
    contactPhone: row.contactPhone ?? row.contact_phone ?? null,
    contactEmail: row.contactEmail ?? row.contact_email ?? null,
    contactWebsite: row.contactWebsite ?? row.contact_website ?? null,
  };
}

/**
 * Lädt alle Companies mit provisioningStatus = 'ready'
 * Versucht zuerst SCC-API, fallback auf direkten DB-Zugriff
 */
export async function getAllCompanies(): Promise<string[]> {
  const sccApiUrl = process.env.SCC_API_URL || DEFAULT_SCC_API_URL;
  
  try {
    // Timeout-Handling (kompatibel mit älteren Node.js-Versionen)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 Sekunden
    
    const response = await fetch(`${sccApiUrl}/companies/ready`, {
      headers: {
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`SCC-API Fehler: ${response.status} ${response.statusText}`);
    }

    const companies = await response.json();
    return companies.map((c: { id: string }) => c.id);
  } catch (error: any) {
    console.error('Fehler beim Laden der Companies über SCC-API:', error);
    
    // Fallback: Direkter DB-Zugriff
    if (
      error.name === 'AbortError' ||
      error.message?.includes('fetch failed') || 
      error.message?.includes('ECONNREFUSED') ||
      error.message?.includes('network') ||
      error.cause?.code === 'ECONNREFUSED'
    ) {
      console.warn('⚠️  SCC-API nicht erreichbar, verwende Fallback: Direkter DB-Zugriff');
      try {
        return await getAllCompaniesFromDb();
      } catch (fallbackError: any) {
        // Wenn auch Fallback fehlschlägt, gebe leere Liste zurück (Service läuft weiter)
        console.warn('⚠️  Fallback fehlgeschlagen, gebe leere Liste zurück:', fallbackError.message);
        return [];
      }
    }
    
    throw error;
  }
}

// Fallback-Funktion (verwendet bestehenden sccPool aus scc-client.ts)
async function getAllCompaniesFromDb(): Promise<string[]> {
  try {
    // Prüfe, ob SCC_DATABASE_URL gesetzt ist
    if (!process.env.SCC_DATABASE_URL) {
      console.warn('⚠️  SCC_DATABASE_URL ist nicht gesetzt, kann keine Companies laden');
      return [];
    }

    const pool = getSccPool();
    const result = await pool.query(
      `SELECT c.id 
       FROM companies c 
       INNER JOIN company_db_configs cdc ON c.id = cdc."companyId" 
       WHERE cdc."provisioningStatus" = 'ready' AND c.status = 'active'
       ORDER BY c."createdAt" DESC`
    );
    return result.rows.map((row) => row.id);
  } catch (error: any) {
    console.error('Fehler beim direkten DB-Zugriff:', error);
    
    // Wenn es ein Passwort-Fehler ist, gebe leere Liste zurück (Service läuft weiter)
    if (error.message?.includes('password must be a string') || error.message?.includes('SASL')) {
      console.warn('⚠️  SCC-DB-Verbindung fehlgeschlagen (Passwort-Problem), gebe leere Liste zurück');
      return [];
    }
    
    throw new Error(`Fehler beim Laden der Companies: ${error.message}`);
  }
}

