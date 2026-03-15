/**
 * E-Mail-Abruf-Service: Ruft E-Mails von aktiven IMAP-Konten ab
 * E-Mails werden als Kopie in der DB gespeichert, Original bleibt auf Server
 */

import Imap from 'imap';
import { simpleParser } from 'mailparser';
import { getTenantDbClient } from './tenant-db-client';
import { writeFile, mkdir } from 'fs/promises';
import { join, extname, basename } from 'path';
import { Readable } from 'stream';
import { Buffer } from 'buffer';
import { existsSync } from 'fs';
import { assignOrReuseTicketId } from './ticket-id-generator';

/** No-op nach Entfernung der Debug-Instrumentierung; Aufrufe bleiben für Kompatibilität. */
async function debugLog(_data: unknown): Promise<void> {}

/**
 * Formatiert Bytes in lesbares Format
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Konvertiert einen Stream oder Buffer zu einem Buffer
 * Mailparser gibt attachment.content manchmal als Stream, manchmal als Buffer zurück
 */
async function attachmentContentToBuffer(content: any): Promise<Buffer> {
  // Wenn bereits ein Buffer, direkt zurückgeben
  if (Buffer.isBuffer(content)) {
    return content;
  }

  // Wenn es null oder undefined ist
  if (content == null) {
    throw new Error('Attachment content ist null oder undefined');
  }

  // Wenn es ein Stream ist (Readable) - prüfe auf Stream-Methoden
  if (content && typeof content.pipe === 'function' && typeof content.on === 'function') {
    const chunks: Buffer[] = [];
    try {
      for await (const chunk of content as Readable) {
        if (Buffer.isBuffer(chunk)) {
          chunks.push(chunk);
        } else if (typeof chunk === 'string') {
          chunks.push(Buffer.from(chunk, 'utf8'));
        } else if (chunk instanceof Uint8Array) {
          chunks.push(Buffer.from(chunk));
        } else if (Array.isArray(chunk)) {
          chunks.push(Buffer.from(chunk));
        } else if (typeof chunk === 'number') {
          // Einzelne Bytes als Zahlen - konvertiere zu Buffer
          if (chunk >= 0 && chunk <= 255) {
            chunks.push(Buffer.from([chunk]));
          } else {
            console.warn(`[EmailFetcher] Warnung: Ungültiger Byte-Wert (${chunk}), wird übersprungen`);
            continue;
          }
        } else {
          // Versuche es als Buffer zu konvertieren
          try {
            chunks.push(Buffer.from(chunk as any));
          } catch (err) {
            console.warn(`[EmailFetcher] Unbekannter Chunk-Typ beim Konvertieren:`, typeof chunk);
            continue;
          }
        }
      }
      if (chunks.length === 0) {
        throw new Error('Stream lieferte keine Daten');
      }
      return Buffer.concat(chunks);
    } catch (error: any) {
      if (error.message && error.message.includes('Stream')) {
        throw error;
      }
      throw new Error(`Fehler beim Lesen des Streams: ${error.message}`);
    }
  }

  // Wenn es ein String ist
  if (typeof content === 'string') {
    return Buffer.from(content, 'utf8');
  }

  // Wenn es ein Uint8Array oder Array ist
  if (content instanceof Uint8Array || Array.isArray(content)) {
    return Buffer.from(content);
  }

  // Wenn es eine primitive Zahl ist (sollte nicht vorkommen, aber für Sicherheit)
  if (typeof content === 'number') {
    throw new Error(`Attachment content ist eine Zahl (${content}), erwartet Stream oder Buffer`);
  }

  // Fallback: Versuche es als Buffer zu konvertieren
  try {
    return Buffer.from(content);
  } catch (error: any) {
    throw new Error(`Unbekannter Content-Typ: ${typeof content}. Kann nicht zu Buffer konvertiert werden. Fehler: ${error.message}`);
  }
}

/**
 * Invalidiert den Storage-Cache im SCC (asynchron, nicht blockierend)
 */
async function invalidateStorageCache(companyId: string): Promise<void> {
  try {
    const sccApiUrl = process.env.SCC_API_URL || 'http://localhost:3001/api';
    const sccApiToken = process.env.SCC_API_TOKEN || '';
    
    // Wenn kein Token gesetzt ist, versuche es trotzdem (SCC könnte Token optional machen)
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    if (sccApiToken) {
      headers['Authorization'] = `Bearer ${sccApiToken}`;
    }
    
    const response = await fetch(`${sccApiUrl}/companies/${companyId}/storage-usage/invalidate-cache`, {
      method: 'POST',
      headers,
    });

    if (!response.ok) {
      if (response.status === 401) {
        // Authentifizierung fehlgeschlagen - nur in Development loggen
        if (process.env.NODE_ENV === 'development') {
          console.warn(`[EmailFetcher] SCC-API-Authentifizierung fehlgeschlagen beim Invalidieren des Storage-Caches (Token fehlt oder ungültig)`);
        }
      } else if (response.status === 404) {
        // Company nicht gefunden - nicht kritisch
        if (process.env.NODE_ENV === 'development') {
          console.warn(`[EmailFetcher] Company ${companyId} nicht in SCC gefunden`);
        }
      } else {
        console.warn(`[EmailFetcher] SCC-API Fehler beim Invalidieren des Storage-Caches: ${response.status} ${response.statusText}`);
      }
    } else {
      if (process.env.NODE_ENV === 'development') {
        console.log(`[EmailFetcher] Storage-Cache für Company ${companyId} erfolgreich invalidiert`);
      }
    }
  } catch (error: any) {
    // Fehler beim Invalidieren des Caches ist nicht kritisch, nur in Development loggen
    if (process.env.NODE_ENV === 'development') {
      console.warn(`[EmailFetcher] Fehler beim Invalidieren des Storage-Caches:`, error.message);
    }
  }
}

interface EmailAccount {
  id: string;
  userId: string;
  imapHost: string;
  imapPort: number;
  imapUsername: string;
  imapPassword: string;
  imapSsl: boolean;
  imapTls?: boolean;
  imapFolder?: string;
  email: string;
}

interface FetchedEmail {
  subject: string;
  from: string;
  to: string[];
  body: string;
  date: Date;
  uid: number;
  hasAttachment: boolean;
  attachments?: Array<{
    filename: string;
    contentType: string;
    size: number;
    content: Buffer;
  }>;
}

/**
 * Ruft E-Mails von einem IMAP-Konto ab
 */
export async function fetchEmailsFromAccount(
  account: EmailAccount,
  companyId: string
): Promise<{ success: boolean; count: number; error?: string }> {
  // #region agent log
  debugLog({location:'email-fetcher.ts:59',message:'fetchEmailsFromAccount gestartet',data:{accountId:account.id,email:account.email,companyId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'});
  // #endregion
  return new Promise((resolve) => {
    let fetchedEmails: FetchedEmail[] = [];
    let resolved = false;

    const imap = new Imap({
      user: account.imapUsername,
      password: account.imapPassword,
      host: account.imapHost,
      port: account.imapPort,
      tls: account.imapSsl, // SSL: verschlüsselte Verbindung von Anfang an
      tlsOptions: { rejectUnauthorized: false },
      connTimeout: 30000,
      authTimeout: 30000,
      keepalive: true, // Halte Verbindung aktiv für große E-Mails
    });

    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        imap.end();
        resolve({
          success: false,
          count: 0,
          error: 'IMAP-Verbindungstimeout',
        });
      }
    }, 300000); // 5 Minuten Timeout (für große E-Mails mit Anhängen)

    // STARTTLS-Handling: Wenn STARTTLS gewählt wurde, aber nicht SSL
    if (account.imapTls && !account.imapSsl) {
      imap.once('connect', () => {
        // @ts-expect-error - starttls existiert in der imap-Bibliothek, aber nicht in den Typen
        imap.starttls((err: Error | null) => {
          if (err) {
            if (!resolved) {
              resolved = true;
              clearTimeout(timeout);
              imap.end();
              resolve({
                success: false,
                count: 0,
                error: `IMAP STARTTLS-Fehler: ${err.message}`,
              });
            }
          }
        });
      });
    }

    imap.once('ready', () => {
      // #region agent log
      debugLog({location:'email-fetcher.ts:122',message:'IMAP ready',data:{accountId:account.id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'});
      // #endregion
      const folder = account.imapFolder || 'INBOX';
      imap.openBox(folder, false, (err, box) => {
        if (err) {
          // #region agent log
          debugLog({location:'email-fetcher.ts:125',message:'Fehler beim Öffnen des Posteingangs',data:{accountId:account.id,error:err.message,folder},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'});
          // #endregion
          if (!resolved) {
            resolved = true;
            clearTimeout(timeout);
            imap.end();
            resolve({
              success: false,
              count: 0,
              error: `Fehler beim Öffnen des Posteingangs: ${err.message}`,
            });
          }
          return;
        }

        // #region agent log
        debugLog({location:'email-fetcher.ts:139',message:'Posteingang geöffnet',data:{accountId:account.id,folder,boxMessages:box?.messages},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'});
        // #endregion

        // Suche nach allen E-Mails im Ordner (UID-basierte Duplikatsprüfung)
        imap.search(['ALL'], (err, results) => {
          if (err) {
            // #region agent log
            debugLog({location:'email-fetcher.ts:140',message:'Fehler bei der E-Mail-Suche',data:{accountId:account.id,error:err.message},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'});
            // #endregion
            if (!resolved) {
              resolved = true;
              clearTimeout(timeout);
              imap.end();
              resolve({
                success: false,
                count: 0,
                error: `Fehler bei der E-Mail-Suche: ${err.message}`,
              });
            }
            return;
          }

          // #region agent log
          debugLog({location:'email-fetcher.ts:155',message:'E-Mail-Suche abgeschlossen',data:{accountId:account.id,resultCount:results?.length||0},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'});
          // #endregion

          if (!results || results.length === 0) {
            // #region agent log
            debugLog({location:'email-fetcher.ts:155',message:'Keine E-Mails gefunden',data:{accountId:account.id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'});
            // #endregion
            if (!resolved) {
              resolved = true;
              clearTimeout(timeout);
              imap.end();
              resolve({
                success: true,
                count: 0,
              });
            }
            return;
          }

          // Lade alle E-Mails (UID-basierte Duplikatsprüfung)
          // Verwende 'RFC822' um die vollständige E-Mail-Nachricht zu laden (inkl. Anhänge)
          // #region agent log
          debugLog({location:'email-fetcher.ts:170',message:'Starte E-Mail-Fetch',data:{accountId:account.id,totalEmails:results.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'});
          // #endregion
          
          let emailCount = 0;
          const totalEmails = results.length;
          const uidMap = new Map<number, Buffer>(); // UID -> Buffer
          const failedUids = new Set<number>(); // UIDs die fehlgeschlagen sind

          // Fallback: Rufe E-Mails einzeln ab, wenn Batch-Fetch fehlschlägt
          const fetchEmailsIndividually = () => {
            console.log(`[IMAP] Starte individuellen E-Mail-Abruf für ${results.length} E-Mails`);
            let processedCount = 0;

            const processNextEmail = (index: number) => {
              if (index >= results.length) {
                // Alle E-Mails wurden verarbeitet
                if (uidMap.size > 0) {
                  processEmails();
                } else {
                  // Keine E-Mail konnte abgerufen werden
                  if (!resolved) {
                    resolved = true;
                    clearTimeout(timeout);
                    imap.end();
                    resolve({
                      success: false,
                      count: 0,
                      error: 'Fehler beim Abrufen: Keine E-Mails konnten geladen werden',
                    });
                  }
                }
                return;
              }

              const uid = results[index];
              try {
                const fetch = imap.fetch(uid, {
                  bodies: '', // Leerer String = vollständige Nachricht
                  struct: true,
                });

                const chunks: Buffer[] = [];
                let msgUid: number | null = null;

                fetch.on('message', (msg) => {
                  msg.on('attributes', (attrs) => {
                    if (attrs.uid) {
                      msgUid = attrs.uid;
                    }
                  });

                  msg.on('body', (stream) => {
                    stream.on('data', (chunk) => {
                      if (Buffer.isBuffer(chunk)) {
                        chunks.push(chunk);
                      } else {
                        chunks.push(Buffer.from(chunk));
                      }
                    });
                  });

                  msg.once('end', () => {
                    if (msgUid !== null && chunks.length > 0) {
                      const buffer = Buffer.concat(chunks);
                      uidMap.set(msgUid, buffer);
                    }
                    processedCount++;
                    if (processedCount === results.length) {
                      if (uidMap.size > 0) {
                        processEmails();
                      } else {
                        if (!resolved) {
                          resolved = true;
                          clearTimeout(timeout);
                          imap.end();
                          resolve({
                            success: false,
                            count: 0,
                            error: 'Fehler beim Abrufen: Keine E-Mails konnten geladen werden',
                          });
                        }
                      }
                    } else {
                      // Verarbeite nächste E-Mail
                      processNextEmail(index + 1);
                    }
                  });
                });

                fetch.once('error', (err) => {
                  console.warn(`[IMAP] Fehler beim Abrufen von E-Mail ${uid}: ${err.message}`);
                  failedUids.add(uid);
                  processedCount++;
                  if (processedCount === results.length) {
                    if (uidMap.size > 0) {
                      processEmails();
                    } else {
                      if (!resolved) {
                        resolved = true;
                        clearTimeout(timeout);
                        imap.end();
                        resolve({
                          success: false,
                          count: 0,
                          error: `Fehler beim Abrufen: ${err.message}`,
                        });
                      }
                    }
                  } else {
                    // Verarbeite nächste E-Mail
                    processNextEmail(index + 1);
                  }
                });
              } catch (err: any) {
                console.warn(`[IMAP] Fehler beim Erstellen des Fetch für E-Mail ${uid}: ${err.message}`);
                failedUids.add(uid);
                processedCount++;
                if (processedCount === results.length) {
                  if (uidMap.size > 0) {
                    processEmails();
                  } else {
                    if (!resolved) {
                      resolved = true;
                      clearTimeout(timeout);
                      imap.end();
                      resolve({
                        success: false,
                        count: 0,
                        error: `Fehler beim Abrufen: ${err.message}`,
                      });
                    }
                  }
                } else {
                  processNextEmail(index + 1);
                }
              }
            };

            // Starte mit der ersten E-Mail
            processNextEmail(0);
          };

          try {
            const fetch = imap.fetch(results, {
              bodies: '', // Leerer String = BODY.PEEK[] = vollständige Nachricht (RFC 3501); 'RFC822' ist kein gültiger BODY-Abschnitt
              struct: true,
            });

            fetch.on('error', (err) => {
              // #region agent log
              debugLog({location:'email-fetcher.ts:fetch-error',message:'Fetch-Fehler',data:{accountId:account.id,error:err.message},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'});
              // #endregion
              console.warn(`[IMAP] Batch-Fetch-Fehler: ${err.message}. Versuche E-Mails einzeln abzurufen...`);
              // Wenn keine E-Mail geladen wurde, versuche einzeln abzurufen
              if (emailCount === 0 && !resolved) {
                // Rufe E-Mails einzeln ab als Fallback
                fetchEmailsIndividually();
              }
            });

            fetch.on('message', (msg) => {
              const chunks: Buffer[] = [];
              let uid: number | null = null;
              let totalChunkSize = 0;
              let messageError: Error | null = null;

              msg.on('attributes', (attrs) => {
                if (attrs.uid) {
                  uid = attrs.uid;
                  // #region agent log
                  debugLog({location:'email-fetcher.ts:151',message:'Message fetch gestartet',data:{uid,accountId:account.id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'});
                  // #endregion
                }
              });

              msg.on('body', (stream) => {
                // Lade die vollständige E-Mail-Nachricht als Buffer (wichtig für Anhänge)
                stream.on('data', (chunk) => {
                  // Sammle alle Chunks als Buffer (nicht als String!)
                  const chunkSize = Buffer.isBuffer(chunk) ? chunk.length : Buffer.from(chunk).length;
                  totalChunkSize += chunkSize;
                  if (Buffer.isBuffer(chunk)) {
                    chunks.push(chunk);
                  } else {
                    chunks.push(Buffer.from(chunk));
                  }
                });
                // #region agent log
                stream.once('error', (err) => {
                  messageError = err;
                  debugLog({location:'email-fetcher.ts:165',message:'Stream-Fehler beim Laden',data:{uid,error:err.message,totalChunkSize,chunksCount:chunks.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'});
                });
                // #endregion
              });

              msg.once('end', () => {
                if (messageError && uid !== null) {
                  // Markiere diese UID als fehlgeschlagen
                  failedUids.add(uid);
                  console.warn(`[IMAP] E-Mail ${uid} konnte nicht geladen werden: ${messageError.message}`);
                } else if (uid !== null && chunks.length > 0) {
                  // Kombiniere alle Chunks zu einem Buffer
                  const buffer = Buffer.concat(chunks);
                  uidMap.set(uid, buffer);
                  // #region agent log
                  debugLog({location:'email-fetcher.ts:171',message:'Message vollständig geladen',data:{uid,bufferSize:buffer.length,chunksCount:chunks.length,totalChunkSize},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'});
                  // #endregion
                } else {
                  // #region agent log
                  debugLog({location:'email-fetcher.ts:172',message:'Message ohne Buffer oder UID',data:{uid,chunksCount:chunks.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'});
                  // #endregion
                }
                emailCount++;

                // Wenn alle E-Mails geladen wurden, verarbeite sie
                if (emailCount === totalEmails) {
                  processEmails();
                }
              });
            });
          } catch (err: any) {
            console.error('[IMAP] Fehler beim Erstellen des Fetch-Streams:', err);
            if (!resolved) {
              // Versuche E-Mails einzeln abzurufen als Fallback
              fetchEmailsIndividually();
            }
          }

          const processEmails = async () => {
            try {
              // Batch-Verarbeitung: Verarbeite E-Mails in Batches von 100
              const BATCH_SIZE = 100;
              const allUids = Array.from(uidMap.keys());
              let totalProcessed = 0;

              for (let i = 0; i < allUids.length; i += BATCH_SIZE) {
                const batchUids = allUids.slice(i, i + BATCH_SIZE);
                
                // Lade bereits abgerufene UIDs für diesen Batch (optimiert mit IN)
                const client = await getTenantDbClient(companyId);
                const existingUidsResult = await client.query(
                  `SELECT message_uid FROM emails 
                   WHERE account_id = $1 AND message_uid = ANY($2::integer[])`,
                  [account.id, batchUids]
                );
                const existingUids = new Set(
                  existingUidsResult.rows.map((row: any) => row.message_uid)
                );
                client.release();

                // Verarbeite Batch
                const batchEmails: FetchedEmail[] = [];
                for (const uid of batchUids) {
                  // Überspringe bereits abgerufene E-Mails
                  if (existingUids.has(uid)) {
                    // #region agent log
                    debugLog({location:'email-fetcher.ts:208',message:'E-Mail als Duplikat übersprungen',data:{uid,accountId:account.id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'});
                    // #endregion
                    continue;
                  }

                  const buffer = uidMap.get(uid);
                  if (!buffer) {
                    // #region agent log
                    debugLog({location:'email-fetcher.ts:213',message:'Kein Buffer für UID gefunden',data:{uid},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'});
                    // #endregion
                    continue;
                  }

                  // #region agent log
                  debugLog({location:'email-fetcher.ts:215',message:'Starte E-Mail-Parsing',data:{uid,bufferSize:buffer.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'});
                  // #endregion

                  try {
                    // Buffer ist bereits korrekt, verwende direkt
                    // Parse E-Mail mit mailparser
                    const parsed = await simpleParser(buffer);

                    // #region agent log
                    const attachmentCount = parsed.attachments ? parsed.attachments.length : 0;
                    debugLog({location:'email-fetcher.ts:218',message:'E-Mail erfolgreich geparst',data:{uid,attachmentCount,hasAttachments:attachmentCount>0,attachments:parsed.attachments?parsed.attachments.map((a:any)=>({filename:a.filename,contentType:a.contentType,size:a.size})):[],bufferSize:buffer.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'});
                    // #endregion

                    // Debug: Log Anhänge für Entwicklung
                    if (process.env.NODE_ENV === 'development' && parsed.attachments && parsed.attachments.length > 0) {
                      console.log(`[EmailFetcher] E-Mail UID ${uid} hat ${parsed.attachments.length} Anhang/Anhänge:`, 
                        parsed.attachments.map((att: any) => att.filename || att.contentType).join(', '));
                    }

                    // Extrahiere und konvertiere Anhänge von Streams zu Buffers
                    let attachments: Array<{ filename: string; contentType: string; size: number; content: Buffer }> | undefined;
                    if (parsed.attachments && parsed.attachments.length > 0) {
                      attachments = [];
                      for (const attachment of parsed.attachments) {
                        try {
                          // attachment.content kann Stream, Buffer oder anderer Typ sein
                          const contentBuffer = await attachmentContentToBuffer(attachment.content);
                          attachments.push({
                            filename: attachment.filename || `attachment_${attachments.length + 1}`,
                            contentType: attachment.contentType || 'application/octet-stream',
                            size: attachment.size || contentBuffer.length,
                            content: contentBuffer,
                          });
                        } catch (attachmentError: any) {
                          console.error(`[EmailFetcher] Fehler beim Konvertieren von Anhang ${attachment.filename || 'unbekannt'}:`, attachmentError);
                          console.error(`[EmailFetcher] Content-Typ: ${typeof attachment.content}, IsBuffer: ${Buffer.isBuffer(attachment.content)}`);
                          // Überspringe diesen Anhang, aber setze E-Mail-Abruf fort
                        }
                      }
                    }

                    const email: FetchedEmail = {
                      subject: parsed.subject || '(Kein Betreff)',
                      from: parsed.from?.text || parsed.from?.value?.[0]?.address || 'unbekannt@example.com',
                      to: parsed.to
                        ? (Array.isArray(parsed.to)
                            ? parsed.to.map((addr: any) => (addr as any).address || (addr as any).text || addr)
                            : [(parsed.to as any).address || (parsed.to as any).text || parsed.to])
                        : [],
                      body: parsed.html || parsed.text || '',
                      date: parsed.date || new Date(),
                      uid: uid,
                      hasAttachment: parsed.attachments && parsed.attachments.length > 0,
                      attachments: attachments,
                    };

                    batchEmails.push(email);
                  } catch (parseError: any) {
                    // #region agent log
                    debugLog({location:'email-fetcher.ts:241',message:'Parse-Fehler beim Parsen der E-Mail',data:{uid,errorMessage:parseError.message,errorStack:parseError.stack,bufferSize:buffer.length,isLargeEmail:buffer.length>100000},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'});
                    // #endregion
                    console.error(`Fehler beim Parsen der E-Mail (UID ${uid}):`, parseError);
                    console.error(`Parse-Fehler Details:`, {
                      uid,
                      errorMessage: parseError.message,
                      bufferLength: buffer.length,
                      hasAttachment: buffer.length > 100000 ? 'möglicherweise (große E-Mail)' : 'unbekannt',
                    });
                    // Weiter mit nächster E-Mail (nicht abbrechen, auch bei Fehlern)
                  }
                }

                // Speichere Batch (Bulk-Insert)
                if (batchEmails.length > 0) {
                  // #region agent log
                  const emailsWithAttachments = batchEmails.filter(e => e.hasAttachment);
                  debugLog({location:'email-fetcher.ts:254',message:'Speichere Batch in DB',data:{totalEmails:batchEmails.length,emailsWithAttachments:emailsWithAttachments.length,attachmentUids:emailsWithAttachments.map(e=>e.uid)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'});
                  // #endregion
                  await saveEmailsToDatabase(
                    batchEmails,
                    account.userId,
                    account.id,
                    companyId
                  );
                  totalProcessed += batchEmails.length;
                }

                // Memory freigeben: Entferne verarbeitete UIDs aus uidMap
                batchUids.forEach(uid => uidMap.delete(uid));
              }

              fetchedEmails.length = totalProcessed;

              if (!resolved) {
                resolved = true;
                clearTimeout(timeout);
                imap.end();
                resolve({
                  success: true,
                  count: fetchedEmails.length,
                });
              }
            } catch (error: any) {
              if (!resolved) {
                resolved = true;
                clearTimeout(timeout);
                imap.end();
                resolve({
                  success: false,
                  count: 0,
                  error: `Fehler beim Verarbeiten: ${error.message}`,
                });
              }
            }
          };
        });
      });
    });

    imap.once('error', (err) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        imap.end();
        resolve({
          success: false,
          count: 0,
          error: `IMAP-Fehler: ${err.message}`,
        });
      }
    });

    imap.connect();
  });
}

/**
 * Sanitized einen Dateinamen für sichere Speicherung (Path-Traversal-Schutz)
 */
function sanitizeFilename(filename: string): string {
  // Entferne gefährliche Zeichen: ../, \, /, etc.
  let sanitized = filename
    .replace(/\.\./g, '') // Entferne ..
    .replace(/[/\\]/g, '_') // Ersetze / und \ mit _
    .replace(/[<>:"|?*]/g, '_'); // Ersetze weitere gefährliche Zeichen
  
  // Erlaube nur alphanumerische Zeichen, Bindestriche, Unterstriche, Punkte
  sanitized = sanitized.replace(/[^a-zA-Z0-9._-]/g, '_');
  
  // Maximale Länge: 255 Zeichen
  if (sanitized.length > 255) {
    const ext = extname(sanitized);
    const nameWithoutExt = basename(sanitized, ext);
    sanitized = nameWithoutExt.substring(0, 255 - ext.length) + ext;
  }
  
  // Fallback wenn leer
  if (!sanitized || sanitized.trim().length === 0) {
    sanitized = 'attachment';
  }
  
  return sanitized;
}

/**
 * Speichert Anhänge im Dateisystem
 */
async function saveAttachmentsToFileSystem(
  attachments: Array<{ filename: string; contentType: string; size: number; content: Buffer }>,
  emailId: string,
  companyId: string
): Promise<Array<{ filename: string; filePath: string; sizeBytes: number }>> {
  if (!attachments || attachments.length === 0) {
    return [];
  }

  const storagePath = process.env.STORAGE_PATH || './storage';
  const attachmentsDir = join(storagePath, companyId, 'attachments', emailId);
  
  // Erstelle Verzeichnis rekursiv falls nicht vorhanden
  try {
    await mkdir(attachmentsDir, { recursive: true });
  } catch (error: any) {
    console.error(`[EmailFetcher] Fehler beim Erstellen des Anhänge-Verzeichnisses:`, error);
    throw error;
  }

  const savedAttachments: Array<{ filename: string; filePath: string; sizeBytes: number }> = [];

  for (const attachment of attachments) {
    try {
      const sanitizedFilename = sanitizeFilename(attachment.filename);
      let finalFilename = sanitizedFilename;
      let counter = 1;

      // Prüfe auf Duplikate und generiere eindeutigen Dateinamen
      while (existsSync(join(attachmentsDir, finalFilename))) {
        const ext = extname(sanitizedFilename);
        const nameWithoutExt = basename(sanitizedFilename, ext);
        finalFilename = `${nameWithoutExt}_${counter}${ext}`;
        counter++;
      }

      const filePath = join(attachmentsDir, finalFilename);
      const relativePath = join(companyId, 'attachments', emailId, finalFilename);

      // Speichere Datei
      await writeFile(filePath, attachment.content);

      console.log(`[EmailFetcher] Anhang gespeichert: ${finalFilename} (${formatBytes(attachment.content.length)}) -> ${relativePath}`);

      savedAttachments.push({
        filename: finalFilename,
        filePath: relativePath,
        sizeBytes: attachment.content.length,
      });
    } catch (error: any) {
      console.error(`[EmailFetcher] Fehler beim Speichern von Anhang ${attachment.filename}:`, error);
      // Überspringe diesen Anhang, aber setze Prozess fort
    }
  }

  return savedAttachments;
}

/**
 * Speichert Anhang-Metadaten in der Datenbank
 */
async function saveAttachmentsToDatabase(
  attachments: Array<{ filename: string; filePath: string; sizeBytes: number; contentType: string }>,
  emailId: string,
  companyId: string
): Promise<number> {
  if (!attachments || attachments.length === 0) {
    return 0;
  }

  const client = await getTenantDbClient(companyId);

  try {
    // Bulk-Insert: Erstelle VALUES-String für alle Anhänge
    const values: any[] = [];
    const placeholders: string[] = [];
    let paramIndex = 1;

    for (const attachment of attachments) {
      placeholders.push(
        `($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, $${paramIndex + 4})`
      );
      values.push(
        emailId,
        attachment.filename,
        attachment.contentType || null,
        attachment.sizeBytes,
        attachment.filePath,
      );
      paramIndex += 5;
    }

    if (values.length === 0) return 0;

    // Bulk-Insert mit ON CONFLICT für Duplikatsprüfung
    const result = await client.query(
      `INSERT INTO email_attachments (email_id, filename, content_type, size_bytes, file_path)
       VALUES ${placeholders.join(', ')}
       ON CONFLICT (email_id, filename) DO NOTHING
       RETURNING id`,
      values
    );

    return result.rows.length;
  } catch (error: any) {
    console.error(`[EmailFetcher] Fehler beim Speichern von Anhang-Metadaten in DB:`, error);
    // Fehler nicht weiterwerfen, damit E-Mail-Abruf fortgesetzt werden kann
    return 0;
  } finally {
    client.release();
  }
}

/**
 * Speichert abgerufene E-Mails in der Datenbank (als Kopie, Original bleibt auf Server)
 * Gibt die eingefügten E-Mails mit ihren IDs zurück
 */
async function saveEmailsToDatabase(
  emails: FetchedEmail[],
  userId: string,
  accountId: string,
  companyId: string
): Promise<Array<{ id: string; message_uid: number }>> {
  if (emails.length === 0) return [];

  const client = await getTenantDbClient(companyId);

  try {
    // ============================================
    // SCHRITT 1: TICKET-ID GENERIERUNG (IN TRANSAKTION)
    // ============================================
    await client.query('BEGIN');
    
    // Generiere/extrahiere Ticket-IDs für alle E-Mails
    const emailsWithTicketIds: Array<FetchedEmail & { ticketId: string; wasReused: boolean }> = [];
    
    for (const email of emails) {
      if (!email.uid) continue;
      
      try {
        // Generiere oder extrahiere Ticket-ID aus Betreff
        const { ticketId, wasReused } = await assignOrReuseTicketId(
          client,
          companyId,
          email.subject || ''
        );
        
        emailsWithTicketIds.push({
          ...email,
          ticketId,
          wasReused,
        });
        
        if (wasReused) {
          console.log(`♻️ Ticket-ID wiederverwendet für E-Mail: ${ticketId} - "${email.subject}"`);
        } else {
          console.log(`✅ Neue Ticket-ID generiert für E-Mail: ${ticketId} - "${email.subject}"`);
        }
      } catch (ticketError: any) {
        console.error(`❌ Fehler bei Ticket-ID-Generierung für E-Mail (UID ${email.uid}):`, ticketError);
        // Rollback bei Fehler
        await client.query('ROLLBACK');
        throw ticketError;
      }
    }
    
    // ============================================
    // SCHRITT 2: BULK-INSERT MIT TICKET-IDs
    // ============================================
    const values: any[] = [];
    const placeholders: string[] = [];
    let paramIndex = 1;

    for (const email of emailsWithTicketIds) {
      if (!email.uid) continue;
      
      placeholders.push(
        `($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, $${paramIndex + 4}, $${paramIndex + 5}, $${paramIndex + 6}, $${paramIndex + 7}, $${paramIndex + 8}, $${paramIndex + 9}, $${paramIndex + 10}, $${paramIndex + 11}, $${paramIndex + 12})`
      );
      values.push(
        userId,
        accountId,
        email.subject,
        email.from,
        Array.isArray(email.to) ? email.to.join(', ') : email.to || '',
        email.body || '',
        email.uid,
        email.date || new Date(),
        email.hasAttachment || false,
        companyId,           // company_id
        email.ticketId,      // ticket_id
        'email',             // type (abgerufene E-Mails sind immer 'email')
        null,                // phone_number (abgerufene E-Mails haben keine Telefonnummer)
      );
      paramIndex += 13;
    }

    if (values.length === 0) {
      await client.query('COMMIT');
      return [];
    }

    // Bulk-Insert mit ON CONFLICT für Duplikatsprüfung
    const result = await client.query(
      `INSERT INTO emails (user_id, account_id, subject, from_email, to_email, body, message_uid, created_at, has_attachment, company_id, ticket_id, type, phone_number)
       VALUES ${placeholders.join(', ')}
       ON CONFLICT (account_id, message_uid) DO UPDATE SET
         has_attachment = EXCLUDED.has_attachment,
         ticket_id = EXCLUDED.ticket_id
       RETURNING id, message_uid, ticket_id`,
      values
    );

    const insertedEmails = result.rows;
    // #region agent log
    const savedWithAttachments = emails.filter(e => e.hasAttachment && insertedEmails.some(ie => ie.message_uid === e.uid));
    debugLog({location:'email-fetcher.ts:375',message:'E-Mails in DB gespeichert',data:{totalInserted:insertedEmails.length,totalWithAttachments:emails.filter(e=>e.hasAttachment).length,savedWithAttachments:savedWithAttachments.length,attachmentUids:savedWithAttachments.map(e=>e.uid)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'});
    // #endregion
    
    // ============================================
    // SCHRITT 3: KONVERSATIONS-ERKENNUNG (BATCH)
    // ============================================
    try {
      // Sammle alle Ticket-IDs aus diesem Batch
      const ticketIds = [...new Set(emailsWithTicketIds.map(e => e.ticketId))];
      
      if (ticketIds.length > 0) {
        // Prüfe für alle Ticket-IDs, ob Konversationen existieren (COUNT > 1)
        const conversationCheckResult = await client.query(
          `SELECT ticket_id, COUNT(*) as cnt
           FROM emails
           WHERE ticket_id = ANY($1::varchar[]) AND company_id = $2
           GROUP BY ticket_id
           HAVING COUNT(*) > 1`,
          [ticketIds, companyId]
        );
        
        const conversationTicketIds = conversationCheckResult.rows.map(row => row.ticket_id);
        
        if (conversationTicketIds.length > 0) {
          console.log(`🗨️ Konversationen erkannt für ${conversationTicketIds.length} Ticket-IDs`);
          
          // Update: Setze is_conversation_thread und conversation_message_count für ALLE E-Mails dieser Ticket-IDs
          await client.query(
            `UPDATE emails 
             SET is_conversation_thread = true,
                 conversation_message_count = (
                   SELECT COUNT(*) FROM emails e2 
                   WHERE e2.ticket_id = emails.ticket_id AND e2.company_id = $2
                 )
             WHERE ticket_id = ANY($1::varchar[]) 
               AND company_id = $2`,
            [conversationTicketIds, companyId]
          );
          
          console.log(`✅ Konversations-Status aktualisiert für ${conversationTicketIds.length} Ticket-IDs`);
          
          // Timeline-Event für Konversations-Erkennung (nur für neue Konversationen)
          for (const ticketId of conversationTicketIds) {
            const countResult = await client.query(
              `SELECT COUNT(*) as cnt FROM emails 
               WHERE ticket_id = $1 AND company_id = $2`,
              [ticketId, companyId]
            );
            
            const messageCount = parseInt(countResult.rows[0]?.cnt || '0');
            
            // Wenn genau 2 Nachrichten: Erste Konversation
            if (messageCount === 2) {
              // Finde alle E-Mails dieser Konversation
              const conversationEmails = await client.query(
                `SELECT id FROM emails 
                 WHERE ticket_id = $1 AND company_id = $2
                 ORDER BY created_at ASC`,
                [ticketId, companyId]
              );
              
              // Erstelle Event für beide E-Mails
              for (const row of conversationEmails.rows) {
                import('./email-events').then(({ logEmailEvent }) => {
                  logEmailEvent(companyId, row.id, userId, 'conversation_created', {
                    ticketId,
                    messageCount: 2,
                    createdAt: new Date().toISOString(),
                  }).catch((err) => {
                    console.error('Fehler beim Protokollieren des Konversations-Events:', err);
                  });
                });
              }
            }
          }
        }
      }
    } catch (conversationError: any) {
      console.error(`⚠️ Fehler bei Konversations-Erkennung:`, conversationError);
      // Nicht kritisch - Fehler nicht weiterwerfen
    }
    
    // ============================================
    // SCHRITT 4: TIMELINE-EVENTS FÜR TICKET-IDs
    // ============================================
    try {
      for (const row of insertedEmails) {
        const emailId = row.id;
        const ticketId = row.ticket_id;
        const emailData = emailsWithTicketIds.find(e => e.uid === row.message_uid);
        
        if (emailData && ticketId) {
          // Ticket-Event protokollieren
          const eventType = emailData.wasReused ? 'ticket_reused' : 'ticket_assigned';
          const eventData: any = {
            ticketId,
            assignedAt: new Date().toISOString(),
          };
          
          if (emailData.wasReused) {
            eventData.extractedFrom = 'subject';
          }
          
          import('./email-events').then(({ logEmailEvent }) => {
            logEmailEvent(companyId, emailId, userId, eventType, eventData).catch((err) => {
              console.error('Fehler beim Protokollieren des Ticket-Events:', err);
            });
          });
        }
      }
    } catch (eventError: any) {
      console.error(`⚠️ Fehler bei Timeline-Event-Erstellung:`, eventError);
      // Nicht kritisch
    }
    
    // Commit Transaktion
    await client.query('COMMIT');
    console.log(`✅ Transaktion erfolgreich: ${insertedEmails.length} E-Mails mit Ticket-IDs gespeichert`);

    // Speichere Anhänge für jede E-Mail mit Anhängen
    for (const row of insertedEmails) {
      const emailId = row.id;
      const insertedEmail = emails.find(e => e.uid === row.message_uid);
      
      if (!insertedEmail) continue;

      // Speichere Anhänge wenn vorhanden
      if (insertedEmail.attachments && insertedEmail.attachments.length > 0) {
        try {
          // 1. Speichere Anhänge im Dateisystem
          const savedAttachments = await saveAttachmentsToFileSystem(
            insertedEmail.attachments,
            emailId,
            companyId
          );

          // 2. Speichere Anhang-Metadaten in Datenbank
          if (savedAttachments.length > 0) {
            const attachmentMetadata = savedAttachments.map((saved, index) => ({
              filename: saved.filename,
              filePath: saved.filePath,
              sizeBytes: saved.sizeBytes,
              contentType: insertedEmail.attachments![index].contentType,
            }));

            const savedCount = await saveAttachmentsToDatabase(
              attachmentMetadata,
              emailId,
              companyId
            );

            if (savedCount > 0) {
              const totalSize = savedAttachments.reduce((sum, att) => sum + att.sizeBytes, 0);
              console.log(`[EmailFetcher] ✅ ${savedCount} Anhang/Anhänge für E-Mail ${emailId} erfolgreich gespeichert (${formatBytes(totalSize)} gesamt)`);
              console.log(`[EmailFetcher] Anhänge: ${savedAttachments.map(a => `${a.filename} (${formatBytes(a.sizeBytes)})`).join(', ')}`);
              
              // Invalidiere Storage-Cache im SCC (asynchron, nicht blockierend)
              invalidateStorageCache(companyId).catch((err) => {
                console.warn(`[EmailFetcher] Fehler beim Invalidieren des Storage-Caches:`, err);
              });
            } else {
              console.warn(`[EmailFetcher] ⚠️ Keine Anhänge in DB gespeichert für E-Mail ${emailId} (möglicherweise Duplikate)`);
            }
          }
        } catch (attachmentError: any) {
          console.error(`[EmailFetcher] Fehler beim Speichern von Anhängen für E-Mail ${emailId}:`, attachmentError);
          // Fehler nicht weiterwerfen, damit E-Mail-Abruf fortgesetzt werden kann
        }
      }

      // Automatische Abteilungszuweisung basierend auf Empfänger-E-Mail-Adresse
      try {
        const toEmail = Array.isArray(insertedEmail.to) ? insertedEmail.to.join(', ') : insertedEmail.to || '';
        if (toEmail) {
          // Extrahiere E-Mail-Adressen aus to_email (kann mehrere sein, durch Komma getrennt)
          const emailAddresses = toEmail
            .split(',')
            .map(addr => {
              // Extrahiere E-Mail-Adresse aus formatierter Form (z.B. "Name <email@example.com>")
              const emailMatch = addr.match(/<([^>]+)>/) || addr.match(/([^\s<>]+@[^\s<>]+)/);
              return emailMatch ? emailMatch[1].trim().toLowerCase() : addr.trim().toLowerCase();
            })
            .filter(addr => addr && addr.includes('@'));

          // Für jede E-Mail-Adresse prüfen, ob sie einem E-Mail-Konto zugeordnet ist, das einer Abteilung gehört
          for (const emailAddr of emailAddresses) {
            const deptResult = await client.query(
              `SELECT d.id as department_id, d.name as department_name
               FROM departments d
               JOIN email_accounts ea ON d.email_account_id = ea.id
               WHERE LOWER(ea.email) = $1 
                 AND d.is_active = true 
                 AND ea.is_active = true
                 AND d.company_id = $2
               LIMIT 1`,
              [emailAddr, companyId]
            );

            if (deptResult.rows.length > 0) {
              const departmentId = deptResult.rows[0].department_id;
              const departmentName = deptResult.rows[0].department_name;

              // Prüfe, ob Zuweisung bereits existiert
              const existingCheck = await client.query(
                'SELECT 1 FROM email_departments WHERE email_id = $1 AND department_id = $2',
                [emailId, departmentId]
              );

              if (existingCheck.rows.length === 0) {
                // Füge Zuweisung hinzu
                await client.query(
                  'INSERT INTO email_departments (email_id, department_id) VALUES ($1, $2)',
                  [emailId, departmentId]
                );
                console.log(`[EmailFetcher] ✅ Abteilung "${departmentName}" automatisch E-Mail ${emailId} zugewiesen (Empfänger: ${emailAddr})`);
              }
            }
          }
        }
      } catch (deptError: any) {
        // Fehler bei Abteilungszuweisung sollte E-Mail-Abruf nicht stoppen
        console.error(`[EmailFetcher] Fehler bei automatischer Abteilungszuweisung für E-Mail ${emailId}:`, deptError);
      }

      // Event protokollieren (asynchron, nicht blockierend)
      import('./email-events').then(({ logEmailEvent }) => {
        logEmailEvent(companyId, emailId, userId, 'received', {}).catch((err) => {
          console.error('Fehler beim Protokollieren des E-Mail-Events:', err);
        });
      });

      // Automatisierungsregeln auslösen (asynchron, nicht blockierend)
      if (companyId && emailId && userId) {
        import('./automation-engine').then(({ executeRulesForEmail }) => {
          executeRulesForEmail(companyId, {
            id: emailId,
            userId: userId,
            subject: insertedEmail.subject || '',
            fromEmail: insertedEmail.from || '',
            toEmail: Array.isArray(insertedEmail.to) ? insertedEmail.to.join(', ') : insertedEmail.to || '',
            body: insertedEmail.body || '',
            createdAt: insertedEmail.date || new Date(),
            read: false,
            completed: false,
            hasAttachment: !!(insertedEmail as any).has_attachment,
          }, 'incoming').catch((err) => {
            console.error('[EmailFetcher] Fehler beim Ausführen der Automatisierungsregeln:', err);
          });
        }).catch((importError) => {
          console.error('[EmailFetcher] Fehler beim Importieren der Automation-Engine:', importError);
        });
      }
    }

    return insertedEmails.map(row => ({ id: row.id, message_uid: row.message_uid }));
  } catch (error: any) {
    // Rollback bei Fehler
    try {
      await client.query('ROLLBACK');
      console.error(`❌ Transaktion zurückgerollt: ${error.message}`);
    } catch (rollbackError: any) {
      console.error(`❌ Fehler beim Rollback:`, rollbackError);
    }
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Ruft E-Mails von allen aktiven Konten eines Users ab
 */
export async function fetchEmailsForUser(
  userId: string,
  companyId: string
): Promise<{ success: boolean; results: Array<{ accountId: string; accountName: string; count: number; error?: string }>; error?: string }> {
  let client;
  try {
    client = await getTenantDbClient(companyId);
  } catch (error: any) {
    console.error('Fehler beim Abrufen der Datenbankverbindung:', error);
    return {
      success: false,
      results: [],
      error: `Fehler beim Verbinden zur Datenbank: ${error.message || 'Unbekannter Fehler'}`,
    };
  }

  try {
    // Lade alle aktiven E-Mail-Konten des Users
    const result = await client.query(
      `SELECT id, user_id, name, email, imap_host, imap_port, imap_username, imap_password, imap_folder, imap_ssl, imap_tls
       FROM email_accounts
       WHERE user_id = $1 AND is_active = true
       AND imap_host IS NOT NULL 
       AND imap_username IS NOT NULL 
       AND imap_password IS NOT NULL`,
      [userId]
    );

    if (result.rows.length === 0) {
      return {
        success: true,
        results: [],
      };
    }

    const accounts: EmailAccount[] = result.rows.map((row: any) => ({
      id: row.id,
      userId: row.user_id,
      email: row.email,
      imapHost: row.imap_host,
      imapPort: row.imap_port || 993,
      imapUsername: row.imap_username,
      imapPassword: row.imap_password,
      imapFolder: row.imap_folder || 'INBOX',
      imapSsl: row.imap_ssl !== false,
      imapTls: row.imap_tls === true,
    }));

    // Rufe E-Mails von jedem Konto ab
    const results = await Promise.all(
      accounts.map(async (account) => {
        const accountName = result.rows.find((r: any) => r.id === account.id)?.name || account.email;
        const fetchResult = await fetchEmailsFromAccount(account, companyId);
        return {
          accountId: account.id,
          accountName,
          count: fetchResult.count,
          error: fetchResult.error,
        };
      })
    );

    return {
      success: true,
      results,
    };
  } catch (error: any) {
    console.error('Fehler beim Abrufen der E-Mail-Konten:', error);
    return {
      success: false,
      results: [],
      error: `Fehler beim Abrufen der E-Mail-Konten: ${error.message || 'Unbekannter Fehler'}`,
    };
  } finally {
    if (client) {
      client.release();
    }
  }
}
