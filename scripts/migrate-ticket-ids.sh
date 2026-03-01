#!/bin/bash

# Ticket-ID Migration Script
# Verwendung: ./scripts/migrate-ticket-ids.sh [--dry-run]

echo "🚀 Starte Ticket-ID Migration..."
echo ""

# Wechsle ins Projekt-Verzeichnis
cd "$(dirname "$0")/.." || exit 1

# Prüfe ob Node-Module installiert sind
if [ ! -d "node_modules" ]; then
    echo "⚠️  node_modules nicht gefunden. Installiere Dependencies..."
    npm install
fi

# Führe das TypeScript-Script aus
if [ "$1" = "--dry-run" ]; then
    echo "📝 Dry-Run Modus (keine Änderungen)"
    npx tsx scripts/migrate-ticket-ids.ts --dry-run
else
    echo "⚡ Production Modus (schreibt in Datenbank)"
    echo "⚠️  Drücken Sie Ctrl+C zum Abbrechen..."
    sleep 3
    npx tsx scripts/migrate-ticket-ids.ts
fi

echo ""
echo "✅ Fertig!"
