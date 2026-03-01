# Plan: Themenzuweisung Pflicht-Einstellung (Optimiert & Korrigiert)

## Übersicht
Hinzufügen einer Firmen-Einstellung `themeRequired` (boolean), die festlegt, ob die Themenzuweisung bei E-Mails und Telefonnotizen Pflicht oder optional ist. Die Einstellung wird in `company_config` gespeichert und gilt für alle Benutzer der Firma.

## Änderungen

### 1. Datenbank-Schema (`apps/mailclient/src/lib/tenant-db-migrations.ts`)
- In `ensureCompanyConfigTableSchema()` eine Migration hinzufügen:
  - **Beim CREATE TABLE** (Zeile 1756-1767): `theme_required BOOLEAN DEFAULT false` direkt in die CREATE TABLE-Anweisung aufnehmen
  - **Bei bestehender Tabelle** (Zeile 1779-1815): Prüfen, ob `theme_required` Spalte existiert, falls nicht: `ALTER TABLE company_config ADD COLUMN theme_required BOOLEAN DEFAULT false;` hinzufügen
  - Nach dem Muster der bestehenden Migrationen (z.B. Zeile 1802-1804)

### 2. Company-Config Library (`apps/mailclient/src/lib/company-config.ts`)
- **Interface erweitern** (Zeile 4-10):
  - `themeRequired?: boolean;` zu `CompanyConfig` hinzufügen
- **getCompanyConfig() erweitern** (Zeile 26-58):
  - `theme_required` in SELECT-Query aufnehmen (Zeile 28): `SELECT openai_api_key, openai_model, elevenlabs_api_key, elevenlabs_voice_id, elevenlabs_enabled, theme_required`
  - Beim Erstellen der Standard-Konfiguration (Zeile 34-36): `theme_required` mit `false` setzen
  - **WICHTIG**: In INSERT-Query (Zeile 35): `theme_required` hinzufügen: `INSERT INTO company_config (id, openai_api_key, openai_model, elevenlabs_api_key, elevenlabs_voice_id, elevenlabs_enabled, theme_required) VALUES ('company_config', NULL, 'gpt-4o-mini', NULL, NULL, false, false)`
  - In return-Objekt (Zeile 38-44): `themeRequired: false` hinzufügen
  - In config-Objekt (Zeile 49-55): `themeRequired: row.theme_required ?? false` hinzufügen
- **saveCompanyConfig() erweitern** (Zeile 60-168):
  - `hasThemeRequired` Flag hinzufügen (analog zu `hasElevenLabsEnabled`, Zeile 69)
  - `themeRequired` Wert behandeln (analog zu `elevenlabsEnabled`, Zeile 88-90): `const themeRequired = hasThemeRequired ? Boolean(config.themeRequired) : undefined;`
  - In UPDATE-Query aufnehmen (analog zu Zeile 121-125): `if (hasThemeRequired) { updates.push(\`theme_required = $\${paramIndex}\`); values.push(themeRequired); paramIndex++; }`
  - **WICHTIG**: INSERT-Query (Zeile 134-135) erweitern: `INSERT INTO company_config (id, openai_api_key, openai_model, elevenlabs_api_key, elevenlabs_voice_id, elevenlabs_enabled, theme_required, updated_at) VALUES ('company_config', NULL, 'gpt-4o-mini', NULL, NULL, false, false, NOW())`
  - **Optional**: Verification-Query (Zeile 158-159) erweitern: `SELECT openai_api_key, openai_model, elevenlabs_api_key, elevenlabs_voice_id, elevenlabs_enabled, theme_required FROM company_config WHERE id = 'company_config'`
  - **Optional**: Verification-Log (Zeile 161-167) erweitern: `themeRequired: verifyResult.rows[0]?.theme_required` hinzufügen
  - **Console-Log erweitern** (Zeile 140-153): `hasThemeRequired` zu den Log-Parametern hinzufügen (für Konsistenz)

### 3. Settings API (`apps/mailclient/src/app/api/settings/route.ts`)
- **GET Handler erweitern** (Zeile 11-202):
  - In Standard-Response (Zeile 121-134): `themeRequired: companyConfig.themeRequired ?? false` hinzufügen
  - In normaler Response (Zeile 178-191): `themeRequired: companyConfig.themeRequired ?? false` hinzufügen
- **PATCH Handler erweitern** (Zeile 208-535):
  - `themeRequired` aus Request-Body extrahieren (Zeile 278-289)
  - **Admin-Validierung hinzufügen** (VOR dem Erstellen von `configToSave`, nach Zeile 329, vor Zeile 331):
    ```typescript
    // Validierung: Nur Admins können themeRequired ändern
    if (themeRequired !== undefined) {
      const userResult = await client.query(
        'SELECT role FROM users WHERE id = $1',
        [payload.sub]
      );
      if (userResult.rows.length === 0) {
        return NextResponse.json(
          { error: 'User nicht gefunden' },
          { status: 404 }
        );
      }
      const userRole = userResult.rows[0].role;
      if (userRole !== 'admin') {
        return NextResponse.json(
          { error: 'Nur Administratoren können diese Einstellung ändern' },
          { status: 403 }
        );
      }
    }
    ```
  - In `configToSave` aufnehmen (Zeile 333-343): `...(themeRequired !== undefined && { themeRequired: Boolean(themeRequired) })`
  - **WICHTIG**: In Response (Zeile 510-524): `themeRequired: updatedCompanyConfig.themeRequired ?? false` hinzufügen

### 4. Settings UI (`apps/mailclient/src/components/settings/SettingsGeneralTab.tsx`)
- **State hinzufügen** (Zeile 39-53):
  - `const [themeRequired, setThemeRequired] = useState(false);`
  - `const themeRequiredRef = useRef(themeRequired);`
- **Ref-Update hinzufügen** (nach Zeile 76):
  - `useEffect(() => { themeRequiredRef.current = themeRequired; }, [themeRequired]);`
- **originalConfigRef erweitern** (Zeile 78-90):
  - `themeRequired: false` hinzufügen
- **Beim Laden setzen** (Zeile 109-141):
  - In `loadFetchInterval`: `if (data.settings?.themeRequired !== undefined) { setThemeRequired(data.settings.themeRequired); originalConfigRef.current.themeRequired = data.settings.themeRequired; }`
- **UI-Element hinzufügen** (nach Zeile 596, vor dem Speichern-Button bei Zeile 654):
  - Neues Card-Element oder innerhalb des ElevenLabs-Cards (nach Voice-ID, vor den Buttons)
  - Checkbox/Toggle mit Label "Themenzuweisung ist Pflicht"
  - Beschreibung: "Wenn aktiviert, muss bei E-Mails und Telefonnotizen ein Thema ausgewählt werden"
  - Platzierung: Nach dem ElevenLabs-Bereich, vor dem Speichern-Button (Zeile 654-671)
- **Auto-Save erweitern** (Zeile 163-190):
  - `themeRequired` zu den Dependencies hinzufügen
  - In `hasChanges` Prüfung aufnehmen: `themeRequired !== originalConfigRef.current.themeRequired`
- **Unsaved Changes erweitern** (Zeile 148-160):
  - `themeRequired !== originalConfigRef.current.themeRequired` hinzufügen
- **handleSaveSettings erweitern** (Zeile 202-329):
  - `const currentThemeRequired = themeRequiredRef.current ?? themeRequired;` hinzufügen
  - In `requestBody` (Zeile 220-227): `themeRequired: currentThemeRequired` hinzufügen

### 5. E-Mail Compose (`apps/mailclient/src/app/emails/compose/page.tsx`)
- **State hinzufügen** (Zeile 40):
  - `const [themeRequired, setThemeRequired] = useState(false);`
- **Beim Laden setzen** (in `loadDepartments`, Zeile 273-290):
  - Nach `const settingsData = await settingsResponse.json();` (Zeile 274):
  - `if (settingsData.settings?.themeRequired !== undefined) { setThemeRequired(settingsData.settings.themeRequired); }`
- **Label dynamisch anpassen** (Zeile 601-613):
  - Wenn `themeRequired === true`: `Thema: <span style={{ color: '#dc3545' }}>*</span>`
  - Wenn `themeRequired === false`: `Thema (optional)`
- **Validierung hinzufügen** (in `handleSubmit`, nach Zeile 459, vor Zeile 461):
  - `if (themeRequired && (!themeId || themeId.trim() === '')) { setError('Bitte wählen Sie ein Thema aus'); return; }`
  - **Hinweis**: Prüft sowohl `!themeId` (für undefined/null/leerer String) als auch `themeId.trim() === ''` (für Whitespace-Strings)
- **Select-Feld anpassen** (Zeile 617-629):
  - `required={themeRequired}` Attribut hinzufügen

### 6. Telefonnotiz Compose (`apps/mailclient/src/app/emails/compose/phone-note/page.tsx`)
- **State hinzufügen** (nach Zeile 25):
  - `const [themeRequired, setThemeRequired] = useState(false);`
- **Beim Laden setzen** (in `loadDepartments`, Zeile 176-191):
  - Nach `const settingsData = await settingsResponse.json();` (Zeile 177):
  - `if (settingsData.settings?.themeRequired !== undefined) { setThemeRequired(settingsData.settings.themeRequired); }`
- **Label dynamisch anpassen** (Zeile 545-557):
  - Wenn `themeRequired === true`: `Thema: <span style={{ color: '#dc3545' }}>*</span>`
  - Wenn `themeRequired === false`: `Thema: <span style={{ color: '#6c757d', fontWeight: 'normal' }}>(optional)</span>`
- **Validierung hinzufügen** (in `handleSubmit`, nach Zeile 318, vor Zeile 320):
  - `if (themeRequired && (!themeId || themeId.trim() === '')) { setError('Bitte wählen Sie ein Thema aus'); return; }`
  - **Hinweis**: Prüft sowohl `!themeId` (für undefined/null/leerer String) als auch `themeId.trim() === ''` (für Whitespace-Strings)
- **Select-Feld anpassen** (Zeile 561-579):
  - `required={themeRequired}` Attribut hinzufügen

### 7. Backend Validierung (`apps/mailclient/src/app/api/emails/route.ts`)
- **Imports hinzufügen** (Zeile 1-5):
  - `import { getCompanyConfig } from '@/lib/company-config';` hinzufügen
  - `import { ensureCompanyConfigTableSchema } from '@/lib/tenant-db-migrations';` hinzufügen
- In `POST` Handler (Zeile 470):
  - **WICHTIG**: Nach dem Erstellen des `client` (Zeile 589, nach `try {`):
  - **WICHTIG**: Stelle sicher, dass `resolvedCompanyId` verfügbar ist (wird bereits in Zeile 566-573 aufgelöst)
  - **WICHTIG**: Falls `resolvedCompanyId` noch `null` ist (nur bei `companySlug`), muss es erneut aufgelöst werden:
    ```typescript
    // Falls resolvedCompanyId noch null ist (nur bei companySlug), löse es erneut auf
    if (!resolvedCompanyId && companySlug) {
      const { getCompanyDbConfigBySlug } = await import('@/lib/scc-client');
      const dbConfig = await getCompanyDbConfigBySlug(companySlug);
      if (dbConfig) {
        resolvedCompanyId = dbConfig.companyId;
      }
    }
    // Falls immer noch null, verwende companyId aus payload (falls vorhanden)
    if (!resolvedCompanyId && payload.companyId) {
      resolvedCompanyId = payload.companyId;
    }
    // Falls immer noch null, Fehler zurückgeben (sollte nicht passieren)
    if (!resolvedCompanyId) {
      return NextResponse.json(
        { error: 'Company-ID konnte nicht aufgelöst werden' },
        { status: 400 }
      );
    }
    ```
  - **WICHTIG**: Stelle sicher, dass `company_config` Tabelle existiert: `await ensureCompanyConfigTableSchema(client, resolvedCompanyId);`
  - **Hinweis**: `resolvedCompanyId` sollte nach der Auflösung immer verfügbar sein, da sonst ein Fehler zurückgegeben wird (Zeile 583-586)
  - `companyConfig` laden: `const companyConfig = await getCompanyConfig(client);`
  - Nach der `departmentId` Validierung (Zeile 557-563):
  - Wenn `companyConfig.themeRequired === true` und `(!themeId || (typeof themeId === 'string' && themeId.trim() === ''))`:
    - Fehler zurückgeben: `{ error: 'Bitte wählen Sie ein Thema aus' }` (Status 400)
  - **Hinweis**: Prüft sowohl `!themeId` (für undefined/null) als auch leere/Whitespace-Strings
  - **Hinweis**: `companyConfig` sollte früh geladen werden, damit es für die Validierung verfügbar ist
  - **Hinweis**: `ensureCompanyConfigTableSchema` muss VOR `getCompanyConfig` aufgerufen werden, da `getCompanyConfig` davon ausgeht, dass die Tabelle existiert

## Konsistenz & Fehlerbehandlung

### Fehlermeldungen (einheitlich)
- Frontend: "Bitte wählen Sie ein Thema aus"
- Backend: "Bitte wählen Sie ein Thema aus" (identisch)

### Reply/Forward-Verhalten
- Beim Reply/Forward wird das Thema bereits übernommen (Zeile 158-159, 170-171 in compose/page.tsx)
- Wenn `themeRequired` aktiv ist und das Original kein Thema hat, wird durch die Validierung abgedeckt
- Keine zusätzlichen Änderungen nötig

### Caching & Performance
- Compose-Seiten können die Einstellung beim ersten Laden cachen
- Optional: localStorage für `themeRequired` (aber nicht kritisch, da es sich selten ändert)

## Dateien

- `apps/mailclient/src/lib/tenant-db-migrations.ts` - Migration für `theme_required` Spalte
- `apps/mailclient/src/lib/company-config.ts` - Interface und Funktionen erweitern (inkl. INSERT-Query und Verification)
- `apps/mailclient/src/app/api/settings/route.ts` - GET/PATCH Handler erweitern mit Admin-Validierung und Response
- `apps/mailclient/src/components/settings/SettingsGeneralTab.tsx` - UI für Einstellung hinzufügen, Auto-Save, Unsaved Changes
- `apps/mailclient/src/app/emails/compose/page.tsx` - Validierung und dynamisches Label (Settings in loadDepartments)
- `apps/mailclient/src/app/emails/compose/phone-note/page.tsx` - Validierung und dynamisches Label (Settings in loadDepartments)
- `apps/mailclient/src/app/api/emails/route.ts` - Backend-Validierung hinzufügen, getCompanyConfig und ensureCompanyConfigTableSchema importieren

## Reihenfolge der Implementierung

1. Datenbank-Migration (muss zuerst ausgeführt werden)
2. Company-Config Library erweitern (Interface, getCompanyConfig, saveCompanyConfig inkl. INSERT/Verification)
3. Settings API erweitern (GET + PATCH mit Admin-Validierung + Response)
4. Settings UI erweitern (State, Auto-Save, Unsaved Changes)
5. Frontend-Validierung in beiden Compose-Seiten (Settings in loadDepartments)
6. Backend-Validierung (Import + Validierung)

## Wichtige Korrekturen

1. ✅ `saveCompanyConfig()` INSERT-Query muss `theme_required` enthalten
2. ✅ `saveCompanyConfig()` Verification-Query sollte `theme_required` prüfen (optional)
3. ✅ Settings API PATCH Response muss `themeRequired` zurückgeben
4. ✅ Email Compose: `themeRequired` aus `loadDepartments` Settings extrahieren
5. ✅ Phone Note Compose: `themeRequired` aus `loadDepartments` Settings extrahieren (bereits vorhanden)
6. ✅ Backend-Validierung: Import von `getCompanyConfig` hinzufügen
7. ✅ `getCompanyConfig()` SELECT-Query muss `theme_required` enthalten
8. ✅ `getCompanyConfig()` INSERT-Query muss `theme_required` enthalten (beim Erstellen neuer Config)
9. ✅ Admin-Validierung muss VOR dem Erstellen von `configToSave` sein
10. ✅ Console-Log in `saveCompanyConfig` sollte `hasThemeRequired` enthalten
11. ✅ UI-Platzierung: Nach ElevenLabs-Bereich (nach Zeile 596), vor Speichern-Button (Zeile 654)
12. ✅ Backend-Validierung: `companyConfig` sollte früh geladen werden (nach Client-Erstellung)
13. ✅ Backend-Validierung: `ensureCompanyConfigTableSchema` muss VOR `getCompanyConfig` aufgerufen werden
