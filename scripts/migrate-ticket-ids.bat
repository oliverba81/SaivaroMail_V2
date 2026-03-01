@echo off
REM Ticket-ID Migration Script für Windows
REM Verwendung: scripts\migrate-ticket-ids.bat [--dry-run]

echo 🚀 Starte Ticket-ID Migration...
echo.

cd /d "%~dp0\.."

REM Prüfe ob Node-Module installiert sind
if not exist "node_modules\" (
    echo ⚠️  node_modules nicht gefunden. Installiere Dependencies...
    call npm install
)

REM Führe das JavaScript-Script aus
if "%1"=="--dry-run" (
    echo 📝 Dry-Run Modus (keine Änderungen)
    node scripts/migrate-ticket-ids.mjs --dry-run
) else (
    echo ⚡ Production Modus (schreibt in Datenbank)
    echo ⚠️  Drücken Sie Ctrl+C zum Abbrechen...
    timeout /t 3
    node scripts/migrate-ticket-ids.mjs
)

echo.
echo ✅ Fertig!
pause
