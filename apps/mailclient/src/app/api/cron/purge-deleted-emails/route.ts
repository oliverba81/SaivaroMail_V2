import { NextRequest, NextResponse } from 'next/server';
import { getTenantDbClient } from '@/lib/tenant-db-client';
import { verifyServiceToken } from '@/lib/auth';
import { getCompanyConfig } from '@/lib/company-config';
import { join } from 'path';
import { unlink } from 'fs/promises';
import { existsSync } from 'fs';

/**
 * POST /api/cron/purge-deleted-emails
 * Löscht gelöscht markierte E-Mails endgültig, die älter als X Tage sind (X aus company_config.permanent_delete_after_days).
 * Aufruf: x-service-token, x-company-id Header.
 */
export async function POST(request: NextRequest) {
  try {
    const serviceToken = request.headers.get('x-service-token');
    if (!serviceToken || !verifyServiceToken(serviceToken)) {
      return NextResponse.json(
        { error: 'Service-Token erforderlich oder ungültig' },
        { status: 401 }
      );
    }

    const companyId = request.headers.get('x-company-id');
    if (!companyId) {
      return NextResponse.json(
        { error: 'x-company-id Header erforderlich' },
        { status: 400 }
      );
    }

    const client = await getTenantDbClient(companyId);

    try {
      const config = await getCompanyConfig(client);
      const days = config.permanentDeleteAfterDays ?? 0;

      if (days <= 0) {
        return NextResponse.json({
          success: true,
          message: 'Endgültiges Löschen deaktiviert (0 Tage)',
          deletedCount: 0,
        });
      }

      const cutoffResult = await client.query(
        `SELECT id FROM emails WHERE deleted_at IS NOT NULL AND deleted_at < NOW() - ($1::int * INTERVAL '1 day')`,
        [days]
      );
      const emailIds = cutoffResult.rows.map((r: { id: string }) => r.id);

      if (emailIds.length === 0) {
        return NextResponse.json({
          success: true,
          message: 'Keine E-Mails zum endgültigen Löschen',
          deletedCount: 0,
        });
      }

      const storagePath = process.env.STORAGE_PATH || './storage';
      const attResult = await client.query(
        `SELECT id, file_path FROM email_attachments WHERE email_id = ANY($1::uuid[])`,
        [emailIds]
      );
      for (const row of attResult.rows) {
        try {
          const fullPath = join(storagePath, row.file_path);
          if (existsSync(fullPath)) {
            await unlink(fullPath);
          }
        } catch (e) {
          console.warn(`[purge-deleted-emails] Anhang-Datei konnte nicht gelöscht werden: ${row.file_path}`, e);
        }
      }

      const deleteResult = await client.query(
        `DELETE FROM emails WHERE deleted_at IS NOT NULL AND deleted_at < NOW() - ($1::int * INTERVAL '1 day')`,
        [days]
      );
      const deletedCount = deleteResult.rowCount ?? 0;

      return NextResponse.json({
        success: true,
        message: `${deletedCount} E-Mails endgültig gelöscht`,
        deletedCount,
      });
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error('Fehler beim Purge gelöschter E-Mails:', error);
    return NextResponse.json(
      { error: error?.message || 'Interner Serverfehler' },
      { status: 500 }
    );
  }
}
