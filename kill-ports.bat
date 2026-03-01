@echo off
echo ========================================
echo Beende Prozesse auf Ports 3000, 3001, 3002
echo ========================================
echo.

echo [1/3] Beende Prozess auf Port 3000 (Mailclient)...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000" ^| findstr "LISTENING"') do (
    echo Beende Prozess %%a...
    taskkill /F /PID %%a >nul 2>&1
    if %errorlevel% equ 0 (
        echo [OK] Port 3000 freigegeben
    ) else (
        echo [INFO] Kein Prozess auf Port 3000 gefunden
    )
)

echo.
echo [2/3] Beende Prozess auf Port 3001 (SCC-Backend)...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3001" ^| findstr "LISTENING"') do (
    echo Beende Prozess %%a...
    taskkill /F /PID %%a >nul 2>&1
    if %errorlevel% equ 0 (
        echo [OK] Port 3001 freigegeben
    ) else (
        echo [INFO] Kein Prozess auf Port 3001 gefunden
    )
)

echo.
echo [3/3] Beende Prozess auf Port 3002 (SCC-Frontend)...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3002" ^| findstr "LISTENING"') do (
    echo Beende Prozess %%a...
    taskkill /F /PID %%a >nul 2>&1
    if %errorlevel% equ 0 (
        echo [OK] Port 3002 freigegeben
    ) else (
        echo [INFO] Kein Prozess auf Port 3002 gefunden
    )
)

echo.
echo ========================================
echo Fertig!
echo ========================================
echo.
pause






