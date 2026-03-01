# ============================================================================
# SeivaroMail_v2 Backup Script
# ============================================================================
# Erstellt ein komprimiertes Backup des Projekts mit intelligenten Ausschluessen
# Version: 1.0
# Datum: 2026-01-21
# ============================================================================

# Konfiguration
$SourcePath = "c:\Users\Buero-Oliver\Documents\Cursor-Projekte\SeivaroMail_v2"
$BackupBasePath = "X:\Backups\Cursor-Projekte\SeivaroMail_v2"
$RetentionDays = 30
$ProjectName = "SeivaroMail_v2"

# Ordner die vom Backup ausgeschlossen werden (wiederherstellbar)
$ExcludeFolders = @(
    "node_modules",
    ".next",
    "dist",
    "build",
    ".turbo",
    "coverage",
    ".cache"
)

# ============================================================================
# Funktionen
# ============================================================================

function Write-ColorOutput {
    param(
        [string]$Message,
        [string]$Color = "White"
    )
    Write-Host $Message -ForegroundColor $Color
}

function Get-FilesRecursive {
    param(
        [string]$Path,
        [string[]]$ExcludeFolders
    )
    
    $files = @()
    $items = Get-ChildItem -Path $Path -Force -ErrorAction SilentlyContinue
    
    foreach ($item in $items) {
        if ($item.PSIsContainer) {
            # Pruefe ob Ordner ausgeschlossen werden soll
            if ($ExcludeFolders -contains $item.Name) {
                continue
            }
            # Rekursiv in Unterordner
            $files += Get-FilesRecursive -Path $item.FullName -ExcludeFolders $ExcludeFolders
        } else {
            $files += $item
        }
    }
    
    return $files
}

# ============================================================================
# Hauptprogramm
# ============================================================================

Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "        SeivaroMail_v2 Backup Script                           " -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""

$startTime = Get-Date

# Schritt 1: Pruefe ob X:\ Laufwerk verfuegbar ist
Write-ColorOutput "[1/6] Pruefe Backup-Laufwerk X:\..." "Yellow"
if (-not (Test-Path "X:\")) {
    Write-ColorOutput "FEHLER: Laufwerk X:\ ist nicht verfuegbar!" "Red"
    Write-ColorOutput "  Bitte stellen Sie sicher, dass das Backup-Laufwerk verbunden ist." "Red"
    exit 1
}
Write-ColorOutput "OK: Laufwerk X:\ ist verfuegbar" "Green"
Write-Host ""

# Schritt 2: Erstelle Zielverzeichnis falls nicht vorhanden
Write-ColorOutput "[2/6] Erstelle Zielverzeichnis..." "Yellow"
if (-not (Test-Path $BackupBasePath)) {
    try {
        New-Item -ItemType Directory -Path $BackupBasePath -Force | Out-Null
        Write-ColorOutput "OK: Zielverzeichnis erstellt: $BackupBasePath" "Green"
    } catch {
        Write-ColorOutput "FEHLER: Konnte Zielverzeichnis nicht erstellen!" "Red"
        Write-ColorOutput "  $_" "Red"
        exit 1
    }
} else {
    Write-ColorOutput "OK: Zielverzeichnis existiert bereits" "Green"
}
Write-Host ""

# Schritt 3: Erstelle Zeitstempel und Backup-Namen
Write-ColorOutput "[3/6] Bereite Backup vor..." "Yellow"
$timestamp = Get-Date -Format "yyyy-MM-dd_HHmmss"
$backupFileName = "${ProjectName}_${timestamp}.zip"
$backupFilePath = Join-Path $BackupBasePath $backupFileName

Write-ColorOutput "  Backup-Name: $backupFileName" "White"
Write-Host ""

# Schritt 4: Sammle Dateien und erstelle ZIP
Write-ColorOutput "[4/6] Erstelle Backup mit direkter Kompression..." "Yellow"
Write-ColorOutput "  Ausgeschlossen: $($ExcludeFolders -join ', ')" "Gray"
Write-Host ""

try {
    # Sammle alle Dateien
    Write-ColorOutput "  -> Sammle Dateien..." "Gray"
    $filesToBackup = Get-FilesRecursive -Path $SourcePath -ExcludeFolders $ExcludeFolders
    $totalFiles = $filesToBackup.Count
    
    Write-ColorOutput "  -> Gefunden: $totalFiles Dateien" "Gray"
    Write-Host ""
    
    # Erstelle temporaeren Ordner fuer die Struktur
    $tempPath = Join-Path $env:TEMP "SeivaroMail_Backup_$timestamp"
    New-Item -ItemType Directory -Path $tempPath -Force | Out-Null
    
    # Kopiere Dateien mit Fortschrittsanzeige
    $processedFiles = 0
    $lastProgress = 0
    
    foreach ($file in $filesToBackup) {
        $relativePath = $file.FullName.Substring($SourcePath.Length + 1)
        $targetPath = Join-Path $tempPath $relativePath
        $targetDir = Split-Path $targetPath -Parent
        
        if (-not (Test-Path $targetDir)) {
            New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
        }
        
        Copy-Item -Path $file.FullName -Destination $targetPath -Force
        
        $processedFiles++
        
        # Fortschrittsanzeige alle 100 Dateien
        if ($processedFiles % 100 -eq 0 -or $processedFiles -eq $totalFiles) {
            $progress = [math]::Round(($processedFiles / $totalFiles) * 100)
            if ($progress -ne $lastProgress) {
                Write-Host "`r  -> Verarbeite Dateien: $processedFiles/$totalFiles ($progress%)" -NoNewline
                $lastProgress = $progress
            }
        }
    }
    
    Write-Host ""
    Write-ColorOutput "  -> Komprimiere zu ZIP-Archiv..." "Gray"
    
    # Komprimiere zu ZIP
    Compress-Archive -Path "$tempPath\*" -DestinationPath $backupFilePath -CompressionLevel Optimal -Force
    
    # Loesche temporaeren Ordner
    Remove-Item -Path $tempPath -Recurse -Force
    
    Write-ColorOutput "OK: Backup erfolgreich erstellt" "Green"
    
} catch {
    Write-ColorOutput "FEHLER beim Erstellen des Backups!" "Red"
    Write-ColorOutput "  $_" "Red"
    
    # Aufraeumen
    if (Test-Path $tempPath) {
        Remove-Item -Path $tempPath -Recurse -Force -ErrorAction SilentlyContinue
    }
    if (Test-Path $backupFilePath) {
        Remove-Item -Path $backupFilePath -Force -ErrorAction SilentlyContinue
    }
    
    exit 1
}
Write-Host ""

# Schritt 5: Verifiziere Backup
Write-ColorOutput "[5/6] Verifiziere Backup..." "Yellow"
if (Test-Path $backupFilePath) {
    $backupSize = (Get-Item $backupFilePath).Length
    $backupSizeMB = [math]::Round($backupSize / 1MB, 2)
    
    Write-ColorOutput "OK: ZIP-Datei existiert" "Green"
    Write-ColorOutput "  Groesse: $backupSizeMB MB" "White"
    Write-ColorOutput "  Dateien: $totalFiles" "White"
} else {
    Write-ColorOutput "FEHLER: Backup-Datei wurde nicht erstellt!" "Red"
    exit 1
}
Write-Host ""

# Schritt 6: Bereinige alte Backups
Write-ColorOutput "[6/6] Bereinige alte Backups (aelter als $RetentionDays Tage)..." "Yellow"
$cutoffDate = (Get-Date).AddDays(-$RetentionDays)
$oldBackups = Get-ChildItem -Path $BackupBasePath -Filter "${ProjectName}_*.zip" | Where-Object { $_.LastWriteTime -lt $cutoffDate }

if ($oldBackups.Count -gt 0) {
    foreach ($oldBackup in $oldBackups) {
        try {
            Remove-Item -Path $oldBackup.FullName -Force
            Write-ColorOutput "  OK: Geloescht: $($oldBackup.Name)" "Gray"
        } catch {
            Write-ColorOutput "  FEHLER beim Loeschen von $($oldBackup.Name)" "Red"
        }
    }
    Write-ColorOutput "OK: $($oldBackups.Count) alte(s) Backup(s) geloescht" "Green"
} else {
    Write-ColorOutput "OK: Keine alten Backups gefunden" "Green"
}
Write-Host ""

# Zusammenfassung
$endTime = Get-Date
$duration = $endTime - $startTime

Write-Host "================================================================" -ForegroundColor Green
Write-Host "                  BACKUP ERFOLGREICH                           " -ForegroundColor Green
Write-Host "================================================================" -ForegroundColor Green
Write-Host ""
Write-ColorOutput "Backup-Datei: $backupFileName" "White"
Write-ColorOutput "Speicherort:  $BackupBasePath" "White"
Write-ColorOutput "Groesse:      $backupSizeMB MB" "White"
Write-ColorOutput "Dateien:      $totalFiles" "White"
Write-ColorOutput "Dauer:        $([math]::Round($duration.TotalSeconds, 1)) Sekunden" "White"
Write-Host ""

# Zeige vorhandene Backups
$allBackups = Get-ChildItem -Path $BackupBasePath -Filter "${ProjectName}_*.zip" | Sort-Object LastWriteTime -Descending
Write-ColorOutput "Verfuegbare Backups ($($allBackups.Count)):" "Cyan"
foreach ($backup in $allBackups | Select-Object -First 5) {
    $age = (Get-Date) - $backup.LastWriteTime
    $sizeMB = [math]::Round($backup.Length / 1MB, 2)
    Write-ColorOutput "  - $($backup.Name) - $sizeMB MB - vor $([math]::Round($age.TotalHours, 1)) Stunden" "Gray"
}

if ($allBackups.Count -gt 5) {
    Write-ColorOutput "  ... und $($allBackups.Count - 5) weitere" "Gray"
}

Write-Host ""
Write-ColorOutput "Zum Wiederherstellen eines Backups, fuehren Sie aus: .\restore.ps1" "Cyan"
Write-Host ""

exit 0
