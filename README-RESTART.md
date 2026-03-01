# 🔄 Server Neustart-Anleitung

## Schnellstart

### Windows

**Option 1: Doppelklick auf die Batch-Datei**
```
restart-all.bat
```

**Option 2: PowerShell-Script ausführen**
```powershell
.\restart-all.ps1
```

**Option 3: Manuell**
```bash
# Terminal öffnen
npm run dev
```

---

## Was macht `restart-all.ps1`?

1. ✅ **Stoppt alle laufenden Server-Prozesse**
   - Findet Node-Prozesse im Projekt-Verzeichnis
   - Beendet sie sauber

2. ✅ **Gibt Ports frei**
   - Prüft Ports 3000, 3001, 3002
   - Befreit blockierte Ports automatisch

3. ✅ **Installiert fehlende Dependencies**
   - Prüft auf `node_modules`
   - Führt `npm install` aus falls nötig

4. ✅ **Startet den Server neu**
   - Öffnet neues Terminal-Fenster
   - Startet `npm run dev`
   - Wartet auf Server-Start

5. ✅ **Prüft den Status**
   - Testet ob Server erreichbar ist
   - Zeigt Zugriffs-URLs an

---

## Nach dem Neustart

1. **Browser neu laden** (`F5` oder `Ctrl+R`)
2. **Bei Login-Problemen:**
   - Logout und neu einloggen
   - Username: `admin`
   - Passwort: `f9k^Sy8yQGfo`

3. **URLs:**
   - Mailclient: http://testfirma2.localhost:3000
   - Admin-Panel: http://testfirma2.localhost:3000/admin-migration.html

---

## Troubleshooting

### "Port already in use"

```powershell
# Finde Prozess auf Port 3000
netstat -ano | findstr :3000

# Beende Prozess (ersetze PID)
taskkill /PID <PID> /F
```

### "Server startet nicht"

1. Prüfe Logs im Terminal-Fenster
2. Prüfe `.env` Datei
3. Prüfe Datenbankverbindung

### "Ticket-IDs nicht sichtbar"

1. **Hard Refresh:** `Ctrl+Shift+R` (löscht Cache)
2. **Browser-Console öffnen** (`F12`)
3. **Prüfe API-Response:**
   ```javascript
   fetch('/api/emails?limit=5', {
     headers: { 'Authorization': 'Bearer ' + localStorage.getItem('mailclient_token') }
   })
   .then(r => r.json())
   .then(data => console.table(data.emails.map(e => ({
     Betreff: e.subject,
     'Ticket-ID': e.ticketId || '❌ FEHLT'
   }))));
   ```

---

## Manuelle Alternative

Falls das Script nicht funktioniert:

```bash
# 1. Alte Prozesse beenden
# Windows: Task-Manager öffnen (Ctrl+Shift+Esc)
# Suche nach "Node.js" und beende alle Prozesse

# 2. Terminal öffnen
cd C:\Users\Buero-Oliver\Documents\Cursor-Projekte\SeivaroMail_v2

# 3. Server starten
npm run dev

# 4. Browser öffnen
start http://testfirma2.localhost:3000
```

---

## Nützliche Befehle

```powershell
# Alle Node-Prozesse anzeigen
Get-Process | Where-Object {$_.Name -eq "node"}

# Port-Nutzung anzeigen
netstat -ano | findstr :3000

# Projekt-Status prüfen
npm run build  # Prüft auf Fehler
npm run lint   # Prüft Code-Qualität
```

---

## Nach jedem Code-Update

**Immer Server neu starten wenn:**
- ✅ API-Routen geändert wurden
- ✅ Server-Side Code geändert wurde
- ✅ Dependencies aktualisiert wurden
- ✅ `.env` Datei geändert wurde

**Kein Neustart nötig wenn:**
- ❌ Nur Frontend-Komponenten geändert wurden
- ❌ Nur Styles geändert wurden
- ❌ Nur TypeScript-Interfaces geändert wurden (außer API)

---

## Support

Bei Problemen:
1. Prüfe die Logs im Terminal
2. Prüfe die Browser-Console (`F12`)
3. Prüfe ob Port 3000 frei ist
4. Prüfe ob Datenbank läuft
