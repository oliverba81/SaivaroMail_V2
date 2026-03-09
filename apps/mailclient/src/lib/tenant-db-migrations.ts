/**
 * Tenant-DB-Migrationen: Schema-Migrationen für Tenant-Datenbanken
 * Stellt sicher, dass alle erforderlichen Tabellen und Spalten existieren
 */

import { PoolClient } from 'pg';

/**
 * Stellt sicher, dass die users-Tabelle das korrekte Schema hat
 */
export async function ensureUsersTableSchema(client: PoolClient, companyId: string): Promise<void> {
  try {
    // Prüfe, ob users-Tabelle existiert
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'users'
      );
    `);

    if (!tableCheck.rows[0].exists) {
      console.log(`📝 Erstelle users-Tabelle für Company ${companyId}`);
      // Tabelle erstellen
      await client.query(`
        CREATE TABLE users (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          company_id UUID NOT NULL,
          username VARCHAR(255) UNIQUE,
          email VARCHAR(255),
          password_hash VARCHAR(255) NOT NULL,
          first_name VARCHAR(100),
          last_name VARCHAR(100),
          role VARCHAR(50) DEFAULT 'user',
          status VARCHAR(50) DEFAULT 'active',
          visible_filter_ids JSONB,
          last_login_at TIMESTAMP,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        );
      `);
      console.log(`✅ users-Tabelle erfolgreich erstellt`);
    } else {
      // Prüfe, ob company_id-Spalte existiert
      const companyIdCheck = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_schema = 'public' 
          AND table_name = 'users' 
          AND column_name = 'company_id'
        );
      `);

      if (!companyIdCheck.rows[0].exists) {
        console.log(`📝 Füge company_id-Spalte zur users-Tabelle hinzu für Company ${companyId}`);
        // Spalte hinzufügen (zuerst als nullable)
        await client.query(`
          ALTER TABLE users ADD COLUMN company_id UUID;
        `);
        // Setze company_id für alle bestehenden User
        const updateResult = await client.query(`
          UPDATE users SET company_id = $1 WHERE company_id IS NULL;
        `, [companyId]);
        console.log(`📝 Setze company_id für ${updateResult.rowCount} bestehende User`);
        // Mache Spalte NOT NULL (nur wenn alle User eine company_id haben)
        await client.query(`
          ALTER TABLE users ALTER COLUMN company_id SET NOT NULL;
        `);
        console.log(`✅ company_id-Spalte erfolgreich hinzugefügt`);
      } else {
        console.log(`✅ company_id-Spalte existiert bereits`);
      }

      // Prüfe, ob username-Spalte existiert
      const usernameCheck = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_schema = 'public' 
          AND table_name = 'users' 
          AND column_name = 'username'
        );
      `);

      if (!usernameCheck.rows[0].exists) {
        console.log(`📝 Füge username-Spalte zur users-Tabelle hinzu für Company ${companyId}`);
        // Spalte hinzufügen
        await client.query(`
          ALTER TABLE users ADD COLUMN username VARCHAR(255);
        `);
        // Setze username aus email für bestehende User
        await client.query(`
          UPDATE users SET username = COALESCE(email, 'user_' || id::text) WHERE username IS NULL;
        `);
        // Erstelle Unique-Constraint, falls nicht vorhanden
        try {
          await client.query(`
            ALTER TABLE users ADD CONSTRAINT users_username_unique UNIQUE (username);
          `);
          console.log(`✅ username-Spalte erfolgreich hinzugefügt`);
        } catch (error: any) {
          // Constraint existiert bereits, ignorieren
          if (!error.message?.includes('already exists')) {
            throw error;
          }
          console.log(`✅ username-Constraint existiert bereits`);
        }
      } else {
        console.log(`✅ username-Spalte existiert bereits`);
      }

      // Prüfe, ob visible_filter_ids-Spalte existiert
      const visibleFilterIdsCheck = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.columns
          WHERE table_schema = 'public'
          AND table_name = 'users'
          AND column_name = 'visible_filter_ids'
        );
      `);
      if (!visibleFilterIdsCheck.rows[0].exists) {
        console.log(`📝 Füge visible_filter_ids-Spalte zur users-Tabelle hinzu für Company ${companyId}`);
        await client.query(`ALTER TABLE users ADD COLUMN visible_filter_ids JSONB;`);
        console.log(`✅ visible_filter_ids-Spalte erfolgreich hinzugefügt`);
      }
    }
    
    // WICHTIG: email_accounts muss VOR emails erstellt werden (wegen Foreign Key)
    // Prüfe, ob email_accounts-Tabelle existiert
    const emailAccountsTableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'email_accounts'
      );
    `);

    if (!emailAccountsTableCheck.rows[0].exists) {
      console.log(`📝 Erstelle email_accounts-Tabelle für Company ${companyId}`);
      await client.query(`
        CREATE TABLE email_accounts (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL,
          name VARCHAR(255) NOT NULL,
          email VARCHAR(255) NOT NULL,
          imap_host VARCHAR(255),
          imap_port INTEGER DEFAULT 993,
          imap_username VARCHAR(255),
          imap_password TEXT,
          imap_ssl BOOLEAN DEFAULT true,
          imap_tls BOOLEAN DEFAULT false,
          imap_folder VARCHAR(255) DEFAULT 'INBOX',
          smtp_host VARCHAR(255),
          smtp_port INTEGER DEFAULT 587,
          smtp_username VARCHAR(255),
          smtp_password TEXT,
          smtp_ssl BOOLEAN DEFAULT true,
          smtp_tls BOOLEAN DEFAULT true,
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW(),
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
      `);
      console.log(`✅ email_accounts-Tabelle erfolgreich erstellt`);
    } else {
      console.log(`✅ email_accounts-Tabelle existiert bereits`);
      
      // Migration: Prüfe und füge fehlende Spalten hinzu
      
      // Prüfe, ob name-Spalte existiert
      const nameCheck = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_schema = 'public' 
          AND table_name = 'email_accounts' 
          AND column_name = 'name'
        );
      `);
      if (!nameCheck.rows[0].exists) {
        console.log(`📝 Füge name-Spalte zur email_accounts-Tabelle hinzu für Company ${companyId}`);
        await client.query(`
          ALTER TABLE email_accounts ADD COLUMN name VARCHAR(255);
          UPDATE email_accounts SET name = email WHERE name IS NULL;
          ALTER TABLE email_accounts ALTER COLUMN name SET NOT NULL;
        `);
      }

      // Prüfe, ob imap_username existiert (Migration von imap_user)
      const imapUsernameCheck = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_schema = 'public' 
          AND table_name = 'email_accounts' 
          AND column_name = 'imap_username'
        );
      `);
      if (!imapUsernameCheck.rows[0].exists) {
        const imapUserCheck = await client.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'email_accounts' 
            AND column_name = 'imap_user'
          );
        `);
        if (imapUserCheck.rows[0].exists) {
          console.log(`📝 Migriere imap_user zu imap_username für Company ${companyId}`);
          await client.query(`
            ALTER TABLE email_accounts ADD COLUMN imap_username VARCHAR(255);
            UPDATE email_accounts SET imap_username = imap_user WHERE imap_username IS NULL;
            ALTER TABLE email_accounts DROP COLUMN imap_user;
          `);
        } else {
          await client.query(`
            ALTER TABLE email_accounts ADD COLUMN imap_username VARCHAR(255);
          `);
        }
      }

      // Prüfe, ob smtp_username existiert (Migration von smtp_user)
      const smtpUsernameCheck = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_schema = 'public' 
          AND table_name = 'email_accounts' 
          AND column_name = 'smtp_username'
        );
      `);
      if (!smtpUsernameCheck.rows[0].exists) {
        const smtpUserCheck = await client.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'email_accounts' 
            AND column_name = 'smtp_user'
          );
        `);
        if (smtpUserCheck.rows[0].exists) {
          console.log(`📝 Migriere smtp_user zu smtp_username für Company ${companyId}`);
          await client.query(`
            ALTER TABLE email_accounts ADD COLUMN smtp_username VARCHAR(255);
            UPDATE email_accounts SET smtp_username = smtp_user WHERE smtp_username IS NULL;
            ALTER TABLE email_accounts DROP COLUMN smtp_user;
          `);
        } else {
          await client.query(`
            ALTER TABLE email_accounts ADD COLUMN smtp_username VARCHAR(255);
          `);
        }
      }

      // Prüfe, ob imap_ssl-Spalte existiert
      const imapSslCheck = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_schema = 'public' 
          AND table_name = 'email_accounts' 
          AND column_name = 'imap_ssl'
        );
      `);
      if (!imapSslCheck.rows[0].exists) {
        console.log(`📝 Füge imap_ssl-Spalte zur email_accounts-Tabelle hinzu für Company ${companyId}`);
        await client.query(`
          ALTER TABLE email_accounts ADD COLUMN imap_ssl BOOLEAN DEFAULT true;
        `);
      }

      // Prüfe, ob smtp_ssl-Spalte existiert
      const smtpSslCheck = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_schema = 'public' 
          AND table_name = 'email_accounts' 
          AND column_name = 'smtp_ssl'
        );
      `);
      if (!smtpSslCheck.rows[0].exists) {
        console.log(`📝 Füge smtp_ssl-Spalte zur email_accounts-Tabelle hinzu für Company ${companyId}`);
        await client.query(`
          ALTER TABLE email_accounts ADD COLUMN smtp_ssl BOOLEAN DEFAULT true;
        `);
      }

      // Prüfe, ob imap_tls-Spalte existiert
      const imapTlsCheck = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_schema = 'public' 
          AND table_name = 'email_accounts' 
          AND column_name = 'imap_tls'
        );
      `);
      if (!imapTlsCheck.rows[0].exists) {
        console.log(`📝 Füge imap_tls-Spalte zur email_accounts-Tabelle hinzu für Company ${companyId}`);
        await client.query(`
          ALTER TABLE email_accounts ADD COLUMN imap_tls BOOLEAN DEFAULT false;
        `);
      }

      // Prüfe, ob imap_folder-Spalte existiert
      const imapFolderCheck = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_schema = 'public' 
          AND table_name = 'email_accounts' 
          AND column_name = 'imap_folder'
        );
      `);
      if (!imapFolderCheck.rows[0].exists) {
        console.log(`📝 Füge imap_folder-Spalte zur email_accounts-Tabelle hinzu für Company ${companyId}`);
        await client.query(`
          ALTER TABLE email_accounts ADD COLUMN imap_folder VARCHAR(255) DEFAULT 'INBOX';
        `);
      }

      // Prüfe, ob smtp_tls-Spalte existiert
      const smtpTlsCheck = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_schema = 'public' 
          AND table_name = 'email_accounts' 
          AND column_name = 'smtp_tls'
        );
      `);
      if (!smtpTlsCheck.rows[0].exists) {
        console.log(`📝 Füge smtp_tls-Spalte zur email_accounts-Tabelle hinzu für Company ${companyId}`);
        await client.query(`
          ALTER TABLE email_accounts ADD COLUMN smtp_tls BOOLEAN DEFAULT true;
        `);
      }
    }
    
    // Prüfe, ob emails-Tabelle existiert
    const emailsTableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'emails'
      );
    `);

    if (!emailsTableCheck.rows[0].exists) {
      console.log(`📝 Erstelle emails-Tabelle für Company ${companyId}`);
      await client.query(`
        CREATE TABLE emails (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL,
          account_id UUID,
          subject VARCHAR(500),
          from_email VARCHAR(255),
          to_email TEXT,
          body TEXT,
          message_uid INTEGER,
          created_at TIMESTAMP DEFAULT NOW(),
          read_at TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (account_id) REFERENCES email_accounts(id) ON DELETE CASCADE
        );
      `);
      console.log(`✅ emails-Tabelle erfolgreich erstellt`);
    } else {
      console.log(`✅ emails-Tabelle existiert bereits`);
      
      // Prüfe, ob account_id-Spalte existiert
      const accountIdCheck = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_schema = 'public' 
          AND table_name = 'emails' 
          AND column_name = 'account_id'
        );
      `);

      if (!accountIdCheck.rows[0].exists) {
        console.log(`📝 Füge account_id-Spalte zur emails-Tabelle hinzu für Company ${companyId}`);
        await client.query(`
          ALTER TABLE emails ADD COLUMN account_id UUID;
          ALTER TABLE emails ADD CONSTRAINT emails_account_id_fkey 
            FOREIGN KEY (account_id) REFERENCES email_accounts(id) ON DELETE CASCADE;
        `);
        console.log(`✅ account_id-Spalte erfolgreich hinzugefügt`);
      }

      // Prüfe, ob message_uid-Spalte existiert
      const messageUidCheck = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_schema = 'public' 
          AND table_name = 'emails' 
          AND column_name = 'message_uid'
        );
      `);

      if (!messageUidCheck.rows[0].exists) {
        console.log(`📝 Füge message_uid-Spalte zur emails-Tabelle hinzu für Company ${companyId}`);
        await client.query(`
          ALTER TABLE emails ADD COLUMN message_uid INTEGER;
          CREATE INDEX IF NOT EXISTS idx_emails_account_uid ON emails(account_id, message_uid);
        `);
        console.log(`✅ message_uid-Spalte erfolgreich hinzugefügt`);
      }

      // Prüfe, ob has_attachment-Spalte existiert
      const hasAttachmentCheck = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_schema = 'public' 
          AND table_name = 'emails' 
          AND column_name = 'has_attachment'
        );
      `);

      if (!hasAttachmentCheck.rows[0].exists) {
        console.log(`📝 Füge has_attachment-Spalte zur emails-Tabelle hinzu für Company ${companyId}`);
        await client.query(`
          ALTER TABLE emails ADD COLUMN has_attachment BOOLEAN DEFAULT false;
        `);
        console.log(`✅ has_attachment-Spalte erfolgreich hinzugefügt`);
      } else {
        // Stelle sicher, dass UNIQUE Constraint existiert für Bulk-Insert mit ON CONFLICT
        try {
          await client.query(`
            DO $$
            BEGIN
              IF NOT EXISTS (
                SELECT 1 FROM pg_constraint 
                WHERE conname = 'emails_account_uid_unique' 
                AND conrelid = 'emails'::regclass
              ) THEN
                ALTER TABLE emails ADD CONSTRAINT emails_account_uid_unique 
                UNIQUE (account_id, message_uid);
              END IF;
            END $$;
          `);
          console.log(`✅ UNIQUE Constraint auf (account_id, message_uid) sichergestellt`);
        } catch (error: any) {
          // Constraint existiert möglicherweise bereits, ignoriere Fehler
          if (!error.message.includes('already exists') && !error.message.includes('duplicate')) {
            console.warn(`⚠️ Fehler beim Erstellen des UNIQUE Constraints: ${error.message}`);
          }
        }
      }

      // Prüfe, ob deleted_at-Spalte existiert
      const deletedAtCheck = await client.query(`
        SELECT EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
          AND table_name = 'emails'
          AND column_name = 'deleted_at'
        );
      `);

      if (!deletedAtCheck.rows[0].exists) {
        console.log(`📝 Füge deleted_at-Spalte zur emails-Tabelle hinzu für Company ${companyId}`);
        await client.query(`
          ALTER TABLE emails ADD COLUMN deleted_at TIMESTAMP;
        `);
        console.log(`✅ deleted_at-Spalte erfolgreich hinzugefügt`);
      }

      // Prüfe, ob spam_at-Spalte existiert
      const spamAtCheck = await client.query(`
        SELECT EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
          AND table_name = 'emails'
          AND column_name = 'spam_at'
        );
      `);

      if (!spamAtCheck.rows[0].exists) {
        console.log(`📝 Füge spam_at-Spalte zur emails-Tabelle hinzu für Company ${companyId}`);
        await client.query(`
          ALTER TABLE emails ADD COLUMN spam_at TIMESTAMP;
        `);
        console.log(`✅ spam_at-Spalte erfolgreich hinzugefügt`);
      }

      // Prüfe, ob important_at-Spalte existiert
      const importantAtCheck = await client.query(`
        SELECT EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
          AND table_name = 'emails'
          AND column_name = 'important_at'
        );
      `);

      if (!importantAtCheck.rows[0].exists) {
        console.log(`📝 Füge important_at-Spalte zur emails-Tabelle hinzu für Company ${companyId}`);
        await client.query(`
          ALTER TABLE emails ADD COLUMN important_at TIMESTAMP;
        `);
        console.log(`✅ important_at-Spalte erfolgreich hinzugefügt`);
      }

      // Prüfe, ob theme_id-Spalte existiert
      const themeIdCheck = await client.query(`
        SELECT EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
          AND table_name = 'emails'
          AND column_name = 'theme_id'
        );
      `);

      if (!themeIdCheck.rows[0].exists) {
        console.log(`📝 Füge theme_id-Spalte zur emails-Tabelle hinzu für Company ${companyId}`);
        await client.query(`
          ALTER TABLE emails ADD COLUMN theme_id UUID;
          ALTER TABLE emails ADD CONSTRAINT emails_theme_id_fkey 
            FOREIGN KEY (theme_id) REFERENCES email_themes(id) ON DELETE SET NULL;
          CREATE INDEX IF NOT EXISTS idx_emails_theme_id ON emails(theme_id);
        `);
        console.log(`✅ theme_id-Spalte erfolgreich hinzugefügt`);
      }

      // Prüfe, ob urgency-Spalte existiert
      const urgencyCheck = await client.query(`
        SELECT EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
          AND table_name = 'emails'
          AND column_name = 'urgency'
        );
      `);

      if (!urgencyCheck.rows[0].exists) {
        console.log(`📝 Füge urgency-Spalte zur emails-Tabelle hinzu für Company ${companyId}`);
        await client.query(`
          ALTER TABLE emails ADD COLUMN urgency VARCHAR(20) CHECK (urgency IN ('low', 'medium', 'high') OR urgency IS NULL);
          CREATE INDEX IF NOT EXISTS idx_emails_urgency ON emails(urgency);
        `);
        console.log(`✅ urgency-Spalte erfolgreich hinzugefügt`);
      }

      // Prüfe, ob department_id-Spalte existiert
      const departmentIdCheck = await client.query(`
        SELECT EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
          AND table_name = 'emails'
          AND column_name = 'department_id'
        );
      `);

      if (!departmentIdCheck.rows[0].exists) {
        console.log(`📝 Füge department_id-Spalte zur emails-Tabelle hinzu für Company ${companyId}`);
        await client.query(`
          ALTER TABLE emails ADD COLUMN department_id UUID;
        `);
        
        // Prüfe, ob departments Tabelle existiert, bevor Foreign Key erstellt wird
        const departmentsTableCheck = await client.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'departments'
          );
        `);
        
        if (departmentsTableCheck.rows[0].exists) {
          // Foreign Key Constraint hinzufügen
          await client.query(`
            ALTER TABLE emails 
            ADD CONSTRAINT fk_emails_department 
            FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL;
          `);
        }
        
        // Index hinzufügen
        await client.query(`
          CREATE INDEX IF NOT EXISTS idx_emails_department ON emails(department_id);
        `);
        console.log(`✅ department_id-Spalte erfolgreich hinzugefügt`);
      }

      // Prüfe, ob cc_email-Spalte existiert
      const ccEmailCheck = await client.query(`
        SELECT EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
          AND table_name = 'emails'
          AND column_name = 'cc_email'
        );
      `);

      if (!ccEmailCheck.rows[0].exists) {
        console.log(`📝 Füge cc_email-Spalte zur emails-Tabelle hinzu für Company ${companyId}`);
        await client.query(`
          ALTER TABLE emails ADD COLUMN cc_email TEXT;
        `);
        console.log(`✅ cc_email-Spalte erfolgreich hinzugefügt`);
      }

      // Prüfe, ob bcc_email-Spalte existiert
      const bccEmailCheck = await client.query(`
        SELECT EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
          AND table_name = 'emails'
          AND column_name = 'bcc_email'
        );
      `);

      if (!bccEmailCheck.rows[0].exists) {
        console.log(`📝 Füge bcc_email-Spalte zur emails-Tabelle hinzu für Company ${companyId}`);
        await client.query(`
          ALTER TABLE emails ADD COLUMN bcc_email TEXT;
        `);
        console.log(`✅ bcc_email-Spalte erfolgreich hinzugefügt`);
      }

      // ============================================
      // TICKET-ID SYSTEM MIGRATION
      // ============================================
      
      // Prüfe, ob company_id-Spalte existiert (für Ticket-ID Scoping)
      const emailsCompanyIdCheck = await client.query(`
        SELECT EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
          AND table_name = 'emails'
          AND column_name = 'company_id'
        );
      `);

      if (!emailsCompanyIdCheck.rows[0].exists) {
        console.log(`📝 Füge company_id-Spalte zur emails-Tabelle hinzu für Company ${companyId}`);
        await client.query(`
          ALTER TABLE emails ADD COLUMN company_id UUID;
        `);
        // Setze company_id aus user_id für bestehende E-Mails
        await client.query(`
          UPDATE emails 
          SET company_id = u.company_id 
          FROM users u 
          WHERE emails.user_id = u.id AND emails.company_id IS NULL;
        `);
        // Mache Spalte NOT NULL
        await client.query(`
          ALTER TABLE emails ALTER COLUMN company_id SET NOT NULL;
        `);
        console.log(`✅ company_id-Spalte erfolgreich hinzugefügt`);
      }

      // Prüfe, ob ticket_id-Spalte existiert
      const ticketIdCheck = await client.query(`
        SELECT EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
          AND table_name = 'emails'
          AND column_name = 'ticket_id'
        );
      `);

      if (!ticketIdCheck.rows[0].exists) {
        console.log(`📝 Füge ticket_id-Spalte zur emails-Tabelle hinzu für Company ${companyId}`);
        await client.query(`
          ALTER TABLE emails ADD COLUMN ticket_id VARCHAR(12);
        `);
        
        // Füge CHECK Constraint für Format-Validierung hinzu
        await client.query(`
          ALTER TABLE emails 
          ADD CONSTRAINT emails_ticket_id_format_check 
          CHECK (ticket_id ~ '^M\\d{11}$' OR ticket_id IS NULL);
        `);
        
        console.log(`✅ ticket_id-Spalte erfolgreich hinzugefügt`);
      }

      // Prüfe, ob is_conversation_thread-Spalte existiert
      const isConversationThreadCheck = await client.query(`
        SELECT EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
          AND table_name = 'emails'
          AND column_name = 'is_conversation_thread'
        );
      `);

      if (!isConversationThreadCheck.rows[0].exists) {
        console.log(`📝 Füge is_conversation_thread-Spalte zur emails-Tabelle hinzu für Company ${companyId}`);
        await client.query(`
          ALTER TABLE emails ADD COLUMN is_conversation_thread BOOLEAN DEFAULT false;
        `);
        console.log(`✅ is_conversation_thread-Spalte erfolgreich hinzugefügt`);
      }

      // Prüfe, ob conversation_message_count-Spalte existiert
      const conversationMessageCountCheck = await client.query(`
        SELECT EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
          AND table_name = 'emails'
          AND column_name = 'conversation_message_count'
        );
      `);

      if (!conversationMessageCountCheck.rows[0].exists) {
        console.log(`📝 Füge conversation_message_count-Spalte zur emails-Tabelle hinzu für Company ${companyId}`);
        await client.query(`
          ALTER TABLE emails ADD COLUMN conversation_message_count INTEGER DEFAULT 1;
        `);
        console.log(`✅ conversation_message_count-Spalte erfolgreich hinzugefügt`);
      }

      // Prüfe, ob type-Spalte existiert (für Telefonnotizen)
      const typeCheck = await client.query(`
        SELECT EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
          AND table_name = 'emails'
          AND column_name = 'type'
        );
      `);

      if (!typeCheck.rows[0].exists) {
        console.log(`📝 Füge type-Spalte zur emails-Tabelle hinzu für Company ${companyId}`);
        await client.query(`
          ALTER TABLE emails ADD COLUMN type VARCHAR(20) CHECK (type IN ('email', 'phone_note')) DEFAULT 'email';
        `);
        // Setze type='email' für alle bestehenden E-Mails
        await client.query(`
          UPDATE emails SET type = 'email' WHERE type IS NULL;
        `);
        // Erstelle Index für schnelles Filtern
        await client.query(`
          CREATE INDEX IF NOT EXISTS idx_emails_type ON emails(type);
        `);
        // Erstelle Composite-Index für sortierte Listen
        await client.query(`
          CREATE INDEX IF NOT EXISTS idx_emails_type_created ON emails(type, created_at DESC);
        `);
        console.log(`✅ type-Spalte erfolgreich hinzugefügt`);
      }

      // Prüfe, ob phone_number-Spalte existiert (für Telefonnotizen)
      const phoneNumberCheck = await client.query(`
        SELECT EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
          AND table_name = 'emails'
          AND column_name = 'phone_number'
        );
      `);

      if (!phoneNumberCheck.rows[0].exists) {
        console.log(`📝 Füge phone_number-Spalte zur emails-Tabelle hinzu für Company ${companyId}`);
        await client.query(`
          ALTER TABLE emails ADD COLUMN phone_number VARCHAR(50);
        `);
        // Erstelle Index für Suche (nur wenn nicht NULL)
        await client.query(`
          CREATE INDEX IF NOT EXISTS idx_emails_phone_number ON emails(phone_number) WHERE phone_number IS NOT NULL;
        `);
        console.log(`✅ phone_number-Spalte erfolgreich hinzugefügt`);
      }

      // Erstelle Ticket-ID Indizes
      try {
        // Composite Index für schnelle Ticket-ID Suchen pro Company
        await client.query(`
          CREATE INDEX IF NOT EXISTS idx_emails_company_ticket 
          ON emails(company_id, ticket_id) WHERE ticket_id IS NOT NULL;
        `);
        console.log(`✅ Index idx_emails_company_ticket erstellt`);

        // Index für Konversations-Abfragen (mit DESC für neueste E-Mail zuerst)
        await client.query(`
          CREATE INDEX IF NOT EXISTS idx_conversation_threads 
          ON emails(ticket_id, created_at DESC) 
          WHERE is_conversation_thread = true;
        `);
        console.log(`✅ Index idx_conversation_threads erstellt`);
      } catch (error: any) {
        if (!error.message.includes('already exists')) {
          console.warn(`⚠️ Fehler beim Erstellen der Ticket-ID Indizes: ${error.message}`);
        }
      }

      // Erstelle Performance-Indizes für emails-Tabelle
      try {
        // Index für ORDER BY created_at DESC (häufigste Query)
        await client.query(`
          CREATE INDEX IF NOT EXISTS idx_emails_user_created_desc 
          ON emails(user_id, created_at DESC);
        `);
        console.log(`✅ Index idx_emails_user_created_desc erstellt`);

        // Index für Filter auf deleted_at
        await client.query(`
          CREATE INDEX IF NOT EXISTS idx_emails_user_deleted 
          ON emails(user_id, deleted_at);
        `);
        console.log(`✅ Index idx_emails_user_deleted erstellt`);

        // Composite Index für häufige Queries (Covering Index)
        await client.query(`
          CREATE INDEX IF NOT EXISTS idx_emails_user_created_deleted 
          ON emails(user_id, created_at DESC, deleted_at);
        `);
        console.log(`✅ Index idx_emails_user_created_deleted erstellt`);

        // Index für Suche auf from_email
        await client.query(`
          CREATE INDEX IF NOT EXISTS idx_emails_from_email 
          ON emails(from_email);
        `);
        console.log(`✅ Index idx_emails_from_email erstellt`);

        // Index für Suche auf to_email (für ILIKE-Suche)
        await client.query(`
          CREATE INDEX IF NOT EXISTS idx_emails_to_email 
          ON emails(to_email);
        `);
        console.log(`✅ Index idx_emails_to_email erstellt`);

        // Volltext-Index für body (tsvector)
        // Prüfe ob body_tsvector Spalte existiert
        const tsvectorCheck = await client.query(`
          SELECT EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
            AND table_name = 'emails'
            AND column_name = 'body_tsvector'
          );
        `);

        if (!tsvectorCheck.rows[0].exists) {
          console.log(`📝 Füge body_tsvector-Spalte zur emails-Tabelle hinzu für Company ${companyId}`);
          await client.query(`
            ALTER TABLE emails ADD COLUMN body_tsvector tsvector;
          `);
          console.log(`✅ body_tsvector-Spalte erfolgreich hinzugefügt`);

          // Erstelle GIN-Index für tsvector
          await client.query(`
            CREATE INDEX IF NOT EXISTS idx_emails_body_tsvector 
            ON emails USING gin(body_tsvector);
          `);
          console.log(`✅ Volltext-Index idx_emails_body_tsvector erstellt`);

          // Erstelle Trigger-Funktion für automatische Aktualisierung
          await client.query(`
            CREATE OR REPLACE FUNCTION emails_body_tsvector_trigger() RETURNS trigger AS $$
            BEGIN
              NEW.body_tsvector := to_tsvector('german', COALESCE(NEW.body, ''));
              RETURN NEW;
            END;
            $$ LANGUAGE plpgsql;
          `);
          console.log(`✅ Trigger-Funktion emails_body_tsvector_trigger erstellt`);

          // Erstelle Trigger
          await client.query(`
            DROP TRIGGER IF EXISTS emails_body_tsvector_update ON emails;
            CREATE TRIGGER emails_body_tsvector_update 
            BEFORE INSERT OR UPDATE ON emails 
            FOR EACH ROW EXECUTE FUNCTION emails_body_tsvector_trigger();
          `);
          console.log(`✅ Trigger emails_body_tsvector_update erstellt`);

          // Befülle tsvector für bestehende E-Mails
          await client.query(`
            UPDATE emails 
            SET body_tsvector = to_tsvector('german', COALESCE(body, ''))
            WHERE body_tsvector IS NULL;
          `);
          console.log(`✅ body_tsvector für bestehende E-Mails befüllt`);
        } else {
          console.log(`✅ body_tsvector-Spalte existiert bereits`);
          
          // Stelle sicher, dass Index existiert
          await client.query(`
            CREATE INDEX IF NOT EXISTS idx_emails_body_tsvector 
            ON emails USING gin(body_tsvector);
          `);
        }
      } catch (error: any) {
        // Indizes existieren möglicherweise bereits, ignoriere Fehler
        if (!error.message.includes('already exists') && !error.message.includes('duplicate')) {
          console.warn(`⚠️ Fehler beim Erstellen der emails Indizes: ${error.message}`);
        }
      }
    }

    // Prüfe, ob email_attachments-Tabelle existiert
    const attachmentsTableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'email_attachments'
      );
    `);

    if (!attachmentsTableCheck.rows[0].exists) {
      console.log(`📝 Erstelle email_attachments-Tabelle für Company ${companyId}`);
      await client.query(`
        CREATE TABLE email_attachments (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          email_id UUID NOT NULL,
          filename VARCHAR(255) NOT NULL,
          content_type VARCHAR(255),
          size_bytes BIGINT,
          file_path TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT NOW(),
          FOREIGN KEY (email_id) REFERENCES emails(id) ON DELETE CASCADE,
          UNIQUE (email_id, filename)
        );
        CREATE INDEX idx_email_attachments_email_id ON email_attachments(email_id);
      `);
      console.log(`✅ email_attachments-Tabelle erfolgreich erstellt`);
    } else {
      console.log(`✅ email_attachments-Tabelle existiert bereits`);
    }
    
    // Prüfe, ob email_accounts-Tabelle existiert
    const accountsTableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'email_accounts'
      );
    `);

    if (!accountsTableCheck.rows[0].exists) {
      console.log(`📝 Erstelle email_accounts-Tabelle für Company ${companyId}`);
      await client.query(`
        CREATE TABLE email_accounts (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL,
          name VARCHAR(255) NOT NULL,
          email VARCHAR(255) NOT NULL,
          imap_host VARCHAR(255),
          imap_port INTEGER DEFAULT 993,
          imap_username VARCHAR(255),
          imap_password TEXT,
          imap_ssl BOOLEAN DEFAULT true,
          imap_folder VARCHAR(255) DEFAULT 'INBOX',
          smtp_host VARCHAR(255),
          smtp_port INTEGER DEFAULT 587,
          smtp_username VARCHAR(255),
          smtp_password TEXT,
          smtp_ssl BOOLEAN DEFAULT true,
          smtp_tls BOOLEAN DEFAULT true,
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW(),
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
      `);
      console.log(`✅ email_accounts-Tabelle erfolgreich erstellt`);
    } else {
      console.log(`✅ email_accounts-Tabelle existiert bereits`);
      
      // Prüfe, ob imap_tls-Spalte existiert
      const imapTlsCheck = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_schema = 'public' 
          AND table_name = 'email_accounts' 
          AND column_name = 'imap_tls'
        );
      `);

      if (!imapTlsCheck.rows[0].exists) {
        console.log(`📝 Füge imap_tls-Spalte zur email_accounts-Tabelle hinzu für Company ${companyId}`);
        await client.query(`
          ALTER TABLE email_accounts ADD COLUMN imap_tls BOOLEAN DEFAULT false;
        `);
        console.log(`✅ imap_tls-Spalte erfolgreich hinzugefügt`);
      }

      // Prüfe, ob imap_folder-Spalte existiert
      const imapFolderCheck = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_schema = 'public' 
          AND table_name = 'email_accounts' 
          AND column_name = 'imap_folder'
        );
      `);

      if (!imapFolderCheck.rows[0].exists) {
        console.log(`📝 Füge imap_folder-Spalte zur email_accounts-Tabelle hinzu für Company ${companyId}`);
        await client.query(`
          ALTER TABLE email_accounts ADD COLUMN imap_folder VARCHAR(255) DEFAULT 'INBOX';
        `);
        console.log(`✅ imap_folder-Spalte erfolgreich hinzugefügt`);
      }
    }

    // Prüfe, ob user_settings-Tabelle existiert
    const userSettingsTableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'user_settings'
      );
    `);

    if (!userSettingsTableCheck.rows[0].exists) {
      console.log(`📝 Erstelle user_settings-Tabelle für Company ${companyId}`);
      await client.query(`
        CREATE TABLE user_settings (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL UNIQUE,
          fetch_interval_minutes INTEGER DEFAULT 5,
          email_filters JSONB DEFAULT '[]'::jsonb,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW(),
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
      `);
      console.log(`✅ user_settings-Tabelle erfolgreich erstellt`);
    } else {
      console.log(`✅ user_settings-Tabelle existiert bereits`);
      
      // Prüfe, ob email_filters Spalte existiert
      const emailFiltersColumnCheck = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_schema = 'public' 
          AND table_name = 'user_settings' 
          AND column_name = 'email_filters'
        );
      `);
      
      if (!emailFiltersColumnCheck.rows[0].exists) {
        console.log(`📝 Füge email_filters Spalte zur user_settings-Tabelle hinzu für Company ${companyId}`);
        await client.query(`
          ALTER TABLE user_settings 
          ADD COLUMN email_filters JSONB DEFAULT '[]'::jsonb;
        `);
        console.log(`✅ email_filters Spalte erfolgreich hinzugefügt`);
      } else {
        console.log(`✅ email_filters Spalte existiert bereits`);
      }

      // Prüfe, ob email_list_layout Spalte existiert
      const emailListLayoutCheck = await client.query(`
        SELECT EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
          AND table_name = 'user_settings'
          AND column_name = 'email_list_layout'
        );
      `);
      
      if (!emailListLayoutCheck.rows[0].exists) {
        console.log(`📝 Füge email_list_layout Spalte zur user_settings-Tabelle hinzu für Company ${companyId}`);
        await client.query(`
          ALTER TABLE user_settings 
          ADD COLUMN email_list_layout VARCHAR(20) DEFAULT 'cards';
        `);
        console.log(`✅ email_list_layout Spalte erfolgreich hinzugefügt`);
      } else {
        console.log(`✅ email_list_layout Spalte existiert bereits`);
      }

      // Prüfe, ob table_columns Spalte existiert
      const tableColumnsCheck = await client.query(`
        SELECT EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
          AND table_name = 'user_settings'
          AND column_name = 'table_columns'
        );
      `);
      
      if (!tableColumnsCheck.rows[0].exists) {
        console.log(`📝 Füge table_columns Spalte zur user_settings-Tabelle hinzu für Company ${companyId}`);
        await client.query(`
          ALTER TABLE user_settings 
          ADD COLUMN table_columns JSONB DEFAULT '[]'::jsonb;
        `);
        console.log(`✅ table_columns Spalte erfolgreich hinzugefügt`);
      } else {
        console.log(`✅ table_columns Spalte existiert bereits`);
      }

      // Prüfe, ob search_fields Spalte existiert
      const searchFieldsCheck = await client.query(`
        SELECT EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
          AND table_name = 'user_settings'
          AND column_name = 'search_fields'
        );
      `);
      
      if (!searchFieldsCheck.rows[0].exists) {
        console.log(`📝 Füge search_fields Spalte zur user_settings-Tabelle hinzu für Company ${companyId}`);
        await client.query(`
          ALTER TABLE user_settings 
          ADD COLUMN search_fields JSONB DEFAULT '["subject", "from", "body"]'::jsonb;
        `);
        console.log(`✅ search_fields Spalte erfolgreich hinzugefügt`);
      } else {
        console.log(`✅ search_fields Spalte existiert bereits`);
      }

      // Prüfe, ob default_department_id Spalte existiert
      const defaultDepartmentIdCheck = await client.query(`
        SELECT EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
          AND table_name = 'user_settings'
          AND column_name = 'default_department_id'
        );
      `);
      
      if (!defaultDepartmentIdCheck.rows[0].exists) {
        console.log(`📝 Füge default_department_id Spalte zur user_settings-Tabelle hinzu für Company ${companyId}`);
        await client.query(`
          ALTER TABLE user_settings 
          ADD COLUMN default_department_id UUID;
        `);
        
        // Prüfe, ob departments Tabelle existiert, bevor Foreign Key erstellt wird
        const departmentsTableCheck = await client.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'departments'
          );
        `);
        
        if (departmentsTableCheck.rows[0].exists) {
          // Foreign Key Constraint hinzufügen
          await client.query(`
            ALTER TABLE user_settings 
            ADD CONSTRAINT fk_user_settings_default_department 
            FOREIGN KEY (default_department_id) REFERENCES departments(id) ON DELETE SET NULL;
          `);
        }
        console.log(`✅ default_department_id Spalte erfolgreich hinzugefügt`);
      } else {
        console.log(`✅ default_department_id Spalte existiert bereits`);
      }

      // Prüfe, ob layout_preferences Spalte existiert
      const layoutPreferencesColumnCheck = await client.query(`
        SELECT EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
          AND table_name = 'user_settings'
          AND column_name = 'layout_preferences'
        );
      `);

      if (!layoutPreferencesColumnCheck.rows[0].exists) {
        console.log(`📝 Füge layout_preferences Spalte zur user_settings-Tabelle hinzu für Company ${companyId}`);
        await client.query(`
          ALTER TABLE user_settings
          ADD COLUMN layout_preferences JSONB DEFAULT '{}'::jsonb;
        `);
        console.log(`✅ layout_preferences Spalte erfolgreich hinzugefügt`);
      } else {
        console.log(`✅ layout_preferences Spalte existiert bereits`);
      }
    }

    // Prüfe, ob email_read_status-Tabelle existiert
    const emailReadStatusTableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'email_read_status'
      );
    `);

    if (!emailReadStatusTableCheck.rows[0].exists) {
      console.log(`📝 Erstelle email_read_status-Tabelle für Company ${companyId}`);
      await client.query(`
        CREATE TABLE email_read_status (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          email_id UUID NOT NULL,
          user_id UUID NOT NULL,
          read_at TIMESTAMP DEFAULT NOW(),
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW(),
          UNIQUE(email_id, user_id),
          FOREIGN KEY (email_id) REFERENCES emails(id) ON DELETE CASCADE,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
      `);
      console.log(`✅ email_read_status-Tabelle erfolgreich erstellt`);
    } else {
      console.log(`✅ email_read_status-Tabelle existiert bereits`);
      
      // Erstelle Index auf email_read_status für JOIN-Performance (KRITISCH)
      try {
        await client.query(`
          CREATE INDEX IF NOT EXISTS idx_email_read_status_email_user 
          ON email_read_status(email_id, user_id);
        `);
        console.log(`✅ Index auf email_read_status(email_id, user_id) erstellt`);
      } catch (error: any) {
        // Index existiert möglicherweise bereits, ignoriere Fehler
        if (!error.message.includes('already exists')) {
          console.warn(`⚠️ Fehler beim Erstellen des email_read_status Index: ${error.message}`);
        }
      }
    }

    // Prüfe, ob email_completed_status-Tabelle existiert
    const emailCompletedStatusTableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'email_completed_status'
      );
    `);

    if (!emailCompletedStatusTableCheck.rows[0].exists) {
      console.log(`📝 Erstelle email_completed_status-Tabelle für Company ${companyId}`);
      await client.query(`
        CREATE TABLE email_completed_status (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          email_id UUID NOT NULL,
          user_id UUID NOT NULL,
          completed_at TIMESTAMP DEFAULT NOW(),
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW(),
          UNIQUE(email_id, user_id),
          FOREIGN KEY (email_id) REFERENCES emails(id) ON DELETE CASCADE,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
      `);
      console.log(`✅ email_completed_status-Tabelle erfolgreich erstellt`);
    } else {
      console.log(`✅ email_completed_status-Tabelle existiert bereits`);
      
      // Erstelle Index auf email_completed_status für JOIN-Performance
      try {
        await client.query(`
          CREATE INDEX IF NOT EXISTS idx_email_completed_status_email_user 
          ON email_completed_status(email_id, user_id);
        `);
        console.log(`✅ Index auf email_completed_status(email_id, user_id) erstellt`);
      } catch (error: any) {
        // Index existiert möglicherweise bereits, ignoriere Fehler
        if (!error.message.includes('already exists')) {
          console.warn(`⚠️ Fehler beim Erstellen des email_completed_status Index: ${error.message}`);
        }
      }
    }

    // Prüfe, ob email_themes-Tabelle existiert
    const emailThemesTableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'email_themes'
      );
    `);

    if (!emailThemesTableCheck.rows[0].exists) {
      console.log(`📝 Erstelle email_themes-Tabelle für Company ${companyId}`);
      await client.query(`
        CREATE TABLE email_themes (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL,
          name VARCHAR(255) NOT NULL,
          color VARCHAR(7),
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW(),
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
      `);
      console.log(`✅ email_themes-Tabelle erfolgreich erstellt`);
    } else {
      console.log(`✅ email_themes-Tabelle existiert bereits`);
    }

    // Prüfe, ob automation_rules-Tabelle existiert
    const automationRulesTableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'automation_rules'
      );
    `);

    if (!automationRulesTableCheck.rows[0].exists) {
      console.log(`📝 Erstelle automation_rules-Tabelle für Company ${companyId}`);
      await client.query(`
        CREATE TABLE automation_rules (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL,
          name VARCHAR(255) NOT NULL,
          description TEXT,
          is_active BOOLEAN DEFAULT true NOT NULL,
          priority INTEGER DEFAULT 0 NOT NULL,
          trigger_type VARCHAR(50) NOT NULL,
          trigger_config JSONB DEFAULT '{}'::jsonb,
          workflow_data JSONB NOT NULL,
          execution_count INTEGER DEFAULT 0 NOT NULL,
          last_executed_at TIMESTAMP,
          created_at TIMESTAMP DEFAULT NOW() NOT NULL,
          updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          UNIQUE(user_id, name),
          CHECK(priority >= -1000 AND priority <= 1000),
          CHECK(trigger_type IN ('incoming', 'outgoing', 'manual', 'scheduled', 'email_updated'))
        );
        CREATE INDEX idx_automation_rules_user_active_priority ON automation_rules(user_id, is_active, priority DESC);
        CREATE INDEX idx_automation_rules_trigger_active ON automation_rules(trigger_type, is_active);
      `);
      console.log(`✅ automation_rules-Tabelle erfolgreich erstellt`);
    } else {
      console.log(`✅ automation_rules-Tabelle existiert bereits`);
    }

    // Prüfe, ob automation_execution_logs-Tabelle existiert
    const automationExecutionLogsTableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'automation_execution_logs'
      );
    `);

    if (!automationExecutionLogsTableCheck.rows[0].exists) {
      console.log(`📝 Erstelle automation_execution_logs-Tabelle für Company ${companyId}`);
      await client.query(`
        CREATE TABLE automation_execution_logs (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          rule_id UUID NOT NULL,
          user_id UUID NOT NULL,
          email_id UUID,
          trigger_type VARCHAR(50) NOT NULL,
          status VARCHAR(20) NOT NULL,
          execution_time_ms INTEGER NOT NULL,
          error_message TEXT,
          executed_actions JSONB DEFAULT '[]'::jsonb,
          created_at TIMESTAMP DEFAULT NOW() NOT NULL,
          FOREIGN KEY (rule_id) REFERENCES automation_rules(id) ON DELETE CASCADE,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (email_id) REFERENCES emails(id) ON DELETE SET NULL,
          CHECK(status IN ('success', 'failed', 'skipped')),
          CHECK(execution_time_ms >= 0)
        );
        CREATE INDEX idx_automation_execution_logs_rule_created ON automation_execution_logs(rule_id, created_at DESC);
        CREATE INDEX idx_automation_execution_logs_email_created ON automation_execution_logs(email_id, created_at DESC);
        CREATE INDEX idx_automation_execution_logs_user_created ON automation_execution_logs(user_id, created_at DESC);
        CREATE INDEX idx_automation_execution_logs_status_created ON automation_execution_logs(status, created_at DESC);
      `);
      console.log(`✅ automation_execution_logs-Tabelle erfolgreich erstellt`);
    } else {
      console.log(`✅ automation_execution_logs-Tabelle existiert bereits`);
    }

    // Prüfe, ob email_events-Tabelle existiert
    const emailEventsTableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'email_events'
      );
    `);

    if (!emailEventsTableCheck.rows[0].exists) {
      console.log(`📝 Erstelle email_events-Tabelle für Company ${companyId}`);
      await client.query(`
        CREATE TABLE email_events (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          email_id UUID NOT NULL,
          user_id UUID NOT NULL,
          event_type VARCHAR(50) NOT NULL,
          event_data JSONB DEFAULT '{}'::jsonb,
          created_at TIMESTAMP DEFAULT NOW() NOT NULL,
          FOREIGN KEY (email_id) REFERENCES emails(id) ON DELETE CASCADE,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          CHECK(event_type IN ('received', 'read', 'unread', 'deleted', 'restored', 'marked_important', 'marked_spam', 'marked_completed', 'marked_uncompleted', 'theme_assigned', 'urgency_set', 'department_assigned', 'department_removed', 'forwarded', 'automation_triggered', 'automation_applied', 'automation_rule_activated', 'automation_rule_deactivated', 'ticket_assigned', 'ticket_reused', 'ticket_changed', 'conversation_created'))
        );
        CREATE INDEX idx_email_events_email_created ON email_events(email_id, created_at DESC);
        CREATE INDEX idx_email_events_user_created ON email_events(user_id, created_at DESC);
        CREATE INDEX idx_email_events_type_created ON email_events(event_type, created_at DESC);
      `);
      console.log(`✅ email_events-Tabelle erfolgreich erstellt`);
    } else {
      console.log(`✅ email_events-Tabelle existiert bereits`);
      // Prüfe und aktualisiere CHECK-Constraint, falls nötig
      try {
        // Entferne alten Constraint (falls vorhanden)
        await client.query(`
          ALTER TABLE email_events 
          DROP CONSTRAINT IF EXISTS email_events_event_type_check;
        `);
        // Füge neuen Constraint mit allen Event-Typen hinzu (inkl. Ticket-ID Events)
        await client.query(`
          ALTER TABLE email_events 
          ADD CONSTRAINT email_events_event_type_check 
          CHECK(event_type IN ('received', 'read', 'unread', 'deleted', 'restored', 'marked_important', 'marked_spam', 'marked_completed', 'marked_uncompleted', 'theme_assigned', 'urgency_set', 'department_assigned', 'department_removed', 'forwarded', 'automation_triggered', 'automation_applied', 'automation_rule_activated', 'automation_rule_deactivated', 'ticket_assigned', 'ticket_reused', 'ticket_changed', 'conversation_created'));
        `);
        console.log(`✅ email_events CHECK-Constraint aktualisiert`);
      } catch (err: any) {
        // Constraint könnte bereits den richtigen Namen haben oder nicht existieren
        // Versuche, den Constraint direkt zu aktualisieren
        if (err.code === '42704' || err.message?.includes('does not exist')) {
          // Constraint existiert nicht, erstelle ihn (inkl. Ticket-ID Events)
          await client.query(`
            ALTER TABLE email_events 
            ADD CONSTRAINT email_events_event_type_check 
            CHECK(event_type IN ('received', 'read', 'unread', 'deleted', 'restored', 'marked_important', 'marked_spam', 'marked_completed', 'marked_uncompleted', 'theme_assigned', 'urgency_set', 'department_assigned', 'department_removed', 'forwarded', 'automation_triggered', 'automation_applied', 'automation_rule_activated', 'automation_rule_deactivated', 'ticket_assigned', 'ticket_reused', 'ticket_changed', 'conversation_created'));
          `);
          console.log(`✅ email_events CHECK-Constraint erstellt`);
        } else if (err.code === '23514' || err.message?.includes('constraint')) {
          // Constraint existiert bereits mit anderem Namen, finde und aktualisiere ihn
          const constraintCheck = await client.query(`
            SELECT constraint_name 
            FROM information_schema.table_constraints 
            WHERE table_name = 'email_events' 
            AND constraint_type = 'CHECK'
            AND constraint_name LIKE '%event_type%'
          `);
          if (constraintCheck.rows.length > 0) {
            const constraintName = constraintCheck.rows[0].constraint_name;
            await client.query(`ALTER TABLE email_events DROP CONSTRAINT ${constraintName}`);
            await client.query(`
              ALTER TABLE email_events 
              ADD CONSTRAINT email_events_event_type_check 
              CHECK(event_type IN ('received', 'read', 'unread', 'deleted', 'restored', 'marked_important', 'marked_spam', 'marked_completed', 'marked_uncompleted', 'theme_assigned', 'urgency_set', 'department_assigned', 'department_removed', 'forwarded', 'automation_triggered', 'automation_applied', 'automation_rule_activated', 'automation_rule_deactivated', 'ticket_assigned', 'ticket_reused', 'ticket_changed', 'conversation_created'));
            `);
            console.log(`✅ email_events CHECK-Constraint aktualisiert (${constraintName})`);
          }
        } else {
          console.error(`⚠️ Fehler beim Aktualisieren des email_events CHECK-Constraints:`, err);
        }
      }
    }

    // Prüfe, ob email_notes-Tabelle existiert
    const emailNotesTableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'email_notes'
      );
    `);

    if (!emailNotesTableCheck.rows[0].exists) {
      console.log(`📝 Erstelle email_notes-Tabelle für Company ${companyId}`);
      await client.query(`
        CREATE TABLE email_notes (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          email_id UUID NOT NULL,
          user_id UUID NOT NULL,
          content VARCHAR(2000) NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
          FOREIGN KEY (email_id) REFERENCES emails(id) ON DELETE CASCADE,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
        CREATE INDEX idx_email_notes_email_created ON email_notes(email_id, created_at DESC);
      `);
      console.log(`✅ email_notes-Tabelle erfolgreich erstellt`);
    } else {
      console.log(`✅ email_notes-Tabelle existiert bereits`);
    }

    // Prüfe, ob automation_rule_status_history-Tabelle existiert
    const automationRuleStatusHistoryTableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'automation_rule_status_history'
      );
    `);

    if (!automationRuleStatusHistoryTableCheck.rows[0].exists) {
      console.log(`📝 Erstelle automation_rule_status_history-Tabelle für Company ${companyId}`);
      await client.query(`
        CREATE TABLE automation_rule_status_history (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          rule_id UUID NOT NULL,
          user_id UUID NOT NULL,
          is_active BOOLEAN NOT NULL,
          changed_at TIMESTAMP DEFAULT NOW() NOT NULL,
          changed_by UUID NOT NULL,
          FOREIGN KEY (rule_id) REFERENCES automation_rules(id) ON DELETE CASCADE,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (changed_by) REFERENCES users(id) ON DELETE SET NULL
        );
        CREATE INDEX idx_automation_rule_status_history_rule_changed ON automation_rule_status_history(rule_id, changed_at DESC);
        CREATE INDEX idx_automation_rule_status_history_user_changed ON automation_rule_status_history(user_id, changed_at DESC);
        CREATE INDEX idx_automation_rule_status_history_changed ON automation_rule_status_history(changed_at DESC);
      `);
      console.log(`✅ automation_rule_status_history-Tabelle erfolgreich erstellt`);
    } else {
      console.log(`✅ automation_rule_status_history-Tabelle existiert bereits`);
    }

    // Prüfe, ob departments-Tabelle existiert
    const departmentsTableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'departments'
      );
    `);

    if (!departmentsTableCheck.rows[0].exists) {
      console.log(`📝 Erstelle departments-Tabelle für Company ${companyId}`);
      await client.query(`
        CREATE TABLE departments (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          company_id UUID NOT NULL,
          name VARCHAR(255) NOT NULL,
          description TEXT,
          manager_id UUID,
          is_active BOOLEAN DEFAULT false,
          email_account_id UUID,
          signature TEXT,
          signature_plain TEXT,
          signature_enabled BOOLEAN DEFAULT false,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW(),
          FOREIGN KEY (manager_id) REFERENCES users(id) ON DELETE SET NULL,
          FOREIGN KEY (email_account_id) REFERENCES email_accounts(id) ON DELETE SET NULL,
          UNIQUE(company_id, name)
        );
        CREATE INDEX idx_departments_company ON departments(company_id);
        CREATE INDEX idx_departments_manager ON departments(manager_id);
        CREATE INDEX idx_departments_active_company ON departments(is_active, company_id);
      `);
      console.log(`✅ departments-Tabelle erfolgreich erstellt`);
    } else {
      console.log(`✅ departments-Tabelle existiert bereits`);
      
      // Prüfe, ob is_active Spalte existiert
      const isActiveCheck = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_schema = 'public' 
          AND table_name = 'departments' 
          AND column_name = 'is_active'
        );
      `);
      
      if (!isActiveCheck.rows[0].exists) {
        console.log(`📝 Füge is_active-Spalte zur departments-Tabelle hinzu für Company ${companyId}`);
        await client.query(`
          ALTER TABLE departments ADD COLUMN is_active BOOLEAN DEFAULT false;
        `);
        // Migration: Alle bestehenden Abteilungen auf inaktiv setzen
        await client.query(`
          UPDATE departments SET is_active = false WHERE is_active IS NULL;
        `);
        console.log(`✅ is_active-Spalte hinzugefügt und bestehende Abteilungen auf inaktiv gesetzt`);
      }
      
      // Prüfe, ob email_account_id Spalte existiert
      const emailAccountIdCheck = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_schema = 'public' 
          AND table_name = 'departments' 
          AND column_name = 'email_account_id'
        );
      `);
      
      if (!emailAccountIdCheck.rows[0].exists) {
        console.log(`📝 Füge email_account_id-Spalte zur departments-Tabelle hinzu für Company ${companyId}`);
        await client.query(`
          ALTER TABLE departments ADD COLUMN email_account_id UUID;
        `);
        
        // Prüfe, ob email_accounts Tabelle existiert, bevor Foreign Key erstellt wird
        const emailAccountsTableCheck = await client.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'email_accounts'
          );
        `);
        
        if (emailAccountsTableCheck.rows[0].exists) {
          // Foreign Key Constraint hinzufügen
          await client.query(`
            ALTER TABLE departments 
            ADD CONSTRAINT fk_departments_email_account 
            FOREIGN KEY (email_account_id) REFERENCES email_accounts(id) ON DELETE SET NULL;
          `);
          
          // UNIQUE Constraint hinzufügen: Ein E-Mail-Konto kann nur einer Abteilung zugeordnet werden
          // Prüfe, ob Constraint bereits existiert
          const uniqueConstraintCheck = await client.query(`
            SELECT EXISTS (
              SELECT FROM pg_constraint 
              WHERE conname = 'unique_departments_email_account'
            );
          `);
          
          if (!uniqueConstraintCheck.rows[0].exists) {
            await client.query(`
              ALTER TABLE departments 
              ADD CONSTRAINT unique_departments_email_account 
              UNIQUE (email_account_id);
            `);
            console.log(`✅ UNIQUE Constraint für email_account_id hinzugefügt`);
          }
        }
        console.log(`✅ email_account_id-Spalte hinzugefügt`);
      }

      // Prüfe, ob signature Spalte existiert
      const signatureCheck = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_schema = 'public' 
          AND table_name = 'departments' 
          AND column_name = 'signature'
        );
      `);
      if (!signatureCheck.rows[0].exists) {
        console.log(`📝 Füge signature-Spalte zur departments-Tabelle hinzu für Company ${companyId}`);
        await client.query(`ALTER TABLE departments ADD COLUMN signature TEXT;`);
        console.log(`✅ signature-Spalte hinzugefügt`);
      }

      // Prüfe, ob signature_enabled Spalte existiert
      const signatureEnabledCheck = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_schema = 'public' 
          AND table_name = 'departments' 
          AND column_name = 'signature_enabled'
        );
      `);
      if (!signatureEnabledCheck.rows[0].exists) {
        console.log(`📝 Füge signature_enabled-Spalte zur departments-Tabelle hinzu für Company ${companyId}`);
        await client.query(`ALTER TABLE departments ADD COLUMN signature_enabled BOOLEAN DEFAULT false;`);
        console.log(`✅ signature_enabled-Spalte hinzugefügt`);
      }

      // Prüfe, ob signature_plain Spalte existiert (Plain-Text-Signatur)
      const signaturePlainCheck = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_schema = 'public' 
          AND table_name = 'departments' 
          AND column_name = 'signature_plain'
        );
      `);
      if (!signaturePlainCheck.rows[0].exists) {
        console.log(`📝 Füge signature_plain-Spalte zur departments-Tabelle hinzu für Company ${companyId}`);
        await client.query(`ALTER TABLE departments ADD COLUMN signature_plain TEXT;`);
        console.log(`✅ signature_plain-Spalte hinzugefügt`);
      }
      
      // Prüfe, ob Index für is_active existiert
      const indexCheck = await client.query(`
        SELECT EXISTS (
          SELECT FROM pg_indexes 
          WHERE schemaname = 'public' 
          AND tablename = 'departments' 
          AND indexname = 'idx_departments_active_company'
        );
      `);
      
      if (!indexCheck.rows[0].exists) {
        console.log(`📝 Erstelle Index idx_departments_active_company für Company ${companyId}`);
        await client.query(`
          CREATE INDEX idx_departments_active_company ON departments(is_active, company_id);
        `);
        console.log(`✅ Index idx_departments_active_company erstellt`);
      }
      
      // Trigger: Wenn email_account_id auf NULL gesetzt wird, automatisch is_active = false setzen
      const triggerCheck = await client.query(`
        SELECT EXISTS (
          SELECT FROM pg_trigger 
          WHERE tgname = 'departments_set_inactive_on_null_email_account'
        );
      `);
      
      if (!triggerCheck.rows[0].exists) {
        console.log(`📝 Erstelle Trigger für automatische Deaktivierung bei NULL email_account_id für Company ${companyId}`);
        await client.query(`
          CREATE OR REPLACE FUNCTION set_department_inactive_on_null_email_account()
          RETURNS TRIGGER AS $$
          BEGIN
            IF NEW.email_account_id IS NULL THEN
              NEW.is_active = false;
            END IF;
            RETURN NEW;
          END;
          $$ LANGUAGE plpgsql;
          
          CREATE TRIGGER departments_set_inactive_on_null_email_account
          BEFORE UPDATE ON departments
          FOR EACH ROW
          WHEN (NEW.email_account_id IS NULL AND OLD.email_account_id IS NOT NULL)
          EXECUTE FUNCTION set_department_inactive_on_null_email_account();
        `);
        console.log(`✅ Trigger für automatische Deaktivierung erstellt`);
      }
    }

    // Prüfe, ob user_departments Junction-Tabelle existiert
    const userDepartmentsTableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'user_departments'
      );
    `);

    if (!userDepartmentsTableCheck.rows[0].exists) {
      console.log(`📝 Erstelle user_departments-Tabelle für Company ${companyId}`);
      await client.query(`
        CREATE TABLE user_departments (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL,
          department_id UUID NOT NULL,
          created_at TIMESTAMP DEFAULT NOW(),
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE,
          UNIQUE(user_id, department_id)
        );
        CREATE INDEX idx_user_departments_user ON user_departments(user_id);
        CREATE INDEX idx_user_departments_department ON user_departments(department_id);
      `);
      console.log(`✅ user_departments-Tabelle erfolgreich erstellt`);
    } else {
      console.log(`✅ user_departments-Tabelle existiert bereits`);
    }

    // Prüfe, ob email_departments Junction-Tabelle existiert
    const emailDepartmentsTableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'email_departments'
      );
    `);

    if (!emailDepartmentsTableCheck.rows[0].exists) {
      console.log(`📝 Erstelle email_departments-Tabelle für Company ${companyId}`);
      await client.query(`
        CREATE TABLE email_departments (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          email_id UUID NOT NULL,
          department_id UUID NOT NULL,
          created_at TIMESTAMP DEFAULT NOW(),
          FOREIGN KEY (email_id) REFERENCES emails(id) ON DELETE CASCADE,
          FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE,
          UNIQUE(email_id, department_id)
        );
        CREATE INDEX idx_email_departments_email ON email_departments(email_id);
        CREATE INDEX idx_email_departments_department ON email_departments(department_id);
      `);
      console.log(`✅ email_departments-Tabelle erfolgreich erstellt`);
    } else {
      console.log(`✅ email_departments-Tabelle existiert bereits`);
    }

    // Prüfe, ob automation_rule_departments Junction-Tabelle existiert
    const automationRuleDepartmentsTableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'automation_rule_departments'
      );
    `);

    if (!automationRuleDepartmentsTableCheck.rows[0].exists) {
      console.log(`📝 Erstelle automation_rule_departments-Tabelle für Company ${companyId}`);
      await client.query(`
        CREATE TABLE automation_rule_departments (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          automation_rule_id UUID NOT NULL,
          department_id UUID NOT NULL,
          created_at TIMESTAMP DEFAULT NOW(),
          FOREIGN KEY (automation_rule_id) REFERENCES automation_rules(id) ON DELETE CASCADE,
          FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE,
          UNIQUE(automation_rule_id, department_id)
        );
        CREATE INDEX idx_automation_rule_departments_rule ON automation_rule_departments(automation_rule_id);
        CREATE INDEX idx_automation_rule_departments_department ON automation_rule_departments(department_id);
      `);
      console.log(`✅ automation_rule_departments-Tabelle erfolgreich erstellt`);
    } else {
      console.log(`✅ automation_rule_departments-Tabelle existiert bereits`);
    }

    // ============================================
    // EMAIL TICKET COUNTERS TABELLE
    // ============================================
    
    // Prüfe, ob email_ticket_counters-Tabelle existiert
    const emailTicketCountersTableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'email_ticket_counters'
      );
    `);

    if (!emailTicketCountersTableCheck.rows[0].exists) {
      console.log(`📝 Erstelle email_ticket_counters-Tabelle für Company ${companyId}`);
      await client.query(`
        CREATE TABLE email_ticket_counters (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          company_id UUID NOT NULL,
          date DATE NOT NULL,
          counter INTEGER DEFAULT 0 NOT NULL,
          created_at TIMESTAMP DEFAULT NOW() NOT NULL,
          updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
          UNIQUE(company_id, date),
          CHECK(counter >= 0 AND counter <= 99999)
        );
        CREATE INDEX idx_email_ticket_counters_company_date 
        ON email_ticket_counters(company_id, date DESC);
      `);
      console.log(`✅ email_ticket_counters-Tabelle erfolgreich erstellt`);
    } else {
      console.log(`✅ email_ticket_counters-Tabelle existiert bereits`);
    }

    // Kontakt-Tabellen (contacts, contact_phones, contact_emails, contact_addresses)
    const contactsTableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'contacts'
      );
    `);

    if (!contactsTableCheck.rows[0].exists) {
      console.log(`📝 Erstelle contacts-Tabelle für Company ${companyId}`);
      await client.query(`
        CREATE TABLE contacts (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          company_id UUID NOT NULL,
          first_name VARCHAR(255),
          last_name VARCHAR(255),
          company_name VARCHAR(255),
          salutation VARCHAR(10) DEFAULT 'sie' CHECK (salutation IN ('du', 'sie')),
          formal_title VARCHAR(50),
          notes TEXT,
          birthday DATE,
          avatar_url TEXT,
          customer_number VARCHAR(100),
          tags JSONB DEFAULT '[]'::jsonb,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        );
        CREATE INDEX idx_contacts_company ON contacts(company_id);
      `);
      console.log(`✅ contacts-Tabelle erfolgreich erstellt`);
    } else {
      console.log(`✅ contacts-Tabelle existiert bereits`);
    }

    const contactPhonesTableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'contact_phones'
      );
    `);

    if (!contactPhonesTableCheck.rows[0].exists) {
      console.log(`📝 Erstelle contact_phones-Tabelle für Company ${companyId}`);
      await client.query(`
        CREATE TABLE contact_phones (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
          label VARCHAR(100),
          number VARCHAR(100) NOT NULL,
          sort_order INTEGER DEFAULT 0
        );
        CREATE INDEX idx_contact_phones_contact ON contact_phones(contact_id);
      `);
      console.log(`✅ contact_phones-Tabelle erfolgreich erstellt`);
    } else {
      console.log(`✅ contact_phones-Tabelle existiert bereits`);
    }

    const contactEmailsTableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'contact_emails'
      );
    `);

    if (!contactEmailsTableCheck.rows[0].exists) {
      console.log(`📝 Erstelle contact_emails-Tabelle für Company ${companyId}`);
      await client.query(`
        CREATE TABLE contact_emails (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
          label VARCHAR(100),
          email VARCHAR(255) NOT NULL,
          sort_order INTEGER DEFAULT 0
        );
        CREATE INDEX idx_contact_emails_contact ON contact_emails(contact_id);
      `);
      console.log(`✅ contact_emails-Tabelle erfolgreich erstellt`);
    } else {
      console.log(`✅ contact_emails-Tabelle existiert bereits`);
    }

    const contactAddressesTableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'contact_addresses'
      );
    `);

    if (!contactAddressesTableCheck.rows[0].exists) {
      console.log(`📝 Erstelle contact_addresses-Tabelle für Company ${companyId}`);
      await client.query(`
        CREATE TABLE contact_addresses (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
          label VARCHAR(100),
          street VARCHAR(255),
          postal_code VARCHAR(20),
          city VARCHAR(255),
          country VARCHAR(100),
          sort_order INTEGER DEFAULT 0
        );
        CREATE INDEX idx_contact_addresses_contact ON contact_addresses(contact_id);
      `);
      console.log(`✅ contact_addresses-Tabelle erfolgreich erstellt`);
    } else {
      console.log(`✅ contact_addresses-Tabelle existiert bereits`);
    }
  } catch (error: any) {
    console.error(`❌ Fehler in ensureUsersTableSchema für Company ${companyId}:`, error);
    throw error;
  }
}

/**
 * Stellt sicher, dass die company_config-Tabelle existiert
 * Single-Row-Tabelle für Company-spezifische Konfigurationen (API-Keys, etc.)
 */
export async function ensureCompanyConfigTableSchema(client: PoolClient, companyId: string): Promise<void> {
  try {
    // Prüfe, ob company_config-Tabelle existiert
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'company_config'
      );
    `);

    if (!tableCheck.rows[0].exists) {
      console.log(`📝 Erstelle company_config-Tabelle für Company ${companyId}`);
      // Tabelle erstellen
      await client.query(`
        CREATE TABLE company_config (
          id VARCHAR(255) PRIMARY KEY DEFAULT 'company_config',
          openai_api_key TEXT,
          openai_model VARCHAR(100) DEFAULT 'gpt-4o-mini',
          elevenlabs_api_key TEXT,
          elevenlabs_voice_id VARCHAR(100),
          elevenlabs_enabled BOOLEAN DEFAULT false,
          theme_required BOOLEAN DEFAULT false,
          permanent_delete_after_days INTEGER DEFAULT 0,
          email_filters JSONB DEFAULT '[]'::jsonb,
          ai_provider VARCHAR(50) DEFAULT 'openai',
          gemini_api_key TEXT,
          gemini_model VARCHAR(100) DEFAULT 'gemini-2.0-flash',
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW(),
          CONSTRAINT company_config_single_row CHECK (id = 'company_config'),
          CONSTRAINT company_config_id_unique UNIQUE (id)
        );
      `);
      console.log(`✅ company_config-Tabelle erfolgreich erstellt`);
    } else {
      // Prüfe, ob alle Spalten existieren
      const columnsCheck = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'company_config';
      `);
      
      const existingColumns = columnsCheck.rows.map((row) => row.column_name);
      
      // Füge fehlende Spalten hinzu
      if (!existingColumns.includes('openai_api_key')) {
        console.log(`📝 Füge openai_api_key-Spalte hinzu`);
        await client.query(`ALTER TABLE company_config ADD COLUMN openai_api_key TEXT;`);
      }
      
      if (!existingColumns.includes('openai_model')) {
        console.log(`📝 Füge openai_model-Spalte hinzu`);
        await client.query(`ALTER TABLE company_config ADD COLUMN openai_model VARCHAR(100) DEFAULT 'gpt-4o-mini';`);
      }
      
      if (!existingColumns.includes('elevenlabs_api_key')) {
        console.log(`📝 Füge elevenlabs_api_key-Spalte hinzu`);
        await client.query(`ALTER TABLE company_config ADD COLUMN elevenlabs_api_key TEXT;`);
      }
      
      if (!existingColumns.includes('elevenlabs_voice_id')) {
        console.log(`📝 Füge elevenlabs_voice_id-Spalte hinzu`);
        await client.query(`ALTER TABLE company_config ADD COLUMN elevenlabs_voice_id VARCHAR(100);`);
      }
      
      if (!existingColumns.includes('elevenlabs_enabled')) {
        console.log(`📝 Füge elevenlabs_enabled-Spalte hinzu`);
        await client.query(`ALTER TABLE company_config ADD COLUMN elevenlabs_enabled BOOLEAN DEFAULT false;`);
      }
      
      if (!existingColumns.includes('theme_required')) {
        console.log(`📝 Füge theme_required-Spalte hinzu`);
        await client.query(`ALTER TABLE company_config ADD COLUMN theme_required BOOLEAN DEFAULT false;`);
      }
      
      if (!existingColumns.includes('permanent_delete_after_days')) {
        console.log(`📝 Füge permanent_delete_after_days-Spalte hinzu`);
        await client.query(`ALTER TABLE company_config ADD COLUMN permanent_delete_after_days INTEGER DEFAULT 0;`);
      }
      
      if (!existingColumns.includes('email_filters')) {
        console.log(`📝 Füge email_filters-Spalte hinzu`);
        await client.query(`ALTER TABLE company_config ADD COLUMN email_filters JSONB DEFAULT '[]'::jsonb;`);
      }
      
      if (!existingColumns.includes('created_at')) {
        console.log(`📝 Füge created_at-Spalte hinzu`);
        await client.query(`ALTER TABLE company_config ADD COLUMN created_at TIMESTAMP DEFAULT NOW();`);
      }
      
      if (!existingColumns.includes('updated_at')) {
        console.log(`📝 Füge updated_at-Spalte hinzu`);
        await client.query(`ALTER TABLE company_config ADD COLUMN updated_at TIMESTAMP DEFAULT NOW();`);
      }
      
      if (!existingColumns.includes('ai_provider')) {
        console.log(`📝 Füge ai_provider-Spalte hinzu`);
        await client.query(`ALTER TABLE company_config ADD COLUMN ai_provider VARCHAR(50) DEFAULT 'openai';`);
      }
      
      if (!existingColumns.includes('gemini_api_key')) {
        console.log(`📝 Füge gemini_api_key-Spalte hinzu`);
        await client.query(`ALTER TABLE company_config ADD COLUMN gemini_api_key TEXT;`);
      }
      
      if (!existingColumns.includes('gemini_model')) {
        console.log(`📝 Füge gemini_model-Spalte hinzu`);
        await client.query(`ALTER TABLE company_config ADD COLUMN gemini_model VARCHAR(100) DEFAULT 'gemini-2.0-flash';`);
      }
      
      console.log(`✅ company_config-Tabelle existiert bereits`);
    }
  } catch (error: any) {
    console.error(`❌ Fehler in ensureCompanyConfigTableSchema für Company ${companyId}:`, error);
    throw error;
  }
}

/** Ablaufzeit für Reply-Lock ohne Heartbeat (Sekunden) – danach gilt der Lock als verfallen */
export const EMAIL_REPLY_LOCK_TTL_SECONDS = 300; // 5 Minuten

/**
 * Stellt sicher, dass die email_reply_locks-Tabelle existiert.
 * Eine Zeile pro E-Mail: Welcher User die E-Mail aktuell zum Antworten geöffnet hat.
 */
export async function ensureEmailReplyLocksTableSchema(client: PoolClient, companyId: string): Promise<void> {
  try {
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'email_reply_locks'
      );
    `);

    if (!tableCheck.rows[0].exists) {
      console.log(`📝 Erstelle email_reply_locks-Tabelle für Company ${companyId}`);
      await client.query(`
        CREATE TABLE email_reply_locks (
          email_id UUID PRIMARY KEY REFERENCES emails(id) ON DELETE CASCADE,
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          user_name VARCHAR(255),
          locked_at TIMESTAMP DEFAULT NOW(),
          heartbeat_at TIMESTAMP DEFAULT NOW()
        );
        CREATE INDEX idx_email_reply_locks_heartbeat ON email_reply_locks(heartbeat_at);
      `);
      console.log(`✅ email_reply_locks-Tabelle erfolgreich erstellt`);
    } else {
      const colResult = await client.query(`
        SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'email_reply_locks';
      `);
      const cols = new Set((colResult.rows as { column_name: string }[]).map((r) => r.column_name));
      if (!cols.has('user_name')) {
        console.log(`📝 Füge Spalte user_name zu email_reply_locks hinzu für Company ${companyId}`);
        await client.query(`ALTER TABLE email_reply_locks ADD COLUMN user_name VARCHAR(255);`);
      }
      if (!cols.has('locked_at')) {
        console.log(`📝 Füge Spalte locked_at zu email_reply_locks hinzu für Company ${companyId}`);
        await client.query(`ALTER TABLE email_reply_locks ADD COLUMN locked_at TIMESTAMP DEFAULT NOW();`);
      }
      if (!cols.has('heartbeat_at')) {
        console.log(`📝 Füge Spalte heartbeat_at zu email_reply_locks hinzu für Company ${companyId}`);
        await client.query(`ALTER TABLE email_reply_locks ADD COLUMN heartbeat_at TIMESTAMP DEFAULT NOW();`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_email_reply_locks_heartbeat ON email_reply_locks(heartbeat_at);`);
      }
      console.log(`✅ email_reply_locks-Tabelle existiert bereits`);
    }
  } catch (error: any) {
    console.error(`❌ Fehler in ensureEmailReplyLocksTableSchema für Company ${companyId}:`, error);
    throw error;
  }
}