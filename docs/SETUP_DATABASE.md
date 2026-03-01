# Datenbank-Setup

## Option 1: Docker Compose (Empfohlen für lokale Entwicklung)

### Voraussetzungen
- Docker Desktop installiert und gestartet

### Setup

1. **PostgreSQL-Container starten:**
   ```bash
   docker-compose up -d
   ```

2. **Prüfen, ob Container läuft:**
   ```bash
   docker-compose ps
   ```

3. **`.env` Datei anpassen:**
   ```env
   DATABASE_URL="postgresql://saivaro:saivaro_dev_password@localhost:5432/saivaro_scc?schema=public"
   ```

4. **Migration ausführen:**
   ```bash
   cd apps/scc
   pnpm db:migrate
   pnpm db:seed
   ```

### Container stoppen
```bash
docker-compose down
```

### Daten löschen (Vorsicht!)
```bash
docker-compose down -v
```

---

## Option 2: Lokale PostgreSQL-Installation

### Windows

1. **PostgreSQL herunterladen und installieren:**
   - https://www.postgresql.org/download/windows/
   - Oder: https://www.enterprisedb.com/downloads/postgres-postgresql-downloads

2. **Während der Installation:**
   - Port: `5432` (Standard)
   - Superuser-Passwort setzen
   - Optional: pgAdmin installieren

3. **Datenbank erstellen:**
   ```sql
   -- Mit pgAdmin oder psql:
   CREATE DATABASE saivaro_scc;
   ```

4. **`.env` Datei anpassen:**
   ```env
   DATABASE_URL="postgresql://postgres:DEIN_PASSWORT@localhost:5432/saivaro_scc?schema=public"
   ```

5. **Migration ausführen:**
   ```bash
   cd apps/scc
   pnpm db:migrate
   pnpm db:seed
   ```

---

## Option 3: Remote PostgreSQL (z. B. Hetzner, AWS RDS)

1. **Datenbank-Server erstellen** (z. B. über Hetzner Cloud Console)

2. **`.env` Datei anpassen:**
   ```env
   DATABASE_URL="postgresql://user:password@dein-server.de:5432/saivaro_scc?schema=public&sslmode=require"
   ```

3. **Migration ausführen:**
   ```bash
   cd apps/scc
   pnpm db:migrate
   pnpm db:seed
   ```

---

## Troubleshooting

### "Can't reach database server"
- Prüfe, ob PostgreSQL läuft
- Prüfe Firewall-Einstellungen
- Prüfe `DATABASE_URL` in `.env`

### "Database does not exist"
- Erstelle die Datenbank manuell:
  ```sql
  CREATE DATABASE saivaro_scc;
  ```

### "Authentication failed"
- Prüfe Benutzername und Passwort in `DATABASE_URL`
- Prüfe `pg_hba.conf` (bei lokaler Installation)

---

## Nächste Schritte

Nach erfolgreicher Migration:
- SCC-Backend starten: `pnpm dev`
- Login testen: `admin@saivaro.local` / `admin123`




