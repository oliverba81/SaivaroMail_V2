# Funktionsübersicht für Kunden - Saivaro Mail v2

> **Willkommen bei Saivaro Mail!** Diese Übersicht gibt Ihnen einen vollständigen Überblick über alle Funktionen und Möglichkeiten unserer E-Mail-Management-Plattform. Entdecken Sie, wie Sie Ihre E-Mail-Kommunikation effizienter organisieren und automatisieren können.

## 📋 Inhaltsverzeichnis

1. [Überblick](#überblick)
2. [Erste Schritte](#erste-schritte)
3. [E-Mail-Verwaltung](#e-mail-verwaltung)
4. [Organisation & Strukturierung](#organisation--strukturierung)
5. [Automatisierung](#automatisierung)
6. [Team-Funktionen](#team-funktionen)
7. [Einstellungen & Anpassung](#einstellungen--anpassung)
8. [Häufig gestellte Fragen](#häufig-gestellte-fragen)

---

## 🎯 Überblick

**Saivaro Mail v2** ist eine moderne E-Mail-Management-Plattform, die Ihnen hilft, Ihre E-Mail-Kommunikation professionell zu organisieren, zu automatisieren und im Team zu verwalten.

### Was macht Saivaro Mail besonders?

✅ **Zentrale E-Mail-Verwaltung** – Alle Ihre E-Mail-Konten an einem Ort  
✅ **Intelligente Automatisierung** – Sparen Sie Zeit durch automatisierte Workflows  
✅ **Team-Kollaboration** – Organisieren Sie E-Mails nach Abteilungen  
✅ **Volltext-Suche** – Finden Sie schnell, was Sie suchen  
✅ **Moderne Benutzeroberfläche** – Intuitiv und benutzerfreundlich  
✅ **Schnellere Ladezeiten** – Optimierte Oberfläche für flüssiges Arbeiten auch bei vielen E-Mails  
✅ **Elegante Benachrichtigungen** – Keine störenden Popups mehr, alle Meldungen verschwinden automatisch  
✅ **Sicherheit** – Ihre Daten sind sicher und geschützt  

---

## 🚀 Erste Schritte

### Anmeldung

1. Öffnen Sie die Saivaro Mail-Anwendung in Ihrem Browser
2. Melden Sie sich mit Ihrem Benutzernamen und Passwort an
3. Nach erfolgreicher Anmeldung gelangen Sie zur E-Mail-Übersicht

### E-Mail-Konto einrichten

Bevor Sie E-Mails empfangen und versenden können, müssen Sie mindestens ein E-Mail-Konto konfigurieren:

1. Gehen Sie zu **Einstellungen** → **E-Mail-Konten**
2. Klicken Sie auf **"Neues Konto hinzufügen"**
3. Geben Sie Ihre E-Mail-Kontodaten ein:
   - **E-Mail-Adresse** und **Passwort**
   - **IMAP-Server** (für E-Mail-Empfang)
     - **Port**: 993 (SSL) oder 143 (STARTTLS)
     - **Verschlüsselung**: SSL oder STARTTLS
     - **IMAP-Ordner**: Standard "INBOX", kann angepasst werden
   - **SMTP-Server** (für E-Mail-Versand)
     - **Port**: 465 (SSL) oder 587 (STARTTLS)
     - **Verschlüsselung**: SSL oder STARTTLS
4. Klicken Sie auf **"Verbindung testen"**, um sicherzustellen, dass alles funktioniert
   - Der Test zeigt die Anzahl verfügbarer E-Mails im Postfach
   - Überprüft sowohl IMAP- als auch SMTP-Verbindung
5. Aktivieren Sie das Konto (Checkbox "Aktiv")
6. Speichern Sie das Konto

**Tipp:** Die meisten E-Mail-Anbieter stellen die notwendigen Server-Informationen auf ihrer Website bereit. Die Ports werden automatisch angepasst, wenn Sie SSL oder STARTTLS auswählen.

---

## 📬 E-Mail-Verwaltung

### E-Mails empfangen

#### Automatischer E-Mail-Abruf

- E-Mails werden automatisch in regelmäßigen Abständen von Ihren E-Mail-Servern abgerufen
- Das Abruf-Intervall können Sie in den Einstellungen anpassen (Standard: 5 Minuten)
- Sie können E-Mails auch manuell abrufen, indem Sie auf den **"Jetzt abrufen"**-Button klicken

#### E-Mail-Liste

Die E-Mail-Liste zeigt alle Ihre E-Mails übersichtlich an:

- **Ungelesene E-Mails** werden fett dargestellt und mit einer gelben Markierung hervorgehoben
- **Wichtige E-Mails** sind mit einem Stern markiert
- **Erledigte E-Mails** zeigen ein Häkchen-Symbol
- **E-Mails mit Anhängen** werden mit einem 📎-Symbol (Büroklammer) neben dem E-Mail-/Telefon-Symbol gekennzeichnet (in Liste, Tabelle und Konversationen)
- **„In Bearbeitung“**: In Konversationen wird im Header der Gruppe ein Hinweis „In Bearbeitung: [Name]“ angezeigt, wenn ein anderer Benutzer gerade an einer Antwort zu einer E-Mail dieser Konversation arbeitet
- Klicken Sie auf eine E-Mail, um sie in der Vorschau zu öffnen; die hervorgehobene E-Mail in der Liste bleibt mit dem angezeigten Tab (Vorschau oder geöffnete Antwort) synchron

### E-Mails lesen

#### E-Mail-Vorschau

- Die Vorschau zeigt den vollständigen E-Mail-Inhalt
- **Anhänge** werden direkt im Header angezeigt und können mit einem Klick heruntergeladen werden
- HTML-E-Mails werden korrekt formatiert angezeigt
- Die Vorschau kann in der Größe angepasst werden (Drag & Drop)
- **Scrollen in Vorschau- und Antwort-Tab**: Bei langem Inhalt (z. B. lange E-Mail, viele Kommentare oder ausführliches Antwortformular) können Sie innerhalb des aktiven Tabs (Vorschau oder „Antwort: …“) scrollen – der Inhalt bleibt voll nutzbar.
- **Ihre Anpassungen werden gespeichert**: Listenbreite, Timeline-Höhe, ob die Timeline eingeklappt ist und die Thread-Ansicht (AN/AUS) werden pro Benutzer gespeichert und beim nächsten Besuch wiederhergestellt
- **Kommentare**: Unterhalb der Vorschau können Sie Kommentare zu E-Mails hinzufügen und einsehen (ein-/ausklappbarer Bereich „Kommentare“). In der **Thread-Ansicht** wird dieser Kommentarbereich nicht angezeigt – dort sehen Sie die Kommentare direkt unter jeder Nachricht im Thread.
- **Thread-Ansicht – Anhänge**: In der Thread-Ansicht (Konversation) wird bei Nachrichten mit Anhängen ein Büroklammer-Symbol angezeigt; unter jeder Nachricht erscheinen die Anhänge mit Dateiname, Größe und Download-Button zum Herunterladen.
- **Thread-Ansicht – „In Bearbeitung“ und Antworten**: Bei jeder Nachricht im Thread wird angezeigt, ob ein anderer Benutzer gerade an einer Antwort arbeitet („In Bearbeitung: [Name]“). Pro Nachricht gibt es einen **„Antworten“-Button**; mit einem Klick öffnen Sie das Antwortformular genau für diese Nachricht. Ist die Nachricht von jemand anderem in Bearbeitung, ist der Antworten-Button deaktiviert.

#### Audio-Features

Die Audio-Features ermöglichen es Ihnen, E-Mails vorlesen zu lassen und Zusammenfassungen als Audio anzuhören. Beide Features werden gemeinsam aktiviert oder deaktiviert durch Ihren Administrator im Saivaro Control Center (SCC).

- **E-Mail vorlesen lassen**
  - Klicken Sie auf den **"Vorlesen"**-Button oberhalb des E-Mail-Headers
  - Der E-Mail-Inhalt wird Ihnen vorgelesen
  - Unterstützt Browser-native Sprachausgabe als Standard
  - Optional: Hochwertige Stimmen über ElevenLabs (konfigurierbar in den Einstellungen)
  - Loading-Anzeige während der Vorbereitung ("Wird vorbereitet...")
  - Automatischer Fallback auf Browser-TTS bei Fehlern oder wenn ElevenLabs nicht aktiviert ist

- **E-Mail-Zusammenfassung anhören**
  - Klicken Sie auf den **"Zusammenfassung wiedergeben"**-Button neben dem Vorlesen-Button
  - Eine kurze Zusammenfassung der E-Mail wird generiert und vorgelesen
  - Perfekt für lange E-Mails, um schnell den Inhalt zu erfassen
  - Verwendet künstliche Intelligenz (OpenAI) für die Zusammenfassung
  - Die Zusammenfassung wird nur als Audio ausgegeben (keine Text-Anzeige)
  - Verwendet ElevenLabs für Audio-Ausgabe, falls aktiviert, sonst Browser-TTS

#### E-Mail-Timeline

Unterhalb jeder E-Mail sehen Sie eine **Timeline**, die alle Ereignisse chronologisch anzeigt:

- Wann wurde die E-Mail empfangen?
- Wer hat sie als gelesen/ungelesen markiert?
- Welche Automatisierungen wurden ausgeführt?
- Welche Themen oder Abteilungen wurden zugewiesen?

Die Timeline gibt Ihnen einen vollständigen Überblick über die Historie jeder E-Mail.

#### Kommentare zu E-Mails

- Unterhalb der E-Mail-Vorschau finden Sie den Bereich **„Kommentare“** (ein- und ausklappbar).
- Dort können Sie Kommentare zu der ausgewählten E-Mail lesen und neue hinzufügen; Autor und Datum werden angezeigt.
- In der **Thread-Ansicht** wird der Kommentarbereich nicht angezeigt – die Kommentare erscheinen dort direkt unter jeder Nachricht im Thread.
- In der E-Mail-Liste zeigt ein Symbol an, ob eine E-Mail Kommentare hat; Sie können nach „Kommentare“ suchen und nach „Hat Kommentare“ bzw. „Ohne Kommentare“ filtern.

### E-Mails versenden

#### Neue E-Mail verfassen

1. Klicken Sie auf den **"Neu..."**-Button in der Toolbar
2. Wählen Sie im Dropdown-Menü **"E-Mail"** oder **"Telefonnotiz"**
3. Wählen Sie eine **Abteilung** aus (erforderlich)
4. Geben Sie **Empfänger** ein (mehrere Empfänger durch Komma getrennt)
   - Bei Telefonnotizen: Geben Sie eine **Telefonnummer** ein (klickbar als tel:-Link)
5. Optional: Fügen Sie **CC** oder **BCC**-Empfänger hinzu
6. Geben Sie einen **Betreff** ein
7. Schreiben Sie Ihre **Nachricht**
   - Das Nachrichtenfeld unterstützt **Formatierung** (Fett, Kursiv, Links, Listen, Bilder etc.) über die Toolbar des Editors. Der Editor erscheint als einheitliche Box mit Toolbar oben (Tiptap-Standard).
   - Die **Signatur** der gewählten Abteilung wird automatisch am Anfang des Textes eingefügt (falls für die Abteilung hinterlegt). Platzhalter wie Firmenname oder Adresse werden dabei automatisch ersetzt.
8. Optional: Zwei Schalter oberhalb von **"Senden"** steuern die Erledigt-Markierung:
   - **„Ursprung beim Senden erledigen“** (nur bei Antworten): Die E-Mail, auf die Sie antworten, wird nach dem Versand automatisch als erledigt markiert.
   - **„Aktuelle Nachricht nach dem Senden erledigen“**: Die soeben gesendete E-Mail oder Telefonnotiz wird automatisch als erledigt markiert.
   Beide Optionen sind standardmäßig an. Nach dem Senden erscheint eine kurze Erfolgsmeldung, die von selbst verschwindet.
9. Klicken Sie auf **"Senden"**

**Hinweis:** Die E-Mail wird mit dem E-Mail-Konto der ausgewählten Abteilung versendet.

#### Auf E-Mail antworten

1. Wählen Sie eine E-Mail aus der Liste aus
2. Klicken Sie auf den **"Antworten"**-Button in der Toolbar (zwischen "Neu..." und "Erledigen")
3. **Bei normalen E-Mails**: Sie werden direkt zur Antwort-Seite weitergeleitet
4. **Bei Telefonnotizen**: Wählen Sie im Dropdown-Menü:
   - **"Per E-Mail antworten"** – Erstellt eine normale E-Mail-Antwort
   - **"Per Telefonnotiz antworten"** – Erstellt eine neue Telefonnotiz als Antwort
5. Die Antwort wird automatisch mit dem Betreff "Re: [Original-Betreff]" vorausgefüllt
6. Das "An"-Feld ist bereits mit dem Absender der ursprünglichen E-Mail gefüllt
7. Der ursprüngliche E-Mail-Inhalt wird als Zitat eingefügt
8. Bearbeiten Sie die Nachricht und klicken Sie auf **"Senden"**

**Hinweis:** Beide Antworttypen (E-Mail oder Telefonnotiz) erhalten die gleiche Ticket-ID und werden in der Konversation gruppiert.

### E-Mail-Aktionen

#### E-Mails markieren

- **Als gelesen/ungelesen markieren** – Klicken Sie auf die E-Mail oder verwenden Sie die Toolbar-Buttons
- **Als wichtig markieren** – Klicken Sie auf den Stern-Button
- **Als erledigt markieren** – Verwenden Sie den "Erledigen"-Button (jeder Benutzer hat seinen eigenen Erledigt-Status). Beim Senden können Sie optional die Ursprungsnachricht und/oder die gesendete Nachricht automatisch als erledigt markieren (Schalter im Verfassen-/Antwort-Formular oberhalb von „Senden“).
- **Als Spam markieren** – Markieren Sie unerwünschte E-Mails als Spam
- **Auf E-Mail antworten** – Klicken Sie auf den "Antworten"-Button in der Toolbar (zwischen "Neu..." und "Erledigen")
  - Aktiviert nur, wenn eine E-Mail ausgewählt ist
  - Bei normalen E-Mails: Direkte Weiterleitung zur Antwort-Seite
  - Bei Telefonnotizen: Dropdown-Menü zur Auswahl zwischen E-Mail- oder Telefonnotiz-Antwort

#### Bulk-Aktionen

- Wählen Sie mehrere E-Mails aus (Checkboxen)
- Führen Sie Aktionen für alle ausgewählten E-Mails gleichzeitig aus:
  - Als gelesen/ungelesen markieren
  - Als erledigt markieren
  - Löschen
  - Themen zuweisen
  - Abteilungen zuweisen

#### E-Mails löschen

- Klicken Sie auf den **Löschen**-Button für einzelne E-Mails
- Oder wählen Sie mehrere E-Mails aus und löschen Sie sie gemeinsam
- Gelöschte E-Mails können über den Filter "Alle Mails" wieder eingesehen werden

---

## 🔍 Suche & Filter

### Volltext-Suche

Finden Sie schnell die E-Mail, die Sie suchen:

1. Geben Sie in das Suchfeld mindestens **3 Zeichen** ein
2. Drücken Sie **Enter** oder klicken Sie auf die Lupe
3. Die Suche durchsucht automatisch:
   - E-Mail-Betreff
   - Absender-Adresse
   - E-Mail-Inhalt

**Tipp:** Sie können in den Einstellungen festlegen, welche Felder durchsucht werden sollen.

### Filter

#### Standard-Filter

- **Alle Mails** – Zeigt alle E-Mails an (inklusive gelöschter)
- **Ungelesen** – Zeigt nur ungelesene E-Mails
- **Gelesen** – Zeigt nur gelesene E-Mails
- **Erledigt** – Zeigt nur erledigte E-Mails
- **Unerledigt** – Zeigt nur unerledigte E-Mails

#### Erweiterte Filter

- **Nach Themen filtern** – Zeigt nur E-Mails mit bestimmten Themen
- **Nach Dringlichkeit filtern** – Filtert nach Priorität (niedrig, mittel, hoch)
- **Nach Abteilungen filtern** – Zeigt E-Mails bestimmter Abteilungen

### Benutzerdefinierte Filter

Erstellen Sie Ihre eigenen Filter für wiederkehrende Suchanfragen:

1. Gehen Sie zu **Einstellungen** → **Filter**
2. Klicken Sie auf **"Neuer Filter"**
3. Geben Sie einen Namen für den Filter ein
4. Definieren Sie **Regeln** (Bedingungen):
   - **Von** – Filtert nach Absender
   - **An** – Filtert nach Empfänger
   - **Betreff** – Filtert nach Betreff
   - **Inhalt** – Filtert nach E-Mail-Inhalt
   - **Status** – Filtert nach Lesestatus (ungelesen, gelesen, gelöscht, spam, gesendet)
   - **Thema** – Filtert nach zugewiesenem Thema
   - **Abteilung** – Filtert nach Abteilung
   - **Typ** – Filtert nach E-Mail-Typ (E-Mail oder Telefonnotiz)
   - **Telefonnummer** – Filtert nach Telefonnummern in Telefonnotizen
5. Wählen Sie einen **Operator** (enthält, gleich, beginnt mit, endet mit, ist)
6. Speichern Sie den Filter

**Hinweis:** Bei Status-Filtern müssen Sie die gewünschten Status explizit auswählen. Gesendete E-Mails werden nur angezeigt, wenn "gesendet" im Filter ausgewählt ist.

**Vorteil:** Ihre benutzerdefinierten Filter erscheinen in der Sidebar und können mit einem Klick aktiviert werden. Die Anzahl der gefilterten E-Mails wird in Klammern angezeigt.

---

## 🏷️ Organisation & Strukturierung

### Themen (Themes)

Organisieren Sie Ihre E-Mails mit farbigen Themen:

#### Standard-Themen

Beim ersten Öffnen werden automatisch 10 Standard-Themen erstellt:

- **Arbeit** (Blau)
- **Privat** (Grün)
- **Wichtig** (Gelb)
- **Projekte** (Cyan)
- **Rechnungen** (Rot)
- **Bestellungen** (Lila)
- **Support** (Orange)
- **Marketing** (Pink)
- **Vertrieb** (Türkis)
- **Personal** (Grau)

#### Eigene Themen erstellen

1. Gehen Sie zu **Einstellungen** → **Themen**
2. Klicken Sie auf **"Neues Thema"**
3. Geben Sie einen Namen ein (z.B. "Kundenanfragen")
4. Wählen Sie eine Farbe (Color-Picker oder Hex-Code)
5. Speichern Sie das Thema

#### Themen zuweisen

- **Manuell:** Wählen Sie eine E-Mail aus und klicken Sie auf "Thema zuweisen"
- **Automatisch:** Verwenden Sie Automatisierungsregeln (siehe Abschnitt Automatisierung)
- **Bulk:** Wählen Sie mehrere E-Mails aus und weisen Sie ihnen gemeinsam ein Thema zu

#### Nach Themen filtern

- Klicken Sie in der Sidebar auf ein Thema, um nur E-Mails mit diesem Thema anzuzeigen
- Oder verwenden Sie den Filter-Dropdown

### Dringlichkeit

Markieren Sie E-Mails mit einer Prioritätsstufe:

- **Niedrig** – Nicht dringend
- **Mittel** – Normale Priorität
- **Hoch** – Dringend

Die Dringlichkeit kann manuell gesetzt oder durch Automatisierungsregeln automatisch zugewiesen werden.

---

## ⚙️ Automatisierung

Sparen Sie Zeit durch intelligente Automatisierung! Erstellen Sie Workflows, die automatisch Aktionen basierend auf Bedingungen ausführen.

### Automatisierungs-Workflows

#### Workflow erstellen

1. Gehen Sie zu **Einstellungen** → **Automatisierung**
2. Klicken Sie auf **"Neuer Workflow"**
3. Geben Sie einen Namen ein (z.B. "Rechnungen automatisch kategorisieren")
4. Aktivieren Sie den Workflow (Checkbox)

#### Trigger (Auslöser)

Definieren Sie, wann der Workflow ausgeführt werden soll:

- **Bei eingehender E-Mail** – Wird automatisch ausgeführt, wenn eine neue E-Mail empfangen wird
- **Bei ausgehender E-Mail** – Wird ausgeführt, wenn Sie eine E-Mail senden
- **Manuell** – Kann über das Rechtsklick-Menü manuell ausgeführt werden
- **Zeitgesteuert** – Wird zu bestimmten Zeiten ausgeführt (z.B. täglich um 9 Uhr)

#### Bedingungen

Definieren Sie, welche E-Mails betroffen sein sollen:

- **Von** – Absender-Adresse
- **An** – Empfänger-Adresse
- **Betreff** – Enthält bestimmte Wörter
- **Inhalt** – E-Mail-Inhalt enthält bestimmten Text
- **Abteilung** – E-Mail gehört zu bestimmter Abteilung
- **Typ** – E-Mail oder Telefonnotiz
- **Telefonnummer** – Enthält bestimmte Nummer
- **Dringlichkeit** – Niedrig, Mittel oder Hoch
- **Thema** – Aus Ihrer Themenliste
- **Lesestatus** – Gelesen oder Ungelesen
- **Erledigt-Status** – Erledigt oder Unerledigt
- **Anhang** – Hat Anhang oder Kein Anhang

Sie können mehrere Bedingungen pro Knoten verwenden und festlegen, ob alle (AND) oder mindestens eine (OR) erfüllt sein soll.

#### Aktionen

Definieren Sie, was automatisch passieren soll:

- **Thema zuweisen** – Weist automatisch ein Thema zu
- **Dringlichkeit setzen** – Setzt die Priorität
- **Als wichtig markieren** – Markiert die E-Mail als wichtig
- **Als Spam markieren** – Markiert die E-Mail als Spam
- **E-Mail weiterleiten** – Leitet die E-Mail automatisch weiter
- **Abteilung zuweisen** – Weist die E-Mail einer Abteilung zu
- **Als erledigt markieren** / **Als unerledigt markieren**
- **Als gelesen markieren** / **Als ungelesen markieren**
- **Als gelesen und erledigt markieren**

#### Visueller Workflow-Editor

Der Workflow-Editor bietet eine grafische Oberfläche (ähnlich wie n8n):

- **Drag & Drop** – Ziehen Sie Knoten auf den Canvas
- **Verknüpfungen** – Verbinden Sie Knoten miteinander
- **Zoom & Pan** – Zoomen und navigieren Sie durch große Workflows
- **Auto-Save** – Änderungen werden automatisch gespeichert
- **Undo/Redo** – Machen Sie Änderungen rückgängig oder wiederholen Sie sie

#### E-Mail-Variablen

Verwenden Sie Platzhalter in Aktionen:

- `{{subject}}` – E-Mail-Betreff
- `{{from}}` – Absender
- `{{to}}` – Empfänger
- `{{body}}` – E-Mail-Inhalt
- `{{date}}` – Datum

**Beispiel:** Beim Weiterleiten können Sie schreiben: "Weitergeleitet von {{from}} am {{date}}"

### Workflow-Verwaltung

- **Aktivieren/Deaktivieren** – Schalten Sie Workflows ein oder aus
- **Duplizieren** – Erstellen Sie Kopien von Workflows
- **Exportieren/Importieren** – Sichern Sie Workflows als JSON-Datei
- **Manuell ausführen** – Testen Sie Workflows manuell

---

## 👥 Team-Funktionen

### Abteilungen

Organisieren Sie Ihre E-Mail-Kommunikation nach Abteilungen:

#### Standard-Abteilungen

Beim Einrichten Ihres Kontos werden automatisch 6 Standard-Abteilungen erstellt:

- Geschäftsführung
- Buchhaltung
- Marketing
- Einkauf
- Logistik
- Kundenservice

#### Abteilungen verwalten

1. Gehen Sie zu **Einstellungen** → **Abteilungen**
2. In der Abteilungsübersicht werden **alle Abteilungen** (aktive und inaktive) angezeigt, damit Sie die vollständige Liste verwalten können
3. Erstellen Sie neue Abteilungen oder bearbeiten Sie bestehende
4. Jeder Abteilung kann ein **E-Mail-Konto** zugeordnet werden
5. Nur **aktive Abteilungen** können für E-Mail-Versand verwendet werden
6. **E-Mail-Signatur**: Pro Abteilung können Sie optional eine Signatur hinterlegen (formatiert mit dem Rich-Text-Editor oder als reiner Text). Beim Verfassen einer E-Mail oder Telefonnotiz wird die Signatur der gewählten Abteilung automatisch am Anfang Ihrer Nachricht eingefügt – auch bei Antworten (vor dem zitierten Originaltext). In der Signatur können Platzhalter wie `{{companyName}}`, `{{companyAddress}}` oder `{{userName}}` verwendet werden; diese werden beim Einfügen automatisch durch die Firmendaten bzw. Ihren Namen ersetzt.

#### Fehlende Standard-Abteilungen wiederherstellen

Falls Sie Standard-Abteilungen gelöscht haben, können Sie diese einfach wiederherstellen:

1. Klicken Sie auf **"Fehlende Firmen-Abteilungen wiederherstellen"** in der Abteilungsübersicht
2. Ein Fenster zeigt Ihnen alle fehlenden Standard-Abteilungen an
3. Bestätigen Sie das Hinzufügen
4. Die fehlenden Abteilungen werden automatisch erstellt

#### Private Abteilungen für familiäre Nutzung

Für private E-Mail-Nutzung können Sie spezielle Abteilungen erstellen:

1. Klicken Sie auf **"Private Abteilungen hinzufügen"** in der Abteilungsübersicht
2. Ein Fenster zeigt Ihnen die verfügbaren privaten Abteilungen:
   - **Familie** – Zentrale Abteilung für familiäre E-Mail-Kommunikation
   - **Elternteil 1, Elternteil 2** – Persönliche E-Mail-Abteilungen für Eltern
   - **Kind 1, Kind 2, Kind 3** – Persönliche E-Mail-Abteilungen für Kinder
3. Bestätigen Sie das Hinzufügen
4. Die privaten Abteilungen werden automatisch erstellt

#### Erklärung und Hilfe

Am Ende der Abteilungsübersicht finden Sie eine aufklappbare Erklärungssektion:
- **Was sind Abteilungen?** – Erklärung für Einsteiger
- **Wofür werden Abteilungen verwendet?** – Übersicht der Funktionen
- **Häufig gestellte Fragen (FAQ)** – Antworten auf die wichtigsten Fragen

#### Abteilungen zuweisen

- **Beim Versand:** Wählen Sie beim Verfassen einer E-Mail eine Abteilung aus
- **Nachträglich:** Weisen Sie E-Mails manuell Abteilungen zu
- **Automatisch:** Eingehende E-Mails werden automatisch der richtigen Abteilung zugeordnet (basierend auf Empfänger-Adresse)

#### Abteilungs-Filter

- Filtern Sie E-Mails nach Abteilungen
- Sehen Sie auf einen Blick, welche E-Mails zu welcher Abteilung gehören

### Kontakte verwalten

Unter **Einstellungen** → **Kontakte** können Sie Ihr Adressbuch pflegen:

#### Kontakte anlegen und bearbeiten

1. Gehen Sie zu **Einstellungen** → **Kontakte**
2. Klicken Sie auf **"Neuer Kontakt"** oder auf das Bearbeiten-Symbol bei einem bestehenden Kontakt
3. Ein Fenster öffnet sich, in dem Sie alle Angaben eingeben können:
   - **Profilbild**: Bild hochladen oder URL eingeben (optional)
   - **Anrede für Briefe**: Herr, Frau oder Divers (für formelle Anschreiben)
   - **Vorname, Nachname, Firma** – mindestens eines davon ist erforderlich
   - **Kundennummer** (optional)
   - **Anredeform**: Du oder Sie (mit Hinweis-Icon für Erklärung)
   - **Geburtstag, Notiz** (optional)
   - **Telefonnummern, E-Mail-Adressen, Anschriften**: Über „Hinzufügen“ können Sie mehrere Einträge mit Bezeichnung (z. B. „mobil“, „geschäftlich“) anlegen
4. Speichern Sie den Kontakt

#### Kontakte durchsuchen und löschen

- Im Suchfeld können Sie nach Name, E-Mail, Telefon, Firma oder Kundennummer suchen
- Die Anzahl Ihrer Kontakte wird oben im Kontakte-Bereich angezeigt
- Zum Löschen klicken Sie auf das Papierkorb-Symbol und bestätigen mit „Ja“

### Benutzer-Verwaltung

#### Benutzer erstellen

1. Gehen Sie zu **Einstellungen** → **Benutzer**
2. Klicken Sie auf **"Neuer Benutzer"**
3. Geben Sie die Benutzerdaten ein:
   - Name, E-Mail, Benutzername
   - Passwort
   - Rolle (Admin oder Benutzer)
4. Weisen Sie dem Benutzer **Abteilungen** zu
5. Speichern Sie den Benutzer

#### Benutzer-Rollen

- **Admin** – Vollzugriff auf alle Funktionen
- **Benutzer** – Standard-Berechtigungen

#### Abteilungszuweisung für Benutzer

- Jeder Benutzer kann mehreren Abteilungen zugeordnet werden
- Benutzer sehen nur E-Mails ihrer zugewiesenen Abteilungen (je nach Berechtigung)

---

## ⚙️ Einstellungen & Anpassung

### Einstellungs-Dashboard

Das Einstellungsmenü bietet eine übersichtliche Karten-Ansicht:

- **E-Mail-Konten** – Verwalten Sie Ihre E-Mail-Konten
- **Allgemeine Einstellungen** – Abruf-Intervall, Spalten, Suchfelder
- **Filter** – Ihre benutzerdefinierten Filter
- **Themen** – E-Mail-Themen verwalten
- **Automatisierung** – Workflows verwalten
- **Benutzer** – Team-Mitglieder verwalten
- **Abteilungen** – Abteilungen verwalten
- **Kontakte** – Kontakte verwalten (Telefon, E-Mail, Anschriften)
- **Kartenreihenfolge**: Die Reihenfolge der Karten können Sie per Drag & Drop anpassen; Ihre Anordnung wird pro Benutzer gespeichert und beim nächsten Besuch wiederhergestellt

### E-Mail-Konten

#### Konto hinzufügen/bearbeiten

- Erstellen Sie mehrere E-Mail-Konten
- Testen Sie die Verbindung vor dem Speichern
- Aktivieren/Deaktivieren Sie Konten
- Nur aktive Konten werden für E-Mail-Abruf verwendet

#### Verbindungstest

- Testen Sie IMAP- und SMTP-Verbindungen
- Sehen Sie, wie viele E-Mails im Postfach verfügbar sind
- Überprüfen Sie, ob alle Einstellungen korrekt sind

### Allgemeine Einstellungen

#### Abruf-Intervall

- Stellen Sie ein, wie oft E-Mails automatisch abgerufen werden sollen
- Bereich: 1 bis 1440 Minuten (24 Stunden)
- Standard: 5 Minuten
- Änderungen werden automatisch gespeichert

#### OpenAI-Konfiguration

- **API-Key eingeben**: Geben Sie Ihren OpenAI API-Key ein (für E-Mail-Zusammenfassungen)
- **Modell auswählen**: Wählen Sie das gewünschte OpenAI-Modell:
  - GPT-4o-mini (schnell und kostengünstig)
  - GPT-3.5-turbo (ausgewogene Option)
  - GPT-4 (höchste Qualität)
  - GPT-4 Turbo (schnellere GPT-4-Variante)
- Klicken Sie auf **"Speichern"**, um die Konfiguration zu speichern
- **Hinweis**: Der API-Key wird verschlüsselt gespeichert

#### ElevenLabs-Konfiguration

ElevenLabs bietet hochwertige Text-to-Speech-Stimmen für eine bessere Audio-Erfahrung. Die Konfiguration ist optional - die Browser-native Sprachausgabe funktioniert auch ohne ElevenLabs.

- **API-Key eingeben**: Geben Sie Ihren ElevenLabs API-Key ein (für hochwertige Text-to-Speech-Stimmen)
  - Der API-Key wird verschlüsselt in der Datenbank gespeichert
  - Nur Ihre Firma hat Zugriff auf den gespeicherten Key
- **Voice ID eingeben**: Geben Sie die ID der gewünschten Stimme ein
  - Die Voice ID finden Sie in Ihrem ElevenLabs-Dashboard
  - Verschiedene Stimmen stehen zur Verfügung (männlich, weiblich, verschiedene Sprachen)
- **ElevenLabs aktivieren**: Toggle-Button zum Aktivieren/Deaktivieren von ElevenLabs
  - Wenn aktiviert, wird ElevenLabs für beide Audio-Features verwendet (Vorlesen und Zusammenfassung)
  - Wenn deaktiviert, wird automatisch die Browser-native Sprachausgabe verwendet
- **Test-Button**: Testen Sie die ElevenLabs-Konfiguration mit einer Beispiel-Audio-Ausgabe
  - Überprüft die Verbindung zur ElevenLabs-API
  - Validiert API-Key und Voice ID
  - Gibt eine Test-Audio-Ausgabe zurück
- Klicken Sie auf **"Speichern"**, um die Konfiguration zu speichern
- **Hinweis**: Der API-Key wird verschlüsselt gespeichert
- **Fallback**: Wenn ElevenLabs nicht aktiviert ist oder ein Fehler auftritt, wird automatisch die Browser-native Sprachausgabe verwendet

#### Tabellen-Spalten

Passen Sie die E-Mail-Liste an Ihre Bedürfnisse an:

- **Spalten ein-/ausblenden** – Wählen Sie, welche Informationen angezeigt werden
- **Spaltenbreite anpassen** – Ziehen Sie die Spaltenränder, um die Breite zu ändern
- **Spaltenreihenfolge ändern** – Ordnen Sie Spalten per Drag & Drop neu an
- Ihre Einstellungen werden gespeichert

#### Suchfelder

- Wählen Sie, welche Felder bei der Suche durchsucht werden sollen:
  - Betreff
  - Absender
  - E-Mail-Inhalt

### Export & Import

#### Einstellungen exportieren

- Exportieren Sie alle Ihre Einstellungen als JSON-Datei
- Erstellen Sie ein Backup Ihrer Konfiguration
- Inkludiert: Filter, Themen, Automatisierungen, Spalten-Einstellungen, Kartenreihenfolge

#### Einstellungen importieren

- Importieren Sie zuvor exportierte Einstellungen
- Validierung und Vorschau vor dem Import
- Nützlich für Migration oder Wiederherstellung

### Keyboard-Shortcuts

Beschleunigen Sie Ihre Arbeit mit Tastenkürzeln:

- **Ctrl+S** / **Cmd+S** – Einstellungen speichern
- **ESC** – Zurück zur Übersicht
- **Ctrl+K** / **Cmd+K** – Fokus auf Suchfeld
- **Ctrl+N** / **Cmd+N** – Neues Element erstellen (kontextabhängig)

### Verbesserte Benutzerfreundlichkeit

#### Elegante Benachrichtigungen

Saivaro Mail verwendet ein modernes Benachrichtigungssystem, das Ihre Arbeit nicht unterbricht:

- **Automatisches Ausblenden**: Alle Erfolgs- und Fehlermeldungen verschwinden automatisch nach wenigen Sekunden
- **Keine störenden Popups**: Keine blockierenden Dialoge mehr, die Sie bestätigen müssen
- **Nicht-blockierend**: Sie können weiterarbeiten, während Benachrichtigungen angezeigt werden
- **Visuelles Feedback**: 
  - ✅ Grüne Toasts für Erfolgsmeldungen (z.B. "Thema erfolgreich zugewiesen")
  - ❌ Rote Toasts für Fehlermeldungen
  - ⚠️ Gelbe Toasts für Warnungen
  - ℹ️ Blaue Toasts für Informationen
- **Position**: Benachrichtigungen erscheinen oben rechts und stören nicht Ihre Arbeit

**Beispiele:**
- Beim Speichern von Einstellungen erscheint eine kurze Erfolgsmeldung, die automatisch verschwindet
- Bei Workflow-Ausführungen erhalten Sie sofortiges Feedback ohne Unterbrechung
- Validierungsfehler werden als Warnungen angezeigt, ohne dass Sie einen Dialog schließen müssen

---

## ❓ Häufig gestellte Fragen

### Allgemein

**F: Wie viele E-Mail-Konten kann ich hinzufügen?**  
A: Es gibt keine Begrenzung. Sie können beliebig viele E-Mail-Konten hinzufügen.

**F: Werden meine E-Mails auf Ihren Servern gespeichert?**  
A: Ja, E-Mails werden in Ihrer eigenen, isolierten Datenbank gespeichert. Ihre Daten sind vollständig von anderen Kunden getrennt.

**F: Kann ich E-Mails auch offline lesen?**  
A: Nein, Saivaro Mail ist eine Web-Anwendung und erfordert eine Internetverbindung.

### E-Mail-Abruf

**F: Wie oft werden E-Mails abgerufen?**  
A: Standardmäßig alle 5 Minuten. Sie können das Intervall in den Einstellungen anpassen (1-1440 Minuten).

**F: Werden E-Mails doppelt abgerufen?**  
A: Nein, das System erkennt bereits abgerufene E-Mails und verhindert Duplikate.

**F: Kann ich E-Mails manuell abrufen?**  
A: Ja, verwenden Sie den "Jetzt abrufen"-Button in den Einstellungen.

### Automatisierung

**F: Wie viele Automatisierungsregeln kann ich erstellen?**  
A: Es gibt keine Begrenzung. Erstellen Sie so viele Workflows, wie Sie benötigen.

**F: Können Workflows andere Workflows auslösen?**  
A: Ja, Workflows können kaskadiert werden, um komplexe Automatisierungen zu erstellen.

**F: Was passiert, wenn eine Automatisierung fehlschlägt?**  
A: Fehler werden in den Logs protokolliert. Der Workflow stoppt nicht, sondern fährt mit den nächsten Aktionen fort.

### Abteilungen

**F: Muss ich beim Versand eine Abteilung auswählen?**  
A: Ja, die Abteilungsauswahl ist erforderlich, damit die E-Mail mit dem richtigen E-Mail-Konto versendet wird.

**F: Werden eingehende E-Mails automatisch Abteilungen zugeordnet?**  
A: Ja, basierend auf der Empfänger-Adresse werden E-Mails automatisch der richtigen Abteilung zugeordnet.

**F: Kann ich eine E-Mail mehreren Abteilungen zuweisen?**  
A: Ja, E-Mails können mehreren Abteilungen zugeordnet werden.

**F: Was ist der Unterschied zwischen Firmen- und privaten Abteilungen?**  
A: Firmen-Abteilungen (z.B. Buchhaltung, Marketing) sind für geschäftliche Zwecke gedacht. Private Abteilungen (z.B. Familie, Elternteil 1) sind für den privaten Gebrauch innerhalb einer Familie oder für einzelne Personen konzipiert.

**F: Kann ich gelöschte Standard-Abteilungen wiederherstellen?**  
A: Ja, über den Button "Fehlende Firmen-Abteilungen wiederherstellen" können Sie gelöschte Standard-Abteilungen einfach wieder hinzufügen. Ein Vorschau-Fenster zeigt Ihnen, welche Abteilungen hinzugefügt werden.

**F: Wie funktionieren E-Mail-Signaturen?**  
A: In den Einstellungen unter Abteilungen können Sie pro Abteilung eine Signatur anlegen (formatiert mit dem Rich-Text-Editor oder als reiner Text). Beim Verfassen einer neuen E-Mail oder Telefonnotiz wird die Signatur der gewählten Abteilung automatisch am Anfang des Textes eingefügt. Bei Antworten erscheint die Signatur vor dem zitierten Originaltext (mit Trennlinie dazwischen). Sie können in der Signatur Platzhalter wie {{companyName}}, {{companyAddress}} oder {{userName}} verwenden – diese werden beim Einfügen automatisch durch die Firmendaten bzw. Ihren Namen ersetzt.

### Suche & Filter

**F: Wie viele benutzerdefinierte Filter kann ich erstellen?**  
A: Es gibt keine Begrenzung. Erstellen Sie so viele Filter, wie Sie benötigen.

**F: Kann ich Filter kombinieren?**  
A: Ja, Filter können mehrere Bedingungen enthalten (UND-Verknüpfung).

**F: Werden gelöschte E-Mails in der Suche gefunden?**  
A: Ja, wenn Sie den Filter "Alle Mails" aktivieren, werden auch gelöschte E-Mails durchsucht.

### Themen

**F: Wie viele Themen kann ich erstellen?**  
A: Es gibt keine Begrenzung. Erstellen Sie so viele Themen, wie Sie benötigen.

**F: Können mehrere E-Mails gleichzeitig ein Thema zugewiesen werden?**  
A: Ja, wählen Sie mehrere E-Mails aus und weisen Sie ihnen gemeinsam ein Thema zu.

**F: Kann ich Themen löschen?**  
A: Ja, aber beachten Sie, dass E-Mails, denen dieses Thema zugewiesen war, dann kein Thema mehr haben.

### Sicherheit

**F: Wie sicher sind meine Daten?**  
A: Ihre Daten werden verschlüsselt gespeichert und sind vollständig von anderen Kunden isoliert. Jede Firma hat eine eigene Datenbank.

**F: Wer kann auf meine E-Mails zugreifen?**  
A: Nur Benutzer Ihrer Firma mit entsprechenden Berechtigungen können auf Ihre E-Mails zugreifen.

**F: Werden Passwörter verschlüsselt gespeichert?**  
A: Ja, alle Passwörter werden sicher verschlüsselt gespeichert.

### Audio-Features

**F: Wie funktioniert das Vorlesen von E-Mails?**  
A: Klicken Sie auf den "Vorlesen"-Button oberhalb des E-Mail-Headers. Der E-Mail-Inhalt wird Ihnen vorgelesen. Standardmäßig wird die Browser-native Sprachausgabe verwendet. Optional können Sie ElevenLabs für hochwertigere Stimmen konfigurieren.

**F: Was ist ElevenLabs?**  
A: ElevenLabs ist ein Dienst für hochwertige Text-to-Speech-Stimmen. Sie können einen ElevenLabs API-Key in den Einstellungen eingeben, um bessere Stimmen zu nutzen. Dies ist optional - die Browser-native Sprachausgabe funktioniert auch ohne ElevenLabs.

**F: Wie funktioniert die E-Mail-Zusammenfassung?**  
A: Klicken Sie auf den "Zusammenfassung wiedergeben"-Button. Das System generiert eine kurze Zusammenfassung der E-Mail mit künstlicher Intelligenz (OpenAI) und liest sie Ihnen vor. Die Zusammenfassung wird nur als Audio ausgegeben.

**F: Welche OpenAI-Modelle werden unterstützt?**  
A: Sie können zwischen GPT-4o-mini, GPT-3.5-turbo, GPT-4 und GPT-4 Turbo wählen. GPT-4o-mini ist am schnellsten und kostengünstigsten, GPT-4 bietet die höchste Qualität.

**F: Werden meine API-Keys sicher gespeichert?**  
A: Ja, alle API-Keys werden verschlüsselt in der Datenbank gespeichert. Nur Ihre Firma hat Zugriff auf die gespeicherten Keys.

**F: Kann ich die Audio-Features deaktivieren?**  
A: Die Audio-Features können von Ihrem Administrator im Saivaro Control Center (SCC) aktiviert oder deaktiviert werden. Wenn sie deaktiviert sind, werden die Buttons nicht angezeigt. Beide Features (Vorlesen und Zusammenfassung) werden gemeinsam aktiviert oder deaktiviert.

**F: Werden beide Audio-Features (Vorlesen und Zusammenfassung) gemeinsam aktiviert?**  
A: Ja, beide Audio-Features werden durch ein einzelnes Feature-Flag gesteuert. Wenn die Audio-Features aktiviert sind, stehen sowohl der "Vorlesen"-Button als auch der "Zusammenfassung wiedergeben"-Button zur Verfügung. Wenn sie deaktiviert sind, werden beide Buttons ausgeblendet.

**F: Wer kann die Audio-Features aktivieren oder deaktivieren?**  
A: Nur Administratoren im Saivaro Control Center (SCC) können die Audio-Features für Ihre Firma aktivieren oder deaktivieren. Dies ist eine Firmen-weite Einstellung, die für alle Benutzer Ihrer Firma gilt.

---

## 🚀 Production & Deployment

### Server-Setup

Saivaro Mail wird auf professionellen Hetzner-Servern betrieben mit:

- **Enterprise-Security**: Vollständige Härtung (SSH, Kernel, Firewall, Fail2ban)
- **SSL-Verschlüsselung**: Automatische Let's Encrypt Zertifikate
- **High Availability**: PM2 Clustering für bessere Performance
- **Zero-Downtime Updates**: Updates ohne Service-Unterbrechung
- **Automatische Backups**: Täglich verschlüsselte Datenbank-Backups
- **Monitoring**: 24/7 Überwachung mit automatischen Alerts

### Datenbank-Sicherheit

- **Isolierte Datenbanken**: Jede Firma hat eine eigene, vollständig isolierte PostgreSQL-Datenbank
- **SSL-Verbindungen**: Alle Datenbankverbindungen sind verschlüsselt
- **Verschlüsselte Backups**: Tägliche GPG-verschlüsselte Backups
- **Connection Pooling**: Optimierte Datenbankverbindungen für bessere Performance

### Performance

- **Anwendung**: Schnellere Ladezeiten und flüssigere Oberfläche – die Weboberfläche ist für große E-Mail-Listen und Konversationen optimiert (virtuelles Scrollen, effizientes Rendering).
- **PM2 Clustering**: Mehrere Instanzen für bessere CPU-Auslastung
- **NGINX Caching**: Static Assets werden gecacht für schnellere Ladezeiten
- **Gzip/Brotli Kompression**: Reduzierte Datenübertragung
- **Rate Limiting**: Schutz vor Überlastung und DDoS-Angriffen

## 📞 Support & Hilfe

### Hilfe erhalten

- **Dokumentation** – Diese Funktionsübersicht
- **Einstellungen** – Tooltips und Hilfetexte in der Anwendung
- **Support-Kontakt** – Wenden Sie sich an Ihren Administrator

### Feedback geben

Wir freuen uns über Ihr Feedback! Teilen Sie uns mit, wie wir Saivaro Mail verbessern können.

---

**Stand:** Januar 2026  
**Version:** 1.0.0+

---

*Viel Erfolg mit Saivaro Mail! 🚀*
