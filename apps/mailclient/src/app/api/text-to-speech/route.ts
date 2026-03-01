import { NextRequest, NextResponse } from 'next/server';
import { getTenantDbClient } from '@/lib/tenant-db-client';
import { extractTokenFromHeader, verifyToken } from '@/lib/auth';
import { getCompanyFeatures } from '@/lib/company-features';
import { getCompanyDbConfigBySlug } from '@/lib/scc-client';
import { getCompanyConfig } from '@/lib/company-config';
import { ensureCompanyConfigTableSchema } from '@/lib/tenant-db-migrations';

/**
 * POST /api/text-to-speech
 * Generiert Audio für Text-to-Speech mit ElevenLabs für beliebigen Text
 */
export async function POST(request: NextRequest) {
  
  // Tenant-Context aus Request extrahieren
  let companyId: string | null = null;
  let companySlug: string | null = null;
  
  const hostname = request.headers.get('host') || '';
  const subdomain = hostname.split('.')[0];
  
  if (subdomain && subdomain !== 'localhost' && subdomain !== 'www') {
    companySlug = subdomain;
  }
  
  const headerCompanyId = request.headers.get('x-company-id');
  const headerCompanySlug = request.headers.get('x-company-slug');
  
  if (headerCompanyId) {
    companyId = headerCompanyId;
  } else if (headerCompanySlug) {
    companySlug = headerCompanySlug;
  }
  
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
  
  if (!companyId && payload.companyId) {
    companyId = payload.companyId;
  }
  
  if (!companyId && !companySlug) {
    return NextResponse.json(
      { error: 'Tenant-Context nicht gesetzt. Request muss companyId oder companySlug enthalten.' },
      { status: 400 }
    );
  }

  // Tenant-Context companyId auflösen
  let resolvedCompanyId = companyId;
  
  if (!resolvedCompanyId && companySlug) {
    try {
      const dbConfig = await getCompanyDbConfigBySlug(companySlug);
      if (dbConfig) {
        resolvedCompanyId = dbConfig.companyId;
      }
    } catch (err) {
      console.error('Fehler beim Auflösen von companySlug:', err);
    }
  }

  if (!resolvedCompanyId) {
    return NextResponse.json(
      { error: 'Company-ID konnte nicht aufgelöst werden' },
      { status: 400 }
    );
  }

  // Prüfe Feature-Flag
  try {
    const features = await getCompanyFeatures(resolvedCompanyId);
    if (!features.audioFeatures && !features.textToSpeech) {
      return NextResponse.json(
        { error: 'Audio-Features sind für diese Firma nicht aktiviert' },
        { status: 403 }
      );
    }
  } catch (err) {
    console.error('Fehler beim Laden der Feature-Flags:', err);
    // Weiter mit der Anfrage, falls SCC nicht erreichbar ist
  }

  // Request-Body parsen
  let requestBody;
  try {
    requestBody = await request.json();
  } catch (err) {
    return NextResponse.json(
      { error: 'Ungültiger Request-Body' },
      { status: 400 }
    );
  }

  const { text } = requestBody;

  if (!text || typeof text !== 'string' || text.trim() === '') {
    return NextResponse.json(
      { error: 'Text ist erforderlich' },
      { status: 400 }
    );
  }

  // Tenant-DB-Client holen
  const client = await getTenantDbClient(resolvedCompanyId);

  try {
    // Stelle sicher, dass company_config Tabelle existiert
    await ensureCompanyConfigTableSchema(client, resolvedCompanyId);
    
    // Lade Company-Config
    const companyConfig = await getCompanyConfig(client);
    
    if (!companyConfig.elevenlabsApiKey) {
      return NextResponse.json(
        { error: 'ElevenLabs API-Key nicht konfiguriert. Bitte in den Einstellungen hinterlegen.' },
        { status: 500 }
      );
    }

    // Text bereinigen
    let cleanText = text
      .replace(/<[^>]*>/g, '') // HTML-Tags entfernen
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ') // Mehrfache Leerzeichen
      .trim();

    if (!cleanText) {
      return NextResponse.json(
        { error: 'Text ist leer' },
        { status: 400 }
      );
    }

    // Text-Länge begrenzen (max. 5000 Zeichen für ElevenLabs)
    if (cleanText.length > 5000) {
      cleanText = cleanText.substring(0, 5000) + '...';
    }

    // ElevenLabs Voice-ID (Standard-Voice-ID für Deutsch, falls nicht gesetzt)
    const voiceId = companyConfig.elevenlabsVoiceId || '21m00Tcm4TlvDq8ikWAM'; // Rachel (Standard)

    // ElevenLabs API aufrufen
    const elevenLabsResponse = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': companyConfig.elevenlabsApiKey,
        },
        body: JSON.stringify({
          text: cleanText,
          model_id: 'eleven_multilingual_v2',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
          },
        }),
      }
    );

    if (!elevenLabsResponse.ok) {
      const errorText = await elevenLabsResponse.text();
      let errorMessage = 'Fehler beim Generieren der Audio-Datei';
      
      try {
        const errorData = JSON.parse(errorText);
        errorMessage = errorData.detail?.message || errorData.message || errorMessage;
      } catch {
        // Wenn JSON-Parsing fehlschlägt, verwende den Text als Fehlermeldung
        errorMessage = errorText || errorMessage;
      }

      console.error('ElevenLabs API-Fehler:', {
        status: elevenLabsResponse.status,
        statusText: elevenLabsResponse.statusText,
        error: errorMessage,
      });

      return NextResponse.json(
        { error: errorMessage },
        { status: elevenLabsResponse.status >= 500 ? 502 : elevenLabsResponse.status }
      );
    }

    // Audio-Daten als Stream zurückgeben
    const audioBuffer = await elevenLabsResponse.arrayBuffer();
    
    return new NextResponse(audioBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': audioBuffer.byteLength.toString(),
      },
    });
  } catch (error: any) {
    console.error('Fehler beim Generieren der Audio-Datei:', error);
    return NextResponse.json(
      { error: error.message || 'Interner Serverfehler beim Generieren der Audio-Datei' },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
