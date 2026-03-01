# Saivaro Mailclient

Multi-Tenant Mail-Client für Firmen. Jede Firma nutzt ihre eigene isolierte Datenbank.

## Tech-Stack

- **Framework**: Next.js 14+ (App Router)
- **Database**: PostgreSQL (pro Tenant)
- **ORM**: Prisma (für SCC-DB), pg (für Tenant-DBs)
- **Auth**: JWT
- **Caching**: node-cache (für DB-Configs)

## Features

- ✅ **Multi-Tenant-Routing**: Automatische Erkennung der Company über Subdomain, Header oder JWT
- ✅ **Dynamisches DB-Loading**: Lädt DB-Configs aus SCC-DB
- ✅ **Connection-Pooling**: Effiziente DB-Verbindungen pro Company
- ✅ **Tenant-Isolation**: Garantiert, dass Company A niemals Daten von Company B sieht
- ✅ **User-Authentifizierung**: JWT-basierte Auth für Firmen-User
- ✅ **Frontend-UI**: Login-Seite und E-Mail-Liste

## Multi-Tenant-Routing

Die App erkennt die Firma (Tenant) über:

1. **Subdomain**: `acme-corp.localhost:3000` → Company-Slug "acme-corp"
2. **Header**: `X-Company-Id` oder `X-Company-Slug`
3. **JWT-Token**: `companyId` im Token-Payload

Die entsprechende Tenant-Datenbank wird dann dynamisch geladen.

## Setup

### 1. Umgebungsvariablen

Erstelle eine `.env` Datei:

```env
# SCC-Datenbank-Verbindung (zum Laden der Tenant-DB-Configs)
SCC_DATABASE_URL="postgresql://user:password@localhost:5432/saivaro_scc?schema=public"

# JWT Secret
JWT_SECRET="change-this-in-production-min-32-chars"

NODE_ENV=development
```

### 2. Dependencies installieren

```bash
# Vom Root-Verzeichnis
pnpm install

# Oder direkt aus apps/mailclient/
pnpm install
```

### 3. Entwicklungsserver starten

```bash
# Vom Root-Verzeichnis
pnpm --filter mailclient dev

# Oder direkt aus apps/mailclient/
pnpm dev
```

Server läuft auf: `http://localhost:3000`

## Frontend-Seiten

- `/` - Weiterleitung zu Login oder E-Mails
- `/login` - Anmeldeseite für Firmen-User
- `/emails` - E-Mail-Liste (erfordert Login)

## API-Endpoints

### Authentication

- `POST /api/auth/login` - Firmen-User-Login
  - Erfordert: Tenant-Context (Subdomain/Header)
  - Body: `{ "email": "...", "password": "..." }`
  - Response: `{ "access_token": "...", "user": {...} }`

### Emails

- `GET /api/emails` - E-Mails laden
  - Erfordert: Tenant-Context + Auth-Token
  - Response: `{ "emails": [...], "companyId": "..." }`

- `POST /api/emails/fetch` - E-Mails von IMAP-Konten abrufen
  - Erfordert: Tenant-Context + Auth-Token ODER Service-Token
  - Service-Token: Header `x-service-token` + `x-company-id` erforderlich
  - Body: `{ "userId": "..." }` (bei Service-Token-Authentifizierung)
  - Response: `{ "success": true, "totalCount": 5, "results": [...] }`
  - Ruft E-Mails von allen aktiven E-Mail-Konten des Users ab

## Multi-Tenant-Testing

### Option 1: Subdomain (lokal)

Für lokales Testing kannst du `/etc/hosts` anpassen:

```
127.0.0.1 acme-corp.localhost
127.0.0.1 globex.localhost
```

Dann: `http://acme-corp.localhost:3000`

### Option 2: Header

```bash
curl http://localhost:3000/api/emails \
  -H "X-Company-Slug: acme-corp" \
  -H "Authorization: Bearer <token>"
```

### Option 3: JWT-Token

Token muss `companyId` im Payload enthalten.

## Tenant-Datenbank-Setup

Jede Firma benötigt eine eigene PostgreSQL-Datenbank mit:

1. **Users-Tabelle** (für Auth):
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  role VARCHAR(50) DEFAULT 'user',
  status VARCHAR(50) DEFAULT 'active',
  last_login_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

2. **Emails-Tabelle** (Beispiel):
```sql
CREATE TABLE emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  subject VARCHAR(500),
  from_email VARCHAR(255),
  to_email VARCHAR(255),
  body TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  read_at TIMESTAMP
);
```

Die DB-Verbindungsdaten werden in der SCC-DB (`company_db_configs`) gespeichert.

## Cron-Service

Der Mailclient enthält einen separaten Cron-Service für automatisierte Aufgaben:

### Starten des Cron-Service

```bash
# Vom Root-Verzeichnis
cd apps/mailclient
npm run start:cron

# Oder direkt aus apps/mailclient/
npm run start:cron
```

### Konfiguration

Der Cron-Service benötigt folgende Umgebungsvariablen in der `.env`-Datei:

```env
# Service-Token für interne Authentifizierung (erforderlich)
CRON_SERVICE_TOKEN="your-secret-token-here"

# URL des Mailclients (optional, Standard: http://localhost:3000)
MAILCLIENT_URL="http://localhost:3000"

# Refresh-Intervall in Millisekunden (optional, Standard: 300000 = 5 Minuten)
CRON_REFRESH_INTERVAL_MS=300000

# Max. Retry-Versuche bei API-Fehlern (optional, Standard: 3)
CRON_MAX_RETRIES=3

# API-Timeout in Millisekunden (optional, Standard: 30000 = 30 Sekunden)
CRON_API_TIMEOUT_MS=30000
```

### Funktionen

- **E-Mail-Abruf-Automatisierung**: Automatischer E-Mail-Abruf basierend auf `fetch_interval_minutes` in User-Settings
- **Scheduled Automation Rules**: Zeitgesteuerte Ausführung von Automatisierungsregeln
- **Multi-Tenant-Support**: Lädt Jobs für alle Companies aus SCC-Datenbank
- **Job-Management**: Automatisches Erstellen, Aktualisieren und Löschen von Cron-Jobs
- **Health-Check**: Prüft Mailclient-API-Erreichbarkeit vor Start

Siehe `CHANGELOG.md` und `FUNKTIONSÜBERSICHT.md` für detaillierte Informationen.

## Nächste Schritte

Siehe `docs/IMPLEMENTATION_PLAN.md` für den Gesamtplan.

**Stufe 4:** Provisionierungs-API & Terraform-Integration

