import { Injectable, OnModuleInit } from '@nestjs/common';
import { INestApplication } from '@nestjs/common';

@Injectable()
export class MaintenanceService implements OnModuleInit {
  private app: INestApplication | null = null;

  onModuleInit() {
    // App-Instanz wird über einen globalen Zugriff gesetzt
    // Siehe main.ts für die Initialisierung
  }

  /**
   * Setzt die App-Instanz (wird von main.ts aufgerufen)
   */
  setApp(app: INestApplication) {
    this.app = app;
  }

  /**
   * Führt einen graceful shutdown des Services durch
   * @param userId - ID des Benutzers, der den Neustart ausgelöst hat (für Audit)
   * @param userEmail - Email des Benutzers, der den Neustart ausgelöst hat (für Audit)
   */
  async restart(userId?: string, userEmail?: string): Promise<void> {
    if (!this.app) {
      throw new Error(
        'App-Instanz nicht verfügbar. Service wurde möglicherweise nicht korrekt initialisiert.'
      );
    }

    const userInfo = userEmail || userId || 'Unbekannt';
    const isDevelopment = process.env.NODE_ENV === 'development';

    console.log(
      `[Maintenance] Service-Neustart angefordert von: ${userInfo} (${new Date().toISOString()})`
    );

    if (isDevelopment) {
      console.warn(
        '[Maintenance] WARNUNG: Entwicklungsumgebung erkannt. ' +
          'Der Service wird beendet, aber nicht automatisch neu gestartet. ' +
          'Bitte starten Sie den Service manuell neu (z.B. mit "pnpm dev").'
      );
    }

    // Graceful shutdown mit Delay, damit laufende Requests abgeschlossen werden können
    setTimeout(async () => {
      try {
        console.log('[Maintenance] Starte graceful shutdown...');
        await this.app!.close();
        console.log('[Maintenance] Graceful shutdown abgeschlossen');
        console.log(
          isDevelopment
            ? '[Maintenance] Service beendet. Bitte starten Sie den Service manuell neu.'
            : '[Maintenance] Service beendet. Process Manager sollte den Service automatisch neu starten.'
        );
        process.exit(0);
      } catch (error) {
        console.error('[Maintenance] Fehler beim Shutdown:', error);
        process.exit(1);
      }
    }, 2000); // 2 Sekunden Delay
  }

  // Platzhalter für zukünftige Wartungsfunktionen
  // async clearCache() { ... }
  // async rotateLogs() { ... }
  // async reloadConfig() { ... }
}
