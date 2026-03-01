/**
 * Script zum Starten der Ticket-ID Migration
 * 
 * Verwendung:
 * node scripts/migrate-ticket-ids.mjs [--dry-run]
 */

console.log('🚀 Ticket-ID Migration gestartet...');
console.log('');
console.log('⚠️  HINWEIS: Dieses Script erfordert, dass der Mail-Server läuft!');
console.log('');
console.log('📝 Starte Migration über API...');
console.log('─'.repeat(80));

// Parse command line arguments
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');

const API_URL = 'http://testfirma2.localhost:3000';
const ADMIN_CREDENTIALS = {
  email: 'admin',
  password: 'f9k^Sy8yQGfo'
};

async function loginAsAdmin() {
  console.log('\n🔐 Login als Admin...');
  
  const response = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(ADMIN_CREDENTIALS),
  });

  if (!response.ok) {
    throw new Error(`Login fehlgeschlagen: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  console.log(`✅ Login erfolgreich! User: ${data.user?.email || 'admin'}`);
  return data.token;
}

async function getCompanies(token) {
  console.log('\n📊 Lade Companies...');
  
  // Da wir keine direkte API für Companies haben, verwenden wir den Token,
  // um die Company-ID zu extrahieren
  const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
  return [{ id: payload.companyId, name: 'Current Company' }];
}

async function runMigration(token, companyId, dryRun) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`🏢 Company: ${companyId}`);
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'PRODUCTION'}`);
  console.log('='.repeat(80));

  const url = `${API_URL}/api/admin/migrate-ticket-ids?companyId=${companyId}&stream=true${dryRun ? '&dryRun=true' : ''}`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`Migration API Fehler: ${errorData.error || response.statusText}`);
  }

  // Parse SSE Stream
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    
    if (done) break;
    
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = JSON.parse(line.slice(6));
        
        if (data.type === 'start') {
          console.log(`\n🚀 Migration gestartet für Company ${data.companyId}`);
        } else if (data.type === 'progress') {
          const p = data.progress;
          const percent = Math.round((p.processedEmails / p.totalEmails) * 100);
          const bar = '█'.repeat(Math.floor(percent / 2)) + '░'.repeat(50 - Math.floor(percent / 2));
          
          process.stdout.write(
            `\r[${bar}] ${percent}% | ` +
            `${p.processedEmails}/${p.totalEmails} E-Mails | ` +
            `Assigned: ${p.assignedIds} | ` +
            `Reused: ${p.reusedIds} | ` +
            `Errors: ${p.errors}`
          );
        } else if (data.type === 'complete') {
          const r = data.result;
          console.log('\n\n✅ Migration abgeschlossen!');
          console.log('\n📈 Statistik:');
          console.log(`   Gesamt verarbeitet: ${r.totalProcessed}`);
          console.log(`   Neue IDs vergeben: ${r.assignedIds}`);
          console.log(`   IDs wiederverwendet: ${r.reusedIds}`);
          console.log(`   Fehler: ${r.errors}`);
          
          if (r.errorDetails && r.errorDetails.length > 0) {
            console.log('\n❌ Fehlerdetails:');
            r.errorDetails.forEach((error, index) => {
              console.log(`   ${index + 1}. E-Mail ${error.emailId}: ${error.error}`);
            });
          }
          
          if (dryRun) {
            console.log('\n⚠️  DRY RUN: Keine Änderungen wurden vorgenommen!');
          }
        } else if (data.type === 'error') {
          console.error(`\n❌ Fehler: ${data.error}`);
        }
      }
    }
  }
}

async function main() {
  try {
    // Login
    const token = await loginAsAdmin();
    
    // Get companies
    const companies = await getCompanies(token);
    
    // Run migration for each company
    for (const company of companies) {
      await runMigration(token, company.id, dryRun);
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('🎉 Migration für alle Companies abgeschlossen!');
    console.log('='.repeat(80));
    
  } catch (error) {
    console.error('\n❌ Fehler:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run
main().then(() => {
  console.log('\n✅ Script erfolgreich beendet');
  process.exit(0);
});
