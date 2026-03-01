/**
 * Start-Script für den Cron-Service
 * - Startup-Health-Check
 * - Startet scheduled-trigger-service
 * - Graceful Shutdown
 */

// Lade Umgebungsvariablen aus .env
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// Lade .env-Datei aus dem mailclient-Verzeichnis
// Script liegt in apps/mailclient/scripts/, .env liegt in apps/mailclient/
// Versuche verschiedene Pfade
let envPath: string | undefined;

// Option 1: Relativ zum aktuellen Arbeitsverzeichnis (wenn vom Root gestartet)
const cwdPath = path.resolve(process.cwd(), 'apps/mailclient/.env');
if (fs.existsSync(cwdPath)) {
  envPath = cwdPath;
}

// Option 2: Relativ zum Script-Verzeichnis (wenn vom mailclient-Verzeichnis gestartet)
if (!envPath) {
  const scriptDir = __dirname;
  const relativePath = path.resolve(scriptDir, '../.env');
  if (fs.existsSync(relativePath)) {
    envPath = relativePath;
  }
}

// Option 3: Direkt im mailclient-Verzeichnis (wenn bereits im mailclient-Verzeichnis)
if (!envPath) {
  const directPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(directPath)) {
    envPath = directPath;
  }
}

// WICHTIG: .env MUSS geladen werden, BEVOR scheduled-trigger-service importiert wird!
// scheduled-trigger-service.ts liest process.env.CRON_SERVICE_TOKEN beim Import!
console.log(`[CronService] ========================================`);
console.log(`[CronService] Starte .env-Loading...`);
console.log(`[CronService] Aktuelles Arbeitsverzeichnis: ${process.cwd()}`);
console.log(`[CronService] Script-Verzeichnis: ${__dirname}`);

if (envPath) {
  console.log(`[CronService] Lade .env von: ${envPath}`);
  const result = dotenv.config({ path: envPath });

  if (result.error) {
    console.error(`[CronService] ⚠️  Fehler beim Laden der .env-Datei:`, result.error);
  } else {
    console.log(`[CronService] ✅ .env-Datei geladen`);
    console.log(`[CronService] process.env.CRON_SERVICE_TOKEN vorhanden: ${!!process.env.CRON_SERVICE_TOKEN}`);
    if (process.env.CRON_SERVICE_TOKEN) {
      const token = process.env.CRON_SERVICE_TOKEN;
      // Entferne Anführungszeichen falls vorhanden
      const cleanToken = token.replace(/^["']|["']$/g, '');
      process.env.CRON_SERVICE_TOKEN = cleanToken;
      console.log(`[CronService] ✅ CRON_SERVICE_TOKEN gefunden (${cleanToken.length} Zeichen)`);
      console.log(`[CronService] Token (erste 10 Zeichen): ${cleanToken.substring(0, 10)}...`);
    } else {
      console.warn(`[CronService] ⚠️  CRON_SERVICE_TOKEN nicht in .env gefunden`);
      console.warn(`[CronService] Verfügbare Umgebungsvariablen mit 'CRON':`, Object.keys(process.env).filter(k => k.includes('CRON')));
    }
  }
} else {
  console.error(`[CronService] ❌ .env-Datei nicht gefunden!`);
  console.error(`[CronService] Gesuchte Pfade:`);
  console.error(`  - ${cwdPath}`);
  console.error(`  - ${path.resolve(__dirname, '../.env')}`);
  console.error(`  - ${path.resolve(process.cwd(), '.env')}`);
}
console.log(`[CronService] ========================================`);

// WICHTIG: Dynamischer Import NACH dem Laden der .env-Datei!
// scheduled-trigger-service.ts liest process.env.CRON_SERVICE_TOKEN beim Import
// Daher müssen wir die .env-Datei VOR dem Import laden
const MAILCLIENT_URL = process.env.MAILCLIENT_URL || 'http://localhost:3000';

/**
 * Prüft, ob Mailclient-API erreichbar ist
 */
async function healthCheck(): Promise<boolean> {
  const maxRetries = 6; // 6 Versuche à 5 Sekunden = 30 Sekunden
  const retryDelay = 5000; // 5 Sekunden

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${MAILCLIENT_URL}/api/emails`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.status === 401 || response.status === 200) {
        // 401 ist OK (Auth erforderlich), bedeutet API ist erreichbar
        console.log(`[CronService] ${new Date().toISOString()} INFO Mailclient-API ist erreichbar`);
        return true;
      }
    } catch (error: any) {
      if (attempt < maxRetries) {
        console.log(`[CronService] ${new Date().toISOString()} WARN Mailclient-API nicht erreichbar (Versuch ${attempt}/${maxRetries}), retry in ${retryDelay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
      } else {
        console.warn(`[CronService] ${new Date().toISOString()} WARN Mailclient-API nach ${maxRetries} Versuchen nicht erreichbar, starte Service trotzdem`);
        return false;
      }
    }
  }

  return false;
}

/**
 * Hauptfunktion
 */
async function main() {
  console.log(`[CronService] ${new Date().toISOString()} INFO Starting cron service...`);

  // Startup-Verzögerung (10 Sekunden)
  console.log(`[CronService] ${new Date().toISOString()} INFO Warte 10 Sekunden, bis Mailclient bereit ist...`);
  await new Promise((resolve) => setTimeout(resolve, 10000));

  // Health-Check
  await healthCheck();

  // WICHTIG: Dynamischer Import NACH dem Laden der .env-Datei!
  // Importiere scheduled-trigger-service erst jetzt, damit process.env.CRON_SERVICE_TOKEN bereits gesetzt ist
  const { startCronService } = await import('../src/lib/scheduled-trigger-service');

  // Starte Cron-Service
  try {
    await startCronService();
  } catch (error: any) {
    console.error(`[CronService] ${new Date().toISOString()} ERROR Fehler beim Starten des Cron-Services:`, error);
    process.exit(1);
  }
}

// Starte Service
main().catch((error) => {
  console.error(`[CronService] ${new Date().toISOString()} ERROR Unerwarteter Fehler:`, error);
  process.exit(1);
});

