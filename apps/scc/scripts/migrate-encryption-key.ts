import { PrismaClient } from '@prisma/client';
import * as crypto from 'crypto';

const prisma = new PrismaClient();

// Verschlüsselungsparameter (müssen mit EncryptionService übereinstimmen)
const algorithm = 'aes-256-gcm';
const keyLength = 32; // 256 bits
const ivLength = 16; // 128 bits
const saltLength = 64;
const tagLength = 16;

// Alte und neue Keys
const OLD_KEY = 'dev-encryption-key-change-in-production-min-32-chars';
const NEW_KEY = process.env.ENCRYPTION_KEY || '711ec4bc9d0d53aac48647f4d4620a9d8455c352672f836039befbe251e8d43d';

/**
 * Entschlüsselt einen Text mit einem bestimmten Key
 */
function decryptWithKey(encryptedText: string, encryptionKey: string): string {
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
    keyLength,
    'sha256',
  );

  const decipher = crypto.createDecipheriv(algorithm, key, iv);
  decipher.setAuthTag(tag);

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Verschlüsselt einen Text mit einem bestimmten Key
 */
function encryptWithKey(plaintext: string, encryptionKey: string): string {
  const salt = crypto.randomBytes(saltLength);
  const iv = crypto.randomBytes(ivLength);

  // Key-Derivation mit PBKDF2
  const key = crypto.pbkdf2Sync(
    encryptionKey,
    salt,
    100000, // Iterations
    keyLength,
    'sha256',
  );

  const cipher = crypto.createCipheriv(algorithm, key, iv);
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const tag = cipher.getAuthTag();

  // Format: salt:iv:tag:encrypted
  return `${salt.toString('hex')}:${iv.toString('hex')}:${tag.toString('hex')}:${encrypted}`;
}

async function main() {
  console.log('🔄 Starte Migration der verschlüsselten Passwörter...\n');
  console.log(`📝 Alter Key: ${OLD_KEY.substring(0, 20)}...`);
  console.log(`🔑 Neuer Key: ${NEW_KEY.substring(0, 20)}...\n`);

  // Lade alle CompanyDbConfig Einträge
  const dbConfigs = await prisma.companyDbConfig.findMany({
    include: {
      company: {
        select: {
          name: true,
          slug: true,
        },
      },
    },
  });

  if (dbConfigs.length === 0) {
    console.log('ℹ️  Keine DB-Configs gefunden. Nichts zu migrieren.');
    return;
  }

  console.log(`📊 Gefunden: ${dbConfigs.length} DB-Config(s)\n`);

  let successCount = 0;
  let errorCount = 0;

  for (const config of dbConfigs) {
    try {
      console.log(`🔄 Migriere DB-Config für Company: ${config.company.name} (${config.company.slug})...`);

      // Prüfe, ob das Passwort im erwarteten Format ist
      if (!config.dbPassword || typeof config.dbPassword !== 'string') {
        console.log(`⚠️  Passwort ist nicht im erwarteten Format. Überspringe...`);
        continue;
      }

      const parts = config.dbPassword.split(':');
      if (parts.length !== 4) {
        console.log(`⚠️  Passwort hat nicht das erwartete Format (${parts.length} Teile statt 4). Überspringe...`);
        continue;
      }

      // Entschlüssele mit dem alten Key
      const decryptedPassword = decryptWithKey(config.dbPassword, OLD_KEY);
      console.log(`   ✅ Entschlüsselt mit altem Key`);

      // Verschlüssele mit dem neuen Key
      const newEncryptedPassword = encryptWithKey(decryptedPassword, NEW_KEY);
      console.log(`   ✅ Neu verschlüsselt mit neuem Key`);

      // Aktualisiere in der Datenbank
      await prisma.companyDbConfig.update({
        where: { id: config.id },
        data: { dbPassword: newEncryptedPassword },
      });

      console.log(`   ✅ In Datenbank aktualisiert\n`);
      successCount++;
    } catch (error: any) {
      console.error(`   ❌ Fehler bei Migration: ${error.message || error}`);
      console.error(`   ⚠️  Diese DB-Config wurde übersprungen\n`);
      errorCount++;
    }
  }

  console.log('\n📊 Migration abgeschlossen:');
  console.log(`   ✅ Erfolgreich: ${successCount}`);
  console.log(`   ❌ Fehler: ${errorCount}`);
  console.log(`   📝 Gesamt: ${dbConfigs.length}\n`);

  if (errorCount > 0) {
    console.log('⚠️  Einige Passwörter konnten nicht migriert werden.');
    console.log('   Mögliche Gründe:');
    console.log('   - Passwort wurde bereits mit dem neuen Key verschlüsselt');
    console.log('   - Passwort hat ein anderes Format');
    console.log('   - Datenbeschädigung\n');
  }

  if (successCount > 0) {
    console.log('✅ Migration erfolgreich abgeschlossen!');
    console.log('   Der Server sollte jetzt ohne Fehler laufen.\n');
  }
}

main()
  .catch((e) => {
    console.error('❌ Kritischer Fehler:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });



