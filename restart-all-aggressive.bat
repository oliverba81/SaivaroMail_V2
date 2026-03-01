@echo off
REM restart-all-aggressive.bat
REM WARNUNG: Beendet ALLE PowerShell-Prozesse!

echo.
echo ================================================================
echo  WARNUNG: AGGRESSIVE Server Neustart
echo  Beendet ALLE PowerShell-Prozesse und Node.js Server!
echo ================================================================
echo.

powershell -ExecutionPolicy Bypass -File "%~dp0restart-all-aggressive.ps1"
