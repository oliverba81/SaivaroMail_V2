import { Pool } from 'pg';
import { BadRequestException } from '@nestjs/common';

/**
 * Leitet Host/Port/SSL aus DATABASE_URL ab (für Remote-DBs wie Hetzner)
 */
function getEffectiveDbConfig(dbConfig: {
  dbHost: string;
  dbPort: number;
  dbName: string;
  dbUser: string;
  dbPassword: string;
  dbSslMode: string;
}) {
  if (
    (dbConfig.dbHost === 'localhost' || dbConfig.dbHost === '127.0.0.1') &&
    process.env.DATABASE_URL
  ) {
    try {
      const url = new URL(process.env.DATABASE_URL);
      if (url.hostname && url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') {
        return {
          ...dbConfig,
          dbHost: url.hostname,
          dbPort: url.port ? parseInt(url.port, 10) : dbConfig.dbPort,
          dbSslMode: url.searchParams.get('sslmode') === 'require' ? 'require' : dbConfig.dbSslMode,
        };
      }
    } catch (_) {}
  }
  return dbConfig;
}

/**
 * Validiert einen Tabellennamen gegen Whitelist (nur alphanumerisch + Unterstrich)
 */
export function validateTableName(tableName: string): boolean {
  return /^[a-zA-Z0-9_]+$/.test(tableName);
}

/**
 * Erstellt einen DB-Pool für eine Tenant-Datenbank
 */
export async function createTenantDbPool(dbConfig: {
  dbHost: string;
  dbPort: number;
  dbName: string;
  dbUser: string;
  dbPassword: string;
  dbSslMode: string;
}): Promise<Pool> {
  dbConfig = getEffectiveDbConfig(dbConfig);

  // Stelle sicher, dass das Passwort ein String ist
  const password = dbConfig.dbPassword != null ? String(dbConfig.dbPassword) : '';

  if (!password || password.trim().length === 0) {
    // Debug-Info für Development
    const debugInfo =
      process.env.NODE_ENV === 'development'
        ? ` (Original-Typ: ${typeof dbConfig.dbPassword}, Wert: ${dbConfig.dbPassword === null ? 'null' : dbConfig.dbPassword === undefined ? 'undefined' : dbConfig.dbPassword === '' ? 'leerer String' : 'nicht leer'})`
        : '';
    throw new BadRequestException({
      message: `Datenbank-Passwort fehlt oder ist ungültig (leer nach Konvertierung)${debugInfo}`,
      code: 'INVALID_PASSWORD',
    });
  }

  const pool = new Pool({
    host: dbConfig.dbHost,
    port: dbConfig.dbPort,
    database: dbConfig.dbName,
    user: dbConfig.dbUser,
    password: password,
    ssl: dbConfig.dbSslMode === 'require' ? { rejectUnauthorized: false } : false,
    connectionTimeoutMillis: 15000,
    keepAlive: true,
  });

  const MAX_RETRIES = 2;
  const RETRY_DELAY_MS = 500;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      await pool.query('SELECT 1');
      lastError = null;
      break;
    } catch (error: any) {
      lastError = error;
      const isRetryable =
        (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT' || error.code === 'ECONNREFUSED') &&
        attempt < MAX_RETRIES;
      if (isRetryable) {
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
      } else {
        await pool.end();
        throw new BadRequestException(
          `Datenbank-Verbindung fehlgeschlagen: ${error.message || 'Unbekannter Fehler'}`
        );
      }
    }
  }

  if (lastError) {
    await pool.end();
    throw new BadRequestException(
      `Datenbank-Verbindung fehlgeschlagen: ${lastError.message || 'Unbekannter Fehler'}`
    );
  }

  return pool;
}

/**
 * Formatiert einen Query-Fehler für die Response
 */
export function formatQueryError(
  error: any,
  isDevelopment: boolean
): { message: string; code?: string; details?: any } {
  const isDevelopmentMode = isDevelopment || process.env.NODE_ENV === 'development';

  if (isDevelopmentMode) {
    return {
      message: error.message || 'Unbekannter Fehler',
      code: error.code,
      details: {
        name: error.name,
        stack: error.stack,
      },
    };
  }

  // Generische Fehlermeldungen für Produktion
  if (error.code === 'ECONNREFUSED') {
    return {
      message: 'Datenbank-Verbindung fehlgeschlagen',
      code: 'DB_CONNECTION_ERROR',
    };
  }

  if (error.code === '42P01') {
    return {
      message: 'Tabelle oder View existiert nicht',
      code: 'TABLE_NOT_FOUND',
    };
  }

  if (error.code === '42601') {
    return {
      message: 'SQL-Syntaxfehler',
      code: 'SQL_SYNTAX_ERROR',
    };
  }

  return {
    message: 'Fehler beim Ausführen der Query',
    code: 'QUERY_ERROR',
  };
}

/**
 * Kürzt einen Query-Text für Logging
 */
export function sanitizeQueryForLogging(query: string, maxLength: number = 500): string {
  if (query.length <= maxLength) {
    return query;
  }
  return query.substring(0, maxLength) + '... (gekürzt)';
}
