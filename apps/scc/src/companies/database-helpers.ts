import { Pool } from 'pg';
import { BadRequestException } from '@nestjs/common';

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
    connectionTimeoutMillis: 5000,
  });

  // Teste Verbindung
  try {
    await pool.query('SELECT 1');
  } catch (error: any) {
    await pool.end();
    throw new BadRequestException(
      `Datenbank-Verbindung fehlgeschlagen: ${error.message || 'Unbekannter Fehler'}`
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
