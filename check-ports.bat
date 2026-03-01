@echo off
echo ========================================
echo Pruefe Port-Verfuegbarkeit...
echo ========================================
echo.

REM Prüfe Port 3000 (Mailclient)
netstat -ano | findstr ":3000" >nul 2>&1
if %errorlevel% equ 0 (
    echo [WARNUNG] Port 3000 ist bereits belegt (Mailclient)
    echo.
) else (
    echo [OK] Port 3000 ist frei
)

REM Prüfe Port 3001 (SCC-Backend)
netstat -ano | findstr ":3001" >nul 2>&1
if %errorlevel% equ 0 (
    echo [WARNUNG] Port 3001 ist bereits belegt (SCC-Backend)
    echo.
) else (
    echo [OK] Port 3001 ist frei
)

REM Prüfe Port 3002 (SCC-Frontend)
netstat -ano | findstr ":3002" >nul 2>&1
if %errorlevel% equ 0 (
    echo [WARNUNG] Port 3002 ist bereits belegt (SCC-Frontend)
    echo.
) else (
    echo [OK] Port 3002 ist frei
)

echo.
echo ========================================
echo Fertig!
echo ========================================
echo.
pause






