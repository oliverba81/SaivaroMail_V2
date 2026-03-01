# PowerShell-Skript zum Beenden von Prozessen auf Ports 3000, 3001, 3002

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Beende Prozesse auf Ports 3000, 3001, 3002" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

function Stop-ProcessOnPort {
    param([int]$Port, [string]$ServiceName)
    
    Write-Host "Prüfe Port $Port ($ServiceName)..." -ForegroundColor Yellow
    
    $connections = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue | Where-Object { $_.State -eq "Listen" }
    
    if ($connections) {
        foreach ($conn in $connections) {
            $pid = $conn.OwningProcess
            if ($pid) {
                try {
                    $process = Get-Process -Id $pid -ErrorAction Stop
                    Write-Host "  Beende Prozess: $($process.ProcessName) (PID: $pid)..." -ForegroundColor Gray
                    Stop-Process -Id $pid -Force -ErrorAction Stop
                    Write-Host "  [OK] Port $Port freigegeben" -ForegroundColor Green
                    return $true
                } catch {
                    Write-Host "  [FEHLER] Konnte Prozess auf Port $Port nicht beenden: $_" -ForegroundColor Red
                    return $false
                }
            }
        }
    } else {
        Write-Host "  [INFO] Kein Prozess auf Port $Port gefunden" -ForegroundColor Gray
        return $true
    }
}

$ports = @(
    @{Port = 3000; Name = "Mailclient"},
    @{Port = 3001; Name = "SCC-Backend"},
    @{Port = 3002; Name = "SCC-Frontend"}
)

$allSuccess = $true

foreach ($portInfo in $ports) {
    if (-not (Stop-ProcessOnPort -Port $portInfo.Port -ServiceName $portInfo.Name)) {
        $allSuccess = $false
    }
    Write-Host ""
}

Write-Host "========================================" -ForegroundColor Cyan
if ($allSuccess) {
    Write-Host "Fertig! Alle Ports wurden freigegeben." -ForegroundColor Green
} else {
    Write-Host "Einige Ports konnten nicht freigegeben werden." -ForegroundColor Yellow
}
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Read-Host "Drücke Enter zum Beenden"






