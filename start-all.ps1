# PowerShell-Skript zum Starten aller Services
# Alternative zu start-all.bat

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Saivaro Mail v2 - Starte alle Services" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Prüfe, ob wir auf einem UNC-Pfad sind
$currentPath = (Get-Location).Path
$localProjectPath = "$env:USERPROFILE\Documents\Cursor-Projekte\SaivaroMail_v2"

if ($currentPath -like "\\*") {
    Write-Host "[WARNUNG] Das Projekt liegt auf einem UNC-Netzwerkpfad!" -ForegroundColor Red
    Write-Host "UNC-Pfade werden von Node.js/pnpm nicht unterstützt." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Aktueller Pfad: $currentPath" -ForegroundColor Gray
    Write-Host "Lokaler Pfad:   $localProjectPath" -ForegroundColor Gray
    Write-Host ""
    
    if (Test-Path $localProjectPath) {
        Write-Host "[INFO] Lokales Projekt gefunden!" -ForegroundColor Green
        $response = Read-Host "Möchtest du zum lokalen Projekt wechseln? (J/N)"
        
        if ($response -eq "J" -or $response -eq "j" -or $response -eq "Y" -or $response -eq "y") {
            Write-Host "[OK] Wechsle zum lokalen Projekt..." -ForegroundColor Green
            Set-Location $localProjectPath
            Write-Host "[OK] Jetzt im lokalen Projekt: $(Get-Location)" -ForegroundColor Green
            Write-Host ""
        } else {
            Write-Host "[FEHLER] Bitte verwende das lokale Projekt oder mappe das Netzwerklaufwerk auf einen lokalen Laufwerksbuchstaben." -ForegroundColor Red
            Write-Host "Beispiel: net use X: \\192.168.2.135\software\Backups\Cursor-Projekte\SaivaroMail_v2" -ForegroundColor Yellow
            Read-Host "Drücke Enter zum Beenden"
            exit 1
        }
    } else {
        Write-Host "[FEHLER] Lokales Projekt nicht gefunden!" -ForegroundColor Red
        Write-Host "Bitte kopiere das Projekt nach: $localProjectPath" -ForegroundColor Yellow
        Write-Host "Oder mappe das Netzwerklaufwerk auf einen lokalen Laufwerksbuchstaben:" -ForegroundColor Yellow
        Write-Host "  net use X: \\192.168.2.135\software\Backups\Cursor-Projekte\SaivaroMail_v2" -ForegroundColor Cyan
        Read-Host "Drücke Enter zum Beenden"
        exit 1
    }
}

# Prüfe Docker
try {
    docker ps | Out-Null
    Write-Host "[OK] Docker läuft" -ForegroundColor Green
} catch {
    Write-Host "[FEHLER] Docker scheint nicht zu laufen!" -ForegroundColor Red
    Write-Host "Bitte starte Docker Desktop und versuche es erneut." -ForegroundColor Yellow
    Read-Host "Drücke Enter zum Beenden"
    exit 1
}

# Prüfe pnpm
try {
    pnpm --version | Out-Null
    Write-Host "[OK] pnpm gefunden" -ForegroundColor Green
} catch {
    Write-Host "[FEHLER] pnpm ist nicht installiert!" -ForegroundColor Red
    Write-Host "Bitte installiere pnpm: npm install -g pnpm" -ForegroundColor Yellow
    Read-Host "Drücke Enter zum Beenden"
    exit 1
}

Write-Host ""
Write-Host "[1/4] Starte PostgreSQL-Container..." -ForegroundColor Yellow
docker compose up -d
if ($LASTEXITCODE -ne 0) {
    Write-Host "[FEHLER] Docker Compose fehlgeschlagen!" -ForegroundColor Red
    Read-Host "Drücke Enter zum Beenden"
    exit 1
}
Write-Host "[OK] PostgreSQL-Container gestartet" -ForegroundColor Green
Write-Host ""

Write-Host "[2/4] Warte auf Datenbank..." -ForegroundColor Yellow
Start-Sleep -Seconds 3
Write-Host "[OK] Datenbank bereit" -ForegroundColor Green
Write-Host ""

Write-Host "[3/4] Installiere Dependencies (falls nötig)..." -ForegroundColor Yellow
pnpm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "[FEHLER] pnpm install fehlgeschlagen!" -ForegroundColor Red
    Read-Host "Drücke Enter zum Beenden"
    exit 1
}
Write-Host "[OK] Dependencies installiert" -ForegroundColor Green
Write-Host ""

Write-Host "[4/5] Prüfe Port-Verfügbarkeit..." -ForegroundColor Yellow

# Funktion zum Prüfen, ob ein Port belegt ist
function Test-PortInUse {
    param([int]$Port)
    
    $connections = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue | Where-Object { $_.State -eq "Listen" }
    return $null -ne $connections
}

# Funktion zum Beenden eines Prozesses auf einem Port
function Stop-ProcessOnPort {
    param([int]$Port, [string]$ServiceName)
    
    $connections = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue | Where-Object { $_.State -eq "Listen" }
    
    if ($connections) {
        foreach ($conn in $connections) {
            $pid = $conn.OwningProcess
            if ($pid) {
                try {
                    Stop-Process -Id $pid -Force -ErrorAction Stop
                    Write-Host "[OK] Port $Port freigegeben (PID: $pid)" -ForegroundColor Green
                    return $true
                } catch {
                    Write-Host "[FEHLER] Konnte Prozess auf Port $Port nicht beenden" -ForegroundColor Red
                    return $false
                }
            }
        }
    }
    return $true
}

# Prüfe und beende Prozesse auf den Ports
$ports = @(
    @{Port = 3001; Name = "SCC-Backend"},
    @{Port = 3002; Name = "SCC-Frontend"},
    @{Port = 3000; Name = "Mailclient"}
)

$allPortsFree = $true

foreach ($portInfo in $ports) {
    if (Test-PortInUse -Port $portInfo.Port) {
        Write-Host "[WARNUNG] Port $($portInfo.Port) ist bereits belegt ($($portInfo.Name))!" -ForegroundColor Yellow
        $response = Read-Host "Möchtest du den Prozess beenden? (J/N)"
        
        if ($response -eq "J" -or $response -eq "j" -or $response -eq "Y" -or $response -eq "y") {
            if (-not (Stop-ProcessOnPort -Port $portInfo.Port -ServiceName $portInfo.Name)) {
                $allPortsFree = $false
            }
        } else {
            Write-Host "[FEHLER] Port $($portInfo.Port) ist belegt. Bitte beende den Prozess manuell." -ForegroundColor Red
            $allPortsFree = $false
        }
    } else {
        Write-Host "[OK] Port $($portInfo.Port) ist frei" -ForegroundColor Green
    }
}

if (-not $allPortsFree) {
    Write-Host ""
    Write-Host "[FEHLER] Nicht alle Ports sind frei. Bitte beende die Prozesse manuell oder verwende stop-all.ps1" -ForegroundColor Red
    Read-Host "Drücke Enter zum Beenden"
    exit 1
}

Write-Host "[OK] Alle Ports sind frei" -ForegroundColor Green
Write-Host ""

Write-Host "[6/6] Starte alle Apps..." -ForegroundColor Yellow
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Apps werden in separaten Fenstern gestartet:" -ForegroundColor Cyan
Write-Host "- SCC-Backend (Port 3001)" -ForegroundColor White
Write-Host "- SCC-Frontend (Port 3002)" -ForegroundColor White
Write-Host "- Mailclient (Port 3000)" -ForegroundColor White
Write-Host ""
Write-Host "Zum Beenden: Verwende stop-all.ps1 oder schließe die Fenster" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Funktion zum Minimieren eines Fensters
function Minimize-Window {
    param([int]$ProcessId)
    
    Add-Type @"
        using System;
        using System.Runtime.InteropServices;
        public class Win32 {
            [DllImport("user32.dll")]
            public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
            [DllImport("user32.dll")]
            public static extern bool IsIconic(IntPtr hWnd);
            [DllImport("user32.dll")]
            public static extern IntPtr FindWindow(string lpClassName, string lpWindowName);
            [DllImport("user32.dll")]
            public static extern bool EnumWindows(EnumWindowsProc enumProc, IntPtr lParam);
            public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
            [DllImport("user32.dll")]
            public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);
        }
"@
    
    $process = Get-Process -Id $ProcessId -ErrorAction SilentlyContinue
    if ($process) {
        $windows = @()
        [Win32]::EnumWindows({
            param($hWnd, $lParam)
            $pid = 0
            [Win32]::GetWindowThreadProcessId($hWnd, [ref]$pid)
            if ($pid -eq $ProcessId) {
                $windows += $hWnd
            }
            return $true
        }, 0)
        
        foreach ($hWnd in $windows) {
            # SW_MINIMIZE = 6
            [Win32]::ShowWindow($hWnd, 6) | Out-Null
        }
    }
}

# Speichere Prozess-IDs für später
$processIds = @()

# Starte SCC-Backend
Write-Host "Starte SCC-Backend..." -ForegroundColor Gray
$backendProcess = Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd apps\scc; pnpm dev" -WindowStyle Normal -PassThru
$processIds += $backendProcess.Id
Start-Sleep -Seconds 3

# Starte SCC-Frontend
Write-Host "Starte SCC-Frontend..." -ForegroundColor Gray
$frontendProcess = Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd apps\scc-frontend; pnpm dev" -WindowStyle Normal -PassThru
$processIds += $frontendProcess.Id
Start-Sleep -Seconds 3

# Starte Mailclient
Write-Host "Starte Mailclient..." -ForegroundColor Gray
$mailclientProcess = Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd apps\mailclient; pnpm dev" -WindowStyle Normal -PassThru
$processIds += $mailclientProcess.Id
Start-Sleep -Seconds 3

# Starte Cron-Service für Scheduled Triggers
Write-Host "Starte Cron-Service (Scheduled Triggers)..." -ForegroundColor Gray
$cronProcess = Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd apps\mailclient; pnpm tsx scripts/start-cron-service.ts" -WindowStyle Normal -PassThru
$processIds += $cronProcess.Id
Start-Sleep -Seconds 2

# Warte kurz, damit die Apps starten können
Write-Host "Warte auf App-Start..." -ForegroundColor Gray
Start-Sleep -Seconds 5

# Prüfe, ob Fehler aufgetreten sind (durch Prüfung der Prozesse)
$hasErrors = $false
foreach ($pid in $processIds) {
    $proc = Get-Process -Id $pid -ErrorAction SilentlyContinue
    if (-not $proc) {
        Write-Host "[WARNUNG] Prozess $pid wurde beendet (möglicher Fehler)" -ForegroundColor Yellow
        $hasErrors = $true
    }
}

# Minimiere Fenster nur wenn keine Fehler
if (-not $hasErrors) {
    Write-Host "Minimiere Fenster..." -ForegroundColor Gray
    foreach ($pid in $processIds) {
        Minimize-Window -ProcessId $pid
        Start-Sleep -Milliseconds 500
    }
    Write-Host "[OK] Fenster minimiert" -ForegroundColor Green
} else {
    Write-Host "[WARNUNG] Fenster wurden nicht minimiert, da mögliche Fehler erkannt wurden" -ForegroundColor Yellow
}

# Speichere Prozess-IDs in temporärer Datei für stop-all.ps1
$processIds | Out-File -FilePath ".service-pids.txt" -Encoding ASCII

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Alle Apps wurden gestartet!" -ForegroundColor Green
Write-Host ""
Write-Host "URLs:" -ForegroundColor Cyan
Write-Host "- SCC-API: http://localhost:3001/api" -ForegroundColor White
Write-Host "- SCC-Frontend: http://localhost:3002" -ForegroundColor White
Write-Host "- Mailclient: http://localhost:3000" -ForegroundColor White
Write-Host "- API-Docs: http://localhost:3001/api/docs" -ForegroundColor White
Write-Host "- Cron-Service (Scheduled Triggers)" -ForegroundColor White
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Zum Beenden: Führe stop-all.ps1 aus" -ForegroundColor Yellow
Write-Host ""

