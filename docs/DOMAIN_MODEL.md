# Domain-Modell

Dieses Dokument beschreibt die zentralen Entitäten und deren Beziehungen im Saivaro Mail System.

## Übersicht

Das System besteht aus zwei logischen Bereichen:
1. **Saivaro Control Center (SCC)**: Zentrale Verwaltung
2. **Mailclient**: Tenant-spezifische Mail-Anwendung

## Entitäten

### 1. Company

Repräsentiert eine Firma (Tenant) im System.

**Attribute:**
- `id` (UUID, Primary Key)
- `name` (String, eindeutig)
- `slug` (String, eindeutig, für Subdomain/URL)
- `status` (Enum: `active`, `suspended`, `inactive`)
- `plan` (String, z. B. `basic`, `premium`, `enterprise`)
- `createdAt` (Timestamp)
- `updatedAt` (Timestamp)
- `metadata` (JSON, optionale zusätzliche Daten)

**Beziehungen:**
- Hat viele `User` (1:N)
- Hat genau eine `CompanyDbConfig` (1:1)

### 2. User

Repräsentiert einen Benutzer, der zu genau einer Firma gehört.

**Attribute:**
- `id` (UUID, Primary Key)
- `companyId` (UUID, Foreign Key → Company)
- `email` (String, eindeutig innerhalb der Company)
- `passwordHash` (String, verschlüsselt)
- `firstName` (String)
- `lastName` (String)
- `role` (Enum: `admin`, `user`, `viewer`)
- `status` (Enum: `active`, `inactive`, `suspended`)
- `lastLoginAt` (Timestamp, nullable)
- `createdAt` (Timestamp)
- `updatedAt` (Timestamp)

**Beziehungen:**
- Gehört zu genau einer `Company` (N:1)

**Hinweis:** Diese Entität existiert in der **Tenant-Datenbank** (nicht in der SCC-DB).

### 3. CompanyDbConfig

Speichert die Datenbankverbindungsdaten für eine Firma. Diese Entität existiert **nur in der SCC-Datenbank** (zentrale Single Source of Truth).

**Attribute:**
- `id` (UUID, Primary Key)
- `companyId` (UUID, Foreign Key → Company, eindeutig)
- `dbHost` (String)
- `dbPort` (Number, default: 5432)
- `dbName` (String)
- `dbUser` (String)
- `dbPassword` (String, verschlüsselt gespeichert)
- `dbSslMode` (String, z. B. `require`, `prefer`, `disable`)
- `provisioningStatus` (Enum: `pending`, `provisioning`, `ready`, `failed`)
- `provisionedAt` (Timestamp, nullable)
- `lastHealthCheck` (Timestamp, nullable)
- `healthStatus` (Enum: `healthy`, `unhealthy`, `unknown`)
- `createdAt` (Timestamp)
- `updatedAt` (Timestamp)

**Beziehungen:**
- Gehört zu genau einer `Company` (1:1)

### 4. SccUser

Repräsentiert einen System-Administrator, der Zugriff auf das Saivaro Control Center hat.

**Attribute:**
- `id` (UUID, Primary Key)
- `email` (String, eindeutig)
- `passwordHash` (String, verschlüsselt)
- `firstName` (String)
- `lastName` (String)
- `role` (Enum: `super_admin`, `admin`, `operator`)
- `status` (Enum: `active`, `inactive`)
- `lastLoginAt` (Timestamp, nullable)
- `createdAt` (Timestamp)
- `updatedAt` (Timestamp)

**Beziehungen:**
- Keine direkte Beziehung zu Companies (über SCC-Interface verwaltet)

**Hinweis:** Diese Entität existiert in der **SCC-Datenbank** (zentrale DB).

## Entity-Relationship-Diagramm (ASCII)

```
┌─────────────────────────────────────────────────────────────┐
│              SCC-Datenbank (Zentral)                        │
│                                                              │
│  ┌──────────────┐         ┌──────────────────┐            │
│  │   Company    │────────▶│ CompanyDbConfig  │            │
│  │              │   1:1   │                  │            │
│  │ - id         │         │ - companyId (FK) │            │
│  │ - name       │         │ - dbHost         │            │
│  │ - slug       │         │ - dbPort         │            │
│  │ - status     │         │ - dbName         │            │
│  │ - plan       │         │ - dbUser         │            │
│  └──────────────┘         │ - dbPassword     │            │
│                           │ - status         │            │
│  ┌──────────────┐         └──────────────────┘            │
│  │   SccUser    │                                         │
│  │              │                                         │
│  │ - id         │                                         │
│  │ - email      │                                         │
│  │ - role       │                                         │
│  └──────────────┘                                         │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ Referenz (companyId)
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│         Tenant-Datenbank (pro Firma, isoliert)              │
│                                                              │
│  ┌──────────────┐                                           │
│  │    User      │                                           │
│  │              │                                           │
│  │ - id         │                                           │
│  │ - companyId  │  (Referenz, nicht FK)                    │
│  │ - email      │                                           │
│  │ - password   │                                           │
│  │ - role       │                                           │
│  └──────────────┘                                           │
│                                                              │
│  ┌──────────────┐                                           │
│  │    Email     │  (später)                                 │
│  │    Folder    │  (später)                                 │
│  │    ...       │                                           │
│  └──────────────┘                                           │
└─────────────────────────────────────────────────────────────┘
```

## Wichtige Design-Entscheidungen

1. **Zentrale vs. Tenant-Datenbanken:**
   - `Company`, `CompanyDbConfig`, `SccUser` → SCC-DB (zentral)
   - `User` (Firmen-User), `Email`, etc. → Tenant-DB (pro Firma)

2. **CompanyDbConfig als Single Source of Truth:**
   - Alle DB-Verbindungsdaten werden zentral in der SCC-DB gespeichert
   - Mailclient-App lädt diese zur Laufzeit (mit Caching)

3. **Keine Foreign Keys zwischen SCC-DB und Tenant-DBs:**
   - `User.companyId` ist nur eine Referenz (UUID), kein echter FK
   - Isolation zwischen Datenbanken

4. **Verschlüsselte Passwörter:**
   - `CompanyDbConfig.dbPassword` muss verschlüsselt gespeichert werden
   - `User.passwordHash` und `SccUser.passwordHash` ebenfalls verschlüsselt

## Erweiterungen (später)

Weitere Entitäten, die später in den Tenant-Datenbanken hinzukommen:
- `Email` (E-Mails)
- `Folder` (Ordner/Postfächer)
- `Attachment` (Anhänge)
- `Contact` (Kontakte)
- `Calendar` (Kalender, optional)




