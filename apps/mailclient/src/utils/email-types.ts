/**
 * Type Guards und Helper-Funktionen für Email/Telefonnotiz-Typen
 */

/**
 * Email-Interface (Basis)
 */
export interface EmailBase {
  id: string;
  type?: 'email' | 'phone_note';
  phoneNumber?: string;
  from?: string;
}

/**
 * Type Guard: Prüft ob es sich um eine E-Mail handelt
 */
export function isEmail(email: EmailBase): email is EmailBase & { type: 'email' } {
  return email.type === 'email' || (!email.type && !!email.from);
}

/**
 * Type Guard: Prüft ob es sich um eine Telefonnotiz handelt
 */
export function isPhoneNote(email: EmailBase): email is EmailBase & { type: 'phone_note'; phoneNumber: string } {
  return email.type === 'phone_note' && !!email.phoneNumber;
}

/**
 * Gibt den Typ einer E-Mail/Telefonnotiz zurück
 * Gibt immer 'email' | 'phone_note' zurück (nie undefined)
 */
export function getEmailType(email: EmailBase): 'email' | 'phone_note' {
  if (email.type === 'phone_note') {
    return 'phone_note';
  }
  return 'email';
}
