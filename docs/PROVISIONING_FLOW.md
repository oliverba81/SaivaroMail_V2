# Provisionierungs-Flow

Dieses Dokument beschreibt den geplanten Flow für die automatisierte Provisionierung von Datenbank-Servern und Datenbanken für neue Firmen (Tenants).

## Übersicht

Wenn eine neue Firma im Saivaro Control Center angelegt wird, soll automatisch (oder auf Knopfdruck) eine dedizierte Datenbank für diese Firma provisioniert werden. Dies kann entweder:
- Ein eigener DB-Server (Hetzner VM mit PostgreSQL) sein, oder
- Eine neue Datenbank auf einem bestehenden DB-Server (PostgreSQL-Container)

## High-Level Flow

```
┌─────────────────────────────────────────────────────────────┐
│  SCC (Saivaro Control Center)                                │
│                                                               │
│  Admin klickt: "Neue Firma anlegen"                          │
│  oder                                                         │
│  API-Call: POST /admin/companies (mit Provisionierung)      │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  SCC-Backend                                                 │
│                                                               │
│  1. Company-Entity in SCC-DB anlegen                        │
│  2. Provisionierungs-Request erstellen                       │
│  3. Provisionierungs-API aufrufen                            │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  Provisionierungs-Service (später: CI/CD Pipeline)         │
│                                                               │
│  - Empfängt: companyId, plan, region, etc.                  │
│  - Startet Terraform-Execution                               │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  Terraform (Hetzner Provider)                               │
│                                                               │
│  1. Hetzner VM erstellen (falls eigener Server)             │
│  2. PostgreSQL installieren & konfigurieren                 │
│  3. Firewall-Regeln setzen                                   │
│  4. ODER: PostgreSQL-Container auf bestehendem Server       │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  Post-Provisioning Scripts                                  │
│                                                               │
│  1. Datenbank erstellen: CREATE DATABASE tenant_<uuid>;    │
│  2. DB-User erstellen: CREATE USER tenant_<uuid>;          │
│  3. Berechtigungen setzen: GRANT ALL ON DATABASE ...        │
│  4. Initiale Migrations ausführen (Schema anlegen)          │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  Provisionierungs-Service                                   │
│                                                               │
│  - Sammelt DB-Verbindungsdaten                              │
│  - Meldet zurück an SCC-Backend                             │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  SCC-Backend                                                 │
│                                                               │
│  - Speichert CompanyDbConfig in SCC-DB                      │
│  - Status: provisioning → ready                             │
│  - Optional: Health-Check starten                           │
└─────────────────────────────────────────────────────────────┘
```

## Provisionierungs-API (Konzept)

### Endpoint

```
POST /api/provision/database
```

### Eingabe (Request Body)

```typescript
interface ProvisionDatabaseRequest {
  companyId: string;           // UUID der Company
  plan: 'basic' | 'premium' | 'enterprise';
  region?: string;              // z. B. 'nbg1', 'fsn1' (Hetzner)
  dbServerType?: 'dedicated' | 'shared';
  // Optional: Spezifische Anforderungen
  customConfig?: {
    dbVersion?: string;         // z. B. '15'
    storageSize?: number;        // GB
  };
}
```

### Ausgabe (Response)

```typescript
interface ProvisionDatabaseResponse {
  success: boolean;
  companyId: string;
  provisioningId: string;       // Tracking-ID
  status: 'pending' | 'provisioning' | 'ready' | 'failed';
  dbConfig?: {
    dbHost: string;
    dbPort: number;
    dbName: string;
    dbUser: string;
    dbPassword: string;          // Nur einmalig zurückgegeben, dann verschlüsselt gespeichert
    dbSslMode: string;
  };
  error?: {
    code: string;
    message: string;
  };
  estimatedCompletionTime?: string; // ISO 8601
}
```

### Status-Endpoint (Polling)

```
GET /api/provision/status/:provisioningId
```

**Response:**
```typescript
interface ProvisionStatusResponse {
  provisioningId: string;
  status: 'pending' | 'provisioning' | 'ready' | 'failed';
  progress?: number;            // 0-100
  dbConfig?: CompanyDbConfig;   // Nur wenn status === 'ready'
  error?: {
    code: string;
    message: string;
  };
}
```

## Implementierungs-Phasen

### Phase 1: Mock-Provisionierung (Stufe 4)

- Provisionierungs-API existiert, gibt aber nur **fiktive DB-Daten** zurück
- Kein echter Terraform-Call
- Für Entwicklung und Tests ausreichend
- `CompanyDbConfig` wird trotzdem korrekt in SCC-DB gespeichert

### Phase 2: Terraform-Integration (später)

- Echter Terraform-Call über CI/CD Pipeline (z. B. GitHub Actions)
- Webhook von SCC-Backend → GitHub Actions Workflow
- Terraform erstellt Hetzner-Ressourcen
- Scripts führen Post-Provisioning aus
- DB-Config wird zurückgemeldet

### Phase 3: Asynchrone Provisionierung

- Provisionierung läuft asynchron (kann Minuten dauern)
- Webhook/Callback von Provisionierungs-Service an SCC-Backend
- SCC zeigt Status in UI an
- Email-Benachrichtigung bei Erfolg/Fehler

## Sicherheit

### Passwort-Generierung

- Starke, zufällige Passwörter pro Tenant-DB
- Mindestens 32 Zeichen, alphanumerisch + Sonderzeichen
- Werden **nur einmal** im Klartext zurückgegeben
- Sofort verschlüsselt in SCC-DB gespeichert

### Verschlüsselung

- `CompanyDbConfig.dbPassword` muss verschlüsselt gespeichert werden
- Optionen:
  - **Vault/Secrets-Manager**: Passwörter in externem Secrets-Manager
  - **DB-Level-Verschlüsselung**: Verschlüsselte Spalte in PostgreSQL
  - **Application-Level**: Verschlüsselung vor dem Speichern (z. B. AES-256)

### Netzwerk-Isolation

- Tenant-DBs sollten nur von Mailclient-App erreichbar sein
- Firewall-Regeln: Nur bestimmte IPs/Netzwerke
- Optional: VPN-Tunnel für sichere Verbindung

## Rollback & Cleanup

### Bei Fehlern

- Provisionierung schlägt fehl → Status: `failed`
- Terraform-Destroy wird ausgeführt (Ressourcen werden gelöscht)
- `CompanyDbConfig` wird nicht angelegt oder markiert als `failed`

### Firma löschen

- **Deprovisionierung**: Terraform-Destroy für DB-Server/Container
- **Datenbank-Backup**: Optional vor Löschung
- `CompanyDbConfig` wird aus SCC-DB entfernt
- `Company.status` → `deleted`

## Monitoring & Health-Checks

- Regelmäßige Health-Checks für alle Tenant-DBs
- Status wird in `CompanyDbConfig.healthStatus` gespeichert
- Alerts bei `unhealthy`-Status
- Automatische Wiederherstellung (optional)

## Nächste Schritte

Siehe `IMPLEMENTATION_PLAN.md` für die geplante Implementierungsreihenfolge. Provisionierung wird in **Stufe 4** angegangen, zunächst als Mock.




