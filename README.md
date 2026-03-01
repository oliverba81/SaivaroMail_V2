# Saivaro Mail v2

**Saivaro Mail – Multi-Tenant SaaS-Mailclient + Saivaro Control Center (SCC)**

## 🎯 Überblick

Saivaro Mail ist ein Multi-Tenant SaaS-Mailclient für Firmen. Das System besteht aus zwei logischen Anwendungen:

1. **Mailclient** (`apps/mailclient`): Für Firmen-User zum Bearbeiten von E-Mails
2. **Saivaro Control Center (SCC)** (`apps/scc`): Backend-API für Verwaltung von Firmen, Datenbank-Provisionierung und System-Management
3. **SCC-Frontend** (`apps/scc-frontend`): Web-UI für das SCC (Admin-Interface)

## 🏗️ Architektur

- **Multi-Tenant**: Jede Firma erhält eine eigene Datenbank (oder eigenen DB-Server)
- **Monorepo**: Turborepo-basiertes Multi-App-Repository mit pnpm Workspaces
- **Zentrale SCC-Datenbank**: Single Source of Truth für Companies und DB-Verbindungsdaten
- **Dynamisches DB-Routing**: Mailclient-App lädt zur Laufzeit die korrekte Firmendatenbank
- **Sichere Verschlüsselung**: DB-Passwörter werden mit AES-256-GCM verschlüsselt gespeichert

## Projektstruktur

```
.
├── apps/
│   ├── scc/              # Saivaro Control Center (Backend-API)
│   ├── scc-frontend/     # Saivaro Control Center (Frontend-UI)
│   └── mailclient/       # Mailclient-App
├── packages/
│   └── shared/           # Shared Code (Types, Utilities)
├── docs/                 # Dokumentation
└── ...
```

## Dokumentation

Ausführliche Dokumentation befindet sich im `docs/` Verzeichnis:

- **[ARCHITECTURE_BEFORE.md](./docs/ARCHITECTURE_BEFORE.md)**: Beschreibung der Ausgangslage (monolithische Architektur)
- **[DOMAIN_MODEL.md](./docs/DOMAIN_MODEL.md)**: Domain-Modell mit Entitäten und Beziehungen
- **[SETUP_MULTI_TENANT_DEV.md](./docs/SETUP_MULTI_TENANT_DEV.md)**: Setup-Anleitung für die Entwicklungsumgebung
- **[PROVISIONING_FLOW.md](./docs/PROVISIONING_FLOW.md)**: Beschreibung des DB-Provisionierungs-Flows
- **[IMPLEMENTATION_PLAN.md](./docs/IMPLEMENTATION_PLAN.md)**: Schritt-für-Schritt-Implementierungsplan

## 💾 Backup & Wiederherstellung

Das Projekt enthält automatisierte Backup- und Restore-Scripts:

- **`backup.ps1`** - Erstellt ein komprimiertes Backup (~50-200 MB, ~30 Sekunden)
- **`restore.ps1`** - Stellt ein Backup interaktiv wieder her
- **[BACKUP_README.md](./BACKUP_README.md)** - Ausführliche Dokumentation

**Schnellstart:**
```powershell
# Backup erstellen
.\backup.ps1

# Backup wiederherstellen
.\restore.ps1
```

Backups werden nach `X:\Backups\Cursor-Projekte\SeivaroMail_v2` gespeichert und automatisch nach 30 Tagen bereinigt.

## Tech-Stack

- **Runtime**: Node.js 20+ (LTS)
- **Package Manager**: pnpm 8+
- **Monorepo**: Turborepo
- **Language**: TypeScript
- **Code Quality**: ESLint + Prettier + EditorConfig

### Geplante Tech-Stack (später)

- **Backend (SCC)**: NestJS + Prisma/Drizzle + PostgreSQL
- **Backend (Mailclient)**: Next.js API Routes oder Express
- **Frontend**: Next.js 14+ (App Router) + React
- **Database**: PostgreSQL
- **Provisionierung**: Terraform + Hetzner Provider

## Setup

### Voraussetzungen

- Node.js 20.x oder höher
- pnpm 8.x oder höher
- PostgreSQL 14+ (für lokale Entwicklung)

### Installation

```bash
# Dependencies installieren
pnpm install

# Entwicklungsserver starten (später, wenn Apps vorhanden)
pnpm dev
```

## ✅ Status

**Aktuell:** Alle Hauptfunktionen implementiert!

- ✅ **Stufe 1**: Monorepo & Basis-Struktur
- ✅ **Stufe 2**: SCC-Backend mit NestJS, Prisma, Auth & Companies-API
- ✅ **Stufe 3**: Mailclient-App mit Next.js, Multi-Tenant-Routing
- ✅ **Stufe 4**: Provisionierungs-API (Mock)
- ✅ **Stufe 5**: Security (Verschlüsselung), API-Dokumentation, Health-Checks
- ✅ **Stufe 6**: SCC-Frontend-UI (Login, Companies-Liste, DB-Provisionierung)
- ✅ **Stufe 7**: Shared Package (gemeinsame Types & Utilities)
- ✅ **Stufe 8**: Company-Management über UI (Erstellen, Bearbeiten, Löschen)
- ✅ **Stufe 9**: Erweiterte Frontend-Features (Suche, Filter, Sortierung, Pagination)
- ✅ **Stufe 10**: Mailclient-Frontend-UI (Login, E-Mail-Liste)

Siehe [IMPLEMENTATION_PLAN.md](./docs/IMPLEMENTATION_PLAN.md) für Details.

## 🚀 Quick Start

### Voraussetzungen

- **Node.js** 20+ (LTS empfohlen)
- **pnpm** 8+ (`npm install -g pnpm`)
- **PostgreSQL** 14+ (oder Docker für Container)
- **Docker Desktop** (optional, für lokale PostgreSQL-Container)

### Setup

```bash
# 1. Dependencies installieren
pnpm install

# 2. PostgreSQL-Container starten (mit Docker)
docker compose up -d

# 3. SCC-App: Umgebungsvariablen einrichten
cd apps/scc
# .env Datei erstellen (siehe apps/scc/.env.example)
# Wichtig: ENCRYPTION_KEY setzen (min. 32 Zeichen)

# 4. Datenbank einrichten
pnpm db:generate
pnpm db:migrate
pnpm db:seed

# 5. Entwicklungsserver starten
pnpm dev
```

**Standard-Login nach Seeding:**
- Email: `admin@saivaro.local`
- Passwort: `admin123` ⚠️ **Bitte nach erstem Login ändern!**

**Wichtige URLs:**
- SCC-API: `http://localhost:3001/api`
- SCC-Frontend: `http://localhost:3002`
- Mailclient: `http://localhost:3000`
- API-Dokumentation (Swagger): `http://localhost:3001/api/docs`
- Health-Check: `http://localhost:3001/api/health`

### Schnellstart (Windows)

**Alle Services auf einmal starten:**

```powershell
# PowerShell (empfohlen)
.\start-all.ps1

# Oder Batch-Datei
start-all.bat
```

Dies startet automatisch:
- PostgreSQL-Container (Docker)
- SCC-Backend (Port 3001)
- SCC-Frontend (Port 3002)
- Mailclient (Port 3000)

**Services stoppen:**

```powershell
# PowerShell (empfohlen)
.\stop-all.ps1

# Oder Batch-Datei
stop-all.bat
```

**Ports prüfen/beenden:**

```powershell
# Ports prüfen
.\check-ports.ps1

# Ports freigeben (beendet Prozesse auf 3000, 3001, 3002)
.\kill-ports.ps1
```

Siehe [apps/scc/README.md](./apps/scc/README.md) und [docs/SETUP_DATABASE.md](./docs/SETUP_DATABASE.md) für Details.

## 📋 Features

### SCC (Saivaro Control Center)

- ✅ **Authentication**: JWT-basierte Authentifizierung
- ✅ **Company Management**: CRUD-Operationen für Firmen
- ✅ **DB-Provisionierung**: Mock-Provisionierung mit fiktiven DB-Daten
- ✅ **Verschlüsselung**: AES-256-GCM für DB-Passwörter
- ✅ **API-Dokumentation**: Swagger/OpenAPI unter `/api/docs`
- ✅ **Health-Checks**: API- und DB-Health-Monitoring

### Mailclient

- ✅ **Multi-Tenant-Routing**: Erkennung über Subdomain, Header oder JWT
- ✅ **Dynamisches DB-Loading**: Lädt Tenant-DB-Configs aus SCC-DB
- ✅ **Connection-Pooling**: Effiziente DB-Verbindungen pro Company
- ✅ **Isolation**: Garantiert, dass Company A niemals Daten von Company B sieht
- ✅ **Ticket-ID System**: Eindeutige Ticket-IDs für E-Mail-Konversationen (Format: M + JJMMTT + 5-stelliger Zähler)
- ✅ **Konversations-Threading**: Automatische Gruppierung von E-Mails mit gleicher Ticket-ID
- ✅ **Thread-View Toggle**: Flexibler Thread-View-Modus für alle E-Mails (aktivierbar über Button in der Liste)
- ✅ **Gmail-ähnliche Gruppierung**: Konversationen werden in der Liste gruppiert und erweiterbar angezeigt
- ✅ **WhatsApp-ähnliche Thread-Ansicht**: Chronologische Darstellung aller Nachrichten einer Konversation
- ✅ **Manuelle Ticket-ID-Verwaltung**: Regenerieren, manuelles Bearbeiten und Kopieren von Ticket-IDs
- ✅ **Automatische Ticket-ID-Übernahme**: Beim Antworten/Weiterleiten wird die Ticket-ID automatisch übernommen
- ✅ **Cron-Service**: Automatischer E-Mail-Abruf und zeitgesteuerte Automatisierungsregeln
- ✅ **E-Mail-Abruf-Automatisierung**: Automatischer Abruf basierend auf `fetch_interval_minutes` in User-Settings
- ✅ **Service-Token-Authentifizierung**: Sichere interne Authentifizierung für Cron-Service

## 🔐 Sicherheit

- **Verschlüsselung**: DB-Passwörter werden mit AES-256-GCM verschlüsselt
- **JWT-Auth**: Sichere Token-basierte Authentifizierung
- **Tenant-Isolation**: Strikte Trennung zwischen Firmen-Datenbanken
- **Input-Validation**: class-validator für alle API-Inputs

## 📚 Dokumentation

- **[ARCHITECTURE_BEFORE.md](./docs/ARCHITECTURE_BEFORE.md)**: Beschreibung der Ausgangslage
- **[DOMAIN_MODEL.md](./docs/DOMAIN_MODEL.md)**: Domain-Modell mit Entitäten
- **[SETUP_MULTI_TENANT_DEV.md](./docs/SETUP_MULTI_TENANT_DEV.md)**: Setup-Anleitung
- **[PROVISIONING_FLOW.md](./docs/PROVISIONING_FLOW.md)**: DB-Provisionierungs-Flow
- **[IMPLEMENTATION_PLAN.md](./docs/IMPLEMENTATION_PLAN.md)**: Implementierungsplan
- **[SETUP_DATABASE.md](./docs/SETUP_DATABASE.md)**: Datenbank-Setup-Anleitung

## 🧪 Testing

```bash
# Tests ausführen (wenn implementiert)
pnpm test

# Linting
pnpm lint
```

## 🚧 Nächste Schritte (Optional)

- **Terraform-Integration**: Echte Hetzner-Provisionierung
- **Umfassende Tests**: Integration- und E2E-Tests
- **Monitoring**: Erweiterte Health-Checks für Tenant-DBs
- **Frontend**: SCC-UI für bessere UX

## Lizenz

Proprietär

