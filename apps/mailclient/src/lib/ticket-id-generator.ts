/**
 * Ticket-ID Generator für E-Mail-System
 * 
 * Format: M + JJMMTT + 5-stelliger Zähler (z.B. M26011800001)
 * - M: Prefix für E-Mail-Nachrichten
 * - JJMMTT: Jahr (2 Stellen), Monat, Tag
 * - 5-stelliger Zähler: Täglicher Counter (00001-99999)
 * 
 * Features:
 * - Atomare Zählererhöhung (Thread-safe)
 * - Automatische Extraktion aus E-Mail-Betreff
 * - Wiederverwendung bei Antworten/Forwards
 * - Format-Validierung
 */

import { PoolClient } from 'pg';

/**
 * Regex-Pattern für Ticket-ID Erkennung
 * Format: [M + 11 Ziffern]
 */
const TICKET_ID_PATTERN = /\[M\d{11}\]/g;
const TICKET_ID_FORMAT = /^M\d{11}$/;

/**
 * Extrahiert Ticket-ID aus E-Mail-Betreff
 * 
 * @param subject - E-Mail-Betreff
 * @returns Ticket-ID (ohne eckige Klammern) oder null
 * 
 * @example
 * extractTicketIdFromSubject("Re: Anfrage [M26011800001]") // => "M26011800001"
 * extractTicketIdFromSubject("Neue Anfrage") // => null
 */
export function extractTicketIdFromSubject(subject: string): string | null {
  if (!subject) return null;
  
  const matches = subject.match(TICKET_ID_PATTERN);
  if (!matches || matches.length === 0) return null;
  
  // Nehme die LETZTE Ticket-ID (neueste bei mehrfachen Forwards)
  const lastMatch = matches[matches.length - 1];
  
  // Entferne eckige Klammern
  return lastMatch.slice(1, -1);
}

/**
 * Validiert Ticket-ID Format
 * 
 * @param ticketId - Zu prüfende Ticket-ID
 * @returns true wenn Format korrekt (M + 11 Ziffern)
 * 
 * @example
 * isValidTicketId("M26011800001") // => true
 * isValidTicketId("M2601180000") // => false (zu kurz)
 * isValidTicketId("X26011800001") // => false (falscher Prefix)
 */
export function isValidTicketId(ticketId: string): boolean {
  return TICKET_ID_FORMAT.test(ticketId);
}

/**
 * Generiert neue Ticket-ID mit atomarer Zählererhöhung
 * 
 * Verwendet Row-Level-Locking (SELECT FOR UPDATE) für Thread-Safety.
 * Der Counter wird täglich zurückgesetzt.
 * 
 * @param client - PostgreSQL Client (MUSS in Transaktion sein!)
 * @param companyId - Company UUID
 * @returns Neue Ticket-ID (z.B. "M26011800001")
 * 
 * @throws Error wenn Counter-Limit erreicht (99999)
 * @throws Error bei Datenbankfehlern
 * 
 * @example
 * const client = await pool.connect();
 * try {
 *   await client.query('BEGIN');
 *   const ticketId = await generateTicketId(client, companyId);
 *   await client.query('COMMIT');
 * } catch (err) {
 *   await client.query('ROLLBACK');
 *   throw err;
 * } finally {
 *   client.release();
 * }
 */
export async function generateTicketId(
  client: PoolClient,
  companyId: string
): Promise<string> {
  try {
    // Aktuelles Datum (YYYY-MM-DD)
    const today = new Date().toISOString().split('T')[0];
    
    // Datumsteile extrahieren (Jahr, Monat, Tag)
    const [year, month, day] = today.split('-');
    const yearShort = year.slice(-2); // Letzte 2 Stellen des Jahres
    
    // Versuche bestehenden Counter zu laden und zu erhöhen (mit Row-Lock)
    const updateResult = await client.query(
      `
      UPDATE email_ticket_counters 
      SET counter = counter + 1,
          updated_at = NOW()
      WHERE company_id = $1 AND date = $2
      RETURNING counter;
      `,
      [companyId, today]
    );
    
    let counter: number;
    
    if (updateResult.rows.length > 0) {
      // Counter existiert, wurde erhöht
      counter = updateResult.rows[0].counter;
    } else {
      // Kein Counter für heute, erstelle neuen (startet bei 1)
      try {
        const insertResult = await client.query(
          `
          INSERT INTO email_ticket_counters (company_id, date, counter)
          VALUES ($1, $2, 1)
          ON CONFLICT (company_id, date) DO UPDATE
          SET counter = email_ticket_counters.counter + 1,
              updated_at = NOW()
          RETURNING counter;
          `,
          [companyId, today]
        );
        counter = insertResult.rows[0].counter;
      } catch (error: any) {
        // Race Condition: Anderer Prozess hat Counter gleichzeitig erstellt
        // Versuche nochmal zu erhöhen
        const retryResult = await client.query(
          `
          UPDATE email_ticket_counters 
          SET counter = counter + 1,
              updated_at = NOW()
          WHERE company_id = $1 AND date = $2
          RETURNING counter;
          `,
          [companyId, today]
        );
        
        if (retryResult.rows.length === 0) {
          throw new Error('Failed to generate ticket ID: Counter race condition');
        }
        counter = retryResult.rows[0].counter;
      }
    }
    
    // Prüfe Counter-Limit (max 99999)
    if (counter > 99999) {
      throw new Error(
        `Ticket-ID Counter limit reached for ${today}. ` +
        `Maximum 99999 tickets per day per company.`
      );
    }
    
    // Formatiere Counter mit Leading Zeros (5 Stellen)
    const counterStr = counter.toString().padStart(5, '0');
    
    // Generiere Ticket-ID: M + JJMMTT + 5-stelliger Counter
    const ticketId = `M${yearShort}${month}${day}${counterStr}`;
    
    console.log(`✅ Ticket-ID generiert: ${ticketId} für Company ${companyId}`);
    
    return ticketId;
  } catch (error: any) {
    console.error(`❌ Fehler bei Ticket-ID Generierung:`, error);
    throw error;
  }
}

/**
 * Weist einer E-Mail eine Ticket-ID zu oder verwendet existierende
 * 
 * Workflow:
 * 1. Extrahiere Ticket-ID aus Betreff (falls vorhanden)
 * 2. Validiere und prüfe ob ID in DB existiert
 * 3. Falls ja: Wiederverwende (wasReused = true)
 * 4. Falls nein: Generiere neue ID (wasReused = false)
 * 
 * @param client - PostgreSQL Client (MUSS in Transaktion sein!)
 * @param companyId - Company UUID
 * @param subject - E-Mail-Betreff
 * @param options - Optionale Konfiguration
 * @returns { ticketId, wasReused } - Ticket-ID und ob wiederverwendet
 * 
 * @example
 * // Neue E-Mail ohne Ticket-ID
 * const result1 = await assignOrReuseTicketId(client, companyId, "Neue Anfrage");
 * // => { ticketId: "M26011800001", wasReused: false }
 * 
 * // Antwort mit Ticket-ID im Betreff
 * const result2 = await assignOrReuseTicketId(
 *   client, 
 *   companyId, 
 *   "Re: Anfrage [M26011800001]"
 * );
 * // => { ticketId: "M26011800001", wasReused: true }
 */
export async function assignOrReuseTicketId(
  client: PoolClient,
  companyId: string,
  subject: string,
  options?: {
    /**
     * Erlaubt Wiederverwendung unbekannter Ticket-IDs
     * (Standard: false - unbekannte IDs werden durch neue ersetzt)
     */
    acceptUnknownTicketIds?: boolean;
  }
): Promise<{ ticketId: string; wasReused: boolean }> {
  const { acceptUnknownTicketIds = false } = options || {};
  
  try {
    // 1. Versuche Ticket-ID aus Betreff zu extrahieren
    const extractedTicketId = extractTicketIdFromSubject(subject);
    
    if (extractedTicketId) {
      // Validiere Format
      if (!isValidTicketId(extractedTicketId)) {
        console.warn(
          `⚠️ Ungültiges Ticket-ID Format im Betreff: ${extractedTicketId}`
        );
        // Generiere neue ID
        const newTicketId = await generateTicketId(client, companyId);
        return { ticketId: newTicketId, wasReused: false };
      }
      
      // 2. Prüfe, ob Ticket-ID in DB existiert (für diese Company)
      const existingTicket = await client.query(
        `
        SELECT ticket_id 
        FROM emails 
        WHERE ticket_id = $1 AND company_id = $2 
        LIMIT 1;
        `,
        [extractedTicketId, companyId]
      );
      
      if (existingTicket.rows.length > 0) {
        // Ticket-ID existiert in DB → Wiederverwenden
        console.log(
          `♻️ Ticket-ID wiederverwendet: ${extractedTicketId} für Company ${companyId}`
        );
        return { ticketId: extractedTicketId, wasReused: true };
      }
      
      // Ticket-ID existiert NICHT in DB
      if (acceptUnknownTicketIds) {
        // Trotzdem verwenden (z.B. bei manueller Zuordnung)
        console.log(
          `🆕 Unbekannte Ticket-ID akzeptiert: ${extractedTicketId} für Company ${companyId}`
        );
        return { ticketId: extractedTicketId, wasReused: false };
      } else {
        // Generiere neue ID (Sicherheit: unbekannte IDs nicht vertrauen)
        console.warn(
          `⚠️ Ticket-ID im Betreff nicht in DB gefunden: ${extractedTicketId}. ` +
          `Generiere neue ID.`
        );
        const newTicketId = await generateTicketId(client, companyId);
        return { ticketId: newTicketId, wasReused: false };
      }
    }
    
    // 3. Keine Ticket-ID im Betreff → Generiere neue
    const newTicketId = await generateTicketId(client, companyId);
    return { ticketId: newTicketId, wasReused: false };
    
  } catch (error: any) {
    console.error(`❌ Fehler bei Ticket-ID Zuweisung:`, error);
    throw error;
  }
}

/**
 * Fügt Ticket-ID zum E-Mail-Betreff hinzu (für Reply/Forward)
 * 
 * @param subject - Ursprünglicher Betreff
 * @param ticketId - Anzuhängende Ticket-ID
 * @returns Betreff mit Ticket-ID in eckigen Klammern
 * 
 * @example
 * addTicketIdToSubject("Re: Anfrage", "M26011800001")
 * // => "Re: Anfrage [M26011800001]"
 * 
 * addTicketIdToSubject("Re: Anfrage [M26011800001]", "M26011800001")
 * // => "Re: Anfrage [M26011800001]" (keine Duplikate)
 */
export function addTicketIdToSubject(subject: string, ticketId: string): string {
  if (!subject) return `[${ticketId}]`;
  
  // Prüfe, ob Ticket-ID bereits im Betreff enthalten ist
  const existingTicketId = extractTicketIdFromSubject(subject);
  if (existingTicketId === ticketId) {
    return subject; // Ticket-ID bereits vorhanden
  }
  
  // Entferne alte Ticket-IDs (falls vorhanden)
  const subjectWithoutTicketIds = subject.replace(TICKET_ID_PATTERN, '').trim();
  
  // Füge neue Ticket-ID am Ende hinzu
  return `${subjectWithoutTicketIds} [${ticketId}]`;
}
