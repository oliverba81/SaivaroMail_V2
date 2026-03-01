import {
  Injectable,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from '../common/encryption.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { UpdateCompanyFeaturesDto } from './dto/update-company-features.dto';
import { Pool } from 'pg';
import * as bcrypt from 'bcrypt';
import * as path from 'path';
import * as fs from 'fs/promises';
import {
  validateTableName,
  createTenantDbPool,
  formatQueryError,
  sanitizeQueryForLogging,
} from './database-helpers';
import { StorageUsage, formatBytes } from '@saivaro/shared';

// Fallback für formatBytes falls Import fehlschlägt
function formatBytesSafe(bytes: number, decimals: number = 2): string {
  try {
    return formatBytes(bytes, decimals);
  } catch (error) {
    // Fallback-Implementierung
    if (bytes === 0) return '0 Bytes';
    if (bytes < 0 || !Number.isFinite(bytes) || bytes < 1) return '0 Bytes';

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    const index = Math.min(Math.max(0, i), sizes.length - 1);

    return parseFloat((bytes / Math.pow(k, index)).toFixed(dm)) + ' ' + sizes[index];
  }
}

@Injectable()
export class CompaniesService {
  // Cache für Storage-Usage-Daten
  private storageCache = new Map<string, { data: StorageUsage; expiresAt: number }>();
  private lastCacheCleanup = Date.now();

  constructor(
    private prisma: PrismaService,
    private encryptionService: EncryptionService
  ) {}

  async findAll() {
    return this.prisma.company.findMany({
      include: {
        dbConfig: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findReadyCompanies() {
    try {
      const companies = await this.prisma.company.findMany({
        where: {
          dbConfig: {
            provisioningStatus: 'ready',
          },
          // Optional: Nur aktive Companies
          status: 'active',
        },
        select: {
          id: true, // Nur ID zurückgeben
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      return companies;
    } catch (error) {
      console.error('Fehler beim Laden der bereiten Companies:', error);
      throw new InternalServerErrorException('Fehler beim Laden der Companies');
    }
  }

  async findOne(id: string) {
    const company = await this.prisma.company.findUnique({
      where: { id },
      include: {
        dbConfig: true,
      },
    });

    if (!company) {
      throw new NotFoundException(`Company mit ID ${id} nicht gefunden`);
    }

    return company;
  }

  async create(createCompanyDto: CreateCompanyDto) {
    return this.prisma.company.create({
      data: {
        name: createCompanyDto.name,
        slug: createCompanyDto.slug,
        status: createCompanyDto.status || 'active',
        plan: createCompanyDto.plan || 'basic',
        metadata: createCompanyDto.metadata,
        contactAddress: createCompanyDto.contactAddress ?? undefined,
        contactPhone: createCompanyDto.contactPhone ?? undefined,
        contactEmail: createCompanyDto.contactEmail ?? undefined,
        contactWebsite: createCompanyDto.contactWebsite ?? undefined,
      },
      include: {
        dbConfig: true,
      },
    });
  }

  async update(id: string, updateCompanyDto: UpdateCompanyDto) {
    await this.findOne(id); // Prüft, ob Company existiert

    try {
      return await this.prisma.company.update({
        where: { id },
        data: updateCompanyDto,
        include: {
          dbConfig: true,
        },
      });
    } catch (error: any) {
      const msg = error?.message ?? '';
      if (
        error?.name === 'PrismaClientKnownRequestError' ||
        msg.includes('does not exist') ||
        msg.includes('existiert nicht')
      ) {
        throw new InternalServerErrorException(
          'Datenbank-Schema veraltet. Bitte führen Sie im Ordner apps/scc die Migration aus: pnpm exec prisma migrate deploy'
        );
      }
      throw error;
    }
  }

  async updateCompanyFeatures(id: string, features: UpdateCompanyFeaturesDto) {
    // Prüfe, ob Company existiert
    const company = await this.findOne(id);

    // Lade bestehende metadata
    const currentMetadata = (company.metadata as Record<string, any>) || {};

    // Aktualisiere nur features-Objekt
    // audioFeatures aktiviert beide Funktionen: E-Mail vorlesen und Zusammenfassung als Audio
    const updatedMetadata = {
      ...currentMetadata,
      features: {
        ...(currentMetadata.features || {}),
        ...(features.audioFeatures !== undefined
          ? {
              audioFeatures: features.audioFeatures,
              // Für Rückwärtskompatibilität: Setze beide alten Features auf den gleichen Wert
              textToSpeech: features.audioFeatures,
              emailSummary: features.audioFeatures,
            }
          : {}),
      },
    };

    // Aktualisiere Company
    return this.prisma.company.update({
      where: { id },
      data: { metadata: updatedMetadata },
      include: {
        dbConfig: true,
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id); // Prüft, ob Company existiert

    return this.prisma.company.delete({
      where: { id },
    });
  }

  async getDbConfig(companyId: string) {
    const company = await this.findOne(companyId);

    if (!company.dbConfig) {
      throw new NotFoundException(`DB-Config für Company ${companyId} nicht gefunden`);
    }

    // Passwort nicht zurückgeben (Sicherheit)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- absichtlich aus Rückgabe ausgeschlossen
    const { dbPassword, ...dbConfigWithoutPassword } = company.dbConfig;

    return dbConfigWithoutPassword;
  }

  /**
   * Holt DB-Config mit entschlüsseltem Passwort (nur für interne Verwendung)
   * Wird z. B. vom Mailclient verwendet, um sich mit der Tenant-DB zu verbinden
   */
  async getDbConfigWithPassword(companyId: string) {
    const company = await this.findOne(companyId);

    if (!company.dbConfig) {
      throw new NotFoundException(`DB-Config für Company ${companyId} nicht gefunden`);
    }

    // Passwort entschlüsseln
    const decryptedPassword = this.encryptionService.decrypt(company.dbConfig.dbPassword);

    return {
      ...company.dbConfig,
      dbPassword: decryptedPassword,
    };
  }

  /**
   * Holt User-Daten aus der Tenant-DB für Anzeige im SCC
   * Gibt nur sichere Informationen zurück (keine Passwort-Hashes)
   */
  async getTenantUsers(companyId: string) {
    let pool: Pool | null = null;

    try {
      const company = await this.findOne(companyId);

      if (!company.dbConfig) {
        throw new NotFoundException(`DB-Config für Company ${companyId} nicht gefunden`);
      }

      // Passwort entschlüsseln
      const decryptedPassword = this.encryptionService.decrypt(company.dbConfig.dbPassword);

      // Verbindung zur Tenant-DB herstellen
      pool = new Pool({
        host: company.dbConfig.dbHost,
        port: company.dbConfig.dbPort,
        database: company.dbConfig.dbName,
        user: company.dbConfig.dbUser,
        password: decryptedPassword,
        ssl: company.dbConfig.dbSslMode === 'require' ? { rejectUnauthorized: false } : false,
      });
      // Prüfe, ob users-Tabelle existiert
      const tableCheck = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'users'
        );
      `);

      if (!tableCheck.rows[0].exists) {
        console.log(
          `⚠️ Users-Tabelle existiert noch nicht in der Tenant-DB für Company ${companyId}`
        );
        return {
          users: [],
          message: 'Users-Tabelle existiert noch nicht in der Tenant-DB',
        };
      }

      // User-Daten abrufen (ohne Passwort-Hash)
      const result = await pool.query(`
        SELECT 
          id,
          username,
          email,
          first_name,
          last_name,
          role,
          status,
          last_login_at,
          created_at
        FROM users
        ORDER BY created_at DESC
        LIMIT 50
      `);

      // Passwörter aus SCC-DB laden
      const userIds = result.rows.map((row: any) => row.id);
      const passwords = await this.prisma.tenantUserPassword.findMany({
        where: {
          companyId,
          tenantUserId: { in: userIds },
        },
      });

      const passwordMap = new Map(passwords.map((p) => [p.tenantUserId, p.password]));

      // Fehlende Passwörter für bekannte Standard-User nachträglich speichern
      for (const row of result.rows) {
        if (!passwordMap.has(row.id)) {
          // Admin-User hat Standard-Passwort "saivaro"
          if (
            row.username === 'admin' ||
            row.email === 'admin' ||
            row.email === 'admin@localhost'
          ) {
            console.log(`🔑 Speichere Standard-Passwort für Admin-User ${row.id}...`);
            try {
              await this.prisma.tenantUserPassword.upsert({
                where: {
                  companyId_tenantUserId: {
                    companyId,
                    tenantUserId: row.id,
                  },
                },
                update: {
                  username: 'admin',
                  email: 'admin@localhost',
                  password: 'saivaro',
                },
                create: {
                  companyId,
                  tenantUserId: row.id,
                  username: 'admin',
                  email: 'admin@localhost',
                  password: 'saivaro',
                },
              });
              passwordMap.set(row.id, 'saivaro');
              console.log(`✅ Standard-Passwort für Admin-User gespeichert`);
            } catch (error: any) {
              console.error('❌ Fehler beim Speichern des Admin-Passworts:', error);
              console.error('❌ Fehler-Details:', error.message);
              // Fallback: Setze Passwort direkt im Map, auch wenn DB-Speicherung fehlschlägt
              passwordMap.set(row.id, 'saivaro');
              console.log(`⚠️ Passwort trotzdem im Map gesetzt (Fallback)`);
            }
          }
        } else {
          console.log(`✅ Passwort für User ${row.username || row.email} bereits vorhanden`);
        }
      }

      const users = result.rows.map((row: any) => {
        const password = passwordMap.get(row.id);
        const user = {
          id: row.id,
          username: row.username || row.email, // Fallback zu email falls username nicht existiert
          email: row.email,
          firstName: row.first_name,
          lastName: row.last_name,
          role: row.role,
          status: row.status,
          lastLoginAt: row.last_login_at?.toISOString() || null,
          createdAt: row.created_at?.toISOString() || null,
          password: password || null,
        };

        // Debug-Log für jeden User
        console.log(
          `  - ${user.username || user.email} (${user.id}) - Passwort: ${password ? `"${password.substring(0, 2)}..." (${password.length} chars)` : 'FEHLT'}`
        );

        return user;
      });

      console.log(`✅ Gefundene User in Tenant-DB: ${users.length}`);
      const usersWithPassword = users.filter((u: any) => u.password).length;
      console.log(`✅ User mit Passwort: ${usersWithPassword} von ${users.length}`);

      return {
        users,
      };
    } catch (error: any) {
      console.error('❌ Fehler in getTenantUsers:', error);
      console.error('❌ Error type:', typeof error);
      console.error('❌ Error message:', error.message);
      console.error('❌ Error code:', error.code);
      console.error('❌ Error stack:', error.stack);

      // Für alle Fehler gebe eine leere Liste zurück statt zu werfen
      // Dies verhindert, dass die gesamte Seite mit einem Internal Server Error abstürzt
      // Die Frontend-Seite kann weiterhin angezeigt werden, auch wenn die User-Liste leer ist
      return {
        users: [],
        message: `Fehler beim Abrufen der User-Daten: ${error.message || 'Unbekannter Fehler'}`,
      };
    } finally {
      if (pool) {
        try {
          await pool.end();
        } catch (endError) {
          console.error('Fehler beim Schließen der DB-Verbindung:', endError);
        }
      }
    }
  }

  /**
   * Erstellt einen Test-User in der Tenant-DB
   */
  async createTenantUser(
    companyId: string,
    userData: {
      email: string;
      password: string;
      firstName?: string;
      lastName?: string;
      role?: string;
    }
  ) {
    const company = await this.findOne(companyId);

    if (!company.dbConfig) {
      throw new NotFoundException(`DB-Config für Company ${companyId} nicht gefunden`);
    }

    // Passwort entschlüsseln
    let decryptedPassword: string;
    try {
      decryptedPassword = this.encryptionService.decrypt(company.dbConfig.dbPassword);
    } catch (error: any) {
      const errorMsg = error?.message || String(error);
      throw new BadRequestException(`Fehler beim Entschlüsseln des DB-Passworts: ${errorMsg}`);
    }

    // Verbindung zur Tenant-DB herstellen
    const pool = new Pool({
      host: company.dbConfig.dbHost,
      port: company.dbConfig.dbPort,
      database: company.dbConfig.dbName,
      user: company.dbConfig.dbUser,
      password: decryptedPassword,
      ssl: company.dbConfig.dbSslMode === 'require' ? { rejectUnauthorized: false } : false,
      connectionTimeoutMillis: 5000, // 5 Sekunden Timeout
    });

    try {
      // Teste DB-Verbindung
      await pool.query('SELECT 1');

      // Prüfe, ob users-Tabelle existiert
      const tableCheck = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'users'
        );
      `);

      if (!tableCheck.rows[0].exists) {
        // Tabelle erstellen, falls sie nicht existiert
        await pool.query(`
          CREATE TABLE IF NOT EXISTS users (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            company_id UUID NOT NULL,
            username VARCHAR(255) UNIQUE NOT NULL,
            email VARCHAR(255),
            password_hash VARCHAR(255) NOT NULL,
            first_name VARCHAR(100),
            last_name VARCHAR(100),
            role VARCHAR(50) DEFAULT 'user',
            status VARCHAR(50) DEFAULT 'active',
            last_login_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
          );
        `);

        // Standard-Admin-User erstellen, wenn Tabelle neu erstellt wurde
        await this.createDefaultAdminUserIfNotExists(pool, companyId);
      } else {
        // Tabelle existiert bereits - prüfe, ob company_id-Spalte vorhanden ist
        const companyIdColumnCheck = await pool.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'users' 
            AND column_name = 'company_id'
          );
        `);

        if (!companyIdColumnCheck.rows[0].exists) {
          console.log(`🔄 Füge company_id-Spalte zur users-Tabelle hinzu...`);
          await pool.query(`
            ALTER TABLE users ADD COLUMN company_id UUID;
          `);
          // Setze company_id für alle bestehenden User
          await pool.query(
            `
            UPDATE users SET company_id = $1 WHERE company_id IS NULL;
          `,
            [companyId]
          );
          // Mache Spalte NOT NULL
          await pool.query(`
            ALTER TABLE users ALTER COLUMN company_id SET NOT NULL;
          `);
          console.log(`✅ company_id-Spalte hinzugefügt`);
        }
      }

      // Prüfe, ob username-Spalte existiert, falls nicht hinzufügen (Migration für bestehende Tabellen)
      const columnCheck = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_schema = 'public' 
          AND table_name = 'users' 
          AND column_name = 'username'
        );
      `);

      if (!columnCheck.rows[0].exists) {
        // username-Spalte hinzufügen
        await pool.query(`
          ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR(255);
        `);

        // Bestehende E-Mails als Username setzen
        await pool.query(`
          UPDATE users SET username = COALESCE(email, 'user_' || id::text) WHERE username IS NULL;
        `);

        // Prüfe, ob Unique-Constraint bereits existiert
        const constraintCheck = await pool.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.table_constraints 
            WHERE table_schema = 'public' 
            AND table_name = 'users' 
            AND constraint_name = 'users_username_unique'
          );
        `);

        if (!constraintCheck.rows[0].exists) {
          // Unique-Constraint hinzufügen
          await pool.query(`
            ALTER TABLE users ADD CONSTRAINT users_username_unique UNIQUE (username);
          `);
        }
      }

      // Prüfe, ob Admin-User existiert (auch wenn Tabelle bereits existiert)
      await this.createDefaultAdminUserIfNotExists(pool, companyId);

      // Benutzername aus E-Mail extrahieren (vor dem @) oder E-Mail als Fallback
      let username = userData.email.split('@')[0] || userData.email;

      // Spezialfall: admin@localhost → admin
      if (userData.email === 'admin@localhost') {
        username = 'admin';
      }

      // Stelle sicher, dass username nicht leer ist
      if (!username || username.trim() === '') {
        username = userData.email.replace(/[^a-zA-Z0-9]/g, '_');
      }

      // Prüfe, ob User mit diesem Benutzernamen bereits existiert
      const existingUser = await pool.query(
        'SELECT id, username, email FROM users WHERE LOWER(username) = LOWER($1) OR LOWER(email) = LOWER($2)',
        [username, userData.email]
      );

      if (existingUser.rows.length > 0) {
        const existing = existingUser.rows[0];
        // Wenn es der Standard-Admin-User ist und das Passwort aktualisiert werden soll
        if (
          (existing.username === 'admin' || existing.email === 'admin@localhost') &&
          (username === 'admin' || userData.email === 'admin@localhost')
        ) {
          // Aktualisiere das Passwort des bestehenden Admin-Users
          const passwordHash = await bcrypt.hash(userData.password, 10);
          await pool.query(
            'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
            [passwordHash, existing.id]
          );

          // Aktualisiere auch das Passwort in der SCC-DB
          await this.prisma.tenantUserPassword.upsert({
            where: {
              companyId_tenantUserId: {
                companyId,
                tenantUserId: existing.id,
              },
            },
            update: {
              username: 'admin',
              email: 'admin@localhost',
              password: userData.password,
            },
            create: {
              companyId,
              tenantUserId: existing.id,
              username: 'admin',
              email: 'admin@localhost',
              password: userData.password,
            },
          });

          // Lade den aktualisierten User
          const updatedUser = await pool.query(
            'SELECT id, username, email, first_name, last_name, role, status, created_at FROM users WHERE id = $1',
            [existing.id]
          );

          return {
            id: updatedUser.rows[0].id,
            username: updatedUser.rows[0].username || updatedUser.rows[0].email,
            email: updatedUser.rows[0].email,
            firstName: updatedUser.rows[0].first_name,
            lastName: updatedUser.rows[0].last_name,
            role: updatedUser.rows[0].role,
            status: updatedUser.rows[0].status,
            createdAt: updatedUser.rows[0].created_at?.toISOString() || null,
            password: userData.password,
          };
        }
        throw new BadRequestException(
          `User mit Benutzernamen ${username} oder E-Mail ${userData.email} existiert bereits`
        );
      }

      // Passwort hashen
      const passwordHash = await bcrypt.hash(userData.password, 10);

      // User erstellen
      let result;
      try {
        result = await pool.query(
          `INSERT INTO users (company_id, username, email, password_hash, first_name, last_name, role, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           RETURNING id, username, email, first_name, last_name, role, status, created_at`,
          [
            companyId,
            username,
            userData.email,
            passwordHash,
            userData.firstName || '',
            userData.lastName || '',
            userData.role || 'user',
            'active',
          ]
        );
      } catch (insertError: any) {
        console.error('Fehler beim INSERT:', insertError);
        // Falls username-Spalte noch nicht existiert oder Constraint-Fehler
        if (insertError.code === '42703' || insertError.message?.includes('column "username"')) {
          // Versuche nochmal die Spalte hinzuzufügen
          await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR(255);`);
          await pool.query(
            `UPDATE users SET username = COALESCE(email, 'user_' || id::text) WHERE username IS NULL;`
          );
          // Erneut versuchen
          result = await pool.query(
            `INSERT INTO users (company_id, username, email, password_hash, first_name, last_name, role, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             RETURNING id, username, email, first_name, last_name, role, status, created_at`,
            [
              companyId,
              username,
              userData.email,
              passwordHash,
              userData.firstName || '',
              userData.lastName || '',
              userData.role || 'user',
              'active',
            ]
          );
        } else {
          throw insertError;
        }
      }

      const newUser = result.rows[0];

      // Passwort in SCC-DB speichern (für Test-Umgebung)
      await this.prisma.tenantUserPassword.upsert({
        where: {
          companyId_tenantUserId: {
            companyId,
            tenantUserId: newUser.id,
          },
        },
        update: {
          username: newUser.username || username,
          email: userData.email,
          password: userData.password,
        },
        create: {
          companyId,
          tenantUserId: newUser.id,
          username: newUser.username || username,
          email: userData.email,
          password: userData.password,
        },
      });

      return {
        id: newUser.id,
        username: newUser.username || newUser.email,
        email: newUser.email,
        firstName: newUser.first_name,
        lastName: newUser.last_name,
        role: newUser.role,
        status: newUser.status,
        createdAt: newUser.created_at?.toISOString() || null,
        password: userData.password,
      };
    } catch (error: any) {
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }

      // Detaillierte Fehlermeldung für Debugging
      console.error('Fehler beim Erstellen des Users:', error);
      console.error('Error type:', typeof error);
      console.error('Error keys:', Object.keys(error));
      console.error('Error code:', error.code);
      console.error('Error detail:', error.detail);
      console.error('DB Config:', {
        host: company.dbConfig.dbHost,
        port: company.dbConfig.dbPort,
        database: company.dbConfig.dbName,
        user: company.dbConfig.dbUser,
      });

      let errorMessage = 'Unbekannter Fehler';
      if (error.code === 'ECONNREFUSED') {
        errorMessage = `Datenbank nicht erreichbar (${company.dbConfig.dbHost}:${company.dbConfig.dbPort}). Bitte prüfen Sie, ob die Datenbank läuft und die DB-Config korrekt ist. Falls die DB mit fiktiven Daten provisioniert wurde, bitte die DB neu provisionieren.`;
      } else if (error.message) {
        errorMessage = error.message;
      } else if (error.detail) {
        errorMessage = error.detail;
      } else if (error.code) {
        errorMessage = `Datenbankfehler (Code: ${error.code})`;
      } else if (typeof error === 'string') {
        errorMessage = error;
      } else {
        errorMessage = JSON.stringify(error);
      }

      throw new BadRequestException(`Fehler beim Erstellen des Users: ${errorMessage}`);
    } finally {
      await pool.end();
    }
  }

  /**
   * Erstellt einen Standard-Admin-User, falls er nicht existiert
   */
  private async createDefaultAdminUserIfNotExists(pool: any, companyId: string) {
    try {
      // Prüfe, ob Admin-User bereits existiert
      const existingAdmin = await pool.query('SELECT id FROM users WHERE username = $1', ['admin']);

      let adminUserId: string;

      if (existingAdmin.rows.length === 0) {
        // Passwort hashen
        const passwordHash = await bcrypt.hash('saivaro', 10);

        // Admin-User erstellen
        const adminResult = await pool.query(
          `INSERT INTO users (company_id, username, email, password_hash, first_name, last_name, role, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           RETURNING id`,
          [companyId, 'admin', 'admin@localhost', passwordHash, 'Admin', 'User', 'admin', 'active']
        );

        adminUserId = adminResult.rows[0].id;
        console.log(
          `✅ Standard-Admin-User (admin/saivaro) wurde erstellt für Company ${companyId}`
        );
      } else {
        adminUserId = existingAdmin.rows[0].id;
      }

      // Passwort in SCC-DB speichern (auch wenn User bereits existiert, falls es noch nicht gespeichert ist)
      await this.prisma.tenantUserPassword.upsert({
        where: {
          companyId_tenantUserId: {
            companyId,
            tenantUserId: adminUserId,
          },
        },
        update: {
          email: 'admin',
          password: 'saivaro',
        },
        create: {
          companyId,
          tenantUserId: adminUserId,
          email: 'admin',
          password: 'saivaro',
        },
      });
    } catch (error: any) {
      console.error(`Fehler beim Erstellen des Standard-Admin-Users:`, error.message);
      // Fehler nicht weiterwerfen
    }
  }

  /**
   * Aktualisiert einen User in der Tenant-DB (z. B. Status ändern)
   */
  async updateTenantUser(
    companyId: string,
    userId: string,
    updateData: { status?: string; role?: string }
  ) {
    const company = await this.findOne(companyId);

    if (!company.dbConfig) {
      throw new NotFoundException(`DB-Config für Company ${companyId} nicht gefunden`);
    }

    // Passwort entschlüsseln
    let decryptedPassword: string;
    try {
      decryptedPassword = this.encryptionService.decrypt(company.dbConfig.dbPassword);
    } catch (error: any) {
      const errorMsg = error?.message || String(error);
      throw new BadRequestException(`Fehler beim Entschlüsseln des DB-Passworts: ${errorMsg}`);
    }

    // Verbindung zur Tenant-DB herstellen
    const pool = new Pool({
      host: company.dbConfig.dbHost,
      port: company.dbConfig.dbPort,
      database: company.dbConfig.dbName,
      user: company.dbConfig.dbUser,
      password: decryptedPassword,
      ssl: company.dbConfig.dbSslMode === 'require' ? { rejectUnauthorized: false } : false,
      connectionTimeoutMillis: 5000,
    });

    try {
      // Prüfe, ob User existiert
      const userCheck = await pool.query(
        'SELECT id, email FROM users WHERE id = $1 AND company_id = $2',
        [userId, companyId]
      );

      if (userCheck.rows.length === 0) {
        throw new NotFoundException(`User mit ID ${userId} nicht gefunden`);
      }

      // Update-Felder zusammenstellen
      const updateFields: string[] = [];
      const updateValues: any[] = [];
      let paramIndex = 1;

      if (updateData.status) {
        updateFields.push(`status = $${paramIndex}`);
        updateValues.push(updateData.status);
        paramIndex++;
      }

      if (updateData.role) {
        updateFields.push(`role = $${paramIndex}`);
        updateValues.push(updateData.role);
        paramIndex++;
      }

      if (updateFields.length === 0) {
        throw new BadRequestException('Keine Felder zum Aktualisieren angegeben');
      }

      updateFields.push(`updated_at = NOW()`);
      updateValues.push(userId, companyId);

      // User aktualisieren
      const result = await pool.query(
        `UPDATE users 
         SET ${updateFields.join(', ')}
         WHERE id = $${paramIndex} AND company_id = $${paramIndex + 1}
         RETURNING id, email, first_name, last_name, role, status, created_at`,
        updateValues
      );

      const updatedUser = result.rows[0];

      return {
        id: updatedUser.id,
        username: updatedUser.username || updatedUser.email,
        email: updatedUser.email,
        firstName: updatedUser.first_name,
        lastName: updatedUser.last_name,
        role: updatedUser.role,
        status: updatedUser.status,
        createdAt: updatedUser.created_at?.toISOString() || null,
      };
    } catch (error: any) {
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      console.error('Fehler beim Aktualisieren des Users:', error);
      throw new BadRequestException(
        `Fehler beim Aktualisieren des Users: ${error.message || String(error)}`
      );
    } finally {
      await pool.end();
    }
  }

  /**
   * Löscht einen User aus der Tenant-DB
   */
  async deleteTenantUser(companyId: string, userId: string) {
    const company = await this.findOne(companyId);

    if (!company.dbConfig) {
      throw new NotFoundException(`DB-Config für Company ${companyId} nicht gefunden`);
    }

    // Passwort entschlüsseln
    let decryptedPassword: string;
    try {
      decryptedPassword = this.encryptionService.decrypt(company.dbConfig.dbPassword);
    } catch (error: any) {
      const errorMsg = error?.message || String(error);
      throw new BadRequestException(`Fehler beim Entschlüsseln des DB-Passworts: ${errorMsg}`);
    }

    // Verbindung zur Tenant-DB herstellen
    const pool = new Pool({
      host: company.dbConfig.dbHost,
      port: company.dbConfig.dbPort,
      database: company.dbConfig.dbName,
      user: company.dbConfig.dbUser,
      password: decryptedPassword,
      ssl: company.dbConfig.dbSslMode === 'require' ? { rejectUnauthorized: false } : false,
      connectionTimeoutMillis: 5000,
    });

    try {
      // Prüfe, ob User existiert
      const userCheck = await pool.query(
        'SELECT id, email FROM users WHERE id = $1 AND company_id = $2',
        [userId, companyId]
      );

      if (userCheck.rows.length === 0) {
        throw new NotFoundException(`User mit ID ${userId} nicht gefunden`);
      }

      // User löschen
      await pool.query('DELETE FROM users WHERE id = $1 AND company_id = $2', [userId, companyId]);

      // Passwort aus SCC-DB löschen
      await this.prisma.tenantUserPassword.deleteMany({
        where: {
          companyId,
          tenantUserId: userId,
        },
      });

      return {
        success: true,
        message: `User ${userCheck.rows[0].email} wurde gelöscht`,
      };
    } catch (error: any) {
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      console.error('Fehler beim Löschen des Users:', error);
      throw new BadRequestException(
        `Fehler beim Löschen des Users: ${error.message || String(error)}`
      );
    } finally {
      await pool.end();
    }
  }

  /**
   * Führt eine SQL-Query auf der Tenant-DB aus
   */
  async executeQuery(
    companyId: string,
    query: string,
    options?: { limit?: number; timeout?: number }
  ) {
    const startTime = Date.now();
    let pool: Pool | null = null;

    try {
      const company = await this.findOne(companyId);

      if (!company.dbConfig) {
        throw new NotFoundException(`DB-Config für Company ${companyId} nicht gefunden`);
      }

      if (company.dbConfig.provisioningStatus !== 'ready') {
        throw new BadRequestException(
          `Datenbank für Company ${companyId} ist noch nicht bereit (Status: ${company.dbConfig.provisioningStatus})`
        );
      }

      // Passwort entschlüsseln
      const decryptedPassword = this.encryptionService.decrypt(company.dbConfig.dbPassword);

      // DB-Pool erstellen
      pool = await createTenantDbPool({
        dbHost: company.dbConfig.dbHost,
        dbPort: company.dbConfig.dbPort,
        dbName: company.dbConfig.dbName,
        dbUser: company.dbConfig.dbUser,
        dbPassword: decryptedPassword,
        dbSslMode: company.dbConfig.dbSslMode,
      });

      // Timeout setzen
      const timeout = Math.min(options?.timeout || 30, 60) * 1000; // in Millisekunden
      await pool.query(`SET statement_timeout = ${timeout}`);

      // Query ausführen
      const limit = Math.min(options?.limit || 1000, 10000);

      // Prüfe, ob Query bereits ein LIMIT hat
      const hasLimit = /LIMIT\s+\d+/i.test(query);
      let finalQuery = query;
      let limited = false;

      if (!hasLimit && limit < 10000) {
        // Füge LIMIT hinzu, wenn nicht vorhanden
        finalQuery = `${query.trim().replace(/;?\s*$/, '')} LIMIT ${limit}`;
        limited = true;
      }

      const result = await pool.query(finalQuery);

      const executionTimeMs = Date.now() - startTime;

      // Logging (strukturiert)
      const sanitizedQuery = sanitizeQueryForLogging(query);
      console.log(
        `[Query] Company: ${companyId}, Time: ${executionTimeMs}ms, Rows: ${result.rows.length}, Query: ${sanitizedQuery}`
      );

      // Ergebnisse formatieren
      return {
        columns: result.fields.map((f) => f.name),
        rows: result.rows,
        rowCount: result.rowCount,
        executionTimeMs,
        limited,
      };
    } catch (error: any) {
      const executionTimeMs = Date.now() - startTime;
      const isDevelopment = process.env.NODE_ENV === 'development';
      const errorResponse = formatQueryError(error, isDevelopment);

      // Logging
      const sanitizedQuery = sanitizeQueryForLogging(query);
      console.error(
        `[Query Error] Company: ${companyId}, Time: ${executionTimeMs}ms, Error: ${error.message}, Query: ${sanitizedQuery}`
      );

      throw new BadRequestException({
        message: errorResponse.message,
        code: errorResponse.code,
        ...(errorResponse.details && { details: errorResponse.details }),
      });
    } finally {
      if (pool) {
        try {
          await pool.end();
        } catch (endError) {
          console.error('Fehler beim Schließen der DB-Verbindung:', endError);
        }
      }
    }
  }

  /**
   * Gibt Liste aller Tabellen mit Metadaten zurück
   */
  async getTables(companyId: string) {
    let pool: Pool | null = null;

    try {
      const company = await this.findOne(companyId);

      if (!company.dbConfig) {
        throw new NotFoundException(`DB-Config für Company ${companyId} nicht gefunden`);
      }

      if (company.dbConfig.provisioningStatus !== 'ready') {
        throw new BadRequestException(
          `Datenbank für Company ${companyId} ist noch nicht bereit (Status: ${company.dbConfig.provisioningStatus})`
        );
      }

      // Prüfe, ob Passwort vorhanden ist
      if (!company.dbConfig.dbPassword) {
        throw new BadRequestException({
          message: 'Datenbank-Passwort ist nicht in der DB-Config vorhanden',
          code: 'MISSING_PASSWORD',
        });
      }

      // Passwort entschlüsseln mit Fehlerbehandlung
      let decryptedPassword: string;
      try {
        // Prüfe, ob das verschlüsselte Passwort im erwarteten Format ist
        if (!company.dbConfig.dbPassword || typeof company.dbConfig.dbPassword !== 'string') {
          throw new BadRequestException({
            message: 'Datenbank-Passwort ist nicht im erwarteten Format (nicht verschlüsselt?)',
            code: 'INVALID_PASSWORD_FORMAT',
          });
        }

        // Prüfe, ob das Format dem Verschlüsselungsformat entspricht (sollte "salt:iv:tag:encrypted" sein)
        const parts = company.dbConfig.dbPassword.split(':');
        if (parts.length !== 4) {
          throw new BadRequestException({
            message: `Datenbank-Passwort hat nicht das erwartete Verschlüsselungsformat (${parts.length} Teile statt 4). Möglicherweise ist das Passwort nicht verschlüsselt.`,
            code: 'INVALID_ENCRYPTION_FORMAT',
          });
        }

        decryptedPassword = this.encryptionService.decrypt(company.dbConfig.dbPassword);

        // Debug-Logging (nur in Development)
        if (process.env.NODE_ENV === 'development') {
          console.log(
            `[DB-Password] Company ${companyId}: Passwort-Länge nach Entschlüsselung: ${decryptedPassword?.length || 0}`
          );
        }
      } catch (error: any) {
        // Wenn es bereits eine BadRequestException ist, weiterwerfen
        if (error instanceof BadRequestException) {
          throw error;
        }
        const errorMsg = error?.message || String(error);
        throw new BadRequestException({
          message: `Fehler beim Entschlüsseln des DB-Passworts: ${errorMsg}`,
          code: 'DECRYPTION_ERROR',
          details:
            process.env.NODE_ENV === 'development' ? { originalError: error?.message } : undefined,
        });
      }

      // Stelle sicher, dass das Passwort ein String ist und nicht leer
      if (decryptedPassword == null || typeof decryptedPassword !== 'string') {
        throw new BadRequestException({
          message: `Datenbank-Passwort konnte nicht korrekt entschlüsselt werden. Typ: ${typeof decryptedPassword}, Wert: ${decryptedPassword === null ? 'null' : decryptedPassword === undefined ? 'undefined' : 'unbekannt'}`,
          code: 'INVALID_PASSWORD_TYPE',
        });
      }

      if (decryptedPassword.trim().length === 0) {
        throw new BadRequestException({
          message:
            'Datenbank-Passwort ist leer nach der Entschlüsselung. Möglicherweise wurde ein leeres Passwort verschlüsselt oder die Entschlüsselung hat ein leeres Ergebnis zurückgegeben.',
          code: 'EMPTY_PASSWORD',
        });
      }

      pool = await createTenantDbPool({
        dbHost: company.dbConfig.dbHost,
        dbPort: company.dbConfig.dbPort,
        dbName: company.dbConfig.dbName,
        dbUser: company.dbConfig.dbUser,
        dbPassword: decryptedPassword,
        dbSslMode: company.dbConfig.dbSslMode,
      });

      const result = await pool.query(`
        SELECT 
          t.table_name,
          (SELECT COUNT(*) 
           FROM information_schema.columns c 
           WHERE c.table_schema = 'public' 
           AND c.table_name = t.table_name) as column_count
        FROM information_schema.tables t
        WHERE t.table_schema = 'public' 
          AND t.table_type = 'BASE TABLE'
        ORDER BY t.table_name
      `);

      return result.rows.map((row) => ({
        tableName: row.table_name,
        columnCount: parseInt(row.column_count, 10),
      }));
    } catch (error: any) {
      const isDevelopment = process.env.NODE_ENV === 'development';
      const errorResponse = formatQueryError(error, isDevelopment);
      throw new BadRequestException({
        message: errorResponse.message,
        code: errorResponse.code,
        ...(errorResponse.details && { details: errorResponse.details }),
      });
    } finally {
      if (pool) {
        try {
          await pool.end();
        } catch (endError) {
          console.error('Fehler beim Schließen der DB-Verbindung:', endError);
        }
      }
    }
  }

  /**
   * Gibt Tabellenstruktur zurück (Spalten, Datentypen, Constraints)
   */
  async getTableStructure(companyId: string, tableName: string) {
    if (!validateTableName(tableName)) {
      throw new BadRequestException('Ungültiger Tabellenname');
    }

    let pool: Pool | null = null;

    try {
      const company = await this.findOne(companyId);

      if (!company.dbConfig) {
        throw new NotFoundException(`DB-Config für Company ${companyId} nicht gefunden`);
      }

      if (company.dbConfig.provisioningStatus !== 'ready') {
        throw new BadRequestException(
          `Datenbank für Company ${companyId} ist noch nicht bereit (Status: ${company.dbConfig.provisioningStatus})`
        );
      }

      // Prüfe, ob Passwort vorhanden ist
      if (!company.dbConfig.dbPassword) {
        throw new BadRequestException({
          message: 'Datenbank-Passwort ist nicht in der DB-Config vorhanden',
          code: 'MISSING_PASSWORD',
        });
      }

      // Passwort entschlüsseln mit Fehlerbehandlung
      let decryptedPassword: string;
      try {
        // Prüfe, ob das verschlüsselte Passwort im erwarteten Format ist
        if (!company.dbConfig.dbPassword || typeof company.dbConfig.dbPassword !== 'string') {
          throw new BadRequestException({
            message: 'Datenbank-Passwort ist nicht im erwarteten Format (nicht verschlüsselt?)',
            code: 'INVALID_PASSWORD_FORMAT',
          });
        }

        // Prüfe, ob das Format dem Verschlüsselungsformat entspricht (sollte "salt:iv:tag:encrypted" sein)
        const parts = company.dbConfig.dbPassword.split(':');
        if (parts.length !== 4) {
          throw new BadRequestException({
            message: `Datenbank-Passwort hat nicht das erwartete Verschlüsselungsformat (${parts.length} Teile statt 4). Möglicherweise ist das Passwort nicht verschlüsselt.`,
            code: 'INVALID_ENCRYPTION_FORMAT',
          });
        }

        decryptedPassword = this.encryptionService.decrypt(company.dbConfig.dbPassword);

        // Debug-Logging (nur in Development)
        if (process.env.NODE_ENV === 'development') {
          console.log(
            `[DB-Password] Company ${companyId}: Passwort-Länge nach Entschlüsselung: ${decryptedPassword?.length || 0}`
          );
        }
      } catch (error: any) {
        // Wenn es bereits eine BadRequestException ist, weiterwerfen
        if (error instanceof BadRequestException) {
          throw error;
        }
        const errorMsg = error?.message || String(error);
        throw new BadRequestException({
          message: `Fehler beim Entschlüsseln des DB-Passworts: ${errorMsg}`,
          code: 'DECRYPTION_ERROR',
          details:
            process.env.NODE_ENV === 'development' ? { originalError: error?.message } : undefined,
        });
      }

      // Stelle sicher, dass das Passwort ein String ist und nicht leer
      if (decryptedPassword == null || typeof decryptedPassword !== 'string') {
        throw new BadRequestException({
          message: `Datenbank-Passwort konnte nicht korrekt entschlüsselt werden. Typ: ${typeof decryptedPassword}, Wert: ${decryptedPassword === null ? 'null' : decryptedPassword === undefined ? 'undefined' : 'unbekannt'}`,
          code: 'INVALID_PASSWORD_TYPE',
        });
      }

      if (decryptedPassword.trim().length === 0) {
        throw new BadRequestException({
          message:
            'Datenbank-Passwort ist leer nach der Entschlüsselung. Möglicherweise wurde ein leeres Passwort verschlüsselt oder die Entschlüsselung hat ein leeres Ergebnis zurückgegeben.',
          code: 'EMPTY_PASSWORD',
        });
      }

      pool = await createTenantDbPool({
        dbHost: company.dbConfig.dbHost,
        dbPort: company.dbConfig.dbPort,
        dbName: company.dbConfig.dbName,
        dbUser: company.dbConfig.dbUser,
        dbPassword: decryptedPassword,
        dbSslMode: company.dbConfig.dbSslMode,
      });

      const result = await pool.query(
        `
        SELECT 
          column_name,
          data_type,
          character_maximum_length,
          is_nullable,
          column_default
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1
        ORDER BY ordinal_position
      `,
        [tableName]
      );

      return result.rows.map((row) => ({
        columnName: row.column_name,
        dataType: row.data_type,
        characterMaximumLength: row.character_maximum_length,
        isNullable: row.is_nullable === 'YES',
        columnDefault: row.column_default,
      }));
    } catch (error: any) {
      const isDevelopment = process.env.NODE_ENV === 'development';
      const errorResponse = formatQueryError(error, isDevelopment);
      throw new BadRequestException({
        message: errorResponse.message,
        code: errorResponse.code,
        ...(errorResponse.details && { details: errorResponse.details }),
      });
    } finally {
      if (pool) {
        try {
          await pool.end();
        } catch (endError) {
          console.error('Fehler beim Schließen der DB-Verbindung:', endError);
        }
      }
    }
  }

  /**
   * Gibt paginierte Tabellendaten zurück
   */
  async getTableData(companyId: string, tableName: string, page: number = 0, limit: number = 50) {
    if (!validateTableName(tableName)) {
      throw new BadRequestException('Ungültiger Tabellenname');
    }

    let pool: Pool | null = null;

    try {
      const company = await this.findOne(companyId);

      if (!company.dbConfig) {
        throw new NotFoundException(`DB-Config für Company ${companyId} nicht gefunden`);
      }

      if (company.dbConfig.provisioningStatus !== 'ready') {
        throw new BadRequestException(
          `Datenbank für Company ${companyId} ist noch nicht bereit (Status: ${company.dbConfig.provisioningStatus})`
        );
      }

      // Prüfe, ob Passwort vorhanden ist
      if (!company.dbConfig.dbPassword) {
        throw new BadRequestException({
          message: 'Datenbank-Passwort ist nicht in der DB-Config vorhanden',
          code: 'MISSING_PASSWORD',
        });
      }

      // Passwort entschlüsseln mit Fehlerbehandlung
      let decryptedPassword: string;
      try {
        // Prüfe, ob das verschlüsselte Passwort im erwarteten Format ist
        if (!company.dbConfig.dbPassword || typeof company.dbConfig.dbPassword !== 'string') {
          throw new BadRequestException({
            message: 'Datenbank-Passwort ist nicht im erwarteten Format (nicht verschlüsselt?)',
            code: 'INVALID_PASSWORD_FORMAT',
          });
        }

        // Prüfe, ob das Format dem Verschlüsselungsformat entspricht (sollte "salt:iv:tag:encrypted" sein)
        const parts = company.dbConfig.dbPassword.split(':');
        if (parts.length !== 4) {
          throw new BadRequestException({
            message: `Datenbank-Passwort hat nicht das erwartete Verschlüsselungsformat (${parts.length} Teile statt 4). Möglicherweise ist das Passwort nicht verschlüsselt.`,
            code: 'INVALID_ENCRYPTION_FORMAT',
          });
        }

        decryptedPassword = this.encryptionService.decrypt(company.dbConfig.dbPassword);

        // Debug-Logging (nur in Development)
        if (process.env.NODE_ENV === 'development') {
          console.log(
            `[DB-Password] Company ${companyId}: Passwort-Länge nach Entschlüsselung: ${decryptedPassword?.length || 0}`
          );
        }
      } catch (error: any) {
        // Wenn es bereits eine BadRequestException ist, weiterwerfen
        if (error instanceof BadRequestException) {
          throw error;
        }
        const errorMsg = error?.message || String(error);
        throw new BadRequestException({
          message: `Fehler beim Entschlüsseln des DB-Passworts: ${errorMsg}`,
          code: 'DECRYPTION_ERROR',
          details:
            process.env.NODE_ENV === 'development' ? { originalError: error?.message } : undefined,
        });
      }

      // Stelle sicher, dass das Passwort ein String ist und nicht leer
      if (decryptedPassword == null || typeof decryptedPassword !== 'string') {
        throw new BadRequestException({
          message: `Datenbank-Passwort konnte nicht korrekt entschlüsselt werden. Typ: ${typeof decryptedPassword}, Wert: ${decryptedPassword === null ? 'null' : decryptedPassword === undefined ? 'undefined' : 'unbekannt'}`,
          code: 'INVALID_PASSWORD_TYPE',
        });
      }

      if (decryptedPassword.trim().length === 0) {
        throw new BadRequestException({
          message:
            'Datenbank-Passwort ist leer nach der Entschlüsselung. Möglicherweise wurde ein leeres Passwort verschlüsselt oder die Entschlüsselung hat ein leeres Ergebnis zurückgegeben.',
          code: 'EMPTY_PASSWORD',
        });
      }

      pool = await createTenantDbPool({
        dbHost: company.dbConfig.dbHost,
        dbPort: company.dbConfig.dbPort,
        dbName: company.dbConfig.dbName,
        dbUser: company.dbConfig.dbUser,
        dbPassword: decryptedPassword,
        dbSslMode: company.dbConfig.dbSslMode,
      });

      const offset = page * limit;
      const result = await pool.query(`SELECT * FROM "${tableName}" LIMIT $1 OFFSET $2`, [
        limit,
        offset,
      ]);

      // Gesamtanzahl für Pagination
      const countResult = await pool.query(`SELECT COUNT(*) as total FROM "${tableName}"`);
      const total = parseInt(countResult.rows[0].total, 10);

      return {
        rows: result.rows,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    } catch (error: any) {
      const isDevelopment = process.env.NODE_ENV === 'development';
      const errorResponse = formatQueryError(error, isDevelopment);
      throw new BadRequestException({
        message: errorResponse.message,
        code: errorResponse.code,
        ...(errorResponse.details && { details: errorResponse.details }),
      });
    } finally {
      if (pool) {
        try {
          await pool.end();
        } catch (endError) {
          console.error('Fehler beim Schließen der DB-Verbindung:', endError);
        }
      }
    }
  }

  /**
   * Gibt Indizes einer Tabelle zurück
   */
  async getTableIndexes(companyId: string, tableName: string) {
    if (!validateTableName(tableName)) {
      throw new BadRequestException('Ungültiger Tabellenname');
    }

    let pool: Pool | null = null;

    try {
      const company = await this.findOne(companyId);
      if (!company.dbConfig) {
        throw new NotFoundException(`DB-Config für Company ${companyId} nicht gefunden`);
      }

      // Passwort entschlüsseln mit Fehlerbehandlung
      let decryptedPassword: string;
      try {
        decryptedPassword = this.encryptionService.decrypt(company.dbConfig.dbPassword);
      } catch (error: any) {
        const errorMsg = error?.message || String(error);
        throw new BadRequestException(`Fehler beim Entschlüsseln des DB-Passworts: ${errorMsg}`);
      }

      // Stelle sicher, dass das Passwort ein String ist und nicht leer
      if (decryptedPassword == null || typeof decryptedPassword !== 'string') {
        throw new BadRequestException(
          'Datenbank-Passwort konnte nicht korrekt entschlüsselt werden oder ist ungültig'
        );
      }

      if (decryptedPassword.trim().length === 0) {
        throw new BadRequestException('Datenbank-Passwort ist leer nach der Entschlüsselung');
      }

      pool = await createTenantDbPool({
        dbHost: company.dbConfig.dbHost,
        dbPort: company.dbConfig.dbPort,
        dbName: company.dbConfig.dbName,
        dbUser: company.dbConfig.dbUser,
        dbPassword: decryptedPassword,
        dbSslMode: company.dbConfig.dbSslMode,
      });

      const result = await pool.query(
        `
        SELECT 
          indexname,
          indexdef
        FROM pg_indexes
        WHERE schemaname = 'public' AND tablename = $1
      `,
        [tableName]
      );

      return result.rows.map((row) => ({
        indexName: row.indexname,
        indexDefinition: row.indexdef,
      }));
    } catch (error: any) {
      const isDevelopment = process.env.NODE_ENV === 'development';
      const errorResponse = formatQueryError(error, isDevelopment);
      throw new BadRequestException({
        message: errorResponse.message,
        code: errorResponse.code,
        ...(errorResponse.details && { details: errorResponse.details }),
      });
    } finally {
      if (pool) {
        try {
          await pool.end();
        } catch (endError) {
          console.error('Fehler beim Schließen der DB-Verbindung:', endError);
        }
      }
    }
  }

  /**
   * Gibt Foreign Keys einer Tabelle zurück
   */
  async getTableForeignKeys(companyId: string, tableName: string) {
    if (!validateTableName(tableName)) {
      throw new BadRequestException('Ungültiger Tabellenname');
    }

    let pool: Pool | null = null;

    try {
      const company = await this.findOne(companyId);
      if (!company.dbConfig) {
        throw new NotFoundException(`DB-Config für Company ${companyId} nicht gefunden`);
      }

      // Passwort entschlüsseln mit Fehlerbehandlung
      let decryptedPassword: string;
      try {
        decryptedPassword = this.encryptionService.decrypt(company.dbConfig.dbPassword);
      } catch (error: any) {
        const errorMsg = error?.message || String(error);
        throw new BadRequestException(`Fehler beim Entschlüsseln des DB-Passworts: ${errorMsg}`);
      }

      // Stelle sicher, dass das Passwort ein String ist und nicht leer
      if (decryptedPassword == null || typeof decryptedPassword !== 'string') {
        throw new BadRequestException(
          'Datenbank-Passwort konnte nicht korrekt entschlüsselt werden oder ist ungültig'
        );
      }

      if (decryptedPassword.trim().length === 0) {
        throw new BadRequestException('Datenbank-Passwort ist leer nach der Entschlüsselung');
      }

      pool = await createTenantDbPool({
        dbHost: company.dbConfig.dbHost,
        dbPort: company.dbConfig.dbPort,
        dbName: company.dbConfig.dbName,
        dbUser: company.dbConfig.dbUser,
        dbPassword: decryptedPassword,
        dbSslMode: company.dbConfig.dbSslMode,
      });

      const result = await pool.query(
        `
        SELECT
          tc.constraint_name,
          kcu.column_name,
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY' 
          AND tc.table_schema = 'public'
          AND tc.table_name = $1
      `,
        [tableName]
      );

      return result.rows.map((row) => ({
        constraintName: row.constraint_name,
        columnName: row.column_name,
        foreignTableName: row.foreign_table_name,
        foreignColumnName: row.foreign_column_name,
      }));
    } catch (error: any) {
      const isDevelopment = process.env.NODE_ENV === 'development';
      const errorResponse = formatQueryError(error, isDevelopment);
      throw new BadRequestException({
        message: errorResponse.message,
        code: errorResponse.code,
        ...(errorResponse.details && { details: errorResponse.details }),
      });
    } finally {
      if (pool) {
        try {
          await pool.end();
        } catch (endError) {
          console.error('Fehler beim Schließen der DB-Verbindung:', endError);
        }
      }
    }
  }

  /**
   * Gibt alle Constraints einer Tabelle zurück
   */
  async getTableConstraints(companyId: string, tableName: string) {
    if (!validateTableName(tableName)) {
      throw new BadRequestException('Ungültiger Tabellenname');
    }

    let pool: Pool | null = null;

    try {
      const company = await this.findOne(companyId);
      if (!company.dbConfig) {
        throw new NotFoundException(`DB-Config für Company ${companyId} nicht gefunden`);
      }

      // Passwort entschlüsseln mit Fehlerbehandlung
      let decryptedPassword: string;
      try {
        decryptedPassword = this.encryptionService.decrypt(company.dbConfig.dbPassword);
      } catch (error: any) {
        const errorMsg = error?.message || String(error);
        throw new BadRequestException(`Fehler beim Entschlüsseln des DB-Passworts: ${errorMsg}`);
      }

      // Stelle sicher, dass das Passwort ein String ist und nicht leer
      if (decryptedPassword == null || typeof decryptedPassword !== 'string') {
        throw new BadRequestException(
          'Datenbank-Passwort konnte nicht korrekt entschlüsselt werden oder ist ungültig'
        );
      }

      if (decryptedPassword.trim().length === 0) {
        throw new BadRequestException('Datenbank-Passwort ist leer nach der Entschlüsselung');
      }

      pool = await createTenantDbPool({
        dbHost: company.dbConfig.dbHost,
        dbPort: company.dbConfig.dbPort,
        dbName: company.dbConfig.dbName,
        dbUser: company.dbConfig.dbUser,
        dbPassword: decryptedPassword,
        dbSslMode: company.dbConfig.dbSslMode,
      });

      const result = await pool.query(
        `
        SELECT
          constraint_name,
          constraint_type
        FROM information_schema.table_constraints
        WHERE table_schema = 'public' AND table_name = $1
      `,
        [tableName]
      );

      return result.rows.map((row) => ({
        constraintName: row.constraint_name,
        constraintType: row.constraint_type,
      }));
    } catch (error: any) {
      const isDevelopment = process.env.NODE_ENV === 'development';
      const errorResponse = formatQueryError(error, isDevelopment);
      throw new BadRequestException({
        message: errorResponse.message,
        code: errorResponse.code,
        ...(errorResponse.details && { details: errorResponse.details }),
      });
    } finally {
      if (pool) {
        try {
          await pool.end();
        } catch (endError) {
          console.error('Fehler beim Schließen der DB-Verbindung:', endError);
        }
      }
    }
  }

  /**
   * Gibt Tabellen-Statistiken zurück (Zeilenanzahl, Größe)
   */
  async getTableStats(companyId: string, tableName: string) {
    if (!validateTableName(tableName)) {
      throw new BadRequestException('Ungültiger Tabellenname');
    }

    let pool: Pool | null = null;

    try {
      const company = await this.findOne(companyId);
      if (!company.dbConfig) {
        throw new NotFoundException(`DB-Config für Company ${companyId} nicht gefunden`);
      }

      // Passwort entschlüsseln mit Fehlerbehandlung
      let decryptedPassword: string;
      try {
        decryptedPassword = this.encryptionService.decrypt(company.dbConfig.dbPassword);
      } catch (error: any) {
        const errorMsg = error?.message || String(error);
        throw new BadRequestException(`Fehler beim Entschlüsseln des DB-Passworts: ${errorMsg}`);
      }

      // Stelle sicher, dass das Passwort ein String ist und nicht leer
      if (decryptedPassword == null || typeof decryptedPassword !== 'string') {
        throw new BadRequestException(
          'Datenbank-Passwort konnte nicht korrekt entschlüsselt werden oder ist ungültig'
        );
      }

      if (decryptedPassword.trim().length === 0) {
        throw new BadRequestException('Datenbank-Passwort ist leer nach der Entschlüsselung');
      }

      pool = await createTenantDbPool({
        dbHost: company.dbConfig.dbHost,
        dbPort: company.dbConfig.dbPort,
        dbName: company.dbConfig.dbName,
        dbUser: company.dbConfig.dbUser,
        dbPassword: decryptedPassword,
        dbSslMode: company.dbConfig.dbSslMode,
      });

      // tableName wurde bereits validiert
      const result = await pool.query(`
        SELECT 
          (SELECT COUNT(*) FROM "${tableName}") as row_count,
          pg_size_pretty(pg_total_relation_size('public.${tableName}'::regclass)) as total_size,
          pg_size_pretty(pg_relation_size('public.${tableName}'::regclass)) as table_size
      `);

      return {
        rowCount: parseInt(result.rows[0].row_count, 10),
        totalSize: result.rows[0].total_size,
        tableSize: result.rows[0].table_size,
      };
    } catch (error: any) {
      const isDevelopment = process.env.NODE_ENV === 'development';
      const errorResponse = formatQueryError(error, isDevelopment);
      throw new BadRequestException({
        message: errorResponse.message,
        code: errorResponse.code,
        ...(errorResponse.details && { details: errorResponse.details }),
      });
    } finally {
      if (pool) {
        try {
          await pool.end();
        } catch (endError) {
          console.error('Fehler beim Schließen der DB-Verbindung:', endError);
        }
      }
    }
  }

  /**
   * Gibt Datenbank-Metadaten zurück
   */
  async getDatabaseInfo(companyId: string) {
    let pool: Pool | null = null;

    try {
      const company = await this.findOne(companyId);
      if (!company.dbConfig) {
        throw new NotFoundException(`DB-Config für Company ${companyId} nicht gefunden`);
      }

      if (company.dbConfig.provisioningStatus !== 'ready') {
        throw new BadRequestException(
          `Datenbank für Company ${companyId} ist noch nicht bereit (Status: ${company.dbConfig.provisioningStatus})`
        );
      }

      // Prüfe, ob Passwort vorhanden ist
      if (!company.dbConfig.dbPassword) {
        throw new BadRequestException({
          message: 'Datenbank-Passwort ist nicht in der DB-Config vorhanden',
          code: 'MISSING_PASSWORD',
        });
      }

      // Passwort entschlüsseln mit Fehlerbehandlung
      let decryptedPassword: string;
      try {
        // Prüfe, ob das verschlüsselte Passwort im erwarteten Format ist
        if (!company.dbConfig.dbPassword || typeof company.dbConfig.dbPassword !== 'string') {
          throw new BadRequestException({
            message: 'Datenbank-Passwort ist nicht im erwarteten Format (nicht verschlüsselt?)',
            code: 'INVALID_PASSWORD_FORMAT',
          });
        }

        // Prüfe, ob das Format dem Verschlüsselungsformat entspricht (sollte "salt:iv:tag:encrypted" sein)
        const parts = company.dbConfig.dbPassword.split(':');
        if (parts.length !== 4) {
          throw new BadRequestException({
            message: `Datenbank-Passwort hat nicht das erwartete Verschlüsselungsformat (${parts.length} Teile statt 4). Möglicherweise ist das Passwort nicht verschlüsselt.`,
            code: 'INVALID_ENCRYPTION_FORMAT',
          });
        }

        decryptedPassword = this.encryptionService.decrypt(company.dbConfig.dbPassword);

        // Debug-Logging (nur in Development)
        if (process.env.NODE_ENV === 'development') {
          console.log(
            `[DB-Password] Company ${companyId}: Passwort-Länge nach Entschlüsselung: ${decryptedPassword?.length || 0}`
          );
        }
      } catch (error: any) {
        // Wenn es bereits eine BadRequestException ist, weiterwerfen
        if (error instanceof BadRequestException) {
          throw error;
        }
        const errorMsg = error?.message || String(error);
        throw new BadRequestException({
          message: `Fehler beim Entschlüsseln des DB-Passworts: ${errorMsg}`,
          code: 'DECRYPTION_ERROR',
          details:
            process.env.NODE_ENV === 'development' ? { originalError: error?.message } : undefined,
        });
      }

      // Stelle sicher, dass das Passwort ein String ist und nicht leer
      if (decryptedPassword == null || typeof decryptedPassword !== 'string') {
        throw new BadRequestException({
          message: `Datenbank-Passwort konnte nicht korrekt entschlüsselt werden. Typ: ${typeof decryptedPassword}, Wert: ${decryptedPassword === null ? 'null' : decryptedPassword === undefined ? 'undefined' : 'unbekannt'}`,
          code: 'INVALID_PASSWORD_TYPE',
        });
      }

      if (decryptedPassword.trim().length === 0) {
        throw new BadRequestException({
          message:
            'Datenbank-Passwort ist leer nach der Entschlüsselung. Möglicherweise wurde ein leeres Passwort verschlüsselt oder die Entschlüsselung hat ein leeres Ergebnis zurückgegeben.',
          code: 'EMPTY_PASSWORD',
        });
      }

      pool = await createTenantDbPool({
        dbHost: company.dbConfig.dbHost,
        dbPort: company.dbConfig.dbPort,
        dbName: company.dbConfig.dbName,
        dbUser: company.dbConfig.dbUser,
        dbPassword: decryptedPassword,
        dbSslMode: company.dbConfig.dbSslMode,
      });

      const result = await pool.query(`
        SELECT 
          version() as postgres_version,
          pg_database_size(current_database()) as database_size_bytes,
          pg_size_pretty(pg_database_size(current_database())) as database_size,
          current_database() as database_name
      `);

      return {
        postgresVersion: result.rows[0].postgres_version,
        databaseSizeBytes: parseInt(result.rows[0].database_size_bytes, 10),
        databaseSize: result.rows[0].database_size,
        databaseName: result.rows[0].database_name,
      };
    } catch (error: any) {
      const isDevelopment = process.env.NODE_ENV === 'development';
      const errorResponse = formatQueryError(error, isDevelopment);
      throw new BadRequestException({
        message: errorResponse.message,
        code: errorResponse.code,
        ...(errorResponse.details && { details: errorResponse.details }),
      });
    } finally {
      if (pool) {
        try {
          await pool.end();
        } catch (endError) {
          console.error('Fehler beim Schließen der DB-Verbindung:', endError);
        }
      }
    }
  }

  /**
   * Gibt Liste aller Views zurück
   */
  async getViews(companyId: string) {
    let pool: Pool | null = null;

    try {
      const company = await this.findOne(companyId);
      if (!company.dbConfig) {
        throw new NotFoundException(`DB-Config für Company ${companyId} nicht gefunden`);
      }

      if (company.dbConfig.provisioningStatus !== 'ready') {
        throw new BadRequestException(
          `Datenbank für Company ${companyId} ist noch nicht bereit (Status: ${company.dbConfig.provisioningStatus})`
        );
      }

      // Prüfe, ob Passwort vorhanden ist
      if (!company.dbConfig.dbPassword) {
        throw new BadRequestException({
          message: 'Datenbank-Passwort ist nicht in der DB-Config vorhanden',
          code: 'MISSING_PASSWORD',
        });
      }

      // Passwort entschlüsseln mit Fehlerbehandlung
      let decryptedPassword: string;
      try {
        // Prüfe, ob das verschlüsselte Passwort im erwarteten Format ist
        if (!company.dbConfig.dbPassword || typeof company.dbConfig.dbPassword !== 'string') {
          throw new BadRequestException({
            message: 'Datenbank-Passwort ist nicht im erwarteten Format (nicht verschlüsselt?)',
            code: 'INVALID_PASSWORD_FORMAT',
          });
        }

        // Prüfe, ob das Format dem Verschlüsselungsformat entspricht (sollte "salt:iv:tag:encrypted" sein)
        const parts = company.dbConfig.dbPassword.split(':');
        if (parts.length !== 4) {
          throw new BadRequestException({
            message: `Datenbank-Passwort hat nicht das erwartete Verschlüsselungsformat (${parts.length} Teile statt 4). Möglicherweise ist das Passwort nicht verschlüsselt.`,
            code: 'INVALID_ENCRYPTION_FORMAT',
          });
        }

        decryptedPassword = this.encryptionService.decrypt(company.dbConfig.dbPassword);

        // Debug-Logging (nur in Development)
        if (process.env.NODE_ENV === 'development') {
          console.log(
            `[DB-Password] Company ${companyId}: Passwort-Länge nach Entschlüsselung: ${decryptedPassword?.length || 0}`
          );
        }
      } catch (error: any) {
        // Wenn es bereits eine BadRequestException ist, weiterwerfen
        if (error instanceof BadRequestException) {
          throw error;
        }
        const errorMsg = error?.message || String(error);
        throw new BadRequestException({
          message: `Fehler beim Entschlüsseln des DB-Passworts: ${errorMsg}`,
          code: 'DECRYPTION_ERROR',
          details:
            process.env.NODE_ENV === 'development' ? { originalError: error?.message } : undefined,
        });
      }

      // Stelle sicher, dass das Passwort ein String ist und nicht leer
      if (decryptedPassword == null || typeof decryptedPassword !== 'string') {
        throw new BadRequestException({
          message: `Datenbank-Passwort konnte nicht korrekt entschlüsselt werden. Typ: ${typeof decryptedPassword}, Wert: ${decryptedPassword === null ? 'null' : decryptedPassword === undefined ? 'undefined' : 'unbekannt'}`,
          code: 'INVALID_PASSWORD_TYPE',
        });
      }

      if (decryptedPassword.trim().length === 0) {
        throw new BadRequestException({
          message:
            'Datenbank-Passwort ist leer nach der Entschlüsselung. Möglicherweise wurde ein leeres Passwort verschlüsselt oder die Entschlüsselung hat ein leeres Ergebnis zurückgegeben.',
          code: 'EMPTY_PASSWORD',
        });
      }

      pool = await createTenantDbPool({
        dbHost: company.dbConfig.dbHost,
        dbPort: company.dbConfig.dbPort,
        dbName: company.dbConfig.dbName,
        dbUser: company.dbConfig.dbUser,
        dbPassword: decryptedPassword,
        dbSslMode: company.dbConfig.dbSslMode,
      });

      const result = await pool.query(`
        SELECT table_name
        FROM information_schema.views
        WHERE table_schema = 'public'
        ORDER BY table_name
      `);

      return result.rows.map((row) => ({
        viewName: row.table_name,
      }));
    } catch (error: any) {
      const isDevelopment = process.env.NODE_ENV === 'development';
      const errorResponse = formatQueryError(error, isDevelopment);
      throw new BadRequestException({
        message: errorResponse.message,
        code: errorResponse.code,
        ...(errorResponse.details && { details: errorResponse.details }),
      });
    } finally {
      if (pool) {
        try {
          await pool.end();
        } catch (endError) {
          console.error('Fehler beim Schließen der DB-Verbindung:', endError);
        }
      }
    }
  }

  /**
   * Gibt Liste aller Sequences zurück
   */
  async getSequences(companyId: string) {
    let pool: Pool | null = null;

    try {
      const company = await this.findOne(companyId);
      if (!company.dbConfig) {
        throw new NotFoundException(`DB-Config für Company ${companyId} nicht gefunden`);
      }

      if (company.dbConfig.provisioningStatus !== 'ready') {
        throw new BadRequestException(
          `Datenbank für Company ${companyId} ist noch nicht bereit (Status: ${company.dbConfig.provisioningStatus})`
        );
      }

      // Prüfe, ob Passwort vorhanden ist
      if (!company.dbConfig.dbPassword) {
        throw new BadRequestException({
          message: 'Datenbank-Passwort ist nicht in der DB-Config vorhanden',
          code: 'MISSING_PASSWORD',
        });
      }

      // Passwort entschlüsseln mit Fehlerbehandlung
      let decryptedPassword: string;
      try {
        // Prüfe, ob das verschlüsselte Passwort im erwarteten Format ist
        if (!company.dbConfig.dbPassword || typeof company.dbConfig.dbPassword !== 'string') {
          throw new BadRequestException({
            message: 'Datenbank-Passwort ist nicht im erwarteten Format (nicht verschlüsselt?)',
            code: 'INVALID_PASSWORD_FORMAT',
          });
        }

        // Prüfe, ob das Format dem Verschlüsselungsformat entspricht (sollte "salt:iv:tag:encrypted" sein)
        const parts = company.dbConfig.dbPassword.split(':');
        if (parts.length !== 4) {
          throw new BadRequestException({
            message: `Datenbank-Passwort hat nicht das erwartete Verschlüsselungsformat (${parts.length} Teile statt 4). Möglicherweise ist das Passwort nicht verschlüsselt.`,
            code: 'INVALID_ENCRYPTION_FORMAT',
          });
        }

        decryptedPassword = this.encryptionService.decrypt(company.dbConfig.dbPassword);

        // Debug-Logging (nur in Development)
        if (process.env.NODE_ENV === 'development') {
          console.log(
            `[DB-Password] Company ${companyId}: Passwort-Länge nach Entschlüsselung: ${decryptedPassword?.length || 0}`
          );
        }
      } catch (error: any) {
        // Wenn es bereits eine BadRequestException ist, weiterwerfen
        if (error instanceof BadRequestException) {
          throw error;
        }
        const errorMsg = error?.message || String(error);
        throw new BadRequestException({
          message: `Fehler beim Entschlüsseln des DB-Passworts: ${errorMsg}`,
          code: 'DECRYPTION_ERROR',
          details:
            process.env.NODE_ENV === 'development' ? { originalError: error?.message } : undefined,
        });
      }

      // Stelle sicher, dass das Passwort ein String ist und nicht leer
      if (decryptedPassword == null || typeof decryptedPassword !== 'string') {
        throw new BadRequestException({
          message: `Datenbank-Passwort konnte nicht korrekt entschlüsselt werden. Typ: ${typeof decryptedPassword}, Wert: ${decryptedPassword === null ? 'null' : decryptedPassword === undefined ? 'undefined' : 'unbekannt'}`,
          code: 'INVALID_PASSWORD_TYPE',
        });
      }

      if (decryptedPassword.trim().length === 0) {
        throw new BadRequestException({
          message:
            'Datenbank-Passwort ist leer nach der Entschlüsselung. Möglicherweise wurde ein leeres Passwort verschlüsselt oder die Entschlüsselung hat ein leeres Ergebnis zurückgegeben.',
          code: 'EMPTY_PASSWORD',
        });
      }

      pool = await createTenantDbPool({
        dbHost: company.dbConfig.dbHost,
        dbPort: company.dbConfig.dbPort,
        dbName: company.dbConfig.dbName,
        dbUser: company.dbConfig.dbUser,
        dbPassword: decryptedPassword,
        dbSslMode: company.dbConfig.dbSslMode,
      });

      const result = await pool.query(`
        SELECT sequence_name
        FROM information_schema.sequences
        WHERE sequence_schema = 'public'
        ORDER BY sequence_name
      `);

      return result.rows.map((row) => ({
        sequenceName: row.sequence_name,
      }));
    } catch (error: any) {
      const isDevelopment = process.env.NODE_ENV === 'development';
      const errorResponse = formatQueryError(error, isDevelopment);
      throw new BadRequestException({
        message: errorResponse.message,
        code: errorResponse.code,
        ...(errorResponse.details && { details: errorResponse.details }),
      });
    } finally {
      if (pool) {
        try {
          await pool.end();
        } catch (endError) {
          console.error('Fehler beim Schließen der DB-Verbindung:', endError);
        }
      }
    }
  }

  /**
   * Gibt Liste aller Functions zurück
   */
  async getFunctions(companyId: string) {
    let pool: Pool | null = null;

    try {
      const company = await this.findOne(companyId);
      if (!company.dbConfig) {
        throw new NotFoundException(`DB-Config für Company ${companyId} nicht gefunden`);
      }

      if (company.dbConfig.provisioningStatus !== 'ready') {
        throw new BadRequestException(
          `Datenbank für Company ${companyId} ist noch nicht bereit (Status: ${company.dbConfig.provisioningStatus})`
        );
      }

      // Prüfe, ob Passwort vorhanden ist
      if (!company.dbConfig.dbPassword) {
        throw new BadRequestException({
          message: 'Datenbank-Passwort ist nicht in der DB-Config vorhanden',
          code: 'MISSING_PASSWORD',
        });
      }

      // Passwort entschlüsseln mit Fehlerbehandlung
      let decryptedPassword: string;
      try {
        // Prüfe, ob das verschlüsselte Passwort im erwarteten Format ist
        if (!company.dbConfig.dbPassword || typeof company.dbConfig.dbPassword !== 'string') {
          throw new BadRequestException({
            message: 'Datenbank-Passwort ist nicht im erwarteten Format (nicht verschlüsselt?)',
            code: 'INVALID_PASSWORD_FORMAT',
          });
        }

        // Prüfe, ob das Format dem Verschlüsselungsformat entspricht (sollte "salt:iv:tag:encrypted" sein)
        const parts = company.dbConfig.dbPassword.split(':');
        if (parts.length !== 4) {
          throw new BadRequestException({
            message: `Datenbank-Passwort hat nicht das erwartete Verschlüsselungsformat (${parts.length} Teile statt 4). Möglicherweise ist das Passwort nicht verschlüsselt.`,
            code: 'INVALID_ENCRYPTION_FORMAT',
          });
        }

        decryptedPassword = this.encryptionService.decrypt(company.dbConfig.dbPassword);

        // Debug-Logging (nur in Development)
        if (process.env.NODE_ENV === 'development') {
          console.log(
            `[DB-Password] Company ${companyId}: Passwort-Länge nach Entschlüsselung: ${decryptedPassword?.length || 0}`
          );
        }
      } catch (error: any) {
        // Wenn es bereits eine BadRequestException ist, weiterwerfen
        if (error instanceof BadRequestException) {
          throw error;
        }
        const errorMsg = error?.message || String(error);
        throw new BadRequestException({
          message: `Fehler beim Entschlüsseln des DB-Passworts: ${errorMsg}`,
          code: 'DECRYPTION_ERROR',
          details:
            process.env.NODE_ENV === 'development' ? { originalError: error?.message } : undefined,
        });
      }

      // Stelle sicher, dass das Passwort ein String ist und nicht leer
      if (decryptedPassword == null || typeof decryptedPassword !== 'string') {
        throw new BadRequestException({
          message: `Datenbank-Passwort konnte nicht korrekt entschlüsselt werden. Typ: ${typeof decryptedPassword}, Wert: ${decryptedPassword === null ? 'null' : decryptedPassword === undefined ? 'undefined' : 'unbekannt'}`,
          code: 'INVALID_PASSWORD_TYPE',
        });
      }

      if (decryptedPassword.trim().length === 0) {
        throw new BadRequestException({
          message:
            'Datenbank-Passwort ist leer nach der Entschlüsselung. Möglicherweise wurde ein leeres Passwort verschlüsselt oder die Entschlüsselung hat ein leeres Ergebnis zurückgegeben.',
          code: 'EMPTY_PASSWORD',
        });
      }

      pool = await createTenantDbPool({
        dbHost: company.dbConfig.dbHost,
        dbPort: company.dbConfig.dbPort,
        dbName: company.dbConfig.dbName,
        dbUser: company.dbConfig.dbUser,
        dbPassword: decryptedPassword,
        dbSslMode: company.dbConfig.dbSslMode,
      });

      const result = await pool.query(`
        SELECT 
          routine_name,
          routine_type
        FROM information_schema.routines
        WHERE routine_schema = 'public'
        ORDER BY routine_name
      `);

      return result.rows.map((row) => ({
        functionName: row.routine_name,
        routineType: row.routine_type,
      }));
    } catch (error: any) {
      const isDevelopment = process.env.NODE_ENV === 'development';
      const errorResponse = formatQueryError(error, isDevelopment);
      throw new BadRequestException({
        message: errorResponse.message,
        code: errorResponse.code,
        ...(errorResponse.details && { details: errorResponse.details }),
      });
    } finally {
      if (pool) {
        try {
          await pool.end();
        } catch (endError) {
          console.error('Fehler beim Schließen der DB-Verbindung:', endError);
        }
      }
    }
  }

  /**
   * Führt EXPLAIN ANALYZE für eine Query aus
   */
  async explainQuery(companyId: string, query: string) {
    let pool: Pool | null = null;

    try {
      const company = await this.findOne(companyId);
      if (!company.dbConfig) {
        throw new NotFoundException(`DB-Config für Company ${companyId} nicht gefunden`);
      }

      if (company.dbConfig.provisioningStatus !== 'ready') {
        throw new BadRequestException(
          `Datenbank für Company ${companyId} ist noch nicht bereit (Status: ${company.dbConfig.provisioningStatus})`
        );
      }

      // Prüfe, ob Passwort vorhanden ist
      if (!company.dbConfig.dbPassword) {
        throw new BadRequestException({
          message: 'Datenbank-Passwort ist nicht in der DB-Config vorhanden',
          code: 'MISSING_PASSWORD',
        });
      }

      // Passwort entschlüsseln mit Fehlerbehandlung
      let decryptedPassword: string;
      try {
        // Prüfe, ob das verschlüsselte Passwort im erwarteten Format ist
        if (!company.dbConfig.dbPassword || typeof company.dbConfig.dbPassword !== 'string') {
          throw new BadRequestException({
            message: 'Datenbank-Passwort ist nicht im erwarteten Format (nicht verschlüsselt?)',
            code: 'INVALID_PASSWORD_FORMAT',
          });
        }

        // Prüfe, ob das Format dem Verschlüsselungsformat entspricht (sollte "salt:iv:tag:encrypted" sein)
        const parts = company.dbConfig.dbPassword.split(':');
        if (parts.length !== 4) {
          throw new BadRequestException({
            message: `Datenbank-Passwort hat nicht das erwartete Verschlüsselungsformat (${parts.length} Teile statt 4). Möglicherweise ist das Passwort nicht verschlüsselt.`,
            code: 'INVALID_ENCRYPTION_FORMAT',
          });
        }

        decryptedPassword = this.encryptionService.decrypt(company.dbConfig.dbPassword);

        // Debug-Logging (nur in Development)
        if (process.env.NODE_ENV === 'development') {
          console.log(
            `[DB-Password] Company ${companyId}: Passwort-Länge nach Entschlüsselung: ${decryptedPassword?.length || 0}`
          );
        }
      } catch (error: any) {
        // Wenn es bereits eine BadRequestException ist, weiterwerfen
        if (error instanceof BadRequestException) {
          throw error;
        }
        const errorMsg = error?.message || String(error);
        throw new BadRequestException({
          message: `Fehler beim Entschlüsseln des DB-Passworts: ${errorMsg}`,
          code: 'DECRYPTION_ERROR',
          details:
            process.env.NODE_ENV === 'development' ? { originalError: error?.message } : undefined,
        });
      }

      // Stelle sicher, dass das Passwort ein String ist und nicht leer
      if (decryptedPassword == null || typeof decryptedPassword !== 'string') {
        throw new BadRequestException({
          message: `Datenbank-Passwort konnte nicht korrekt entschlüsselt werden. Typ: ${typeof decryptedPassword}, Wert: ${decryptedPassword === null ? 'null' : decryptedPassword === undefined ? 'undefined' : 'unbekannt'}`,
          code: 'INVALID_PASSWORD_TYPE',
        });
      }

      if (decryptedPassword.trim().length === 0) {
        throw new BadRequestException({
          message:
            'Datenbank-Passwort ist leer nach der Entschlüsselung. Möglicherweise wurde ein leeres Passwort verschlüsselt oder die Entschlüsselung hat ein leeres Ergebnis zurückgegeben.',
          code: 'EMPTY_PASSWORD',
        });
      }

      pool = await createTenantDbPool({
        dbHost: company.dbConfig.dbHost,
        dbPort: company.dbConfig.dbPort,
        dbName: company.dbConfig.dbName,
        dbUser: company.dbConfig.dbUser,
        dbPassword: decryptedPassword,
        dbSslMode: company.dbConfig.dbSslMode,
      });

      const explainQuery = `EXPLAIN ANALYZE ${query}`;
      const result = await pool.query(explainQuery);

      // PostgreSQL gibt EXPLAIN-Ergebnisse als Array von Objekten zurück
      // Jede Zeile hat ein 'QUERY PLAN' Feld
      const queryPlan = result.rows
        .map((row) => {
          // pg gibt das Ergebnis als Objekt mit 'QUERY PLAN' Key zurück
          const plan = row['QUERY PLAN'] || row['query plan'] || Object.values(row)[0];
          return plan;
        })
        .join('\n');

      return {
        queryPlan,
      };
    } catch (error: any) {
      const isDevelopment = process.env.NODE_ENV === 'development';
      const errorResponse = formatQueryError(error, isDevelopment);
      throw new BadRequestException({
        message: errorResponse.message,
        code: errorResponse.code,
        ...(errorResponse.details && { details: errorResponse.details }),
      });
    } finally {
      if (pool) {
        try {
          await pool.end();
        } catch (endError) {
          console.error('Fehler beim Schließen der DB-Verbindung:', endError);
        }
      }
    }
  }

  /**
   * Berechnet die Größe eines Verzeichnisses rekursiv
   * @param basePath - Basis-Pfad für Validierung
   * @param targetPath - Ziel-Verzeichnis
   * @param timeout - Timeout in Millisekunden
   * @returns Objekt mit sizeBytes und count
   */
  private async calculateDirectorySize(
    basePath: string,
    targetPath: string,
    timeout: number = 30000
  ): Promise<{ sizeBytes: number; count: number }> {
    const startTime = Date.now();
    console.log(`[StorageUsage] Starte Verzeichnisberechnung: ${targetPath}`);

    // Path-Validierung: Sicherstellen, dass targetPath innerhalb von basePath liegt
    const resolvedBase = path.resolve(basePath);
    const resolvedTarget = path.resolve(targetPath);

    // Normalisiere Pfade für plattformunabhängigen Vergleich (Windows vs. Unix)
    const normalizedBase = path.normalize(resolvedBase).toLowerCase();
    const normalizedTarget = path.normalize(resolvedTarget).toLowerCase();

    console.log(`[StorageUsage] Base-Pfad (resolved): ${resolvedBase}`);
    console.log(`[StorageUsage] Target-Pfad (resolved): ${resolvedTarget}`);
    console.log(`[StorageUsage] Base-Pfad (normalized): ${normalizedBase}`);
    console.log(`[StorageUsage] Target-Pfad (normalized): ${normalizedTarget}`);

    if (!normalizedTarget.startsWith(normalizedBase)) {
      console.error(`[StorageUsage] Path-Traversal-Versuch erkannt!`);
      console.error(`[StorageUsage] Base: ${resolvedBase} (normalized: ${normalizedBase})`);
      console.error(`[StorageUsage] Target: ${resolvedTarget} (normalized: ${normalizedTarget})`);
      console.error(`[StorageUsage] Target startet nicht mit Base`);
      throw new Error('Path-Traversal-Versuch erkannt');
    }

    // AbortController für korrektes Timeout-Handling
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => {
      console.warn(`[StorageUsage] Timeout bei Verzeichnisberechnung: ${targetPath}`);
      abortController.abort();
    }, timeout);

    try {
      let totalSize = 0;
      let fileCount = 0;
      let aborted = false;

      const walkDir = async (dir: string): Promise<void> => {
        if (abortController.signal.aborted) {
          aborted = true;
          return;
        }

        try {
          // Prüfe vor jedem readdir, ob abgebrochen wurde
          if (abortController.signal.aborted) {
            aborted = true;
            return;
          }
          const entries = await fs.readdir(dir, {
            withFileTypes: true,
          });

          for (const entry of entries) {
            if (abortController.signal.aborted) {
              aborted = true;
              return;
            }

            const fullPath = path.join(dir, entry.name);

            if (entry.isDirectory()) {
              // Symlinks überspringen
              const stats = await fs.lstat(fullPath);
              if (!stats.isSymbolicLink()) {
                await walkDir(fullPath);
              }
            } else if (entry.isFile()) {
              try {
                const stats = await fs.stat(fullPath);
                totalSize += stats.size;
                fileCount++;
              } catch (error) {
                // Berechtigungsfehler ignorieren, aber loggen
                console.warn(`[StorageUsage] Fehler beim Lesen von ${fullPath}:`, error);
              }
            }
          }
        } catch (error: any) {
          if (error.name === 'AbortError') {
            aborted = true;
            return;
          }
          // Verzeichnis nicht lesbar - ignorieren
          console.warn(`[StorageUsage] Fehler beim Lesen von Verzeichnis ${dir}:`, error);
        }
      };

      await walkDir(resolvedTarget);
      clearTimeout(timeoutId);

      if (aborted) {
        throw new Error('Timeout bei Verzeichnisberechnung');
      }

      const executionTime = Date.now() - startTime;
      console.log(
        `[StorageUsage] Verzeichnisberechnung abgeschlossen: ${targetPath}, ${fileCount} Dateien, ${totalSize} bytes in ${executionTime}ms`
      );
      return { sizeBytes: totalSize, count: fileCount };
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError' || error.message === 'Timeout bei Verzeichnisberechnung') {
        throw new Error('Timeout bei Verzeichnisberechnung');
      }
      throw error;
    }
  }

  /**
   * Bereinigt abgelaufene Cache-Einträge
   * @param force - Wenn true, wird Cleanup auch bei kleinem Cache ausgeführt
   */
  private cleanupExpiredCache(force: boolean = false): void {
    const cacheSize = this.storageCache.size;
    const cleanupInterval = parseInt(process.env.STORAGE_CACHE_CLEANUP_INTERVAL || '600000', 10);
    const threshold = parseInt(process.env.STORAGE_CACHE_CLEANUP_THRESHOLD || '100', 10);

    // Nur cleanup ausführen wenn Cache groß ist, erzwungen oder Intervall abgelaufen
    const timeSinceLastCleanup = Date.now() - this.lastCacheCleanup;
    if (!force && cacheSize < threshold && timeSinceLastCleanup < cleanupInterval) {
      return;
    }

    const now = Date.now();
    let cleaned = 0;
    for (const [key, value] of this.storageCache.entries()) {
      if (value.expiresAt < now) {
        this.storageCache.delete(key);
        cleaned++;
      }
    }
    if (cleaned > 0) {
      console.log(
        `[StorageUsage] Cache-Cleanup: ${cleaned} abgelaufene Einträge entfernt (${cacheSize} → ${this.storageCache.size})`
      );
    }
    this.lastCacheCleanup = Date.now();
  }

  /**
   * Invalidiert den Storage-Cache für eine Company
   * @param companyId - UUID der Firma
   */
  invalidateStorageCache(companyId: string): void {
    const cacheKey = `storage_usage_${companyId}`;
    if (this.storageCache.has(cacheKey)) {
      this.storageCache.delete(cacheKey);
      console.log(`[StorageUsage] Cache invalidiert für Company: ${companyId}`);
    }
  }

  /**
   * Gibt detaillierte Speicherplatz-Informationen für eine Firma zurück
   * @param companyId - UUID der Firma
   * @param refresh - Wenn true, wird Cache umgangen
   * @returns StorageUsage Objekt mit Datenbank- und Dateispeicherplatz
   */
  async getStorageUsage(companyId: string, refresh: boolean = false): Promise<StorageUsage> {
    const startTime = Date.now();
    console.log(`[StorageUsage] ========================================`);
    console.log(`[StorageUsage] getStorageUsage aufgerufen!`);
    console.log(`[StorageUsage] Company: ${companyId}, Refresh: ${refresh}`);
    console.log(`[StorageUsage] ========================================`);

    // Cache prüfen (wenn nicht refresh)
    if (!refresh) {
      this.cleanupExpiredCache();
      const cached = this.storageCache.get(`storage_usage_${companyId}`);
      if (cached && cached.expiresAt > Date.now()) {
        console.log(
          `[StorageUsage] ⚠️ Cache-Hit für Company: ${companyId} - verwende gecachte Daten`
        );
        console.log(`[StorageUsage] Cache-Ablaufzeit: ${new Date(cached.expiresAt).toISOString()}`);
        console.log(`[StorageUsage] Aktuelle Zeit: ${new Date().toISOString()}`);
        return cached.data;
      } else {
        console.log(`[StorageUsage] ✅ Kein Cache oder Cache abgelaufen - berechne neu`);
      }
    } else {
      console.log(`[StorageUsage] ✅ Refresh=true - Cache wird umgangen`);
    }

    // Company validieren
    const company = await this.findOne(companyId);
    if (!company.dbConfig) {
      throw new NotFoundException(`DB-Config für Company ${companyId} nicht gefunden`);
    }

    if (company.dbConfig.provisioningStatus !== 'ready') {
      throw new BadRequestException(
        `Datenbank für Company ${companyId} ist noch nicht bereit (Status: ${company.dbConfig.provisioningStatus})`
      );
    }

    // Passwort entschlüsseln
    let decryptedPassword: string;
    try {
      decryptedPassword = this.encryptionService.decrypt(company.dbConfig.dbPassword);
    } catch (error: any) {
      const errorMsg = error?.message || String(error);
      throw new BadRequestException(`Fehler beim Entschlüsseln des DB-Passworts: ${errorMsg}`);
    }

    if (
      decryptedPassword == null ||
      typeof decryptedPassword !== 'string' ||
      decryptedPassword.trim().length === 0
    ) {
      throw new BadRequestException('Datenbank-Passwort konnte nicht korrekt entschlüsselt werden');
    }

    let pool: Pool | null = null;
    const dbStartTime = Date.now();

    try {
      // Datenbank-Speicherplatz berechnen
      pool = await createTenantDbPool({
        dbHost: company.dbConfig.dbHost,
        dbPort: company.dbConfig.dbPort,
        dbName: company.dbConfig.dbName,
        dbUser: company.dbConfig.dbUser,
        dbPassword: decryptedPassword,
        dbSslMode: company.dbConfig.dbSslMode,
      });

      // Tabellen-Größen abrufen (optimierte Query mit pg_class)
      const tablesResult = await pool.query(`
        SELECT 
          c.relname AS table_name,
          pg_total_relation_size(c.oid) AS total_size_bytes,
          pg_relation_size(c.oid) AS table_size_bytes,
          (pg_total_relation_size(c.oid) - pg_relation_size(c.oid)) AS index_size_bytes
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relkind = 'r'
        ORDER BY pg_total_relation_size(c.oid) DESC
      `);

      const tables = tablesResult.rows;
      const validTables = tables.filter((t) => validateTableName(t.table_name));

      // Zeilenanzahl für Tabellen in Batches
      const BATCH_SIZE = 10;
      const rowCounts: Array<{ tableName: string; count: number }> = [];

      for (let i = 0; i < validTables.length; i += BATCH_SIZE) {
        const batch = validTables.slice(i, i + BATCH_SIZE);
        const batchStartTime = Date.now();
        const batchResults = await Promise.all(
          batch.map((table) =>
            pool!
              .query(`SELECT COUNT(*) as count FROM "${table.table_name}"`)
              .then((result) => ({
                tableName: table.table_name,
                count: parseInt(result.rows[0].count, 10),
              }))
              .catch((error) => {
                console.error(`[StorageUsage] Fehler beim Zählen von ${table.table_name}:`, error);
                return { tableName: table.table_name, count: 0 };
              })
          )
        );
        const batchTime = Date.now() - batchStartTime;
        const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
        console.log(
          `[StorageUsage] Batch ${batchNumber}: ${batch.length} Tabellen in ${batchTime}ms`
        );
        rowCounts.push(...batchResults);
      }

      const dbTime = Date.now() - dbStartTime;
      console.log(
        `[StorageUsage] DB-Berechnung abgeschlossen: ${validTables.length} Tabellen in ${dbTime}ms`
      );

      // Tabellen-Informationen zusammenführen
      const tableMap = new Map(rowCounts.map((rc) => [rc.tableName, rc.count]));
      const tableInfos = validTables.map((table) => {
        const rowCount = tableMap.get(table.table_name) || 0;
        const sizeBytes = parseInt(table.table_size_bytes, 10);
        const totalSizeBytes = parseInt(table.total_size_bytes, 10);
        const indexSizeBytes = parseInt(table.index_size_bytes, 10);

        return {
          tableName: table.table_name,
          sizeBytes,
          totalSizeBytes,
          indexSizeBytes,
          size: formatBytesSafe(sizeBytes),
          totalSize: formatBytesSafe(totalSizeBytes),
          rowCount,
        };
      });

      // Gesamt-Datenbank-Größen berechnen
      // Verwende pg_database_size() für die tatsächliche Gesamtgröße (inkl. System-Tabellen, Metadaten, etc.)
      const databaseSizeResult = await pool.query(`
        SELECT pg_database_size(current_database()) as database_size_bytes
      `);
      const totalSizeBytes = parseInt(databaseSizeResult.rows[0].database_size_bytes, 10);

      // Tabellen-Größen (nur public Schema) für die Aufschlüsselung
      const tableSizeBytes = tableInfos.reduce((sum, t) => sum + t.sizeBytes, 0);
      const indexSizeBytes = tableInfos.reduce((sum, t) => sum + t.indexSizeBytes, 0);

      const databaseUsage = {
        totalSizeBytes,
        totalSize: formatBytesSafe(totalSizeBytes),
        tableSizeBytes,
        indexSizeBytes,
        tables: tableInfos,
      };

      // Dateispeicherplatz berechnen
      console.log(`[StorageUsage] ========================================`);
      console.log(`[StorageUsage] Starte Dateispeicherplatz-Berechnung`);
      console.log(`[StorageUsage] ========================================`);

      // Standard-Pfad: apps/mailclient/storage (relativ zum Workspace-Root)
      // Falls STORAGE_PATH gesetzt ist, wird dieser verwendet
      let storagePath = process.env.STORAGE_PATH;
      console.log(`[StorageUsage] STORAGE_PATH aus ENV: ${storagePath || '(nicht gesetzt)'}`);
      if (!storagePath) {
        // Finde Workspace-Root: Gehe von apps/scc/src/companies/companies.service.ts
        // hoch zu apps/scc/, dann zu apps/, dann zu mailclient/storage
        const currentDir = __dirname; // apps/scc/dist/src/companies oder apps/scc/src/companies
        // Prüfe ob wir in dist/ sind (Production) oder src/ (Development)
        // Verwende path.normalize für plattformunabhängige Pfadprüfung
        const normalizedDir = path.normalize(currentDir);
        let sccDir: string;
        if (
          normalizedDir.includes(`${path.sep}dist${path.sep}src${path.sep}`) ||
          normalizedDir.endsWith(`${path.sep}dist${path.sep}src`)
        ) {
          // Production: apps/scc/dist/src/companies -> ../../../.. = apps/scc
          sccDir = path.resolve(currentDir, '../../../..');
        } else {
          // Development: apps/scc/src/companies -> ../../.. = apps/scc
          sccDir = path.resolve(currentDir, '../../..');
        }
        const appsDir = path.resolve(sccDir, '..'); // apps
        const mailclientStorage = path.join(appsDir, 'mailclient', 'storage');
        storagePath = mailclientStorage;
        console.log(`[StorageUsage] Automatisch berechneter Pfad: ${storagePath}`);
        console.log(`[StorageUsage] __dirname: ${__dirname}`);
        console.log(`[StorageUsage] sccDir: ${sccDir}`);
        console.log(`[StorageUsage] appsDir: ${appsDir}`);
      }
      // Stelle sicher, dass storagePath absolut ist
      const resolvedStoragePath = path.resolve(storagePath);
      console.log(`[StorageUsage] Finaler Storage-Pfad (resolved): ${resolvedStoragePath}`);
      const companyStoragePath = path.join(resolvedStoragePath, companyId);
      const timeout = parseInt(process.env.STORAGE_CALCULATION_TIMEOUT || '30000', 10);

      console.log(`[StorageUsage] Storage-Pfad: ${resolvedStoragePath}`);
      console.log(`[StorageUsage] Company Storage-Pfad: ${companyStoragePath}`);

      let attachments = { sizeBytes: 0, size: '0 Bytes', count: 0 };
      let uploads = { sizeBytes: 0, size: '0 Bytes', count: 0 };
      let other = { sizeBytes: 0, size: '0 Bytes', count: 0 };

      try {
        const attachmentsPath = path.join(companyStoragePath, 'attachments');
        console.log(`[StorageUsage] Prüfe Anhänge-Verzeichnis: ${attachmentsPath}`);
        // Prüfe ob Verzeichnis existiert
        try {
          const stats = await fs.stat(attachmentsPath);
          if (stats.isDirectory()) {
            console.log(`[StorageUsage] ✅ Anhänge-Verzeichnis existiert: ${attachmentsPath}`);
          } else {
            console.warn(`[StorageUsage] ⚠️ Pfad ist kein Verzeichnis: ${attachmentsPath}`);
          }
        } catch (accessError: any) {
          console.warn(
            `[StorageUsage] ⚠️ Anhänge-Verzeichnis existiert nicht oder ist nicht zugänglich: ${attachmentsPath}`,
            accessError.code
          );
          // Versuche zu sehen, was im Company-Verzeichnis ist
          try {
            const companyDirContents = await fs.readdir(companyStoragePath);
            console.log(
              `[StorageUsage] Inhalt von Company-Verzeichnis (${companyStoragePath}):`,
              companyDirContents
            );
          } catch (readError: any) {
            console.warn(`[StorageUsage] Konnte Company-Verzeichnis nicht lesen:`, readError.code);
          }
        }
        const attachmentsResult = await this.calculateDirectorySize(
          resolvedStoragePath,
          attachmentsPath,
          timeout
        );
        attachments = {
          sizeBytes: attachmentsResult.sizeBytes,
          size: formatBytesSafe(attachmentsResult.sizeBytes),
          count: attachmentsResult.count,
        };
      } catch (error: any) {
        if (error.message === 'Timeout bei Verzeichnisberechnung') {
          console.warn(
            `[StorageUsage] Timeout bei attachments-Berechnung für Company ${companyId}`
          );
        } else if (error.code === 'ENOENT') {
          console.log(
            `[StorageUsage] Verzeichnis nicht gefunden: ${path.join(companyStoragePath, 'attachments')}`
          );
        } else if (error.message?.includes('Path-Traversal')) {
          console.error(`[StorageUsage] Security-Fehler bei attachments:`, error);
          // Path-Traversal-Fehler nicht ignorieren, aber auch nicht die gesamte Berechnung abbrechen
          // Setze auf 0 Bytes
        } else {
          console.warn(`[StorageUsage] Fehler bei attachments-Berechnung:`, error);
        }
        // Bei jedem Fehler: attachments bleibt bei 0 Bytes (Standardwert)
      }

      try {
        const uploadsPath = path.join(companyStoragePath, 'uploads');
        console.log(`[StorageUsage] Prüfe Uploads-Verzeichnis: ${uploadsPath}`);
        const uploadsResult = await this.calculateDirectorySize(
          resolvedStoragePath,
          uploadsPath,
          timeout
        );
        uploads = {
          sizeBytes: uploadsResult.sizeBytes,
          size: formatBytesSafe(uploadsResult.sizeBytes),
          count: uploadsResult.count,
        };
      } catch (error: any) {
        if (error.message === 'Timeout bei Verzeichnisberechnung') {
          console.warn(`[StorageUsage] Timeout bei uploads-Berechnung für Company ${companyId}`);
        } else if (error.code === 'ENOENT') {
          console.log(
            `[StorageUsage] Verzeichnis nicht gefunden: ${path.join(companyStoragePath, 'uploads')}`
          );
        } else if (error.message?.includes('Path-Traversal')) {
          console.error(`[StorageUsage] Security-Fehler bei uploads:`, error);
        } else {
          console.warn(`[StorageUsage] Fehler bei uploads-Berechnung:`, error);
        }
        // Bei jedem Fehler: uploads bleibt bei 0 Bytes (Standardwert)
      }

      try {
        console.log(`[StorageUsage] Prüfe Other-Verzeichnis: ${companyStoragePath}`);
        const otherResult = await this.calculateDirectorySize(
          resolvedStoragePath,
          companyStoragePath,
          timeout
        );
        // Subtrahiere attachments und uploads von other
        const otherSizeBytes = Math.max(
          0,
          otherResult.sizeBytes - attachments.sizeBytes - uploads.sizeBytes
        );
        const otherCount = Math.max(0, otherResult.count - attachments.count - uploads.count);
        other = {
          sizeBytes: otherSizeBytes,
          size: formatBytesSafe(otherSizeBytes),
          count: otherCount,
        };
      } catch (error: any) {
        if (error.message === 'Timeout bei Verzeichnisberechnung') {
          console.warn(`[StorageUsage] Timeout bei other-Berechnung für Company ${companyId}`);
        } else if (error.code === 'ENOENT') {
          console.log(`[StorageUsage] Verzeichnis nicht gefunden: ${companyStoragePath}`);
        } else if (error.message?.includes('Path-Traversal')) {
          console.error(`[StorageUsage] Security-Fehler bei other:`, error);
        } else {
          console.warn(`[StorageUsage] Fehler bei other-Berechnung:`, error);
        }
        // Bei jedem Fehler: other bleibt bei 0 Bytes (Standardwert)
      }

      const totalFileSizeBytes = attachments.sizeBytes + uploads.sizeBytes + other.sizeBytes;
      const filesUsage = {
        totalSizeBytes: totalFileSizeBytes,
        totalSize: formatBytesSafe(totalFileSizeBytes),
        attachments,
        uploads,
        other,
      };

      const overallTotalSizeBytes = databaseUsage.totalSizeBytes + totalFileSizeBytes;
      const result: StorageUsage = {
        database: databaseUsage,
        files: filesUsage,
        total: {
          sizeBytes: overallTotalSizeBytes,
          size: formatBytesSafe(overallTotalSizeBytes),
        },
        lastUpdated: new Date().toISOString(),
      };

      // In Cache speichern
      const cacheTTL = parseInt(process.env.STORAGE_CACHE_TTL || '300', 10) * 1000;
      this.storageCache.set(`storage_usage_${companyId}`, {
        data: result,
        expiresAt: Date.now() + cacheTTL,
      });

      const executionTimeMs = Date.now() - startTime;
      console.log(
        `[StorageUsage] Company: ${companyId}, Time: ${executionTimeMs}ms, DB: ${databaseUsage.totalSizeBytes}bytes, Files: ${totalFileSizeBytes}bytes`
      );

      return result;
    } catch (error: any) {
      const executionTimeMs = Date.now() - startTime;
      console.error(
        `[StorageUsage] Fehler für Company ${companyId} nach ${executionTimeMs}ms:`,
        error
      );
      console.error(`[StorageUsage] Fehler-Details:`, {
        name: error?.name,
        message: error?.message,
        stack: error?.stack,
      });

      // NestJS Exceptions direkt weiterwerfen
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }

      // Andere Fehler formatieren
      const isDevelopment = process.env.NODE_ENV === 'development';
      const errorResponse = formatQueryError(error, isDevelopment);

      // Sicherstellen, dass die Fehlermeldung ein String ist
      const errorMessage =
        errorResponse.message || error?.message || 'Fehler bei der Speicherplatz-Berechnung';

      throw new BadRequestException({
        message: typeof errorMessage === 'string' ? errorMessage : String(errorMessage),
        code: errorResponse.code,
        ...(errorResponse.details && { details: errorResponse.details }),
      });
    } finally {
      if (pool) {
        try {
          await pool.end();
        } catch (endError) {
          console.error('Fehler beim Schließen der DB-Verbindung:', endError);
        }
      }
    }
  }
}
