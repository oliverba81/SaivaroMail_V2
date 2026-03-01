import { NextRequest, NextResponse } from 'next/server';
import { extractTokenFromHeader, verifyToken } from '@/lib/auth';

/**
 * POST /api/settings/test-elevenlabs
 * Testet die ElevenLabs-Konfiguration mit einem kurzen Test-Text
 */
export async function POST(request: NextRequest) {
  try {
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

    if (!payload.companyId) {
      return NextResponse.json(
        { error: 'Company-ID nicht gefunden' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { elevenlabsApiKey, elevenlabsVoiceId } = body;

    if (!elevenlabsApiKey || !elevenlabsApiKey.trim()) {
      return NextResponse.json(
        { error: 'ElevenLabs API-Key erforderlich' },
        { status: 400 }
      );
    }

    // Test-Text (kurz, auf Deutsch)
    const testText = 'Dies ist ein Test der ElevenLabs Text-to-Speech Funktion. Wenn Sie diese Nachricht hören, funktioniert die Konfiguration korrekt.';

    // ElevenLabs Voice-ID (Standard-Voice-ID für Deutsch, falls nicht gesetzt)
    const voiceId = elevenlabsVoiceId?.trim() || 'pNInz6obpgDQGcFmaJgB'; // Adam (männlich, Deutsch)

    // ElevenLabs API aufrufen
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': elevenlabsApiKey.trim(),
      },
      body: JSON.stringify({
        text: testText,
        model_id: 'eleven_multilingual_v2', // Unterstützt Deutsch
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
        },
      }),
    });

    if (!response.ok) {
      console.error('ElevenLabs API Fehler:', {
        status: response.status,
        statusText: response.statusText,
      });
      
      // Spezifische Fehlermeldungen
      if (response.status === 401) {
        return NextResponse.json(
          { error: 'Ungültiger ElevenLabs API-Key. Bitte überprüfen Sie die Einstellungen.' },
          { status: 500 }
        );
      }
      if (response.status === 404) {
        return NextResponse.json(
          { error: 'Voice-ID nicht gefunden. Bitte überprüfen Sie die Voice-ID.' },
          { status: 500 }
        );
      }
      if (response.status === 429) {
        return NextResponse.json(
          { error: 'Rate-Limit erreicht. Bitte versuchen Sie es später erneut.' },
          { status: 429 }
        );
      }
      if (response.status >= 500) {
        return NextResponse.json(
          { error: 'ElevenLabs-Server-Fehler. Bitte versuchen Sie es später erneut.' },
          { status: 502 }
        );
      }
      
      const errorText = await response.text().catch(() => '');
      return NextResponse.json(
        { error: `Fehler beim Generieren der Audio-Datei: ${response.status} ${response.statusText}${errorText ? ` - ${errorText}` : ''}` },
        { status: 500 }
      );
    }

    // Audio-Stream zurückgeben
    const audioBuffer = await response.arrayBuffer();
    
    return new NextResponse(audioBuffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': audioBuffer.byteLength.toString(),
      },
    });
  } catch (error: any) {
    console.error('Fehler beim Testen von ElevenLabs:', error);
    return NextResponse.json(
      { error: 'Interner Serverfehler: ' + (error.message || 'Unbekannter Fehler') },
      { status: 500 }
    );
  }
}
