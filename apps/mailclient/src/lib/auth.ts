/**
 * Auth-Utilities: JWT-Verifizierung
 */

import * as jwt from 'jsonwebtoken';

export interface JwtPayload {
  sub: string; // user id
  email: string;
  companyId: string;
  role: string;
}

/**
 * Verifiziert ein JWT-Token und gibt den Payload zurück
 */
export function verifyToken(token: string): JwtPayload | null {
  try {
    const payload = jwt.verify(
      token,
      process.env.JWT_SECRET || 'dev-secret-change-in-production'
    ) as JwtPayload;

    return payload;
  } catch (error) {
    return null;
  }
}

/**
 * Extrahiert Token aus Authorization Header
 */
export function extractTokenFromHeader(authHeader: string | null): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  return authHeader.substring(7);
}

/**
 * Verifiziert ein Service-Token (für interne API-Aufrufe)
 */
export function verifyServiceToken(token: string): boolean {
  const serviceToken = process.env.CRON_SERVICE_TOKEN;
  
  if (!serviceToken || serviceToken.trim() === '') {
    // Wenn kein Service-Token konfiguriert ist, wird die Validierung deaktiviert
    // (für Development)
    console.warn('⚠️  CRON_SERVICE_TOKEN ist nicht gesetzt. Service-Token-Validierung deaktiviert.');
    // In Development: Akzeptiere jeden Token, wenn CRON_SERVICE_TOKEN nicht gesetzt ist
    // In Production: Sollte immer gesetzt sein!
    const isDevelopment = process.env.NODE_ENV !== 'production';
    if (isDevelopment) {
      console.warn('⚠️  Development-Modus: Service-Token-Validierung übersprungen');
    }
    return isDevelopment;
  }

  if (!token || token.trim() === '') {
    console.error('❌ Service-Token-Validierung fehlgeschlagen: Kein Token übergeben');
    return false;
  }

  const isValid = token === serviceToken;
  if (!isValid) {
    console.error('❌ Service-Token-Validierung fehlgeschlagen: Token stimmt nicht überein');
    console.error(`   Erwartet: ${serviceToken.substring(0, 10)}... (${serviceToken.length} Zeichen)`);
    console.error(`   Erhalten: ${token.substring(0, 10)}... (${token.length} Zeichen)`);
  } else {
    console.log('✅ Service-Token-Validierung erfolgreich');
  }

  return isValid;
}




