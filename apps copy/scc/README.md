# Seivaro Control Center (SCC)

Backend-API für das Seivaro Control Center - Verwaltung von Firmen, Datenbank-Provisionierung und System-Management.

## Tech-Stack

- **Framework**: NestJS 10+
- **ORM**: Prisma 5+
- **Database**: PostgreSQL
- **Auth**: JWT (Passport)
- **Validation**: class-validator

## Setup

### 1. Umgebungsvariablen

Erstelle eine `.env` Datei im `apps/scc/` Verzeichnis:

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/seivaro_scc?schema=public"

# JWT
JWT_SECRET="change-this-in-production-min-32-chars"
JWT_EXPIRES_IN="24h"

# Server
PORT=3001
NODE_ENV=development
```

### 2. Datenbank einrichten

```bash
# Prisma Client generieren
pnpm db:generate

# Migration erstellen und ausführen
pnpm db:migrate

# Seed-Daten einfügen (erstellt Super-Admin)
pnpm db:seed
```

**Standard-Login nach Seeding:**
- Email: `admin@seivaro.local`
- Passwort: `admin123` (bitte nach erstem Login ändern!)

### 3. Entwicklungsserver starten

```bash
# Vom Root-Verzeichnis
pnpm --filter scc dev

# Oder direkt aus apps/scc/
pnpm dev
```

Server läuft auf: `http://localhost:3001/api`

## API-Endpoints

### Authentication

- `POST /api/auth/login` - SCC-User-Login
  ```json
  {
    "email": "admin@seivaro.local",
    "password": "admin123"
  }
  ```
  Response:
  ```json
  {
    "access_token": "eyJhbGc...",
    "user": { "id": "...", "email": "...", "role": "super_admin" }
  }
  ```

### Companies (Auth-required)

Alle Endpoints benötigen JWT-Token im Header: `Authorization: Bearer <token>`

- `GET /api/companies` - Liste aller Companies
- `POST /api/companies` - Neue Company anlegen
  ```json
  {
    "name": "Example Corp",
    "slug": "example-corp",
    "status": "active",
    "plan": "basic"
  }
  ```
- `GET /api/companies/:id` - Company-Details
- `PATCH /api/companies/:id` - Company aktualisieren
- `DELETE /api/companies/:id` - Company löschen
- `GET /api/companies/:id/db-config` - DB-Config abrufen (ohne Passwort)

## Datenbank-Schema

Siehe `prisma/schema.prisma` für das vollständige Schema.

**Core-Entities:**
- `Company` - Firmen (Tenants)
- `CompanyDbConfig` - DB-Verbindungsdaten pro Firma
- `SccUser` - System-Administratoren

## Scripts

- `pnpm dev` - Entwicklungsserver (Watch-Mode)
- `pnpm build` - Production-Build
- `pnpm start` - Production-Server starten
- `pnpm lint` - ESLint ausführen
- `pnpm test` - Tests ausführen
- `pnpm db:generate` - Prisma Client generieren
- `pnpm db:migrate` - Migration erstellen/ausführen
- `pnpm db:push` - Schema direkt pushen (Dev)
- `pnpm db:studio` - Prisma Studio öffnen
- `pnpm db:seed` - Seed-Daten einfügen

## Nächste Schritte

Siehe `docs/IMPLEMENTATION_PLAN.md` für den Gesamtplan.

**Stufe 3:** Mailclient-App + Multi-Tenant-DB-Routing

