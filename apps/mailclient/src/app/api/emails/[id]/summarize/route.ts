import { NextRequest, NextResponse } from 'next/server';
import { getTenantContext } from '@/lib/api-tenant-context';
import { getCompanyConfig } from '@/lib/company-config';
import { getCompanyFeatures, getCompanyFeaturesBySlug } from '@/lib/company-features';
import { stripHtml } from '@/utils/signature-placeholders';
import OpenAI from 'openai';
import { GoogleGenAI } from '@google/genai';

const MAX_EMAIL_BODY_LENGTH = 8000;

/**
 * POST /api/emails/[id]/summarize
 * Generiert eine E-Mail-Zusammenfassung mittels OpenAI oder Google Gemini
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: emailId } = await params;
  if (!emailId) {
    return NextResponse.json({ error: 'E-Mail-ID erforderlich' }, { status: 400 });
  }

  const ctx = await getTenantContext(request);
  if ('error' in ctx) return ctx.error;

  const { client, payload, resolvedCompanyId } = ctx;

  // Feature-Flag prüfen (emailSummary bzw. audioFeatures)
  try {
    let features;
    if (resolvedCompanyId) {
      features = await getCompanyFeatures(resolvedCompanyId);
    } else {
      const hostname = request.headers.get('host') || '';
      const subdomain = hostname.split('.')[0];
      if (subdomain && subdomain !== 'localhost' && subdomain !== 'www') {
        features = await getCompanyFeaturesBySlug(subdomain);
      } else {
        features = { emailSummary: false, audioFeatures: false };
      }
    }
    if (!features.emailSummary && !features.audioFeatures) {
      return NextResponse.json(
        { error: 'E-Mail-Zusammenfassung ist für diese Firma nicht aktiviert' },
        { status: 403 }
      );
    }
  } catch (err) {
    console.error('Fehler beim Laden der Feature-Flags:', err);
  }

  try {
    // Sichtbarkeitsprüfung wie bei GET /api/emails/[id]
    const roleResult = await client.query(
      `SELECT role FROM users WHERE id = $1`,
      [payload.sub]
    );
    const userRole = roleResult.rows[0]?.role ?? null;
    const isAdmin = String(userRole).toLowerCase() === 'admin';
    const visibilityWhere = isAdmin
      ? '1=1'
      : `(e.user_id = $1 OR ud.department_id IS NOT NULL)`;

    const emailResult = await client.query(
      `SELECT e.id, e.body, e.subject, e.from_email 
       FROM emails e
       LEFT JOIN user_departments ud ON e.department_id = ud.department_id AND ud.user_id = $1
       WHERE ${visibilityWhere} AND e.id = $2`,
      [payload.sub, emailId]
    );

    if (emailResult.rows.length === 0) {
      return NextResponse.json({ error: 'E-Mail nicht gefunden' }, { status: 404 });
    }

    const row = emailResult.rows[0];
    let bodyText = row.body || '';

    // HTML bereinigen
    bodyText = stripHtml(bodyText)
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();

    if (!bodyText) {
      return NextResponse.json(
        { error: 'E-Mail-Inhalt ist leer' },
        { status: 400 }
      );
    }

    if (bodyText.length > MAX_EMAIL_BODY_LENGTH) {
      bodyText = bodyText.substring(0, MAX_EMAIL_BODY_LENGTH) + '...';
    }

    const companyConfig = await getCompanyConfig(client);

    const subject = row.subject || '(Kein Betreff)';
    const fromEmail = row.from_email || '(Unbekannt)';

    const systemPrompt = 'Du bist ein Assistent, der E-Mails prägnant zusammenfasst. Erstelle eine kurze, klare Zusammenfassung auf Deutsch (2-4 Sätze). Konzentriere dich auf die wichtigsten Punkte, Anliegen und Handlungsaufforderungen.';

    const userPrompt = `Fasse diese E-Mail zusammen:\n\nBetreff: ${subject}\nVon: ${fromEmail}\n\nInhalt:\n${bodyText}`;

    if (companyConfig.aiProvider === 'google') {
      if (!companyConfig.geminiApiKey || !companyConfig.geminiApiKey.trim()) {
        return NextResponse.json(
          { error: 'Google Gemini API-Key ist nicht konfiguriert. Bitte in den Einstellungen hinterlegen.' },
          { status: 400 }
        );
      }

      const ai = new GoogleGenAI({ apiKey: companyConfig.geminiApiKey });
      const response = await ai.models.generateContent({
        model: companyConfig.geminiModel || 'gemini-2.0-flash',
        contents: `${systemPrompt}\n\n${userPrompt}`,
      });

      const summary = response.text?.trim();
      if (!summary) {
        return NextResponse.json(
          { error: 'Gemini hat keine Zusammenfassung zurückgegeben' },
          { status: 500 }
        );
      }

      return NextResponse.json({ summary });
    }

    // OpenAI
    if (!companyConfig.openaiApiKey || !companyConfig.openaiApiKey.trim()) {
      return NextResponse.json(
        { error: 'OpenAI API-Key ist nicht konfiguriert. Bitte in den Einstellungen hinterlegen.' },
        { status: 400 }
      );
    }

    const openai = new OpenAI({ apiKey: companyConfig.openaiApiKey });
    const completion = await openai.chat.completions.create({
      model: companyConfig.openaiModel || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    });

    const summary = completion.choices[0]?.message?.content?.trim();
    if (!summary) {
      return NextResponse.json(
        { error: 'OpenAI hat keine Zusammenfassung zurückgegeben' },
        { status: 500 }
      );
    }

    return NextResponse.json({ summary });
  } catch (error: any) {
    console.error('Fehler bei E-Mail-Zusammenfassung:', error);
    const rawMessage = error?.message || 'Interner Serverfehler';
    let status =
      error?.status === 401 ? 401 : error?.status === 429 ? 429 : 500;

    let message = rawMessage;
    const messageStr = String(rawMessage);
    const isQuotaError =
      status === 429 ||
      messageStr.includes('RESOURCE_EXHAUSTED') ||
      messageStr.includes('exceeded your current quota');

    if (isQuotaError) {
      status = 429;
      message =
        'AI-Kontingent (z.B. Google Gemini) ist erschöpft. Bitte Quota im Anbieter-Dashboard prüfen oder in den Einstellungen auf einen anderen Provider / ein anderes Modell wechseln.';
    }

    return NextResponse.json({ error: message }, { status });
  } finally {
    client.release();
  }
}
