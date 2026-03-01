# Funktionsübersicht - Saivaro Mail v2

> **Für Neulinge**: Diese Übersicht gibt Ihnen einen vollständigen Überblick über alle Funktionen und Features der Saivaro Mail v2 Webapplikation. Sie ist speziell für Entwickler gedacht, die neu in das Projekt einsteigen möchten.

## 📋 Inhaltsverzeichnis

1. [Projekt-Überblick](#projekt-überblick)
2. [System-Architektur](#system-architektur)
3. [Hauptkomponenten](#hauptkomponenten)
4. [Funktionsbereiche](#funktionsbereiche)
   - [Saivaro Control Center (SCC)](#saivaro-control-center-scc)
   - [SCC-Frontend](#scc-frontend)
   - [Mailclient](#mailclient)
5. [Technische Details](#technische-details)
6. [Nächste Schritte für Neulinge](#-nächste-schritte-für-neulinge)

---

## 🎯 Projekt-Überblick

**Saivaro Mail v2** ist eine Multi-Tenant SaaS-E-Mail-Management-Plattform für Unternehmen. Das System ermöglicht es mehreren Firmen (Tenants), ihre E-Mails über eine gemeinsame Plattform zu verwalten, während jede Firma vollständig isoliert in ihrer eigenen Datenbank arbeitet.

### Kernkonzept: Multi-Tenancy

**Multi-Tenancy** bedeutet, dass mehrere unabhängige Firmen (sogenannte "Tenants") dieselbe Software-Plattform nutzen, während ihre Daten vollständig voneinander getrennt sind.

- **Jede Firma = Ein eigener Tenant**: Jede Firma hat ihre eigene, isolierte Umgebung
- **Jede Firma = Eigene Datenbank**: Vollständige Datenisolation durch separate PostgreSQL-Datenbanken
- **Zentrale Verwaltung**: Das Saivaro Control Center (SCC) verwaltet alle Firmen zentral
- **Dynamische Datenbankverbindungen**: Die Mailclient-App verbindet sich zur Laufzeit mit der richtigen Firmen-Datenbank

---

## 🏗️ System-Architektur

Das System besteht aus **drei Hauptkomponenten**:

```
┌─────────────────────────────────────────────────────────┐
│              Saivaro Mail v2 System                      │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  1. SCC (Backend)         2. SCC-Frontend               │
│     └─ NestJS API           └─ Next.js Admin-UI        │
│        Port: 3001              Port: 3002               │
│                                                          │
│  3. Mailclient                                          │
│     └─ Next.js App                                      │
│        Port: 3000                                       │
│                                                          │
│  Shared Package                                         │
│  └─ Gemeinsame Types & Utilities                       │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### Datenbankstruktur

- **SCC-Datenbank**: Zentrale Datenbank für Firmen-Verwaltung
- **Tenant-Datenbanken**: Eine separate Datenbank pro Firma
- **Verschlüsselte Passwörter**: DB-Passwörter werden mit AES-256-GCM verschlüsselt gespeichert

---

## 🧩 Hauptkomponenten

### 1. **Saivaro Control Center (SCC) - Backend**
- **Technologie**: NestJS 10+ mit TypeScript
- **Datenbank**: PostgreSQL (Prisma ORM)
- **Zweck**: Verwaltung von Firmen, Datenbank-Provisionierung, System-Management
- **Port**: 3001

### 2. **SCC-Frontend**
- **Technologie**: Next.js 14+ (App Router)
- **Zweck**: Web-Interface für Administratoren zur Verwaltung des Systems
- **Port**: 3002

### 3. **Mailclient**
- **Technologie**: Next.js 14+ (App Router)
- **Zweck**: E-Mail-Management-Interface für Firmen-User (Endbenutzer der einzelnen Firmen)
- **Port**: 3000
- **Multi-Tenant-Routing**: Automatische Erkennung der Firma über:
  - **Subdomain**: `firma1.localhost:3000` → erkennt Firma "firma1"
  - **Header**: `X-Company-Id` oder `X-Company-Slug` HTTP-Header
  - **JWT-Token**: `companyId` im JWT-Token-Payload
- **Dynamische Datenbankverbindung**: Lädt zur Laufzeit die korrekte Firmen-Datenbank aus der SCC-Datenbank

### 4. **Shared Package**
- **Zweck**: Gemeinsame TypeScript-Types und Utility-Funktionen
- **Verwendung**: Wiederverwendbar in allen Apps
- **Vorteil**: Konsistente Datentypen und wiederverwendbare Funktionen über alle Komponenten hinweg

### Wie die Komponenten zusammenarbeiten

1. **SCC-Backend** verwaltet alle Firmen (Companies) und deren Datenbank-Konfigurationen in der zentralen SCC-Datenbank
2. **SCC-Frontend** bietet Administratoren eine Web-UI zur Verwaltung des Systems (Firmen erstellen, Datenbanken provisionieren, etc.)
3. **Mailclient** ist die Anwendung für Endbenutzer:
   - Erkennt automatisch, zu welcher Firma ein Benutzer gehört (Multi-Tenant-Routing)
   - Lädt die Datenbank-Konfiguration der Firma aus der SCC-Datenbank
   - Verbindet sich mit der Firmen-Datenbank zur Laufzeit
   - Stellt E-Mail-Management-Funktionen bereit
4. **Shared Package** stellt gemeinsame Types und Utilities für alle Komponenten bereit

**Datenfluss-Beispiel:**
- Benutzer meldet sich im Mailclient an → Mailclient erkennt Firma → Lädt DB-Config aus SCC-Datenbank → Verbindet sich mit Firmen-Datenbank → Zeigt E-Mails an

---

## 📦 Funktionsbereiche

Die Funktionsbereiche sind nach den Hauptkomponenten des Systems organisiert. Jede Komponente hat spezifische Aufgaben und Funktionen.

### Saivaro Control Center (SCC)

Das SCC ist das administrative Backend-System zur Verwaltung des gesamten Multi-Tenant-Systems.

### 🔐 Authentifizierung & Autorisierung

- **JWT-basierte Authentifizierung**
  - Login für SCC-Administratoren
  - Token-basierte API-Zugriffe
  - Sichere Passwort-Hashung mit bcrypt (Backend) / bcryptjs (Frontend)
  - Verbesserte Fehlerbehandlung mit detaillierten Fehlermeldungen
  - Detailliertes Logging für Authentifizierungsfehler (Benutzer nicht gefunden, Passwort ungültig, Benutzer inaktiv)

- **Rollen & Berechtigungen**
  - Super-Admin: Vollzugriff auf alle Funktionen
  - Admin: Eingeschränkte Verwaltungsrechte

- **Debugging & Wartung**
  - Hilfsskript `db:check-user` zum Prüfen und Erstellen von SCC-Benutzern
  - Automatische Benutzer-Erstellung, falls nicht vorhanden
  - Passwort-Validierung und automatisches Zurücksetzen bei Fehlern

### 🛠️ Hilfsskripte

- **Service-Verwaltung**
  - `start-all.ps1` - Startet alle Services (PostgreSQL, SCC-Backend, SCC-Frontend, Mailclient, Cron-Service)
  - `stop-all.ps1` - Stoppt alle Services und beendet laufende Prozesse
  - `restart-scc.ps1` - Neustartet nur den SCC-Service (nützlich für Testing und Debugging)
  - Automatische Port-Prüfung und Prozess-Verwaltung
  - Unterstützung für UNC-Pfade und lokale Projektpfade

- **Datenbank-Verwaltung**
  - `pnpm db:check-user` - Prüft und erstellt SCC-Benutzer (verfügbar im `apps/scc` Verzeichnis)
  - `migrate-encryption-key.ts` - Migriert verschlüsselte DB-Passwörter auf einen neuen ENCRYPTION_KEY
    - Ausführung: `npx ts-node --project tsconfig.seed.json scripts/migrate-encryption-key.ts`
    - Entschlüsselt alle Passwörter mit altem Key und verschlüsselt sie mit neuem Key neu
    - Unterstützt nahtlose Migration ohne Datenverlust

- **Backup & Restore**
  - **Backup-Script (`backup.ps1`)**
    - Erstellt komprimierte Backups des gesamten Projekts nach `X:\Backups\Cursor-Projekte\SeivaroMail_v2`
    - Intelligente Ausschlüsse: Generierte/wiederherstellbare Ordner werden nicht gesichert
      - `node_modules/` - Kann mit `pnpm install` wiederhergestellt werden
      - `.next/` - Next.js Build-Artefakte
      - `dist/`, `build/` - Build-Ausgaben
      - `.turbo/` - Turborepo Cache
      - `coverage/` - Test-Coverage Berichte
      - `.cache/` - Cache-Dateien
    - Direkte ZIP-Kompression ohne temporäre Kopien
    - Fortschrittsanzeige in Echtzeit (alle 100 Dateien)
    - Zeitstempel im Dateinamen: `SeivaroMail_v2_YYYY-MM-DD_HHmmss.zip`
    - Automatische Bereinigung alter Backups (älter als 30 Tage, konfigurierbar)
    - Laufwerk-Verfügbarkeitsprüfung (X:\)
    - Detaillierte Verifizierung nach Backup-Erstellung
    - Backup-Größe: ~50-200 MB (statt mehreren GB)
    - Backup-Dauer: ~30 Sekunden
    - Ausführung: `.\backup.ps1` oder per Doppelklick auf `BACKUP_STARTEN.bat`

  - **Restore-Script (`restore.ps1`)**
    - Interaktive Auswahl aus verfügbaren Backups
    - Zeigt Backup-Informationen (Größe, Datum, Alter)
    - ZIP-Integritätsprüfung vor Wiederherstellung
    - Sicherheitsabfragen vor Überschreiben bestehender Dateien
    - Fortschrittsanzeige während der Wiederherstellung (alle 50 Dateien)
    - Automatisches Angebot für `pnpm install` nach Restore
    - Ausführung: `.\restore.ps1` oder per Doppelklick auf `RESTORE_STARTEN.bat`

  - **Batch-Wrapper**
    - `BACKUP_STARTEN.bat` - Startet Backup-Script per Doppelklick
    - `RESTORE_STARTEN.bat` - Startet Restore-Script per Doppelklick
    - Automatische PowerShell-Ausführung mit korrekten Parametern

  - **Dokumentation**
    - `BACKUP_README.md` - Umfassende Dokumentation für Backup & Restore
    - Enthält Verwendungsanleitung, Konfiguration, Best Practices, Automatisierung und Fehlerbehebung

### 🏢 Firmen-Verwaltung (Company Management)

- **CRUD-Operationen für Firmen**
  - ✅ Firmen erstellen
  - ✅ Firmen auflisten (mit Suche, Filter, Sortierung)
  - ✅ Firmen-Details anzeigen
  - ✅ Firmen bearbeiten
  - ✅ Firmen löschen

- **Firmen-Status**
  - `pending`: Firma erstellt, aber noch nicht provisioniert
  - `provisioning`: Datenbank wird gerade erstellt
  - `ready`: Firma ist einsatzbereit
  - `suspended`: Firma temporär gesperrt

- **Firmen-Pläne**
  - Verschiedene Abo-Pläne (basic, premium, enterprise)
  - Plan-basierte Feature-Freischaltung

### 💾 Datenbank-Provisionierung

- **Automatische Datenbank-Erstellung**
  - Erstellt neue PostgreSQL-Datenbank für jede Firma
  - Generiert sichere Zugangsdaten
  - Verschlüsselt Passwörter vor Speicherung

- **Provisionierungs-Status-Tracking**
  - Echtzeit-Status-Updates
  - Fehlerbehandlung bei Provisionierungsfehlern
  - Retry-Mechanismen

- **Deprovisionierung**
  - Sichere Löschung von Firmen-Datenbanken
  - Cleanup aller zugehörigen Ressourcen

### 👥 Tenant-User-Verwaltung

- **Benutzer-Management pro Firma**
  - Benutzer erstellen, bearbeiten, löschen
  - Passwort-Verwaltung
  - Rollen-Zuweisung (admin, user)

- **Test-User für Entwicklung**
  - Speicherung von Test-Passwörtern (verschlüsselt)
  - Schneller Zugriff für Entwicklung und Testing

### 🗄️ Datenbank-Interface

- **SQL-Query-Editor**
  - Direkte SQL-Abfragen auf Tenant-Datenbanken
  - Syntax-Highlighting
  - Query-History (letzte 20 Queries)
  - Query-Bookmarks
  - Undo/Redo-Funktionalität
  - EXPLAIN ANALYZE für Performance-Analyse
  - SQL-Formatierung
  - Warnung bei gefährlichen Befehlen (DROP, TRUNCATE, DELETE, UPDATE)

- **Datenbank-Explorer**
  - Tabellen-Liste mit Metadaten
  - Tabellenstruktur-Anzeige (Spalten, Indizes, Foreign Keys, Constraints)
  - Paginierte Tabellendaten-Anzeige
  - Spalten-Auswahl (Ein-/Ausblenden)
  - Copy-Button für einzelne Zellen
  - Views, Sequences und Functions anzeigen

- **Export-Funktionen**
  - CSV-Export für Query-Ergebnisse
  - JSON-Export für Query-Ergebnisse

- **Sicherheitsfeatures**
  - Query-Timeout (Standard: 30 Sekunden, max. 60 Sekunden)
  - Ergebnismengenlimit (Standard: 1000 Zeilen, max. 10000 Zeilen)
  - Query-Length-Limit (max. 100 KB)
  - Tabellenname-Validierung gegen SQL-Injection
  - Connection-Health-Check vor Query-Ausführung
  - Strukturiertes Query-Logging

### 💿 Speicherplatz-Management

- **Speicherplatz-Anzeige**
  - Gesamtübersicht (Datenbank + Dateispeicherplatz)
  - Detaillierte Aufschlüsselung nach Datenbank-Tabellen
  - Dateispeicherplatz-Kategorisierung (E-Mail-Anhänge, Uploads, Sonstige)
  - Tabellen-Statistiken (Größe, Index-Größe, Zeilenanzahl)
  - **Korrekte Datenbankgrößenberechnung**: Verwendet `pg_database_size()` für die tatsächliche Gesamtgröße
    - Inkludiert System-Tabellen, Metadaten, WAL-Dateien, Indizes und alle Datenbank-Objekte
    - Konsistente Anzeige zwischen Storage-Usage-Dashboard und Datenbank-Interface
    - Separate Aufschlüsselung für Tabellendaten (nur public Schema) zur detaillierten Analyse
    - **Hinweis**: Die Gesamtgröße entspricht der PostgreSQL-Funktion `pg_database_size()`, während die Tabellen-Aufschlüsselung nur die benutzerdefinierten Tabellen im `public` Schema zeigt
  - **Korrekte Pfadauflösung für E-Mail-Anhänge**
    - Automatische Erkennung des Storage-Verzeichnisses (`apps/mailclient/storage`)
    - Funktioniert sowohl im Development- als auch Production-Modus
    - Unterstützung für benutzerdefinierte Pfade über `STORAGE_PATH` Umgebungsvariable
    - Verbesserte Path-Validierung mit normalisierten Pfaden für Windows-Kompatibilität
    - Umfangreiche Debug-Logs für Fehlerdiagnose

- **Performance-Optimierungen**
  - Batch-Verarbeitung für Zeilenanzahl (max. 10 Tabellen parallel)
  - Optimierte SQL-Queries mit `pg_class` für bessere Performance
  - Strukturiertes Logging mit Performance-Metriken
  - Effiziente Berechnung großer Datenbanken

- **Caching-Mechanismus**
  - In-Memory Cache mit 5 Minuten TTL
  - Cache-Invalidierung via Query-Parameter
  - Optimierter Cache-Cleanup

### 📊 System-Logs (Erweiterte Logging-Funktionalität)

- **Umfassende Log-Aggregation**
  - **Cron-Job-Logs**: Aus SCC-Datenbank
    - Job-Typen: Scheduled Triggers, E-Mail-Abruf
    - Status-Tracking: Erfolg, Fehler, Läuft
    - Performance-Metriken (Ausführungszeit, verarbeitete Items)
    - Fehlermeldungen und Debug-Informationen
  - **Automation-Logs**: Aus Tenant-Datenbanken
    - Regel-Ausführungen mit Status (success, failed, skipped)
    - Trigger-Typen (incoming, outgoing, manual, scheduled)
    - Ausgeführte Aktionen und Fehlermeldungen
    - Ausführungszeiten pro Regel
  - **E-Mail-Events**: Aus Tenant-Datenbanken (optional)
    - Alle E-Mail-bezogenen Ereignisse
    - Event-Typen (read, unread, deleted, etc.)
    - Chronologische Historie

- **Frontend-Integration**
  - Umbenennung von "Cron-Job-Logs" zu "System-Logs"
  - Filter-Dropdown für Log-Typen (Alle, Cron-Jobs, Automatisierungen, E-Mail-Events)
  - Tabelle mit Pagination (50 Einträge pro Seite)
  - Farbcodierte Log-Typ-Badges:
    - Cron-Jobs: Blau
    - Automatisierungen: Türkis
    - E-Mail-Events: Grau
  - Detaillierte Anzeige je Log-Typ:
    - Cron-Jobs: Job-Typ, Job-Key, verarbeitete Items
    - Automatisierungen: Regel-ID, Trigger-Typ, ausgeführte Aktionen
    - E-Mail-Events: Event-Typ, E-Mail-ID
  - Filterung nach Job-Typ, Status und Datum
  - Farbcodierte Status-Badges (Erfolg, Fehler, Läuft)
  - Refresh-Button zum manuellen Aktualisieren
  - Automatische Zusammenführung und Sortierung aller Logs nach Timestamp

### 🔒 Sicherheit

- **Verschlüsselung**
  - AES-256-GCM für DB-Passwörter
  - PBKDF2 Key-Derivation (100.000 Iterationen)
  - Automatische Verschlüsselung beim Speichern
  - Automatische Entschlüsselung beim Laden
  - **ENCRYPTION_KEY Konfiguration**:
    - Muss in `.env` Dateien gesetzt werden (SCC und Mailclient)
    - Mindestens 32 Zeichen lang erforderlich
    - Beide Anwendungen müssen denselben Key verwenden
    - Warnung bei fehlendem Key (verwendet Dev-Key als Fallback, nicht für Produktion!)
    - Sichere Key-Generierung: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
  - **Key-Migration**:
    - Migrationsskript `apps/scc/scripts/migrate-encryption-key.ts` für nahtlose Key-Wechsel
    - Entschlüsselt alle verschlüsselten Passwörter mit altem Key
    - Verschlüsselt sie neu mit neuem Key
    - Unterstützt Migration ohne Datenverlust

- **API-Sicherheit**
  - JWT-Token-Validierung
  - Input-Validation mit class-validator
  - SQL-Injection-Schutz
  - Path-Traversal-Schutz

### 📚 API-Dokumentation

- **Swagger/OpenAPI**
  - Vollständige API-Dokumentation unter `/api/docs`
  - Interaktive API-Tests
  - Request/Response-Beispiele
  - DTO-Dokumentation

### 🏥 Health-Checks

- **System-Monitoring**
  - API-Health-Check: `/api/health`
  - Datenbank-Health-Check: `/api/health/db`
  - Status-Informationen für Monitoring-Tools

---

## 🖥️ SCC-Frontend

Das SCC-Frontend ist die Web-UI für Administratoren zur Verwaltung des Multi-Tenant-Systems.

### 🔐 Login & Authentifizierung

- **Verbesserte Login-Funktionalität**
  - Vorausgefüllte Standard-Login-Werte für schnelles Testen (`admin@saivaro.local` / `admin123`)
  - Detaillierte Fehlerbehandlung mit spezifischen Fehlermeldungen
  - Unterstützung für verschiedene Fehlerformate (message, error, statusCode)
  - Verbesserte Verbindungsfehler-Erkennung mit hilfreichen Hinweisen
  - Vollständiges Logging der Server-Antworten in der Browser-Konsole für Debugging
  - Automatische Weiterleitung nach erfolgreichem Login

- **Token-Verwaltung**
  - JWT-Token-Speicherung im localStorage
  - Automatische Token-Validierung bei API-Aufrufen
  - Automatische Weiterleitung zum Login bei abgelaufenen Tokens

### 🏢 Firmen-Verwaltung (UI)

- **Companies-Liste**
  - Übersicht aller Companies mit Status, Plan und Erstellungsdatum
  - Volltext-Suche nach Name, Slug oder Plan
  - Filter nach Status und Plan
  - Sortierung nach verschiedenen Kriterien
  - Pagination für große Datenmengen

- **Company-Operationen**
  - Neue Company erstellen über UI
  - Company-Details anzeigen mit vollständigen Informationen
  - Company bearbeiten (Name, Slug, Status, Plan)
  - Company löschen mit Bestätigung
  - DB-Provisionierung über UI starten
  - Speicherplatz-Informationen anzeigen
  - System-Logs anzeigen (Cron-Jobs, Automatisierungen, E-Mail-Events)

### 📊 Datenbank-Verwaltung

- **DB-Config-Anzeige**
  - Anzeige der Datenbank-Konfiguration (Host, Port, Name, User)
  - Verschlüsselte Passwort-Anzeige (nur mit spezieller Berechtigung)
  - Kopieren-Funktion für Zugangsdaten

- **Tabellen-Explorer**
  - Liste aller Tabellen in der Tenant-Datenbank
  - Tabellenstruktur anzeigen
  - Tabellendaten anzeigen mit Pagination
  - SQL-Query-Ausführung (für Administratoren)

---

## 📧 Mailclient

Der Mailclient ist die Hauptanwendung für Firmen-User zur Verwaltung ihrer E-Mails.

### 🎨 Modernes Frontend-Design

Der Mailclient verwendet ein modernes, responsives Design mit Tailwind CSS.

- **Layout-Struktur**
  - **Sidebar**: Navigation, Suchfeld, Filter und Benutzerinformationen
  - **E-Mail-Liste**: Kompakte List-View-Ansicht aller E-Mails
  - **E-Mail-Vorschau**: Detailansicht der ausgewählten E-Mail (50% Breite standardmäßig). **Vorschau- und Antwort-Tabs sind scrollbar**: Bei langem Inhalt (E-Mail-Vorschau, Kommentare, Timeline bzw. Antwortformular) kann innerhalb des aktiven Tabs gescrollt werden; die Flex-Höhenkette (min-height: 0, overflow-y-auto/overflow-auto) ist dafür in `EmailPreviewPane`, `EmailPageLayout` und `ReplyComposer` umgesetzt.
  - **Kommentarbereich**: Unterhalb der Vorschau, ein- und ausklappbar (Toggle „Kommentare“); bei **aktivierter Thread-Ansicht** wird der Kommentarbereich komplett ausgeblendet (nicht nur eingeklappt), da Kommentare dort pro Nachricht im Thread angezeigt werden.
  - **Timeline**: Chronologische Historie aller E-Mail-Ereignisse (unterhalb der Vorschau)
  - **Toolbar**: Icon-Buttons und Text-Buttons für E-Mail-Aktionen

- **Anpassbare Layouts**
  - **Resizable Layout**: Drag-and-Drop zum Ändern der Größen
    - Horizontal: E-Mail-Liste ↔ Vorschau-Pane
    - Vertikal: Vorschau-Pane ↔ Timeline
  - **Collapsible Timeline**: Ein-/Ausklappbar mit Toggle-Button
  - **Benutzerbezogene Speicherung**: Listenbreite, Timeline-Höhe, Timeline offen/geschlossen, Thread-View (AN/AUS) werden pro Benutzer in `user_settings.layout_preferences` gespeichert und beim nächsten Besuch wiederhergestellt

- **Responsive Design**
  - Vorschau-Pane wird unter 1024px Bildschirmbreite automatisch ausgeblendet
  - Optimierte Darstellung für mobile Geräte
  - Einheitliche UI-Elemente für konsistente Benutzererfahrung

### 🔐 Authentifizierung

- **Multi-Tenant-Login**
  - **Automatische Firma-Erkennung**: Das System erkennt automatisch, zu welcher Firma ein Benutzer gehört
    - Über Subdomain (z.B. `firma1.localhost:3000`)
    - Über HTTP-Header (`X-Company-Id` oder `X-Company-Slug`)
    - Über JWT-Token (`companyId` im Token-Payload)
  - **JWT-basierte Session-Verwaltung**: Sichere Token-basierte Authentifizierung
  - **Sichere Passwort-Authentifizierung**: Passwörter werden mit bcryptjs gehasht

- **Tenant-Isolation**
  - **Datenisolation**: Garantiert, dass Benutzer nur auf Daten ihrer eigenen Firma zugreifen können
  - **Automatisches Datenbank-Routing**: Das System verbindet sich automatisch mit der korrekten Firmen-Datenbank
  - **Sicherheit**: Strikte Trennung zwischen verschiedenen Firmen-Datenbanken

### 📬 E-Mail-Management

#### E-Mail-Liste & Ansicht

- **List-View-Ansicht** (modernes Design)
  - `EmailListItem` Komponente für kompakte E-Mail-Darstellung
  - Zebra-Striping mit subtilen Hintergrundfarben für bessere Lesbarkeit
  - Hervorgehobene aktive E-Mail mit blauem Hintergrund und linker Border; die Hervorhebung ist mit dem sichtbaren Tab (Vorschau oder geöffnete Antwort) synchron: beim Wechsel zwischen Vorschau- und Antwort-Tabs wechselt das Highlight in der Liste mit (`listActiveId = activeReplyToId ?? selectedEmailId`)
  - Status-Icons für "Erledigt" (✓) und "Gelöscht" (🗑️) unter Checkbox und Star
  - Kompakte Darstellung: Checkbox, Star, Status-Icons, Betreff, Vorschau, Datum und Tags in einer Zeile
  - Fette Darstellung für ungelesene E-Mails
  - Gelbe linke Border für ungelesene E-Mails
  - Hover-Effekte für bessere UX
  - Responsive Design
  - **Visuelle Unterscheidung von Telefonnotizen und E-Mails**
    - Telefonnotizen zeigen ein blaues Telefon-Symbol (`FiPhone`) vor dem Betreff (in Tabellen-/Listenansicht); in **gruppierter Ansicht/Konversationen** nur in der ersten Zeile neben der Telefonnummer, kein doppeltes Symbol in der Betreff-Zeile
  - **Konversationsansicht (gruppierte Ansicht)** nutzt Virtualisierung mit `@tanstack/react-virtual` für die flache Liste (Konversationen + Einzeleinträge); bessere Performance bei vielen Gruppen. Im Konversations-Header wird ein Badge „In Bearbeitung: [Name]“ angezeigt, wenn mindestens eine E-Mail der Konversation von einem anderen Benutzer (Reply-Lock) gesperrt ist.
    - E-Mails zeigen ein graues E-Mail-Symbol (`FiMail`) vor dem Betreff
    - Flexbox-Layout für korrekten Text-Overflow mit Ellipsis
    - Konsistente Icon-Größen: 14px für Listen/Tabellen, 16px für Thread-Header, 12px für Thread-Nachrichten
    - Implementiert in allen vier Ansichten: Tabellenansicht, Listenansicht, Gruppierte Ansicht, Thread-Ansicht
  - **Abteilung/Thema in gruppierter Ansicht und Konversationen**
    - Datum und Tags (Abteilung, Thema) stehen in einer rechten Spalte **untereinander** (Datum oben, Tags darunter)
    - Gilt einheitlich für E-Mails und Telefonnotizen; Tags werden vertikal gestapelt, nicht nebeneinander
  - **Virtualisierung für große Listen**: Verwendung von `@tanstack/react-virtual` für optimierte Performance
    - Normale Listenansicht und gruppierte Konversationsansicht (EmailList, EmailListGrouped) nutzen virtuelles Scrolling
    - Effizientes Rendering großer E-Mail-Listen (tausende von E-Mails)
    - Reduzierte Memory-Nutzung durch virtuelles Scrolling
    - Schnellere Ladezeiten und flüssigere Scroll-Performance
    - EmailListItem mit React.memo und stabile Callbacks (z. B. handleContextMenu per useCallback) reduzieren Re-Renders

- **E-Mail-Detailansicht**
  - Vollständige E-Mail-Anzeige mit allen Details
  - Betreff, Absender, Empfänger, Datum, Inhalt
  - HTML-E-Mail-Rendering
  - Responsive Design
  - **Anhänge-Anzeige im Header**
    - Anhänge werden direkt im Header der E-Mail-Vorschau angezeigt
    - "Anhänge:"-Zeile erscheint immer im Header, direkt nach "Datum:"
    - Klickbare Download-Links für jeden Anhang mit Dateiname und 📎-Icon
    - Tooltip zeigt Dateiname und Dateigröße beim Hover über Links
    - Automatisches Laden der Anhänge beim Auswählen einer E-Mail
    - Drei Zustände: "Lade..." während des Ladens, klickbare Links bei vorhandenen Anhängen, "Keine" wenn keine vorhanden
    - Separate detaillierte Anhänge-Sektion unterhalb des Headers bleibt erhalten

- **Thread-Ansicht (Konversationen)**
  - Vollständige Konversations-Ansicht mit allen Nachrichten einer Ticket-ID
  - Chronologische Darstellung aller E-Mails und Telefonnotizen in einem Thread
  - Header zeigt Betreff der neuesten Nachricht mit entsprechendem Symbol (Telefon oder E-Mail)
  - **Symbol-Anzeige bei allen Nachrichten**
    - Jede Nachricht im Thread zeigt ihr Typ-Symbol (Telefon oder E-Mail)
    - Symbol wird immer angezeigt, auch wenn der Betreff identisch ist
    - Weißes Symbol mit Transparenz bei ausgehenden Nachrichten
    - Farbiges Symbol bei eingehenden Nachrichten (blau für Telefonnotizen, grau für E-Mails)
    - Icon-Größe: 12px für einzelne Nachrichten, 16px für Thread-Header
  - **Anhänge in der Thread-Ansicht**
    - Bei Nachrichten mit Anhängen wird ein Büroklammer-Symbol (📎) neben dem Typ-Symbol angezeigt
    - Unter jeder Nachricht werden die Anhänge geladen und mit Dateiname, Größe und Download-Button angezeigt
    - Thread-API liefert `hasAttachment` pro Nachricht; Anhänge werden über `GET /api/emails/[id]/attachments` geladen
  - **Reply-Locks in der Thread-Ansicht**
    - Thread-API liefert pro Nachricht optional `replyLock: { userId, userName }` (aus `email_reply_locks`, TTL-gefiltert)
    - Pro Nachricht: Badge „In Bearbeitung: [Name]“, wenn die E-Mail von einem anderen Benutzer gesperrt ist; „Antworten“-Button öffnet die Antwort auf diese Nachricht und ist deaktiviert, wenn die E-Mail gesperrt ist
    - Callback `onReplyToEmail` und `currentUserId` werden von `EmailPageLayout` über Preview-Pane und `EmailPreview` an `EmailThreadView` durchgereicht
  - Chat-ähnliche Darstellung mit unterschiedlichen Hintergrundfarben für ausgehende/eingehende Nachrichten
  - Implementiert in `apps/mailclient/src/components/EmailThreadView.tsx`

- **E-Mail-Markierung**
  - Als gelesen markieren
  - Als ungelesen markieren
  - Präzise Status-Erkennung basierend auf `read_at` Timestamp
  - Automatische Aktualisierung der Sidebar-Counter bei Status-Änderungen
  - Als wichtig markieren
  - Als Spam markieren
  - **Als erledigt markieren** (neu)
    - "Erledigen"-Button in Toolbar zum Toggle des "Erledigt"-Status
    - Benutzerbezogener Status (jeder Benutzer hat seinen eigenen "Erledigt"-Status)
    - Status-Icon (✓) in E-Mail-Liste für erledigte E-Mails
    - Bulk-Aktionen für mehrere ausgewählte E-Mails
    - Automatisches Event-Logging in Timeline
  - **Abteilungen zuweisen** (Button "🏢 Abteilung" in Aktionsleiste)
    - Modal zur Auswahl mehrerer Abteilungen
    - Direkte Zuweisung von Abteilungen zu E-Mails
    - Anzeige zugewiesener Abteilungen in der E-Mail-Liste
  - **Anhang-Erkennung**: Automatische Erkennung und Anzeige von E-Mails mit Anhängen
    - 📎-Symbol (Büroklammer) in **Listenansicht**, **Tabellenansicht** und **Konversationsansicht** direkt neben dem E-Mail-/Telefon-Symbol für E-Mails mit Anhängen
    - Vollständige IMAP-Fetch mit `RFC822` für korrekte Anhang-Erkennung
    - Anhänge werden beim E-Mail-Abruf automatisch erkannt und gespeichert

#### Audio-Features für E-Mails

- **Text-to-Speech (Vorlesen)**
  - Button "Vorlesen" oberhalb des E-Mail-Headers
  - Browser-native Web Speech API (SpeechSynthesis) als Standard
  - Optional: ElevenLabs-Integration für hochwertige Stimmen
  - Konfigurierbare ElevenLabs-Stimme (Voice ID) pro Firma
  - Toggle-Button zum Aktivieren/Deaktivieren von ElevenLabs
  - Test-Button in den Einstellungen zum Testen der ElevenLabs-Konfiguration
  - Loading-State während der Audio-Vorbereitung
  - Automatischer Fallback auf Browser-TTS bei Fehlern
  - Feature-Flag-gesteuerte Anzeige (aktivierbar im SCC)

- **E-Mail-Zusammenfassung als Audio**
  - Button "Zusammenfassung wiedergeben" neben dem Vorlesen-Button
  - Generiert kurze Zusammenfassung mit OpenAI GPT
  - Gibt Zusammenfassung ausschließlich als Audio aus
  - Unterstützt verschiedene OpenAI-Modelle (GPT-4o-mini, GPT-3.5-turbo, GPT-4, GPT-4 Turbo)
  - Verwendet ElevenLabs für Audio-Ausgabe, falls aktiviert
  - Fallback auf Browser-TTS, wenn ElevenLabs nicht verfügbar ist
  - Feature-Flag-gesteuerte Anzeige (aktivierbar im SCC)

- **Company-spezifische AI-Konfiguration**
  - OpenAI API-Key-Verwaltung (verschlüsselt)
  - OpenAI-Modell-Auswahl (Dropdown)
  - ElevenLabs API-Key-Verwaltung (verschlüsselt)
  - ElevenLabs Voice ID-Konfiguration
  - ElevenLabs Aktivierungs-Toggle
  - Einstellungen in "Allgemeine Einstellungen"
  - Separate "Speichern"-Buttons für jede Konfiguration
  - Auto-Save mit Debounce
  - Validierung von API-Keys und Modellen
  - State-Refs für korrekte Closure-Behandlung (verhindert Toggle-Button-Deaktivierung beim Speichern)

- **Feature-Flag-System**
  - Konsolidiertes Feature-Flag `audioFeatures` aktiviert/deaktiviert beide Audio-Funktionen gemeinsam
  - Speicherung in `Company.metadata.features.audioFeatures` (SCC-Datenbank)
  - Rückwärtskompatibilität: Alte separate Flags (`textToSpeech`, `emailSummary`) werden automatisch abgeleitet
  - Logik: `audioFeatures ?? (textToSpeech || emailSummary) ?? false`
  - Feature-Flag-Check in allen Audio-API-Endpunkten
  - UI in SCC-Frontend: Checkbox "Audio-Features aktivieren" mit Beschreibung
  - Implementiert in `apps/mailclient/src/lib/company-features.ts` und `apps/scc/src/companies/companies.service.ts`

#### Telefonnotizen

- **Telefonnotizen erstellen**
  - **"Neu..." Dropdown-Button**: Button mit Dropdown-Menü für "E-Mail" oder "Telefonnotiz"
    - Berücksichtigt aktiven Filter (filterId wird in URL übergeben)
    - Implementiert in `apps/mailclient/src/components/EmailToolbar.tsx` als `NewButtonDropdown` Komponente
  - Telefonnotiz-Formular mit Telefonnummer statt E-Mail-Absender
  - Telefonnummer ist Pflichtfeld und klickbar (tel:-Link)
  - Gleiche Funktionen wie E-Mails: Betreff, Inhalt, Abteilung, Thema
  - Ticket-ID-System: Telefonnotizen erhalten Ticket-IDs und werden mit E-Mails in Vorgängen gruppiert
  - Implementiert im ReplyComposer-Tab auf der E-Mail-Seite (`/emails`); „Neu…“ → „Telefonnotiz“ öffnet den Tab

- **Visuelle Unterscheidung**
  - Telefonnotizen zeigen ein blaues Telefon-Symbol (`FiPhone`); in **gruppierter Ansicht/Konversationen** nur in der ersten Zeile neben der Telefonnummer, in der Betreff-Zeile kein zweites Telefon-Symbol (keine doppelten Symbole)
  - E-Mails zeigen ein graues E-Mail-Symbol (`FiMail`) vor dem Betreff
  - Symbol wird in allen Ansichten angezeigt: Tabellenansicht, Listenansicht, Gruppierte Ansicht, Thread-Ansicht
  - In Thread-Ansicht: Symbol bei allen Nachrichten sichtbar (auch bei gleichem Betreff)
  - Telefonnummer wird ohne zusätzliches Symbol angezeigt (nur als klickbarer Link)
  - In gruppierter Ansicht/Konversationen: Abteilung und Thema (Tags) bei Telefonnotizen wie bei E-Mails rechts neben dem Datum, untereinander angeordnet

- **Antworten auf Telefonnotizen**
  - **Antworten-Button in Toolbar**: Neuer Button zwischen "Neue E-Mail" und "Erledigen"
    - Bei Telefonnotizen: Dropdown mit "Per E-Mail antworten" oder "Per Telefonnotiz antworten"
    - Bei normalen E-Mails: Einfacher Link ohne Dropdown
    - Aktiviert nur, wenn eine E-Mail ausgewählt ist
    - Berücksichtigt aktiven Filter (filterId wird in URL übergeben)
    - Implementiert in `apps/mailclient/src/components/EmailToolbar.tsx` als `ReplyButtonDropdown` Komponente
  - Flexibler Workflow: Antwort kann als E-Mail oder als neue Telefonnotiz erstellt werden
  - Beide Antworttypen erhalten die gleiche Ticket-ID für korrekte Gruppierung
  - Automatische Anpassung: Bei Telefonnotizen bleibt das "An"-Feld leer (wird durch replyType bestimmt)
  - replyAll ist nicht möglich bei Telefonnotizen (Fehlermeldung wird angezeigt)

- **Datenbank-Integration**
  - `type` Feld in `emails` Tabelle: `'email'` oder `'phone_note'`
  - `phone_number` Feld für Telefonnummern
  - Thread-API erweitert: `type` und `phone_number` werden zurückgegeben
  - `latestType` in Thread-API-Response für korrekte Header-Anzeige

#### E-Mail-Laden & -Anzeige

- **Zuverlässiges E-Mail-Laden**
  - Verbesserte Race-Condition-Behandlung beim Laden von E-Mail-Details
  - E-Mails werden jetzt zuverlässig beim ersten Öffnen geladen, auch nach längerer Inaktivität
  - Technische Verbesserung: Verwendung von Refs statt State für Race-Condition-Checks in `loadEmailDetails`
  - Implementiert in `apps/mailclient/src/hooks/useEmailState.ts`
  - Behebt Problem, dass E-Mails beim ersten Öffnen nach längerer Zeit nicht geladen wurden

#### E-Mail-Versand

- **E-Mail verfassen**
  - Vollständiger E-Mail-Composer
  - **"Neu..." Dropdown-Button**: Button mit Dropdown-Menü für "E-Mail" oder "Telefonnotiz"
    - Berücksichtigt aktiven Filter (filterId wird in URL übergeben)
    - Implementiert in `apps/mailclient/src/components/EmailToolbar.tsx` als `NewButtonDropdown` Komponente
  - Mehrere Empfänger (kommagetrennt)
  - CC und BCC-Unterstützung
  - Betreff und Inhalt
  - **Nachrichtenfeld (Body)**: Rich-Text-Editor (TinyMCE/SignatureEditor) statt einfachem Textfeld – Formatierung (Fett, Kursiv, Links, Listen, Bilder etc.) und HTML-Signatur werden korrekt angezeigt und gesendet. Der Editor nutzt TinyMCE; API-Key über `NEXT_PUBLIC_TINYMCE_API_KEY` in `.env`.
  - **Abteilungsauswahl**: Pflichtfeld beim Erstellen einer neuen E-Mail
    - Nur aktive Abteilungen mit zugeordnetem E-Mail-Konto werden angezeigt
    - Automatische Vorauswahl der Standard-Abteilung aus Benutzereinstellungen
    - Speicherung der zuletzt verwendeten Abteilung in localStorage
    - Beim Antworten aus einem Filter wird automatisch die Abteilung des Filters vorausgewählt
  - **Theme-Auswahl**: Optionales Dropdown zur Auswahl eines Themas
    - Kann als Pflichtfeld konfiguriert werden (über `themeRequired` Einstellung)
    - Automatisches Laden verfügbarer Themes
    - Speicherung der zuletzt verwendeten Theme-Auswahl in localStorage
    - Beim Antworten wird das Theme der ursprünglichen E-Mail automatisch übernommen
    - Bei Konversationen: Theme der neuesten E-Mail wird verwendet
  - **Signatur**: Wird automatisch aus der gewählten Abteilung eingefügt (am Anfang des Textes; bei Antworten vor dem Zitat). HTML- oder Plaintext-Signatur je nach Abteilungs-Einstellung. Platzhalter wie `{{companyName}}`, `{{companyAddress}}`, `{{companyPhone}}`, `{{companyEmail}}`, `{{companyWebsite}}` und Benutzer-Platzhalter werden aus den Firmendaten (SCC-API oder SCC-Datenbank-Fallback) bzw. aus dem angemeldeten Benutzer ersetzt.
  - Validierung vor dem Versand

- **Antworten auf E-Mails**
  - **Antworten-Button in Toolbar**: Neuer Button zwischen "Neue E-Mail" und "Erledigen"
    - Aktiviert nur, wenn eine einzelne E-Mail ausgewählt ist
    - Öffnet den ReplyComposer-Tab auf der E-Mail-Seite (`/emails`) mit Antwort-Kontext (`replyToId`)
    - Verwendet `FiCornerUpLeft` Icon für konsistente UI
  - **Erweiterte Antwort-Funktionalität für Telefonnotizen**
    - Dropdown-Menü beim Antworten auf Telefonnotizen: "Per E-Mail antworten" oder "Per Telefonnotiz antworten"
    - Normale E-Mails: Einfacher Link ohne Dropdown
    - Automatische Anpassung: Bei Telefonnotizen bleibt das "An"-Feld leer (wird durch replyType bestimmt)
    - replyAll ist nicht möglich bei Telefonnotizen (Fehlermeldung wird angezeigt)
    - Berücksichtigt aktiven Filter (filterId wird in URL übergeben)
    - Implementiert in `apps/mailclient/src/components/EmailToolbar.tsx` als `ReplyButtonDropdown` Komponente
  - **ReplyComposer**: Neue E-Mail, Telefonnotiz und Antworten werden im ReplyComposer-Tab auf `/emails` bearbeitet; keine separaten Compose-Seiten mehr (Redirects von `/emails/compose` und `/emails/compose/phone-note` nach `/emails`).

- **Erledigt-Markierung beim Senden (ReplyComposer)**
  - **Schalter „Ursprung beim Senden erledigen“** (nur bei Antworten sichtbar): Markiert die Ursprungsnachricht nach erfolgreichem Versand als erledigt.
  - **Schalter „Aktuelle Nachricht nach dem Senden erledigen“** (immer sichtbar): Markiert die gerade gesendete/erstellte Nachricht (Antwort, neue E-Mail oder Telefonnotiz) als erledigt.
  - Beide Schalter standardmäßig aktiviert; Erfolgsbestätigung und dezente Fehlermeldung bei fehlgeschlagener Markierung (PATCH), ohne den Versand-Erfolg zu beeinträchtigen.
  - Accessibility (role="switch", Tastatur) und Layout-Fix gegen unerwünschtes Scrollen beim Toggle; implementiert in `ReplyComposer.tsx`.

- **E-Mail senden**
  - **Vollständige SMTP-Integration**
    - Automatische Verwendung des SMTP-Kontos des Benutzers
    - Unterstützung für SSL (Port 465) und STARTTLS (Port 587)
    - Authentifizierung mit SMTP-Benutzername und Passwort
    - Korrekte Absender-Adresse: Verwendet E-Mail-Adresse aus SMTP-Konto
    - E-Mail-Adressen-Extraktion: Formatierte Adressen wie `"Name" <email@example.com>` werden korrekt verarbeitet
    - CC/BCC-Unterstützung: Korrekte Extraktion und Verarbeitung von CC- und BCC-Adressen
    - Verbesserte E-Mail-Header: Message-ID, Date, X-Mailer-Header für bessere Zustellbarkeit
    - Reply-To-Header: Wird automatisch gesetzt, wenn User-E-Mail sich von Sender-E-Mail unterscheidet
  - Speicherung gesendeter E-Mails in Datenbank
  - Versand-Status-Tracking
  - Fehlerbehandlung: E-Mail bleibt in DB gespeichert, auch wenn SMTP-Versand fehlschlägt
  - Implementiert mit `nodemailer` in `apps/mailclient/src/app/api/emails/route.ts`

#### E-Mail-Abruf

- **IMAP-Integration**
  - Automatischer E-Mail-Abruf von IMAP-Servern
  - Unterstützung für SSL/TLS und STARTTLS
  - Konfigurierbare IMAP-Ordner
  - UID-basierte Duplikatsprüfung (verhindert doppelte E-Mails)

- **E-Mail-Konto-Verwaltung**
  - Mehrere E-Mail-Konten pro Benutzer
  - IMAP- und SMTP-Konfiguration (siehe auch Einstellungen → E-Mail-Konten)
  - Verbindungstest vor dem Speichern
  - Aktiv/Inaktiv-Status für Konten
  - Nur aktive Konten werden für Abruf verwendet

- **Automatischer Abruf**
  - Konfigurierbares Abruf-Intervall (1-1440 Minuten, Standard: 5 Minuten)
  - Cron-basierter automatischer Abruf (siehe auch Scheduled Triggers & Cron-Service)
  - Manueller Abruf-Button ("Jetzt abrufen")
  - Abruf-Status-Anzeige

- **Modulare Architektur**
  - Die E-Mail-Abruf-Funktionalität ist in mehrere Module aufgeteilt (siehe [Code-Architektur](#code-architektur) für Details):
    - `imap-client.ts`: IMAP-Verbindung, Ordner-Öffnung, E-Mail-Suche, Fetch-Logik
    - `email-parser.ts`: Parsing-Logik mit mailparser
    - `attachment-handler.ts`: Attachment-Verarbeitung
    - `email-fetcher.ts`: Orchestrierung aller Module

#### E-Mail-Suche & Filter

- **Volltext-Suche**
  - Suche in Betreff, Absender und Inhalt (konfigurierbare Suchfelder)
  - PostgreSQL `tsvector` für effiziente Volltext-Suche im E-Mail-Inhalt
  - Fallback auf `ILIKE` für Betreff und Absender
  - Mindestens 3 Zeichen erforderlich für Suche
  - Suche findet Zahlen auch innerhalb von Wörtern
  - Suche wird nur bei Button-Klick oder Enter-Taste ausgeführt
  - Tooltip-Hinweis: "Mindestens 3 Zeichen eingeben, dann Enter drücken"
  - Clear-Button zum schnellen Löschen der Sucheingabe
  - ESC-Taste zum Löschen der Sucheingabe

- **Filter-Optionen**
  - **"Alle Mails" Button**: Zeigt alle E-Mails der Datenbank unabhängig von Filtern (inklusive gelöschter E-Mails)
    - Direkt unter "Multi-Tenant E-Mail" in der Sidebar platziert
    - Im Stil der Filter-Buttons für konsistente UI
    - Berücksichtigt maximale Anzahl anzuzeigender Mails (Limit & Paginierung)
  - Alle E-Mails
  - Nur gelesene E-Mails (präzise Status-Erkennung basierend auf `read_at`)
  - Nur ungelesene E-Mails (automatische Counter-Updates in Sidebar)
  - Fette Darstellung der Counter bei ungelesenen E-Mails in Filtern
  - **Erledigt-Status-Filter** (neu)
    - Separates Dropdown für "Erledigt"-Status: "Alle", "Nur erledigte", "Nur unerledigte"
    - Unabhängig vom allgemeinen Status-Filter
    - Korrekte Filterung: Erledigte E-Mails werden nur angezeigt, wenn explizit ausgewählt
  - Filter nach Themen
  - Filter nach Dringlichkeit
  - Filter nach Abteilungen
    - Filtert nach Absender-, Empfänger- oder direkt zugewiesenen Abteilungen
    - OR-Logik: E-Mail wird angezeigt, wenn mindestens eine Abteilung übereinstimmt
    - Multi-Select für mehrere Abteilungen

- **Benutzerdefinierte Filter**
  - Erstellung eigener Filter mit mehreren Workflows (Regeln)
  - Filter-Workflows: Von, An, Betreff, Inhalt, Status, Thema, Abteilung, Typ, Telefonnummer
  - Operatoren: Enthält, Gleich, Beginnt mit, Endet mit, Ist
  - Mail-Anzahl in Klammern nach Filternamen anzeigen (optional)
  - Filter mit Abteilungsregeln sind nur für berechtigte Benutzer sichtbar
  - Direktes Speichern beim Bearbeiten eines einzelnen Filters
  - **Filter-Neuladen**: Beim Klick auf einen bereits aktiven Filter werden die E-Mails neu geladen
  - **Korrekte Counter-Berechnung**: Filter zeigen jetzt die korrekte Anzahl an E-Mails
    - API lädt jetzt bis zu 200 E-Mails (statt nur 1) für präzise Zählung
    - Behebt Problem, dass Filteranzahl falsch angezeigt wurde (zeigte nur 1 statt tatsächlicher Anzahl)
    - Filter, die nach gelöschten E-Mails suchen, zeigen ebenfalls die korrekte Anzahl
    - Implementiert in `apps/mailclient/src/components/Sidebar.tsx`
  - **Filter-Persistenz beim Reload**: Der zuletzt ausgewählte Filter wird automatisch wiederhergestellt
    - Beim Neuladen der Seite bleibt der zuletzt ausgewählte Filter aktiv
    - Funktioniert für Standard-Filter (Alle, Gelesen, Ungelesen, Erledigt, Nicht erledigt) und benutzerdefinierte Filter
    - Filter werden im localStorage gespeichert für persistente Speicherung
    - Validierung: Gelöschte benutzerdefinierte Filter werden nicht wiederhergestellt
    - URL-Synchronisation: Gespeicherte Filter werden automatisch in der URL gesetzt
    - Graceful Degradation: Funktioniert auch bei deaktiviertem localStorage (verwendet Default 'all')
  - **Filter-Integration im Compose-Formular**
    - Beim Erstellen oder Antworten aus einem Filter werden Theme und Abteilung automatisch vorausgewählt
    - Filter-Regeln für `department` und `theme` werden aus User-Settings extrahiert
    - Unterstützt beide Operator-Varianten (`is` und `equals`)
    - Optimierte API-Nutzung: Settings werden nur einmal geladen und wiederverwendet
  - **Typ-Filter**: Filtern nach E-Mail-Typ (E-Mail oder Telefonnotiz)
  - **Telefonnummer-Filter**: Filtern nach Telefonnummern in Telefonnotizen
  - **Korrekte Filter-Logik für gesendete E-Mails**: Gesendete E-Mails werden nur angezeigt, wenn "gesendet" explizit im Filter ausgewählt ist

### 🏷️ Themen-Verwaltung (Email Themes)

- **Themen-Management**
  - CRUD-Operationen für E-Mail-Themen
  - Farbauswahl für Themen (Color-Picker und Hex-Eingabe)
  - Validierung von Themen-Namen und Farben

- **Standard-Themen**
  - Automatische Erstellung von 10 Standard-Themen beim ersten Öffnen:
    - Arbeit (Blau)
    - Privat (Grün)
    - Wichtig (Gelb)
    - Projekte (Cyan)
    - Rechnungen (Rot)
    - Bestellungen (Lila)
    - Support (Orange)
    - Marketing (Pink)
    - Vertrieb (Türkis)
    - Personal (Grau)

- **Themen-Zuweisung**
  - Themen können E-Mails zugewiesen werden
  - Themen werden in der E-Mail-Liste angezeigt
  - Farbvorschau neben Themenamen
  - Filter nach Themen
  - **Automatische Theme-Übernahme beim Antworten**
    - Beim Antworten auf eine E-Mail wird das Theme der ursprünglichen E-Mail automatisch übernommen
    - Bei Konversationen: Theme der neuesten E-Mail wird verwendet
  - **Theme als Pflichtfeld**
    - Konfigurierbar über `themeRequired` Einstellung in User-Settings
    - Wenn aktiviert, muss beim Versand einer E-Mail ein Theme ausgewählt werden
    - Dynamische Label-Anzeige: "Thema (optional)" oder "Thema: *" je nach Einstellung
  - **Filter-Integration**
    - Beim Erstellen oder Antworten aus einem Filter wird das Theme automatisch vorausgewählt
    - Filter-Regeln für `theme` werden aus User-Settings extrahiert

### ⚙️ Automatisierung (Workflow-Engine)

#### Automation Workflows

- **Workflow-Verwaltung**
  - CRUD-Operationen für Automatisierungs-Workflows
  - Workflow aktivieren/deaktivieren
  - Workflow duplizieren
  - Workflow manuell ausführen
  - Workflow-Export/Import (JSON)
  - Abteilungszuweisung für Workflows (nur für berechtigte Benutzer sichtbar)

- **Trigger-Typen**
  - `incoming`: Bei eingehender E-Mail
  - `outgoing`: Bei ausgehender E-Mail
  - `manual`: Manuelle Ausführung (über Context-Menü)
  - `scheduled`: Zeitgesteuerte Ausführung (Cron)
  - `email_updated`: Bei E-Mail-Update

- **Workflow-Editor**
  - Visueller Workflow-Editor mit React Flow (n8n-ähnlich)
  - Vollbild-Modus: Nutzt den gesamten Bildschirm
  - Drag & Drop-Interface
  - Verschiedene Node-Typen: Start, Condition, Action, Department
  - Canvas-Features: Zoom, Pan, Minimap, Grid, Controls
    - Zoom-Level wird als Prozentsatz in der unteren rechten Ecke angezeigt
    - Initialer Zoom-Level auf 100% gesetzt
  - Workflow-Validierung: Cycle-Detection, Node/Connection-Validierung
  - Auto-Save, Undo/Redo-Funktionalität
  - Verbindungen trennen (Hover-Button, Entf-Taste, Konfigurations-Panel)
  - **Abteilungs-Knoten**: Abteilungen können als Knoten hinzugefügt werden
    - Konfigurations-Panel zur Auswahl mehrerer Abteilungen
    - Abteilungen werden aus Knoten extrahiert beim Speichern

- **Bedingungen (Condition-Node)**
  - **Felder**: Betreff, Von, An, Inhalt, Typ (E-Mail/Telefonnotiz), Telefonnummer, Dringlichkeit, Thema, Lesestatus, Erledigt-Status, Anhang.
  - **Operatoren**: Enthält, Gleich, Beginnt mit, Endet mit, Enthält nicht, Ist leer, Ist nicht leer, Ungleich, Entspricht RegEx.
  - **Mehrfachbedingungen**: Pro Bedingungsknoten mehrere Regeln mit gemeinsamer Verknüpfung AND oder OR; Konfiguration über „Mehrere Bedingungen (AND/OR) verwenden“, Bedingungen hinzufügen/entfernen.
  - **Werte**: Feldabhängige Eingaben (Dropdowns für Typ, Dringlichkeit, Thema, Lesestatus, Erledigt-Status, Anhang; Text/RegEx für die übrigen Felder).

- **Aktionen**
  - **Set Theme**: Thema zuweisen
  - **Set Urgency**: Dringlichkeit setzen
  - **Mark Important**: Als wichtig markieren
  - **Mark Spam**: Als Spam markieren
  - **Forward Email**: E-Mail weiterleiten (mit Variablen-Ersetzung)
    - Verwendet automatisch das E-Mail-Konto der Abteilung, falls die E-Mail einer Abteilung zugeordnet ist
  - **Abteilung zuweisen**: Neue Aktion zum automatischen Zuweisen von Abteilungen zu E-Mails
    - Konfigurierbar über Dropdown mit allen aktiven Abteilungen
    - Funktioniert abteilungsübergreifend
    - Protokolliert `department_assigned` Events in der E-Mail-Timeline
  - **Als erledigt markieren** / **Als unerledigt markieren**
  - **Als gelesen markieren** / **Als ungelesen markieren**
  - **Als gelesen und erledigt markieren** (kombinierter Baustein)

- **E-Mail-Variablen**
  - Platzhalter-Ersetzung in Aktionen:
    - `{{subject}}` - E-Mail-Betreff
    - `{{from}}` - Absender
    - `{{to}}` - Empfänger
    - `{{body}}` - E-Mail-Inhalt
    - `{{date}}` - Datum
    - Und viele mehr...

- **Workflow-Ausführung**
  - Workflows werden von oben nach unten abgearbeitet
  - Robuste Fehlerbehandlung (Fehler stoppen nicht den gesamten Workflow)
  - Logging aller Workflow-Ausführungen
  - Timeline-Anzeige aller Ereignisse

#### Scheduled Triggers & Cron-Service

- **Node.js Cron-Service**
  - Separater Service für geplante Aufgaben
  - Multi-Tenant-Handling: Lädt alle Companies und erstellt Jobs pro Company
  - Job-Management: Erstellen, Aktualisieren, Löschen von Cron-Jobs
  - Refresh-Mechanismus: Automatisches Neuladen alle 5 Minuten (konfigurierbar über `CRON_REFRESH_INTERVAL_MS`)
  - Graceful Shutdown: Korrektes Beenden aller Jobs bei SIGTERM/SIGINT
  - Health-Check: Prüft Mailclient-API-Erreichbarkeit vor Start (6 Versuche à 5 Sekunden)
  - Strukturiertes Logging mit Timestamps und Log-Levels (INFO, WARN, ERROR)
  - Startup-Verzögerung: 10 Sekunden Wartezeit für Mailclient-Bereitschaft
  - Implementiert in `apps/mailclient/src/lib/scheduled-trigger-service.ts`

- **Start-Script für Cron-Service**
  - Robuste .env-Datei-Erkennung mit mehreren Pfad-Optionen
  - Automatisches Laden der .env-Datei VOR dem Import des Service-Moduls
  - Detailliertes Logging für .env-Loading-Prozess
  - Token-Validierung und -Bereinigung (Entfernung von Anführungszeichen)
  - Startup-Health-Check mit Retry-Mechanismus
  - Implementiert in `apps/mailclient/scripts/start-cron-service.ts`
  - Startbefehl: `npm run start:cron` (aus `apps/mailclient` Verzeichnis)

- **E-Mail-Abruf-Automatisierung**
  - Automatischer E-Mail-Abruf basierend auf `fetch_interval_minutes` in User-Settings
  - Lädt alle User mit `fetch_interval_minutes >= 1` aus `user_settings` Tabelle
  - Erstellt Cron-Jobs für jeden User mit entsprechendem Intervall
  - Cron-Ausdrücke: 
    - `*/X * * * *` für Minuten < 60 (z.B. `*/1 * * * *` für jede Minute)
    - `0 */X * * *` für Stunden >= 60 (z.B. `0 */2 * * *` für alle 2 Stunden)
  - Dynamische Job-Erstellung beim Refresh (alle 5 Minuten)
  - Automatisches Löschen von Jobs für User ohne `fetch_interval_minutes`
  - API-Endpunkt: `POST /api/emails/fetch` mit Service-Token-Authentifizierung
  - Ruft E-Mails von allen aktiven E-Mail-Konten des Users ab
  - Detaillierte Fehlerbehandlung und Statusmeldungen
  - Integration in bestehenden Cron-Service

- **Scheduled Automation Rules**
  - Zeitgesteuerte Ausführung von Automatisierungsregeln
  - Lädt alle aktiven Regeln mit `trigger_type = 'scheduled'` aus `automation_rules` Tabelle
  - Cron-Ausdruck aus `trigger_config.cronExpression` (z.B. `0 9 * * *` für täglich um 9 Uhr)
  - Filtert E-Mails nach Workflow-Bedingungen
  - Führt Regel für gefilterte E-Mails aus
  - Rate Limiting: Max. 100 E-Mails pro Regel-Ausführung (konfigurierbar über `CRON_MAX_EMAILS_PER_RULE`)
  - API-Endpunkt: `POST /api/automation-rules/scheduled/execute`

- **Service-Token-Authentifizierung**
  - Sichere interne Authentifizierung für Cron-Service
  - Token-Konfiguration über Umgebungsvariable `CRON_SERVICE_TOKEN` in `.env`-Datei
  - Header-basierte Authentifizierung mit `x-service-token` Header
  - Token-Validierung in `apps/mailclient/src/lib/auth.ts` (`verifyServiceToken`)
  - Erfordert zusätzlich `x-company-id` Header für Multi-Tenant-Support
  - Automatisches Laden der .env-Datei im Start-Script
  - Token-Erstellung: Empfohlen mit `openssl rand -hex 32` (64 Zeichen)
  - Production-Modus: Token-Validierung zwingend erforderlich

- **Retry-Mechanismus für API-Aufrufe**
  - Exponential Backoff bei API-Fehlern (1s, 2s, 4s, max. 15s)
  - Max. 3 Retry-Versuche (konfigurierbar über `CRON_MAX_RETRIES`)
  - Timeout-Schutz: 30 Sekunden pro API-Aufruf (konfigurierbar über `CRON_API_TIMEOUT_MS`)
  - Keine Retries bei 4xx-Fehlern (Client-Fehler wie 404, 401)
  - Automatische Retries bei 5xx-Fehlern (Server-Fehler)
  - Detailliertes Logging aller Retry-Versuche
  - Implementiert in `callApiWithRetry()` Funktion

- **Cron-Job-Logging**
  - Automatisches Logging aller Cron-Jobs in SCC-Datenbank (`cron_job_logs` Tabelle)
  - Status-Tracking: `running`, `success`, `failed`
  - Metadaten: User-ID, Company-ID, Rule-ID, Ausführungszeit, verarbeitete Items
  - Fehlerprotokollierung mit detaillierten Fehlermeldungen
  - Job-Key-Format: `email-fetch:{companyId}:{userId}` oder `scheduled-rule:{companyId}:{ruleId}`
  - Implementiert in `apps/mailclient/src/lib/cron-job-logger.ts`
  - API-Endpunkt: `POST /api/cron-jobs/log` (öffentlich, Service-Token erforderlich)

- **Konfiguration**
  - Umgebungsvariablen in `.env`-Datei:
    - `CRON_SERVICE_TOKEN`: Service-Token für Authentifizierung (erforderlich)
    - `MAILCLIENT_URL`: URL des Mailclients (Standard: `http://localhost:3000`)
    - `CRON_REFRESH_INTERVAL_MS`: Refresh-Intervall in Millisekunden (Standard: 300000 = 5 Minuten)
    - `CRON_MAX_RETRIES`: Max. Retry-Versuche (Standard: 3)
    - `CRON_API_TIMEOUT_MS`: API-Timeout in Millisekunden (Standard: 30000 = 30 Sekunden)
    - `CRON_MAX_EMAILS_PER_RULE`: Max. E-Mails pro Regel-Ausführung (Standard: 100)

### 📊 E-Mail-Timeline

- **Chronologische Ereignis-Anzeige**
  - Vollständige Historie aller E-Mail-Ereignisse
  - Anzeige unterhalb der E-Mail-Vorschau (neue Position)
  - Chronologische Darstellung mit Timestamps
  - Anzeige aktiver Regeln zum Zeitpunkt jedes Ereignisses
  - Kompaktes Design mit relativen Zeitangaben ("vor X Min./Std.", "gestern")
  - Sortierung: Neueste Ereignisse oben
  - Genaue Zeitangabe mit Millisekunden (HH:MM:SS.mmm)

- **Event-Typen**
  - `received`: E-Mail empfangen
  - `read`: Als gelesen markiert
  - `unread`: Als ungelesen markiert
  - `deleted`: Gelöscht
  - `restored`: Wiederhergestellt
  - `marked_important`: Als wichtig markiert
  - `marked_spam`: Als Spam markiert
  - `marked_completed`: Als erledigt markiert (neu)
  - `marked_uncompleted`: Als unerledigt markiert (neu)
  - `theme_assigned`: Thema zugewiesen
  - `urgency_set`: Dringlichkeit gesetzt
  - `department_assigned`: Abteilung zugewiesen (neu)
  - `department_removed`: Abteilung entfernt (neu)
  - `forwarded`: Weitergeleitet
  - `automation_triggered`: Automatisierung ausgelöst
  - `automation_applied`: Automatisierung angewendet
  - `automation_rule_activated`: Automatisierungsregel aktiviert
  - `automation_rule_deactivated`: Automatisierungsregel deaktiviert

- **Benutzerinformationen in Events**
  - Anzeige des Benutzers, der eine Aktion ausgeführt hat
  - Fallback-Logik: Name → Username → E-Mail → "Unbekannt"
  - Join mit `users` Tabelle für vollständige Benutzerinformationen
  - Persönliche Timeline: Jeder Benutzer sieht nur seine eigenen Events

- **Event-Deduplizierung**
  - Server-seitige Deduplizierung: Verhindert doppelte Events innerhalb von 5 Sekunden
  - Client-seitige Deduplizierung: Filtert semantisch identische Events
  - Semantischer Key: `emailId-userId-eventType-timestamp` (gerundet auf 10 Sekunden)
  - Bevorzugt neuere Events bei Duplikaten
  - Verhindert Anzeige von mehrfachen identischen Aktionen

- **Resizable Layout**
  - Drag & Drop zum Ändern der Timeline-Höhe (vertikal)
  - Vertikale Aufteilung zwischen E-Mail-Vorschau und Timeline
  - Einklappbare Timeline mit Toggle-Button
  - Pfeil-Richtung ändert sich je nach Kollabierungs-Status (▲/▼)
  - Vollständiges Ausblenden der Timeline möglich
  - Benutzerbezogene Speicherung: Timeline-Höhe und offen/geschlossen werden in `user_settings.layout_preferences` gespeichert

### 💬 Kommentare zu E-Mails

- **Kommentar-Funktion**
  - An jede E-Mail und Telefonnotiz können Kommentare angehängt werden; Autor und Datum werden angezeigt.
  - Kommentare erscheinen in der Timeline wie andere Ereignisse und in der E-Mail-Vorschau im ein-/ausklappbaren Kommentarbereich (unten rechts).
  - **Abstände im Kommentarbereich**: Zwischen den Kommentarkarten und zwischen der Kommentar-Liste und dem Feld „Neuer Kommentar“ sind Abstände (0,5 rem) für bessere Lesbarkeit gesetzt (`EmailNotesSection.tsx`).
  - In der **Thread-Ansicht** werden Kommentare pro Nachricht im Thread angezeigt (hellgelbe Box unter der Nachricht); der separate Kommentarbereich (Toggle + Inhalt) in der Vorschau ist dort **komplett ausgeblendet**.
  - Mailliste: Symbol zeigt an, ob eine Nachricht Kommentare hat; Filter „Hat Kommentare“/„Ohne Kommentare“; Suchfeld „Kommentare“ für Volltextsuche.
  - Bearbeiten/Löschen eigener Kommentare, Zeichenlimit 2000, Kontextmenü „Kommentar hinzufügen“, optionales Mitschicken bei Weiterleitung.
  - Backend: Tabelle `email_notes`, API `GET/POST/PATCH/DELETE /api/emails/[id]/notes`; Thread-API liefert `hasNotes` und `notes` pro E-Mail.
  - Implementiert u. a. in `EmailNotesSection.tsx`, `EmailPreviewPane.tsx`, `EmailThreadView.tsx`, `EmailTimeline.tsx`.

### 🖱️ Context Menu

- **Rechtsklick-Menü**
  - Kontextmenü für E-Mail-Liste
  - Anzeige aller aktiven Regeln mit Trigger "manual"
  - Einzelne Ausführung von Regeln per Klick
  - Automatisches Refresh der E-Mail-Liste nach Ausführung

### 👥 Benutzer- & Abteilungsverwaltung

#### Benutzer-Verwaltung

- **CRUD-Operationen**
  - Benutzer erstellen, bearbeiten, löschen
  - Benutzer-Formular mit Validierung
  - Passwort-Verwaltung
  - Rollen-Zuweisung

- **Benutzer-Liste**
  - Tabellenansicht aller Benutzer
  - Anzeige zugewiesener Abteilungen als Badges
  - Kompakte Darstellung der Abteilungen pro Benutzer

#### Abteilungs-Verwaltung

- **Abteilungs-Management**
  - CRUD-Operationen für Abteilungen
  - Abteilungs-Formular mit Name und Beschreibung
  - Many-to-Many-Beziehung zwischen Benutzern und Abteilungen
  - **Aktiv/Inaktiv Status**: Abteilungen können aktiv oder inaktiv geschaltet werden
    - Nur aktive Abteilungen können für E-Mail-Versand verwendet werden
    - Inaktive Abteilungen werden in Dropdowns ausgeblendet (außer in Admin-Ansichten)
    - In den Einstellungen unter „Abteilungen“ werden alle Abteilungen (aktiv und inaktiv) geladen und angezeigt, damit Admins die vollständige Liste verwalten können
    - Automatische Deaktivierung, wenn zugeordnetes E-Mail-Konto gelöscht oder deaktiviert wird
  - **E-Mail-Konto-Zuordnung**: Jede Abteilung kann einem E-Mail-Konto zugeordnet werden
    - Ein E-Mail-Konto kann nur einer einzigen Abteilung zugeordnet werden (UNIQUE Constraint)
    - Validierung: E-Mail-Konto muss aktiv sein und SMTP-Daten haben
    - E-Mail-Konto muss zur gleichen Company gehören
    - Automatische Validierung bei Erstellung und Aktualisierung
    - Direkte Aktivierung beim Erstellen möglich, wenn E-Mail-Konto ausgewählt wird

- **Standard-Abteilungen**
  - Button "Standard-Abteilungen hinzufügen" (im Empty-State)
  - Intelligente Anzeige: Nur sichtbar, wenn Standard-Abteilungen fehlen
  - Zeigt Anzahl fehlender Abteilungen an
  - Erstellt nur fehlende Abteilungen (überspringt bereits vorhandene)
  - Erfolgsmeldung mit Details (erstellt/übersprungen)

- **Wiederherstellung fehlender Standard-Abteilungen**
  - Button "Fehlende Firmen-Abteilungen wiederherstellen" in der Abteilungsübersicht
  - Berechnet fehlende Standard-Firmenabteilungen im Frontend
  - Öffnet Modal mit Vorschau der fehlenden Abteilungen vor dem Hinzufügen
  - Zeigt Name und Beschreibung jeder fehlenden Abteilung
  - Bestätigung erforderlich vor dem Hinzufügen
  - Toast-Benachrichtigungen für Erfolg/Fehler/Info
  - Button wird deaktiviert, wenn alle Abteilungen vorhanden sind (mit Tooltip)

- **Private Abteilungen für familiäre E-Mail-Nutzung**
  - Button "Private Abteilungen hinzufügen" in der Abteilungsübersicht
  - Erstellt spezielle Abteilungen für private Nutzung:
    - Familie (Zentrale Abteilung für familiäre E-Mail-Kommunikation)
    - Elternteil 1, Elternteil 2 (Persönliche E-Mail-Abteilungen)
    - Kind 1, Kind 2, Kind 3 (Persönliche E-Mail-Abteilungen für Kinder)
  - Modal-Vorschau der hinzuzufügenden Abteilungen
  - Berechnet fehlende private Abteilungen im Frontend
  - Button wird deaktiviert, wenn alle privaten Abteilungen vorhanden sind (mit Tooltip)

- **Modal-Komponente für Abteilungs-Wiederherstellung**
  - Neue wiederverwendbare Komponente `DepartmentRestoreModal.tsx`
  - Zeigt Liste der fehlenden Abteilungen mit Namen und Beschreibungen
  - Loading-State während API-Calls
  - ESC-Taste zum Schließen
  - Buttons: "Abbrechen" und "Hinzufügen" (Primary-Button)
  - Konsistentes Design mit bestehenden Modal-Komponenten (zIndex: 9999)

- **Erklärungssektion mit FAQ**
  - Aufklappbare Erklärungssektion am Ende der Abteilungsübersicht
  - Erklärt für Laien, was Abteilungen sind und wofür sie verwendet werden
  - FAQ-Bereich mit 6 häufig gestellten Fragen:
    - Muss ich Abteilungen verwenden?
    - Wie viele Abteilungen kann ich erstellen?
    - Was bedeutet "Aktiv" und "Inaktiv"?
    - Warum benötigt eine Abteilung ein E-Mail-Konto?
    - Was ist der Unterschied zwischen Firmen- und privaten Abteilungen?
    - Kann ich eine Abteilung später löschen?
  - Fade-In-Animation beim Öffnen
  - Pfeil rotiert beim Auf-/Zuklappen

- **Automatische Standard-Abteilungen bei Provisionierung**
  - Erstellt 6 Standard-Abteilungen bei neuer Company-Provisionierung:
    - Geschäftsführung
    - Buchhaltung
    - Marketing
    - Einkauf
    - Logistik
    - Kundenservice

- **Abteilungszuweisung**
  - Multi-Select für Abteilungen im Benutzerformular
  - Checkbox-Liste aller verfügbaren Abteilungen
  - Unterstützung für mehrere Abteilungen pro Benutzer
  - Automatisches Laden der Abteilungen beim Öffnen des Formulars

#### Kontaktverwaltung (Kontakte)

- **Kontakte in den Einstellungen**
  - Einstellungen → Kontakte: Neuer Bereich mit Karte „Kontakte“ (Adressbuch-Icon)
  - Kontaktliste: Tabelle mit Profilbild, Name, Firma, E-Mail, Telefon, Kundennr., Aktionen (Bearbeiten, Löschen)
  - Suchfeld: Filtert nach Name, E-Mail, Telefon, Firma, Kundennummer (clientseitig)
  - Anzahl der Kontakte wird nur im Kontakte-Untermenü (Seitentitel) angezeigt, nicht auf der Dashboard-Karte

- **CRUD-Operationen**
  - Neuer Kontakt: Button „Neuer Kontakt“ öffnet Modal mit Kontaktformular
  - Bearbeiten: Klick auf Bearbeiten-Icon öffnet dasselbe Modal mit vorausgefüllten Daten
  - Löschen: Löschen-Icon mit Bestätigungsdialog („Löschen?“ Ja/Nein)

- **Kontaktformular (Modal)**
  - Mittelgroßes Modal (max. 640 px, scrollbar)
  - Felder: Profilbild (Upload oder URL, optional entfernen), Anrede für Briefe (Herr/Frau/Divers), Vorname, Nachname, Firma, Kundennummer (optional), Anredeform (Du/Sie) mit Hinweis-Icon, Geburtstag, Notiz
  - Mehrere Telefonnummern, E-Mail-Adressen und Anschriften mit Bezeichnung (Label); dynamisches Hinzufügen/Entfernen; beim Erstellen zunächst nur „Hinzufügen“-Button, erste Zeile nach Klick
  - Validierung: Mindestens ein Anzeigename (Vorname/Nachname oder Firma); gültige E-Mail-Formate

- **Profilbild**
  - Upload (JPEG, PNG, GIF, WebP) oder URL; Vorschau im Formular und als Thumbnail in der Liste (Fallback: User-Icon)

- **API**
  - GET/POST `/api/contacts` (GET mit `?q=...` Suche, `?email=...` Lookup)
  - GET/PATCH/DELETE `/api/contacts/[id]`; Tenant- und Auth-Check; PATCH/POST in Transaktion inkl. Telefon/E-Mail/Adressen

- **Datenbank (Tenant-DB)**
  - Tabellen: `contacts` (u. a. first_name, last_name, company_name, salutation, formal_title, notes, birthday, avatar_url, customer_number, tags), `contact_phones`, `contact_emails`, `contact_addresses`; Kind-Tabellen mit ON DELETE CASCADE

- **E-Mail-Versand mit Abteilungen**
  - **Abteilungsauswahl beim E-Mail-Versand**: Beim Erstellen einer neuen E-Mail muss eine Abteilung ausgewählt werden
    - Nur aktive Abteilungen mit zugeordnetem E-Mail-Konto werden angezeigt
    - Automatische Vorauswahl der Standard-Abteilung aus Benutzereinstellungen
    - Speicherung der zuletzt verwendeten Abteilung in localStorage
    - Beim Antworten aus einem Filter wird automatisch die Abteilung des Filters vorausgewählt
  - **E-Mail-Absender**: E-Mails werden mit dem E-Mail-Konto der ausgewählten Abteilung versendet
    - Automatische Verwendung der SMTP-Daten des zugeordneten E-Mail-Kontos
    - Absender-Adresse entspricht der E-Mail-Adresse des zugeordneten Kontos

- **E-Mail-Signaturen pro Abteilung**
  - **HTML- und Plaintext-Signatur**: Jede Abteilung kann optional eine E-Mail-Signatur haben (HTML über TinyMCE-Editor oder reiner Text).
  - **Speicherung**: `signature_plain` (TEXT) in `departments`; API GET/POST/PATCH `/api/departments/[id]` unterstützt `signaturePlain`.
  - **Compose & Telefonnotiz**: Beim Verfassen (E-Mail oder Telefonnotiz) wird die Signatur der gewählten Abteilung automatisch am Anfang des Textes eingefügt; bei Antworten wird die Signatur dem Antworttext vorangestellt (ein Effect in `ReplyComposer` setzt Body = Leerzeile + Signatur + Leerzeile + Trennlinie + Zitat). Das Nachrichtenfeld verwendet denselben TinyMCE-Editor (SignatureEditor) wie die Signatur – Body wird als HTML gespeichert und gesendet.
  - **Editor**: SignatureEditor nutzt TinyMCE; API-Key über `NEXT_PUBLIC_TINYMCE_API_KEY` in `apps/mailclient/.env`.
  - **Platzhalter in Signaturen**: `{{companyName}}`, `{{companyAddress}}`, `{{companyPhone}}`, `{{companyEmail}}`, `{{companyWebsite}}` sowie `{{userName}}`, `{{userFirstName}}`, `{{userLastName}}` werden beim Einfügen der Signatur ersetzt. Firmendaten kommen von GET `/api/company/contact`; bei SCC-API-Fehler (z. B. 401) erfolgt Fallback auf die SCC-Datenbank (`getCompanyContactFromDb`). Das Frontend sendet `x-company-id` bzw. `x-company-slug` aus dem JWT mit.
  - **Hilfsfunktionen**: `trimTrailingEmptyParagraphs` (entfernt abschließende leere Absätze in der Signatur), `collapseEmptyParagraphsBeforeHr` (reduziert Leerabsätze vor `<hr>` auf eine Leerzeile), `isEmptyEditorHtml`, `replaceSignaturePlaceholders` in `apps/mailclient/src/utils/signature-placeholders.ts`.
  - **Versand**: POST `/api/emails` unterstützt HTML-E-Mails (multipart/alternative); Plaintext-Teil wird aus dem HTML erzeugt.
  - **Komponenten**: `SignatureEditor.tsx` (TinyMCE), Hilfsfunktionen in `signature-placeholders.ts`; SCC-Client `getCompanyContact`/`getCompanyContactFromDb` in `apps/mailclient/src/lib/scc-client.ts`.

- **Automatische Abteilungszuweisung**
  - Eingehende E-Mails werden automatisch einer Abteilung zugewiesen
  - Zuweisung basiert auf Empfänger-Adresse (To, CC, BCC)
  - Prüft alle Empfänger-Adressen gegen aktive Abteilungs-E-Mail-Konten
  - Verhindert doppelte Zuweisungen
  - Funktioniert beim Abruf neuer E-Mails im Hintergrund

### ⚙️ Einstellungen

#### Einstellungsübersicht (Dashboard)

Die Einstellungsübersicht (`/emails/settings`) bietet eine zentrale Übersicht über alle Einstellungsbereiche:

- **Dashboard-Ansicht**: Card-basierte Übersicht mit Statistiken
  - Zeigt Anzahl aktiver E-Mail-Konten, Filter, Benutzer und Abteilungen
  - Karten können per Drag & Drop neu angeordnet werden
  - Reihenfolge wird in localStorage gespeichert
- **Performance-Optimierungen**:
  - Alle Daten werden parallel geladen (`Promise.all()`)
  - AbortController für alle Fetch-Requests mit Cleanup beim Unmount
  - Zentrales Loading-State Management
  - `useMemo` für berechnete Statistiken
- **Browserkompatibilität**:
  - localStorage mit Fehlerbehandlung für private Browsing-Modi
  - CustomEvent Polyfill für ältere Browser
  - SSR-sichere Implementierung
- **Accessibility**:
  - ARIA-Attribute für Error-Messages (`aria-live`, `role="alert"`)
  - Keyboard-Navigation unterstützt
- **Einstellungsbereiche**:

Das Einstellungsmenü wurde komplett neu gestaltet mit einem modernen Dashboard-Layout.

#### Dashboard-Übersicht

- **Karten-basiertes Layout**: Übersicht aller Einstellungskategorien als moderne Karten
  - E-Mail Konten (mit Anzahl aktiver Konten)
  - Allgemeine Einstellungen
  - Filter (mit Anzahl)
  - Themen
  - Automatisierung
  - Benutzer (mit Anzahl)
  - Abteilungen (mit Anzahl); der Abteilungen-Tab lädt beim Öffnen stets die vollständige Liste inkl. inaktiver Abteilungen
  - Kontakte (Kontakte verwalten – Telefon, E-Mail, Anschriften); die Anzahl wird nur im Kontakte-Untermenü angezeigt
  - Hover-Effekte und Animationen
  - Drag & Drop zur Anpassung der Reihenfolge
  - Reihenfolge wird pro Benutzer in `user_settings.layout_preferences.cardOrder` gespeichert (serverseitig)

- **Performance-Optimierungen**:
  - **Parallele Datenladung**: Alle API-Calls (`loadAccounts`, `loadEmailFilters`, `loadUsers`, `loadDepartments`) werden parallel mit `Promise.all()` ausgeführt
  - Reduziert Ladezeit von ~2x auf ~1x der langsamsten Anfrage
  - **AbortController**: Alle Fetch-Requests können abgebrochen werden beim Unmount
  - **Zentrales Loading-State**: Wird erst auf `false` gesetzt, wenn alle Calls abgeschlossen sind
  - **React Performance**: `useMemo` für berechnete Statistiken (`activeAccountsCount`)
  - **Browserkompatibilität**: localStorage mit Fehlerbehandlung, CustomEvent Polyfill, SSR-sichere Implementierung

- **Navigation & Suche**
  - Breadcrumb-Navigation: Kontextabhängige Pfadanzeige mit automatischer Generierung basierend auf Route
  - Quick Actions: Schnellzugriffe für häufige Aktionen (Icon-basierte Buttons, konfigurierbar)
  - Echtzeit-Suche durch Einstellungen (Debounced Suche mit 300ms, Keyboard-Shortcut: `Ctrl+K` / `Cmd+K`)
  - Zurück-Button: Navigation zurück zum Dashboard (Keyboard-Shortcut: `ESC`, Warnung bei ungespeicherten Änderungen)

#### E-Mail-Konten

- **IMAP/SMTP-Konto-Verwaltung** (siehe auch E-Mail-Abruf → E-Mail-Konto-Verwaltung)
  - Erstellen, Bearbeiten und Löschen von E-Mail-Konten
  - Modernisiertes Card-Design für Kontenliste
  - Formular für IMAP- und SMTP-Konfiguration
  - Speicherung von Host, Port, Benutzername, Passwort
  - Aktiv/Inaktiv-Status für Konten
  - Nur aktive Konten werden für E-Mail-Abruf verwendet
  - **Inline-Validierung**: Echtzeit-Validierung während der Eingabe
    - E-Mail-Format-Validierung
    - Port-Bereichsvalidierung (1-65535)
    - Host-Format-Validierung
    - Visuelles Feedback mit grünen Haken/roten Markierungen

- **Verbindungstest**
  - Pre-Save-Verbindungstest für IMAP/SMTP
  - Test-Button im Einstellungsformular
  - Anzeige von Erfolg/Fehler-Status
  - Anzeige der Anzahl verfügbarer E-Mails im IMAP-Ordner
  - Validierung vor dem Speichern

- **STARTTLS/SSL-Auswahl**
  - Radio-Buttons für IMAP: SSL (Port 993) oder STARTTLS (Port 143)
  - Radio-Buttons für SMTP: SSL (Port 465) oder STARTTLS (Port 587)
  - Automatische Port-Anpassung bei Auswahl
  - Speicherung in `imap_ssl`, `imap_tls`, `smtp_ssl`, `smtp_tls` Feldern

- **IMAP-Ordner-Konfiguration**
  - Eingabefeld für IMAP-Ordner (Standard: "INBOX")
  - Unterstützung für Unterordner (z.B. "INBOX/Archiv")
  - Speicherung in `imap_folder` Feld
  - Verwendung beim E-Mail-Abruf und Verbindungstest

- **Passwort-Anzeige beim Bearbeiten**
  - Passwörter werden aus Datenbank geladen
  - Passwort-Felder werden beim Bearbeiten vorausgefüllt
  - Keine erneute Eingabe erforderlich
  - Sichere Speicherung in Datenbank

#### Allgemeine Einstellungen

- **Abruf-Intervall** (siehe auch E-Mail-Abruf → Automatischer Abruf)
  - Eingabefeld für Abruf-Intervall in Minuten (1-1440)
  - Speicherung in `user_settings.fetch_interval_minutes`
  - Standard-Wert: 5 Minuten
  - **Auto-Save**: Automatisches Speichern nach 2.5 Sekunden Inaktivität
    - Visueller Indikator ("Wird gespeichert...", "Gespeichert")
    - Debounce verhindert zu häufige API-Calls

- **Export/Import von Einstellungen**
  - Export aller Einstellungen als JSON-Datei
  - Import mit Validierung und Vorschau
  - Inkludiert Dashboard-Karten-Reihenfolge (wird nach Import serverseitig in `layout_preferences.cardOrder` gespeichert)
  - Backup-Funktionalität

- **Liste-Anpassung**
  - Anpassbare Anzeigeoptionen für die E-Mail-Liste
  - Spalten ein-/ausblenden (für zukünftige Tabellenansicht)
  - Persistierung der Einstellungen
  - **Responsive Darstellung**:
    - Automatische Anpassung für verschiedene Bildschirmgrößen
    - Optimierte Darstellung auf mobilen Geräten

- **Suchfelder**
  - Konfigurierbare Suchfelder für E-Mail-Suche
  - Auswahl, welche Felder durchsucht werden sollen

#### Benutzer- und Abteilungsverwaltung

- **Inline-Validierung**: Echtzeit-Validierung für alle Formulare
  - E-Mail-Format-Validierung
  - Passwort-Mindestlänge (8 Zeichen)
  - Erforderliche Felder
  - Visuelles Feedback

#### Benachrichtigungen & Feedback

- **Toast-Notifications**: Modernes Benachrichtigungssystem (siehe auch UI-Features)
  - Verschiedene Typen: success, error, warning, info
  - Nicht-blockierend, automatisches Ausblenden nach 3-7 Sekunden (keine manuelle Bestätigung nötig)
  - Stack-System für mehrere Toasts gleichzeitig
  - **Vollständige Ersetzung blockierender Popups**: Alle `alert()`-Aufrufe wurden durch elegante Toast-Benachrichtigungen ersetzt
    - Workflow-Ausführung: Erfolgs- und Fehlermeldungen als Toasts
    - Theme- und Abteilungs-Zuweisung: Erfolgsmeldungen beim Speichern
    - Filter- und Workflow-Validierung: Warnungen als Toasts
  - Verbesserte Benutzererfahrung durch nicht-blockierende Benachrichtigungen
  - Position: Oben rechts, automatisches Ausblenden

- **Skeleton Screens**: Strukturierte Ladezustände (siehe auch UI-Features)
  - Verschiedene Varianten: Card, List, Form
  - Puls-Animation für besseres visuelles Feedback

- **Tooltips**: Erklärungen für komplexe Einstellungen
  - Verschiedene Positionen, Keyboard-Navigation unterstützt, Accessibility-konform

#### Keyboard Shortcuts

- `Ctrl+S` / `Cmd+S`: Einstellungen speichern
- `ESC`: Zurück zur Dashboard-Übersicht (siehe auch Navigation & Suche)
- `Ctrl+K` / `Cmd+K`: Fokus auf Suchfeld (siehe auch Navigation & Suche)
- `Ctrl+N` / `Cmd+N`: Neues Element erstellen (kontextabhängig)

#### Warnung bei ungespeicherten Änderungen

- Browser-BeforeUnload-Event für Seitenwechsel
- Bestätigungsdialog beim Navigieren weg mit ungespeicherten Änderungen
- Tracking von Änderungen durch Vergleich mit Original-Werten

### 🎨 UI-Features

- **Modernes Design**
  - **Moderne Sidebar mit Navigation**
    - "Alle Mails" Button für ungefilterte Ansicht aller E-Mails
    - Benutzerdefinierte Filter mit Counter-Anzeige
    - Filter-Neuladen beim Klick auf bereits aktiven Filter
    - Korrekte Counter-Berechnung für gelöschte E-Mails
  - Header-Komponente mit Benutzerinformationen
  - Icons und visuelle Verbesserungen
  - **Responsive Design für mobile Geräte**:
    - Optimierte E-Mail-Liste für alle Bildschirmgrößen
    - Responsive Toolbar: Button-Texte werden auf mobilen Geräten ausgeblendet, nur Icons bleiben sichtbar
    - Flexible Darstellung für optimale Platznutzung
  - Verbesserte UX mit klaren visuellen Hierarchien

- **Zentralisierte Abteilungs-Konstanten**
  - Datei: `apps/mailclient/src/lib/department-constants.ts`
  - Exportiert `BUSINESS_DEPARTMENTS` und `PRIVATE_DEPARTMENTS` Arrays
  - TypeScript-Interface `DepartmentDefinition` für Typ-Sicherheit
  - Wird von folgenden Komponenten verwendet:
    - API-Route `/api/departments/default/route.ts`
    - Frontend-Komponente `DepartmentManagement.tsx`
    - Frontend-Komponente `SettingsDepartmentsTab.tsx`
  - Vorteile:
    - Vermeidet doppelte Definitionen
    - Erleichtert Wartung und Aktualisierung
    - Konsistente Abteilungs-Definitionen im gesamten System

- **UI-Komponenten**
  - **Breadcrumb-Navigation**: Klare Navigation durch die Anwendung mit automatischer Pfadgenerierung
  - **Toast-Benachrichtigungen**: Modernes Benachrichtigungssystem (success, error, warning, info) mit automatischem Ausblenden nach 3-7 Sekunden
    - Vollständige Ersetzung aller blockierender `alert()`-Popups durch elegante Toasts
    - Keine manuelle Bestätigung mehr nötig - automatisches Ausblenden
    - Verbesserte UX bei allen Speicher- und Validierungsvorgängen
  - **Loading States**: Skeleton Screens statt Spinner für bessere UX (Card, List, Form Varianten)
  - **Error Handling**: Strukturierte Fehlermeldungen mit Retry-Mechanismen und Error Boundaries

---

## 🔧 Technische Details

### Datenbank-Schema (Tenant-DBs)

#### users-Tabelle
- UUID-basierte IDs
- `company_id` für Multi-Tenant-Isolation
- `username` (Unique)
- `email`
- `password_hash` (bcryptjs, kompatibel mit bcrypt)
- `first_name`, `last_name`
- `role`, `status`
- `last_login_at`, `created_at`, `updated_at`

#### emails-Tabelle
- UUID-basierte IDs
- `user_id`, `account_id` (Foreign Keys)
- `subject`, `from_email`, `to_email`
- `body` (TEXT)
- `body_tsvector` (PostgreSQL tsvector für Volltext-Suche)
- `message_uid` (für Duplikatsprüfung, UNIQUE Constraint)
- `theme_id` (Foreign Key zu email_themes)
- `urgency` (Dringlichkeit)
- `is_important`, `is_spam` (Boolean)
- `has_attachment` (Boolean, automatisch erkannt beim E-Mail-Abruf)
- `department_id` (UUID, Foreign Key zu `departments`, ON DELETE SET NULL) - Abteilung, von der die E-Mail versendet wurde
- `created_at`, `read_at`

#### email_accounts-Tabelle
- UUID-basierte IDs
- `user_id` (Foreign Key)
- `name`, `email`
- IMAP-Konfiguration: `host`, `port`, `username`, `password`, `ssl`, `tls`, `folder`
- SMTP-Konfiguration: `host`, `port`, `username`, `password`, `ssl`, `tls`
- `is_active`
- `created_at`, `updated_at`

#### email_themes-Tabelle
- `id` (UUID, Primary Key)
- `user_id` (UUID, Foreign Key zu users)
- `name` (VARCHAR(255), NOT NULL)
- `color` (VARCHAR(7), optional, Hex-Format)
- `created_at`, `updated_at` (TIMESTAMP)

#### automation_rules-Tabelle
- Automatisierungsregeln mit Workflow-Definition
- Trigger-Konfiguration
- Status (aktiv/inaktiv)

#### automation_execution_logs-Tabelle
- Logs aller Workflow-Ausführungen
- Timestamps, Status, Fehlermeldungen

#### email_events-Tabelle
- E-Mail-Ereignisse für Timeline
- Chronologische Historie aller Aktionen

#### user_settings-Tabelle
- `user_id` (UUID, Foreign Key, Unique)
- `fetch_interval_minutes` (INTEGER)
- `table_columns` (JSON)
- `search_fields` (JSON)
- `default_department_id` (UUID, Foreign Key zu `departments`, ON DELETE SET NULL) - Standard-Abteilung für E-Mail-Versand
- `layout_preferences` (JSONB, Default `'{}'`) - Benutzerbezogene Layout-Einstellungen: Listenbreite, Timeline-Höhe, Timeline offen/geschlossen, Thread-View, Kartenreihenfolge (Settings-Dashboard)
- `created_at`, `updated_at` (TIMESTAMP)

#### company_config-Tabelle
- `id` (UUID, Primary Key)
- `company_id` (UUID, Foreign Key, UNIQUE)
- `openai_api_key` (TEXT, verschlüsselt) - OpenAI API-Key für Zusammenfassungen
- `openai_model` (VARCHAR(50)) - Ausgewähltes OpenAI-Modell
- `elevenlabs_api_key` (TEXT, verschlüsselt) - ElevenLabs API-Key für Text-to-Speech
- `elevenlabs_voice_id` (VARCHAR(255)) - ElevenLabs Voice ID
- `elevenlabs_enabled` (BOOLEAN, DEFAULT false) - ElevenLabs aktiviert/deaktiviert
- `created_at`, `updated_at` (TIMESTAMP)
- CHECK-Constraint: Nur eine Zeile pro Company
- **Migration**: Automatische Schema-Migration in `apps/mailclient/src/lib/tenant-db-migrations.ts`
  - Prüft Spalten-Existenz und fügt `elevenlabs_enabled` hinzu, falls fehlend
  - Backend-Speicherung: Explizite Boolean-Konvertierung für `elevenlabs_enabled` (verhindert `undefined`-Werte)

#### departments-Tabelle
- `is_active` (BOOLEAN, DEFAULT false) - Aktiv/Inaktiv Status der Abteilung
- `signature_plain` (TEXT) - Plaintext-Version der E-Mail-Signatur (für Versand und Textarea-Anzeige)
- `email_account_id` (UUID, Foreign Key zu `email_accounts`, UNIQUE) - Zugeordnetes E-Mail-Konto
  - Ein E-Mail-Konto kann nur einer Abteilung zugeordnet werden
  - ON DELETE SET NULL: Bei Löschung des E-Mail-Kontos wird die Zuordnung entfernt
- `id` (UUID, Primary Key)
- `company_id` (UUID, Foreign Key)
- `name` (VARCHAR(255))
- `description` (TEXT)
- `created_at`, `updated_at` (TIMESTAMP)

#### user_departments-Tabelle (Junction)
- Many-to-Many-Beziehung zwischen Benutzern und Abteilungen
- `user_id` (UUID, Foreign Key)
- `department_id` (UUID, Foreign Key)

#### contacts-Tabelle
- `id` (UUID, Primary Key)
- `company_id` (UUID, Foreign Key)
- `first_name`, `last_name`, `company_name` (VARCHAR)
- `salutation` (VARCHAR, 'du' | 'sie')
- `formal_title` (VARCHAR, z. B. Herr/Frau/Divers)
- `notes` (TEXT), `birthday` (DATE)
- `avatar_url` (TEXT), `customer_number` (VARCHAR)
- `tags` (JSONB, Array von Strings)
- `created_at`, `updated_at` (TIMESTAMP)

#### contact_phones-, contact_emails-, contact_addresses-Tabellen
- `id` (UUID), `contact_id` (UUID, Foreign Key zu contacts, ON DELETE CASCADE)
- contact_phones: `label`, `number`, `sort_order`
- contact_emails: `label`, `email`, `sort_order`
- contact_addresses: `label`, `street`, `postal_code`, `city`, `country`, `sort_order`

### API-Endpunkte (Übersicht)

#### SCC-Backend (`/api`)

**Authentication:**
- `POST /api/auth/login` - SCC-User-Login

**Companies:**
- `GET /api/companies` - Liste aller Companies
- `POST /api/companies` - Neue Company anlegen
- `GET /api/companies/:id` - Company-Details
- `PATCH /api/companies/:id` - Company aktualisieren
- `DELETE /api/companies/:id` - Company löschen
- `GET /api/companies/:id/db-config` - DB-Config abrufen
- `GET /api/companies/:id/db-config/with-password` - DB-Config mit Passwort
- `GET /api/companies/:id/tenant-users` - Tenant-User-Liste
- `POST /api/companies/:id/tenant-users` - Tenant-User erstellen
- `PATCH /api/companies/:id/tenant-users/:userId` - Tenant-User aktualisieren
- `DELETE /api/companies/:id/tenant-users/:userId` - Tenant-User löschen
- `GET /api/companies/:id/storage-usage` - Speicherplatz-Informationen
- `GET /api/companies/:id/tables` - Liste aller Tabellen
- `GET /api/companies/:id/tables/:tableName` - Tabellenstruktur
- `GET /api/companies/:id/tables/:tableName/data` - Paginierte Tabellendaten
- `POST /api/companies/:id/execute-query` - SQL-Query ausführen
- `POST /api/companies/:id/explain-query` - EXPLAIN ANALYZE
- `GET /api/system-logs/companies/:id/logs` - System-Logs (Cron-Jobs, Automatisierungen, E-Mail-Events)

**Provisionierung:**
- `POST /api/companies/:id/provision-db` - DB provisionieren
- `GET /api/admin/provisioning/status/:id` - Provisionierungs-Status
- `DELETE /api/admin/companies/:id/deprovision-db` - DB deprovisionieren

**System-Logs:**
- `POST /api/system-logs/log` - Log-Eintrag erstellen/aktualisieren (öffentlich, Service-Token)
- `POST /api/system-logs/logs/batch` - Batch-Logging (öffentlich, Service-Token)
- `GET /api/system-logs/companies/:id/logs` - System-Logs für Company abrufen (authentifiziert)
- `GET /api/companies/ready` - Alle bereiten Companies abrufen (für Cron-Service)

**Health:**
- `GET /api/health` - Basis-Health-Check
- `GET /api/health/db` - Datenbank-Health-Check

#### Mailclient (`/api`)

**Authentication:**
- `POST /api/auth/login` - Firmen-User-Login

**Emails:**
- `GET /api/emails` - E-Mails laden (mit Suche und Filter)
  - Gibt `department_id` und `department_name` zurück (JOIN mit `departments` Tabelle)
- `GET /api/emails/:id` - E-Mail-Details
- `POST /api/emails` - E-Mail senden
  - Unterstützt `departmentId` Parameter
  - Validierung: Abteilung muss existieren, aktiv sein und Benutzer muss berechtigt sein
  - Verwendet E-Mail-Konto der ausgewählten Abteilung als Absender
  - Speichert `department_id` in der `emails` Tabelle
- `PATCH /api/emails/:id` - E-Mail aktualisieren (z.B. als gelesen markieren)
- `POST /api/emails/fetch` - E-Mails von IMAP-Konten abrufen

**Email Accounts:**
- `GET /api/email-accounts` - E-Mail-Konten auflisten
  - Administratoren sehen alle E-Mail-Konten der Company (nicht nur eigene)
  - Gibt `departmentUsageCount` zurück (Anzahl zugeordneter Abteilungen)
  - Filtert für aktive E-Mail-Konten mit SMTP-Daten für Abteilungszuweisung
- `POST /api/email-accounts` - E-Mail-Konto erstellen
- `GET /api/email-accounts/:id` - E-Mail-Konto-Details
- `PATCH /api/email-accounts/:id` - E-Mail-Konto aktualisieren
  - Automatische Deaktivierung von Abteilungen, wenn `is_active` auf `false` gesetzt wird
- `DELETE /api/email-accounts/:id` - E-Mail-Konto löschen
  - Automatische Deaktivierung von Abteilungen, die das gelöschte Konto verwenden
- `POST /api/email-accounts/test-connection` - IMAP-Verbindung testen

**Themes:**
- `GET /api/themes` - Alle Themen des Benutzers laden
- `POST /api/themes` - Neues Thema erstellen
- `PATCH /api/themes/:id` - Thema bearbeiten
- `DELETE /api/themes/:id` - Thema löschen

**Automation Rules:**
- `GET /api/automation-rules` - Alle Regeln laden
- `POST /api/automation-rules` - Neue Regel erstellen
- `GET /api/automation-rules/:id` - Regel-Details
- `PATCH /api/automation-rules/:id` - Regel aktualisieren/aktivieren/deaktivieren
- `DELETE /api/automation-rules/:id` - Regel löschen
- `POST /api/automation-rules/:id/duplicate` - Regel duplizieren
- `POST /api/automation-rules/:id/execute` - Regel manuell ausführen
- `GET /api/automation-rules/templates` - Regel-Templates abrufen
- `POST /api/automation-rules/export` - Regeln exportieren (JSON)
- `POST /api/automation-rules/import` - Regeln importieren (JSON)
- `POST /api/automation-rules/scheduled/execute` - Ausführung einer Scheduled Rule

**Users:**
- `GET /api/users` - Benutzer laden (mit zugewiesenen Abteilungen)
  - **Optimiert**: Verwendet optimierten JOIN mit `json_agg()` statt N+1 Queries
  - Reduziert Datenbankabfragen von N+1 auf 1 Query für bessere Performance
  - Gibt Benutzer mit zugewiesenen Abteilungen zurück
- `POST /api/users` - Benutzer erstellen (mit Abteilungszuweisung)
- `PATCH /api/users/:id` - Benutzer aktualisieren (mit Abteilungszuweisung)
- `DELETE /api/users/:id` - Benutzer löschen

**Departments:**
- `GET /api/departments` - Abteilungen laden
  - Query-Parameter: `includeInactive` (boolean) - Zeigt auch inaktive Abteilungen an
  - Gibt `is_active`, `email_account_id` und E-Mail-Konto-Informationen zurück
  - **Optimiert**: Separate Query für `usage_count` statt Subquery für jede Zeile
  - Deutlich bessere Performance bei vielen Abteilungen
- `POST /api/departments` - Abteilung erstellen
  - Unterstützt `emailAccountId` und `isActive` Parameter
  - Validierung: E-Mail-Konto muss aktiv sein, SMTP-Daten haben und nicht bereits zugeordnet sein
- `PATCH /api/departments/:id` - Abteilung aktualisieren
  - Unterstützt `is_active` und `email_account_id` Updates
  - Validierung: E-Mail-Konto darf nicht bereits einer anderen Abteilung zugeordnet sein
- `DELETE /api/departments/:id` - Abteilung löschen
- `POST /api/departments/default` - Standard-Abteilungen erstellen
  - Query-Parameter: `type` (optional)
    - `type=business` oder nicht gesetzt: Erstellt Standard-Firmenabteilungen (Geschäftsführung, Buchhaltung, Marketing, Einkauf, Logistik, Kundenservice)
    - `type=private`: Erstellt private Abteilungen (Familie, Elternteil 1, Elternteil 2, Kind 1, Kind 2, Kind 3)
  - Importiert Abteilungen aus zentraler `department-constants.ts`
  - Erstellt nur fehlende Abteilungen (überspringt bereits vorhandene)
  - Rückgabe: `{ created, skipped, createdDepartments, skippedDepartments, message }`

**Contacts:**
- `GET /api/contacts` - Kontakte laden
  - Query-Parameter: `q` (Suche nach Name, E-Mail, Telefon), `email` (Lookup nach E-Mail-Adresse)
  - Gibt Kontakte inkl. phones, emails, addresses, tags, avatarUrl, customerNumber zurück
- `POST /api/contacts` - Neuen Kontakt erstellen (Body: firstName, lastName, companyName, salutation, formalTitle, notes, birthday, avatarUrl, customerNumber, tags, phones, emails, addresses; Transaktion)
- `GET /api/contacts/:id` - Einzelnen Kontakt laden (404 wenn nicht zum Tenant gehörend)
- `PATCH /api/contacts/:id` - Kontakt aktualisieren (Transaktion inkl. phones/emails/addresses)
- `DELETE /api/contacts/:id` - Kontakt löschen (404 wenn nicht zum Tenant gehörend)

**Settings:**
- `GET /api/settings` - Einstellungen abrufen (inkl. OpenAI/ElevenLabs-Konfiguration, `layoutPreferences`)
- `PATCH /api/settings` - Einstellungen aktualisieren (inkl. OpenAI/ElevenLabs-Konfiguration, partielle `layoutPreferences`-Updates mit Merge)
- `POST /api/settings/test-elevenlabs` - ElevenLabs-Konfiguration testen

**Company Features:**
- `GET /api/company/features` - Feature-Flags für aktuelle Company abrufen

**Text-to-Speech:**
- `POST /api/emails/[id]/text-to-speech` - E-Mail-Inhalt als Audio generieren (ElevenLabs)
  - Generiert Audio für spezifische E-Mail
  - Prüft `audioFeatures` Feature-Flag
  - Verwendet ElevenLabs, falls aktiviert, sonst Browser-TTS
- `POST /api/text-to-speech` - Text als Audio generieren (ElevenLabs)
  - Generische Text-to-Speech-Konvertierung
  - Wird für E-Mail-Zusammenfassungen verwendet
  - Prüft `audioFeatures` Feature-Flag

**Email Summarization:**
- `POST /api/emails/[id]/summarize` - E-Mail-Zusammenfassung generieren (OpenAI)
  - Generiert kurze Zusammenfassung mit OpenAI GPT
  - Prüft `audioFeatures` Feature-Flag
  - Gibt Zusammenfassung als Audio aus (über `/api/text-to-speech`)

**Settings:**
- `POST /api/settings/test-elevenlabs` - ElevenLabs-Konfiguration testen
  - Testet ElevenLabs-API-Verbindung mit Beispiel-Audio
  - Validiert API-Key und Voice ID
  - Gibt Test-Audio zurück

### Sicherheit

- **Verschlüsselung**: AES-256-GCM für DB-Passwörter
  - ENCRYPTION_KEY muss in `.env` gesetzt werden (muss mit SCC übereinstimmen)
  - Fallback-Entschlüsselung, wenn SCC-API nicht erreichbar ist
  - Verwendet dieselbe Verschlüsselungslogik wie SCC-Backend
- **JWT-Auth**: Sichere Token-basierte Authentifizierung
- **Tenant-Isolation**: Strikte Trennung zwischen Firmen-Datenbanken
- **Input-Validation**: class-validator für alle API-Inputs
- **Password-Hashing**: bcryptjs für Benutzer-Passwörter (reine JavaScript-Implementierung, kompatibel mit bcrypt)
- **SQL-Injection-Schutz**: Parametrisierte Queries, Tabellenname-Validierung
- **Path-Traversal-Schutz**: Validierung von Dateipfaden

### Performance

- **Connection-Pooling**: Effiziente DB-Verbindungen pro Company
- **Caching**: DB-Config-Caching (5 Min TTL)
- **Lazy-Loading**: Dynamisches Laden von DB-Configs; AutomationWorkflowEditor per `next/dynamic` erst bei Öffnen des Workflow-Editors geladen
- **Query-Optimierung**: Indizes auf häufig abgefragten Spalten
- **Batch-Processing**: Batch-Verarbeitung für große Datenmengen
- **Virtualisierung**: React Virtual für große Listen
  - Verwendung von `@tanstack/react-virtual` für E-Mail-Listen (normale und gruppierte Konversationsansicht)
- **Parallele API-Calls**: Einstellungsübersicht lädt alle Daten parallel
  - `loadAccounts`, `loadEmailFilters`, `loadUsers`, `loadDepartments` werden parallel ausgeführt
  - Reduziert Ladezeit von ~2x auf ~1x der langsamsten Anfrage
- **N+1 Query Optimierung**: `/api/users` verwendet optimierten JOIN statt separate Queries
- **Subquery-Optimierung**: `/api/departments` verwendet separate Query statt Subquery pro Zeile
- **React Performance**: `useMemo` für berechnete Werte, AbortController für Fetch-Requests
  - Reduzierte Memory-Nutzung bei tausenden von E-Mails
  - Flüssigeres Scrolling und bessere Performance
- **Frontend Performance (Mailclient)**
  - Debug-/Agent-Fetches (127.0.0.1:7242) nur bei `NEXT_PUBLIC_AGENT_INGEST_ENABLED=true`
  - EmailListItem mit React.memo und Custom-Comparator; stabile Callbacks (z. B. useCallback für handleContextMenu)
  - modularizeImports für react-icons (nur genutzte Icons im Bundle)
  - useEmailState: Hilfsfunktionen und Konstanten in `useEmailState.utils.ts` ausgelagert
  - AutomationWorkflowEditor: Nodes und Edges in `AutomationWorkflowEditor/nodes.tsx` und `edges.tsx` ausgelagert
- **Frontend Performance (SCC-Frontend)**
  - Companies-Liste: Client-Cache mit 45 s TTL, weniger redundante API-Calls beim erneuten Besuch
- **Datenbankgrößenberechnung**: Korrekte Berechnung mit `pg_database_size()`
  - Verwendet PostgreSQL-native Funktion `pg_database_size()` für genaue Gesamtgröße
  - Inkludiert alle Datenbank-Objekte (System-Tabellen, Metadaten, WAL-Dateien, Indizes, temporäre Dateien)
  - Konsistente Anzeige zwischen Storage-Usage-Dashboard und Datenbank-Interface
  - Separate Aufschlüsselung für detaillierte Analyse (nur benutzerdefinierte Tabellen im `public` Schema)

### Code-Architektur

#### E-Mail-Fetcher Modulstruktur

Die E-Mail-Abruf-Funktionalität ist in vier Module aufgeteilt für bessere Wartbarkeit und Testbarkeit:

- **`imap-client.ts`** (IMAP-Verbindung und Abruf)
  - Verantwortlichkeiten: IMAP-Verbindungsaufbau, STARTTLS-Handling, Ordner-Öffnung, E-Mail-Suche, Batch-Fetch, Stream-zu-Buffer-Konvertierung
  - Funktionen: `fetchEmailsFromImap(account, companyId)` → `Promise<Map<number, Buffer>>`
  - Exports: `fetchEmailsFromImap`, `EmailAccount` Interface

- **`email-parser.ts`** (Parsing-Logik)
  - Verantwortlichkeiten: Parsing von E-Mail-Buffers mit mailparser, Extraktion von E-Mail-Daten, rohe Attachment-Extraktion
  - Funktionen: `parseEmail(buffer, uid)` → `Promise<FetchedEmail | null>`
  - Exports: `parseEmail`, `FetchedEmail` Interface

- **`attachment-handler.ts`** (Attachment-Verarbeitung)
  - Verantwortlichkeiten: Attachment-Konvertierung, Dateinamen-Sanitization, Speicherung im Dateisystem und Datenbank, Cache-Invalidierung
  - Funktionen: `attachmentContentToBuffer`, `sanitizeFilename`, `saveAttachmentsToFileSystem`, `saveAttachmentsToDatabase`, `invalidateStorageCache`, `formatBytes`
  - Exports: Alle Attachment-Funktionen

- **`email-fetcher.ts`** (Orchestrierung)
  - Verantwortlichkeiten: Koordination zwischen IMAP-Client, Parser und Attachment-Handler, Datenbank-Speicherung, Abteilungszuweisung, Event-Protokollierung
  - Funktionen: `fetchEmailsFromAccount`, `saveEmailsToDatabase`, `fetchEmailsForUser` (öffentliche API)
  - Exports: `fetchEmailsForUser`, `fetchEmailsFromAccount`

**Vorteile:**
- Klare Verantwortlichkeiten: Jedes Modul hat eine eindeutige Aufgabe
- Einfache Tests: Module können isoliert getestet werden
- Wiederverwendbarkeit: IMAP-Client und Parser können unabhängig verwendet werden
- Wartbarkeit: Änderungen an IMAP-Logik, Parsing oder Attachments sind isoliert
- Backward Compatibility: Öffentliche API bleibt unverändert

---

## 🐳 Docker & Datenbank-Setup

### PostgreSQL-Container

Das Projekt verwendet Docker Compose für die PostgreSQL-Datenbank:

- **Container-Name**: `saivaro-postgres-scc`
- **Image**: `postgres:15-alpine`
- **Port**: 5432 (gemappt auf localhost:5432)
- **Datenbank**: `saivaro_scc`
- **Benutzer**: `saivaro`
- **Passwort**: `saivaro_dev_password` (nur für Entwicklung!)
- **Volume**: Persistentes Volume für Datenbank-Daten
- **Health-Check**: Automatische Prüfung mit `pg_isready`

### Container-Verwaltung

- **Container starten**: `docker compose up -d`
- **Container stoppen**: `docker compose down`
- **Container-Status prüfen**: `docker ps --filter "name=saivaro-postgres-scc"`
- **Logs anzeigen**: `docker logs saivaro-postgres-scc`

### Automatischer Start

Der PostgreSQL-Container wird automatisch beim Ausführen von `start-all.ps1` gestartet:
- Prüft, ob Docker verfügbar ist
- Erstellt Container, falls nicht vorhanden
- Startet Container im Hintergrund
- Wartet auf Datenbank-Bereitschaft (3 Sekunden)

### Fehlerbehandlung

Bei Datenbankverbindungsfehlern (`ECONNREFUSED`):
1. Prüfen Sie, ob Docker läuft: `docker ps`
2. Prüfen Sie den Container-Status: `docker ps --filter "name=saivaro-postgres-scc"`
3. Starten Sie den Container manuell: `docker compose up -d`
4. Warten Sie auf Health-Check (ca. 5-10 Sekunden)

## 🚀 Nächste Schritte für Neulinge

1. **Projekt-Setup**
   - Lesen Sie die [SETUP_DATABASE.md](./docs/SETUP_DATABASE.md) Anleitung
   - Folgen Sie der [SETUP_MULTI_TENANT_DEV.md](./docs/SETUP_MULTI_TENANT_DEV.md) Anleitung
   - Stellen Sie sicher, dass Docker installiert und gestartet ist
   - Starten Sie alle Services mit `.\start-all.ps1`

2. **Architektur verstehen**
   - Lesen Sie [ARCHITECTURE_BEFORE.md](./docs/ARCHITECTURE_BEFORE.md)
   - Lesen Sie [DOMAIN_MODEL.md](./docs/DOMAIN_MODEL.md)
   - Lesen Sie [PROVISIONING_FLOW.md](./docs/PROVISIONING_FLOW.md)

3. **Code erkunden**
   - Beginnen Sie mit dem SCC-Backend (`apps/scc/src`)
   - Dann das SCC-Frontend (`apps/scc-frontend/src`)
   - Schließlich den Mailclient (`apps/mailclient/src`)

4. **API testen**
   - Nutzen Sie die Swagger-Dokumentation unter `http://localhost:3001/api/docs`
   - Testen Sie die API-Endpunkte mit Postman oder curl

5. **Frontend erkunden**
   - Öffnen Sie `http://localhost:3002` (SCC-Frontend)
   - Öffnen Sie `http://localhost:3000` (Mailclient)

6. **Production Deployment**
   - Lesen Sie [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) für vollständige Hetzner-Server-Anleitung
   - Enterprise-Security-Härtung: SSH, Kernel, Firewall, Fail2ban
   - PostgreSQL Production-Setup mit SSL und Härtung
   - PM2 Clustering und Zero-Downtime Deployment
   - NGINX mit Security Headers, Rate Limiting, Caching
   - Verschlüsselte Backups und Monitoring

---

## 🚀 Production Deployment

### Hetzner Server Deployment

Das Projekt enthält eine vollständige Deployment-Anleitung für Production-Setup auf Hetzner-Servern:

- **DEPLOYMENT_GUIDE.md**: Schritt-für-Schritt-Anleitung mit 11 Phasen
  - System-Vorbereitung (Deployer-User, SSH-Härtung, Kernel Hardening)
  - PostgreSQL Production-Setup mit SSL und Härtung
  - Node.js, pnpm, PM2 Installation
  - Projekt-Setup und Konfiguration
  - PM2 Clustering und Zero-Downtime Deployment
  - NGINX mit Security Headers, Rate Limiting, Caching
  - SSL-Zertifikat (Let's Encrypt)
  - Verschlüsselte Datenbank-Backups (GPG)
  - Monitoring (PM2 Plus, Sentry, UptimeRobot)
  - Testing & Verification
  - Updates & Maintenance

- **Enterprise-Security-Features**:
  - Dedicated Deployment-User (kein root)
  - SSH-Härtung (Key-Only, Port 2222)
  - Kernel Hardening (sysctl.conf)
  - Automatische Security Updates
  - Fail2ban für SSH und NGINX
  - Firewall-Konfiguration (UFW)
  - PostgreSQL pg_hba.conf Härtung
  - Helmet.js und CSRF-Protection im Backend
  - Security Headers in NGINX
  - Rate Limiting
  - Verschlüsselte Backups

- **Port-Konfiguration**:
  - Dev-Ports: 3010 (Mailclient), 3011 (SCC Backend), 3012 (SCC Frontend)
  - Production-Ports: 3002 (Mailclient), 3100 (SCC Backend), 3003 (SCC Frontend)
  - SSH: Port 2222 (gehärtet)

- **Deployment-Automatisierung**:
  - One-Command Deployment-Script
  - Dependency Security Scan
  - Symlink-basierte Rollback-Strategie
  - Zero-Downtime Reload
  - Health Checks und automatisches Rollback

## 📝 Weitere Dokumentation

- **[CHANGELOG.md](./CHANGELOG.md)**: Vollständige Änderungshistorie
- **[DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)**: Production Deployment auf Hetzner-Server
- **[README.md](./README.md)**: Projekt-Übersicht und Quick Start
- **[docs/](./docs/)**: Ausführliche technische Dokumentation

---

**Stand**: Januar 2026  
**Version**: 1.0.0+

