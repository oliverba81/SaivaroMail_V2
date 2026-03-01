# PowerShell-Skript zum Neustarten des SCC-Services

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "SCC-Service wird neu gestartet..." -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

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
                    return $true
                } catch {
                    Write-Host "[WARNUNG] Konnte Prozess auf Port $Port nicht beenden" -ForegroundColor Yellow
                    return $false
                }
            }
        }
    } else {
        Write-Host "[INFO] Kein Prozess auf Port $Port gefunden" -ForegroundColor Gray
        return $false
    }
}

Write-Host "[1/2] Stoppe SCC-Service auf Port 3001..." -ForegroundColor Yellow
$wasRunning = Stop-ProcessOnPort -Port 3001

if ($wasRunning) {
    Write-Host "[OK] SCC-Service gestoppt" -ForegroundColor Green
    Write-Host "[INFO] Warte 2 Sekunden..." -ForegroundColor Gray
    Start-Sleep -Seconds 2
} else {
    Write-Host "[INFO] SCC-Service war nicht aktiv" -ForegroundColor Gray
}

Write-Host ""
Write-Host "[2/2] Starte SCC-Service neu..." -ForegroundColor Yellow
Write-Host ""

# Wechsle zum SCC-Verzeichnis
Set-Location apps\scc

# Starte den Service
Write-Host "SCC-Service wird in einem neuen Fenster gestartet..." -ForegroundColor Cyan
Write-Host "Zum Beenden: Strg+C im Service-Fenster oder schließe das Fenster" -ForegroundColor Yellow
Write-Host ""

Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD'; pnpm dev" -WindowStyle Normal

Write-Host "[OK] SCC-Service wurde gestartet!" -ForegroundColor Green
Write-Host ""
Write-Host "URLs:" -ForegroundColor Cyan
Write-Host "- SCC-API: http://localhost:3001/api" -ForegroundColor White
Write-Host "- API-Docs: http://localhost:3001/api/docs" -ForegroundColor White
Write-Host ""



