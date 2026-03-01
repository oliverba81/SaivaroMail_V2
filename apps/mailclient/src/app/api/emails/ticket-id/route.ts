import { NextRequest, NextResponse } from 'next/server';
import { getTenantDbClient } from '@/lib/tenant-db-client';
import { extractTokenFromHeader, verifyToken } from '@/lib/auth';
import { generateTicketId, isValidTicketId } from '@/lib/ticket-id-generator';

/**
 * PUT /api/emails/ticket-id
 * Aktualisiert Ticket-IDs für eine oder mehrere E-Mails
 * 
 * Body:
 * {
 *   emailIds: string[];           // E-Mail IDs (Array)
 *   ticketId?: string;            // Manuelle Ticket-ID oder Ziel-Ticket-ID zum Kopieren
 *   mode: 'regenerate' | 'manual' | 'copy';
 *   sourceEmailId?: string;       // Quell-E-Mail-ID beim Kopieren
 *   bulkStrategy?: 'same_id' | 'auto_suffix';  // Strategie bei Bulk-Operationen
 * }
 */
export async function PUT(request: NextRequest) {
  try {
    // Auth-Check
    const authHeader = request.headers.get('authorization');
    const token = extractTokenFromHeader(authHeader);
    
    if (!token) {
      return NextResponse.json(
        { error: 'Authorization-Token erforderlich' },
        { status: 401 }
      );
    }

    const payload = verifyToken(token);
    
    if (!payload) {
      return NextResponse.json(
        { error: 'Ungültiger Token' },
        { status: 401 }
      );
    }

    // Company-ID aus Token
    const companyId = payload.companyId;
    if (!companyId) {
      return NextResponse.json(
        { error: 'Company-ID nicht im Token gefunden' },
        { status: 400 }
      );
    }

    // Body parsen
    const body = await request.json();
    const { emailIds, ticketId, mode, sourceEmailId } = body;

    // Validierung
    if (!emailIds || !Array.isArray(emailIds) || emailIds.length === 0) {
      return NextResponse.json(
        { error: 'emailIds Array erforderlich' },
        { status: 400 }
      );
    }

    if (!mode || !['regenerate', 'manual', 'copy'].includes(mode)) {
      return NextResponse.json(
        { error: 'mode muss regenerate, manual oder copy sein' },
        { status: 400 }
      );
    }

    if (mode === 'manual' && !ticketId) {
      return NextResponse.json(
        { error: 'ticketId erforderlich für mode=manual' },
        { status: 400 }
      );
    }

    if (mode === 'copy' && !sourceEmailId) {
      return NextResponse.json(
        { error: 'sourceEmailId erforderlich für mode=copy' },
        { status: 400 }
      );
    }

    // Validiere manuelle Ticket-ID Format
    if (mode === 'manual' && ticketId && !isValidTicketId(ticketId)) {
      return NextResponse.json(
        { error: 'Ungültiges Ticket-ID Format. Muss M + 11 Ziffern sein (z.B. M26011800001)' },
        { status: 400 }
      );
    }

    const client = await getTenantDbClient(companyId);
    const results: Array<{ emailId: string; ticketId: string; oldTicketId?: string; success: boolean; error?: string }> = [];

    try {
      // Verarbeite jede E-Mail
      for (const emailId of emailIds) {
        try {
          await client.query('BEGIN');

          // Lade alte Ticket-ID
          const emailResult = await client.query(
            'SELECT ticket_id FROM emails WHERE id = $1 AND company_id = $2',
            [emailId, companyId]
          );

          if (emailResult.rows.length === 0) {
            results.push({
              emailId,
              ticketId: '',
              success: false,
              error: 'E-Mail nicht gefunden',
            });
            await client.query('ROLLBACK');
            continue;
          }

          const oldTicketId = emailResult.rows[0].ticket_id;
          let newTicketId: string;

          // Bestimme neue Ticket-ID basierend auf Mode
          switch (mode) {
            case 'regenerate':
              newTicketId = await generateTicketId(client, companyId);
              break;

            case 'manual':
              newTicketId = ticketId!;
              break;

            case 'copy':
              // Lade Ticket-ID von Quell-E-Mail
              const sourceResult = await client.query(
                'SELECT ticket_id FROM emails WHERE id = $1 AND company_id = $2',
                [sourceEmailId, companyId]
              );

              if (sourceResult.rows.length === 0) {
                throw new Error('Quell-E-Mail nicht gefunden');
              }

              if (!sourceResult.rows[0].ticket_id) {
                throw new Error('Quell-E-Mail hat keine Ticket-ID');
              }

              newTicketId = sourceResult.rows[0].ticket_id;
              break;

            default:
              throw new Error('Ungültiger Modus');
          }

          // Update E-Mail mit neuer Ticket-ID
          await client.query(
            'UPDATE emails SET ticket_id = $1 WHERE id = $2 AND company_id = $3',
            [newTicketId, emailId, companyId]
          );
          
          console.log(`🔧 Manuelle Ticket-ID Update: E-Mail ${emailId} → ${newTicketId} (alt: ${oldTicketId})`);

          // Prüfe ob Konversation entstanden ist
          const conversationCheck = await client.query(
            `SELECT COUNT(*) as cnt FROM emails 
             WHERE ticket_id = $1 AND company_id = $2`,
            [newTicketId, companyId]
          );

          const messageCount = parseInt(conversationCheck.rows[0]?.cnt || '0');

          if (messageCount > 1) {
            // Update is_conversation_thread für alle E-Mails mit dieser Ticket-ID
            await client.query(
              `UPDATE emails 
               SET is_conversation_thread = true,
                   conversation_message_count = $1
               WHERE ticket_id = $2 AND company_id = $3`,
              [messageCount, newTicketId, companyId]
            );
          }

          // Timeline-Event protokollieren
          await client.query(
            `INSERT INTO email_events (email_id, user_id, event_type, event_data, created_at)
             VALUES ($1, $2, $3, $4, NOW())`,
            [
              emailId,
              payload.sub,
              'ticket_changed',
              JSON.stringify({
                ticketId: newTicketId,
                oldTicketId,
                changeReason: mode === 'regenerate' ? 'manuell neu generiert' : mode === 'manual' ? 'manuell bearbeitet' : 'von anderer E-Mail kopiert',
                userId: payload.sub,
              }),
            ]
          );

          await client.query('COMMIT');

          results.push({
            emailId,
            ticketId: newTicketId,
            oldTicketId,
            success: true,
          });

          console.log(`✅ Ticket-ID für ${emailId} aktualisiert: ${oldTicketId} → ${newTicketId}`);
        } catch (error: any) {
          await client.query('ROLLBACK');
          results.push({
            emailId,
            ticketId: '',
            success: false,
            error: error.message,
          });
          console.error(`❌ Fehler bei E-Mail ${emailId}:`, error);
        }
      }

      const successCount = results.filter(r => r.success).length;
      const errorCount = results.filter(r => !r.success).length;

      return NextResponse.json({
        success: errorCount === 0,
        processed: results.length,
        successful: successCount,
        failed: errorCount,
        results,
      });
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error('Fehler bei Ticket-ID Update:', error);
    return NextResponse.json(
      { 
        error: 'Interner Serverfehler',
        details: error.message 
      },
      { status: 500 }
    );
  }
}
