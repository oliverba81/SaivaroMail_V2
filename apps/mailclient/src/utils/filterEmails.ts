interface Email {
  id: string;
  subject: string;
  from: string;
  to: string[];
  date: string;
  read: boolean;
  completed?: boolean;
  deleted?: boolean;
  spam?: boolean;
  important?: boolean;
  body?: string;
  themeId?: string | null;
  theme?: {
    id: string;
    name: string;
    color: string | null;
  } | null;
  fromDepartments?: string[]; // Abteilungs-IDs des Absenders
  toDepartments?: string[]; // Abteilungs-IDs der Empfänger
  assignedDepartments?: Array<{
    id: string;
    name: string;
  }>; // Direkt zugewiesene Abteilungen
  departmentId?: string | null; // Abteilungs-ID für gesendete E-Mails (aus emails.department_id)
  department?: {
    id: string;
    name: string;
  } | null; // Abteilungs-Informationen für gesendete E-Mails
  type?: 'email' | 'phone_note'; // Typ der Nachricht
  phoneNumber?: string; // Telefonnummer für Telefonnotizen
  hasNotes?: boolean; // Mindestens ein Kommentar an der E-Mail
  hasAttachment?: boolean; // E-Mail hat mindestens einen Anhang
}

interface FilterRule {
  field: 'from' | 'to' | 'subject' | 'body' | 'status' | 'theme' | 'department' | 'completedStatus' | 'type' | 'phone_number' | 'hasNotes' | 'hasAttachments';
  operator: 'contains' | 'equals' | 'startsWith' | 'endsWith' | 'is';
  value: string; // Für completedStatus: 'all' | 'completed' | 'uncompleted', für type: 'email' | 'phone_note', für hasNotes/hasAttachments: 'yes' | 'no'
}

/**
 * Wendet Filterregeln auf eine E-Mail-Liste an
 * @param emails - Liste der E-Mails
 * @param rules - Filterregeln
 * @param userEmail - Optional: E-Mail-Adresse des aktuellen Users (für "gesendet"-Status)
 * @param forCounting - Optional: Wenn true, werden Typ-Regeln mit 'email' ignoriert, damit Telefonnotizen mitgezählt werden
 */
export function applyFilterRules(emails: Email[], rules: FilterRule[], userEmail?: string, forCounting?: boolean): Email[] {
  if (!rules || rules.length === 0) {
    return emails;
  }

  // Prüfe, ob eine completedStatus-Regel vorhanden ist
  const hasCompletedStatusRule = rules.some(rule => rule.field === 'completedStatus');

  // Pre-process: Normalisiere userEmail einmalig
  const normalizedUserEmail = userEmail ? userEmail.toLowerCase().trim() : null;

  return emails.filter((email) => {
    // Alle Regeln müssen erfüllt sein (AND-Logik)
    // Early-Exit: Wenn eine Regel fehlschlägt, breche sofort ab
    for (const rule of rules) {
      let rulePasses = false;
      // Status-Filter behandeln
      if (rule.field === 'status') {
        if (!rule.value) {
          // Kein Status ausgewählt = alle anzeigen (außer erledigte, wenn keine Status-Regel vorhanden ist)
          continue; // Regel erfüllt, weiter zur nächsten
        }
        
        // Parse den Wert als JSON-Array, falls vorhanden (mit Länge-Limit für Sicherheit)
        let selectedStatuses: string[] = [];
        try {
          if (rule.value.length > 10000) {
            throw new Error('Filter-Wert zu lang');
          }
          selectedStatuses = JSON.parse(rule.value);
          if (!Array.isArray(selectedStatuses)) {
            selectedStatuses = [selectedStatuses];
          }
        } catch {
          // Falls kein JSON, versuche als einzelnen Wert zu behandeln (für Rückwärtskompatibilität)
          if (rule.value) {
            selectedStatuses = [rule.value.toLowerCase()];
          }
        }
        
        if (selectedStatuses.length === 0) {
          // Keine Status ausgewählt = alle anzeigen (außer erledigte, wenn keine Status-Regel vorhanden ist)
          continue; // Regel erfüllt, weiter zur nächsten
        }
        
        // Pre-process: Normalisiere selectedStatuses einmalig
        const normalizedStatuses = selectedStatuses.map(s => s.toLowerCase());
        
        // Prüfe, ob die E-Mail einen der ausgewählten Status hat (OR-Logik)
        // ABER: Erledigte E-Mails müssen explizit "erledigt" im Filter haben
        if (email.completed === true) {
          // Erledigte E-Mail: Nur anzeigen, wenn "erledigt" explizit ausgewählt ist
          const hasErledigtInFilter = normalizedStatuses.includes('erledigt');
          if (!hasErledigtInFilter) {
            return false; // Early-Exit: Erledigte E-Mail ausblenden
          }
        }

        // Gesendete E-Mails (from === aktueller User): Mit anderen Statuswerten gleich behandeln,
        // damit Abteilungs-/Sachfilter für alle User dieselbe Anzahl liefern (z. B. Geschäftsführung).
        // Wenn "gesendet" im Filter ist, zählt die E-Mail wie gewohnt; wenn nicht, wird sie
        // anhand der anderen Status (gelesen/ungelesen/…) entschieden, nicht pauschal ausgeblendet.

        // Für alle E-Mails (erledigte und nicht-erledigte): Normale OR-Logik
        const statusMatch = normalizedStatuses.some((status: string) => {
          switch (status) {
            case 'ungelesen':
              return !(email.read ?? false);
            case 'gelesen':
              return email.read ?? false;
            case 'gelöscht':
              return email.deleted === true;
            case 'spam':
              return email.spam === true;
            case 'gesendet':
              // Eine E-Mail ist "gesendet", wenn from_email mit der User-E-Mail übereinstimmt
              if (!normalizedUserEmail) {
                return false; // Kann nicht bestimmt werden ohne User-E-Mail
              }
              // Verwende bereits normalisierte Werte
              const emailFromNormalized = email.from ? email.from.toLowerCase().trim() : '';
              return emailFromNormalized === normalizedUserEmail;
            default:
              return false;
          }
        });
        
        if (!statusMatch) {
          return false; // Early-Exit: Status-Regel nicht erfüllt
        }
        continue; // Regel erfüllt, weiter zur nächsten
      }

      // Erledigt-Status-Filter behandeln
      if (rule.field === 'completedStatus') {
        if (!rule.value || rule.value === 'all') {
          continue; // "Alle" = keine Filterung, weiter zur nächsten Regel
        }
        
        const completedStatus = rule.value.toLowerCase();
        switch (completedStatus) {
          case 'completed':
            rulePasses = email.completed === true;
            break;
          case 'uncompleted':
            rulePasses = email.completed !== true; // Nicht erledigt (false oder undefined)
            break;
          default:
            rulePasses = true; // Unbekannter Wert = alle anzeigen
        }
        if (!rulePasses) {
          return false; // Early-Exit: Regel nicht erfüllt
        }
        continue; // Regel erfüllt, weiter zur nächsten
      }

      // Typ-Filter behandeln (email/phone_note)
      if (rule.field === 'type') {
        if (!rule.value || rule.value.trim() === '') {
          continue; // Kein Typ ausgewählt = alle anzeigen, weiter zur nächsten Regel
        }
        // Für die Zählung: Ignoriere Typ-Regeln mit 'email', damit Telefonnotizen mitgezählt werden
        // Für die Anzeige: Respektiere die Typ-Regel normal
        const ruleValueTrimmed = rule.value.trim();
        if (forCounting && ruleValueTrimmed === 'email') {
          continue; // Bei Zählung: 'email' bedeutet E-Mails UND Telefonnotizen, weiter zur nächsten Regel
        }
        const emailType = email.type || 'email';
        if (emailType !== ruleValueTrimmed) {
          return false; // Early-Exit: Typ-Regel nicht erfüllt
        }
        continue; // Regel erfüllt, weiter zur nächsten
      }

      // Telefonnummer-Filter behandeln
      if (rule.field === 'phone_number') {
        if (!rule.value) {
          continue; // Kein Wert = alle anzeigen, weiter zur nächsten Regel
        }
        const phoneNumber = email.phoneNumber || '';
        const phoneNumberLower = phoneNumber.toLowerCase();
        const searchValue = rule.value.toLowerCase();
        
        switch (rule.operator) {
          case 'contains':
            rulePasses = phoneNumberLower.includes(searchValue);
            break;
          case 'equals':
            rulePasses = phoneNumberLower === searchValue;
            break;
          case 'startsWith':
            rulePasses = phoneNumberLower.startsWith(searchValue);
            break;
          case 'endsWith':
            rulePasses = phoneNumberLower.endsWith(searchValue);
            break;
          default:
            rulePasses = true;
        }
        if (!rulePasses) {
          return false; // Early-Exit: Regel nicht erfüllt
        }
        continue; // Regel erfüllt, weiter zur nächsten
      }

      // Kommentar-Filter behandeln (Hat Kommentare / Ohne Kommentare)
      if (rule.field === 'hasNotes') {
        if (!rule.value || (rule.value !== 'yes' && rule.value !== 'no')) {
          continue; // Kein Wert = alle anzeigen, weiter zur nächsten Regel
        }
        const emailHasNotes = email.hasNotes === true;
        rulePasses = rule.value === 'yes' ? emailHasNotes : !emailHasNotes;
        if (!rulePasses) {
          return false; // Early-Exit: Regel nicht erfüllt
        }
        continue; // Regel erfüllt, weiter zur nächsten
      }

      // Anhänge-Filter behandeln (Mit Anhängen / Ohne Anhänge)
      if (rule.field === 'hasAttachments') {
        if (!rule.value || (rule.value !== 'yes' && rule.value !== 'no')) {
          continue; // Kein Wert = alle anzeigen, weiter zur nächsten Regel
        }
        const emailHasAttachment = email.hasAttachment === true;
        rulePasses = rule.value === 'yes' ? emailHasAttachment : !emailHasAttachment;
        if (!rulePasses) {
          return false; // Early-Exit: Regel nicht erfüllt
        }
        continue; // Regel erfüllt, weiter zur nächsten
      }

      // Themen-Filter behandeln
      if (rule.field === 'theme') {
        if (!rule.value) {
          continue; // Kein Thema ausgewählt = alle anzeigen, weiter zur nächsten Regel
        }
        
        // Parse den Wert als JSON-Array, falls vorhanden (mit Länge-Limit)
        let selectedThemeIds: string[] = [];
        try {
          if (rule.value.length > 10000) {
            throw new Error('Filter-Wert zu lang');
          }
          selectedThemeIds = JSON.parse(rule.value);
          if (!Array.isArray(selectedThemeIds)) {
            selectedThemeIds = [selectedThemeIds];
          }
        } catch {
          // Falls kein JSON, versuche als einzelnen Wert zu behandeln
          if (rule.value) {
            selectedThemeIds = [rule.value];
          }
        }
        
        if (selectedThemeIds.length === 0) {
          continue; // Keine Themen ausgewählt = alle anzeigen, weiter zur nächsten Regel
        }
        
        // Prüfe, ob die E-Mail eines der ausgewählten Themen hat (OR-Logik)
        const emailThemeId = email.themeId || null;
        if (!emailThemeId) {
          return false; // Early-Exit: E-Mail hat kein Thema = nicht anzeigen
        }
        
        if (!selectedThemeIds.includes(emailThemeId)) {
          return false; // Early-Exit: Thema-Regel nicht erfüllt
        }
        continue; // Regel erfüllt, weiter zur nächsten
      }

      // Abteilungs-Filter behandeln
      if (rule.field === 'department') {
        if (!rule.value) {
          continue; // Keine Abteilung ausgewählt = alle anzeigen, weiter zur nächsten Regel
        }
        
        // Parse den Wert als JSON-Array, falls vorhanden (mit Länge-Limit)
        let selectedDepartmentIds: string[] = [];
        try {
          if (rule.value.length > 10000) {
            throw new Error('Filter-Wert zu lang');
          }
          const parsed = JSON.parse(rule.value);
          selectedDepartmentIds = Array.isArray(parsed) ? parsed : [parsed];
          // Filtere null-Werte heraus
          selectedDepartmentIds = selectedDepartmentIds.filter(id => id != null);
        } catch {
          // Falls kein JSON, versuche als einzelnen Wert zu behandeln
          if (rule.value) {
            selectedDepartmentIds = [rule.value];
          }
        }
        
        if (selectedDepartmentIds.length === 0) {
          continue; // Keine Abteilungen ausgewählt = alle anzeigen, weiter zur nächsten Regel
        }
        
        // Optimiert: Set für O(1) Lookup statt O(n*m) mit Array.includes
        const normalizeDeptId = (id: any): string => String(id || '');
        
        // Erstelle Set für E-Mail-Abteilungen (einmalig pro E-Mail)
        const emailDeptSet = new Set<string>();
        (email.fromDepartments || []).forEach(id => emailDeptSet.add(normalizeDeptId(id)));
        (email.toDepartments || []).forEach(id => emailDeptSet.add(normalizeDeptId(id)));
        (email.assignedDepartments || []).forEach((d: any) => {
          emailDeptSet.add(normalizeDeptId(typeof d === 'string' ? d : d.id));
        });
        if (email.departmentId) {
          emailDeptSet.add(normalizeDeptId(email.departmentId));
        }
        
        // Konvertiere selectedDepartmentIds zu Strings für Vergleich
        const selectedDeptIdsAsStrings = selectedDepartmentIds.map(id => String(id));
        
        // Prüfe, ob mindestens eine der E-Mail-Abteilungen in den ausgewählten Abteilungen ist (O(1) Lookup)
        rulePasses = selectedDeptIdsAsStrings.some(deptId => emailDeptSet.has(deptId));
        if (!rulePasses) {
          return false; // Early-Exit: Abteilungs-Regel nicht erfüllt
        }
        continue; // Regel erfüllt, weiter zur nächsten
      }

      // Text-Filter behandeln
      let fieldValue = '';
      switch (rule.field) {
        case 'from':
          fieldValue = email.from || '';
          break;
        case 'to':
          fieldValue = Array.isArray(email.to) ? email.to.join(', ') : (email.to || '');
          break;
        case 'subject':
          fieldValue = email.subject || '';
          break;
        case 'body':
          fieldValue = email.body || '';
          break;
        default:
          continue; // Unbekanntes Feld, weiter zur nächsten Regel
      }

      // Pre-process: Normalisiere Werte einmalig
      const searchValue = rule.value ? rule.value.toLowerCase() : '';
      const fieldValueLower = fieldValue.toLowerCase();

      switch (rule.operator) {
        case 'contains':
          rulePasses = fieldValueLower.includes(searchValue);
          break;
        case 'equals':
          rulePasses = fieldValueLower === searchValue;
          break;
        case 'startsWith':
          rulePasses = fieldValueLower.startsWith(searchValue);
          break;
        case 'endsWith':
          rulePasses = fieldValueLower.endsWith(searchValue);
          break;
        case 'is':
          // Für Status-Filter, aber sollte bereits oben behandelt werden
          rulePasses = true;
          break;
        default:
          rulePasses = true;
      }
      
      if (!rulePasses) {
        return false; // Early-Exit: Text-Regel nicht erfüllt
      }
      // Regel erfüllt, weiter zur nächsten Regel
    }

    // Wenn keine completedStatus-Regel vorhanden ist, dann erledigte E-Mails ausblenden (Standard-Verhalten)
    if (!hasCompletedStatusRule) {
      if (email.completed === true) {
        return false; // Erledigte E-Mails ausblenden, wenn keine completedStatus-Regel vorhanden ist
      }
    }

    return true;
  });
}

