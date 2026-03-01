@echo off
REM restart-all.bat
REM Wrapper für restart-all.ps1

echo.
echo ========================================
echo  SeivaroMail - Server Neustart
echo ========================================
echo.

REM Führe PowerShell-Script aus
powershell -ExecutionPolicy Bypass -File "%~dp0restart-all.ps1"

pause
