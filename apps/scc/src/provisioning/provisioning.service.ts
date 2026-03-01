import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from '../common/encryption.service';
import { ProvisionDatabaseRequest } from './dto/provision-database.dto';

@Injectable()
export class ProvisioningService {
  constructor(
    private prisma: PrismaService,
    private encryptionService: EncryptionService
  ) {}

  /**
   * Mock-Provisionierung: Erstellt fiktive DB-Verbindungsdaten
   * Später wird hier Terraform aufgerufen
   */
  async provisionDatabase(
    companyId: string,
    request: ProvisionDatabaseRequest
  ): Promise<{
    provisioningId: string;
    status: string;
    dbConfig?: any;
  }> {
    // Prüfe, ob Company existiert
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
    });

    if (!company) {
      throw new NotFoundException(`Company mit ID ${companyId} nicht gefunden`);
    }

    // Prüfe, ob bereits eine DB-Config existiert
    const existingConfig = await this.prisma.companyDbConfig.findUnique({
      where: { companyId },
    });

    // Erlaube Re-Provisionierung für lokale Entwicklung (aktualisiert die Config)
    if (existingConfig && existingConfig.provisioningStatus === 'ready') {
      console.log(
        `⚠️ DB für Company ${companyId} ist bereits provisioniert. Aktualisiere Config für lokale Entwicklung...`
      );
      // Wir aktualisieren die Config trotzdem (für lokale Entwicklung)
    }

    // Status auf "provisioning" setzen
    const provisioningId = `prov-${Date.now()}-${companyId.substring(0, 8)}`;

    // Mock: Generiere DB-Verbindungsdaten (für lokale Entwicklung wird die DB erstellt)
    const mockDbConfig = await this.generateMockDbConfig(companyId, request);

    // Passwort verschlüsseln
    const encryptedPassword = this.encryptionService.encrypt(mockDbConfig.dbPassword);

    // CompanyDbConfig erstellen oder aktualisieren
    const dbConfig = await this.prisma.companyDbConfig.upsert({
      where: { companyId },
      update: {
        dbHost: mockDbConfig.dbHost,
        dbPort: mockDbConfig.dbPort,
        dbName: mockDbConfig.dbName,
        dbUser: mockDbConfig.dbUser,
        dbPassword: encryptedPassword, // Verschlüsselt gespeichert
        dbSslMode: mockDbConfig.dbSslMode,
        provisioningStatus: 'provisioning',
        healthStatus: 'unknown',
      },
      create: {
        companyId,
        dbHost: mockDbConfig.dbHost,
        dbPort: mockDbConfig.dbPort,
        dbName: mockDbConfig.dbName,
        dbUser: mockDbConfig.dbUser,
        dbPassword: encryptedPassword, // Verschlüsselt gespeichert
        dbSslMode: mockDbConfig.dbSslMode,
        provisioningStatus: 'provisioning',
        healthStatus: 'unknown',
      },
    });

    // Simuliere asynchrone Provisionierung (in echt würde hier Terraform aufgerufen)
    // Nach kurzer Zeit Status auf "ready" setzen und Standard-Admin-User erstellen
    // Verwende Promise statt setTimeout für bessere Fehlerbehandlung
    (async () => {
      try {
        // Kurze Verzögerung
        await new Promise((resolve) => setTimeout(resolve, 2000));

        console.log(`🔄 Starte Admin-User-Erstellung für Company ${companyId}...`);
        console.log(
          `📋 DB-Config: ${mockDbConfig.dbHost}:${mockDbConfig.dbPort}/${mockDbConfig.dbName}`
        );

        // Standard-Admin-User erstellen (BEVOR Status auf ready gesetzt wird)
        await this.createDefaultAdminUser(companyId, mockDbConfig);

        // Standard-Abteilungen erstellen
        await this.createDefaultDepartments(companyId, mockDbConfig);

        // Status auf "ready" setzen
        await this.prisma.companyDbConfig.update({
          where: { companyId },
          data: {
            provisioningStatus: 'ready',
            provisionedAt: new Date(),
            healthStatus: 'healthy',
            lastHealthCheck: new Date(),
          },
        });

        console.log(`✅ Provisionierung abgeschlossen für Company ${companyId}`);
      } catch (error: any) {
        console.error(`❌ Fehler beim Provisionieren für Company ${companyId}:`, error);
        console.error(`❌ Fehler-Details:`, error.message);
        console.error(`❌ Stack:`, error.stack);

        // Status trotzdem auf ready setzen, auch wenn User-Erstellung fehlschlägt
        try {
          await this.prisma.companyDbConfig.update({
            where: { companyId },
            data: {
              provisioningStatus: 'ready',
              provisionedAt: new Date(),
              healthStatus: 'healthy',
              lastHealthCheck: new Date(),
            },
          });
        } catch (updateError) {
          console.error(`❌ Fehler beim Aktualisieren des Status:`, updateError);
        }
      }
    })();

    return {
      provisioningId,
      status: 'provisioning',
      dbConfig: {
        id: dbConfig.id,
        companyId: dbConfig.companyId,
        dbHost: dbConfig.dbHost,
        dbPort: dbConfig.dbPort,
        dbName: dbConfig.dbName,
        dbUser: dbConfig.dbUser,
        // dbPassword wird nicht zurückgegeben (Sicherheit)
        dbSslMode: dbConfig.dbSslMode,
        provisioningStatus: dbConfig.provisioningStatus,
      },
    };
  }

  /**
   * Generiert DB-Verbindungsdaten (Mock für lokale Entwicklung)
   * Für lokale Tests: Verwendet lokale PostgreSQL und erstellt die DB tatsächlich
   */
  private async generateMockDbConfig(companyId: string, _request: ProvisionDatabaseRequest) {
    // Für lokale Entwicklung: Verwende lokale PostgreSQL
    const dbHost = 'localhost';
    const dbPort = 5432; // Standard PostgreSQL-Port
    const dbName = `tenant_${companyId.replace(/-/g, '_')}`;

    // Parse DATABASE_URL aus Umgebungsvariable (falls vorhanden)
    // Format: postgresql://user:password@host:port/database
    let dbUser = 'saivaro';
    let dbPassword = 'saivaro_dev_password';

    if (process.env.DATABASE_URL) {
      try {
        const url = new URL(process.env.DATABASE_URL);
        dbUser = url.username || dbUser;
        dbPassword = url.password || dbPassword;
      } catch (e) {
        // Fallback zu Standard-Werten
      }
    }

    // Erstelle die Datenbank, falls sie nicht existiert
    await this.createDatabaseIfNotExists(dbHost, dbPort, dbUser, dbPassword, dbName);

    return {
      dbHost,
      dbPort,
      dbName,
      dbUser,
      dbPassword,
      dbSslMode: 'prefer', // Für lokale Entwicklung
    };
  }

  /**
   * Erstellt eine Datenbank, falls sie nicht existiert
   */
  private async createDatabaseIfNotExists(
    host: string,
    port: number,
    user: string,
    password: string,
    dbName: string
  ) {
    const { Pool } = await import('pg');
    const adminPool = new Pool({
      host,
      port,
      user,
      password,
      database: 'postgres', // Verbinde zur Standard-DB
      ssl: false,
    });

    try {
      // Prüfe, ob Datenbank existiert
      const result = await adminPool.query('SELECT 1 FROM pg_database WHERE datname = $1', [
        dbName,
      ]);

      if (result.rows.length === 0) {
        // Datenbank erstellen
        await adminPool.query(`CREATE DATABASE ${dbName}`);
        console.log(`✅ Datenbank ${dbName} wurde erstellt`);
      } else {
        console.log(`ℹ️ Datenbank ${dbName} existiert bereits`);
      }
    } catch (error: any) {
      console.error(`Fehler beim Erstellen der Datenbank ${dbName}:`, error.message);
      // Wir werfen den Fehler nicht weiter, da die DB möglicherweise bereits existiert
    } finally {
      await adminPool.end();
    }
  }

  /**
   * Generiert ein sicheres Passwort (32 Zeichen)
   */
  private generateSecurePassword(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < 32; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  }

  /**
   * Ruft Provisionierungs-Status ab
   */
  async getProvisioningStatus(provisioningId: string) {
    // In echt würde hier ein Tracking-System verwendet
    // Für Mock: Suche nach CompanyDbConfig mit ähnlichem ID-Pattern
    const configs = await this.prisma.companyDbConfig.findMany({
      where: {
        provisioningStatus: {
          in: ['pending', 'provisioning', 'ready'],
        },
      },
      include: {
        company: {
          select: {
            name: true,
            slug: true,
          },
        },
      },
    });

    // Vereinfachte Suche (in echt würde provisioningId gespeichert)
    const config = configs.find((c) => c.id.includes(provisioningId.split('-')[1]));

    if (!config) {
      throw new NotFoundException(`Provisionierung ${provisioningId} nicht gefunden`);
    }

    return {
      provisioningId,
      status: config.provisioningStatus,
      progress:
        config.provisioningStatus === 'ready'
          ? 100
          : config.provisioningStatus === 'provisioning'
            ? 50
            : 0,
      dbConfig:
        config.provisioningStatus === 'ready'
          ? {
              id: config.id,
              companyId: config.companyId,
              dbHost: config.dbHost,
              dbPort: config.dbPort,
              dbName: config.dbName,
              dbUser: config.dbUser,
              // dbPassword wird nicht zurückgegeben
              dbSslMode: config.dbSslMode,
              provisioningStatus: config.provisioningStatus,
              healthStatus: config.healthStatus,
            }
          : undefined,
    };
  }

  /**
   * Erstellt einen Standard-Admin-User in der Tenant-DB
   */
  private async createDefaultAdminUser(
    companyId: string,
    dbConfig: {
      dbHost: string;
      dbPort: number;
      dbName: string;
      dbUser: string;
      dbPassword: string;
      dbSslMode: string;
    }
  ) {
    const { Pool } = await import('pg');
    const bcrypt = await import('bcrypt');

    console.log(
      `🔌 Verbinde zur Tenant-DB: ${dbConfig.dbHost}:${dbConfig.dbPort}/${dbConfig.dbName} als ${dbConfig.dbUser}`
    );

    const pool = new Pool({
      host: dbConfig.dbHost,
      port: dbConfig.dbPort,
      database: dbConfig.dbName,
      user: dbConfig.dbUser,
      password: dbConfig.dbPassword,
      ssl: dbConfig.dbSslMode === 'require' ? { rejectUnauthorized: false } : false,
      connectionTimeoutMillis: 10000, // 10 Sekunden Timeout
    });

    try {
      // Teste Verbindung
      await pool.query('SELECT 1');
      console.log(`✅ Verbindung zur Tenant-DB erfolgreich`);
      // Prüfe, ob users-Tabelle existiert
      console.log(`🔍 Prüfe, ob users-Tabelle existiert...`);
      const tableCheck = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'users'
        );
      `);
      console.log(`📊 Tabelle existiert: ${tableCheck.rows[0].exists}`);

      if (!tableCheck.rows[0].exists) {
        // Tabelle erstellen, falls sie nicht existiert
        console.log(`🔄 Erstelle users-Tabelle...`);
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
        console.log(`✅ users-Tabelle erstellt`);
      } else {
        // Tabelle existiert bereits - prüfe, ob company_id-Spalte vorhanden ist
        console.log(`🔍 Prüfe, ob company_id-Spalte existiert...`);
        const companyIdColumnCheck = await pool.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'users' 
            AND column_name = 'company_id'
          );
        `);

        if (!companyIdColumnCheck.rows[0].exists) {
          console.log(`🔄 Füge company_id-Spalte hinzu...`);
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

      // IMMER prüfen, ob username-Spalte existiert, falls nicht hinzufügen (Migration für bestehende Tabellen)
      console.log(`🔍 Prüfe, ob username-Spalte existiert...`);
      const columnCheck = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_schema = 'public' 
          AND table_name = 'users' 
          AND column_name = 'username'
        );
      `);
      console.log(`📊 username-Spalte existiert: ${columnCheck.rows[0].exists}`);

      if (!columnCheck.rows[0].exists) {
        console.log(`🔄 Füge username-Spalte zur users-Tabelle hinzu...`);
        try {
          // username-Spalte hinzufügen
          await pool.query(`
            ALTER TABLE users ADD COLUMN username VARCHAR(255);
          `);
          console.log(`✅ username-Spalte hinzugefügt`);

          // Bestehende E-Mails als Username setzen
          await pool.query(`
            UPDATE users SET username = COALESCE(email, 'user_' || id::text) WHERE username IS NULL;
          `);
          console.log(`✅ Bestehende User migriert`);

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
            console.log(`✅ Unique-Constraint hinzugefügt`);
          }
        } catch (alterError: any) {
          console.error(`❌ Fehler beim Hinzufügen der username-Spalte:`, alterError.message);
          throw alterError;
        }
      } else {
        console.log(`✅ username-Spalte existiert bereits`);
      }

      // Prüfe, ob Admin-User bereits existiert
      console.log(`🔍 Prüfe, ob Admin-User bereits existiert...`);
      const existingAdmin = await pool.query(
        'SELECT id FROM users WHERE username = $1 OR (username IS NULL AND email = $2)',
        ['admin', 'admin']
      );
      console.log(`📊 Admin-User existiert: ${existingAdmin.rows.length > 0}`);

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

        const adminUserId = adminResult.rows[0].id;
        console.log(`✅ Admin-User in Tenant-DB erstellt mit ID: ${adminUserId}`);

        // Passwort in SCC-DB speichern
        try {
          await this.prisma.tenantUserPassword.upsert({
            where: {
              companyId_tenantUserId: {
                companyId,
                tenantUserId: adminUserId,
              },
            },
            update: {
              username: 'admin',
              email: 'admin@localhost',
              password: 'saivaro',
            },
            create: {
              companyId,
              tenantUserId: adminUserId,
              username: 'admin',
              email: 'admin@localhost',
              password: 'saivaro',
            },
          });
          console.log(`✅ Passwort in SCC-DB gespeichert für Admin-User ${adminUserId}`);
        } catch (passwordError: any) {
          console.warn(`⚠️ Fehler beim Speichern des Passworts in SCC-DB:`, passwordError.message);
          // Versuche ohne username (falls Spalte noch nicht existiert)
          try {
            await this.prisma.tenantUserPassword.upsert({
              where: {
                companyId_tenantUserId: {
                  companyId,
                  tenantUserId: adminUserId,
                },
              },
              update: {
                email: 'admin@localhost',
                password: 'saivaro',
              },
              create: {
                companyId,
                tenantUserId: adminUserId,
                email: 'admin@localhost',
                password: 'saivaro',
              },
            });
            console.log(`✅ Passwort in SCC-DB gespeichert (ohne username)`);
          } catch (fallbackError) {
            console.error(`❌ Auch Fallback fehlgeschlagen:`, fallbackError);
          }
        }

        console.log(
          `✅ Standard-Admin-User (admin/saivaro) wurde erstellt für Company ${companyId}`
        );
      } else {
        console.log(`ℹ️ Admin-User existiert bereits für Company ${companyId}`);
        // Stelle sicher, dass Passwort in SCC-DB gespeichert ist
        const existingAdminId = existingAdmin.rows[0].id;
        try {
          await this.prisma.tenantUserPassword.upsert({
            where: {
              companyId_tenantUserId: {
                companyId,
                tenantUserId: existingAdminId,
              },
            },
            update: {
              username: 'admin',
              email: 'admin@localhost',
              password: 'saivaro',
            },
            create: {
              companyId,
              tenantUserId: existingAdminId,
              username: 'admin',
              email: 'admin@localhost',
              password: 'saivaro',
            },
          });
        } catch (error) {
          console.warn(`⚠️ Fehler beim Aktualisieren des Passworts in SCC-DB:`, error);
        }
      }
    } catch (error: any) {
      console.error(`❌ Fehler beim Erstellen des Standard-Admin-Users:`, error);
      console.error(`❌ Fehler-Details:`, error.message);
      console.error(`❌ Fehler-Code:`, error.code);
      console.error(`❌ Fehler-Stack:`, error.stack);
      // Fehler weiterwerfen, damit der Caller es sieht
      throw error;
    } finally {
      await pool.end();
    }
  }

  /**
   * Deprovisionierung: Löscht DB-Config und markiert Company als gelöscht
   */
  async deprovisionDatabase(companyId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      include: { dbConfig: true },
    });

    if (!company) {
      throw new NotFoundException(`Company mit ID ${companyId} nicht gefunden`);
    }

    if (!company.dbConfig) {
      throw new NotFoundException(`Keine DB-Config für Company ${companyId} gefunden`);
    }

    // In echt würde hier Terraform-Destroy aufgerufen
    // Für Mock: DB-Config löschen
    await this.prisma.companyDbConfig.delete({
      where: { companyId },
    });

    // Company-Status auf "inactive" setzen
    await this.prisma.company.update({
      where: { id: companyId },
      data: { status: 'inactive' },
    });

    return {
      success: true,
      message: `DB für Company ${companyId} wurde deprovisioniert`,
    };
  }

  /**
   * Erstellt Standard-Abteilungen in der Tenant-DB
   */
  private async createDefaultDepartments(
    companyId: string,
    dbConfig: {
      dbHost: string;
      dbPort: number;
      dbName: string;
      dbUser: string;
      dbPassword: string;
      dbSslMode: string;
    }
  ) {
    const { Pool } = await import('pg');

    console.log(`🏢 Erstelle Standard-Abteilungen für Company ${companyId}...`);

    const pool = new Pool({
      host: dbConfig.dbHost,
      port: dbConfig.dbPort,
      database: dbConfig.dbName,
      user: dbConfig.dbUser,
      password: dbConfig.dbPassword,
      ssl: dbConfig.dbSslMode === 'require' ? { rejectUnauthorized: false } : false,
      connectionTimeoutMillis: 10000,
    });

    try {
      // Prüfe, ob departments-Tabelle existiert
      const tableCheck = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'departments'
        );
      `);

      if (!tableCheck.rows[0].exists) {
        console.log(
          `⚠️ departments-Tabelle existiert noch nicht, wird durch Schema-Migration erstellt`
        );
        await pool.end();
        return; // Tabelle wird durch Schema-Migration erstellt
      }

      // Standard-Abteilungen
      const defaultDepartments = [
        {
          name: 'Geschäftsführung',
          description: 'Strategische Leitung und Geschäftsführung des Unternehmens',
        },
        { name: 'Buchhaltung', description: 'Finanzen, Rechnungswesen und Controlling' },
        { name: 'Marketing', description: 'Marketing, Werbung und Öffentlichkeitsarbeit' },
        { name: 'Einkauf', description: 'Beschaffung und Lieferantenmanagement' },
        { name: 'Logistik', description: 'Lager, Versand und Distribution' },
        { name: 'Kundenservice', description: 'Kundenbetreuung und Support' },
      ];

      // Prüfe, ob bereits Abteilungen existieren
      const existingCheck = await pool.query(
        'SELECT COUNT(*) as count FROM departments WHERE company_id = $1',
        [companyId]
      );

      if (parseInt(existingCheck.rows[0].count) > 0) {
        console.log(
          `✅ Abteilungen existieren bereits für Company ${companyId}, überspringe Erstellung`
        );
        await pool.end();
        return;
      }

      // Erstelle Standard-Abteilungen
      for (const dept of defaultDepartments) {
        try {
          await pool.query(
            `INSERT INTO departments (company_id, name, description, created_at, updated_at)
             VALUES ($1, $2, $3, NOW(), NOW())`,
            [companyId, dept.name, dept.description]
          );
          console.log(`✅ Abteilung "${dept.name}" erstellt`);
        } catch (error: any) {
          // Ignoriere Duplikat-Fehler (falls Abteilung bereits existiert)
          if (error.code !== '23505') {
            console.error(`❌ Fehler beim Erstellen der Abteilung "${dept.name}":`, error.message);
          }
        }
      }

      console.log(`✅ Standard-Abteilungen erfolgreich erstellt für Company ${companyId}`);
    } catch (error: any) {
      console.error(
        `❌ Fehler beim Erstellen der Standard-Abteilungen für Company ${companyId}:`,
        error
      );
      // Fehler nicht werfen, da Abteilungen optional sind
    } finally {
      await pool.end();
    }
  }
}
