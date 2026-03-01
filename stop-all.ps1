# PowerShell-Skript zum Stoppen aller Services
# Alternative zu stop-all.bat

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Saivaro Mail v2 - Stoppe alle Services" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "[1/3] Stoppe PostgreSQL-Container..." -ForegroundColor Yellow
docker compose down
if ($LASTEXITCODE -eq 0) {
    Write-Host "[OK] PostgreSQL-Container gestoppt" -ForegroundColor Green
} else {
    Write-Host "[WARNUNG] Docker Compose down fehlgeschlagen!" -ForegroundColor Yellow
}
Write-Host ""

Write-Host "[2/3] Beende Node.js-Prozesse auf Ports 3000, 3001, 3002..." -ForegroundColor Yellow

# Funktion zum Beenden eines Prozesses auf einem Port
function Stop-ProcessOnPort {
    param([int]$Port)
    
    $connections = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue | Where-Object { $_.State -eq "Listen" }
    
    if ($connections) {
        foreach ($conn in $connections) {
            $processId = $conn.OwningProcess
            if ($processId) {
                try {
                    Stop-Process -Id $processId -Force -ErrorAction Stop
                    Write-Host "[OK] Port $Port freigegeben (PID: $processId)" -ForegroundColor Green
                } catch {
                    Write-Host "[WARNUNG] Konnte Prozess auf Port $Port nicht beenden" -ForegroundColor Yellow
                }
            }
        }
    } else {
        Write-Host "[INFO] Kein Prozess auf Port $Port gefunden" -ForegroundColor Gray
    }
}

# Beende Prozesse auf den Ports
Stop-ProcessOnPort -Port 3000
Stop-ProcessOnPort -Port 3001
Stop-ProcessOnPort -Port 3002

Write-Host ""

Write-Host "[3/4] Beende alle Node.js-Prozesse (falls noch vorhanden)..." -ForegroundColor Yellow
$nodeProcesses = Get-Process -Name "node" -ErrorAction SilentlyContinue
if ($nodeProcesses) {
    $nodeProcesses | Stop-Process -Force
    Write-Host "[OK] Alle Node.js-Prozesse beendet" -ForegroundColor Green
} else {
    Write-Host "[INFO] Keine weiteren Node.js-Prozesse gefunden" -ForegroundColor Gray
}

Write-Host ""
Write-Host "[4/4] Schließe alle Service-Fenster..." -ForegroundColor Yellow

# Funktion zum Schließen von PowerShell-Fenstern basierend auf Prozess-IDs
function Close-ServiceWindows {
    # Lese gespeicherte Prozess-IDs
    if (Test-Path ".service-pids.txt") {
        $pids = Get-Content ".service-pids.txt" | Where-Object { $_ -match '^\d+$' }
        
        foreach ($processId in $pids) {
            $proc = Get-Process -Id $processId -ErrorAction SilentlyContinue
            if ($proc) {
                try {
                    # Beende den Prozess (schließt das Fenster)
                    Stop-Process -Id $processId -Force -ErrorAction Stop
                    Write-Host "[OK] Service-Fenster geschlossen (PID: $processId)" -ForegroundColor Green
                } catch {
                    Write-Host "[WARNUNG] Konnte Fenster nicht schließen (PID: $processId)" -ForegroundColor Yellow
                }
            }
        }
        
        # Lösche die Datei
        Remove-Item ".service-pids.txt" -ErrorAction SilentlyContinue
    } else {
        Write-Host "[INFO] Keine gespeicherten Prozess-IDs gefunden" -ForegroundColor Gray
    }
    
    # Beende alle PowerShell-Prozesse, die möglicherweise unsere Services sind (als Fallback)
    # Prüfe alle PowerShell-Prozesse und beende die, die auf unseren Ports lauschen
    $powershellProcesses = Get-Process -Name "powershell" -ErrorAction SilentlyContinue
    
    foreach ($proc in $powershellProcesses) {
        try {
            # Prüfe, ob der Prozess auf einem unserer Ports lauscht
            $connections = Get-NetTCPConnection -OwningProcess $proc.Id -ErrorAction SilentlyContinue | 
                Where-Object { $_.LocalPort -in @(3000, 3001, 3002) -and $_.State -eq "Listen" }
            
            if ($connections) {
                Stop-Process -Id $proc.Id -Force -ErrorAction Stop
                Write-Host "[OK] Service-Fenster geschlossen (PID: $($proc.Id))" -ForegroundColor Green
            }
        } catch {
            # Ignoriere Fehler beim Prüfen einzelner Prozesse
        }
    }
}

Close-ServiceWindows

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Fertig! Alle Services wurden gestoppt." -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""


