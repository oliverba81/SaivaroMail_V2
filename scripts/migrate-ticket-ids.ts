/**
 * Script zum Starten der Ticket-ID Migration
 * 
 * Verwendung:
 * npx ts-node scripts/migrate-ticket-ids.ts [--dry-run]
 */

import { getTenantDbClient } from '../apps/mailclient/src/lib/tenant-db-client';
import { migrateTicketIdsForCompany } from '../apps/mailclient/src/lib/migrate-ticket-ids';

// Parse command line arguments
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');

async function runMigration() {
  console.log('🚀 Ticket-ID Migration gestartet...');
  console.log(`Mode: ${dryRun ? 'DRY RUN (keine Änderungen)' : 'PRODUCTION (schreibt in DB)'}`);
  console.log('─'.repeat(80));

  // Lade alle Companies aus der Datenbank
  const client = await getTenantDbClient('00000000-0000-0000-0000-000000000000'); // Master DB
  
  try {
    // Hole alle Companies
    const companiesResult = await client.query(
      'SELECT id, name FROM companies ORDER BY created_at ASC'
    );
    
    const companies = companiesResult.rows;
    
    if (companies.length === 0) {
      console.log('⚠️  Keine Companies gefunden!');
      return;
    }

    console.log(`\n📊 ${companies.length} Company/Companies gefunden:\n`);
    
    for (const company of companies) {
      console.log(`\n${'='.repeat(80)}`);
      console.log(`🏢 Company: ${company.name} (${company.id})`);
      console.log('='.repeat(80));
      
      try {
        const result = await migrateTicketIdsForCompany(company.id, {
          dryRun,
          batchSize: 100,
          onProgress: (progress) => {
            const percent = Math.round((progress.processedEmails / progress.totalEmails) * 100);
            const bar = '█'.repeat(Math.floor(percent / 2)) + '░'.repeat(50 - Math.floor(percent / 2));
            
            process.stdout.write(
              `\r[${bar}] ${percent}% | ` +
              `${progress.processedEmails}/${progress.totalEmails} E-Mails | ` +
              `Assigned: ${progress.assignedIds} | ` +
              `Reused: ${progress.reusedIds} | ` +
              `Errors: ${progress.errors}`
            );
          },
        });

        console.log('\n\n✅ Migration abgeschlossen für ' + company.name);
        console.log('\n📈 Statistik:');
        console.log(`   Gesamt verarbeitet: ${result.totalProcessed}`);
        console.log(`   Neue IDs vergeben: ${result.assignedIds}`);
        console.log(`   IDs wiederverwendet: ${result.reusedIds}`);
        console.log(`   Fehler: ${result.errors}`);
        
        if (result.errorDetails.length > 0) {
          console.log('\n❌ Fehlerdetails:');
          result.errorDetails.forEach((error, index) => {
            console.log(`   ${index + 1}. E-Mail ${error.emailId}: ${error.error}`);
          });
        }
        
        if (dryRun) {
          console.log('\n⚠️  DRY RUN: Keine Änderungen wurden vorgenommen!');
        }
      } catch (error: any) {
        console.error(`\n❌ Fehler bei Migration für ${company.name}:`, error.message);
        console.error(error.stack);
      }
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('🎉 Migration für alle Companies abgeschlossen!');
    console.log('='.repeat(80));
    
  } finally {
    client.release();
  }
}

// Run migration
runMigration()
  .then(() => {
    console.log('\n✅ Script erfolgreich beendet');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Fataler Fehler:', error);
    process.exit(1);
  });
