# ============================================================================
# SeivaroMail_v2 Restore Script
# ============================================================================
# Stellt ein Backup des Projekts wieder her
# Version: 1.0
# Datum: 2026-01-21
# ============================================================================

# Konfiguration
$SourcePath = "c:\Users\Buero-Oliver\Documents\Cursor-Projekte\SeivaroMail_v2"
$BackupBasePath = "X:\Backups\Cursor-Projekte\SeivaroMail_v2"
$ProjectName = "SeivaroMail_v2"

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

function Get-UserChoice {
    param(
        [string]$Prompt,
        [string[]]$Options
    )
    
    Write-Host ""
    Write-ColorOutput $Prompt "Yellow"
    for ($i = 0; $i -lt $Options.Count; $i++) {
        Write-Host "  [$($i + 1)] $($Options[$i])"
    }
    Write-Host ""
    
    do {
        $choice = Read-Host "Ihre Wahl (1-$($Options.Count))"
        $choiceNum = [int]$choice
    } while ($choiceNum -lt 1 -or $choiceNum -gt $Options.Count)
    
    return $choiceNum - 1
}

function Confirm-Action {
    param(
        [string]$Message
    )
    
    Write-Host ""
    Write-ColorOutput $Message "Yellow"
    $response = Read-Host "Fortfahren? (J/N)"
    
    return ($response -eq "J" -or $response -eq "j" -or $response -eq "Ja" -or $response -eq "ja")
}

# ============================================================================
# Hauptprogramm
# ============================================================================

Write-Host ""
Write-ColorOutput "╔════════════════════════════════════════════════════════════════╗" "Cyan"
Write-ColorOutput "║        SeivaroMail_v2 Restore Script                         ║" "Cyan"
Write-ColorOutput "╚════════════════════════════════════════════════════════════════╝" "Cyan"
Write-Host ""

# Schritt 1: Prüfe ob X:\ Laufwerk verfügbar ist
Write-ColorOutput "[1/5] Prüfe Backup-Laufwerk X:\..." "Yellow"
if (-not (Test-Path "X:\")) {
    Write-ColorOutput "✗ FEHLER: Laufwerk X:\ ist nicht verfügbar!" "Red"
    Write-ColorOutput "  Bitte stellen Sie sicher, dass das Backup-Laufwerk verbunden ist." "Red"
    exit 1
}
Write-ColorOutput "✓ Laufwerk X:\ ist verfügbar" "Green"
Write-Host ""

# Schritt 2: Suche verfügbare Backups
Write-ColorOutput "[2/5] Suche verfügbare Backups..." "Yellow"
if (-not (Test-Path $BackupBasePath)) {
    Write-ColorOutput "✗ FEHLER: Backup-Verzeichnis existiert nicht!" "Red"
    Write-ColorOutput "  Pfad: $BackupBasePath" "Red"
    exit 1
}

$backups = Get-ChildItem -Path $BackupBasePath -Filter "${ProjectName}_*.zip" | 
           Sort-Object LastWriteTime -Descending

if ($backups.Count -eq 0) {
    Write-ColorOutput "✗ FEHLER: Keine Backups gefunden!" "Red"
    Write-ColorOutput "  Pfad: $BackupBasePath" "Red"
    exit 1
}

Write-ColorOutput "✓ $($backups.Count) Backup(s) gefunden" "Green"
Write-Host ""

# Schritt 3: Zeige Backups und lasse Benutzer auswählen
Write-ColorOutput "[3/5] Wählen Sie ein Backup zum Wiederherstellen:" "Yellow"
Write-Host ""

$backupOptions = @()
foreach ($backup in $backups) {
    $age = (Get-Date) - $backup.LastWriteTime
    $sizeMB = [math]::Round($backup.Length / 1MB, 2)
    
    if ($age.TotalDays -lt 1) {
        $ageStr = "vor $([math]::Round($age.TotalHours, 1)) Stunden"
    } elseif ($age.TotalDays -lt 7) {
        $ageStr = "vor $([math]::Round($age.TotalDays, 1)) Tagen"
    } else {
        $ageStr = "am $($backup.LastWriteTime.ToString('dd.MM.yyyy HH:mm'))"
    }
    
    $backupOptions += "$($backup.Name) - $sizeMB MB - $ageStr"
}

$backupOptions += "Abbrechen"

$selectedIndex = Get-UserChoice -Prompt "Verfügbare Backups:" -Options $backupOptions

if ($selectedIndex -eq $backups.Count) {
    Write-ColorOutput "Wiederherstellung abgebrochen." "Yellow"
    exit 0
}

$selectedBackup = $backups[$selectedIndex]
Write-Host ""
Write-ColorOutput "✓ Gewählt: $($selectedBackup.Name)" "Green"
Write-Host ""

# Schritt 4: Sicherheitswarnung
Write-ColorOutput "⚠ WARNUNG ⚠" "Red"
Write-ColorOutput "Das Wiederherstellen eines Backups wird:" "Yellow"
Write-ColorOutput "  • Alle aktuellen Dateien im Projekt überschreiben" "Yellow"
Write-ColorOutput "  • Bestehende Änderungen können verloren gehen" "Yellow"
Write-Host ""

if (-not (Confirm-Action "Möchten Sie fortfahren?")) {
    Write-ColorOutput "Wiederherstellung abgebrochen." "Yellow"
    exit 0
}
Write-Host ""

# Schritt 5: Verifiziere Backup
Write-ColorOutput "[4/5] Verifiziere Backup-Datei..." "Yellow"
try {
    $zipPath = $selectedBackup.FullName
    
    # Prüfe ZIP-Integrität
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $zip = [System.IO.Compression.ZipFile]::OpenRead($zipPath)
    $entryCount = $zip.Entries.Count
    $zip.Dispose()
    
    Write-ColorOutput "✓ ZIP-Datei ist gültig" "Green"
    Write-ColorOutput "  Enthält: $entryCount Einträge" "White"
} catch {
    Write-ColorOutput "✗ FEHLER: Backup-Datei ist beschädigt!" "Red"
    Write-ColorOutput "  $_" "Red"
    exit 1
}
Write-Host ""

# Schritt 6: Wiederherstellung
Write-ColorOutput "[5/5] Stelle Backup wieder her..." "Yellow"
$startTime = Get-Date

try {
    # Erstelle temporären Extraktions-Ordner
    $tempExtractPath = Join-Path $env:TEMP "SeivaroMail_Restore_$(Get-Date -Format 'yyyyMMdd_HHmmss')"
    
    Write-ColorOutput "  → Extrahiere ZIP-Archiv..." "Gray"
    Expand-Archive -Path $zipPath -DestinationPath $tempExtractPath -Force
    
    Write-ColorOutput "  → Kopiere Dateien ins Projektverzeichnis..." "Gray"
    
    # Zähle Dateien für Fortschrittsanzeige
    $filesToRestore = Get-ChildItem -Path $tempExtractPath -Recurse -File
    $totalFiles = $filesToRestore.Count
    $processedFiles = 0
    $lastProgress = 0
    
    foreach ($file in $filesToRestore) {
        $relativePath = $file.FullName.Substring($tempExtractPath.Length + 1)
        $targetPath = Join-Path $SourcePath $relativePath
        $targetDir = Split-Path $targetPath -Parent
        
        if (-not (Test-Path $targetDir)) {
            New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
        }
        
        Copy-Item -Path $file.FullName -Destination $targetPath -Force
        
        $processedFiles++
        
        # Fortschrittsanzeige alle 50 Dateien
        if ($processedFiles % 50 -eq 0 -or $processedFiles -eq $totalFiles) {
            $progress = [math]::Round(($processedFiles / $totalFiles) * 100)
            if ($progress -ne $lastProgress) {
                Write-Host "`r  → Wiederhergestellt: $processedFiles/$totalFiles ($progress%)" -NoNewline
                $lastProgress = $progress
            }
        }
    }
    
    Write-Host "" # Neue Zeile nach Fortschrittsanzeige
    
    # Lösche temporären Ordner
    Remove-Item -Path $tempExtractPath -Recurse -Force
    
    Write-ColorOutput "✓ Wiederherstellung erfolgreich" "Green"
    
} catch {
    Write-ColorOutput "✗ FEHLER bei der Wiederherstellung!" "Red"
    Write-ColorOutput "  $_" "Red"
    
    # Aufräumen
    if (Test-Path $tempExtractPath) {
        Remove-Item -Path $tempExtractPath -Recurse -Force -ErrorAction SilentlyContinue
    }
    
    exit 1
}

$endTime = Get-Date
$duration = $endTime - $startTime

Write-Host ""
Write-ColorOutput "╔════════════════════════════════════════════════════════════════╗" "Green"
Write-ColorOutput "║              WIEDERHERSTELLUNG ERFOLGREICH                    ║" "Green"
Write-ColorOutput "╚════════════════════════════════════════════════════════════════╝" "Green"
Write-Host ""
Write-ColorOutput "Wiederhergestellt: $($selectedBackup.Name)" "White"
Write-ColorOutput "Dateien:           $totalFiles" "White"
Write-ColorOutput "Dauer:             $([math]::Round($duration.TotalSeconds, 1)) Sekunden" "White"
Write-Host ""

# Schritt 7: Biete an, Dependencies zu installieren
Write-ColorOutput "⚠ WICHTIG: Dependencies installieren" "Yellow"
Write-ColorOutput "" "White"
Write-ColorOutput "Das Backup enthält KEINE node_modules, .next und andere generierte Ordner." "White"
Write-ColorOutput "Diese müssen neu installiert/erstellt werden." "White"
Write-Host ""

if (Confirm-Action "Möchten Sie jetzt 'pnpm install' ausführen?") {
    Write-Host ""
    Write-ColorOutput "Führe 'pnpm install' aus..." "Yellow"
    Write-Host ""
    
    try {
        $pnpmProcess = Start-Process -FilePath "pnpm" -ArgumentList "install" -WorkingDirectory $SourcePath -NoNewWindow -PassThru -Wait
        
        if ($pnpmProcess.ExitCode -eq 0) {
            Write-Host ""
            Write-ColorOutput "✓ Dependencies erfolgreich installiert" "Green"
        } else {
            Write-Host ""
            Write-ColorOutput "⚠ pnpm install wurde mit Fehlercode $($pnpmProcess.ExitCode) beendet" "Yellow"
        }
    } catch {
        Write-Host ""
        Write-ColorOutput "⚠ Fehler beim Ausführen von pnpm install" "Yellow"
        Write-ColorOutput "  Bitte führen Sie manuell aus: pnpm install" "Yellow"
    }
} else {
    Write-ColorOutput "" "White"
    Write-ColorOutput "Bitte führen Sie manuell aus:" "Cyan"
    Write-ColorOutput "  cd $SourcePath" "White"
    Write-ColorOutput "  pnpm install" "White"
}

Write-Host ""
Write-ColorOutput "Nach der Installation können Sie die Anwendung starten mit:" "Cyan"
Write-ColorOutput "  .\start-all.ps1" "White"
Write-Host ""

exit 0
