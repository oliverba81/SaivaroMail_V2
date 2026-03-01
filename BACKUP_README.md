# Backup & Restore Dokumentation

## Übersicht

Dieses Projekt enthält zwei PowerShell-Scripts für Backup und Wiederherstellung:

- **`backup.ps1`** - Erstellt ein komprimiertes Backup des Projekts
- **`restore.ps1`** - Stellt ein Backup wieder her

## Backup-Script (`backup.ps1`)

### Funktionen

✓ **Intelligente Ausschlüsse** - Generierte/wiederherstellbare Ordner werden nicht gesichert:
  - `node_modules/` - Kann mit `pnpm install` wiederhergestellt werden
  - `.next/` - Next.js Build-Artefakte
  - `dist/`, `build/` - Build-Ausgaben
  - `.turbo/` - Turborepo Cache
  - `coverage/` - Test-Coverage Berichte

✓ **Zeitstempel** - Jedes Backup erhält einen eindeutigen Namen:
  - Format: `SeivaroMail_v2_YYYY-MM-DD_HHmmss.zip`
  - Beispiel: `SeivaroMail_v2_2026-01-21_143052.zip`

✓ **Direkte Kompression** - Effiziente ZIP-Erstellung ohne temporäre Kopien

✓ **Fortschrittsanzeige** - Zeigt Anzahl der verarbeiteten Dateien in Echtzeit

✓ **Automatische Bereinigung** - Löscht Backups älter als 30 Tage (konfigurierbar)

✓ **Verifizierung** - Prüft Backup nach Erstellung

✓ **Robustheit** - Prüft Laufwerk-Verfügbarkeit und Speicherplatz

### Verwendung

```powershell
.\backup.ps1
```

Oder per Doppelklick im Windows Explorer.

### Konfiguration

Am Anfang des Scripts können Sie folgende Parameter anpassen:

```powershell
$SourcePath = "c:\Users\Buero-Oliver\Documents\Cursor-Projekte\SeivaroMail_v2"
$BackupBasePath = "X:\Backups\Cursor-Projekte\SeivaroMail_v2"
$RetentionDays = 30  # Aufbewahrungsdauer in Tagen
```

### Backup-Größe

- **Mit Ausschlüssen**: ~50-200 MB
- **Dauer**: ~30 Sekunden
- **Ohne Ausschlüsse**: Mehrere GB (nicht empfohlen)

### Was wird gesichert?

- ✓ Alle Quellcode-Dateien (`.ts`, `.tsx`, `.js`, etc.)
- ✓ Konfigurationsdateien (`.json`, `.yaml`, etc.)
- ✓ Datenbank-Schemas (`prisma/schema.prisma`)
- ✓ Dokumentation (`.md` Dateien)
- ✓ Scripts (`.ps1`, `.bat`, `.sh`)
- ✓ Docker-Konfigurationen (`docker-compose.yml`)
- ✓ Umgebungsvariablen (`.env` Dateien)

### Was wird NICHT gesichert?

- ✗ `node_modules/` - Dependencies (wiederherstellbar)
- ✗ `.next/` - Build-Artefakte (regenerierbar)
- ✗ `dist/`, `build/` - Kompilierte Ausgaben
- ✗ `.turbo/` - Turborepo Cache
- ✗ `coverage/` - Test-Coverage Berichte

## Restore-Script (`restore.ps1`)

### Funktionen

✓ **Interaktive Auswahl** - Zeigt Liste aller verfügbaren Backups

✓ **Backup-Informationen** - Zeigt Größe, Datum und Alter jedes Backups

✓ **Verifizierung** - Prüft ZIP-Integrität vor Wiederherstellung

✓ **Sicherheitsabfragen** - Warnt vor Überschreiben bestehender Dateien

✓ **Fortschrittsanzeige** - Zeigt Wiederherstellungsfortschritt

✓ **Dependency-Installation** - Bietet automatisches `pnpm install` an

### Verwendung

```powershell
.\restore.ps1
```

Das Script führt Sie interaktiv durch den Wiederherstellungsprozess:

1. **Backup auswählen** - Wählen Sie aus der Liste der verfügbaren Backups
2. **Bestätigung** - Bestätigen Sie die Wiederherstellung
3. **Verifizierung** - ZIP-Datei wird auf Integrität geprüft
4. **Wiederherstellung** - Dateien werden extrahiert und kopiert
5. **Dependencies** - Optional: `pnpm install` ausführen

### Nach der Wiederherstellung

Nach erfolgreicher Wiederherstellung müssen Sie:

1. **Dependencies installieren** (falls nicht automatisch gemacht):
   ```powershell
   pnpm install
   ```

2. **Anwendung starten**:
   ```powershell
   .\start-all.ps1
   ```

3. **Optional: Build erstellen**:
   ```powershell
   pnpm run build
   ```

## Automatisierung

### Windows Task Scheduler

Sie können ein automatisches Backup einrichten:

1. Öffnen Sie **Aufgabenplanung** (Task Scheduler)
2. Erstellen Sie eine neue Aufgabe
3. Trigger: z.B. täglich um 2:00 Uhr
4. Aktion: `powershell.exe`
5. Argumente: `-ExecutionPolicy Bypass -File "C:\Users\Buero-Oliver\Documents\Cursor-Projekte\SeivaroMail_v2\backup.ps1"`

### Batch-Script

Erstellen Sie eine `.bat` Datei für schnellen Zugriff:

```batch
@echo off
powershell -ExecutionPolicy Bypass -File "%~dp0backup.ps1"
pause
```

## Fehlerbehebung

### "Laufwerk X:\ ist nicht verfügbar"

**Lösung**: Stellen Sie sicher, dass das Backup-Laufwerk verbunden ist.

### "Ausführungsrichtlinie" Fehler

**Lösung**: Führen Sie aus:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### Backup ist zu groß

**Lösung**: Prüfen Sie, ob die Ausschlüsse korrekt konfiguriert sind. Die Liste der ausgeschlossenen Ordner befindet sich in `$ExcludeFolders`.

### Restore schlägt fehl

**Lösung**: 
1. Prüfen Sie die ZIP-Datei manuell
2. Stellen Sie sicher, dass genug Speicherplatz vorhanden ist
3. Prüfen Sie die Berechtigungen im Projektverzeichnis

## Best Practices

### Backup-Strategie

- **Täglich**: Automatisches Backup über Task Scheduler
- **Vor großen Änderungen**: Manuelles Backup
- **Vor Deployments**: Manuelles Backup
- **Aufbewahrung**: 30 Tage (Standard)

### Speicherort

- **Lokal**: Schneller Zugriff, aber kein Schutz bei Hardware-Ausfall
- **Netzlaufwerk**: Geteilter Speicher, besser geschützt
- **Externe Festplatte**: Zusätzliche Sicherheit
- **Cloud**: Maximale Sicherheit (erfordert Anpassung)

### Wiederherstellung testen

Testen Sie regelmäßig, ob Ihre Backups funktionieren:

1. Erstellen Sie ein Backup
2. Erstellen Sie einen Test-Ordner
3. Führen Sie `restore.ps1` aus und wählen Sie den Test-Ordner
4. Prüfen Sie, ob alle Dateien korrekt wiederhergestellt wurden

## Sicherheit

### Umgebungsvariablen

`.env` Dateien werden **mitgesichert**. Beachten Sie:

- Backups enthalten sensible Daten (API-Keys, Passwörter)
- Schützen Sie das Backup-Laufwerk entsprechend
- Überlegen Sie, `.env` manuell vom Backup auszuschließen

### Verschlüsselung

Für zusätzliche Sicherheit können Sie:

1. BitLocker für das Backup-Laufwerk aktivieren
2. ZIP-Verschlüsselung hinzufügen (erfordert Script-Anpassung)
3. Backup in verschlüsseltem Container speichern

## Support

Bei Problemen oder Fragen:

1. Prüfen Sie diese Dokumentation
2. Prüfen Sie die Script-Ausgabe auf Fehlermeldungen
3. Kontaktieren Sie den Administrator

## Versionshistorie

- **v1.0** (2026-01-21)
  - Initiale Version
  - Backup mit intelligenten Ausschlüssen
  - Restore mit interaktiver Auswahl
  - Automatische Bereinigung alter Backups
  - Fortschrittsanzeigen
  - Dependency-Installation nach Restore
