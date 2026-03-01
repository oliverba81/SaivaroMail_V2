# PowerShell-Skript zum Prüfen der Port-Verfügbarkeit

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Prüfe Port-Verfügbarkeit..." -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

function Test-PortInUse {
    param([int]$Port, [string]$ServiceName)
    
    $connections = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue | Where-Object { $_.State -eq "Listen" }
    
    if ($connections) {
        $pid = ($connections | Select-Object -First 1).OwningProcess
        $process = Get-Process -Id $pid -ErrorAction SilentlyContinue
        $processName = if ($process) { $process.ProcessName } else { "Unbekannt" }
        
        Write-Host "[BELEGT] Port $Port ist belegt ($ServiceName)" -ForegroundColor Red
        Write-Host "         Prozess: $processName (PID: $pid)" -ForegroundColor Gray
        return $true
    } else {
        Write-Host "[FREI]   Port $Port ist frei ($ServiceName)" -ForegroundColor Green
        return $false
    }
}

$ports = @(
    @{Port = 3000; Name = "Mailclient"},
    @{Port = 3001; Name = "SCC-Backend"},
    @{Port = 3002; Name = "SCC-Frontend"}
)

$anyPortInUse = $false

foreach ($portInfo in $ports) {
    if (Test-PortInUse -Port $portInfo.Port -ServiceName $portInfo.Name) {
        $anyPortInUse = $true
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
if ($anyPortInUse) {
    Write-Host "Einige Ports sind belegt!" -ForegroundColor Yellow
    Write-Host "Verwende stop-all.ps1 oder kill-ports.bat zum Freigeben." -ForegroundColor Yellow
} else {
    Write-Host "Alle Ports sind frei!" -ForegroundColor Green
}
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Read-Host "Drücke Enter zum Beenden"






