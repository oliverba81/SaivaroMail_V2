@echo off
echo.
echo ========================================
echo   SeivaroMail_v2 Backup starten
echo ========================================
echo.

powershell.exe -ExecutionPolicy Bypass -NoProfile -File "%~dp0backup.ps1"

echo.
echo.
pause
