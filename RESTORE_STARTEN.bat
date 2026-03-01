@echo off
echo.
echo ========================================
echo   SeivaroMail_v2 Restore starten
echo ========================================
echo.

powershell.exe -ExecutionPolicy Bypass -NoProfile -File "%~dp0restore.ps1"

echo.
echo.
pause
