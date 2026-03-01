/**
 * Browserkompatibilitäts-Utilities
 * Bietet Fallbacks für fehlende Browser-Features
 */

/**
 * Safe localStorage mit Fallback für private Browsing-Modi
 */
export const safeLocalStorage = {
  getItem: (key: string): string | null => {
    try {
      if (typeof Storage !== 'undefined' && localStorage) {
        return localStorage.getItem(key);
      }
    } catch (e) {
      // QuotaExceededError oder andere Fehler (z.B. private Browsing)
      console.warn('localStorage nicht verfügbar:', e);
    }
    return null;
  },
  setItem: (key: string, value: string): void => {
    try {
      if (typeof Storage !== 'undefined' && localStorage) {
        localStorage.setItem(key, value);
      }
    } catch (e) {
      // QuotaExceededError - ignorieren oder warnen
      console.warn('localStorage setItem fehlgeschlagen:', e);
    }
  },
  removeItem: (key: string): void => {
    try {
      if (typeof Storage !== 'undefined' && localStorage) {
        localStorage.removeItem(key);
      }
    } catch (e) {
      console.warn('localStorage removeItem fehlgeschlagen:', e);
    }
  },
};

/**
 * Feature Detection für AbortController
 */
export function supportsAbortController(): boolean {
  return typeof AbortController !== 'undefined';
}

/**
 * Feature Detection für CustomEvent
 */
export function supportsCustomEvent(): boolean {
  return typeof CustomEvent !== 'undefined';
}

/**
 * Feature Detection für Promise.finally
 */
export function supportsPromiseFinally(): boolean {
  return typeof Promise !== 'undefined' && 'finally' in Promise.prototype;
}
