import { NextRequest, NextResponse } from 'next/server';
import { getTenantContext } from '@/lib/api-tenant-context';

/**
 * PATCH /api/themes/[id]
 * Aktualisiert ein Thema (Name, Farbe).
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: themeId } = await params;
  if (!themeId) {
    return NextResponse.json({ error: 'Themen-ID erforderlich' }, { status: 400 });
  }

  const ctx = await getTenantContext(request);
  if ('error' in ctx) return ctx.error;

  const { client, payload } = ctx;

  try {
    const body = await request.json();
    const { name, color } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Themenname ist erforderlich' },
        { status: 400 }
      );
    }

    if (name.length > 255) {
      return NextResponse.json(
        { error: 'Themenname darf maximal 255 Zeichen lang sein' },
        { status: 400 }
      );
    }

    if (color != null && typeof color === 'string' && color.trim() !== '' && !/^#[0-9A-Fa-f]{6}$/.test(color)) {
      return NextResponse.json(
        { error: 'Ungültiges Farbformat. Erwartet wird ein Hex-Wert (z.B. #FF5733)' },
        { status: 400 }
      );
    }

    const result = await client.query(
      `UPDATE email_themes
       SET name = $1, color = $2, updated_at = NOW()
       WHERE id = $3 AND user_id = $4
       RETURNING id, name, color, created_at, updated_at`,
      [name.trim(), color?.trim() || null, themeId, payload.sub]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Thema nicht gefunden' }, { status: 404 });
    }

    const theme = result.rows[0];
    return NextResponse.json({
      theme: {
        id: theme.id,
        name: theme.name,
        color: theme.color || null,
        createdAt: theme.created_at,
        updatedAt: theme.updated_at,
      },
    });
  } catch (error: unknown) {
    console.error('Fehler beim Aktualisieren des Themas:', error);
    return NextResponse.json(
      { error: 'Fehler beim Aktualisieren des Themas' },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}

/**
 * DELETE /api/themes/[id]
 * Löscht ein Thema. E-Mails mit diesem Thema behalten theme_id; FK ist ON DELETE SET NULL.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: themeId } = await params;
  if (!themeId) {
    return NextResponse.json({ error: 'Themen-ID erforderlich' }, { status: 400 });
  }

  const ctx = await getTenantContext(request);
  if ('error' in ctx) return ctx.error;

  const { client, payload } = ctx;

  try {
    const result = await client.query(
      `DELETE FROM email_themes WHERE id = $1 AND user_id = $2 RETURNING id`,
      [themeId, payload.sub]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Thema nicht gefunden' }, { status: 404 });
    }

    return new NextResponse(null, { status: 204 });
  } catch (error: unknown) {
    console.error('Fehler beim Löschen des Themas:', error);
    return NextResponse.json(
      { error: 'Fehler beim Löschen des Themas' },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
