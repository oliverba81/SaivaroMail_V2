# Plan: E-Mail-Ladezeit optimieren – Prüfung auf Optimierungen und Fehler

## Übersicht

Beim Klick auf eine E-Mail treten Ladeverzögerungen auf. Ursache sind redundante API-Aufrufe, unnötige Delays und einige Bugs. Diese Prüfung ergänzt den ursprünglichen Plan um zusätzliche Optimierungen und behobene Fehler.

---

## 1. Redundante API-Aufrufe (bereits im ursprünglichen Plan)

| Stelle | Problem | Lösung |
|--------|---------|--------|
| `EmailPreview.loadEmailBody` | Ruft `GET /api/emails/[id]` parallel zu `loadEmailDetails` | Entfernen oder nur als Fallback bei `loading=false` |
| `EmailTimeline.loadEmailDepartment` | Ruft `GET /api/emails/[id]` nur für Department | Department aus Parent oder leichterem Endpoint |
| `useEmailState` 50ms Debounce | Verzögert `loadEmailDetails` um 50ms | Auf 0ms reduzieren |

---

## 2. Fehler und Bugs

### 2.1 TTS/Summarize: Body wird nach `loadEmailBody` nicht verwendet

**Datei:** [apps/mailclient/src/components/EmailPreview.tsx](apps/mailclient/src/components/EmailPreview.tsx)  
**Zeilen:** 229–237, 499–505

```ts
await loadEmailBody();
bodyToUse = emailBody;  // BUG: React setState ist asynchron – emailBody ist hier noch der alte Wert!
```

`loadEmailBody` ruft `setEmailBody(body)` auf. Da React-State-Updates asynchron sind, ist `emailBody` nach `await loadEmailBody()` weiterhin leer.

**Lösung:** `loadEmailBody` soll den Body zurückgeben:

```ts
const loadEmailBody = async (): Promise<string> => {
  // ... fetch ...
  const body = data.email?.body || '';
  setEmailBody(body);
  return body;
};
// Verwendung:
bodyToUse = await loadEmailBody();
```

### 2.2 Race Condition: Attachments/Body bei schnellem E-Mail-Wechsel

**Datei:** [apps/mailclient/src/components/EmailPreview.tsx](apps/mailclient/src/components/EmailPreview.tsx)  
**Funktionen:** `loadEmailBody`, `loadAttachments`

Beim schnellen Wechsel A → B kann die Antwort für A nach dem Wechsel zu B ankommen. Beide Funktionen prüfen nicht, ob `email.id` noch der aktuell gewählten E-Mail entspricht, bevor sie `setEmailBody`/`setAttachments` aufrufen.

**Lösung:** Vor dem Setzen der Daten prüfen, ob die E-Mail noch aktuell ist:

```ts
const emailIdAtStart = email?.id;
const data = await response.json();
if (email?.id !== emailIdAtStart) return;  // E-Mail gewechselt
setEmailBody(data.email?.body || '');
```

Analog für `loadAttachments`, ggf. mit `AbortController` und Request-Abbruch bei E-Mail-Wechsel.

### 2.3 `loadEmailBody` useEffect ignoriert Parent-`loading`

**Datei:** [apps/mailclient/src/components/EmailPreview.tsx](apps/mailclient/src/components/EmailPreview.tsx)  
**Zeilen:** 78–87

Der Effect startet `loadEmailBody`, sobald `!email.body` – auch wenn der Parent noch `loading=true` hat und `loadEmailDetails` parallel läuft. Dadurch entstehen doppelte Requests.

**Lösung:** Body nur laden, wenn der Parent nicht mehr lädt und der Body fehlt:

```ts
if (email && !email.body && email.id && !loading) {
  loadEmailBody();
}
```

### 2.4 Race Condition: EmailTimeline bei E-Mail-Wechsel

**Datei:** [apps/mailclient/src/components/EmailTimeline.tsx](apps/mailclient/src/components/EmailTimeline.tsx)  
**Funktionen:** `loadEvents`, `loadEmailDepartment`, `loadNotes`

Beim Wechsel von E-Mail A zu B starten neue Requests für B. Die Antworten von A können danach eintreffen und überschreiben den State von B (`setEvents`, `setEmailDepartment`, `setNotes`). Es gibt keine Prüfung `emailId` oder Abbruch bei Parameterwechsel.

**Lösung:** `cancelled`-Flag oder `emailId`-Ref im Effect, Cleanup-Funktion; vor jedem `setState` prüfen, ob `emailId` noch aktuell ist. Vorbild: `ThreadMessageAttachments` (Zeilen 60–79) mit `cancelled` und `return () => { cancelled = true; }`.

### 2.5 Race Condition: EmailPreviewPane loadNotes

**Datei:** [apps/mailclient/src/components/EmailPreviewPane.tsx](apps/mailclient/src/components/EmailPreviewPane.tsx)  
**Funktion:** `loadNotes` (Zeilen 128–157)

Analog zu 2.4: Beim schnellen E-Mail-Wechsel kann die Antwort für die vorherige E-Mail nach der für die aktuelle ankommen und `setNotes` mit falschen Daten aufrufen.

**Lösung:** E-Mail-ID bei Start merken; vor `setNotes` prüfen, ob `email.id` noch gleich ist; optional `AbortController` nutzen.

### 2.6 `loadEmailBody`: Kein Feedback bei fehlgeschlagenem Fetch

**Datei:** [apps/mailclient/src/components/EmailPreview.tsx](apps/mailclient/src/components/EmailPreview.tsx)  
**Zeilen:** 160–164

Bei `!response.ok` (z.B. 404, 500) wird weder `emailBody` gesetzt noch eine Fehlermeldung angezeigt. Der Nutzer sieht weiterhin den alten oder leeren Inhalt.

**Lösung:** Fallbehandlung für `!response.ok` ergänzen, z.B. `setEmailBody('(Inhalt konnte nicht geladen werden)')` oder Toast.

### 2.7 `formatFileSize`: Keine Behandlung negativer/ungültiger Werte

**Datei:** [apps/mailclient/src/components/EmailPreview.tsx](apps/mailclient/src/components/EmailPreview.tsx)  
**Zeile:** 214–220

Bei `bytes <= 0` oder `NaN` liefert `Math.log(bytes)` ein ungültiges Ergebnis (NaN/Infinity), was zu z.B. „NaN Bytes“ führen kann.

**Lösung:** Früher Guard: `if (bytes <= 0 || !Number.isFinite(bytes)) return '0 Bytes';`

### 2.8 Ungenutzter State `_notesLoading` in EmailPreviewPane

**Datei:** [apps/mailclient/src/components/EmailPreviewPane.tsx](apps/mailclient/src/components/EmailPreviewPane.tsx)  
**Zeile:** 98

`_notesLoading` wird gesetzt, aber nicht verwendet (kein Ladezustand für den Nutzer). Kein Bug, aber toter Code.

---

## 3. Zusätzliche Optimierungen

### 3.1 Department in `loadEmailDetails` mappen

**Datei:** [apps/mailclient/src/hooks/useEmailState.ts](apps/mailclient/src/hooks/useEmailState.ts)  
**Zeilen:** 782–799

Die API liefert `assigned_departments` und `department`, aber diese Felder werden nicht in `emailDetails` übernommen. Dadurch muss `EmailTimeline` separat die volle E-Mail laden.

**Lösung:** Department ins Mapping aufnehmen:

```ts
department: (email.assigned_departments?.[0] || email.department) || undefined,
```

Dann kann `EmailPreviewPane` `email?.department` an `EmailTimeline` übergeben und `loadEmailDepartment` entfällt.

### 3.2 Feature-Flags nicht bei jedem `EmailPreview`-Mount laden

**Datei:** [apps/mailclient/src/components/EmailPreview.tsx](apps/mailclient/src/components/EmailPreview.tsx)  
**Zeilen:** 89–126

`loadFeatures()` wird bei jedem Mount von `EmailPreview` ausgeführt. Bei Tab-Wechsel oder Re-Render kann das unnötige Requests erzeugen.

**Lösung:** Features in einem globalen Context oder per Caching laden; z.B. nur einmal pro Session oder mit `React Query` o.ä.

### 3.3 `loadAttachments` nur bei Bedarf

**Datei:** [apps/mailclient/src/components/EmailPreview.tsx](apps/mailclient/src/components/EmailPreview.tsx)  
**Zeilen:** 128–135

Anhänge werden immer geladen. Wenn die E-Mail `hasAttachment === false` hat, ist der Request überflüssig.

**Lösung:** Bedingung ergänzen:

```ts
if (email?.id && (email?.hasAttachment !== false)) {
  loadAttachments();
}
```

### 3.4 ESLint: fehlende Dependencies in useEffect

**Datei:** [apps/mailclient/src/components/EmailPreview.tsx](apps/mailclient/src/components/EmailPreview.tsx)

Der Effect mit `loadEmailBody` verwendet `loadEmailBody` nicht in den Dependencies. `loadEmailBody` hängt von `email` ab – typischer Fall für eine stabile Callback-Implementierung (z.B. mit `useCallback`) und korrekte Dependency-Liste.

---

## 4. Zusammenfassung der Änderungen

| Priorität | Thema | Datei | Aufwand |
|-----------|-------|-------|---------|
| Hoch | Redundanten `loadEmailBody` reduzieren/entfernen | EmailPreview.tsx | mittel |
| Hoch | TTS/Summarize Bug (Body-Rückgabewert) | EmailPreview.tsx | gering |
| Hoch | 50ms Debounce entfernen | useEmailState.ts | gering |
| Hoch | Department aus Parent an Timeline | useEmailState.ts, EmailPreviewPane, EmailTimeline | mittel |
| Mittel | Race-Condition bei Attachments/Body | EmailPreview.tsx | mittel |
| Mittel | Race-Condition EmailTimeline (loadEvents, loadEmailDepartment, loadNotes) | EmailTimeline.tsx | mittel |
| Mittel | Race-Condition EmailPreviewPane loadNotes | EmailPreviewPane.tsx | mittel |
| Mittel | `loading` im loadEmailBody-Effect berücksichtigen | EmailPreview.tsx | gering |
| Niedrig | loadEmailBody: Fehlermeldung bei !response.ok | EmailPreview.tsx | gering |
| Niedrig | formatFileSize: Guard für bytes ≤ 0 / NaN | EmailPreview.tsx | gering |
| Niedrig | Feature-Flags cachen | EmailPreview.tsx / Context | mittel |
| Niedrig | Attachments nur bei hasAttachment laden | EmailPreview.tsx | gering |

---

## 5. Konsolenfehler (558 Fehler)

Die hohe Zahl an Konsolenfehlern kann Rendering und Performance beeinträchtigen. Empfehlung: getrennt analysieren (React DevTools, Network-Tab, Filter für Fehlerquelle).
