# restart-all-aggressive.ps1
# AGGRESSIVE Version: Beendet ALLE PowerShell-Prozesse und startet komplett neu

Write-Host ""
Write-Host "================================================================" -ForegroundColor Red
Write-Host "     SeivaroMail - AGGRESSIVE Server Neustart                   " -ForegroundColor Yellow
Write-Host "     WARNUNG: Beendet ALLE PowerShell-Prozesse!                 " -ForegroundColor Red
Write-Host "================================================================" -ForegroundColor Red
Write-Host ""

# Countdown
Write-Host "Starte in 3 Sekunden..." -ForegroundColor Yellow
Start-Sleep -Seconds 1
Write-Host "Starte in 2 Sekunden..." -ForegroundColor Yellow
Start-Sleep -Seconds 1
Write-Host "Starte in 1 Sekunde..." -ForegroundColor Yellow
Start-Sleep -Seconds 1
Write-Host ""

# Aktueller Prozess
$currentPID = $PID
$scriptPath = $PSScriptRoot

# Erstelle ein Batch-Script das nach Beendigung dieses Scripts ausgeführt wird
$batchScript = @"
@echo off
timeout /t 2 /nobreak >nul

echo.
echo ================================================================
echo  Beende alle Prozesse...
echo ================================================================
echo.

REM Beende alle PowerShell-Prozesse
taskkill /F /IM powershell.exe /T >nul 2>&1
taskkill /F /IM pwsh.exe /T >nul 2>&1

REM Beende alle Node-Prozesse
taskkill /F /IM node.exe /T >nul 2>&1

REM Warte 2 Sekunden
timeout /t 2 /nobreak >nul

REM (1) Port-Prozesse explizit beenden (falls node.exe nicht gereicht hat)
powershell -NoProfile -Command "$ports = 3000,3001,3002,3010; foreach ($p in $ports) { Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue | ForEach-Object { $procId = $_.OwningProcess; if ($procId) { Write-Host ('Beende Prozess auf Port ' + $p + ': PID ' + $procId); Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue } } }"

REM (2) Port-Pruefung: Falls Ports noch belegt, kurz nachwarten
powershell -NoProfile -Command "$ports = 3000,3001,3002,3010; $inUse = @(Get-NetTCPConnection -LocalPort $ports -ErrorAction SilentlyContinue | Where-Object { $_.State -eq 'Listen' }); if ($inUse.Count -gt 0) { Write-Host 'Port(s) noch belegt - warte 3 Sekunden...'; Start-Sleep -Seconds 3 }"

echo.
echo ================================================================
echo  Starte Server neu...
echo ================================================================
echo.

REM Wechsle ins Projekt-Verzeichnis
cd /d "$scriptPath"

REM (2) node_modules: Bei Bedarf Dependencies installieren
if not exist "node_modules" (
  echo Installiere Dependencies...
  call pnpm install
  timeout /t 2 /nobreak >nul
)

REM Starte neues PowerShell-Fenster mit Server
start powershell -NoExit -Command "Write-Host 'SeivaroMail Server' -ForegroundColor Green; npm run dev"

REM Warte auf Server-Start (Turborepo/Next.js braucht ~20-30s; Cron-Service wartet intern 10s)
REM Ohne Verzoegerung: Mailclient-API oft noch nicht bereit -> "Mailclient-API nicht erreichbar"
echo Warte 15 Sekunden, bis Server hochfahren...
timeout /t 15 /nobreak >nul

REM Starte Cron-Service (Scheduled Triggers)
start powershell -NoExit -Command "cd apps\mailclient; Write-Host 'Cron-Service (Scheduled Triggers)' -ForegroundColor Green; pnpm tsx scripts/start-cron-service.ts"

echo.
echo Server und Cron-Service wurden gestartet!
echo URL: http://127.0.0.1:3010?company=testfirma2
echo Cron-Service: Scheduled Triggers (separates Fenster)
echo.

REM (3) Warte auf SCC (Port 3001) zuerst, damit Mailclient beim ersten Request die SCC-API erreicht
echo Warte auf SCC (Port 3001)...
powershell -NoProfile -Command "$max = 30; $i = 0; while ($i -lt $max) { try { $c = New-Object System.Net.Sockets.TcpClient('127.0.0.1', 3001); $c.Close(); Write-Host 'OK: SCC laeuft auf Port 3001' -ForegroundColor Green; break } catch { $i++; if ($i -ge $max) { Write-Host 'Hinweis: SCC (3001) nach 30s nicht erreichbar' -ForegroundColor Yellow; break }; Start-Sleep -Seconds 1 } }"
echo Warte auf Mailclient (Port 3010)...
timeout /t 5 /nobreak >nul
powershell -NoProfile -Command "try { $ok = Test-NetConnection 127.0.0.1 -Port 3010 -InformationLevel Quiet -WarningAction SilentlyContinue; if ($ok) { Write-Host 'OK: Mailclient laeuft auf Port 3010' -ForegroundColor Green } else { Write-Host 'Hinweis: Port 3010 noch nicht erreichbar - ggf. Fenster pruefen' -ForegroundColor Yellow } } catch { Write-Host 'Server-Status nicht pruefbar' -ForegroundColor Gray }"
echo.
echo Fenster schliesst sich in 5 Sekunden...
timeout /t 5 /nobreak

REM Lösche sich selbst
del "%~f0"
"@

# Speichere Batch-Script
$batchPath = Join-Path $env:TEMP "restart-seivaromail.bat"
$batchScript | Out-File -FilePath $batchPath -Encoding ASCII -Force

Write-Host "Starte Neustart-Prozess..." -ForegroundColor Yellow
Write-Host "Dieses Fenster wird gleich geschlossen." -ForegroundColor Gray
Write-Host ""

# Starte Batch-Script im Hintergrund
Start-Process -FilePath $batchPath -WindowStyle Hidden

# Warte kurz
Start-Sleep -Seconds 1

# Beende dieses Script (das Batch-Script übernimmt)
exit
