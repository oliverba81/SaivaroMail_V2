/**
 * Formatiert Bytes in lesbare Größen (KB, MB, GB, TB, PB)
 * @param bytes - Anzahl der Bytes
 * @param decimals - Anzahl der Dezimalstellen (Standard: 2)
 * @returns Formatierte Größe als String (z.B. "1.5 MB")
 */
export function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return '0 Bytes';
  if (bytes < 0) {
    console.warn('formatBytes: Negative Zahl erhalten, verwende 0');
    return '0 Bytes';
  }
  if (!Number.isFinite(bytes)) {
    console.warn('formatBytes: Nicht-endliche Zahl erhalten, verwende 0');
    return '0 Bytes';
  }
  if (bytes < 1) {
    // Sehr kleine Zahlen (< 1 Byte) werden als 0 Bytes behandelt
    return '0 Bytes';
  }
  
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  // Sicherstellen, dass i im gültigen Bereich ist
  const index = Math.min(Math.max(0, i), sizes.length - 1);
  
  return parseFloat((bytes / Math.pow(k, index)).toFixed(dm)) + ' ' + sizes[index];
}



