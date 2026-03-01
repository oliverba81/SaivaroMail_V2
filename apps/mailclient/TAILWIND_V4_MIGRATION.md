# Tailwind CSS v4 Migration

## Durchgeführte Änderungen

### 1. Installation
- Tailwind CSS v4.1.18 installiert
- @tailwindcss/postcss Plugin installiert

### 2. PostCSS Konfiguration
- `postcss.config.js` aktualisiert: Verwendet jetzt `@tailwindcss/postcss` statt `tailwindcss`
- `autoprefixer` entfernt (in Tailwind v4 enthalten)

### 3. CSS-Konfiguration
- `globals.css` aktualisiert: Verwendet `@import "tailwindcss"` statt `@tailwind` Direktiven
- Theme-Farben in `@theme` Block definiert:
  - primary, primary-hover
  - danger, danger-hover
  - success, success-hover
  - warning, warning-hover
  - secondary, secondary-hover

### 4. Konfigurationsdateien
- `tailwind.config.js` entfernt (v4 verwendet CSS-basierte Konfiguration)

### 5. Komponenten-Updates
- Button-Komponente: Verwendet jetzt Theme-Farben (bg-primary statt bg-[#007bff])
- SettingsDashboard: Verwendet Theme-Farben
- Alle Komponenten nutzen jetzt die definierten Theme-Farben

## Vorteile von Tailwind v4

1. **Schnellere Builds**: Optimierte Engine für bessere Performance
2. **CSS-basierte Konfiguration**: Einfacher zu verwalten, direkt in CSS
3. **Automatisches Autoprefixing**: Kein separates Plugin nötig
4. **Bessere Tree-Shaking**: Nur verwendete Styles werden eingebunden
5. **Modernere CSS-Features**: Unterstützung für neueste CSS-Standards

## Nächste Schritte

1. **Dev-Server neu starten**:
   ```bash
   cd apps/mailclient
   pnpm dev
   ```

2. **Build-Cache löschen** (falls nötig):
   ```bash
   rm -rf .next
   ```

3. **Testen**: Überprüfen Sie, ob alle Styles korrekt geladen werden

## Bekannte Unterschiede zu v3

- Keine `tailwind.config.js` mehr nötig
- Konfiguration erfolgt direkt in CSS mit `@theme`
- Content-Pfade werden automatisch erkannt
- `@tailwind` Direktiven durch `@import "tailwindcss"` ersetzt


