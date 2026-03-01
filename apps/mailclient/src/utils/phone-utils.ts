/**
 * Utility-Funktionen für Telefonnummer-Validierung, -Normalisierung und -Formatierung
 */

import { ValidationResult } from './validation';

/**
 * Validiert eine Telefonnummer
 * Unterstützt internationale Formate:
 * - +49 123 456789 (mit Ländercode)
 * - 0123 456789 (national)
 * - (0123) 456789 (mit Klammern)
 * - 0123-456789 (mit Bindestrich)
 */
export function validatePhoneNumber(phone: string): ValidationResult {
  if (!phone || typeof phone !== 'string') {
    return { isValid: false, error: 'Telefonnummer ist erforderlich' };
  }

  const trimmed = phone.trim();

  if (trimmed.length === 0) {
    return { isValid: false, error: 'Telefonnummer ist erforderlich' };
  }

  // Mindestlänge: 5 Zeichen
  if (trimmed.length < 5) {
    return { isValid: false, error: 'Telefonnummer muss mindestens 5 Zeichen lang sein' };
  }

  // Maximallänge: 50 Zeichen (entspricht DB VARCHAR(50))
  if (trimmed.length > 50) {
    return { isValid: false, error: 'Telefonnummer darf maximal 50 Zeichen lang sein' };
  }

  // Regex-Pattern für internationale Telefonnummern
  // Unterstützt: +49 123 456789, 0123 456789, (0123) 456789, 0123-456789, etc.
  const phoneRegex = /^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$/;

  if (!phoneRegex.test(trimmed)) {
    return { isValid: false, error: 'Ungültiges Telefonnummer-Format' };
  }

  return { isValid: true };
}

/**
 * Normalisiert eine Telefonnummer für tel: Links
 * Entfernt Leerzeichen, Bindestriche, Klammern
 * Beispiel: "+49 123 456789" → "+49123456789"
 */
export function normalizePhoneNumberForTel(phone: string): string {
  if (!phone || typeof phone !== 'string') {
    return '';
  }

  // Entferne alle Leerzeichen, Bindestriche, Klammern, Punkte
  return phone.replace(/[\s\-().]/g, '');
}

/**
 * Formatiert eine Telefonnummer für die Anzeige
 * Behält Formatierung bei oder formatiert automatisch
 * Beispiel: "+49123456789" → "+49 123 456789"
 */
export function formatPhoneNumberForDisplay(phone: string): string {
  if (!phone || typeof phone !== 'string') {
    return '';
  }

  // Wenn bereits formatiert (enthält Leerzeichen, Bindestriche, etc.), behalte Formatierung
  if (/[\s\-()]/.test(phone)) {
    return phone.trim();
  }

  // Ansonsten: Einfache Formatierung (optional)
  // Für deutsche Nummern: +49 123 456789
  const normalized = normalizePhoneNumberForTel(phone);
  
  // Wenn mit +49 beginnt (Deutschland)
  if (normalized.startsWith('+49')) {
    const rest = normalized.substring(3);
    if (rest.length >= 3) {
      // Format: +49 123 456789
      const areaCode = rest.substring(0, 3);
      const number = rest.substring(3);
      return `+49 ${areaCode} ${number}`;
    }
  }

  // Ansonsten: Original zurückgeben
  return phone.trim();
}
