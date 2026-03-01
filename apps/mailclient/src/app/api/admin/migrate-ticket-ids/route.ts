import { NextRequest, NextResponse } from 'next/server';
import { extractTokenFromHeader, verifyToken } from '@/lib/auth';
import { migrateTicketIdsForCompany, MigrationProgress } from '@/lib/migrate-ticket-ids';

/**
 * POST /api/admin/migrate-ticket-ids
 * Startet die Migration von Ticket-IDs für eine Company
 * Erfordert: Admin-Role
 * 
 * Query-Parameter:
 * - companyId: Company UUID (optional, Standard: aus Token)
 * - dryRun: true/false (optional, Standard: false)
 * - stream: true/false (optional, Standard: true) - SSE-Streaming für Progress
 */
export async function POST(request: NextRequest) {
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

    // Prüfe Admin-Rolle
    if (payload.role !== 'admin') {
      return NextResponse.json(
        { error: 'Nur Admins dürfen Migrationen durchführen' },
        { status: 403 }
      );
    }

    // Parameter extrahieren
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId') || payload.companyId;
    const dryRun = searchParams.get('dryRun') === 'true';
    const stream = searchParams.get('stream') !== 'false'; // Default: true

    if (!companyId) {
      return NextResponse.json(
        { error: 'Company-ID erforderlich' },
        { status: 400 }
      );
    }

    console.log(`🚀 Migration gestartet für Company ${companyId}${dryRun ? ' (DRY RUN)' : ''}`);

    // Server-Sent Events (SSE) Streaming
    if (stream) {
      const encoder = new TextEncoder();
      
      const stream = new ReadableStream({
        async start(controller) {
          try {
            // Sende Start-Event
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: 'start', companyId, dryRun })}\n\n`)
            );

            // Migration mit Progress-Callbacks
            const result = await migrateTicketIdsForCompany(companyId, {
              dryRun,
              onProgress: async (progress: MigrationProgress) => {
                // Sende Progress-Event
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ type: 'progress', progress })}\n\n`)
                );
              },
            });

            // Sende Abschluss-Event
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: 'complete', result })}\n\n`)
            );

            controller.close();
          } catch (error: any) {
            // Sende Error-Event
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ 
                type: 'error', 
                error: error.message || 'Migration fehlgeschlagen' 
              })}\n\n`)
            );
            controller.close();
          }
        },
      });

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    }

    // Nicht-Streaming: Normale Response
    const result = await migrateTicketIdsForCompany(companyId, { dryRun });

    return NextResponse.json({
      success: result.success,
      companyId,
      dryRun,
      stats: {
        totalProcessed: result.totalProcessed,
        assignedIds: result.assignedIds,
        reusedIds: result.reusedIds,
        errors: result.errors,
      },
      errorDetails: result.errorDetails,
    });
  } catch (error: any) {
    console.error('Fehler bei Migration-API:', error);
    return NextResponse.json(
      { 
        error: 'Interner Serverfehler',
        details: error.message 
      },
      { status: 500 }
    );
  }
}
