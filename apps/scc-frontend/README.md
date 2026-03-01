# Saivaro Control Center - Frontend

Frontend-UI für das Saivaro Control Center (SCC).

## Tech-Stack

- **Framework**: Next.js 14+ (App Router)
- **Language**: TypeScript
- **HTTP-Client**: Axios

## Setup

### 1. Umgebungsvariablen

Erstelle eine `.env.local` Datei (optional):

```env
NEXT_PUBLIC_API_URL=http://localhost:3001/api
```

### 2. Entwicklungsserver starten

```bash
# Vom Root-Verzeichnis
pnpm --filter scc-frontend dev

# Oder direkt aus apps/scc-frontend/
pnpm dev
```

Frontend läuft auf: `http://localhost:3002`

## Features

- ✅ **Login**: SCC-User-Anmeldung
- ✅ **Companies-Liste**: Übersicht aller Companies
- ✅ **Suche**: Volltext-Suche nach Name, Slug oder Plan
- ✅ **Filter**: Nach Status und Plan filtern
- ✅ **Sortierung**: Sortieren nach Name, Slug, Status, Plan oder Erstellungsdatum
- ✅ **Pagination**: Seitenweise Anzeige bei vielen Companies
- ✅ **Company-Erstellung**: Neue Company über UI erstellen
- ✅ **Company-Bearbeitung**: Company-Daten bearbeiten
- ✅ **Company-Löschung**: Company löschen
- ✅ **Company-Details**: Detailansicht mit DB-Config
- ✅ **DB-Provisionierung**: Provisionierung über UI

## Seiten

- `/` - Weiterleitung zu Login oder Companies
- `/login` - Anmeldeseite
- `/companies` - Liste aller Companies
- `/companies/new` - Neue Company erstellen
- `/companies/[id]` - Company-Details
- `/companies/[id]/edit` - Company bearbeiten

## Standard-Login

- Email: `admin@saivaro.local`
- Passwort: `admin123`

## Nächste Schritte

- Company erstellen über UI
- Company bearbeiten
- DB-Status-Updates in Echtzeit
- Erweiterte Filter und Suche

