# Changelog

Alle wichtigen Änderungen an diesem Projekt werden in dieser Datei dokumentiert.

Das Format basiert auf [Keep a Changelog](https://keepachangelog.com/de/1.0.0/),
und dieses Projekt folgt [Semantic Versioning](https://semver.org/lang/de/).

## [Unreleased]

### Geändert

#### Mailclient: AI-Zusammenfassung – Provider-Auswahl & Quota-Handling
- E-Mail-Zusammenfassungen können nun wahlweise über **OpenAI** oder **Google Gemini** generiert werden (pro Firma konfigurierbar).
- Die AI-Konfiguration (Provider, Modell, API-Keys) wird zentral in der Tabelle `company_config` gespeichert; neue Spalten: `ai_provider`, `gemini_api_key`, `gemini_model`.
- Die Einstellungs-API (`GET/PATCH /api/settings`) liefert die neuen Felder aus und validiert alle API-Keys.
- Bei Quota-Fehlern (HTTP 429 / `RESOURCE_EXHAUSTED` etc.) von Gemini wird eine klare Fehlermeldung zurückgegeben; das Frontend zeigt diese über einen Toast an.

#### Mailclient: Rich-Text-Editor von TipTap auf TinyMCE umgestellt
- **Nachrichtenfeld (Body) und Signatur-Editor** verwenden nun TinyMCE statt TipTap.
- Formatierung (Fett, Kursiv, Links, Listen, Bilder etc.) und HTML-Signatur werden weiterhin korrekt angezeigt und gesendet.
- API-Key über `NEXT_PUBLIC_TINYMCE_API_KEY` in `apps/mailclient/.env`; Konfiguration in `SignatureEditor.tsx`.

#### Mailclient: Compose und Antworten über ReplyComposer-Tab
- **Compose- und Telefonnotiz-Seiten entfernt**: Die separaten Seiten `/emails/compose` und `/emails/compose/phone-note` gibt es nicht mehr.
- **„Neu…“ (E-Mail/Telefonnotiz) und Antworten** öffnen den ReplyComposer als Tab auf der E-Mail-Seite (`/emails`).
- Redirects in `next.config.js` leiten `/emails/compose` und `/emails/compose/phone-note` nach `/emails` um.
- Links in `EmailToolbar` und `EmailList` öffnen den ReplyComposer-Tab (neue E-Mail, Telefonnotiz oder Antwort).

#### Mailclient: Signatur bei Antworten – ein Effect, keine Race Condition
- **Reply-Body wird an einer Stelle gesetzt**: Ein Effect in `ReplyComposer` setzt den Body einmalig, sobald E-Mail und Abteilungen geladen sind: Leerzeile + Signatur (ohne abschließende Leerabsätze) + Leerzeile + Trennlinie (`<hr>`) + Zitat.
- **Hilfsfunktionen** in `signature-placeholders.ts`: `trimTrailingEmptyParagraphs` (entfernt abschließende leere `<p>…</p>` in der Signatur), `collapseEmptyParagraphsBeforeHr` (reduziert Leerabsätze direkt vor `<hr>` auf eine Leerzeile; optional mit `expectedHrIndex`).
- **Ref-Logik**: `signatureAppendedForReplyIdRef` wird nur bei Wechsel des Antwort-Kontexts (`replyToId`) zurückgesetzt (`prevReplyToIdRef`), nicht bei jedem Re-Render.
- Bei E-Mail-Antwort wird der Body in `loadEmail` nicht mehr gesetzt; nur der eine Effect baut den vollständigen Body (Signatur + Zitat).

### Hinzugefügt

#### Mailclient: Erledigt-Markierung beim Senden (ReplyComposer)
- **Zwei Schalter** im ReplyComposer (oberhalb von „Senden“):
  - **„Ursprung beim Senden erledigen“** (nur im Antwort-Modus sichtbar): Markiert die Ursprungsnachricht (`replyToId`) nach erfolgreichem Versand als erledigt.
  - **„Aktuelle Nachricht nach dem Senden erledigen“** (immer sichtbar): Markiert die gerade gesendete bzw. erstellte Nachricht (Antwort oder neue E-Mail/Telefonnotiz) als erledigt.
- Beide Schalter standardmäßig aktiviert (`useState(true)`).
- **Erfolgsbestätigung**: Kurze, sich selbst ausblendende Meldung nach dem Senden.
- **Fehlerbehandlung**: Bei fehlgeschlagener Erledigt-Markierung (PATCH) dezente, sich selbst ausblendende Fehlermeldung; Versand gilt weiterhin als erfolgreich.
- **Accessibility**: Schalter als `role="switch"` mit `aria-checked` und `aria-label`; Tastaturbedienung (Space/Enter) auf dem Label; versteckter Checkbox-Input mit `readOnly`, `tabIndex={-1}`, `aria-hidden` zur Vermeidung von Fokus und Scroll-into-View.
- **Layout-Fix**: `preventDefault()` in `onMouseDown`/`onClick` des Label verhindert Fokus auf dem Input und damit unerwünschtes Scrollen des Tab-Layouts.
- Implementiert in `apps/mailclient/src/components/reply/ReplyComposer.tsx`.

#### Kontaktverwaltung (Kontakte) in den Einstellungen
- **Einstellungen → Kontakte**: Neuer Bereich im Einstellungs-Dashboard mit Karte „Kontakte“ (Icon: FiBook); Anzahl der Kontakte wird nur im Untermenü (Kontakte-Tab) angezeigt, nicht auf der Übersichtskarte.
- **CRUD**: Kontakte anlegen, bearbeiten und löschen. Anlegen und Bearbeiten in einem mittelgroßen Modal (max. 640 px, scrollbar); Löschen mit Bestätigungsdialog („Löschen?“ Ja/Nein).
- **Kontaktfelder**: Vorname, Nachname, Firma, Kundennummer (optional), Anredeform (Du/Sie) mit Hinweis-Icon, Anrede für Briefe (Herr/Frau/Divers), Geburtstag, Notiz, Profilbild (Upload oder URL, optional entfernen).
- **Mehrfachangaben**: Mehrere Telefonnummern, E-Mail-Adressen und Anschriften pro Kontakt mit Bezeichnung (Label) und dynamischem Hinzufügen/Entfernen; beim Erstellen zunächst nur „Hinzufügen“-Button sichtbar, erste Zeile erscheint nach Klick.
- **Profilbild**: Upload (JPEG/PNG/GIF/WebP) oder URL; Vorschau im Formular und in der Kontaktliste (Thumbnail bzw. Initialen-Fallback).
- **Kontaktliste**: Tabelle mit Profilbild, Name, Firma, E-Mail, Telefon, Kundennr., Aktionen (Bearbeiten, Löschen); Suchfeld (Name, E-Mail, Telefon, Firma, Kundennummer); Spaltenüberschriften linksbündig; Hover-Hinweise bei Aktionen („Kontakt bearbeiten“, „Kontakt löschen“ usw.).
- **API**: GET/POST `/api/contacts`, GET/PATCH/DELETE `/api/contacts/[id]` mit Tenant- und Auth-Check; GET unterstützt `?q=...` (Suche) und `?email=...` (Lookup); POST/PATCH in Transaktion inkl. Telefon/E-Mail/Adressen.
- **Datenbank**: Tabellen `contacts`, `contact_phones`, `contact_emails`, `contact_addresses` in der Tenant-DB (Migration in `ensureUsersTableSchema`); `avatar_url` und `customer_number` optional; Kind-Tabellen mit ON DELETE CASCADE.

#### Workflow-Editor: Bedingungsknoten und Aktionen erweitert
- **Bedingungsknoten**
  - Neue Felder: Dringlichkeit, Thema, Lesestatus, Erledigt-Status, Anhang, Typ, Telefonnummer (zusätzlich zu Betreff, Von, An, Inhalt).
  - Neue Operatoren: Ist leer, Ist nicht leer, Ungleich, Entspricht RegEx.
  - Feldabhängige Wert-Eingaben: Dropdowns für Typ (E-Mail/Telefonnotiz), Dringlichkeit (Niedrig/Mittel/Hoch), Thema (Liste der Themen), Lesestatus (Gelesen/Ungelesen), Erledigt-Status (Erledigt/Unerledigt), Anhang (Hat Anhang/Kein Anhang); Textfeld mit RegEx-Hinweis bei „Entspricht RegEx“.
  - Mehrfachbedingungen: Ein Bedingungsknoten kann mehrere Einzelbedingungen enthalten, Verknüpfung wählbar (AND oder OR); UI: „Mehrere Bedingungen (AND/OR) verwenden“, Bedingungen hinzufügen/entfernen; Darstellung auf dem Canvas z. B. „3 Bedingungen (AND)“.
- **Neue Aktionen**
  - Als erledigt markieren / Als unerledigt markieren
  - Als gelesen markieren / Als ungelesen markieren
  - Als gelesen und erledigt markieren (kombinierter Baustein)
- **Datenbasis**
  - `EmailDataForAutomation` um `read`, `completed`, `hasAttachment` (und ggf. `userEmail`) erweitert; alle Stellen, die diese Daten für die Workflow-Ausführung bereitstellen (z. B. PATCH E-Mail, apply-rules, execute, scheduled execute, E-Mail-Abruf, POST E-Mail), liefern diese Felder aus der Datenbank bzw. dem Kontext.

#### Anhang-Symbol in Übersichten und Thread-Ansicht
- **Listen-, Tabellen- und Konversationsansicht**: E-Mails mit Anhängen zeigen ein Büroklammer-Symbol (📎) direkt neben dem E-Mail-/Telefon-Symbol in der Betreffzeile (`EmailListItem`, `EmailTableItem`, `EmailListGrouped`).
- **Thread-Ansicht**: Bei Nachrichten mit Anhängen wird ein Büroklammer-Symbol neben dem Typ-Symbol angezeigt. Unter jeder Nachricht werden die Anhänge geladen und mit Dateiname, Größe und Download-Button angezeigt (`EmailThreadView.tsx`, Thread-API liefert `hasAttachment`, Anhänge pro Nachricht über `GET /api/emails/[id]/attachments`).

#### HTML-Editor für E-Mail-Body (Compose)
- **Rich-Text-Editor beim Verfassen**: Das Nachrichtenfeld („Neue E-Mail“ / ReplyComposer) verwendet den gleichen TinyMCE-basierten Editor wie die Signatur (SignatureEditor) statt eines einfachen Textfelds (zuvor TipTap, siehe „Geändert“).
- **Formatierung**: Fett, Kursiv, Unterstreichen, Links, Farben, Ausrichtung, Überschriften, Listen, Zitate, Trennlinien, Bilder.
- **Reply/Forward**: Plain-Text aus Antwort-/Weiterleitung-Vorlagen wird für die Anzeige in HTML umgewandelt; Signatur und Firmen-Platzhalter werden als HTML eingefügt.

#### Kommentare zu E-Mails
- **Kommentar-Funktion**: An jede E-Mail (und Telefonnotiz) können Kommentare angehängt werden; Autor und Datum werden angezeigt.
- **Vorschau**: Kommentarbereich in der E-Mail-Vorschau (unten rechts), ein- und ausklappbar; Timeline zeigt Kommentare als Ereignisse; Mailliste zeigt Symbol, ob Kommentare vorhanden sind.
- **Filter & Suche**: Filter „Hat Kommentare“/„Ohne Kommentare“; Suchfeld „Kommentare“ für Volltextsuche in Kommentarinhalten.
- **Thread-Ansicht**: Kommentare werden pro Nachricht im Thread angezeigt (hellgelbe Box unter der Nachricht); optionales Mitschicken von Kommentaren bei Weiterleitung, Kontextmenü „Kommentar hinzufügen“, Bearbeiten/Löschen eigener Kommentare, Zeichenlimit 2000.

#### Layout-Preferences benutzerbezogen speichern
- **E-Mail-Seite**: Timeline (offen/geschlossen), Listenbreite, Timeline-Höhe und Thread-View (AN/AUS) werden pro Benutzer in der Datenbank gespeichert statt im Browser (localStorage).
- **Einstellungs-Dashboard**: Die Reihenfolge der Karten (E-Mail Konten, Filter, Themen, etc.) wird pro Benutzer serverseitig gespeichert.
- **Technik**: Neue Spalte `layout_preferences` (JSONB) in `user_settings`; GET/PATCH `/api/settings` lesen und schreiben `layoutPreferences`; partielle Updates werden mit bestehenden Werten zusammengeführt (Merge).
- **Frontend**: `useEmailState` lädt und speichert Layout-Preferences; `useEmailResize` erhält Initialwerte von der API und meldet Änderungen debounced (400 ms) zurück; Thread-View und Kartenreihenfolge laufen über dieselbe API.

#### E-Mail-Signaturen (Abteilungen)
- **HTML- und Plaintext-Signaturen pro Abteilung**: Abteilungen können optional eine E-Mail-Signatur haben (HTML über TinyMCE-Editor oder reiner Text; zuvor TipTap).
- **Datenbank**: Spalte `signature_plain` (TEXT) in `departments` via Tenant-Migration; API GET/POST/PATCH für Abteilungen um `signaturePlain` erweitert.
- **Signatur-Editor**: `SignatureEditor.tsx` (TinyMCE) für HTML-Signatur; zweites Feld für Plaintext-Signatur; Hilfsfunktionen `looksLikeHtml`, `stripHtml`, `isEmptyEditorHtml`, `trimTrailingEmptyParagraphs`, `collapseEmptyParagraphsBeforeHr`, `replaceSignaturePlaceholders` in `signature-placeholders.ts`.
- **Compose & Telefonnotiz**: Beim Verfassen (E-Mail oder Telefonnotiz) wird die Signatur der gewählten Abteilung automatisch eingefügt (am Anfang des Textes); bei Antworten wird die Signatur dem Antworttext vorangestellt (ein Effect setzt Body = Signatur + Trennlinie + Zitat).
- **Versand**: POST `/api/emails` unterstützt HTML-E-Mails (multipart/alternative mit HTML- und Plaintext-Teil); Plaintext-Felder erhalten nur die Plaintext-Signatur.

#### Reply-Locks in Konversationen und Thread-Ansicht
- **Konversationsansicht (gruppierte Liste)**: Badge „In Bearbeitung: [Name]“ im Konversations-Header (`EmailListGrouped`), wenn mindestens eine E-Mail der Konversation von einem anderen Benutzer gesperrt ist (Reply-Lock).
- **Thread-Ansicht**: Thread-API (`GET /api/emails/[id]/thread`) lädt Reply-Locks für alle Thread-E-Mails; pro Nachricht wird `replyLock: { userId, userName }` in der Response mitgeliefert. TTL-Filter und Fehlerbehandlung für fehlende Tabellen/Spalten (42P01, 42703).
- **Thread-Ansicht – Badge und Antworten-Button**: Pro Nachricht im Thread wird ein Badge „In Bearbeitung: [Name]“ angezeigt, wenn die E-Mail von einem anderen Benutzer gesperrt ist; „Antworten“-Button pro Nachricht ruft `onReplyToEmail(emailId)` auf und ist deaktiviert, wenn die E-Mail gesperrt ist.
- **Callback-Kette**: `onReplyToEmail` und `currentUserId` werden von `EmailPageLayout` über `EmailPreviewPane` und `EmailPreview` an `EmailThreadView` durchgereicht.

### Behoben

#### E-Mail-Liste: Fokus und Hervorhebung beim Klicken
- **Problem**: Beim Klicken auf eine E-Mail in der Liste wurde die Hervorhebung (blaues Highlight) nicht zuverlässig aktualisiert.
- **Fix**: `flushSync` entfernt (führte zu `TypeError: flushSync is not a function`); direkter Aufruf von `setSelectedEmailId(emailId)`. In `EmailListItem` und `EmailListGrouped` wurde `e.stopPropagation()` in den `onClick`-Handlern ergänzt, damit Klicks nicht von übergeordneten Elementen abgefangen werden.
- **Visuelle Hervorhebung**: Kräftigeres Blau und dickere linke Border für den aktiven Listeneintrag; Auswahl-Highlight hat Vorrang vor „Antwort offen“-Zuständen.

#### E-Mail-Liste: Highlight-Synchronisierung beim Tab-Wechsel
- **Problem**: Beim Wechseln zwischen Vorschau-Tab und Antwort-Tabs wechselte das blaue Highlight in der Liste nicht mit.
- **Fix**: In `EmailPageLayout` wird beim Klick auf eine E-Mail in der Liste `activeRightPane` auf `'preview'` gesetzt, bevor die Auswahl übernommen wird. Zwei `useEffect`-Hooks: (1) setzt `activeRightPane` auf `'preview'`, wenn der aktive Reply-Tab geschlossen wird; (2) setzt beim Öffnen eines neuen Reply-Tabs `activeRightPane` auf die ID des neuen Tabs. In `EmailList` und `EmailListGrouped` wird `listActiveId = activeReplyToId ?? selectedEmailId ?? null` für die Hervorhebung verwendet, sodass die aktive E-Mail in der Liste mit dem sichtbaren Tab übereinstimmt.

#### Konversationsansicht: React-Warnung „Cannot update a component (HotReload) while rendering“
- **Ursache**: Der Virtualizer (`@tanstack/react-virtual`) in der gruppierten Konversationsansicht löste während des Renders setState aus und führte zu einer Endlosschleife sowie zur Warnung.
- **Fix**: Virtualisierung in `EmailListGrouped` entfernt; die Liste wird per einfachem `flatItems.map()` gerendert. Keine setState-Aufrufe mehr während des Renders, Warnung verschwindet.

#### Konversationsansicht: Doppeltes Telefon-Symbol bei Telefonnotizen
- In der Konversationsansicht wurde bei Telefonnotizen das Telefon-Symbol zweimal angezeigt (einmal neben der Telefonnummer, einmal in der Betreff-Zeile). Das zweite Symbol in der Betreff-Zeile wurde entfernt.

#### Einstellungen Abteilungen: Nicht alle Abteilungen angezeigt
- **Problem behoben: Im Tab „Abteilungen“ in den Einstellungen wurden nur aktive Abteilungen angezeigt**
  - Die Einstellungsseite lud nur aktive Abteilungen und übergab sie an den Abteilungen-Tab; der Tab lud seine eigene Liste (inkl. inaktiver) nur bei leeren Props und daher nie, wenn bereits aktive Abteilungen vorhanden waren.
  - Fix in `apps/mailclient/src/components/settings/SettingsDepartmentsTab.tsx`: Beim Öffnen des Tabs wird nun immer die vollständige Liste mit `includeInactive=true` geladen, sodass alle Abteilungen (aktiv und inaktiv) in der Verwaltung sichtbar sind.

#### Ungelesene E-Mails werden beim Öffnen automatisch als gelesen markiert
- **Problem behoben: Ungelesene E-Mails blieben dauerhaft ungelesen**
  - Beim Öffnen einer E-Mail (Klick in der Liste) wurde der Gelesen-Status nicht aktualisiert
  - Fix in `apps/mailclient/src/hooks/useEmailState.ts`: Beim Öffnen einer ungelesenen E-Mail wird nun automatisch `performMarkAsRead` aufgerufen (optimistisches UI-Update + API-PATCH)
  - Gilt für beide Fälle: E-Mail aus Cache und E-Mail aus Liste; manuelles „Als gelesen/ungelesen“ über Toolbar oder Shortcuts bleibt unverändert

#### React-Fehler beim Start: handleMarkAsRead vor Initialisierung
- **Problem behoben: "Cannot access 'handleMarkAsRead' before initialization"**
  - Keyboard-Shortcut `useEffect` wird nun erst nach der Definition von `handleMarkAsRead` und `handleUndo` registriert
  - Fix in `apps/mailclient/src/hooks/useEmailState.ts`

#### Vorschau- und Antwort-Tab: Scrollen funktioniert nicht
- **Problem behoben: Der Vorschaubereich und der Antwort-Tab ließen sich nicht scrollen**
  - Ursache: Flex-Layout ohne `min-height: 0` und ReplyComposer mit `h-full` füllte den Scroll-Container exakt, sodass kein Überlauf entstand.
  - Fix in `EmailPreviewPane.tsx`: Vorschau-Panel und Antwort-Panels mit `min-h-0` ergänzt; Vorschau-Tab-Inhalt in scrollbaren Container (`flex-1 min-h-0 overflow-y-auto`) gepackt.
  - Fix in `EmailPageLayout.tsx`: Preview-Pane-Container mit `minHeight: 0` für korrekte Flex-Höhenkette.
  - Fix in `ReplyComposer.tsx`: Wurzel-Container von `h-full` auf `min-h-0` geändert, damit der Inhalt mitwächst und der Tab-Container scrollbar wird.
  - Vorschau-Tab und Antwort-Tabs sind nun bei langem Inhalt vollständig scrollbar.

#### E-Mail-Filter: "Alle Mails" zeigt wieder alle Mails an
- **Problem behoben: Custom-Filter blieb aktiv nach Klick auf "Alle Mails"**
  - `customFilterId` wurde nicht korrekt zurückgesetzt, wenn auf "Alle Mails" geklickt wurde
  - Dadurch wurden gelöschte und erledigte E-Mails nicht angezeigt
  - Fix in `apps/mailclient/src/hooks/useEmailState.ts`: `customFilterId` wird jetzt korrekt auf `null` gesetzt, wenn keine URL-Parameter vorhanden sind
  - "Alle Mails" zeigt jetzt wieder alle E-Mails an (inklusive gelöschter, erledigter, etc.)

#### Abteilung: Signatur (signaturePlain) wurde nicht gespeichert
- **Problem behoben: "Fehler beim Aktualisieren der Abteilung" beim Speichern der Signatur**
  - `signaturePlain` wurde im PATCH-Handler nicht aus dem Request-Body übernommen und nicht in RETURNING zurückgegeben
  - Fix in `apps/mailclient/src/app/api/departments/[id]/route.ts`: `signaturePlain` in Body-Destructuring und RETURNING ergänzt

#### SCC-Frontend: Placeholder-Syntax führte zu ModuleParseError
- **Problem behoben: `{{companyName}}": <invalid>` (JSX-Parsing-Fehler)**
  - Falsche Syntax `{{'{{companyName}}'}}` in `companies/[id]/edit/page.tsx` und `companies/new/page.tsx`
  - Fix: Anzeige des Platzhaltertextes als `{'{{companyName}}'}`

#### SCC: Internal Server Error beim Speichern von Firmendaten
- **Problem behoben: 500 beim Speichern von Company-Kontaktdaten**
  - Prisma-Client war veraltet; Schema für `contactAddress`, `contactPhone`, `contactEmail`, `contactWebsite` nicht angewendet
  - Fix: `pnpm exec prisma generate` und `pnpm exec prisma migrate deploy` in `apps/scc`; verbesserte Fehlerbehandlung in `companies.service.ts` bei Schema-Fehlern

#### Mailclient phone-note: loadCompanyContact nicht definiert
- **Problem behoben: `loadCompanyContact is not defined` in Telefonnotiz-Seite**
  - `loadCompanyContact` wurde in `phone-note/page.tsx` aufgerufen, war dort aber nicht definiert
  - Fix: Funktion aus `compose/page.tsx` in `apps/mailclient/src/app/emails/compose/phone-note/page.tsx` übernommen

#### Signatur bei neuen E-Mails/Telefonnotizen und bei Antworten
- **Problem behoben: Signatur wurde nicht automatisch eingefügt**
  - Bei neuer E-Mail/Notiz: Signatur wird einmal beim Leeren-Body und gewählter Abteilung mit Signatur eingefügt (Ref verhindert Doppelinsert).
  - Bei Antwort: `setBody(formatReplyBody(...))` wurde nach dem Signatur-Effect ausgeführt und hat die Signatur überschrieben; Reihenfolge in `loadEmailForReply` angepasst (setTo/setSubject/setBody direkt nach setOriginalEmail), sodass die Signatur dem Reply-Body vorangestellt wird.
  - Plaintext-Felder erhalten nur die Plaintext-Signatur (kein HTML in Textarea).

#### Firmendaten in Signatur-Variablen beim Erstellen neuer E-Mails
- **Problem behoben: Platzhalter wie {{companyName}}, {{companyAddress}} blieben leer**
  - Die SCC-API lieferte für Company-Kontaktdaten oft 401 Unauthorized; es gab nur einen DB-Fallback bei 404.
  - **Fix in `apps/mailclient/src/lib/scc-client.ts`**: Bei jedem fehlgeschlagenen API-Aufruf (`!response.ok`, z. B. 401 oder 404) wird zuerst `getCompanyContactFromDb(companyId)` aufgerufen. Liefert die SCC-Datenbank (bei gesetztem `SCC_DATABASE_URL`) Kontaktdaten, werden diese verwendet.
  - **Frontend**: Beim Aufruf von `/api/company/contact` wird die Company-ID bzw. der Slug aus dem JWT-Payload gelesen und als Header `x-company-id` oder `x-company-slug` mitgesendet, damit die API den Tenant zuverlässig erkennt.
  - **SCC-Client**: API-Antwort unterstützt snake_case-Felder (z. B. `contact_address`) als Fallback; `getCompanyContactFromDb` liest aus der Tabelle `companies` und unterstützt ebenfalls snake_case-Spaltennamen.

### Verbessert

#### Frontend Performance-Optimierungen (Mailclient & SCC-Frontend)
- **Debug-/Agent-Fetches abschaltbar**: Alle Aufrufe zu `http://127.0.0.1:7242/ingest/...` (useEmailState, EmailPreview, email-fetcher) werden nur ausgeführt, wenn `NEXT_PUBLIC_AGENT_INGEST_ENABLED=true` gesetzt ist. In Produktion standardmäßig keine Aufrufe; weniger Latenz und keine Fehler bei fehlendem Agent.
- **EmailListItem mit React.memo**: Listenzeilen rendern nur neu, wenn sich Anzeige-relevante Props ändern; `handleContextMenu` in EmailList mit `useCallback` stabil gehalten. Weniger Re-Renders bei großen Listen.
- **AutomationWorkflowEditor lazy geladen**: Workflow-Editor wird per `next/dynamic` mit `ssr: false` erst geladen, wenn der Nutzer „Workflow bearbeiten“ öffnet. Einstellungs-Seite bleibt initial leichter.
- **react-icons Bundle verkleinert**: In `next.config.js` (mailclient) `modularizeImports` für `react-icons/fi` gesetzt; nur genutzte Icons werden gebündelt.
- **scc-frontend Companies-Caching**: Companies-Liste nutzt Client-Cache mit 45 s TTL; bei erneutem Besuch der Seite innerhalb der TTL werden gecachte Daten angezeigt, weniger redundante API-Calls.
- **EmailListGrouped virtualisiert**: Gruppierte Konversationsansicht nutzt wieder `@tanstack/react-virtual` für die flache Liste (Konversationen + Einzeleinträge); bessere Performance bei vielen Gruppen.
- **useEmailState Hilfsfunktionen ausgelagert**: Format-Datum-Funktionen, defaultTableColumns und Filter-Storage-Helfer in `useEmailState.utils.ts` ausgelagert; kleinere Hauptdatei, bessere Parse-Zeit.
- **AutomationWorkflowEditor aufgeteilt**: Custom Nodes (StartNode, ConditionNode, ActionNode, DepartmentNode) in `AutomationWorkflowEditor/nodes.tsx`, Custom Edge in `AutomationWorkflowEditor/edges.tsx`; Hauptdatei importiert nur noch diese Module.

#### Tiptap-Editor (SignatureEditor): EditorContext + MenuBar wie Tiptap-Referenz
- **EditorContext + MenuBar**: Der SignatureEditor nutzt nun das Tiptap-Referenz-Pattern mit `EditorContext.Provider` und einer separaten MenuBar-Komponente (`SignatureEditorMenuBar`), die den Editor per `useCurrentEditor()` aus dem Context bezieht – analog zum offiziellen Tiptap-Beispiel mit `EditorProvider` und `slotBefore`.
- **SignatureEditorMenuBar**: Neue Komponente `apps/mailclient/src/components/SignatureEditorMenuBar.tsx`; enthält die Toolbar (Undo/Redo, Überschriften, Listen, Fett/Kursiv/…, Ausrichtung, Link, Bild) und holt den Editor ausschließlich über `useCurrentEditor()`; Link- und Bild-Buttons sind eigene Subkomponenten mit Context-Zugriff.
- **Einheitliches Styling (Tiptap-Original)**: Editor-Wrapper (`.signature-editor-wrap`) mit einheitlichem Rahmen und abgerundeten Ecken; Toolbar oben mit abgerundeten oberen Ecken und Trennlinie zum Inhalt; Editor-Inhalt ohne Doppelrahmen, nur obere Trennlinie; explizite Button-/Separator-Styles in `globals.css`, damit Tiptap-UI-Styles gegenüber Tailwind-Preflight bestehen bleiben.
- **Weitere Anpassungen**: Lade-Platzhalter nutzt dieselbe Struktur (Toolbar mit `data-variant="fixed"`, Inhalt mit `borderTop` und abgerundeten unteren Ecken); Fokus-Ring des Editor-Inhalts als dezenter Box-Shadow.
- **Verwendung**: Unverändert für Nachrichtenfeld (Compose/Telefonnotiz) und Abteilungs-Signatur; value/onChange, placeholder, disabled und minHeight bleiben kontrolliert; Tiptap-UI-Komponenten (MarkButton, HeadingDropdownMenu, etc.) erhalten keinen `editor`-Prop mehr und nutzen `useTiptapEditor()` aus dem Context.

#### E-Mail-Signaturen: Platzierung und Plaintext
- **Signatur am Anfang**: Die Abteilungs-Signatur wird bei neuen E-Mails und Telefonnotizen sowie bei Antworten stets am Anfang des Textes eingefügt (vor dem Zitat bei Antworten).
- **Plaintext in Textarea**: Im Compose- und Telefonnotiz-Editor wird im Textfeld nur die Plaintext-Signatur verwendet; HTML-Signaturen werden für die Anzeige im Textarea automatisch in Plaintext umgewandelt.

#### Listenansicht: Telefonnotizen einheitlich mit E-Mails (Abteilung/Thema, Symbole)
- **Gruppierte Ansicht & Konversationen** (`EmailListGrouped.tsx`):
  - Abteilung und Thema (Tags) bei Telefonnotizen wie bei E-Mails **rechts** angeordnet, in einer gemeinsamen rechten Spalte mit dem Datum.
  - Tags (Abteilung/Thema) werden **untereinander** (vertikal) dargestellt, nicht nebeneinander – einheitlich für alle Einträge inkl. Telefonnotizen.
  - **Keine doppelten Symbole** bei Telefonnotizen: Das Telefon-Symbol erscheint nur in der ersten Zeile neben der Telefonnummer; in der Betreff-/Notiz-Zeile wird bei Telefonnotizen kein zweites Telefon-Icon mehr angezeigt (nur ggf. Sprechblasen-Symbol für Notizen).
  - Konversations-Header: Wenn die letzte Nachricht eine Telefonnotiz ist, wird in der Betreff-Zeile ebenfalls kein Telefon-Symbol angezeigt (nur bei E-Mails das E-Mail-Symbol).

#### Thread-Ansicht: Kommentarbereich ausgeblendet
- **Kommentarbereich in der Vorschau**: Bei aktivierter Thread-Ansicht wird der Kommentarbereich in der Übersicht unten rechts (Toggle „Kommentare“ und Kommentar-Inhalt) komplett ausgeblendet, nicht nur eingeklappt.
- **Begründung**: In der Thread-Ansicht werden Kommentare bereits pro Nachricht im Thread angezeigt; der separate Kommentarbereich wäre redundant.
- Implementiert in `apps/mailclient/src/components/EmailPreviewPane.tsx` (bedingte Anzeige `!showThreadView`).

#### Kommentarbereich: Abstände zwischen Kommentaren und Neues-Kommentar-Feld
- **Abstand zwischen Kommentarkarten**: Im Kommentarbereich (E-Mail-Vorschau) haben die einzelnen Kommentare nun einen sichtbaren Abstand zueinander (0,5 rem). Die Abstände werden per Inline-Style gesetzt, da die globale Regel `* { margin: 0 }` in `globals.css` Tailwind-Margins überschreibt.
- **Abstand zum Eingabefeld**: Zwischen der Kommentar-Liste und dem Feld „Neuer Kommentar“ wurde ebenfalls ein Abstand (0,5 rem) ergänzt.
- Implementiert in `apps/mailclient/src/components/EmailNotesSection.tsx`.

#### Performance-Optimierungen: Einstellungsübersicht
- **Parallele API-Calls für schnellere Ladezeit**
  - Alle initialen API-Calls (`loadAccounts`, `loadEmailFilters`, `loadUsers`, `loadDepartments`) werden jetzt parallel mit `Promise.all()` ausgeführt
  - Reduziert Ladezeit von ~2x auf ~1x der langsamsten Anfrage
  - Implementiert in `apps/mailclient/src/app/emails/settings/page.tsx`

- **N+1 Query Problem behoben**
  - `/api/users/route.ts`: Verwendet jetzt einen optimierten JOIN mit `json_agg()` statt separate Queries für jeden User
  - Reduziert Datenbankabfragen von N+1 auf 1 Query
  - Deutlich bessere Performance bei vielen Usern

- **Ineffiziente Subquery optimiert**
  - `/api/departments/route.ts`: Separate Query für `usage_count` statt Subquery für jede Zeile
  - Reduziert Datenbankabfragen und verbessert Performance

- **React Performance-Optimierungen**
  - `useMemo` für `activeAccountsCount` Berechnung
  - Verhindert unnötige Re-Renders
  - AbortController für alle Fetch-Requests mit Cleanup beim Unmount

- **Zentrales Loading-State Management**
  - Loading-State wird zentral verwaltet
  - Wird erst auf `false` gesetzt, wenn ALLE API-Calls abgeschlossen sind
  - Verhindert Race Conditions

#### Code-Qualität & Wartbarkeit
- **Magic Numbers/Strings extrahiert**
  - Alle hardcoded Werte in Konstanten extrahiert (`CARD_ORDER_STORAGE_KEY`, `SKELETON_CARD_COUNT`, `SIDEBAR_WIDTH`, etc.)
  - Bessere Wartbarkeit und Lesbarkeit

- **Type Safety verbessert**
  - Konkrete Interfaces (`User`, `Department`, `EmailFilter`) statt `any[]`
  - Reduziert Type-Safety-Probleme und macht Refactoring einfacher

- **Code-Vereinfachungen**
  - `showCount: f.showCount === true ? true : false` → `f.showCount === true`
  - Redundanter Code entfernt

#### Browserkompatibilität & Robustheit
- **localStorage mit Fehlerbehandlung**
  - Helper-Funktionen für localStorage mit try-catch
  - Funktioniert auch in privaten Browsing-Modi
  - SSR-sicher mit `typeof window !== 'undefined'` Checks

- **CustomEvent Polyfill**
  - Fallback für ältere Browser (IE11)
  - Verwendet `document.createEvent()` als Fallback

- **JSON.parse Validierung**
  - Größenbeschränkung (`MAX_JSON_PARSE_SIZE = 10KB`) für localStorage
  - Verhindert DoS-Angriffe durch große JSON-Strings

- **Error-Handling verbessert**
  - Content-Type Prüfung vor `response.json()` Aufruf
  - Konsistentes Error-Handling in allen API-Calls
  - `loadEmailFilters` setzt jetzt auch Error-State

#### Accessibility
- **ARIA-Attribute hinzugefügt**
  - Error-Messages haben `aria-live="polite"` und `role="alert"`
  - Bessere Screen-Reader-Unterstützung

#### Benutzerfreundlichkeit & UX
- **Toast-Benachrichtigungen statt blockierender Popups**
  - Alle verbleibenden `alert()`-Aufrufe durch Toast-Benachrichtigungen ersetzt
  - Automatisches Ausblenden nach wenigen Sekunden - keine manuelle Bestätigung mehr nötig
  - Betroffene Komponenten:
    - `EmailToolbar.tsx`: Workflow-Ausführung, Theme- und Abteilungs-Zuweisung
    - `EmailFilters.tsx`: Filter-Validierung
    - `AutomationWorkflowEditor.tsx`: Workflow-Validierung
  - Erfolgsmeldungen beim Speichern erscheinen jetzt als elegante Toasts oben rechts
  - Verbesserte Benutzererfahrung durch nicht-blockierende Benachrichtigungen

- **UI-Verbesserungen**
  - "Neue E-Mail" Button: Textfarbe explizit auf weiß gesetzt für bessere Lesbarkeit
  - Icon-Korrektur: `FiPlug` durch `FiWifi` ersetzt (Verbindungstest-Button)

#### Code-Qualität
- **Linter-Fehler behoben**
  - Typ-Inkompatibilität in `SettingsUsersTab.tsx` behoben (UserFormData-Konvertierung)
  - Typ-Fehler in `SettingsAccountsTab.tsx` behoben (smtpSecurity "none" entfernt)
  - Ungenutzte Props in `SettingsAutomationTab.tsx` markiert
  - Ungenutzte Imports in `workflow-executor.ts` entfernt

#### Abteilungen-Verwaltung
- **Zentralisierte Abteilungs-Konstanten**
  - Neue Datei `apps/mailclient/src/lib/department-constants.ts` für zentrale Definitionen
  - `BUSINESS_DEPARTMENTS` und `PRIVATE_DEPARTMENTS` Arrays
  - Vermeidet doppelte Definitionen und erleichtert Wartung
  - Wird von API-Route, Frontend-Komponenten und DepartmentManagement verwendet

- **UI-Verbesserungen in Abteilungsverwaltung**
  - Emojis durch React Icons (react-icons/fi) ersetzt für konsistentes Design
  - Verbesserte visuelle Hierarchie und Lesbarkeit
  - Dezente Button-Styles für bessere Integration in die Oberfläche

### Hinzugefügt

#### Abteilungen-Verwaltung: Erweiterte Funktionen
- **Wiederherstellung fehlender Standard-Abteilungen**
  - Neuer Button "Fehlende Firmen-Abteilungen wiederherstellen" in der Abteilungsübersicht
  - Zeigt Modal mit Vorschau der fehlenden Abteilungen vor dem Hinzufügen
  - Berechnet fehlende Standard-Firmenabteilungen im Frontend
  - Toast-Benachrichtigungen für Erfolg/Fehler/Info
  - Implementiert in `apps/mailclient/src/components/DepartmentManagement.tsx` und `SettingsDepartmentsTab.tsx`

- **Private Abteilungen für familiäre E-Mail-Nutzung**
  - Neuer Button "Private Abteilungen hinzufügen" für private Nutzung
  - Erstellt Abteilungen: Familie, Elternteil 1, Elternteil 2, Kind 1, Kind 2, Kind 3
  - Modal-Vorschau der hinzuzufügenden Abteilungen
  - Separate API-Route-Unterstützung für private Abteilungen
  - Implementiert in `apps/mailclient/src/components/DepartmentManagement.tsx` und `SettingsDepartmentsTab.tsx`

- **Modal-Komponente für Abteilungs-Wiederherstellung**
  - Neue Komponente `DepartmentRestoreModal.tsx`
  - Zeigt Liste der fehlenden Abteilungen mit Namen und Beschreibungen
  - Loading-State während API-Calls
  - ESC-Taste zum Schließen
  - Konsistentes Design mit bestehenden Modal-Komponenten (zIndex: 9999)

- **Erweiterte API-Route für Standard-Abteilungen**
  - `POST /api/departments/default` unterstützt jetzt Query-Parameter `type`
  - `type=business`: Erstellt Standard-Firmenabteilungen (Standard)
  - `type=private`: Erstellt private Abteilungen für familiäre Nutzung
  - Importiert Abteilungen aus zentraler `department-constants.ts`
  - Verbesserte Fehlerbehandlung und Rückgabe-Informationen

- **Erklärungssektion mit FAQ für Abteilungen**
  - Aufklappbare Erklärungssektion am Ende der Abteilungsübersicht
  - Erklärt für Laien, was Abteilungen sind und wofür sie verwendet werden
  - FAQ-Bereich mit 6 häufig gestellten Fragen:
    - Muss ich Abteilungen verwenden?
    - Wie viele Abteilungen kann ich erstellen?
    - Was bedeutet "Aktiv" und "Inaktiv"?
    - Warum benötigt eine Abteilung ein E-Mail-Konto?
    - Was ist der Unterschied zwischen Firmen- und privaten Abteilungen?
    - Kann ich eine Abteilung später löschen?
  - Fade-In-Animation beim Öffnen
  - Implementiert in `apps/mailclient/src/components/DepartmentManagement.tsx`

#### Hetzner Server Deployment & Production-Setup
- **Vollständiger Deployment-Guide**
  - Umfassende Schritt-für-Schritt-Anleitung für Hetzner-Server-Deployment
  - 11 Phasen: System-Vorbereitung, PostgreSQL, Node.js/pnpm/PM2, Projekt-Setup, PM2-Konfiguration, NGINX, SSL, Backup, Monitoring, Testing, Updates
  - Datei: `DEPLOYMENT_GUIDE.md` im Projekt-Root
  - Copy-Paste-Ready Befehle für alle Schritte
  - Troubleshooting-Sektion für häufige Probleme

- **Enterprise-Security-Härtung**
  - Dedicated Deployment-User (`deployer`) statt root
  - SSH-Härtung: Key-Only, Port 2222, PermitRootLogin no, MaxAuthTries 3
  - Kernel Hardening: sysctl.conf mit IP Spoofing Protection, SYN Flood Protection
  - Automatische Security Updates: unattended-upgrades
  - Fail2ban für SSH und NGINX (Brute-Force-Schutz)
  - Firewall-Konfiguration (UFW) mit minimalen Ports

- **PostgreSQL Production-Härtung**
  - pg_hba.conf Härtung: Nur localhost-Verbindungen erlaubt
  - Passwort-Policy: VALID UNTIL, CONNECTION LIMIT
  - SSL-Verbindungen mit sslmode=prefer
  - Logging: log_connections, log_statement='ddl', log_min_duration_statement
  - Connection Pooling in DATABASE_URL (10 Connections, 20s Timeout)

- **PM2 Production-Konfiguration**
  - Clustering für Mailclient (2 Instanzen) für bessere CPU-Auslastung
  - Zero-Downtime Deployment mit `wait_ready`, `listen_timeout`, `kill_timeout`
  - Optimierte Memory Limits: 768M/384M statt 1G/512M
  - Separate Log-Dateien mit Zeitstempeln
  - Logrotate-Konfiguration (7 Tage Retention)
  - PM2 Plus Integration für kostenloses Monitoring

- **NGINX Production-Konfiguration**
  - Vollständige Security Headers: HSTS, CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy
  - Rate Limiting: API (10r/s) und General (50r/s)
  - Request Size Limits: client_max_body_size 10M (DoS Protection)
  - Proxy Caching für Static Assets (60min TTL)
  - Gzip + Brotli Kompression (optional)
  - SSL Session Caching und Stapling
  - X-Powered-By Header entfernt
  - API Versioning: /api/v1 statt /api
  - Health Check Endpoint: /health

- **NestJS Backend Security**
  - Helmet.js Integration für Security Headers
  - CSRF-Protection mit csurf Middleware
  - CORS restriktiv konfiguriert (nur www.saivaro.de)
  - Cookie Security: httpOnly, secure, sameSite=strict
  - Rate Limiting mit ThrottlerModule
  - X-Powered-By Header entfernt

- **Verschlüsselte Datenbank-Backups**
  - GPG-verschlüsselte DB-Backups
  - Automatische tägliche Backups (Cronjob um 2 Uhr)
  - Backup-Rotation: Alte Backups >7 Tage werden gelöscht
  - Backup-Integritätsprüfung nach Erstellung
  - Backup-Restore-Anleitung

- **Deployment-Automatisierung**
  - One-Command Deployment-Script (`deploy-saivaromail.sh`)
  - Pre-Deployment Checks: Node.js, pnpm, PM2 Verfügbarkeit
  - Dependency Security Scan: pnpm audit vor Deployment
  - Symlink-basierte Rollback-Strategie
  - Zero-Downtime Reload mit PM2
  - Health Checks nach Deployment
  - Automatisches Rollback bei Fehlern
  - Old Release Cleanup (nur letzte 5 Versionen)

- **Monitoring & Observability**
  - PM2 Plus Integration (kostenlos)
  - Sentry Error Tracking (optional, 5K/monat frei)
  - UptimeRobot Uptime Monitoring (kostenlos, 50 Monitore)
  - Strukturierte JSON Logs in NGINX
  - Security Audit Logs für Login-Attempts und Admin-Actions
  - CI/CD Security Scan (GitHub Actions + Snyk)

- **Secrets Management**
  - ENV-Template-Dateien (.env.production.example)
  - Secrets-Generierung mit `openssl rand -base64 32`
  - .gitignore für .env Dateien und Secrets
  - Dateiberechtigungen: 750/640/600 (Ordner/Dateien/.env)
  - Warnung vor Secrets in Git

- **Port-Konfiguration**
  - Dev-Ports angepasst: 3010-3012 (keine Konflikte mit familien-herz-zeit)
  - Production-Ports: 3002 (Mailclient), 3100 (SCC Backend), 3003 (SCC Frontend)
  - SSH auf Port 2222 (gehärtet)

- **Sicherheits-Checkliste**
  - 21 kritische Sicherheitsmaßnahmen als Checkliste
  - Alle Punkte müssen vor Go-Live abgehakt werden
  - Vollständige Dokumentation aller Security-Features

#### Cron-Service & E-Mail-Abruf Verbesserungen
- **API-Route für E-Mail-Abruf**
  - Neue Route `POST /api/emails/fetch` für automatisierten E-Mail-Abruf
  - Unterstützt Service-Token-Authentifizierung für Cron-Service
  - Multi-Tenant-Support: Erfordert `x-company-id` Header bei Service-Token
  - Ruft E-Mails von allen aktiven E-Mail-Konten eines Users ab
  - Detaillierte Fehlerbehandlung und Statusmeldungen
  - Implementiert in `apps/mailclient/src/app/api/emails/fetch/route.ts`

- **Cron-Service Start-Script Verbesserungen**
  - Robuste .env-Datei-Erkennung mit mehreren Pfad-Optionen
  - Detailliertes Logging für .env-Loading-Prozess
  - Automatische Token-Bereinigung (Entfernung von Anführungszeichen)
  - Startup-Health-Check mit Retry-Mechanismus (6 Versuche à 5 Sekunden)
  - 10-Sekunden-Startup-Verzögerung für Mailclient-Bereitschaft
  - Implementiert in `apps/mailclient/scripts/start-cron-service.ts`

- **E-Mail-Abruf-Automatisierung**
  - Automatischer E-Mail-Abruf basierend auf `fetch_interval_minutes` in User-Settings
  - Dynamische Cron-Job-Erstellung für jeden User mit aktivem Intervall
  - Cron-Ausdrücke: `*/X * * * *` für Minuten < 60, `0 */X * * *` für Stunden >= 60
  - Automatisches Job-Refresh alle 5 Minuten (konfigurierbar über `CRON_REFRESH_INTERVAL_MS`)
  - Job-Management: Automatisches Erstellen, Aktualisieren und Löschen von Jobs
  - Multi-Tenant-Support: Lädt Jobs für alle Companies aus SCC-Datenbank
  - Implementiert in `apps/mailclient/src/lib/scheduled-trigger-service.ts`

- **Retry-Mechanismus für API-Aufrufe**
  - Exponential Backoff bei API-Fehlern (1s, 2s, 4s)
  - Max. 3 Retry-Versuche (konfigurierbar über `CRON_MAX_RETRIES`)
  - Timeout-Schutz: 30 Sekunden pro API-Aufruf (konfigurierbar über `CRON_API_TIMEOUT_MS`)
  - Keine Retries bei 4xx-Fehlern (Client-Fehler)
  - Automatische Retries bei 5xx-Fehlern (Server-Fehler)
  - Implementiert in `callApiWithRetry()` Funktion

- **Cron-Job-Logging Integration**
  - Automatisches Logging aller E-Mail-Abruf-Jobs in SCC-Datenbank
  - Status-Tracking: `running`, `success`, `failed`
  - Metadaten: User-ID, Company-ID, Ausführungszeit, verarbeitete E-Mails
  - Fehlerprotokollierung mit detaillierten Fehlermeldungen
  - Implementiert in `apps/mailclient/src/lib/cron-job-logger.ts`

#### Antworten-Funktionalität in E-Mail-Toolbar
- **Antworten-Button in Toolbar**
  - Neuer "Antworten"-Button zwischen "Neue E-Mail" und "Erledigen" in der E-Mail-Toolbar
  - Aktiviert nur, wenn eine einzelne E-Mail ausgewählt ist
  - Leitet zur Compose-Seite mit `replyTo` Parameter weiter
  - Verwendet `FiCornerUpLeft` Icon für konsistente UI
  - Implementiert in `apps/mailclient/src/components/EmailToolbar.tsx`

- **Erweiterte Antwort-Funktionalität für Telefonnotizen**
  - Dropdown-Menü beim Antworten auf Telefonnotizen: "Per E-Mail antworten" oder "Per Telefonnotiz antworten"
  - Normale E-Mails: Einfacher Link ohne Dropdown
  - Automatische Anpassung: Bei Telefonnotizen bleibt das "An"-Feld leer (wird durch replyType bestimmt)
  - replyAll ist nicht möglich bei Telefonnotizen (Fehlermeldung wird angezeigt)
  - Berücksichtigt aktiven Filter (filterId wird in URL übergeben)
  - Implementiert in `apps/mailclient/src/components/EmailToolbar.tsx` als `ReplyButtonDropdown` Komponente

- **"Neu..." Dropdown-Button**
  - "Neue E-Mail"-Button wurde zu "Neu..." mit Dropdown erweitert
  - Dropdown-Optionen: "E-Mail" oder "Telefonnotiz"
  - Berücksichtigt aktiven Filter (filterId wird in URL übergeben)
  - Implementiert in `apps/mailclient/src/components/EmailToolbar.tsx` als `NewButtonDropdown` Komponente

### Behoben

#### E-Mail-Lade-Problem beim ersten Öffnen nach längerer Zeit
- **Race Condition beim Laden von E-Mail-Details behoben**
  - Problem: Beim ersten Öffnen einer E-Mail nach längerer Zeit wurde diese nicht geladen. Beim zweiten Klick funktionierte es korrekt.
  - Ursache: Race Condition zwischen `setSelectedEmailId` (State-Update) und dem 50ms-Timeout für `loadEmailDetails`. Der State-Update wurde durch React-Batching/`startTransition` verzögert, sodass `loadEmailDetails` den State noch als `null` sah und den Load abbrach.
  - Lösung: Alle Race-Condition-Checks in `loadEmailDetails` verwenden jetzt `selectedEmailIdRef.current` statt `selectedEmailId` (State), da der Ref sofort aktualisiert wird.
  - Implementiert in `apps/mailclient/src/hooks/useEmailState.ts` in der `loadEmailDetails` Funktion
  - Betroffene Checks: Cache-Prüfung, Email-Changed-Check, Loading-State-Set, After-Fetch-Check, Before-Transition-Check, Inside-Transition-Check, Error-Handling, Finally-Block
  - E-Mails werden jetzt zuverlässig beim ersten Öffnen geladen, auch nach längerer Inaktivität

#### Filteranzahl-Berechnung in Sidebar korrigiert
- **Korrektur der falschen Filteranzahl-Anzeige**
  - Problem: Filteranzahl zeigte nur 1 E-Mail statt der tatsächlichen Anzahl
  - Ursache: API wurde mit `limit=1` aufgerufen, wodurch nur 1 E-Mail für die Zählung geladen wurde
  - Lösung: Limit von 1 auf 200 (API-Maximum) erhöht, damit alle E-Mails für korrekte Zählung geladen werden
  - Implementiert in `apps/mailclient/src/components/Sidebar.tsx` in der `calculateEmailCounts` Funktion
  - Behebt auch den `allEmailsMapped is not defined` Fehler durch korrekte Variablendeklaration
  - Verbesserte Performance: Lädt jetzt bis zu 200 E-Mails für präzise Filteranzahl-Berechnung

#### Layout-Korrektur für Compose-Seite beim Antworten
- **Layout-Problem beim Antworten behoben**
  - Compose-Seite verwendet jetzt korrekt die `.main-content` CSS-Klasse
  - Konsistente Layout-Struktur mit anderen Seiten
  - Korrekte Hintergrundfarbe und Margin-Einstellungen
  - Behebt Problem, dass Überschrift von Sidebar überdeckt wurde
  - Implementiert in `apps/mailclient/src/app/emails/compose/page.tsx`

#### Erweiterte Filter-Funktionalität
- **Typ-Filter für E-Mails und Telefonnotizen**
  - Neue Filter-Regel "Typ" zum Filtern nach E-Mail-Typ (`email` oder `phone_note`)
  - Ermöglicht separate Filterung von E-Mails und Telefonnotizen
  - Unterstützt `forCounting` Parameter für korrekte Counter-Berechnung
  - Implementiert in `apps/mailclient/src/utils/filterEmails.ts`
  - Verfügbar in Filter-Editor unter "Typ" als Feldoption

- **Telefonnummer-Filter**
  - Neue Filter-Regel "Telefonnummer" zum Filtern nach Telefonnummern
  - Unterstützt alle Standard-Operatoren: enthält, ist gleich, beginnt mit, endet mit
  - Ermöglicht Suche nach spezifischen Telefonnummern in Telefonnotizen
  - Implementiert in `apps/mailclient/src/utils/filterEmails.ts`
  - Verfügbar in Filter-Editor unter "Telefonnummer" als Feldoption

### Behoben

#### Filter-Logik für gesendete E-Mails
- **Korrektur der Filter-Logik für "gesendet"-Status**
  - Gesendete E-Mails werden jetzt nur angezeigt, wenn "gesendet" explizit im Filter ausgewählt ist
  - Behebt Problem, dass gesendete E-Mails angezeigt wurden, obwohl "gesendet" nicht im Filter angehakt war
  - Gleiche Logik wie bei erledigten E-Mails: Explizite Auswahl erforderlich
  - Implementiert in `apps/mailclient/src/utils/filterEmails.ts`
  - Prüft, ob E-Mail "gesendet" ist (from_email stimmt mit User-E-Mail überein) und ob "gesendet" im Filter ausgewählt ist

### Hinzugefügt

#### Thread-View Toggle für E-Mail-Ansicht
- **Thread-View Toggle Button in der E-Mail-Liste**
  - Neuer "Thread AN/AUS" Button direkt neben den "Liste" / "Konversationen" Buttons
  - Immer sichtbar (nicht nur bei Konversationen)
  - Farbcodiert: Grün wenn aktiv ("Thread AN"), Weiß wenn inaktiv ("Thread AUS")
  - Visueller Separator zwischen View-Mode-Buttons und Thread-Toggle
  - State wird in localStorage gespeichert und bleibt über Seitenneuladungen erhalten
  - Implementiert in `apps/mailclient/src/components/EmailList.tsx`

- **Thread-View für alle E-Mails**
  - Thread-View kann jetzt für alle E-Mails aktiviert werden (nicht nur Konversationen)
  - Zeigt alle E-Mails mit der gleichen Ticket-ID in chronologischer Reihenfolge
  - Auch einzelne E-Mails werden im Thread-Format angezeigt, wenn Thread-View aktiviert ist
  - Automatische Synchronisation zwischen EmailList und EmailPreview über CustomEvent
  - Implementiert in `apps/mailclient/src/components/EmailPreview.tsx`

- **State-Synchronisation**
  - Thread-View State wird zwischen EmailList und EmailPreview synchronisiert
  - Änderungen im Toggle-Button werden sofort in der Preview übernommen
  - CustomEvent-basierte Kommunikation zwischen Komponenten
  - localStorage-basierte Persistenz für benutzerfreundliche Erfahrung

#### Backup & Restore Scripts
- **PowerShell Backup-Script (`backup.ps1`)**
  - Erstellt komprimierte Backups des gesamten Projekts
  - Intelligente Ausschlüsse: `node_modules`, `.next`, `dist`, `build`, `.turbo`, `coverage`, `.cache` werden nicht gesichert
  - Direkte ZIP-Kompression ohne temporäre Kopien
  - Fortschrittsanzeige während der Verarbeitung
  - Zeitstempel im Dateinamen: `SeivaroMail_v2_YYYY-MM-DD_HHmmss.zip`
  - Automatische Bereinigung alter Backups (älter als 30 Tage, konfigurierbar)
  - Laufwerk-Verfügbarkeitsprüfung (X:\)
  - Detaillierte Verifizierung nach Backup-Erstellung
  - Backup-Größe: ~50-200 MB (statt mehreren GB)
  - Backup-Dauer: ~30 Sekunden
  - Implementiert in `backup.ps1`

- **PowerShell Restore-Script (`restore.ps1`)**
  - Interaktive Auswahl aus verfügbaren Backups
  - Zeigt Backup-Informationen (Größe, Datum, Alter)
  - ZIP-Integritätsprüfung vor Wiederherstellung
  - Sicherheitsabfragen vor Überschreiben bestehender Dateien
  - Fortschrittsanzeige während der Wiederherstellung
  - Automatisches Angebot für `pnpm install` nach Restore
  - Implementiert in `restore.ps1`

- **Batch-Wrapper für einfache Ausführung**
  - `BACKUP_STARTEN.bat` - Startet Backup-Script per Doppelklick
  - `RESTORE_STARTEN.bat` - Startet Restore-Script per Doppelklick
  - Automatische PowerShell-Ausführung mit korrekten Parametern

- **Dokumentation**
  - `BACKUP_README.md` - Umfassende Dokumentation für Backup & Restore
  - Enthält Verwendungsanleitung, Konfiguration, Best Practices und Fehlerbehebung
  - Hinweis in `README.md` auf Backup-Funktionalität

#### Theme-Auswahl und Abteilungs-Vorauswahl im E-Mail-Compose
- **Theme-Dropdown im Compose-Formular**
  - Dropdown zur Auswahl eines Themas beim Erstellen oder Beantworten von E-Mails
  - Optionales Feld (kann als Pflichtfeld konfiguriert werden)
  - Automatisches Laden verfügbarer Themes beim Öffnen des Compose-Formulars
  - Speicherung der zuletzt verwendeten Theme-Auswahl in localStorage
  - Implementiert in `apps/mailclient/src/app/emails/compose/page.tsx`

- **Automatische Theme-Übernahme beim Antworten**
  - Beim Antworten auf eine E-Mail wird das Theme der ursprünglichen E-Mail automatisch übernommen
  - Bei Konversationen: Theme der neuesten E-Mail wird verwendet
  - Funktioniert für normale E-Mails und Telefonnotizen
  - Implementiert in `loadEmailForReply()` Funktion

- **Filter-Integration für Theme und Abteilung**
  - Beim Erstellen oder Antworten aus einem Filter werden Theme und Abteilung automatisch vorausgewählt
  - Filter-Regeln für `department` und `theme` werden aus User-Settings extrahiert
  - Unterstützt beide Operator-Varianten (`is` und `equals`)
  - Optimierte API-Nutzung: Settings werden nur einmal geladen und wiederverwendet
  - Implementiert in `loadFilterSettings()` Funktion

- **Theme als Pflichtfeld**
  - Neue Einstellung `themeRequired` in User-Settings
  - Wenn aktiviert, muss beim Versand einer E-Mail ein Theme ausgewählt werden
  - Validierung im Frontend und Backend
  - Dynamische Label-Anzeige: "Thema (optional)" oder "Thema: *" je nach Einstellung
  - Implementiert in `apps/mailclient/src/app/emails/compose/page.tsx` und Settings-API

- **Verbesserte Reply-Funktionalität für Telefonnotizen**
  - "Antworten"-Button zeigt Dropdown bei Telefonnotizen: "Per E-Mail antworten" oder "Per Telefonnotiz antworten"
  - Normale E-Mails: Einfacher Link ohne Dropdown
  - Automatische Anpassung des "An"-Felds: Bei Telefonnotizen bleibt es leer (wird durch replyType bestimmt)
  - replyAll ist nicht möglich bei Telefonnotizen (Fehlermeldung)
  - Implementiert in `apps/mailclient/src/components/EmailToolbar.tsx` und `apps/mailclient/src/app/emails/compose/page.tsx`

- **Neue E-Mail Button mit Dropdown**
  - "Neu..." Button mit Dropdown-Menü: "E-Mail" oder "Telefonnotiz"
  - Ermöglicht schnelle Auswahl zwischen E-Mail und Telefonnotiz
  - Berücksichtigt aktiven Filter (filterId wird in URL übergeben)
  - Implementiert in `apps/mailclient/src/components/EmailToolbar.tsx`

- **Layout-Korrekturen**
  - Korrigierte Einrückung und Struktur im Compose-Formular
  - Hinzugefügtes `flex: 1` und `marginLeft: '280px'` für korrekte Breite des Content-Bereichs
  - Behebt Problem mit zu schmalem Layout

- **Code-Optimierungen**
  - `loadEmailForReply()` erweitert mit AbortController-Support für bessere Memory-Management
  - `loadDepartments()` gibt jetzt Settings zurück (verhindert doppelte API-Calls)
  - Atomare setState-Struktur in `loadEmailForReply()` für bessere Performance
  - `useEffect` komplett umgeschrieben mit isMounted-Flag und AbortController für Cleanup
  - Prioritätslogik dokumentiert: Reply > Filter > Standard

#### Filter-Persistenz beim Reload
- **Automatische Wiederherstellung des zuletzt ausgewählten Filters**
  - Beim Neuladen der Seite wird der zuletzt ausgewählte Filter automatisch wieder aktiviert
  - Funktioniert für Standard-Filter (Alle, Gelesen, Ungelesen, Erledigt, Nicht erledigt) und benutzerdefinierte Filter
  - Filter werden im localStorage gespeichert für persistente Speicherung
  - Validierung: Gelöschte benutzerdefinierte Filter werden nicht wiederhergestellt
  - URL-Synchronisation: Gespeicherte Filter werden automatisch in der URL gesetzt
  - Graceful Degradation: Funktioniert auch bei deaktiviertem localStorage (verwendet Default 'all')
  - Implementiert in `apps/mailclient/src/hooks/useEmailState.ts`
  - Helper-Funktionen: `saveFilterToStorage()` und `saveCustomFilterToStorage()` für zentrale Speicherung
  - Fehlerbehandlung: try-catch für localStorage-Operationen (unterstützt private Browsing-Modi)

### Hinzugefügt

#### Docker-Compose-Integration für PostgreSQL
- **Automatisierte Datenbank-Start-Skripte**
  - `docker-compose.yml` für PostgreSQL-Container-Konfiguration
  - Container-Name: `saivaro-postgres-scc`
  - Automatischer Health-Check für Datenbank-Verfügbarkeit
  - Port-Mapping: 5432:5432 für lokale Entwicklung
  - Persistentes Volume für Datenbank-Daten
  - Integriert in `start-all.ps1` für automatischen Container-Start
  - Implementiert in `docker-compose.yml`

#### Verbesserte Datenbankverbindungs-Fehlerbehandlung
- **Klarere Fehlermeldungen bei Datenbankverbindungsproblemen**
  - Spezifische Meldungen für `ECONNREFUSED` Fehler
  - Hinweise zur Überprüfung des Docker-Container-Status
  - Automatische Prüfung der Container-Verfügbarkeit
  - Verbesserte Logging-Ausgaben für Debugging
  - Implementiert in `apps/scc/src/prisma/prisma.service.ts` und `apps/mailclient/src/lib/tenant-db-client.ts`

### Behoben

#### Datenbankverbindungs-Probleme
- **PostgreSQL-Container-Start-Validierung**
  - Behebt Problem, dass Anwendungen starten, bevor die Datenbank bereit ist
  - Automatische Container-Erstellung und -Start bei fehlendem Container
  - Health-Check-Integration für zuverlässige Datenbank-Verfügbarkeit
  - Verbesserte Fehlerbehandlung bei fehlender Datenbankverbindung
  - Implementiert in `start-all.ps1` und `docker-compose.yml`

### Hinzugefügt

#### Visuelle Unterscheidung von Telefonnotizen und E-Mails
- **Symbol-Anzeige in Mailliste**
  - Telefonnotizen zeigen ein blaues Telefon-Symbol (`FiPhone`) vor dem Betreff
  - E-Mails zeigen ein graues E-Mail-Symbol (`FiMail`) vor dem Betreff
  - Implementiert in allen vier Ansichten:
    - Tabellenansicht (`EmailTableItem.tsx`)
    - Listenansicht (`EmailListItem.tsx`)
    - Gruppierte Ansicht (`EmailListGrouped.tsx`)
    - Thread-Ansicht (`EmailThreadView.tsx`)
  - Flexbox-Layout für korrekten Text-Overflow mit Ellipsis
  - Konsistente Icon-Größen: 14px für Listen/Tabellen, 16px für Thread-Header, 12px für Thread-Nachrichten
  - Farben: `#2563EB` (blau) für Telefonnotizen, `#6B7280` (grau) für E-Mails

- **Thread-API erweitert**
  - `type` und `phone_number` Felder zur SELECT-Query hinzugefügt
  - `latestType` zur API-Response hinzugefügt für korrekte Header-Anzeige
  - Implementiert in `apps/mailclient/src/app/api/emails/[id]/thread/route.ts`

- **Email-State-Mapping erweitert**
  - `type` und `phoneNumber` Felder zum Email-Mapping in `useEmailState.ts` hinzugefügt
  - Ermöglicht korrekte Symbol-Anzeige in allen Frontend-Komponenten

#### Audio-Features für E-Mails
- **Text-to-Speech (Vorlesen)**
  - Button "Vorlesen" oberhalb des E-Mail-Headers zum Vorlesen des E-Mail-Inhalts
  - Unterstützung für Browser-native Web Speech API (SpeechSynthesis) als Standard
  - Optional: ElevenLabs-Integration für hochwertige Text-to-Speech-Stimmen
  - Konfigurierbare ElevenLabs-Stimme (Voice ID) pro Firma
  - Toggle-Button zum Aktivieren/Deaktivieren von ElevenLabs in den Einstellungen
  - Test-Button in den Einstellungen zum Testen der ElevenLabs-Konfiguration
  - Loading-State während der Audio-Vorbereitung ("Wird vorbereitet...")
  - Automatischer Fallback auf Browser-TTS bei Fehlern
  - Implementiert in `apps/mailclient/src/components/EmailPreview.tsx`
  - API-Route: `POST /api/emails/[id]/text-to-speech` für ElevenLabs-TTS
  - API-Route: `POST /api/text-to-speech` für generische Text-to-Speech-Konvertierung

- **E-Mail-Zusammenfassung als Audio**
  - Button "Zusammenfassung wiedergeben" neben dem Vorlesen-Button
  - Generiert eine kurze Zusammenfassung des E-Mail-Inhalts mit OpenAI GPT
  - Gibt die Zusammenfassung ausschließlich als Audio aus (keine Text-Anzeige)
  - Unterstützt verschiedene OpenAI-Modelle (GPT-4o-mini, GPT-3.5-turbo, GPT-4, GPT-4 Turbo)
  - Verwendet ElevenLabs für Audio-Ausgabe, falls aktiviert
  - Fallback auf Browser-TTS, wenn ElevenLabs nicht verfügbar ist
  - Implementiert in `apps/mailclient/src/components/EmailPreview.tsx`
  - API-Route: `POST /api/emails/[id]/summarize` für Zusammenfassungs-Generierung

- **Company-spezifische AI-Konfiguration**
  - Neue Tabelle `company_config` in Tenant-Datenbanken für AI-Einstellungen
  - OpenAI API-Key-Verwaltung (verschlüsselt gespeichert)
  - OpenAI-Modell-Auswahl (Dropdown mit vordefinierten Modellen)
  - ElevenLabs API-Key-Verwaltung (verschlüsselt gespeichert)
  - ElevenLabs Voice ID-Konfiguration
  - ElevenLabs Aktivierungs-Toggle
  - Einstellungen in "Allgemeine Einstellungen" → "OpenAI-Konfiguration" und "ElevenLabs-Konfiguration"
  - Separate "Speichern"-Buttons für jede Konfiguration
  - Auto-Save mit Debounce für API-Keys und Modelle
  - Validierung von API-Keys und Modellen
  - Implementiert in `apps/mailclient/src/components/settings/SettingsGeneralTab.tsx`
  - API-Route: `GET /api/settings` und `PATCH /api/settings` erweitert
  - API-Route: `POST /api/settings/test-elevenlabs` für ElevenLabs-Verbindungstest
  - Verschlüsselung: AES-256-GCM für API-Keys (wie in SCC)

- **Feature-Flag-System im SCC**
  - Konsolidiertes Feature-Flag "Audio-Features aktivieren" im SCC
  - Aktiviert/deaktiviert beide Audio-Funktionen (Vorlesen und Zusammenfassung) gemeinsam
  - Speicherung in `Company.metadata.features.audioFeatures` (SCC-Datenbank)
  - Rückwärtskompatibilität: Unterstützt auch alte separate Flags (`textToSpeech`, `emailSummary`)
  - UI in SCC-Frontend: Checkbox "Audio-Features aktivieren" mit Beschreibung
  - API-Endpunkt: `PATCH /api/companies/:id/features` für Feature-Verwaltung
  - Implementiert in `apps/scc/src/companies/companies.service.ts` und `companies.controller.ts`
  - Frontend-Integration in `apps/scc-frontend/src/app/companies/[id]/page.tsx`

- **Feature-Flag-Loading im Mailclient**
  - Automatisches Laden der Feature-Flags beim Öffnen einer E-Mail
  - API-Route: `GET /api/company/features` für Feature-Flag-Abfrage
  - Bedingte Anzeige der Audio-Buttons basierend auf Feature-Flags
  - Fallback auf deaktivierte Features bei API-Fehlern
  - Implementiert in `apps/mailclient/src/lib/company-features.ts`
  - Frontend-Integration in `apps/mailclient/src/components/EmailPreview.tsx`

- **API-Endpunkte für Audio-Features**
  - `POST /api/emails/[id]/text-to-speech` - Generiert Audio für spezifische E-Mail (ElevenLabs)
  - `POST /api/text-to-speech` - Generische Text-to-Speech-Konvertierung (für Zusammenfassungen)
  - `POST /api/emails/[id]/summarize` - Generiert E-Mail-Zusammenfassung mit OpenAI
  - `POST /api/settings/test-elevenlabs` - Testet ElevenLabs-Konfiguration mit Beispiel-Audio
  - `GET /api/company/features` - Ruft Feature-Flags für aktuelle Company ab
  - Alle Endpunkte prüfen `audioFeatures` Feature-Flag vor Ausführung
  - Implementiert in `apps/mailclient/src/app/api/`

- **Text-Preprocessing für AI**
  - HTML-Tag-Entfernung für saubere Text-Eingabe
  - HTML-Entity-Decodierung (z.B. `&amp;` → `&`)
  - Whitespace-Normalisierung
  - Textlängen-Limitierung für LLM-Eingabe
  - Implementiert in `apps/mailclient/src/app/api/emails/[id]/summarize/route.ts`

- **Fehlerbehandlung**
  - Spezifische Fehlermeldungen für fehlende API-Keys
  - Rate-Limit-Erkennung für OpenAI und ElevenLabs
  - Browser-Support-Prüfung für Web Speech API
  - Leere Inhalts-Erkennung
  - Detaillierte Fehler-Logs für Debugging
  - Toast-Benachrichtigungen für Benutzer-Feedback

### Geändert

#### UI-Verbesserungen für Telefonnotizen
- **Symbol vor Telefonnummer entfernt**
  - Das Telefon-Symbol vor der Telefonnummer in der Listenansicht wurde entfernt
  - Telefonnummer bleibt als klickbarer Link erhalten
  - Implementiert in `apps/mailclient/src/components/EmailListItem.tsx`

- **Thread-Ansicht: Symbol bei allen Nachrichten**
  - Symbol wird jetzt bei allen Nachrichten im Thread angezeigt, nicht nur bei unterschiedlichem Betreff
  - Weißes Symbol mit Transparenz bei ausgehenden Nachrichten
  - Farbiges Symbol bei eingehenden Nachrichten
  - Implementiert in `apps/mailclient/src/components/EmailThreadView.tsx`

#### Einstellungen
- **Allgemeine Einstellungen erweitert**
  - Neue Sektionen "OpenAI-Konfiguration" und "ElevenLabs-Konfiguration"
  - API-Key-Eingabefelder mit Show/Hide-Toggle
  - Dropdown für OpenAI-Modell-Auswahl
  - Eingabefeld für ElevenLabs Voice ID
  - Toggle-Button für ElevenLabs-Aktivierung
  - Test-Button für ElevenLabs-Verbindungstest
  - Separate Speichern-Buttons für jede Konfiguration
  - Auto-Save-Funktionalität mit Debounce
  - Verbesserte State-Verwaltung mit Refs für korrekte Speicherung
  - Implementiert in `apps/mailclient/src/components/settings/SettingsGeneralTab.tsx`

#### Datenbank-Schema
- **Neue Tabelle `company_config`**
  - `id` (UUID, Primary Key)
  - `company_id` (UUID, Foreign Key, UNIQUE)
  - `openai_api_key` (TEXT, verschlüsselt)
  - `openai_model` (VARCHAR(50))
  - `elevenlabs_api_key` (TEXT, verschlüsselt)
  - `elevenlabs_voice_id` (VARCHAR(255))
  - `elevenlabs_enabled` (BOOLEAN, DEFAULT false)
  - `created_at`, `updated_at` (TIMESTAMP)
  - CHECK-Constraint: Nur eine Zeile pro Company
  - Automatische Schema-Migration in `apps/mailclient/src/lib/tenant-db-migrations.ts`
  - Migration prüft Spalten-Existenz und fügt `elevenlabs_enabled` hinzu, falls fehlend
  - Backend-Speicherung: Explizite Boolean-Konvertierung für `elevenlabs_enabled` (verhindert `undefined`-Werte)

#### SCC-Frontend
- **Company-Detail-Seite erweitert**
  - Neue "Features"-Sektion mit Audio-Features-Checkbox
  - Beschreibung: "Aktiviert: E-Mail als Audio vorlesen und E-Mail-Zusammenfassung als Audio"
  - Speicherung über `PATCH /api/companies/:id/features`
  - Erfolgs-/Fehler-Toast-Benachrichtigungen
  - Implementiert in `apps/scc-frontend/src/app/companies/[id]/page.tsx`

#### Feature-Flag-Konsolidierung im SCC
- **Konsolidierung der Audio-Feature-Flags**
  - Einzelnes Feature-Flag `audioFeatures` ersetzt zwei separate Flags (`textToSpeech`, `emailSummary`)
  - Aktiviert/deaktiviert beide Audio-Funktionen (Vorlesen und Zusammenfassung) gemeinsam
  - Speicherung in `Company.metadata.features.audioFeatures` (SCC-Datenbank)
  - Rückwärtskompatibilität: Alte separate Flags werden automatisch auf `audioFeatures` gemappt
  - Backend-Service: `updateCompanyFeatures` setzt automatisch beide alten Flags auf denselben Wert wie `audioFeatures`
  - DTO aktualisiert: `UpdateCompanyFeaturesDto` verwendet nur noch `audioFeatures` Property
  - Implementiert in `apps/scc/src/companies/companies.service.ts` und `apps/scc/src/companies/dto/update-company-features.dto.ts`

### Behoben

#### API-Key-Speicherung
- **Korrekte Speicherung von API-Keys und Voice ID**
  - Behebt Problem, dass API-Keys nach dem Speichern nicht angezeigt wurden
  - Explizite "Speichern"-Buttons für jede Konfiguration
  - Auto-Save erweitert um API-Key-Felder
  - Korrekte Behandlung von `null`-Werten beim Laden und Speichern
  - State-Refs für korrekte Closure-Behandlung in `useCallback`
  - Frontend-State wird nach erfolgreichem Speichern aktualisiert
  - Implementiert in `apps/mailclient/src/components/settings/SettingsGeneralTab.tsx` und `apps/mailclient/src/lib/company-config.ts`

#### ElevenLabs-Toggle-Button-Speicherung
- **Fix für Toggle-Button-Deaktivierung beim Speichern**
  - Behebt Problem, dass der ElevenLabs-Toggle-Button beim Speichern automatisch deaktiviert wurde
  - Ursache: Stale Closure in `handleSaveSettings` - State wurde direkt gelesen statt aus Ref
  - Lösung: `elevenlabsEnabledRef` hinzugefügt und sofort beim Toggle aktualisiert
  - `useEffect` Hook hält Ref synchron mit State
  - `handleSaveSettings` verwendet jetzt Ref-Wert statt State-Wert
  - Korrekte Behandlung von `false`-Werten in Backend (explizite Boolean-Konvertierung)
  - Implementiert in `apps/mailclient/src/components/settings/SettingsGeneralTab.tsx` und `apps/mailclient/src/app/api/settings/route.ts`

#### ElevenLabs-Integration
- **ElevenLabs-Audio-Wiedergabe für E-Mails**
  - Behebt Problem, dass ElevenLabs-Audio nicht für E-Mails abgespielt wurde
  - Korrekte `POST`-Methode und Authorization-Header in Fetch-Requests
  - Blob-URL-Handling für Audio-Streams
  - Verbesserte Fehlerbehandlung für Netzwerk- und Audio-Fehler
  - Test-Endpunkt für ElevenLabs-Konfiguration
  - Implementiert in `apps/mailclient/src/components/EmailPreview.tsx` und `apps/mailclient/src/app/api/settings/test-elevenlabs/route.ts`

#### Feature-Flag-Logik
- **Konsolidierung der Audio-Features**
  - Einzelnes Feature-Flag `audioFeatures` statt zwei separater Flags
  - Rückwärtskompatibilität für alte Flags (`textToSpeech`, `emailSummary`)
  - Automatische Ableitung: Wenn `audioFeatures` nicht gesetzt, werden alte Flags verwendet
  - Logik: `audioFeatures ?? (textToSpeech || emailSummary) ?? false`
  - Korrekte Operator-Präzedenz in TypeScript (Klammern für `??`-Operator bei Mischung mit `||`)
  - Feature-Flag-Check aktualisiert: `features.audioFeatures` statt `features.textToSpeech` oder `features.emailSummary`
  - API-Endpunkte aktualisiert: `/api/emails/[id]/text-to-speech`, `/api/text-to-speech`, `/api/emails/[id]/summarize` verwenden `audioFeatures`
  - Implementiert in `apps/mailclient/src/lib/company-features.ts` und allen betroffenen API-Routes

### Hinzugefügt

#### Vollständiges Frontend-Redesign (Modernes Design)
- **Komplettes Layout-Redesign basierend auf HTML-Template**
  - Neues Sidebar-Design mit Logo, integriertem Suchfeld und "Neue E-Mail" Button
  - Toolbar mit Icon-Buttons und Text-Buttons für E-Mail-Aktionen
  - E-Mail-Liste im neuen List-View-Design (ersetzt Tabellenansicht)
  - E-Mail-Vorschau-Pane mit 50% Breite und separatem Scroll-Bereich
  - Responsive Design: Vorschau-Pane wird unter 1024px ausgeblendet
  - Implementiert in `apps/mailclient/src/components/Sidebar.tsx`, `apps/mailclient/src/components/EmailToolbar.tsx`, `apps/mailclient/src/components/EmailList.tsx`, `apps/mailclient/src/components/EmailPreviewPane.tsx`

- **Einheitliche Button- und Input-Höhen**
  - Alle Buttons und Eingabefelder haben jetzt eine einheitliche Höhe (`h-8`)
  - Konsistente Padding-Werte (`px-3 py-1`) für alle interaktiven Elemente
  - Implementiert in `apps/mailclient/src/components/Button.tsx`, `apps/mailclient/src/components/Input.tsx`, `apps/mailclient/src/components/Select.tsx`, `apps/mailclient/src/components/ValidatedInput.tsx`

- **Neue E-Mail-Liste-Ansicht**
  - `EmailListItem` Komponente ersetzt `EmailTableItem`
  - Zebra-Striping mit subtilen Hintergrundfarben für bessere Lesbarkeit
  - Hervorgehobene aktive E-Mail mit blauem Hintergrund und linker Border
  - Status-Icons für "Erledigt" (✓) und "Gelöscht" (🗑️) unter Checkbox und Star
  - Checkbox, Star, Status-Icons, Betreff, Vorschau, Datum und Tags in einer Zeile
  - Implementiert in `apps/mailclient/src/components/EmailListItem.tsx`

- **Resizable Layout und Collapsible Timeline**
  - Drag-and-Drop-Resizing für E-Mail-Liste/Vorschau-Pane (horizontal)
  - Drag-and-Drop-Resizing für Vorschau-Pane/Timeline (vertikal)
  - Collapsible Timeline mit Toggle-Button
  - Persistente Größen-Einstellungen während der Session
  - Implementiert in `apps/mailclient/src/app/emails/page.tsx`, `apps/mailclient/src/components/EmailPreviewPane.tsx`

- **Entfernung des alten Designs**
  - Alle `isClassic` Checks und Theme-Switch-Logik entfernt
  - `ThemeProvider` und Theme-Context entfernt
  - Alte CSS-Klassen und Fallback-Mechanismen entfernt
  - Nur noch modernes Tailwind CSS-basiertes Design
  - Implementiert in allen Komponenten

#### "Erledigt"-Status für E-Mails
- **Datenbank-Schema-Erweiterung**
  - Neue Tabelle `email_completed_status` für benutzerbezogenen "Erledigt"-Status
  - `completed_at` Timestamp für jede E-Mail pro Benutzer
  - Automatische Schema-Migration in `apps/mailclient/src/lib/tenant-db-client.ts`

- **API-Erweiterungen**
  - `PATCH /api/emails/[id]` unterstützt jetzt `completed` Status
  - `GET /api/emails` und `GET /api/emails/[id]` laden `completed_at` Status
  - Filterung nach `completed` oder `not_completed` Status
  - Implementiert in `apps/mailclient/src/app/api/emails/route.ts`, `apps/mailclient/src/app/api/emails/[id]/route.ts`

- **Frontend-Integration**
  - "Erledigen"-Button in Toolbar zum Toggle des "Erledigt"-Status
  - Bulk-Aktionen für mehrere ausgewählte E-Mails
  - Status-Icon (✓) in E-Mail-Liste für erledigte E-Mails
  - Filter-Optionen: "Alle", "Nur erledigte", "Nur unerledigte" als separates Dropdown
  - Entfernung von "Erledigt" und "Nicht erledigt" aus allgemeinem Status-Filter
  - Implementiert in `apps/mailclient/src/components/EmailToolbar.tsx`, `apps/mailclient/src/components/EmailListItem.tsx`, `apps/mailclient/src/components/EmailFilters.tsx`, `apps/mailclient/src/app/emails/page.tsx`

- **Filter-Logik**
  - Dedizierter `completedStatus` Filter getrennt vom allgemeinen Status-Filter
  - Korrekte Filterung: Erledigte E-Mails werden nur angezeigt, wenn explizit ausgewählt
  - Implementiert in `apps/mailclient/src/utils/filterEmails.ts`

#### E-Mail-Timeline mit erweiterten Events
- **Neue Event-Typen**
  - `marked_completed`: E-Mail als erledigt markiert
  - `marked_uncompleted`: E-Mail als unerledigt markiert
  - `department_assigned`: Abteilung zugewiesen
  - `department_removed`: Abteilung entfernt
  - Implementiert in `apps/mailclient/src/lib/email-events.ts`

- **Benutzerinformationen in Timeline**
  - Anzeige des Benutzers, der eine Aktion ausgeführt hat
  - Join mit `users` Tabelle für Benutzernamen und E-Mail-Adressen
  - Fallback-Logik: Name → Username → E-Mail → "Unbekannt"
  - Implementiert in `apps/mailclient/src/lib/email-events.ts`, `apps/mailclient/src/components/EmailTimeline.tsx`

- **Event-Deduplizierung**
  - Server-seitige Deduplizierung: Verhindert doppelte Events innerhalb von 5 Sekunden
  - Client-seitige Deduplizierung: Filtert semantisch identische Events (gleicher Typ, User, E-Mail, Timestamp innerhalb von 10 Sekunden)
  - Bevorzugt neuere Events bei Duplikaten
  - Implementiert in `apps/mailclient/src/lib/email-events.ts`, `apps/mailclient/src/components/EmailTimeline.tsx`

- **Timeline-Integration**
  - Timeline unter E-Mail-Vorschau platziert
  - Collapsible mit Toggle-Button
  - Resizable Höhe per Drag-and-Drop
  - Automatisches Laden von Events beim Öffnen einer E-Mail
  - Implementiert in `apps/mailclient/src/components/EmailPreviewPane.tsx`, `apps/mailclient/src/components/EmailTimeline.tsx`

- **Event-Logging**
  - Automatisches Logging von `marked_completed`/`marked_uncompleted` Events
  - Automatisches Logging von `department_assigned`/`department_removed` Events
  - Asynchrones Logging ohne Blockierung der API-Antwort
  - Implementiert in `apps/mailclient/src/app/api/emails/[id]/route.ts`, `apps/mailclient/src/app/api/emails/[id]/departments/route.ts`

#### Modernes Frontend-Redesign mit Fallback-Mechanismus (veraltet - entfernt)
- **Tailwind CSS Integration**
  - Tailwind CSS wurde installiert und konfiguriert
  - PostCSS und Autoprefixer für Build-Prozess hinzugefügt
  - Safelist für bestehende CSS-Klassen konfiguriert (verhindert Konflikte)
  - Responsive Design-Klassen bleiben erhalten (`.col-medium`, `.col-large`, etc.)
  - Implementiert in `apps/mailclient/tailwind.config.js`, `apps/mailclient/postcss.config.js`

- **Theme-System**
  - Theme-Context für Theme-Management (`ThemeProvider`, `useTheme` Hook)
  - Unterstützung für zwei Themes: "classic" (altes Design) und "modern" (neues Design)
  - SSR-sichere Implementierung (verhindert Hydration-Mismatches)
  - Persistente Theme-Auswahl in localStorage
  - Automatisches Setzen von `body`-Klasse für CSS-Selektion (`theme-classic` oder `theme-modern`)
  - Implementiert in `apps/mailclient/src/lib/theme-context.tsx`

- **Theme-Switch in Einstellungen**
  - Dropdown zur Auswahl des Designs in Allgemeine Einstellungen
  - Sofortiges Umschalten zwischen classic und modern Design
  - Implementiert in `apps/mailclient/src/components/GeneralSettings.tsx`

- **Wiederverwendbare Komponenten**
  - `Button`-Komponente mit Theme-Support (unterstützt primary, secondary, danger, success, warning Varianten)
  - `Card`-Komponente mit Theme-Support
  - Automatisches Fallback auf klassische CSS-Klassen im classic-Theme
  - Implementiert in `apps/mailclient/src/components/Button.tsx`, `apps/mailclient/src/components/Card.tsx`

- **Migrierte Komponenten (Phase 1)**
  - **Header**: Modernes Design mit Tailwind, Fallback auf klassisches Design
  - **Sidebar**: Modernes Design mit Tailwind, Fallback auf klassisches Design
  - **QuickActions**: Verwendet neue Button-Komponente
  - **GeneralSettings**: Verwendet neue Card- und Button-Komponenten, enthält Theme-Switch

### Geändert

#### E-Mail-Fetcher Modul-Refactoring (Geplant)
- **Aufteilung von `email-fetcher.ts` in vier Module**
  - `imap-client.ts`: IMAP-Verbindung, Ordner-Öffnung, E-Mail-Suche, Fetch-Logik
  - `email-parser.ts`: Parsing-Logik mit mailparser (E-Mail-Daten-Extraktion)
  - `attachment-handler.ts`: Attachment-Verarbeitung (Konvertierung, Speicherung, Metadaten)
  - `email-fetcher.ts`: Orchestrierung (bleibt als Haupt-Export-Modul)
- **Vorteile der Modulaufteilung**
  - Klare Verantwortlichkeiten: Jedes Modul hat eine eindeutige Aufgabe
  - Einfache Tests: Module können isoliert getestet werden
  - Wiederverwendbarkeit: `imap-client.ts` und `email-parser.ts` können unabhängig verwendet werden
  - Wartbarkeit: Änderungen an IMAP-Logik, Parsing oder Attachments sind isoliert
  - Backward Compatibility: Öffentliche API (`fetchEmailsForUser`) bleibt unverändert
- **Geplante Optimierungen**
  - DB-Verbindung-Wiederverwendung für gesamten Batch-Prozess
  - Parallelisierung von Parsing und Attachment-Konvertierung mit begrenzter Concurrency
  - Konfigurierbare Batch-Größen
  - Zentrale Konfiguration für Timeouts, Concurrency-Limits, etc.
- **Implementierung**
  - Detaillierter Plan in `.cursor/plans/email-fetcher_aufteilung_d3e499f1.plan.md`
  - Alle Abhängigkeiten, Imports, Exports und Datenflüsse dokumentiert
  - Vollständige Validierung: Aufteilung wird zu 100% funktionieren

#### Frontend-Migration
- `apps/mailclient/src/app/layout.tsx`: ThemeProvider integriert
- `apps/mailclient/src/app/globals.css`: Tailwind-Direktiven hinzugefügt
- Bestehende CSS-Klassen bleiben erhalten für Fallback-Mechanismus
- Komponenten prüfen Theme über `useTheme()` Hook und rendern entsprechend

### Hinzugefügt

#### Abteilungs-Management mit E-Mail-Konto-Integration
- **Aktiv/Inaktiv Status für Abteilungen**
  - Abteilungen können jetzt aktiv oder inaktiv geschaltet werden
  - Nur aktive Abteilungen können für E-Mail-Versand verwendet werden
  - Inaktive Abteilungen werden in Dropdowns ausgeblendet (außer in Admin-Ansichten)
  - Automatische Deaktivierung von Abteilungen, wenn zugeordnetes E-Mail-Konto gelöscht oder deaktiviert wird
  - Implementiert in `apps/mailclient/src/lib/tenant-db-client.ts`, `apps/mailclient/src/app/api/departments/route.ts`

- **E-Mail-Konto-Zuordnung zu Abteilungen**
  - Jede Abteilung kann einem E-Mail-Konto zugeordnet werden
  - Ein E-Mail-Konto kann nur einer einzigen Abteilung zugeordnet werden (UNIQUE Constraint)
  - Validierung: E-Mail-Konto muss aktiv sein und SMTP-Daten haben
  - E-Mail-Konto muss zur gleichen Company gehören
  - Automatische Validierung bei Erstellung und Aktualisierung von Abteilungen
  - Implementiert in `apps/mailclient/src/lib/tenant-db-client.ts`, `apps/mailclient/src/app/api/departments/route.ts`, `apps/mailclient/src/app/api/departments/[id]/route.ts`

- **Abteilungsauswahl beim E-Mail-Versand**
  - Beim Erstellen einer neuen E-Mail muss eine Abteilung ausgewählt werden
  - Nur aktive Abteilungen mit zugeordnetem E-Mail-Konto werden angezeigt
  - Automatische Vorauswahl der Standard-Abteilung aus Benutzereinstellungen
  - Speicherung der zuletzt verwendeten Abteilung in localStorage
  - Beim Antworten aus einem Filter wird automatisch die Abteilung des Filters vorausgewählt
  - E-Mails werden mit dem E-Mail-Konto der ausgewählten Abteilung versendet
  - Implementiert in `apps/mailclient/src/app/emails/compose/page.tsx`, `apps/mailclient/src/app/api/emails/route.ts`

- **Automatische Abteilungszuweisung bei eingehenden E-Mails**
  - Eingehende E-Mails werden automatisch einer Abteilung zugewiesen, wenn die Empfänger-Adresse mit einem aktiven Abteilungs-E-Mail-Konto übereinstimmt
  - Unterstützt mehrere Empfänger (prüft alle Empfänger-Adressen)
  - Verhindert doppelte Zuweisungen
  - Implementiert in `apps/mailclient/src/lib/email-fetcher.ts`

- **"Abteilung zuweisen" Aktion im Workflow-Editor**
  - Neue Aktion im Automation-Workflow-Editor zum automatischen Zuweisen von Abteilungen zu E-Mails
  - Konfigurierbar über Dropdown mit allen aktiven Abteilungen
  - Funktioniert abteilungsübergreifend
  - Protokolliert `department_assigned` Events
  - Implementiert in `apps/mailclient/src/components/AutomationWorkflowEditor.tsx`, `apps/mailclient/src/lib/automation-engine.ts`

- **Erweiterte E-Mail-Konto-Verwaltung**
  - Administratoren sehen alle E-Mail-Konten der Company (nicht nur eigene)
  - E-Mail-Konten zeigen an, ob sie bereits einer Abteilung zugeordnet sind
  - Automatische Deaktivierung von Abteilungen beim Löschen oder Deaktivieren eines E-Mail-Kontos
  - Implementiert in `apps/mailclient/src/app/api/email-accounts/route.ts`, `apps/mailclient/src/app/api/email-accounts/[id]/route.ts`

- **Abteilungsanzeige in E-Mail-Listen und Timeline**
  - Abteilungen werden in der E-Mail-Liste als Badges angezeigt
  - Abteilungsinformationen werden in der E-Mail-Timeline angezeigt
  - Filterung nach Abteilungen in E-Mail-Listen
  - Implementiert in `apps/mailclient/src/components/EmailTableItem.tsx`, `apps/mailclient/src/components/EmailTimeline.tsx`, `apps/mailclient/src/app/api/emails/route.ts`

- **Workflow-Editor Verbesserungen**
  - Zoom-Level wird jetzt als Prozentsatz in der unteren rechten Ecke angezeigt
  - Initialer Zoom-Level auf 100% gesetzt
  - Redundante "Abteilungen" Sektion aus der Sidebar entfernt
  - "Abteilung zuweisen" Aktion zeigt deutschen Label
  - Implementiert in `apps/mailclient/src/components/AutomationWorkflowEditor.tsx`

- **Verbesserte Filter-Persistenz**
  - Aktiver Filter bleibt nach Aktionen (z.B. Löschen, Als gelesen markieren) erhalten
  - URL-Parameter werden korrekt verwaltet, um Filter-Zustand zu erhalten
  - Sidebar zeigt weiterhin den korrekten aktiven Filter an
  - Implementiert in `apps/mailclient/src/app/emails/page.tsx`

- **Datenbank-Schema Erweiterungen**
  - `departments` Tabelle: `is_active` (BOOLEAN), `email_account_id` (UUID, UNIQUE)
  - `emails` Tabelle: `department_id` (UUID)
  - `user_settings` Tabelle: `default_department_id` (UUID)
  - Automatische Migration für bestehende Daten
  - Indexes für Performance-Optimierung
  - Implementiert in `apps/mailclient/src/lib/tenant-db-client.ts`

### Behoben

#### Verschlüsselungsschlüssel-Konfiguration und Migration
- **ENCRYPTION_KEY Konfiguration und Migration**
  - ENCRYPTION_KEY muss jetzt in `.env` Dateien gesetzt werden (SCC und Mailclient)
  - Automatische Warnung, wenn ENCRYPTION_KEY nicht gesetzt ist (verwendet Dev-Key als Fallback)
  - Neues Migrationsskript `apps/scc/scripts/migrate-encryption-key.ts` zum Migrieren verschlüsselter Passwörter
  - Migrationsskript entschlüsselt alle DB-Passwörter mit dem alten Key und verschlüsselt sie mit dem neuen Key neu
  - Unterstützt nahtlose Migration ohne Datenverlust
  - Validierung: ENCRYPTION_KEY muss mindestens 32 Zeichen lang sein
  - Implementiert in `apps/scc/src/common/encryption.service.ts`, `apps/mailclient/src/lib/scc-client.ts`
  - Dokumentation in `apps/scc/README.md` erweitert

#### Speicherplatz-Berechnung für E-Mail-Anhänge
- **Fix: Korrekte Pfadauflösung für Anhänge-Verzeichnis**
  - Speicherplatz-Berechnung sucht jetzt automatisch im richtigen Verzeichnis (`apps/mailclient/storage`)
  - Automatische Pfadauflösung funktioniert sowohl im Development- als auch Production-Modus
  - Unterstützung für relative und absolute Pfade über `STORAGE_PATH` Umgebungsvariable
  - Verbesserte Path-Validierung mit normalisierten Pfaden für Windows-Kompatibilität
  - Umfangreiche Debug-Logs hinzugefügt für bessere Fehlerdiagnose
  - Implementiert in `apps/scc/src/companies/companies.service.ts`

- **Neues Skript zum Neustarten des SCC-Services**
  - `restart-scc.ps1` zum einfachen Neustarten des SCC-Services
  - Beendet automatisch den Service auf Port 3001 und startet ihn neu
  - Erleichtert das Testen und Debugging
  - Verfügbar im Root-Verzeichnis des Projekts

### Hinzugefügt

#### System-Logs (Erweiterte Logging-Funktionalität)
- **Umbenennung und Erweiterung der Cron-Job-Logs zu System-Logs**
  - Umbenennung von "Cron-Job-Logs" zu "System-Logs" für bessere Übersichtlichkeit
  - Erweiterte Log-Aggregation aus verschiedenen Quellen:
    - **Cron-Job-Logs**: Aus SCC-Datenbank (wie bisher)
    - **Automation-Logs**: Aus Tenant-Datenbanken (`automation_execution_logs`)
    - **E-Mail-Events**: Aus Tenant-Datenbanken (`email_events`, optional)
  - Neue API-Endpunkte:
    - `GET /api/system-logs/companies/:id/logs` - Alle System-Logs für eine Company
    - `POST /api/system-logs/log` - Log-Eintrag erstellen/aktualisieren (öffentlich, Service-Token)
    - `POST /api/system-logs/logs/batch` - Batch-Logging (öffentlich, Service-Token)
  - Filterung nach Log-Typ: `cron_job`, `automation`, `email_event`
  - Automatische Zusammenführung und Sortierung aller Logs nach Timestamp
  - Fehlerbehandlung: Fehler beim Abrufen von Tenant-DB-Logs sind nicht kritisch (nur Warnung)
  - Implementiert in `apps/scc/src/cron-jobs/cron-jobs.service.ts`, `apps/scc/src/cron-jobs/cron-jobs.controller.ts`

- **Frontend-Integration für System-Logs**
  - Umbenennung der UI von "Cron-Job-Logs" zu "System-Logs"
  - Filter-Dropdown für Log-Typen (Alle, Cron-Jobs, Automatisierungen, E-Mail-Events)
  - Erweiterte Tabellenansicht mit Log-Typ-Badges
  - Farbcodierung je Log-Typ:
    - Cron-Jobs: Blau
    - Automatisierungen: Türkis
    - E-Mail-Events: Grau
  - Detaillierte Anzeige je Log-Typ:
    - Cron-Jobs: Job-Typ, Job-Key, verarbeitete Items
    - Automatisierungen: Regel-ID, Trigger-Typ, ausgeführte Aktionen
    - E-Mail-Events: Event-Typ, E-Mail-ID
  - Implementiert in `apps/scc-frontend/src/app/companies/[id]/page.tsx`

- **API-Endpunkt-Aktualisierung**
  - Logger-Endpunkte aktualisiert: `/cron-jobs/log` → `/system-logs/log`
  - Batch-Endpunkt aktualisiert: `/cron-jobs/logs/batch` → `/system-logs/logs/batch`
  - Rückwärtskompatibilität: `getCronJobLogs()` bleibt als Alias erhalten
  - Implementiert in `apps/mailclient/src/lib/cron-job-logger.ts`

### Hinzugefügt

#### Anhänge-Anzeige im E-Mail-Vorschau-Header
- **Anhänge-Informationen im Header der E-Mail-Vorschau**
  - Anhänge werden jetzt direkt im Header der E-Mail-Vorschau angezeigt
  - "Anhänge:"-Zeile erscheint immer im Header, direkt nach "Datum:"
  - Klickbare Download-Links für jeden Anhang mit Dateiname
  - Tooltip zeigt Dateiname und Dateigröße beim Hover
  - Automatisches Laden der Anhänge beim Auswählen einer E-Mail
  - Drei Zustände werden angezeigt: "Lade...", klickbare Links oder "Keine"
  - Verbesserte Fehlerbehandlung beim Laden der Anhänge
  - Implementiert in `apps/mailclient/src/components/EmailPreview.tsx`

#### Verbesserte Login-Funktionalität im SCC-Frontend
- **Verbesserte Fehlerbehandlung im Login**
  - Detaillierte Fehlermeldungen vom Backend werden jetzt korrekt angezeigt
  - Unterstützung für verschiedene Fehlerformate (message, error, statusCode)
  - Spezifische Fehlermeldungen für verschiedene HTTP-Status-Codes (401, 400, 500+)
  - Verbesserte Verbindungsfehler-Erkennung mit hilfreichen Hinweisen
  - Vollständige Logging der Server-Antworten in der Browser-Konsole für Debugging
  - Implementiert in `apps/scc-frontend/src/app/login/page.tsx`

- **Vorausgefüllte Standard-Login-Werte**
  - E-Mail und Passwort-Felder werden automatisch mit Standard-Werten vorausgefüllt
  - Erleichtert das Testen und schnelle Anmeldung
  - Standard-Werte: `admin@saivaro.local` / `admin123`
  - Implementiert in `apps/scc-frontend/src/app/login/page.tsx`

- **Verbessertes Logging im Auth-Service**
  - Detaillierte Logs für Authentifizierungsfehler im Backend
  - Loggt, ob Benutzer nicht gefunden wurde, Passwort ungültig ist oder Benutzer inaktiv ist
  - Hilft bei der Fehlerdiagnose und Debugging
  - Implementiert in `apps/scc/src/auth/auth.service.ts`

- **Hilfsskript zur Benutzer-Verwaltung**
  - Neues Skript `scripts/check-user.ts` zum Prüfen und Erstellen von SCC-Benutzern
  - Prüft, ob Benutzer existiert und ob Passwort korrekt ist
  - Erstellt Benutzer automatisch, falls nicht vorhanden
  - Setzt Passwort zurück, falls nicht übereinstimmend
  - Verfügbar über `pnpm db:check-user` im `apps/scc` Verzeichnis
  - Implementiert in `apps/scc/scripts/check-user.ts`

#### "Alle Mails" Button in Sidebar
- **Neuer Button "Alle Mails" in der Sidebar**
  - Direkt unter "Multi-Tenant E-Mail" platziert
  - Zeigt alle E-Mails der Datenbank unabhängig von Filtern an
  - Inklusive gelöschter E-Mails (wenn aktiv)
  - Im Stil der Filter-Buttons für konsistente UI
  - Berücksichtigt weiterhin die maximale Anzahl anzuzeigender Mails (Limit & Paginierung)
  - Implementiert in `apps/mailclient/src/components/Sidebar.tsx`, `apps/mailclient/src/app/emails/page.tsx`

#### Filter-Neuladen-Funktionalität
- **Neuladen beim Klick auf bereits aktiven Filter**
  - Beim Klick auf einen bereits aktiven Filter werden die E-Mails neu geladen
  - Verhindert Navigation, wenn Filter bereits aktiv ist
  - Custom Event `reloadEmails` für manuelles Neuladen
  - Funktioniert für "Alle Mails" Button und alle benutzerdefinierten Filter
  - Implementiert in `apps/mailclient/src/components/Sidebar.tsx`, `apps/mailclient/src/app/emails/page.tsx`

### Behoben

#### SMTP-Versand-Implementierung
- **Vollständige SMTP-Versand-Funktionalität für E-Mails**
  - E-Mails werden jetzt tatsächlich über SMTP versendet (vorher nur in DB gespeichert)
  - Verwendung von `nodemailer` für SMTP-Versand
  - Automatische Verwendung des SMTP-Kontos des Benutzers
  - Korrekte Absender-Adresse: Verwendet E-Mail-Adresse aus SMTP-Konto statt `admin@localhost`
  - E-Mail-Adressen-Extraktion: Formatierte Adressen wie `"Name" <email@example.com>` werden korrekt verarbeitet
  - CC/BCC-Unterstützung: Korrekte Extraktion und Verarbeitung von CC- und BCC-Adressen
  - Verbesserte E-Mail-Header: Message-ID, Date, X-Mailer-Header für bessere Zustellbarkeit
  - Reply-To-Header: Wird gesetzt, wenn User-E-Mail sich von Sender-E-Mail unterscheidet
  - Fehlerbehandlung: E-Mail bleibt in DB gespeichert, auch wenn SMTP-Versand fehlschlägt
  - Implementiert in `apps/mailclient/src/app/api/emails/route.ts`

#### Gelesen/Ungelesen-Funktionalität
- **Korrektur der Gelesen/Ungelesen-Status-Erkennung**
  - Präzise Transformation von `read_at` zu `read` Boolean-Wert
  - Korrekte Filter-Logik für gelesene/ungelesene E-Mails
  - Automatische Aktualisierung der Sidebar-Counter bei Status-Änderungen
  - Fette Darstellung der Counter bei ungelesenen E-Mails in Filtern
  - Implementiert in `apps/mailclient/src/app/emails/page.tsx`, `apps/mailclient/src/components/Sidebar.tsx`

#### Passwort-Hashing-Migration
- **Umstellung von `bcrypt` auf `bcryptjs`**
  - Migration zu reiner JavaScript-Implementierung ohne native Abhängigkeiten
  - Behebt Next.js-Build-Probleme mit nativen Modulen
  - Kompatible API - bestehende Passwort-Hashes funktionieren weiterhin
  - Entfernung der komplexen Webpack-Konfiguration für `bcrypt`
  - Implementiert in allen API-Routen: `apps/mailclient/src/app/api/auth/login/route.ts`, `apps/mailclient/src/app/api/users/route.ts`, `apps/mailclient/src/app/api/users/[id]/route.ts`

#### E-Mail-Anhang-Erkennung
- **Anhang-Spalte in E-Mail-Tabelle**
  - Neue Spalte mit 📎-Symbol für E-Mails mit Anhängen
  - Automatische Erkennung von Anhängen beim E-Mail-Abruf
  - `has_attachment` Spalte in Datenbank hinzugefügt
  - IMAP-Fetch mit `RFC822` für vollständige E-Mail-Inhalte
  - Korrekte Buffer-Behandlung für binäre Anhänge
  - Spalten-Manager-Unterstützung für Anhang-Spalte
  - Implementiert in `apps/mailclient/src/lib/email-fetcher.ts`, `apps/mailclient/src/components/EmailList.tsx`, `apps/mailclient/src/components/EmailTableItem.tsx`

#### Sidebar-Counter-Updates
- **Automatische Aktualisierung der Filter-Counter**
  - Polling-Mechanismus (alle 30 Sekunden) für Counter-Updates
  - Custom Event `emailsFetched` für sofortige Updates nach manuellem E-Mail-Abruf
  - Fette Darstellung der Counter bei ungelesenen E-Mails
  - **Korrektur der Counter-Berechnung für gelöschte E-Mails**
    - Filter, die nach gelöschten E-Mails suchen, zeigen jetzt korrekte Anzahl
    - API-Aufruf mit `showDeleted=true` Parameter, wenn Filter nach gelöschten Mails sucht
    - Behebt Problem, dass Filter für gelöschte Mails immer 0 anzeigten
  - Implementiert in `apps/mailclient/src/components/Sidebar.tsx`

#### Verbesserte Fehlerbehandlung
- **Detailliertere Fehlermeldungen in API-Routen**
  - Prüfung auf JSON-Antworten vor dem Parsen
  - Detaillierte Fehlermeldungen im Development-Modus
  - Verbesserte Client-Freigabe bei Fehlern in Datenbank-Operationen
  - Implementiert in `apps/mailclient/src/app/api/users/route.ts`, `apps/mailclient/src/app/api/users/[id]/route.ts`, `apps/mailclient/src/app/emails/settings/page.tsx`, `apps/mailclient/src/app/login/page.tsx`

### Hinzugefügt

#### Responsive Tabellenoptimierung
- **Optimierte E-Mail-Tabelle für verschiedene Bildschirmgrößen**
  - Tabellenlayout von `fixed` auf `auto` geändert für bessere Anpassungsfähigkeit
  - Spaltenbreiten-Synchronisation zwischen Tabellenkopf (Header) und Tabellenkörper (Body)
  - Ausgeblendete Spalten nehmen keine Breite ein (width: 0, padding: 0) für korrekte Breitenverteilung
  - Responsive Breakpoints für verschiedene Bildschirmgrößen:
    - ≤ 1024px (Tablet): Thema- und Abteilungs-Spalten werden ausgeblendet
    - ≤ 768px (Kleine Tablets): Zusätzlich "Von (CB)", "Empfänger" und Status-Spalten ausgeblendet
    - ≤ 640px (Handys): Zusätzlich "Beteiligte" ausgeblendet, horizontales Scrollen aktiviert
    - ≤ 480px (Kleine Handys): Kompaktere Darstellung mit kleineren Schriftgrößen
  - Flexible Spaltenbreiten: Betreff-Spalte nutzt verfügbaren Platz proportional
  - Responsive Toolbar: Button-Texte werden auf kleineren Bildschirmen ausgeblendet, nur Icons bleiben sichtbar
  - Theme-Spalte zeigt jetzt "Thema" statt Symbol im Tabellenkopf
  - Implementiert in `apps/mailclient/src/components/EmailList.tsx`, `EmailTableItem.tsx` und `apps/mailclient/src/app/globals.css`

### Hinzugefügt

#### Modernes Einstellungsmenü-Redesign
- **Dashboard-Layout statt Tabs**: Komplett neu gestaltetes Einstellungsmenü mit modernem Dashboard-Design
  - Karten-basierte Übersicht für alle Einstellungskategorien
  - Moderne Hover-Effekte und Animationen
  - Responsive Grid-Layout für verschiedene Bildschirmgrößen
  - Implementiert in `apps/mailclient/src/components/SettingsDashboard.tsx`
- **Breadcrumb-Navigation**: Kontextabhängige Pfadanzeige für bessere Navigation
  - Automatische Generierung basierend auf aktueller Route
  - Klickbare Pfadelemente für einfache Navigation
  - Implementiert in `apps/mailclient/src/components/Breadcrumb.tsx`
- **Quick Actions**: Schnellzugriffe für häufig genutzte Funktionen
  - Kompakte Icon-basierte Buttons
  - Konfigurierbar und erweiterbar
  - Implementiert in `apps/mailclient/src/components/QuickActions.tsx`
- **Suchfunktion für Einstellungen**: Echtzeit-Suche durch alle Einstellungsoptionen
  - Debounced Suche (300ms) für optimale Performance
  - Highlighting von Suchergebnissen
  - Implementiert in `apps/mailclient/src/components/SettingsSearch.tsx`
- **Zurück-Button**: Navigation zurück zum Dashboard von Detailansichten
  - Erscheint automatisch in Detailansichten
  - Keyboard-Shortcut: ESC
  - Warnung bei ungespeicherten Änderungen
- **Toast-Notification-System**: Modernes Benachrichtigungssystem
  - Ersetzt alle `alert()`-Aufrufe (33 Stellen in 5 Dateien)
  - Verschiedene Typen: success, error, warning, info
  - Nicht-blockierend, automatisches Ausblenden nach 3-7 Sekunden
  - Stack-System für mehrere Toasts gleichzeitig
  - Implementiert in `apps/mailclient/src/components/Toast.tsx` und `ToastProvider.tsx`
- **Keyboard Shortcuts**: Tastaturkürzel für häufige Aktionen
  - `Ctrl+S` / `Cmd+S`: Einstellungen speichern
  - `ESC`: Zurück zur Dashboard-Übersicht
  - `Ctrl+K` / `Cmd+K`: Fokus auf Suchfeld
  - `Ctrl+N` / `Cmd+N`: Neues Element erstellen (kontextabhängig)
- **Auto-Save mit Debounce**: Automatisches Speichern nach Inaktivität
  - 2.5 Sekunden Debounce für optimale Performance
  - Visueller Indikator für Auto-Save-Status ("Wird gespeichert...", "Gespeichert")
  - Verhindert zu häufige API-Calls
- **Warnung bei ungespeicherten Änderungen**: Schutz vor Datenverlust
  - Browser-BeforeUnload-Event für Seitenwechsel
  - Bestätigungsdialog beim Navigieren weg mit ungespeicherten Änderungen
  - Tracking von Änderungen durch Vergleich mit Original-Werten
- **Export/Import von Einstellungen**: Backup- und Wiederherstellungsfunktion
  - Export aller Einstellungen als JSON-Datei
  - Import mit Validierung und Vorschau
  - Inkludiert Dashboard-Karten-Reihenfolge
  - Implementiert in `apps/mailclient/src/components/SettingsExportImport.tsx`
- **Tooltip-System**: Erklärungen für komplexe Einstellungen
  - Verschiedene Positionen (top, bottom, left, right)
  - Keyboard-Navigation unterstützt
  - Accessibility-konform
  - Implementiert in `apps/mailclient/src/components/Tooltip.tsx`
- **Skeleton Screens**: Strukturierte Ladezustände statt Spinner
  - Verschiedene Varianten: Card, List, Form
  - Puls-Animation für besseres visuelles Feedback
  - Implementiert in `apps/mailclient/src/components/Skeleton.tsx`
- **Inline-Formularvalidierung**: Echtzeit-Validierung während der Eingabe
  - Visuelles Feedback: grüne Haken für gültige, rote Markierungen für ungültige Felder
  - Fehlermeldungen direkt unter den Feldern
  - Validierungsregeln: E-Mail-Format, Port-Bereiche, erforderliche Felder
  - Implementiert in `apps/mailclient/src/components/ValidatedInput.tsx` und `apps/mailclient/src/utils/validation.ts`
- **Drag & Drop für Dashboard-Karten**: Anpassbare Reihenfolge der Einstellungskategorien
  - HTML5 Drag API für Drag & Drop
  - Reihenfolge wird in localStorage gespeichert
  - Visuelles Feedback während des Drag-Vorgangs
  - Touch-Unterstützung für mobile Geräte
- **Modernisiertes EmailAccountList-Design**: Verbessertes Card-Design für E-Mail-Konten
  - Moderne Karten mit Icons und besserer visueller Hierarchie
  - Verbesserte Darstellung von Status und Metadaten
  - Skeleton Loading statt einfacher Spinner
- **Kontextabhängiger Header**: Header zeigt jetzt kontextabhängige Titel
  - "Einstellungen" auf Settings-Seite
  - "Posteingang" auf E-Mail-Seite
  - Dynamische Titel basierend auf Route
  - Implementiert in `apps/mailclient/src/components/Header.tsx`

#### Benutzer- und Abteilungsverwaltung
- **Abteilungszuweisung für Benutzer**: Many-to-Many-Beziehung zwischen Benutzern und Abteilungen
  - Junction-Tabelle `user_departments` für Abteilungszuweisungen
  - Automatische Schema-Migration beim ersten Zugriff
  - Implementiert in `apps/mailclient/src/lib/tenant-db-client.ts`
- **Abteilungsauswahl im Benutzerformular**: Multi-Select für Abteilungen
  - Checkbox-Liste aller verfügbaren Abteilungen mit Name und Beschreibung
  - Unterstützung für mehrere Abteilungen pro Benutzer
  - Automatisches Laden der Abteilungen beim Öffnen des Formulars
  - Implementiert in `apps/mailclient/src/components/UserForm.tsx`
- **Abteilungsanzeige in Benutzerliste**: Anzeige zugewiesener Abteilungen als Badges
  - Kompakte Darstellung der Abteilungen pro Benutzer
  - Implementiert in `apps/mailclient/src/components/UserManagement.tsx`
- **API-Routen für Abteilungszuweisung**: Erweiterte User-API-Routen
  - `GET /api/users`: Lädt Benutzer mit zugewiesenen Abteilungen
  - `POST /api/users`: Erstellt Benutzer und weist Abteilungen zu (via `departmentIds`)
  - `PATCH /api/users/[id]`: Aktualisiert Benutzer und Abteilungszuweisungen
  - Validierung: Nur Abteilungen der eigenen Company können zugewiesen werden
  - Implementiert in `apps/mailclient/src/app/api/users/route.ts` und `apps/mailclient/src/app/api/users/[id]/route.ts`
- **Standard-Abteilungen Button**: Schneller Zugriff auf Standard-Abteilungen
  - Button "Standard-Abteilungen hinzufügen" in der Abteilungsverwaltung
  - Intelligente Anzeige: Nur sichtbar, wenn Standard-Abteilungen fehlen
  - Zeigt Anzahl fehlender Abteilungen an
  - Erstellt nur fehlende Abteilungen (überspringt bereits vorhandene)
  - Erfolgsmeldung mit Details (erstellt/übersprungen)
  - API-Route: `POST /api/departments/default`
  - Implementiert in `apps/mailclient/src/components/DepartmentManagement.tsx` und `apps/mailclient/src/app/api/departments/default/route.ts`
- **Automatische Standard-Abteilungen bei Provisionierung**: Standard-Abteilungen werden automatisch erstellt
  - Erstellt 6 Standard-Abteilungen bei neuer Company-Provisionierung:
    - Geschäftsführung
    - Buchhaltung
    - Marketing
    - Einkauf
    - Logistik
    - Kundenservice
  - Prüft, ob bereits Abteilungen existieren (verhindert Duplikate)
  - Implementiert in `apps/scc/src/provisioning/provisioning.service.ts`

#### SCC - Datenbank-Interface
- **SQL-Query-Interface für Tenant-Datenbanken**: Umfassendes Datenbank-Interface ähnlich phpMyAdmin
  - SQL-Query-Editor mit Syntax-Highlighting und Query-History (letzte 20 Queries in localStorage)
  - Query-Bookmarks zum Speichern häufig verwendeter Queries
  - Undo/Redo-Funktionalität im SQL-Editor (Ctrl+Z, Ctrl+Y)
  - Keyboard Shortcuts: Ctrl+Enter zum Ausführen, Ctrl+Z/Ctrl+Y für Undo/Redo
  - EXPLAIN ANALYZE Button für Query-Performance-Analyse
  - SQL-Formatierung (Auto-Format Button)
  - Query-Warnung bei gefährlichen Befehlen (DROP, TRUNCATE, DELETE, UPDATE) mit Bestätigungs-Dialog
  - Export-Funktionen: CSV und JSON Export für Query-Ergebnisse
  - Implementiert in `apps/scc-frontend/src/app/companies/[id]/database/page.tsx`
- **Datenbank-Explorer**: Umfassende Navigation durch Datenbank-Objekte
  - Tabellen-Liste mit Metadaten (Spaltenanzahl)
  - Tabellenstruktur-Anzeige mit Tabs für Spalten, Indizes, Foreign Keys, Constraints und Statistiken
  - Paginierte Tabellendaten-Anzeige mit Client-seitiger Filterung und Sortierung
  - Spalten-Auswahl (Ein-/Ausblenden von Spalten)
  - Copy-Button für einzelne Zellen (Kopieren per Klick)
  - Views, Sequences und Functions in Sidebar anzeigen
  - Lazy Loading für Tabellen-Metadaten (Indizes, Foreign Keys, Constraints, Statistiken)
  - Implementiert in `apps/scc-frontend/src/app/companies/[id]/database/page.tsx`
- **Backend API-Endpoints für Datenbank-Interaktion**:
  - `POST /companies/:id/execute-query` - SQL-Queries ausführen mit Sicherheitsprüfungen
  - `POST /companies/:id/explain-query` - EXPLAIN ANALYZE für Query-Performance-Analyse
  - `GET /companies/:id/tables` - Liste aller Tabellen mit Metadaten
  - `GET /companies/:id/tables/:tableName` - Tabellenstruktur (Spalten, Datentypen, Constraints)
  - `GET /companies/:id/tables/:tableName/data` - Paginierte Tabellendaten
  - `GET /companies/:id/tables/:tableName/indexes` - Indizes einer Tabelle
  - `GET /companies/:id/tables/:tableName/foreign-keys` - Foreign Keys einer Tabelle
  - `GET /companies/:id/tables/:tableName/constraints` - Alle Constraints (Primary Key, Unique, Check)
  - `GET /companies/:id/tables/:tableName/stats` - Tabellen-Statistiken (Zeilenanzahl, Größe)
  - `GET /companies/:id/database-info` - Datenbank-Metadaten (Version, Größe, Name)
  - `GET /companies/:id/views` - Liste aller Views
  - `GET /companies/:id/sequences` - Liste aller Sequences
  - `GET /companies/:id/functions` - Liste aller Functions/Procedures
  - Implementiert in `apps/scc/src/companies/companies.controller.ts` und `companies.service.ts`
- **Sicherheitsfeatures**:
  - Query-Timeout: Standard 30 Sekunden, max. 60 Sekunden (via PostgreSQL `statement_timeout`)
  - Ergebnismengenlimit: Standard 1000 Zeilen, max. 10000 Zeilen (via LIMIT-Klausel)
  - Query-Length-Limit: Max. 100 KB Query-Länge
  - Tabellenname-Validierung: Whitelist-Validierung (nur alphanumerisch + Unterstrich) gegen SQL-Injection
  - Connection-Health-Check: Prüfung der Datenbank-Verbindung vor Query-Ausführung
  - Strukturierte Error-Responses mit detaillierten Fehlermeldungen in Development
  - Query-Logging: Strukturiertes Logging für alle Queries (wer, was, wann, wie lange)
  - Implementiert in `apps/scc/src/companies/companies.service.ts` und `database-helpers.ts`
- **Helper-Funktionen für Datenbank-Operationen**:
  - `validateTableName()` - Tabellenname-Validierung gegen Whitelist
  - `createTenantDbPool()` - DB-Pool erstellen mit Error-Handling und Connection-Test
  - `formatQueryError()` - Konsistente Error-Formatierung für Development und Produktion
  - `sanitizeQueryForLogging()` - Query-Text kürzen für Logging
  - Implementiert in `apps/scc/src/companies/database-helpers.ts`
- **DTOs mit Validierung**:
  - `ExecuteQueryDto` - Validierung für SQL-Query-Endpoint (query, limit, timeout)
  - `TableDataQueryDto` - Validierung für paginierte Tabellendaten (page, limit)
  - Implementiert in `apps/scc/src/companies/dto/execute-query.dto.ts` und `table-data.dto.ts`
- **Navigation-Integration**:
  - "Datenbank öffnen" Button in Company-Detail-Seite (nur wenn `provisioningStatus === 'ready'`)
  - "DB" Button in Companies-Liste für schnellen Zugriff
  - Breadcrumbs-Navigation (Companies > [Company-ID] > Datenbank)
  - Implementiert in `apps/scc-frontend/src/app/companies/[id]/page.tsx` und `companies/page.tsx`
- **Frontend-Features**:
  - Connection-Status Badge (verbunden/nicht verbunden)
  - Database Info Panel (Datenbank-Name, Größe, PostgreSQL-Version, Anzahl Tabellen)
  - Performance-Metriken (Ausführungszeit, Zeilenanzahl, Limit-Hinweis)
  - Loading States (Spinner, Skeleton-Loader)
  - Responsive Design (Mobile/Tablet-optimiert)
  - Error-Highlighting im SQL-Editor (roter Border bei Fehlern)

#### SCC - Speicherplatz-Anzeige
- **Detaillierte Speicherplatz-Anzeige für Firmen**: Umfassende Übersicht über verwendeten Speicherplatz
  - Gesamtübersicht mit Datenbank- und Dateispeicherplatz
  - Detaillierte Aufschlüsselung nach Datenbank-Tabellen (Größe, Index-Größe, Zeilenanzahl)
  - Dateispeicherplatz-Kategorisierung (E-Mail-Anhänge, Uploads, Sonstige)
  - Implementiert in `apps/scc-frontend/src/components/StorageUsage.tsx`
- **Backend API-Endpoint für Speicherplatz-Informationen**:
  - `GET /companies/:id/storage-usage` - Detaillierte Speicherplatz-Informationen abrufen
  - Query-Parameter `refresh` zum Umgehen des Caches
  - Vollständige Swagger-Dokumentation mit DTOs
  - Implementiert in `apps/scc/src/companies/companies.controller.ts` und `companies.service.ts`
- **Datenbank-Speicherplatz-Berechnung**:
  - Optimierte SQL-Query mit `pg_class` für bessere Performance
  - Batch-Verarbeitung für Zeilenanzahl (max. 10 Tabellen parallel)
  - Detaillierte Aufschlüsselung nach Tabellen (Größe, Index-Größe, TOAST-Tabellen)
  - Strukturiertes Logging mit Performance-Metriken
  - Implementiert in `apps/scc/src/companies/companies.service.ts`
- **Dateispeicherplatz-Berechnung**:
  - Rekursive Verzeichnisgrößenberechnung mit AbortController für Timeout-Handling
  - Path-Validierung gegen Path-Traversal-Angriffe
  - Kategorisierung nach Unterverzeichnissen (attachments/, uploads/, root)
  - Timeout-Mechanismus (konfigurierbar, Standard: 30 Sekunden)
  - Graceful Error-Handling bei fehlenden Verzeichnissen
  - Implementiert in `apps/scc/src/companies/companies.service.ts`
- **Caching-Mechanismus**:
  - In-Memory Cache mit 5 Minuten TTL (konfigurierbar)
  - Optimierter Cache-Cleanup (nur bei Bedarf oder periodisch)
  - Cache-Invalidierung via `?refresh=true` Query-Parameter
  - Verhindert Memory Leaks bei vielen Firmen
  - Implementiert in `apps/scc/src/companies/companies.service.ts`
- **Shared Types & Utilities**:
  - `StorageUsage`, `DatabaseStorageUsage`, `TableStorageInfo`, `FileStorageUsage` Interfaces
  - `formatBytes` Utility-Funktion mit Fehlerbehandlung (negative Zahlen, NaN, Infinity)
  - Exportiert in `packages/shared/src/types/index.ts` und `packages/shared/src/utils/format.ts`
- **Frontend-Features**:
  - Detaillierte Tabellenansicht für Datenbank-Speicherplatz
  - Kategorisierte Anzeige für Dateispeicherplatz (Anhänge, Uploads, Sonstige)
  - Loading States (Skeleton-Loader, Progress-Indikator)
  - Error States mit Retry-Mechanismus
  - Empty States für leere Daten
  - React Error Boundary für Fehler-Isolation
  - Aktualisieren-Button zum manuellen Cache-Refresh
  - Responsive Design für alle Bildschirmgrößen
  - Implementiert in `apps/scc-frontend/src/components/StorageUsage.tsx` und `StorageUsageErrorBoundary.tsx`
- **DTOs für Swagger-Dokumentation**:
  - `StorageUsageDto`, `DatabaseStorageUsageDto`, `FileStorageUsageDto`, `TableStorageInfoDto`
  - Vollständige API-Dokumentation mit Beispiel-Responses
  - Implementiert in `apps/scc/src/companies/dto/storage-usage.dto.ts`
- **Konfiguration**:
  - Umgebungsvariablen: `STORAGE_PATH`, `STORAGE_CACHE_TTL`, `STORAGE_CALCULATION_TIMEOUT`, `STORAGE_CACHE_CLEANUP_INTERVAL`, `STORAGE_CACHE_CLEANUP_THRESHOLD`
  - Standardwerte für alle Konfigurationsoptionen
  - Dokumentiert in der Implementierung

### Behoben

#### SCC - Speicherplatz-Anzeige
- **Konsistente Datenbankgrößenberechnung**: Korrektur der Inkonsistenz zwischen Storage-Usage-Dashboard und Datenbank-Interface
  - Storage-Usage-Dashboard verwendet jetzt `pg_database_size()` für die Gesamtgröße (wie im Datenbank-Interface)
  - Vorher: Summe der Tabellengrößen im `public` Schema (856 KB) - unvollständig
  - Jetzt: Komplette Datenbankgröße inkl. System-Tabellen, Metadaten, WAL-Dateien, etc. (8725 kB) - korrekt
  - Tabellen-Aufschlüsselung (Tabellengröße, Index-Größe) bleibt für detaillierte Analyse erhalten
  - Beide Anzeigen zeigen jetzt konsistente Werte
  - Implementiert in `apps/scc/src/companies/companies.service.ts`

#### E-Mail-Management
- **Automatische Markierung als gelesen**: Timer von 5 auf 3 Sekunden reduziert
  - E-Mails werden jetzt nach 3 Sekunden automatisch als gelesen markiert
  - Implementiert in `apps/mailclient/src/app/emails/page.tsx`
- **Mailliste-Aktualisierung**: Tabellenansicht wird nach Markierung als gelesen korrekt aktualisiert
  - `loadEmails()` kann jetzt ohne Loading-State aufgerufen werden
  - Verhindert, dass die Tabellenansicht während der Aktualisierung verborgen wird
  - Sofortige UI-Aktualisierung mit nachfolgendem Server-Refresh
  - Implementiert in `apps/mailclient/src/app/emails/page.tsx`

#### Benutzerverwaltung
- **Abteilungszuweisung beim Bearbeiten**: Gespeicherte Abteilungen werden jetzt korrekt im Formular markiert
  - `handleEditUser` übernimmt jetzt auch `user.departments` in `userFormData`
  - Checkboxen werden beim Bearbeiten eines Benutzers korrekt vorausgewählt
  - Implementiert in `apps/mailclient/src/app/emails/settings/page.tsx`
- **Abteilungszuweisung Speicherung**: Korrektur der UUID-Verarbeitung für `company_id`
  - Verwendung von `resolvedCompanyId` (UUID) statt `companySlug` (String) für Datenbankabfragen
  - Verbesserte Fehlerbehandlung bei fehlender CompanyId-Auflösung
  - Debug-Logging für bessere Nachverfolgbarkeit
  - Implementiert in `apps/mailclient/src/app/api/users/route.ts` und `apps/mailclient/src/app/api/users/[id]/route.ts`

### Geändert

#### UI & Layout
- **Kartenlayout entfernt**: Vollständige Entfernung des Kartenlayouts
  - Nur noch Tabellenansicht verfügbar
  - `EmailItem` Komponente entfernt (nur für Kartenlayout verwendet)
  - `layout` Parameter aus `EmailList` Komponente entfernt
  - `emailListLayout` State und Einstellungen entfernt
  - API-Route angepasst: `emailListLayout` aus allen Queries entfernt
  - `GeneralSettings` Komponente: Layout-Option entfernt
  - Implementiert in:
    - `apps/mailclient/src/components/EmailList.tsx`
    - `apps/mailclient/src/app/emails/page.tsx`
    - `apps/mailclient/src/app/emails/settings/page.tsx`
    - `apps/mailclient/src/components/GeneralSettings.tsx`
    - `apps/mailclient/src/app/api/settings/route.ts`

#### E-Mail-Timeline
- **"Aktive Regeln" Anzeige entfernt**: "Aktive Regeln:" wird nicht mehr bei jedem Timeline-Event angezeigt
  - Reduziert visuelle Überladung in der Timeline
  - Implementiert in `apps/mailclient/src/components/EmailTimeline.tsx`
- **Genaue Zeitangabe mit Millisekunden**: Timeline zeigt jetzt genaue Uhrzeit mit Sekunden und Millisekunden
  - Format: `HH:MM:SS.mmm` (z.B. "14:23:45.123")
  - "vor X Std." Anzeige entfernt
  - Relative Zeitangaben nur noch für sehr kurze Zeiträume (< 1 Stunde)
  - Implementiert in `apps/mailclient/src/components/EmailTimeline.tsx`

### Behoben

#### Workflow-Automatisierung
- **Workflow-Ausführung in korrekter Reihenfolge**: Workflows werden jetzt von oben nach unten abgearbeitet
  - Edges werden nach Y-Position der Zielknoten sortiert (von oben nach unten)
  - Bei gleicher Y-Position: Sortierung nach X-Position (von links nach rechts)
  - Visuelle Anordnung im Editor entspricht der Ausführungsreihenfolge
  - Implementiert in `apps/mailclient/src/lib/automation-engine.ts` (processNode Funktion)
- **Robuste Fehlerbehandlung in Workflows**: Umfassende Fehlerbehandlung für zuverlässige Workflow-Ausführung
  - `evaluateCondition`: Try-catch um gesamte Funktion, null/undefined-Prüfungen, String-Konvertierung für alle Werte, fail-safe bei Fehlern (Bedingung als erfüllt)
  - `processNode`: Try-catch um rekursive Aufrufe, Fehler bei Bedingungen stoppen nicht den Workflow, visitedNodes Set verhindert Endlosschleifen
  - `executeAction`: Validierung aller Eingabeparameter (emailData, userId, companyId), Fehler werden protokolliert aber stoppen nicht den Workflow
  - `logRuleExecution`: Validierung der Eingabeparameter, try-catch um DB-Operationen, Client-Freigabe im finally-Block, DB-Fehler stoppen nicht die Ausführung
  - Alle `logEmailEventWithClient`-Aufrufe mit try-catch abgesichert, Logging-Fehler stoppen nicht die Aktion
  - Fehler in einzelnen Komponenten stoppen nicht den gesamten Workflow, alle Fehler werden protokolliert
  - Implementiert in `apps/mailclient/src/lib/automation-engine.ts`
- **Trigger-Punkt Validierung**: Verbesserte Validierung an allen Trigger-Punkten
  - Incoming (email-fetcher.ts): Prüfung auf vollständige Daten (companyId, emailId, userId), try-catch um dynamische Imports
  - Outgoing (emails/route.ts): Prüfung auf email.id und userId, Validierung von resolvedCompanyId
  - Email Updated (emails/[id]/route.ts): Prüfung auf vollständige E-Mail-Daten, Validierung vor executeRulesForEmail
  - Alle Trigger-Punkte haben try-catch um Import- und Ausführungsfehler
  - Verbesserte Fehlermeldungen mit detailliertem Logging
- **Workflow-Editor Start-Knoten**: Automatisches Hinzufügen von Start-Knoten
  - Start-Knoten wird automatisch hinzugefügt, wenn Workflow leer ist oder kein Start-Knoten vorhanden ist
  - Migration von alten Trigger-Knoten zu Start-Knoten beim Laden (initialNodes useMemo)
  - useEffect stellt sicher, dass immer ein Start-Knoten vorhanden ist (reagiert auf nodes.length Änderungen)
  - Sidebar zeigt nur noch "Start" statt spezifischer Trigger-Knoten (E-Mail-Eingang, E-Mail-Ausgang, etc.)
  - MiniMap korrigiert: verwendet `startNode` statt `triggerNode` für korrekte Farbzuordnung
  - Implementiert in `apps/mailclient/src/components/AutomationWorkflowEditor.tsx`
- **Workflow-Speicherung**: Korrekte Typkonvertierung beim Speichern
  - Start-Knoten werden als `workflowStartNode` gespeichert (nicht als `startNode`)
  - Condition-Knoten behalten ihren Typ (emailCondition)
  - Action-Knoten verwenden korrekten Typ aus data.type oder actionType
  - triggerType wird aus nodeData entfernt (nicht mehr benötigt)
  - Implementiert in `apps/mailclient/src/components/AutomationWorkflowEditor.tsx` (handleSave Funktion)

### Hinzugefügt

#### Workflow-Automatisierung
- **Generischer Start-Knoten**: Vereinfachte Workflow-Struktur mit generischem Start-Block
  - Trigger-Typ wird nur noch auf Regel-Ebene definiert, nicht mehr im Workflow
  - Einheitlicher "Start"-Knoten ersetzt spezifische Trigger-Knoten (E-Mail-Eingang, E-Mail-Ausgang, Manuell, Zeitgesteuert, E-Mail-Update)
  - Verbesserte Konsistenz zwischen Regel-Konfiguration und Workflow-Ausführung
  - Trigger-Typ wird in der Regel-Form ausgewählt, nicht mehr im Workflow-Editor
  - StartNode-Komponente mit FiPlay-Icon und blauem Design
  - Implementiert in `apps/mailclient/src/components/AutomationWorkflowEditor.tsx`
- **Automatische Workflow-Migration**: Alte Workflows werden automatisch migriert
  - Alte Trigger-Knoten werden beim Laden automatisch zu Start-Knoten konvertiert (initialNodes useMemo)
  - Erkennung von Knoten mit `includes('Trigger')` oder `includes('trigger')` oder `workflowStartNode`
  - triggerType wird aus nodeData entfernt (nicht mehr benötigt)
  - Rückwärtskompatibilität für bestehende Workflows gewährleistet
  - Templates aktualisiert: Alle Templates verwenden jetzt `workflowStartNode`
  - Implementiert in `apps/mailclient/src/components/AutomationWorkflowEditor.tsx` und `apps/mailclient/src/app/api/automation-rules/templates/route.ts`

#### Login & Authentifizierung
- **Verbesserte Fehlerbehandlung**: Spezifische Fehlermeldungen für Datenbankverbindungsfehler im Login-Endpunkt
  - Klare Meldung bei falscher SCC_DATABASE_URL Konfiguration (postgres vs. saivaro Benutzer)
  - Bessere Fehlermeldungen bei fehlender SCC_DATABASE_URL
  - Spezifische Meldungen bei Datenbankverbindungsproblemen (ECONNREFUSED, etc.)
  - Verbesserte Fehlerbehandlung in `apps/mailclient/src/app/api/auth/login/route.ts`
- **Datenbankverbindungs-Konfiguration**: Korrektur der Standard-Datenbankverbindungsstrings
  - SCC_DATABASE_URL verwendet jetzt korrekt `saivaro:saivaro_dev_password` statt `postgres:postgres`
  - Entspricht der Docker-Container-Konfiguration in `docker-compose.yml`

#### Settings API
- **Variablenkonflikte behoben**: TDZ-Fehler (Temporal Dead Zone) in `apps/mailclient/src/app/api/settings/route.ts`
  - `tableColumns` und `searchFields` wurden beim Destructuring aus dem Request-Body verwendet, aber später mit `let` neu deklariert
  - Umbenennung zu `loadedTableColumns` und `loadedSearchFields` für klare Trennung
  - Verbesserte Fallback-Logik für fehlende Werte in der Datenbank

#### SCC Cron-Job-Logging
- **Robuste Upsert-Logik**: Verbesserte Fehlerbehandlung in `apps/scc/src/cron-jobs/cron-jobs.service.ts`
  - Fallback auf `findFirst` bei Constraint-Name-Problemen
  - Verbesserte Race-Condition-Behandlung
  - Validierung von `startedAt` Datum
  - Sicherheitsprüfung: `logId` muss zur `companyId` gehören

#### Cron-Service
- **Service-Token-Authentifizierung**: Verbesserte Token-Verwaltung
  - Token wird erst beim ersten Zugriff gelesen, nicht beim Import
  - Dynamischer Import von `scheduled-trigger-service.ts` nach dem Laden der .env-Datei
  - Verbesserte .env-Datei-Erkennung mit mehreren Pfad-Optionen
  - Entfernung von Anführungszeichen aus Token-Werten

#### Datenbank-Schema
- **Tabellenerstellungs-Reihenfolge**: Korrektur in `apps/mailclient/src/lib/tenant-db-client.ts`
  - `email_accounts` wird jetzt VOR `emails` erstellt (Foreign Key Constraint)
  - Verhindert "relation email_accounts does not exist" Fehler
  - Verbesserte Client-Release-Logik zur Vermeidung von doppelten Releases
- **Erweiterte email_accounts-Tabelle**: Neue Felder für erweiterte Konfiguration
  - `imap_tls` (BOOLEAN) - STARTTLS-Unterstützung für IMAP
  - `imap_folder` (VARCHAR(255)) - Konfigurierbarer IMAP-Ordner (Standard: 'INBOX')
  - Automatische Schema-Migration für bestehende Datenbanken
- **Erweiterte emails-Tabelle**: Neue Felder für E-Mail-Management
  - `message_uid` (INTEGER) - IMAP-UID für Duplikatsprüfung
  - `account_id` (UUID) - Foreign Key zu `email_accounts`
  - `read_at` (TIMESTAMP) - Zeitpunkt des Lesens
  - Index auf `(account_id, message_uid)` für Performance
- **user_settings-Tabelle**: Neue Tabelle für Benutzer-Einstellungen
  - `user_id` (UUID, Primary Key, Foreign Key zu users)
  - `fetch_interval_minutes` (INTEGER) - Abruf-Intervall in Minuten
  - `created_at`, `updated_at` (TIMESTAMP)
  - Automatische Schema-Migration beim Pool-Erstellen

#### API & Backend
- **Tenant-Context-Extraktion**: Verbesserte Tenant-Erkennung in API-Routes
  - Extraktion aus Subdomain, Headers (`X-Company-Id`, `X-Company-Slug`) und JWT-Token
  - Robuste Fallback-Logik für verschiedene Tenant-Identifikationsmethoden
  - Behebt "Tenant-Context nicht gesetzt" Fehler in `/api/emails` Route
  - Implementiert in `apps/mailclient/src/app/api/emails/route.ts`
- **SCC Backend Public Decorator**: Neue `@Public()` Decorator für öffentliche Endpoints
  - Erstellt `apps/scc/src/auth/decorators/public.decorator.ts`
  - `JwtAuthGuard` prüft jetzt auf `@Public()` Decorator und überspringt Auth
  - Behebt `InvalidDecoratorItemException` für `@UseGuards([])` in `CompaniesController`
  - Angewendet auf `GET /api/companies/:id/db-config/with-password` Endpoint
- **Code-Quality**: Behebung von Build-Fehlern
  - Entfernung doppelter Variablendeklarationen (`payload` in `/api/emails/route.ts`)
  - Korrektur der Funktionsreihenfolge in `apps/mailclient/src/app/emails/settings/page.tsx`
  - Behebt `ModuleBuildError` mit "Unexpected token div" Fehler
  - Funktionen werden jetzt vor `useEffect` definiert

#### E-Mail-Filter
- **Themen-Laden behoben**: Themen werden jetzt korrekt beim Bearbeiten von Filtern geladen
  - `useEffect` Hook hinzugefügt, der beim Mount der `EmailFilters`-Komponente die Themen lädt
  - Behebt Problem, dass "Keine Themen vorhanden" angezeigt wurde, obwohl Themen existierten
  - Verbesserte Fehlerbehandlung mit Console-Logging für Debugging
  - Token-Validierung vor API-Aufruf

### Hinzugefügt

#### E-Mail-Management Features
- **E-Mail-Detailansicht**: Vollständige Detailansicht für einzelne E-Mails
  - Route: `/emails/[id]` - Detailseite für E-Mail
  - API: `GET /api/emails/[id]` - E-Mail-Details abrufen
  - Anzeige von Betreff, Absender, Empfänger, Datum und Inhalt
  - Responsive Design mit modernem Layout
- **E-Mails als gelesen markieren**: Funktionalität zum Markieren von E-Mails als gelesen
  - API: `PATCH /api/emails/[id]` - E-Mail als gelesen markieren
  - Frontend-Button zum Markieren als gelesen
  - Automatische Aktualisierung der E-Mail-Liste nach Markierung
  - `read_at` Timestamp in Datenbank
- **E-Mails senden**: Vollständige E-Mail-Versand-Funktionalität
  - Route: `/emails/compose` - E-Mail-Verfassen-Seite
  - API: `POST /api/emails` - E-Mail senden
  - Unterstützung für mehrere Empfänger (kommagetrennt)
  - Validierung von Empfänger, Betreff und Inhalt
  - Speicherung gesendeter E-Mails in Datenbank
- **E-Mail-Suche und Filter**: Erweiterte Such- und Filterfunktionen
  - Suchfeld für Volltext-Suche in Betreff, Absender und Inhalt
  - Filter-Optionen: "Alle", "Gelesen", "Ungelesen"
  - API: `GET /api/emails?search=...&filter=...` - Suche und Filter
  - ILIKE-basierte Suche für case-insensitive Ergebnisse
  - Limitierung auf 50 Ergebnisse pro Abfrage
- **E-Mail-Abteilungszuweisung**: E-Mails können direkt Abteilungen zugewiesen werden
  - Button "🏢 Abteilung" in der E-Mail-Aktionsleiste
  - Modal zur Auswahl mehrerer Abteilungen pro E-Mail
  - Junction-Tabelle `email_departments` für Abteilungszuweisungen
  - API-Route: `PATCH /api/emails/[id]/departments` - Abteilungen zuweisen/entfernen
  - API-Route: `GET /api/emails/[id]/departments` - Zugewiesene Abteilungen abrufen
  - Automatische Schema-Migration beim ersten Zugriff
  - Implementiert in `apps/mailclient/src/components/EmailList.tsx` und `apps/mailclient/src/app/api/emails/[id]/departments/route.ts`
- **Abteilungs-Spalte in E-Mail-Liste**: Neue Spalte zur Anzeige zugewiesener Abteilungen
  - "Abteilung" Spalte in der Tabellenansicht
  - Anzeige zugewiesener Abteilungen als Badges mit Icon
  - Spalte kann in Spaltenverwaltung ein-/ausgeblendet werden
  - Automatische Migration: Spalte wird automatisch hinzugefügt, falls fehlend
  - Implementiert in `apps/mailclient/src/components/EmailTableItem.tsx` und `apps/mailclient/src/app/emails/page.tsx`
- **Abteilungsinformationen in E-Mails**: E-Mails enthalten Abteilungsinformationen
  - `fromDepartments`: Abteilungen des Absenders (basierend auf E-Mail-Adresse)
  - `toDepartments`: Abteilungen der Empfänger (basierend auf E-Mail-Adressen)
  - `assignedDepartments`: Direkt zugewiesene Abteilungen (aus `email_departments` Tabelle)
  - API: `GET /api/emails` - Lädt alle Abteilungsinformationen
  - Implementiert in `apps/mailclient/src/app/api/emails/route.ts`

#### UI-Modernisierung
- **Modernes Design**: Komplett überarbeitete Benutzeroberfläche
  - Card-basierte E-Mail-Darstellung statt Tabellen
  - Moderne Sidebar mit Navigation
  - Header-Komponente mit Benutzerinformationen
  - Icons und visuelle Verbesserungen
  - Responsive Design für mobile Geräte
  - Verbesserte UX mit klaren visuellen Hierarchien
- **E-Mail-Liste als Cards**: Neue Darstellungsform für E-Mails
  - Card-basierte Layouts mit Hover-Effekten
  - Klare visuelle Trennung zwischen E-Mails
  - Kompakte Darstellung mit wichtigen Informationen
  - Klickbare Cards für Navigation zur Detailansicht

#### E-Mail-Konto-Verwaltung
- **Einstellungen-Bereich**: Vollständiger Einstellungsbereich für E-Mail-Konten
  - Route: `/emails/settings` - Einstellungsseite
  - Untermenü mit zwei Tabs: "E-Mail Konten" und "Allgemein"
  - Tab "E-Mail Konten": Verwaltung von IMAP/SMTP-Konten
  - Tab "Allgemein": Globale Einstellungen (Abruf-Intervall)
- **IMAP/SMTP-Konto-Verwaltung**: Vollständige CRUD-Funktionalität
  - Erstellen, Bearbeiten und Löschen von E-Mail-Konten
  - Formular für IMAP- und SMTP-Konfiguration
  - Speicherung von Host, Port, Benutzername, Passwort
  - Aktiv/Inaktiv-Status für Konten
  - Nur aktive Konten werden für E-Mail-Abruf verwendet
- **Verbindungstest**: Pre-Save-Verbindungstest für IMAP/SMTP
  - API: `POST /api/email-accounts/test-connection` - Verbindung testen
  - Test-Button im Einstellungsformular
  - Anzeige von Erfolg/Fehler-Status
  - Anzeige der Anzahl verfügbarer E-Mails im IMAP-Ordner
  - Validierung vor dem Speichern
- **STARTTLS/SSL-Auswahl**: Flexible Verschlüsselungsoptionen
  - Radio-Buttons für IMAP: SSL (Port 993) oder STARTTLS (Port 143)
  - Radio-Buttons für SMTP: SSL (Port 465) oder STARTTLS (Port 587)
  - Automatische Port-Anpassung bei Auswahl
  - Speicherung in `imap_ssl`, `imap_tls`, `smtp_ssl`, `smtp_tls` Feldern
- **Passwort-Anzeige beim Bearbeiten**: Passwörter werden aus Datenbank geladen
  - API: `GET /api/email-accounts/:id` - Gibt Passwörter zurück
  - Passwort-Felder werden beim Bearbeiten vorausgefüllt
  - Keine erneute Eingabe erforderlich
  - Sichere Speicherung in Datenbank
- **IMAP-Ordner-Konfiguration**: Konfigurierbarer IMAP-Ordner
  - Eingabefeld für IMAP-Ordner (Standard: "INBOX")
  - Unterstützung für Unterordner (z.B. "INBOX/Archiv")
  - Speicherung in `imap_folder` Feld
  - Verwendung beim E-Mail-Abruf und Verbindungstest

#### E-Mail-Abruf Verbesserungen
- **UID-basierte Duplikatsprüfung**: Intelligente Duplikatserkennung
  - Verwendung von IMAP-UIDs für eindeutige Identifikation
  - `message_uid` Feld in `emails` Tabelle
  - Prüfung gegen bereits abgerufene UIDs vor Speicherung
  - Verhindert doppelte E-Mail-Speicherung
  - Index auf `(account_id, message_uid)` für Performance
- **E-Mail-Kopien speichern**: Originale bleiben auf Server
  - E-Mails werden als Kopien in Datenbank gespeichert
  - Originale verbleiben auf IMAP-Server
  - `markSeen: false` - E-Mails werden nicht als gelesen markiert
  - UID-Liste für Duplikatsprüfung
- **E-Mail-Abruf von aktiven Konten**: Automatischer Abruf
  - API: `POST /api/emails/fetch` - Manueller E-Mail-Abruf
  - Lädt nur E-Mails von aktiven Konten (`is_active = true`)
  - Verwendung des konfigurierten IMAP-Ordners
  - "Jetzt abrufen" Button in E-Mail-Übersicht
  - Anzeige von Abruf-Status und Anzahl abgerufener E-Mails
- **Abruf-Intervall-Einstellung**: Konfigurierbares Abruf-Intervall
  - Tab "Allgemein" in Einstellungen
  - Eingabefeld für Abruf-Intervall in Minuten (1-1440)
  - Speicherung in `user_settings.fetch_interval_minutes`
  - API: `GET /api/settings` - Einstellungen abrufen
  - API: `PATCH /api/settings` - Einstellungen speichern
  - Standard-Wert: 5 Minuten

#### E-Mail-Themen-Verwaltung
- **Themen-Verwaltung**: Vollständige CRUD-Funktionalität für E-Mail-Themen
  - `GET /api/themes` - Alle Themen des Benutzers laden
  - `POST /api/themes` - Neues Thema erstellen
  - `PATCH /api/themes/:id` - Thema bearbeiten
  - `DELETE /api/themes/:id` - Thema löschen
  - Themen-Verwaltung in Einstellungen (`/emails/settings`) unter neuem Tab "🏷️ Themen"
  - Popup-Modal für Bearbeitung und Erstellung von Themen
  - Farbauswahl für Themen (Color-Picker und Hex-Eingabe)
  - Validierung von Themen-Namen und Farben
- **Standard-Themen**: Automatische Erstellung von 10 Standard-Themen beim ersten Öffnen
  - Arbeit (Blau), Privat (Grün), Wichtig (Gelb), Projekte (Cyan)
  - Rechnungen (Rot), Bestellungen (Lila), Support (Orange)
  - Marketing (Pink), Vertrieb (Türkis), Personal (Grau)
- **Datenbank-Schema**: Neue Tabelle `email_themes`
  - `id` (UUID, Primary Key)
  - `user_id` (UUID, Foreign Key zu users)
  - `name` (VARCHAR(255), NOT NULL)
  - `color` (VARCHAR(7), optional, Hex-Format)
  - `created_at`, `updated_at` (TIMESTAMP)
  - Automatische Schema-Migration in `tenant-db-client.ts`

#### E-Mail-Filter Erweiterungen
- **Themen-Filter**: Filter um Themen-Feld erweitert
  - Themen als Filterfeld in Filter-Regeln verfügbar
  - Mehrfachauswahl von Themen (Checkboxen)
  - Farbvorschau neben jedem Themenamen
  - Automatisches Laden von Themen beim Öffnen der Filter-Komponente
  - Validierung: Mindestens ein Thema muss ausgewählt werden
  - Filter-Logik erweitert: E-Mails können nach zugewiesenen Themen gefiltert werden
  - `useEffect` Hook zum Laden der Themen beim Mount der Filter-Komponente
  - Verbesserte Fehlerbehandlung beim Laden der Themen

#### Tabellenansicht Erweiterungen
- **Thema-Spalte**: Neue Spalte "Thema" in der Tabellenansicht
  - Standard-Spalte in Spaltenverwaltung hinzugefügt
  - Anzeige von Themenname mit Farbvorschau
  - Standard-Breite: 120px
  - Spalte kann ein-/ausgeschaltet, verschoben und in der Breite angepasst werden
  - 🏷️-Symbol im Tabellenkopf (grau, wie bei anderen Symbol-Spalten)
  - Rendering-Logik in `EmailTableItem.tsx` implementiert
  - Email-Interface erweitert um `themeId` und `theme` Felder
- **Theme-Anzeige in API**: Erweiterte E-Mail-API um Theme-Daten
  - `GET /api/emails` - Join mit `email_themes` Tabelle für Theme-Informationen
  - Rückgabe von `theme_id`, `theme_name`, `theme_color` in API-Response
  - Korrekte Anzeige von zugewiesenen Themes in Tabellenansicht

#### Automatisierungs-Engine
- **Workflow-Editor**: Visueller Workflow-Editor mit React Flow (n8n-ähnlich)
  - Drag & Drop-Interface für Workflow-Erstellung
  - Verschiedene Node-Typen: Start, Condition, Action, Department
  - Canvas-Features: Zoom, Pan, Minimap, Grid, Controls
  - Workflow-Validierung: Cycle-Detection, Node/Connection-Validierung
  - Auto-Save, Undo/Redo-Funktionalität
  - Integration in Einstellungen (`/emails/settings`) unter Tab "⚙️ Automatisierung"
  - Themen-Auswahl im "Set Theme"-Action-Node (Dropdown statt Text-Eingabe)
  - Automatisches Laden verfügbarer Themes beim Öffnen des Editors
  - **Vollbild-Modus**: Workflow-Editor nutzt den gesamten Bildschirm
  - **Abteilungs-Knoten**: Abteilungen können als Knoten im Workflow hinzugefügt werden
    - Department-Node mit Icon (FiBriefcase) und Farbe (#17a2b8)
    - Konfigurations-Panel zur Auswahl mehrerer Abteilungen
    - Abteilungen werden aus Workflow-Knoten extrahiert beim Speichern
    - Automatische Migration: Bestehende Abteilungszuweisungen werden als Knoten erstellt
- **Automation Workflows**: Vollständige CRUD-Funktionalität für Automatisierungs-Workflows
  - `GET /api/automation-rules` - Alle Workflows laden
  - `POST /api/automation-rules` - Neuen Workflow erstellen
  - `GET /api/automation-rules/:id` - Workflow-Details
  - `PATCH /api/automation-rules/:id` - Workflow aktualisieren/aktivieren/deaktivieren
  - `DELETE /api/automation-rules/:id` - Workflow löschen
  - `POST /api/automation-rules/:id/duplicate` - Workflow duplizieren
  - `POST /api/automation-rules/:id/execute` - Workflow manuell ausführen
  - `GET /api/automation-rules/templates` - Workflow-Templates abrufen
  - `POST /api/automation-rules/export` - Workflows exportieren (JSON)
  - `POST /api/automation-rules/import` - Workflows importieren (JSON)
  - **Abteilungszuweisung für Workflows**: Workflows können Abteilungen zugewiesen werden
    - Junction-Tabelle `automation_rule_departments` für Abteilungszuweisungen
    - Workflows mit Abteilungen sind nur für Benutzer mit entsprechenden Abteilungen sichtbar
    - Abteilungen werden als Knoten im Workflow-Editor verwaltet
- **Trigger-Typen**: Unterstützung für verschiedene Trigger
  - `incoming` - Bei eingehender E-Mail
  - `outgoing` - Bei ausgehender E-Mail
  - `manual` - Manuelle Ausführung
  - `scheduled` - Zeitgesteuerte Ausführung (Cron)
  - `email_updated` - Bei E-Mail-Update
- **Aktionen**: Verschiedene Automatisierungs-Aktionen
  - Set Theme - Thema zuweisen
  - Set Urgency - Dringlichkeit setzen
  - Mark Important - Als wichtig markieren
  - Mark Spam - Als Spam markieren
  - Forward Email - E-Mail weiterleiten (mit Variablen-Ersetzung)
- **E-Mail-Variablen**: Platzhalter-Ersetzung in Aktionen
  - `{{subject}}`, `{{from}}`, `{{to}}`, `{{body}}`, `{{date}}`, etc.
  - Unterstützung in Forward-Email-Aktion
- **Datenbank-Schema**: Neue Tabellen für Automatisierung
  - `automation_rules` - Automatisierungsregeln
  - `automation_execution_logs` - Ausführungs-Logs
  - `email_events` - E-Mail-Ereignisse (für Timeline)
  - `automation_rule_status_history` - Regel-Status-Verlauf
  - `theme_id` und `urgency` Spalten in `emails` Tabelle

#### E-Mail-Timeline
- **Chronologische Ereignis-Anzeige**: Vollständige Historie aller E-Mail-Ereignisse
  - Anzeige neben E-Mail-Vorschau (unterhalb der Tabelle)
  - Chronologische Darstellung mit Timestamps
  - Anzeige aktiver Regeln zum Zeitpunkt jedes Ereignisses
  - Kompaktes Design mit relativen Zeitangaben ("vor X Min./Std.", "gestern")
  - Sortierung: Neueste Ereignisse oben
- **Resizable Layout**: Drag & Drop zum Ändern der Spaltengröße
  - Horizontale Aufteilung zwischen E-Mail-Vorschau und Timeline
  - 4px breiter Resize-Handle
  - Einklappbare Timeline mit vertikalem "Timeline"-Text
  - Zwei Pfeile (◀ oben, ▶ unten) zur visuellen Anzeige
  - Pfeil-Richtung ändert sich je nach Kollabierungs-Status
  - Timeline-Breite: 20px wenn eingeklappt (halb so breit wie vorher)
  - Vollständiges Ausblenden der Timeline möglich

#### Context Menu für E-Mails
- **Rechtsklick-Menü**: Kontextmenü für E-Mail-Liste
  - Verfügbar in Karten- und Tabellenansicht
  - Anzeige aller aktiven Regeln mit Trigger "manual"
  - Einzelne Ausführung von Regeln per Klick
  - Automatisches Refresh der E-Mail-Liste nach Ausführung
  - API-Endpunkt: `POST /api/automation-rules/:id/execute`

#### Scheduled Triggers & Cron-Service
- **Node.js Cron-Service**: Separater Service für geplante Aufgaben
  - `apps/mailclient/scripts/start-cron-service.ts` - Start-Script
  - `apps/mailclient/src/lib/scheduled-trigger-service.ts` - Core-Service
  - Multi-Tenant-Handling: Lädt alle Companies und erstellt Jobs pro Company
  - Job-Management: Erstellen, Aktualisieren, Löschen von Cron-Jobs
  - Refresh-Mechanismus: Automatisches Neuladen alle 5 Minuten
  - Graceful Shutdown: Korrektes Beenden aller Jobs bei SIGTERM/SIGINT
  - Health-Check: Prüft Mailclient-API-Erreichbarkeit vor Start
  - Strukturiertes Logging mit Timestamps und Log-Levels
- **E-Mail-Abruf-Automatisierung**: Automatischer E-Mail-Abruf basierend auf `fetch_interval_minutes`
  - Lädt alle User mit `fetch_interval_minutes >= 1` aus `user_settings`
  - Erstellt Cron-Jobs für jeden User mit entsprechendem Intervall
  - Cron-Ausdrücke: `*/X * * * *` für Minuten < 60, `0 */X * * *` für Stunden
  - Integration in bestehenden Cron-Service
  - Debug-Logging für Job-Erstellung und -Ausführung
- **Scheduled Automation Rules**: Zeitgesteuerte Ausführung von Automatisierungsregeln
  - Lädt alle aktiven Regeln mit `trigger_type = 'scheduled'`
  - Cron-Ausdruck aus `trigger_config.cronExpression`
  - Filtert E-Mails nach Workflow-Bedingungen
  - Führt Regel für gefilterte E-Mails aus
  - Rate Limiting: Max. 100 E-Mails pro Regel-Ausführung (konfigurierbar über `CRON_MAX_EMAILS_PER_RULE`)
- **API-Endpunkte**:
  - `POST /api/automation-rules/scheduled/execute` - Ausführung einer Scheduled Rule
  - `POST /api/emails/fetch` - E-Mail-Abruf (erweitert um Service-Token-Support)
- **Integration in Start-Scripts**:
  - `start-all.ps1` - Startet Cron-Service in separatem PowerShell-Fenster
  - `stop-all.ps1` - Beendet Cron-Service zusammen mit anderen Services
  - Prozess-ID-Speicherung in `.service-pids.txt`

#### SCC Cron-Job-Logging
- **Cron-Job-Logs Tabelle**: Neue Tabelle in SCC-Datenbank
  - `CronJobLog` Prisma-Model mit `CronJobType` und `CronJobStatus` Enums
  - Felder: `companyId`, `jobType`, `jobKey`, `status`, `startedAt`, `completedAt`, `executionTimeMs`, `processedItems`, `errorMessage`, `metadata`
  - Unique Constraint: `[companyId, jobKey, startedAt]` für atomare Upsert-Operationen
  - Indizes für optimierte Abfragen: `[companyId, createdAt]`, `[companyId, jobType, status]`, `[companyId, startedAt]`, `[jobKey]`
  - Migration: `20260103180719_add_cron_job_logs` - 2026-01-03
- **API-Endpunkte**:
  - `POST /api/cron-jobs/log` - Einzelnes Log-Eintrag erstellen/aktualisieren (öffentlich, Service-Token)
  - `POST /api/cron-jobs/logs/batch` - Batch-Logging (öffentlich, Service-Token)
  - `GET /api/companies/:id/cron-jobs/logs` - Logs für Company abrufen (authentifiziert)
  - `GET /api/companies/ready` - Alle bereiten Companies abrufen (öffentlich, für Cron-Service)
- **Frontend-Integration**: Cron-Job-Logs in SCC-Frontend
  - Anzeige in Company-Detail-Seite (`/companies/[id]`)
  - Tabelle mit Pagination (50 Einträge pro Seite)
  - Filterung nach Job-Typ und Status
  - Anzeige von Ausführungszeit, verarbeiteten Items und Fehlermeldungen
  - Farbcodierte Status-Badges (Erfolg, Fehler, Läuft)
  - Job-Typ-Badges (Scheduled Trigger, E-Mail-Abruf)
  - Refresh-Button zum manuellen Aktualisieren
  - Anzeige der Gesamtanzahl der Log-Einträge
- **Cron-Job-Logger**: Utility für Logging von Cron-Jobs
  - `apps/mailclient/src/lib/cron-job-logger.ts` - Logging-Funktion
  - Retry-Mechanismus für API-Aufrufe (max. 2 Versuche)
  - Fallback auf lokales Logging bei API-Fehlern
  - Integration in `scheduled-trigger-service.ts`
  - Logging von Job-Start, -Erfolg und -Fehler

#### Service-Token-Authentifizierung
- **CRON_SERVICE_TOKEN**: Sichere interne Authentifizierung für Cron-Service
  - Service-Token-Konfiguration über Umgebungsvariable `CRON_SERVICE_TOKEN` in `.env`-Datei
  - Token-Validierung in `apps/mailclient/src/lib/auth.ts` (`verifyServiceToken`)
  - Verwendung bei Cron-Job-Aufrufen für E-Mail-Abruf und Automation-Rules
  - Header-basierte Authentifizierung mit `x-service-token` Header
  - Automatisches Laden der `.env`-Datei im `start-cron-service.ts` Script mit `dotenv`
  - Mehrere Pfad-Optionen für robuste .env-Erkennung
  - Warnungen bei fehlendem Token (Development-Modus: Validierung optional)
  - Production-Modus: Token-Validierung zwingend erforderlich
  - Token-Erstellung: Empfohlen mit `openssl rand -hex 32` oder ähnlichen sicheren Methoden
  - Verbesserte Logging: Zeigt Token-Länge und erste Zeichen (ohne vollständigen Token zu loggen)

#### Workflow-Editor Verbesserungen
- **Verbindungen trennen**: Vollständige Funktionalität zum Entfernen von Verbindungen zwischen Bausteinen
  - Benutzerdefinierter Edge-Typ mit visuellem Lösch-Button (×) in der Mitte der Verbindung
  - Lösch-Button erscheint beim Hovern über eine Verbindung oder bei Auswahl
  - Mehrere Löschmöglichkeiten:
    - Hover + Klick auf den roten ×-Button in der Verbindungsmitte
    - Entf-Taste nach Auswahl einer Verbindung
    - "Verbindung trennen"-Button im Konfigurations-Panel
  - Visuelles Feedback: Ausgewählte Verbindungen werden blau und dicker dargestellt
  - Konfigurations-Panel für ausgewählte Verbindungen mit Details (Von/Zu)
  - Alle Edges sind standardmäßig löschbar konfiguriert
  - Implementiert in `apps/mailclient/src/components/AutomationWorkflowEditor.tsx`

### Geplant
- Terraform-Integration für echte Hetzner-Provisionierung
- Umfassende Integration- und E2E-Tests
- Erweiterte Health-Checks für Tenant-DBs
- Monitoring und Logging-Integration
- Themen-Zuweisung zu E-Mails (UI und API)

---

## [1.0.0] - 2024-12-10

### Hinzugefügt

#### Monorepo & Basis-Struktur
- **Turborepo-Setup** mit pnpm Workspaces
- **TypeScript-Konfiguration** mit Basis-Config (`tsconfig.base.json`)
- **Code-Quality-Tools**: ESLint, Prettier, EditorConfig
- **Projektstruktur**: `apps/` und `packages/` Verzeichnisse
- **Dokumentation**: Umfassende Dokumentation im `docs/` Verzeichnis
  - `ARCHITECTURE_BEFORE.md`: Beschreibung der Ausgangslage
  - `DOMAIN_MODEL.md`: Domain-Modell mit Entitäten
  - `SETUP_MULTI_TENANT_DEV.md`: Setup-Anleitung
  - `PROVISIONING_FLOW.md`: DB-Provisionierungs-Flow
  - `IMPLEMENTATION_PLAN.md`: Implementierungsplan
  - `SETUP_DATABASE.md`: Datenbank-Setup-Anleitung
  - `PROJECT_SUMMARY.md`: Projekt-Zusammenfassung
  - `FINAL_SUMMARY.md`: Finale Zusammenfassung

#### SCC-Backend (NestJS)
- **Framework**: NestJS 10+ mit TypeScript
- **ORM**: Prisma 5+ mit PostgreSQL
- **Authentication**: JWT-basierte Authentifizierung mit Passport
  - `POST /api/auth/login` - SCC-User-Login
  - JWT-Strategy für Token-Verifizierung
  - Public Decorator für öffentliche Endpoints
  - JWT Auth Guard für geschützte Endpoints
- **Company Management**: Vollständige CRUD-API
  - `GET /api/companies` - Liste aller Companies
  - `POST /api/companies` - Neue Company anlegen
  - `GET /api/companies/:id` - Company-Details
  - `PATCH /api/companies/:id` - Company aktualisieren
  - `DELETE /api/companies/:id` - Company löschen
  - `GET /api/companies/:id/db-config` - DB-Config abrufen
  - `GET /api/companies/:id/db-config-with-password` - DB-Config mit Passwort (intern)
  - `GET /api/companies/:id/tenant-users` - Tenant-User-Liste abrufen
  - `POST /api/companies/:id/tenant-users` - Tenant-User erstellen
  - `PATCH /api/companies/:id/tenant-users/:userId` - Tenant-User aktualisieren
  - `DELETE /api/companies/:id/tenant-users/:userId` - Tenant-User löschen
- **Provisionierung**: Mock-Provisionierungs-API
  - `POST /api/companies/:id/provision-db` - DB provisionieren
  - `GET /api/admin/provisioning/status/:id` - Provisionierungs-Status abrufen
  - `DELETE /api/admin/companies/:id/deprovision-db` - DB deprovisionieren
  - Automatische Datenbank-Erstellung für lokale Entwicklung
  - Standard-Admin-User-Erstellung bei Provisionierung
- **Verschlüsselung**: AES-256-GCM für DB-Passwörter
  - `EncryptionService` mit PBKDF2 Key-Derivation
  - Sichere Speicherung von sensiblen Daten
- **Health-Checks**: API- und DB-Health-Monitoring
  - `GET /api/health` - Basis-Health-Check
  - `GET /api/health/db` - Datenbank-Health-Check
- **API-Dokumentation**: Swagger/OpenAPI unter `/api/docs`
- **Prisma-Schema**: Vollständiges Datenmodell
  - `Company` - Firmen-Entität
  - `CompanyDbConfig` - Datenbank-Konfiguration pro Firma
  - `SccUser` - SCC-Administratoren
  - `TenantUserPassword` - Tenant-User-Passwörter (für Test-Umgebung)
- **Database Migrations**: Prisma-Migrations
  - Initial Migration (`20251210155014_init`) - 2024-12-10
  - Tenant User Passwords Migration (`20251210172828_add_tenant_user_passwords`) - 2024-12-10
  - Username Migration (`20251210180000_add_username_to_tenant_user_passwords`) - 2024-12-10
- **Seed-Script**: Initiale Daten für Entwicklung

#### Mailclient-App (Next.js)
- **Framework**: Next.js 14+ mit App Router
- **Multi-Tenant-Routing**: Dynamische Tenant-Erkennung
  - Subdomain-Erkennung (`acme-corp.localhost:3000`)
  - Header-Erkennung (`X-Company-Id`, `X-Company-Slug`)
  - JWT-Token-Erkennung (`companyId` im Payload)
  - `middleware.ts` für Tenant-Context-Setzung
- **Dynamisches DB-Loading**: Laufzeit-DB-Konfiguration
  - `tenant-db-client.ts` - Connection-Pooling pro Company
  - `scc-client.ts` - SCC-API-Client
  - Caching mit node-cache (5 Min TTL)
  - Automatische Schema-Migration beim Pool-Erstellen
- **Authentication**: JWT-basierte Authentifizierung
  - `POST /api/auth/login` - Firmen-User-Login
  - `auth.ts` - JWT-Verifizierung
  - Token-Extraktion aus Authorization Header
- **E-Mail-Management**: E-Mail-API-Endpoints
  - `GET /api/emails` - E-Mails laden (aus Tenant-DB)
  - `GET /api/emails/:id` - E-Mail-Details
  - `POST /api/emails/fetch` - E-Mails von IMAP-Konten abrufen
- **E-Mail-Accounts**: IMAP-Konto-Verwaltung
  - `GET /api/email-accounts` - E-Mail-Konten auflisten
  - `POST /api/email-accounts` - E-Mail-Konto erstellen
  - `GET /api/email-accounts/:id` - E-Mail-Konto-Details
  - `PATCH /api/email-accounts/:id` - E-Mail-Konto aktualisieren
  - `DELETE /api/email-accounts/:id` - E-Mail-Konto löschen
  - `POST /api/email-accounts/:id/test-connection` - IMAP-Verbindung testen
- **E-Mail-Abruf**: IMAP-Integration
  - `email-fetcher.ts` - IMAP-E-Mail-Abruf-Service
  - Unterstützung für SSL/TLS und STARTTLS
  - UID-basierte Duplikatsprüfung
  - E-Mail-Parsing mit mailparser
  - Automatische Speicherung in Tenant-DB
- **Frontend-UI**: React-Komponenten
  - Login-Seite (`/login`)
  - E-Mail-Liste (`/emails`)
  - E-Mail-Detail-Ansicht (`/emails/[id]`)
  - E-Mail-Compose (`/emails/compose`)
  - E-Mail-Einstellungen (`/emails/settings`)
  - Header-Komponente
  - Sidebar-Komponente
- **Settings-API**: Benutzer-Einstellungen
  - `GET /api/settings` - Einstellungen abrufen
  - `PATCH /api/settings` - Einstellungen aktualisieren

#### SCC-Frontend (Next.js)
- **Framework**: Next.js 14+ mit App Router
- **Authentication**: Token-basierte Authentifizierung
  - Login-Seite (`/login`)
  - API-Client (`lib/api.ts`)
- **Company-Management**: Vollständige UI für Firmen-Verwaltung
  - Companies-Liste (`/companies`)
  - Company-Detail-View (`/companies/[id]`)
  - Company-Erstellung (`/companies/new`)
  - Company-Bearbeitung (`/companies/[id]/edit`)
  - DB-Provisionierung über UI
  - Tenant-User-Verwaltung
- **Features**: Erweiterte Frontend-Funktionen
  - Suche, Filter, Sortierung
  - Pagination
  - Responsive Design

#### Shared Package
- **Gemeinsame Types**: TypeScript-Typdefinitionen
  - `types/index.ts` - Gemeinsame Typen
- **Utilities**: Wiederverwendbare Funktionen
  - `utils/index.ts` - Utility-Funktionen
- **Build-System**: TypeScript-Kompilierung für alle Apps

#### DevOps & Scripts
- **Docker**: PostgreSQL-Container-Setup
  - `docker-compose.yml` - PostgreSQL-Container-Konfiguration
- **Start-Scripts**: Automatisierte Service-Starts
  - `start-all.ps1` - PowerShell-Script zum Starten aller Services
  - `start-all.bat` - Batch-Datei zum Starten aller Services
  - `stop-all.ps1` - PowerShell-Script zum Stoppen aller Services
  - `stop-all.bat` - Batch-Datei zum Stoppen aller Services
- **Port-Management**: Port-Verwaltung
  - `check-ports.ps1` - Ports prüfen
  - `check-ports.bat` - Ports prüfen (Batch)
  - `kill-ports.ps1` - Ports freigeben
  - `kill-ports.bat` - Ports freigeben (Batch)

### Technische Details

#### Datenbank-Schema (Tenant-DBs)
- **users-Tabelle**: Benutzer-Verwaltung
  - UUID-basierte IDs
  - company_id für Multi-Tenant-Isolation
  - username (Unique)
  - email
  - password_hash (bcrypt)
  - first_name, last_name
  - role, status
  - last_login_at, created_at, updated_at
- **emails-Tabelle**: E-Mail-Speicherung
  - UUID-basierte IDs
  - user_id, account_id (Foreign Keys)
  - subject, from_email, to_email
  - body (TEXT)
  - message_uid (für Duplikatsprüfung)
  - created_at, read_at
- **email_accounts-Tabelle**: IMAP-Konto-Verwaltung
  - UUID-basierte IDs
  - user_id (Foreign Key)
  - name, email
  - IMAP-Konfiguration (host, port, username, password, ssl, tls, folder)
  - SMTP-Konfiguration (host, port, username, password, ssl, tls)
  - is_active
  - created_at, updated_at
- **user_settings-Tabelle**: Benutzer-Einstellungen
  - UUID-basierte IDs
  - user_id (Foreign Key, Unique)
  - fetch_interval_minutes
  - created_at, updated_at

#### Sicherheit
- **Verschlüsselung**: AES-256-GCM für DB-Passwörter
- **JWT-Auth**: Sichere Token-basierte Authentifizierung
- **Tenant-Isolation**: Strikte Trennung zwischen Firmen-Datenbanken
- **Input-Validation**: class-validator für alle API-Inputs
- **Password-Hashing**: bcrypt für Benutzer-Passwörter

#### Performance
- **Connection-Pooling**: Effiziente DB-Verbindungen pro Company
- **Caching**: DB-Config-Caching (5 Min TTL)
- **Lazy-Loading**: Dynamisches Laden von DB-Configs

### Geändert

#### E-Mail-API
- **Theme-Daten**: Erweitert um Theme-Informationen
  - `GET /api/emails` - Join mit `email_themes` Tabelle für Theme-Informationen
  - Rückgabe von `theme_id`, `theme_name`, `theme_color` in API-Response
  - Korrekte Anzeige von zugewiesenen Themes in Tabellenansicht
- **Suche und Filter**: Erweiterte Funktionalität für E-Mail-Abfragen
  - `GET /api/emails` unterstützt jetzt `?search=...` und `?filter=...` Parameter
  - Volltext-Suche in Betreff, Absender und Inhalt
  - Filter-Optionen: 'all', 'read', 'unread'
  - ILIKE-basierte Suche für case-insensitive Ergebnisse
  - Limitierung auf 50 Ergebnisse pro Abfrage
- **E-Mail-Abruf**: Refactoring für UID-basierte Duplikatsprüfung
  - `email-fetcher.ts` verwendet jetzt IMAP-UIDs statt Sequenznummern
  - Prüfung gegen bereits abgerufene UIDs vor Speicherung
  - E-Mails werden nicht mehr als gelesen markiert (`markSeen: false`)
  - Unterstützung für konfigurierbare IMAP-Ordner
  - Verbesserte Fehlerbehandlung und Logging

#### Einstellungsseite
- **Untermenü-Struktur**: Reorganisation der Einstellungsseite
  - Zwei Tabs: "E-Mail Konten" und "Allgemein"
  - Tab-Navigation mit visueller Hervorhebung
  - Bedingte Anzeige von Inhalten basierend auf aktivem Tab
  - Verbesserte UX mit klarer Strukturierung

#### Settings API
- **Verbesserte Datenverarbeitung**: Fallback-Logik für fehlende Werte
  - Fallback auf Request-Body-Werte wenn keine Daten in Datenbank vorhanden
  - Verbesserte Fehlerbehandlung bei JSON-Parsing
  - Automatische Entfernung der redundanten `participants_detailed` Spalte

#### SCC Frontend
- **API-Pfad-Korrektur**: Korrigierter Endpunkt für Cron-Job-Logs
  - Frontend verwendet jetzt `/cron-jobs/companies/:id/logs` statt `/companies/:id/cron-jobs/logs`
  - Behebt 404-Fehler beim Laden der Cron-Job-Logs

#### SCC - Datenbank-Interface
- **Route-Reihenfolge in NestJS Controller**: Spezifischere Routen müssen vor generischen Routen stehen
  - Alle neuen Datenbank-Endpoints wurden vor `GET /companies/:id` platziert
  - Behebt 404-Fehler bei spezifischen Routen wie `/companies/:id/tables`
- **Fehlerbehandlung für Datenbank-Passwort**: Verbesserte Validierung und Fehlermeldungen
  - Prüfung auf Verschlüsselungsformat (4 Teile: salt:iv:tag:encrypted)
  - Detaillierte Fehlermeldungen für fehlende oder ungültige Passwörter
  - Try-Catch um Entschlüsselung mit spezifischen Fehlermeldungen
  - Validierung, dass Passwort nach Entschlüsselung nicht leer ist
  - Implementiert in `apps/scc/src/companies/companies.service.ts` und `database-helpers.ts`
- **PostgreSQL-Kompatibilität**: Entfernung von MySQL-spezifischen Befehlen
  - Verwendung von `information_schema` Queries statt `SHOW` und `DESCRIBE`
  - Korrekte PostgreSQL-Funktionen für Tabellen-Statistiken (`pg_size_pretty`, `pg_total_relation_size`)
  - Implementiert in `apps/scc/src/companies/companies.service.ts`
- **DTO-Validierung**: Vollständige Validierung mit class-validator
  - `@IsString()`, `@IsInt()`, `@Min()`, `@Max()`, `@MaxLength()` Decorators
  - Swagger-Dokumentation mit `@ApiProperty` und `@ApiPropertyOptional`
  - Implementiert in `apps/scc/src/companies/dto/execute-query.dto.ts` und `table-data.dto.ts`
- **Error-Response-Format**: Konsistente Fehler-Formatierung
  - `BadRequestException` mit Objekt-Struktur `{ message, code, details? }`
  - Frontend extrahiert korrekt `err.response?.data?.message`
  - Implementiert in `apps/scc/src/companies/companies.service.ts` und Frontend

### Geändert

- **Umbenennung von "Regeln" zu "Workflows"**: Konsistente Terminologie in UI und Code
  - Alle Benutzer-sichtbaren Texte verwenden jetzt "Workflow" statt "Regel"
  - Technische Begriffe: `AutomationRule` → `AutomationWorkflow`, `getActiveRules` → `getActiveWorkflows`, etc.
  - Funktionsnamen: `executeRule` → `executeWorkflow`, `executeRulesForEmail` → `executeWorkflowsForEmail`, etc.
  - Cache-Variablen: `activeRulesCache` → `activeWorkflowsCache`
  - Implementiert in `apps/mailclient/src/lib/automation-engine.ts` und allen betroffenen Komponenten
  - **Hinweis**: Datenbank-Tabellennamen (`automation_rules`) bleiben unverändert für Rückwärtskompatibilität
- **Workflow-Editor Vollbild-Modus**: Workflow-Editor nutzt jetzt den gesamten Bildschirm
  - Entfernung des Modal-Overlays (dunkler Hintergrund)
  - Vollbild-Container mit `position: fixed` und `width: 100%`, `height: 100%`
  - Keine Einschränkungen durch `maxWidth` oder `maxHeight`
  - Verbesserte Nutzung des verfügbaren Platzes für komplexe Workflows
  - Implementiert in `apps/mailclient/src/components/AutomationRules.tsx`
- **Abteilungen in Workflows als Knoten**: Abteilungen werden jetzt als Knoten im Workflow-Editor verwaltet
  - Neuer Knotentyp `DepartmentNode` mit Icon (FiBriefcase) und Farbe (#17a2b8)
  - Abteilungs-Knoten kann per Drag & Drop aus der Sidebar hinzugefügt werden
  - Konfigurations-Panel zur Auswahl mehrerer Abteilungen per Checkbox
  - Abteilungen werden aus Workflow-Knoten extrahiert beim Speichern
  - Automatische Migration: Bestehende Abteilungszuweisungen werden als Knoten erstellt beim Laden
  - Entfernung der Checkbox-Auswahl aus dem Formular
  - Implementiert in `apps/mailclient/src/components/AutomationWorkflowEditor.tsx` und `apps/mailclient/src/components/AutomationRules.tsx`
- Initiale Projektstruktur erstellt
- Alle Hauptfunktionen implementiert

### Bekannte Probleme

- Mock-Provisionierung verwendet fiktive DB-Daten (für lokale Entwicklung)
- Terraform-Integration noch nicht implementiert
- Umfassende Tests noch nicht vorhanden

---

## Format

### Kategorien

- **Hinzugefügt** für neue Features
- **Geändert** für Änderungen an bestehenden Funktionalitäten
- **Veraltet** für bald entfernte Features
- **Entfernt** für entfernte Features
- **Behoben** für behobene Fehler
- **Sicherheit** für Sicherheitslücken

### Datumsformat

Daten werden im Format `YYYY-MM-DD` angegeben.

### Versionsnummern

Das Projekt folgt [Semantic Versioning](https://semver.org/lang/de/):
- **MAJOR** Version für inkompatible API-Änderungen
- **MINOR** Version für neue Funktionalität (rückwärtskompatibel)
- **PATCH** Version für Fehlerbehebungen (rückwärtskompatibel)

