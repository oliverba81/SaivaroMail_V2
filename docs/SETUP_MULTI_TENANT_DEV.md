# Setup & Entwicklungsumgebung für Multi-Tenant-Dev

Dieses Dokument beschreibt, wie die Entwicklungsumgebung für das Saivaro Mail Multi-Tenant-System eingerichtet und genutzt wird.

## Voraussetzungen

### System-Anforderungen

- **Node.js**: Version 20.x oder höher (LTS empfohlen)
- **pnpm**: Version 8.x oder höher
  ```bash
  npm install -g pnpm@8
  ```
- **PostgreSQL**: Version 14 oder höher (für lokale Entwicklung)
- **Git**: Für Versionskontrolle

### Optionale Tools

- **Docker & Docker Compose**: Für lokale DB-Container (später)
- **Terraform**: Für Provisionierung (später, Stufe 4+)

## Projekt lokal starten

### 1. Repository klonen und Dependencies installieren

```bash
# Repository klonen (wenn vorhanden)
git clone <repository-url>
cd SaivaroMail_v2

# Dependencies installieren
pnpm install
```

### 2. Umgebungsvariablen einrichten

**SCC-App** (später):
- `.env` Datei in `apps/scc/` anlegen
- Variablen für zentrale SCC-Datenbank

**Mailclient-App** (später):
- `.env` Datei in `apps/mailclient/` anlegen
- Variablen für SCC-DB-Verbindung (zum Laden der Tenant-DB-Configs)

### 3. Datenbanken einrichten

**Zentrale SCC-Datenbank:**
```bash
# TODO: Migrations ausführen für SCC-DB
# pnpm --filter scc db:migrate
```

**Tenant-Datenbanken (für Entwicklung):**
- Werden später über SCC-Interface oder Provisionierungs-API angelegt
- Oder manuell für lokale Tests

### 4. Entwicklungsserver starten

```bash
# Alle Apps im Dev-Modus starten
pnpm dev

# Oder einzelne Apps:
pnpm --filter scc dev
pnpm --filter mailclient dev
```

## Neue Firma im SCC anlegen

**Status:** TODO – Wird in Stufe 2 implementiert

**Geplante Schritte:**
1. SCC-Backend starten
2. Über SCC-UI oder API: Neue Company anlegen
3. DB-Provisionierung auslösen (später automatisch, zunächst Mock)
4. `CompanyDbConfig` wird automatisch erstellt
5. Tenant-DB ist bereit für Nutzung

## Wie das Routing zur richtigen Firmendatenbank funktionieren wird

### Konzept (High-Level)

1. **Request kommt an:**
   - Mailclient-App empfängt Request
   - Identifiziert `companyId` aus:
     - **Subdomain**: `firma1.saivaro-mail.com` → `companyId` aus Subdomain
     - **JWT Token**: `companyId` im Token-Payload
     - **Header**: `X-Company-Id` (für API-Calls)

2. **DB-Config laden:**
   - Middleware/Request-Context lädt `CompanyDbConfig` aus SCC-DB
   - **Caching**: DB-Config wird gecacht (Redis oder In-Memory), um SCC-DB nicht bei jedem Request zu belasten
   - Cache-Invalidierung: Bei Änderungen an `CompanyDbConfig`

3. **Tenant-DB-Client injizieren:**
   - Dynamischer DB-Client wird für diese Request erstellt
   - Verwendet die geladenen Verbindungsdaten
   - Wird in Request-Context/DI-Container verfügbar gemacht

4. **Request verarbeiten:**
   - Alle nachgelagerten Services/Controllers nutzen den Tenant-DB-Client
   - Garantiert: Request für Company A nutzt niemals DB von Company B

5. **Connection Pooling:**
   - DB-Clients werden gepoolt (pro Company)
   - Effiziente Wiederverwendung von Verbindungen

### Beispiel-Flow (später)

```
Request: GET /api/emails
  ↓
Subdomain: acme-corp.saivaro-mail.com
  ↓
Middleware: companyId = "acme-corp" → UUID lookup
  ↓
Load CompanyDbConfig (aus Cache oder SCC-DB)
  ↓
Create/Get Tenant-DB-Client (aus Pool)
  ↓
Controller: Query emails FROM tenant_db.emails WHERE user_id = ...
  ↓
Response: Nur Emails dieser Firma
```

## Lokale Entwicklung mit mehreren Tenant-DBs

**Option 1: Docker Compose**
- Mehrere PostgreSQL-Container für verschiedene Test-Firmen
- Port-Mapping: `5433`, `5434`, etc.

**Option 2: Lokale PostgreSQL-Instanzen**
- Mehrere Datenbanken auf derselben Instanz
- Verschiedene Datenbanknamen: `tenant_acme`, `tenant_globex`, etc.

**Option 3: Separate PostgreSQL-Container**
- Jede Test-Firma bekommt eigenen Container
- Spiegelt Produktions-Setup (eigener DB-Server pro Firma)

## Troubleshooting

**Problem:** Tenant-DB-Verbindung schlägt fehl
- Prüfe `CompanyDbConfig` in SCC-DB
- Prüfe Netzwerk/Port-Zugriff
- Prüfe Credentials (verschlüsselt gespeichert)

**Problem:** Falsche Daten werden geladen
- Prüfe `companyId`-Routing (Subdomain/JWT)
- Prüfe Cache (möglicherweise veraltete DB-Config)
- Prüfe Tenant-DB-Client-Isolation

## Nächste Schritte

Siehe `IMPLEMENTATION_PLAN.md` für die geplante Implementierungsreihenfolge.




