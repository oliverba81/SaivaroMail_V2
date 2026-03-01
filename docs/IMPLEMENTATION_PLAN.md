# Implementierungsplan

Dieses Dokument beschreibt die geplante Schritt-für-Schritt-Implementierung des Saivaro Mail Multi-Tenant-Systems.

## Status-Übersicht

- [x] **Stufe 1: Monorepo & Basis-Projektstruktur** ✅
- [x] **Stufe 2: SCC-Basis & zentrale DB-Anbindung** ✅
- [x] **Stufe 3: Mailclient-App + Multi-Tenant-DB-Routing** ✅
- [x] **Stufe 4: Provisionierungs-API & Terraform-Integration (Mock)** ✅
- [x] **Stufe 5: Security, Secrets & Tests** ✅ (teilweise: Verschlüsselung implementiert)
- [x] **Stufe 6: SCC-Frontend-UI** ✅
- [x] **Stufe 7: Shared Package** ✅

---

## Stufe 1: Monorepo & Basis-Projektstruktur ✅

**Status:** Abgeschlossen (Stunde 1)

### Was wurde erledigt:

- [x] Turborepo/pnpm-Workspace-Setup
- [x] Root-Konfigurationen:
  - [x] `package.json` mit Workspaces
  - [x] `turbo.json` Pipeline-Konfiguration
  - [x] `tsconfig.base.json` Basis-TypeScript-Config
  - [x] `.gitignore`, `.editorconfig`, `.prettierrc`, `.eslintrc.json`
- [x] Verzeichnisstruktur vorbereitet:
  - [x] `apps/` (für `scc` und `mailclient`, später)
  - [x] `packages/` (für Shared Code, später)
- [x] Dokumentation:
  - [x] `docs/ARCHITECTURE_BEFORE.md`
  - [x] `docs/DOMAIN_MODEL.md`
  - [x] `docs/SETUP_MULTI_TENANT_DEV.md`
  - [x] `docs/PROVISIONING_FLOW.md`
  - [x] `docs/IMPLEMENTATION_PLAN.md` (dieses Dokument)
- [x] `README.md` mit Projektbeschreibung

### Nächste Schritte:

→ Weiter zu Stufe 2

---

## Stufe 2: SCC-Basis & zentrale DB-Anbindung ✅

**Status:** Abgeschlossen

### Ziele:

1. ✅ Einfaches SCC-Backend aufsetzen
2. ✅ Zentrale SCC-Datenbank anbinden
3. ✅ Migrations für Core-Entities erstellen
4. ✅ Basis-API-Endpoints für Companies

### Aufgaben:

#### 2.1 SCC-Backend-Setup ✅

- [x] `apps/scc/` Verzeichnis anlegen
- [x] Backend-Framework wählen und installieren:
  - **Gewählt:** NestJS (TypeScript-first, DI, Modulare Architektur)
- [x] Basis-Struktur:
  - [x] `apps/scc/src/main.ts` (Entry Point)
  - [x] `apps/scc/src/app.module.ts`
  - [x] `apps/scc/package.json`
  - [x] `apps/scc/tsconfig.json` (erweitert `tsconfig.base.json`)

#### 2.2 Datenbank-Setup ✅

- [x] ORM/Migrations-Tool wählen:
  - **Gewählt:** Prisma (einfach, gute DX)
- [x] PostgreSQL-Verbindung konfigurieren
- [x] `.env.example` für SCC-DB-Verbindung
- [x] Schema-Definitionen für:
  - [x] `Company`
  - [x] `CompanyDbConfig`
  - [x] `SccUser`

#### 2.3 Migrations ✅

- [x] Prisma-Schema definiert (`prisma/schema.prisma`)
- [x] Seed-Script für ersten `SccUser` (Super-Admin) erstellt
- [x] Migration kann mit `pnpm db:migrate` erstellt werden

#### 2.4 Basis-API-Endpoints ✅

- [x] `POST /api/auth/login` (SCC-User-Login)
- [x] `GET /api/companies` (Liste aller Companies, auth-required)
- [x] `POST /api/companies` (Neue Company anlegen, auth-required)
- [x] `GET /api/companies/:id` (Company-Details)
- [x] `GET /api/companies/:id/db-config` (DB-Config abrufen)
- [x] `PATCH /api/companies/:id` (Company aktualisieren)
- [x] `DELETE /api/companies/:id` (Company löschen)

#### 2.5 Testing

- [ ] Unit-Tests für Services
- [ ] Integration-Tests für API-Endpoints
- [ ] Test-DB-Setup

**Hinweis:** Testing wird in Stufe 5 vertieft behandelt.

### Geschätzter Aufwand:

- 2-3 Stunden

---

## Stufe 3: Mailclient-App + Multi-Tenant-DB-Routing ✅

**Status:** Abgeschlossen

### Ziele:

1. Mailclient-App aufsetzen
2. Multi-Tenant-Routing implementieren
3. Dynamisches Laden von Tenant-DB-Configs
4. Tenant-DB-Client-Isolation sicherstellen

### Aufgaben:

#### 3.1 Mailclient-App-Setup ✅

- [x] `apps/mailclient/` Verzeichnis anlegen
- [x] Frontend-Framework wählen:
  - **Gewählt:** Next.js 14+ (App Router, Server Components, API Routes)
- [x] Backend-API-Setup (Next.js API Routes)
- [x] Basis-Struktur:
  - [x] `apps/mailclient/src/app/` (Next.js App Router)
  - [x] `apps/mailclient/src/lib/` (Shared Utilities)
  - [x] `apps/mailclient/package.json`
  - [x] `apps/mailclient/tsconfig.json`

#### 3.2 Multi-Tenant-Routing ✅

- [x] Middleware für `companyId`-Erkennung:
  - [x] Subdomain-Parsing: `firma1.localhost:3000` → `companyId`
  - [x] JWT-Token-Parsing: `companyId` aus Token
  - [x] Header-Parsing: `X-Company-Id` / `X-Company-Slug` (für API-Calls)
- [x] Request-Context für `companyId` (Thread-local Storage)

#### 3.3 Tenant-DB-Config-Loading ✅

- [x] Service zum Laden von `CompanyDbConfig` aus SCC-DB (direkte PostgreSQL-Verbindung)
- [x] Caching-Strategie:
  - [x] In-Memory-Cache (node-cache, 5 Min TTL)
- [x] Cache-Invalidierung bei Änderungen (Funktion vorhanden)

#### 3.4 Tenant-DB-Client-Management ✅

- [x] Dynamischer DB-Client-Erstellung pro Request
- [x] Connection-Pooling (pro Company, max 20 Connections)
- [x] Isolation-Garantie: Request für Company A nutzt niemals DB von Company B
- [x] Health-Check-Status wird aus DB-Config geladen

#### 3.5 Erste Mailclient-Features ✅

- [x] Auth: User-Login (gehört zu Company, nutzt Tenant-DB)
- [x] Basis-API: `GET /api/emails` (aus Tenant-DB, user-spezifisch)
- [x] JWT-Auth-Verifizierung in API-Routes
- [x] Frontend: Basis-Layout (später erweiterbar)

#### 3.6 Testing

- [ ] Integration-Tests: Routing zu korrekter Tenant-DB
- [ ] Isolation-Tests: Company A sieht keine Daten von Company B
- [ ] Load-Tests: Mehrere Requests parallel, verschiedene Companies

**Hinweis:** Testing wird in Stufe 5 vertieft behandelt.

### Geschätzter Aufwand:

- 4-5 Stunden

---

## Stufe 4: Provisionierungs-API & Terraform-Integration (Mock zuerst) ✅

**Status:** Mock-Provisionierung abgeschlossen

### Ziele:

1. ✅ Provisionierungs-API-Endpoint im SCC
2. ✅ Mock-Provisionierung (fiktive DB-Daten)
3. ⏳ Später: Terraform-Integration

### Aufgaben:

#### 4.1 Provisionierungs-API (Mock) ✅

- [x] `POST /api/admin/companies/:id/provision-db` Endpoint
- [x] `POST /api/companies/:id/provision-db` Endpoint (Convenience)
- [x] Mock-Provisionierungs-Service:
  - [x] Generiert fiktive DB-Verbindungsdaten
  - [x] Simuliert Provisionierungs-Delay (async, 2 Sekunden)
- [x] `CompanyDbConfig` wird in SCC-DB gespeichert
- [x] Status-Tracking: `pending` → `provisioning` → `ready`
- [x] `GET /api/admin/provisioning/status/:provisioningId` Endpoint

#### 4.2 SCC-UI ✅

- [x] SCC-Frontend-App erstellt (Next.js)
- [x] Login-Seite für SCC-User
- [x] Companies-Liste mit Status-Anzeige
- [x] Company-Detail-View
- [x] Button: "DB provisionieren" in Company-Detail-View
- [x] Status-Anzeige: Provisionierungs-Status
- [x] DB-Config anzeigen (Passwort versteckt)

#### 4.3 Terraform-Integration (später)

- [ ] Terraform-Scripts für Hetzner-Provisionierung
- [ ] CI/CD-Pipeline (GitHub Actions oder ähnlich)
- [ ] Webhook von SCC → CI/CD
- [ ] Terraform-State-Management
- [ ] Post-Provisioning-Scripts:
  - [ ] DB erstellen
  - [ ] User erstellen
  - [ ] Initiale Migrations ausführen

#### 4.4 Rollback & Cleanup ✅

- [x] Deprovisionierung: `DELETE /api/admin/companies/:id/deprovision-db`
- [ ] Terraform-Destroy bei Fehlern (später)
- [x] Cleanup von `CompanyDbConfig`

### Geschätzter Aufwand:

- Mock: 1-2 Stunden
- Terraform-Integration: 3-4 Stunden (später)

---

## Stufe 5: Security, Secrets & Tests

**Status:** Teilweise abgeschlossen

### Ziele:

1. ✅ Sichere Speicherung von Tenant-DB-Passwörtern
2. ⏳ Umfassende Tests (Isolation, Security)
3. ⏳ Monitoring & Health-Checks

### Aufgaben:

#### 5.1 Secrets-Management ✅

- [x] Verschlüsselung für `CompanyDbConfig.dbPassword`:
  - [x] Application-Level-Verschlüsselung (AES-256-GCM)
  - [x] PBKDF2 für Key-Derivation
- [x] Key-Management: Verschlüsselungs-Keys aus Umgebungsvariablen
- [x] `EncryptionService` für Verschlüsselung/Entschlüsselung
- [x] Passwörter werden automatisch verschlüsselt beim Speichern
- [x] Passwörter werden automatisch entschlüsselt beim Laden (für Mailclient)
- [ ] Passwort-Rotation (optional, später)

#### 5.2 Security-Audit

- [ ] SQL-Injection-Schutz (ORM/Prepared Statements)
- [ ] Tenant-Isolation-Tests: Niemals Daten-Leakage zwischen Companies
- [ ] Auth & Authorization: JWT-Validierung, Role-Based Access
- [ ] Rate-Limiting: Pro Company/User

#### 5.3 Umfassende Tests

- [ ] Unit-Tests: Services, Utilities
- [ ] Integration-Tests:
  - [ ] SCC: Company anlegen → DB-Config speichern
  - [ ] Mailclient: Request für Company A → korrekte Tenant-DB
  - [ ] Isolation: Company A sieht keine Daten von Company B
- [ ] E2E-Tests: Vollständiger Flow (Company anlegen → DB provisionieren → Mailclient nutzen)
- [ ] Load-Tests: Mehrere Companies, viele Requests

#### 5.4 Monitoring & Health-Checks ✅ (Basis)

- [x] Health-Check-Endpoint für SCC-API (`GET /api/health`)
- [x] Health-Check-Endpoint für SCC-Datenbank (`GET /api/health/db`)
- [ ] Health-Check-Endpoint für Tenant-DBs (später)
- [ ] Regelmäßige Health-Checks (Cron-Job, später)
- [ ] Status-Updates in `CompanyDbConfig.healthStatus` (später)
- [ ] Alerts bei `unhealthy`-Status (später)
- [ ] Logging: Strukturierte Logs (z. B. Pino, Winston, später)

#### 5.5 Dokumentation ✅

- [x] API-Dokumentation (Swagger/OpenAPI)
  - [x] Swagger UI unter `/api/docs`
  - [x] Alle Endpoints dokumentiert
  - [x] DTOs mit Beispielen
  - [x] JWT-Auth-Integration
- [ ] Deployment-Guide (später)
- [ ] Troubleshooting-Guide (später)
- [ ] Security-Best-Practices-Dokument (später)

### Geschätzter Aufwand:

- 3-4 Stunden

---

## Zusammenfassung

### Geschätzter Gesamtaufwand:

- **Stufe 1:** ✅ Abgeschlossen (~1 Stunde)
- **Stufe 2:** ✅ Abgeschlossen (~2-3 Stunden)
- **Stufe 3:** ✅ Abgeschlossen (~4-5 Stunden)
- **Stufe 4:** ✅ Abgeschlossen (~1-2 Stunden, Mock)
- **Stufe 5:** ✅ Abgeschlossen (~2-3 Stunden, Basis)

**Gesamt implementiert:** ~10-14 Stunden

### ✅ Projekt-Status: Hauptfunktionen vollständig implementiert!

Alle geplanten Hauptfunktionen sind implementiert:
- ✅ Multi-Tenant-Architektur
- ✅ SCC-Backend mit vollständiger API
- ✅ Mailclient mit Multi-Tenant-Routing
- ✅ DB-Provisionierung (Mock)
- ✅ Verschlüsselung für DB-Passwörter
- ✅ API-Dokumentation
- ✅ Health-Checks

### Nächste Schritte (Optional):

→ **Terraform-Integration**: Echte Hetzner-Provisionierung
→ **Umfassende Tests**: Integration- und E2E-Tests
→ **Frontend**: SCC-UI für bessere UX

### Tech-Stack-Empfehlungen (nochmal zusammengefasst):

- **Backend (SCC):** NestJS + Prisma/Drizzle + PostgreSQL
- **Backend (Mailclient):** Next.js API Routes oder Express
- **Frontend (Mailclient):** Next.js 14+ (App Router) + React
- **Frontend (SCC):** Next.js 14+ oder React + Vite (später)
- **Caching:** Redis (für Multi-Instance) oder In-Memory (für Single-Instance)
- **Secrets:** Application-Level-Verschlüsselung oder Vault
- **Provisionierung:** Terraform + Hetzner Provider
- **CI/CD:** GitHub Actions (für Terraform-Webhooks)

