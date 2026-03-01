/**
 * API-Client mit Retry-Mechanismus und Exponential Backoff
 * Unterstützt AbortController für Request-Cancellation
 */

export async function callApiWithRetry(
  url: string,
  options: RequestInit & { signal?: AbortSignal },
  retries: number = 3
): Promise<Response> {
  let lastError: Error | null = null;
  const API_TIMEOUT_MS = 30000;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      // Prüfe ob Request bereits abgebrochen wurde
      if (options.signal?.aborted) {
        throw new Error('Request aborted');
      }

      const controller = new AbortController();
      let timeoutId: NodeJS.Timeout | null = null;
      
      // Timeout nur setzen wenn kein User-Signal vorhanden ist
      if (!options.signal) {
        timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
      }

      // Kombiniere Signale: sowohl Timeout als auch User-Abort
      // Fallback für Browser ohne AbortSignal.any
      let combinedSignal: AbortSignal = controller.signal;
      if (options.signal) {
        if (typeof AbortSignal !== 'undefined' && 'any' in AbortSignal) {
          combinedSignal = (AbortSignal as any).any([controller.signal, options.signal]);
        } else {
          // Fallback: Verwende User-Signal wenn vorhanden
          combinedSignal = options.signal;
        }
      }

      const response = await fetch(url, {
        ...options,
        signal: combinedSignal,
      });

      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      if (response.ok) {
        return response;
      }

      // Bei 4xx-Fehlern nicht retry
      if (response.status >= 400 && response.status < 500) {
        throw new Error(`API-Fehler: ${response.status} ${response.statusText}`);
      }

      // Bei 5xx-Fehlern retry
      lastError = new Error(`API-Fehler: ${response.status} ${response.statusText}`);
    } catch (error: any) {
      lastError = error;

      // Bei AbortError nicht retry
      if (error.name === 'AbortError') {
        throw error;
      }

      if (attempt < retries) {
        // Exponential Backoff
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 15000);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new Error('API-Aufruf fehlgeschlagen');
}
