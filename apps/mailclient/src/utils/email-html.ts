import DOMPurify, { Config } from 'dompurify';

// Basis-Konfiguration: Scripts/Iframes und gefährliche Event-Attribute verbieten,
// ansonsten DOMPurify möglichst viel HTML-Struktur und Styles erhalten lassen.
const BASE_SANITIZE_CONFIG: Config = {
  FORBID_TAGS: ['script', 'iframe'],
  FORBID_ATTR: ['onload', 'onclick', 'onerror', 'onmouseover', 'onmouseout', 'onfocus', 'onblur'],
};

// Deutlich konservativere HTML-Erkennung:
// - benötigt ein echtes HTML-Tag aus einer bekannten Liste (z.B. <p>, <div>, <a ...>, </table>, img)
// - vermeidet False Positives wie reine Links in spitzen Klammern: <https://example.com>
const HTML_DETECTION_REGEX =
  /<\/(html|body|head|p|div|span|a|table|tr|td|th|tbody|thead|ul|ol|li|br|b|strong|i|em|img)[^>]*>|<(html|body|head|p|div|span|a|table|tr|td|th|tbody|thead|ul|ol|li|br|b|strong|i|em|img)(\s|>)/i;

export function bodyLooksLikeHtml(body: string | null | undefined): boolean {
  if (!body) return false;
  const trimmed = body.trim();
  if (!trimmed.includes('<') || !trimmed.includes('>')) return false;
  return HTML_DETECTION_REGEX.test(trimmed);
}

export interface SanitizeEmailHtmlOptions {
  /** Externe Inhalte wie Bilder explizit zulassen (http/https). */
  allowExternalContent?: boolean;
  /**
   * Versucht, das ursprüngliche Layout von komplexen HTML-Newslettern möglichst wenig zu beeinflussen.
   * Z. B. weniger aggressive Eingriffe in Layout-relevante Styles/Attribute.
   */
  preserveMailLayout?: boolean;
}

export function sanitizeEmailHtml(body: string, options?: SanitizeEmailHtmlOptions): string {
  if (!body) return '';
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return body
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
      .replace(/<img[^>]*>/gi, '');
  }

  const allowExternalContent = options?.allowExternalContent === true;

  // Layoutfreundliche Konfiguration: Basis plus optionale Erweiterungen für externe Bilder.
  const config: Config = allowExternalContent
    ? {
        ...BASE_SANITIZE_CONFIG,
        ADD_TAGS: ['img'],
        ADD_ATTR: ['src', 'srcset', 'referrerpolicy'],
      }
    : BASE_SANITIZE_CONFIG;

  const sanitized = DOMPurify.sanitize(body, config);

  // Links standardmäßig sicher im neuen Tab öffnen, falls nicht bereits gesetzt
  // (DOMPurify entfernt gefährliche Protokolle wie javascript:)
  const temp = document.createElement('div');
  temp.innerHTML = sanitized;
  const links = temp.querySelectorAll<HTMLAnchorElement>('a[href]');
  links.forEach((a) => {
    if (!a.target) a.target = '_blank';
    const rel = (a.getAttribute('rel') || '').split(' ').filter(Boolean);
    if (!rel.includes('noopener')) rel.push('noopener');
    if (!rel.includes('noreferrer')) rel.push('noreferrer');
    a.setAttribute('rel', rel.join(' '));

    // Zusätzliche Absicherung gegen unerwünschte Protokolle in href.
    const href = (a.getAttribute('href') || '').trim();
    if (href && !href.startsWith('#')) {
      const lower = href.toLowerCase();
      if (lower.startsWith('javascript:') || lower.startsWith('data:')) {
        a.removeAttribute('href');
      }
    }
  });

  // Bei externen Bildern: referrerpolicy="no-referrer" setzen (Datenschutz)
  // und nur http/https-Quellen für echte externe Bilder zulassen.
  if (allowExternalContent) {
    const imgs = temp.querySelectorAll<HTMLImageElement>('img');

    imgs.forEach((img) => {
      const src = (img.getAttribute('src') || '').trim();

      // Protokoll-Whitelist für externe URLs: nur http/https gelten als extern.
      if (src) {
        const isHttp = src.startsWith('http://') || src.startsWith('https://');
        const isRelative = src.startsWith('/') || src.startsWith('./') || src.startsWith('../');
        const isData = src.startsWith('data:');

        // Absolute, nicht http(s)-URLs entfernen (z. B. ftp:, file:)
        if (!isHttp && !isRelative && !isData) {
          img.removeAttribute('src');
        }
      }

      img.setAttribute('referrerpolicy', 'no-referrer');
      img.setAttribute('loading', 'lazy');
    });
  }

  return temp.innerHTML;
}

/** Prüft, ob der HTML-Body externe img-Tags enthält (src mit http:// oder https://). */
export function hasExternalImages(html: string | null | undefined): boolean {
  if (!html || !bodyLooksLikeHtml(html)) return false;
  if (typeof document === 'undefined') return false;
  const temp = document.createElement('div');
  temp.innerHTML = html;
  const imgs = temp.querySelectorAll<HTMLImageElement>('img[src]');
  for (const img of imgs) {
    const src = (img.getAttribute('src') || '').trim();
    if (src.startsWith('http://') || src.startsWith('https://')) {
      try {
        new URL(src);
        return true;
      } catch {
        // Ungültige URL überspringen
      }
    }
  }
  // srcset prüfen
  const imgsWithSrcset = temp.querySelectorAll<HTMLImageElement>('img[srcset]');
  for (const img of imgsWithSrcset) {
    const srcset = img.getAttribute('srcset') || '';
    const parts = srcset.split(',').map((p) => p.trim().split(/\s+/)[0]);
    for (const part of parts) {
      if (part && (part.startsWith('http://') || part.startsWith('https://'))) {
        try {
          new URL(part);
          return true;
        } catch {
          // Ungültige URL überspringen
        }
      }
    }
  }
  return false;
}

/** Extrahiert eindeutige Domains aus img[src] und img[srcset] (nur absolute http(s) URLs). */
export function extractExternalContentSources(html: string | null | undefined): string[] {
  if (!html) return [];
  if (typeof document === 'undefined') return [];
  const domains = new Set<string>();
  const temp = document.createElement('div');
  temp.innerHTML = html;

  const collectFromUrl = (url: string) => {
    const u = url.trim();
    if (!u.startsWith('http://') && !u.startsWith('https://')) return;
    try {
      const parsed = new URL(u);
      if (parsed.hostname) domains.add(parsed.hostname.toLowerCase());
    } catch {
      // Ungültige URL überspringen
    }
  };

  const imgs = temp.querySelectorAll<HTMLImageElement>('img');
  for (const img of imgs) {
    const src = img.getAttribute('src');
    if (src) collectFromUrl(src);
    const srcset = img.getAttribute('srcset') || '';
    srcset.split(',').forEach((part) => {
      const url = part.trim().split(/\s+/)[0];
      if (url) collectFromUrl(url);
    });
  }

  return Array.from(domains);
}

