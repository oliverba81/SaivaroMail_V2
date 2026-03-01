# restart-all.ps1
# Startet alle Server für SeivaroMail neu

Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "             SeivaroMail - Server Neustart                      " -ForegroundColor Yellow
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""

# Funktion um Prozesse zu finden und zu beenden
function Stop-ServerProcesses {
    Write-Host "🛑 Stoppe laufende Server-Prozesse..." -ForegroundColor Yellow
    
    # Aktueller Prozess (dieses Script)
    $currentPID = $PID
    
    # 1. Finde und beende alle PowerShell-Fenster (außer dem aktuellen)
    $powershellProcesses = Get-Process -Name "powershell", "pwsh" -ErrorAction SilentlyContinue | Where-Object {
        $_.Id -ne $currentPID -and $_.MainWindowHandle -ne 0
    }
    
    if ($powershellProcesses) {
        Write-Host "  📋 Schließe PowerShell-Fenster..." -ForegroundColor Gray
        foreach ($process in $powershellProcesses) {
            try {
                Write-Host "    ✓ Schließe PowerShell-Fenster (PID: $($process.Id))" -ForegroundColor Gray
                Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
            } catch {
                Write-Host "    ⚠ Konnte PowerShell-Fenster $($process.Id) nicht schließen" -ForegroundColor Yellow
            }
        }
        Start-Sleep -Seconds 1
    }
    
    # 2. Finde Node-Prozesse, die im Projekt-Verzeichnis laufen
    $projectPath = $PSScriptRoot
    $nodeProcesses = Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object {
        $_.Path -and $_.Path.StartsWith($projectPath, [System.StringComparison]::OrdinalIgnoreCase)
    }
    
    if ($nodeProcesses) {
        Write-Host "  📋 Stoppe Node.js Server..." -ForegroundColor Gray
        foreach ($process in $nodeProcesses) {
            try {
                Write-Host "    ✓ Stoppe Node.js (PID: $($process.Id))" -ForegroundColor Gray
                Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
            } catch {
                Write-Host "    ⚠ Konnte Node.js $($process.Id) nicht stoppen" -ForegroundColor Yellow
            }
        }
    }
    
    Write-Host "  ✓ Alle Prozesse gestoppt" -ForegroundColor Green
    
    # Kurze Pause, damit Ports freigegeben werden
    Start-Sleep -Seconds 2
}

# Funktion um Port zu prüfen
function Test-Port {
    param (
        [int]$Port
    )
    
    try {
        $connection = Test-NetConnection -ComputerName "localhost" -Port $Port -InformationLevel Quiet -WarningAction SilentlyContinue
        return $connection
    } catch {
        return $false
    }
}

# Stoppe alte Prozesse
Stop-ServerProcesses

Write-Host ""
Write-Host "🔍 Prüfe Ports..." -ForegroundColor Cyan

# Prüfe ob Ports frei sind
$ports = @(3000, 3001, 3002)
foreach ($port in $ports) {
    $isInUse = Test-Port -Port $port
    if ($isInUse) {
        Write-Host "  ⚠ Port $port ist noch belegt. Versuche zu befreien..." -ForegroundColor Yellow
        
        # Finde Prozess auf diesem Port
        $netstatOutput = netstat -ano | Select-String ":$port\s" | Select-Object -First 1
        if ($netstatOutput) {
            $processId = ($netstatOutput -split '\s+')[-1]
            if ($processId -and $processId -ne "0") {
                try {
                    Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
                    Write-Host "  ✓ Port $port freigegeben" -ForegroundColor Green
                    Start-Sleep -Seconds 1
                } catch {
                    Write-Host "  ✗ Konnte Port $port nicht freigeben" -ForegroundColor Red
                }
            }
        }
    } else {
        Write-Host "  ✓ Port $port ist frei" -ForegroundColor Green
    }
}

Write-Host ""
Write-Host "🚀 Starte Server..." -ForegroundColor Cyan
Write-Host ""

# Prüfe ob package.json existiert
if (-not (Test-Path "package.json")) {
    Write-Host "❌ Fehler: package.json nicht gefunden!" -ForegroundColor Red
    Write-Host "   Bitte führen Sie das Script im Projekt-Verzeichnis aus." -ForegroundColor Yellow
    Write-Host ""
    Read-Host "Drücken Sie Enter zum Beenden"
    exit 1
}

# Prüfe ob node_modules existiert
if (-not (Test-Path "node_modules")) {
    Write-Host "📦 node_modules nicht gefunden. Installiere Dependencies..." -ForegroundColor Yellow
    npm install
    Write-Host ""
}

# Starte den Haupt-Server im Hintergrund
Write-Host "1️⃣  Starte Mailclient-Server (Port 3000)..." -ForegroundColor Cyan

# Erstelle ein neues PowerShell-Fenster für den Server
$serverJob = Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot'; Write-Host '🚀 SeivaroMail Server' -ForegroundColor Green; npm run dev" -PassThru

if ($serverJob) {
    Write-Host "  ✓ Server gestartet (Prozess-ID: $($serverJob.Id))" -ForegroundColor Green
} else {
    Write-Host "  ✗ Fehler beim Starten des Servers" -ForegroundColor Red
}

# Warte kurz, damit der Server hochfahren kann
Write-Host ""
Write-Host "⏳ Warte auf Server-Start..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

# Prüfe ob Server erreichbar ist
Write-Host ""
Write-Host "🔍 Prüfe Server-Status..." -ForegroundColor Cyan

$maxRetries = 10
$retryCount = 0
$serverRunning = $false

while ($retryCount -lt $maxRetries -and -not $serverRunning) {
    $retryCount++
    $serverRunning = Test-Port -Port 3000
    
    if ($serverRunning) {
        Write-Host "  ✓ Server läuft auf Port 3000!" -ForegroundColor Green
    } else {
        Write-Host "  ⏳ Warte... ($retryCount/$maxRetries)" -ForegroundColor Gray
        Start-Sleep -Seconds 2
    }
}

Write-Host ""
Write-Host "================================================================" -ForegroundColor Green
Write-Host "                Neustart abgeschlossen!                         " -ForegroundColor Green
Write-Host "================================================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Mailclient:  http://testfirma2.localhost:3000" -ForegroundColor White
Write-Host "  Login:       admin / f9k^Sy8yQGfo" -ForegroundColor White
Write-Host ""
Write-Host "  Tipp: Laden Sie die E-Mail-Seite neu (F5)" -ForegroundColor Yellow
Write-Host ""
Write-Host "================================================================" -ForegroundColor Green
Write-Host ""

# Optional: Öffne Browser
$openBrowser = Read-Host "Möchten Sie den Browser öffnen? (j/n)"
if ($openBrowser -eq "j" -or $openBrowser -eq "J") {
    Write-Host "🌐 Öffne Browser..." -ForegroundColor Cyan
    Start-Process "http://testfirma2.localhost:3000"
}

Write-Host ""
Write-Host "Drücken Sie eine beliebige Taste zum Beenden..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
