// check-ticket-ids.mjs
// Prüft ob Ticket-IDs in der Datenbank existieren

import pg from 'pg';
const { Pool } = pg;

// Datenbank-Konfiguration für testfirma2
const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'testfirma2_db',
  user: 'testfirma2_user',
  password: 'testfirma2_pass',
});

async function checkTicketIds() {
  const client = await pool.connect();
  
  try {
    console.log('🔍 Prüfe Ticket-IDs in der Datenbank...\n');
    
    // 1. Prüfe ob ticket_id Spalte existiert
    const columnCheck = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'emails' AND column_name = 'ticket_id'
    `);
    
    if (columnCheck.rows.length === 0) {
      console.log('❌ FEHLER: ticket_id Spalte existiert nicht!');
      console.log('   Migration wurde nicht ausgeführt oder fehlgeschlagen.');
      return;
    }
    
    console.log('✅ ticket_id Spalte existiert');
    console.log(`   Typ: ${columnCheck.rows[0].data_type}\n`);
    
    // 2. Zähle E-Mails gesamt
    const totalEmails = await client.query(`
      SELECT COUNT(*) as total FROM emails
    `);
    console.log(`📧 Gesamt E-Mails: ${totalEmails.rows[0].total}`);
    
    // 3. Zähle E-Mails mit Ticket-ID
    const emailsWithTicketId = await client.query(`
      SELECT COUNT(*) as total FROM emails WHERE ticket_id IS NOT NULL
    `);
    console.log(`🎫 E-Mails mit Ticket-ID: ${emailsWithTicketId.rows[0].total}`);
    
    // 4. Zähle E-Mails ohne Ticket-ID
    const emailsWithoutTicketId = await client.query(`
      SELECT COUNT(*) as total FROM emails WHERE ticket_id IS NULL
    `);
    console.log(`❌ E-Mails ohne Ticket-ID: ${emailsWithoutTicketId.rows[0].total}\n`);
    
    // 5. Zeige erste 5 E-Mails mit Ticket-ID
    const sampleEmails = await client.query(`
      SELECT id, subject, ticket_id, created_at, is_conversation_thread, conversation_message_count
      FROM emails 
      WHERE ticket_id IS NOT NULL
      ORDER BY created_at DESC
      LIMIT 5
    `);
    
    if (sampleEmails.rows.length > 0) {
      console.log('📋 Beispiel E-Mails mit Ticket-ID:\n');
      sampleEmails.rows.forEach((row, i) => {
        console.log(`${i + 1}. ${row.subject}`);
        console.log(`   Ticket-ID: ${row.ticket_id}`);
        console.log(`   Konversation: ${row.is_conversation_thread ? 'Ja' : 'Nein'}`);
        console.log(`   Nachrichten: ${row.conversation_message_count || 0}`);
        console.log(`   Erstellt: ${row.created_at}`);
        console.log('');
      });
    } else {
      console.log('⚠️  KEINE E-Mails mit Ticket-ID gefunden!');
      console.log('   Migration muss ausgeführt werden.\n');
      
      // Zeige erste 5 E-Mails ohne Ticket-ID
      const emailsNeedingMigration = await client.query(`
        SELECT id, subject, created_at
        FROM emails 
        ORDER BY created_at DESC
        LIMIT 5
      `);
      
      if (emailsNeedingMigration.rows.length > 0) {
        console.log('📋 E-Mails die eine Ticket-ID benötigen:\n');
        emailsNeedingMigration.rows.forEach((row, i) => {
          console.log(`${i + 1}. ${row.subject}`);
          console.log(`   ID: ${row.id}`);
          console.log(`   Erstellt: ${row.created_at}`);
          console.log('');
        });
      }
    }
    
    // 6. Prüfe Counter-Tabelle
    const counterCheck = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name = 'email_ticket_counters'
    `);
    
    if (counterCheck.rows.length > 0) {
      console.log('✅ email_ticket_counters Tabelle existiert');
      
      const counters = await client.query(`
        SELECT * FROM email_ticket_counters ORDER BY counter_date DESC LIMIT 5
      `);
      
      if (counters.rows.length > 0) {
        console.log('📊 Letzte Counter-Einträge:\n');
        counters.rows.forEach((row, i) => {
          console.log(`${i + 1}. Datum: ${row.counter_date}, Counter: ${row.counter}`);
        });
      } else {
        console.log('⚠️  Keine Counter-Einträge gefunden (noch keine Ticket-IDs generiert)\n');
      }
    } else {
      console.log('❌ email_ticket_counters Tabelle existiert nicht!\n');
    }
    
    // 7. Zusammenfassung
    console.log('\n================================================================');
    console.log('📊 ZUSAMMENFASSUNG');
    console.log('================================================================');
    
    const hasTicketIds = parseInt(emailsWithTicketId.rows[0].total) > 0;
    const needsMigration = parseInt(emailsWithoutTicketId.rows[0].total) > 0;
    
    if (hasTicketIds && !needsMigration) {
      console.log('✅ ALLES OK: Alle E-Mails haben Ticket-IDs');
    } else if (hasTicketIds && needsMigration) {
      console.log(`⚠️  TEILWEISE MIGRIERT: ${emailsWithTicketId.rows[0].total} von ${totalEmails.rows[0].total} E-Mails haben Ticket-IDs`);
      console.log('   Führen Sie die Migration erneut aus.');
    } else {
      console.log('❌ MIGRATION ERFORDERLICH: Keine E-Mails haben Ticket-IDs');
      console.log('   Bitte öffnen Sie: http://testfirma2.localhost:3000/admin-migration.html');
    }
    
    console.log('================================================================\n');
    
  } catch (error) {
    console.error('❌ Fehler:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

checkTicketIds();
