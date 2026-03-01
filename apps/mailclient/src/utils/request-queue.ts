/**
 * Request-Queue für intelligentes Request-Management
 * Priorisiert kritische Requests (User-Interaktionen)
 * Batch ähnliche Requests zusammen
 * Intelligente Request-Deduplication
 */

interface QueuedRequest {
  request: () => Promise<any>;
  priority: number;
  id?: string; // Optional: für Deduplication
}

export class RequestQueue {
  private queue: QueuedRequest[] = [];
  private processing = false;
  private pendingRequests = new Map<string, Promise<any>>();

  /**
   * Fügt einen Request zur Queue hinzu
   * @param request - Die Request-Funktion
   * @param priority - Priorität (höher = wichtiger, Standard: 0)
   * @param id - Optional: Eindeutige ID für Deduplication
   */
  async add(
    request: () => Promise<any>,
    priority: number = 0,
    id?: string
  ): Promise<any> {
    // Request-Deduplication: Prüfe ob identischer Request bereits läuft
    if (id) {
      const existingRequest = this.pendingRequests.get(id);
      if (existingRequest) {
        return existingRequest;
      }
    }

    // Erstelle Promise für diesen Request
    const requestPromise = (async () => {
      // Füge zur Queue hinzu
      this.queue.push({ request, priority, id });
      // Sortiere nach Priorität (höhere Priorität zuerst)
      this.queue.sort((a, b) => b.priority - a.priority);
      
      // Starte Verarbeitung
      await this.process();
      
      // Führe Request aus
      return request();
    })();

    // Speichere Promise für Deduplication
    if (id) {
      this.pendingRequests.set(id, requestPromise);
      requestPromise.finally(() => {
        this.pendingRequests.delete(id);
      });
    }

    return requestPromise;
  }

  /**
   * Verarbeitet die Queue
   */
  private async process() {
    if (this.processing || this.queue.length === 0) return;
    
    this.processing = true;
    
    try {
      while (this.queue.length > 0) {
        const { request } = this.queue.shift()!;
        try {
          await request();
        } catch (error) {
          // Fehler werden nicht weitergegeben, um andere Requests nicht zu blockieren
          console.error('Request-Queue: Fehler bei Request:', error);
        }
      }
    } finally {
      this.processing = false;
    }
  }

  /**
   * Gibt die aktuelle Queue-Größe zurück
   */
  get size(): number {
    return this.queue.length;
  }

  /**
   * Leert die Queue
   */
  clear() {
    this.queue = [];
    this.pendingRequests.clear();
  }
}

// Singleton-Instanz für globale Verwendung
export const globalRequestQueue = new RequestQueue();
