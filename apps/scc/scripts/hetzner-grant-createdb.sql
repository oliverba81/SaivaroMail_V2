-- Auf Hetzner-Postgres ausführen (als postgres-Superuser)
-- Nötig, damit der SCC bei "DB-Config aktualisieren" Tenant-DBs anlegen kann.
-- Fehler 42501 "permission denied to create database" wird dadurch behoben.

ALTER USER saivaromail_user CREATEDB;
