# Architektur "Vorher" (Ausgangslage)

## Kontext

Dieses Dokument beschreibt die gedankliche Ausgangslage, von der wir ausgehen, auch wenn das Repository aktuell leer ist. Wir stellen uns vor, dass es eine bestehende Webapplikation gibt, die wir in eine saubere Multi-Tenant-Architektur überführen.

## Ausgangslage (gedanklich)

**Vorher:** Eine monolithische Webapplikation mit einer zentralen Datenbank, kein echtes Multi-Tenant-System, kein separates Control Center.

### Charakteristika der "alten" Architektur

- **Single Application**: Eine einzige Webapplikation für alle Nutzer
- **Single Database**: Alle Firmen teilen sich eine zentrale Datenbank
- **Keine Tenant-Isolation**: Daten werden über `company_id`-Spalten getrennt, aber physisch in derselben DB
- **Kein Control Center**: Keine separate Admin-Oberfläche für Provisionierung und Management
- **Keine DB-Provisionierung**: Datenbanken werden manuell eingerichtet

## Architekturdiagramm (Vorher)

```
┌─────────────────────────────────────────────────────────┐
│                    Web Browser                           │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│              Monolithische Webapp                        │
│  ┌──────────────────────────────────────────────────┐   │
│  │  Frontend (React/HTML)                           │   │
│  └──────────────────┬───────────────────────────────┘   │
│                     │                                     │
│  ┌──────────────────▼───────────────────────────────┐   │
│  │  Backend API (Express/Nest)                      │   │
│  │  - Alle Endpoints                                │   │
│  │  - Auth für alle User                            │   │
│  └──────────────────┬───────────────────────────────┘   │
└─────────────────────┼────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│         Zentrale PostgreSQL-Datenbank                    │
│  ┌──────────────────────────────────────────────────┐   │
│  │  Tabellen:                                        │   │
│  │  - companies (id, name, ...)                     │   │
│  │  - users (id, company_id, email, ...)           │   │
│  │  - emails (id, user_id, company_id, ...)        │   │
│  │  - ...                                           │   │
│  │                                                   │   │
│  │  Alle Firmen teilen sich diese DB               │   │
│  │  Trennung nur über company_id                   │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

## Probleme der alten Architektur

1. **Keine echte Isolation**: Alle Firmen teilen sich eine Datenbank
2. **Skalierbarkeit**: Schwer, einzelne Firmen zu skalieren
3. **Backup/Recovery**: Komplex, da alle Daten in einer DB
4. **Sicherheit**: Fehlerhafte Queries könnten Daten anderer Firmen leaken
5. **Provisionierung**: Manuell, keine Automatisierung
6. **Monitoring**: Schwer, pro Firma zu monitoren

## Ziel-Architektur (später)

Siehe `IMPLEMENTATION_PLAN.md` für die geplante Multi-Tenant-Architektur mit:
- Separaten Datenbanken pro Firma (oder mindestens pro Tenant)
- Saivaro Control Center (SCC) für Provisionierung
- Multi-App-Monorepo-Struktur
- Automatisierte DB-Provisionierung




