# PowerShell-Skript zum Neustarten des Mailservers (Mailclient + Cron-Service)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Mailserver wird neu gestartet..." -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Funktion zum Beenden eines Prozesses auf einem Port
function Stop-ProcessOnPort {
    param([int]$Port, [string]$ServiceName = "")
    
    $connections = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue | Where-Object { $_.State -eq "Listen" }
    
    if ($connections) {
        foreach ($conn in $connections) {
            $processId = $conn.OwningProcess
            if ($processId) {
                try {
                    Stop-Process -Id $processId -Force -ErrorAction Stop
                    if ($ServiceName) {
                        Write-Host "[OK] $ServiceName auf Port $Port gestoppt (PID: $processId)" -ForegroundColor Green
                    } else {
                        Write-Host "[OK] Port $Port freigegeben (PID: $processId)" -ForegroundColor Green
                    }
                    return $true
                } catch {
                    Write-Host "[WARNUNG] Konnte Prozess auf Port $Port nicht beenden" -ForegroundColor Yellow
                    return $false
                }
            }
        }
    } else {
        if ($ServiceName) {
            Write-Host "[INFO] $ServiceName war nicht aktiv (Port $Port)" -ForegroundColor Gray
        } else {
            Write-Host "[INFO] Kein Prozess auf Port $Port gefunden" -ForegroundColor Gray
        }
        return $false
    }
}

# Funktion zum Beenden von Node.js-Prozessen, die auf bestimmte Befehle lauschen
function Stop-ProcessByCommand {
    param([string]$CommandPattern)
    
    $nodeProcesses = Get-Process -Name "node" -ErrorAction SilentlyContinue
    $stopped = $false
    
    foreach ($proc in $nodeProcesses) {
        try {
            $commandLine = (Get-CimInstance Win32_Process -Filter "ProcessId = $($proc.Id)" -ErrorAction SilentlyContinue).CommandLine
            if ($commandLine -and $commandLine -like "*$CommandPattern*") {
                Stop-Process -Id $proc.Id -Force -ErrorAction Stop
                Write-Host "[OK] Prozess beendet: $CommandPattern (PID: $($proc.Id))" -ForegroundColor Green
                $stopped = $true
            }
        } catch {
            # Ignoriere Fehler beim Prüfen einzelner Prozesse
        }
    }
    
    return $stopped
}

Write-Host "[1/3] Stoppe Mailclient auf Port 3000..." -ForegroundColor Yellow
$mailclientWasRunning = Stop-ProcessOnPort -Port 3000 -ServiceName "Mailclient"

Write-Host ""
Write-Host "[2/3] Stoppe Cron-Service..." -ForegroundColor Yellow
$cronWasRunning = Stop-ProcessByCommand -CommandPattern "start-cron-service.ts"

if ($mailclientWasRunning -or $cronWasRunning) {
    Write-Host "[INFO] Warte 2 Sekunden..." -ForegroundColor Gray
    Start-Sleep -Seconds 2
}

Write-Host ""
Write-Host "[3/3] Starte Mailserver neu..." -ForegroundColor Yellow
Write-Host ""

# Prüfe, ob wir im Root-Verzeichnis sind
$currentPath = (Get-Location).Path
$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path

if ($currentPath -ne $projectRoot) {
    Set-Location $projectRoot
}

# Prüfe, ob Port 3000 frei ist
function Test-PortInUse {
    param([int]$Port)
    
    $connections = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue | Where-Object { $_.State -eq "Listen" }
    return $null -ne $connections
}

if (Test-PortInUse -Port 3000) {
    Write-Host "[WARNUNG] Port 3000 ist noch belegt!" -ForegroundColor Yellow
    Write-Host "[INFO] Versuche erneut zu stoppen..." -ForegroundColor Gray
    Start-Sleep -Seconds 1
    Stop-ProcessOnPort -Port 3000 -ServiceName "Mailclient"
    Start-Sleep -Seconds 2
}

# Starte Mailclient
Write-Host "Starte Mailclient..." -ForegroundColor Cyan
$mailclientProcess = Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd apps\mailclient; pnpm dev" -WindowStyle Normal -PassThru
Start-Sleep -Seconds 3

# Starte Cron-Service
Write-Host "Starte Cron-Service (Scheduled Triggers)..." -ForegroundColor Cyan
$cronProcess = Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd apps\mailclient; pnpm tsx scripts/start-cron-service.ts" -WindowStyle Normal -PassThru
Start-Sleep -Seconds 2

# Warte kurz, damit die Services starten können
Write-Host "[INFO] Warte auf Service-Start..." -ForegroundColor Gray
Start-Sleep -Seconds 3

# Prüfe, ob die Services erfolgreich gestartet wurden
$mailclientRunning = Test-PortInUse -Port 3000
if ($mailclientRunning) {
    Write-Host "[OK] Mailclient läuft auf Port 3000" -ForegroundColor Green
} else {
    Write-Host "[WARNUNG] Mailclient scheint nicht zu laufen (Port 3000 nicht belegt)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Mailserver wurde neu gestartet!" -ForegroundColor Green
Write-Host ""
Write-Host "URLs:" -ForegroundColor Cyan
Write-Host "- Mailclient: http://localhost:3000" -ForegroundColor White
Write-Host "- Cron-Service (Scheduled Triggers)" -ForegroundColor White
Write-Host ""
Write-Host "Zum Beenden: Strg+C in den Service-Fenstern oder verwende stop-all.ps1" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""



