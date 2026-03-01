/**
 * Migrations-Script für Ticket-IDs
 * 
 * Weist allen bestehenden E-Mails ohne Ticket-ID eine neue ID zu.
 * Verarbeitet E-Mails in Batches für Performance und Stabilität.
 * 
 * Features:
 * - Batch-Verarbeitung (100 E-Mails pro Batch)
 * - Progress-Callbacks für UI-Updates
 * - Transaktionssicherheit
 * - Fehlerbehandlung & Rollback
 * - Extrahierung bestehender IDs aus Betreff
 */

import { getTenantDbClient } from './tenant-db-client';
import { assignOrReuseTicketId } from './ticket-id-generator';

export interface MigrationProgress {
  totalEmails: number;
  processedEmails: number;
  currentBatch: number;
  totalBatches: number;
  assignedIds: number;
  reusedIds: number;
  errors: number;
  status: 'running' | 'completed' | 'failed';
  currentEmailId?: string;
  errorMessage?: string;
}

export interface MigrationOptions {
  batchSize?: number;
  onProgress?: (progress: MigrationProgress) => void | Promise<void>;
  dryRun?: boolean;
}

export interface MigrationResult {
  success: boolean;
  totalProcessed: number;
  assignedIds: number;
  reusedIds: number;
  errors: number;
  errorDetails?: Array<{
    emailId: string;
    error: string;
  }>;
}

/**
 * Migriert alle E-Mails einer Company
 * 
 * @param companyId - Company UUID
 * @param options - Migrations-Optionen
 * @returns Migrations-Ergebnis
 * 
 * @example
 * const result = await migrateTicketIdsForCompany(companyId, {
 *   batchSize: 100,
 *   onProgress: async (progress) => {
 *     console.log(`Progress: ${progress.processedEmails}/${progress.totalEmails}`);
 *   }
 * });
 */
export async function migrateTicketIdsForCompany(
  companyId: string,
  options: MigrationOptions = {}
): Promise<MigrationResult> {
  const { batchSize = 100, onProgress, dryRun = false } = options;
  
  const client = await getTenantDbClient(companyId);
  
  const result: MigrationResult = {
    success: false,
    totalProcessed: 0,
    assignedIds: 0,
    reusedIds: 0,
    errors: 0,
    errorDetails: [],
  };
  
  try {
    // 1. Zähle E-Mails ohne Ticket-ID
    const countResult = await client.query(
      `SELECT COUNT(*) as count FROM emails WHERE ticket_id IS NULL AND company_id = $1`,
      [companyId]
    );
    
    const totalEmails = parseInt(countResult.rows[0]?.count || '0');
    
    if (totalEmails === 0) {
      console.log(`✅ Keine E-Mails zur Migration gefunden für Company ${companyId}`);
      result.success = true;
      return result;
    }
    
    console.log(`📊 Migration starten: ${totalEmails} E-Mails für Company ${companyId}`);
    
    const totalBatches = Math.ceil(totalEmails / batchSize);
    let processedEmails = 0;
    let currentBatch = 0;
    
    // 2. Verarbeite E-Mails in Batches
    while (processedEmails < totalEmails) {
      currentBatch++;
      
      // Lade nächsten Batch
      const emailsResult = await client.query(
        `SELECT id, subject, created_at 
         FROM emails 
         WHERE ticket_id IS NULL AND company_id = $1 
         ORDER BY created_at ASC 
         LIMIT $2`,
        [companyId, batchSize]
      );
      
      const emails = emailsResult.rows;
      
      if (emails.length === 0) break; // Keine weiteren E-Mails
      
      // Verarbeite Batch
      for (const email of emails) {
        try {
          if (!dryRun) {
            // Starte Transaktion für diese E-Mail
            await client.query('BEGIN');
            
            try {
              // Generiere oder extrahiere Ticket-ID
              const { ticketId, wasReused } = await assignOrReuseTicketId(
                client,
                companyId,
                email.subject || ''
              );
              
              // Update E-Mail mit Ticket-ID
              await client.query(
                `UPDATE emails 
                 SET ticket_id = $1 
                 WHERE id = $2`,
                [ticketId, email.id]
              );
              
              // Commit Transaktion
              await client.query('COMMIT');
              
              // Statistiken aktualisieren
              if (wasReused) {
                result.reusedIds++;
              } else {
                result.assignedIds++;
              }
              
              console.log(
                `${wasReused ? '♻️' : '✅'} ${email.id}: ${ticketId} ${wasReused ? '(wiederverwendet)' : '(neu generiert)'}`
              );
            } catch (error: any) {
              // Rollback bei Fehler
              await client.query('ROLLBACK');
              throw error;
            }
          } else {
            // Dry Run: Nur simulieren
            result.assignedIds++;
            console.log(`🔍 [DRY RUN] ${email.id}: Würde Ticket-ID zuweisen`);
          }
          
          processedEmails++;
          result.totalProcessed++;
          
          // Progress-Callback
          if (onProgress) {
            const progress: MigrationProgress = {
              totalEmails,
              processedEmails,
              currentBatch,
              totalBatches,
              assignedIds: result.assignedIds,
              reusedIds: result.reusedIds,
              errors: result.errors,
              status: 'running',
              currentEmailId: email.id,
            };
            
            await onProgress(progress);
          }
        } catch (error: any) {
          result.errors++;
          const errorDetail = {
            emailId: email.id,
            error: error.message || 'Unbekannter Fehler',
          };
          result.errorDetails?.push(errorDetail);
          
          console.error(`❌ Fehler bei E-Mail ${email.id}:`, error);
          
          // Weiter mit nächster E-Mail (nicht abbrechen)
        }
      }
      
      // Kurze Pause zwischen Batches (vermeidet DB-Überlastung)
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // 3. Finale Progress-Callback
    if (onProgress) {
      const finalProgress: MigrationProgress = {
        totalEmails,
        processedEmails,
        currentBatch: totalBatches,
        totalBatches,
        assignedIds: result.assignedIds,
        reusedIds: result.reusedIds,
        errors: result.errors,
        status: result.errors === 0 ? 'completed' : 'completed',
      };
      
      await onProgress(finalProgress);
    }
    
    result.success = result.errors < totalEmails;
    
    console.log(`✅ Migration abgeschlossen für Company ${companyId}`);
    console.log(`   Verarbeitet: ${result.totalProcessed}`);
    console.log(`   Neu zugewiesen: ${result.assignedIds}`);
    console.log(`   Wiederverwendet: ${result.reusedIds}`);
    console.log(`   Fehler: ${result.errors}`);
    
    return result;
  } catch (error: any) {
    console.error(`❌ Migration fehlgeschlagen für Company ${companyId}:`, error);
    result.success = false;
    result.errorDetails = [{ emailId: 'global', error: error.message }];
    
    // Finale Error-Callback
    if (onProgress) {
      const errorProgress: MigrationProgress = {
        totalEmails: result.totalProcessed,
        processedEmails: result.totalProcessed,
        currentBatch: 0,
        totalBatches: 0,
        assignedIds: result.assignedIds,
        reusedIds: result.reusedIds,
        errors: result.errors,
        status: 'failed',
        errorMessage: error.message,
      };
      
      await onProgress(errorProgress);
    }
    
    return result;
  } finally {
    client.release();
  }
}

/**
 * Migriert E-Mails für alle Companies
 * 
 * WARNUNG: Diese Funktion sollte nur vom Admin ausgeführt werden!
 * 
 * @param onProgress - Optional Progress-Callback
 * @returns Array mit Ergebnissen pro Company
 */
export async function migrateAllCompanies(
  _onProgress?: (companyId: string, progress: MigrationProgress) => void | Promise<void>
): Promise<Record<string, MigrationResult>> {
  await import('./scc-client'); // für zukünftige Nutzung von getCompanyDbClient

  // TODO: Lade alle Company-IDs aus SCC
  // Für jetzt: Placeholder
  console.warn('⚠️ migrateAllCompanies: Funktion nicht vollständig implementiert');
  console.warn('⚠️ Verwende stattdessen migrateTicketIdsForCompany pro Company');
  
  return {};
}
