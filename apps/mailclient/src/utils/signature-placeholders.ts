/**
 * Ersetzt Platzhalter in Signatur-Texten.
 * Syntax: {{variableName}} (doppelte geschweifte Klammern).
 * Company: {{companyName}}, {{companyAddress}}, {{companyPhone}}, {{companyEmail}}, {{companyWebsite}}
 * User: {{userName}}, {{userFirstName}}, {{userLastName}}
 */

/**
 * Prüft, ob ein String wie HTML aussieht (enthält mindestens einen Tag).
 * Wird u. a. für Legacy-Plain-Text-Fallback und E-Mail-Body-Format genutzt.
 */
export function looksLikeHtml(str: string): boolean {
  return /<[a-z][\s\S]*>/i.test(str || '');
}

/**
 * Entfernt alle HTML-Tags aus einem String (Plain-Text daraus erzeugen).
 * Null/undefined-sicher.
 */
export function stripHtml(html: string): string {
  return (html || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

/**
 * Prüft, ob der Inhalt eines <p>...</p> leer ist (nur Whitespace, &nbsp;, &#160;, <br>).
 */
function isParagraphContentEmpty(inner: string): boolean {
  let textOnly = inner.replace(/<[^>]*>/g, '');
  textOnly = textOnly.replace(/&nbsp;/gi, ' ').replace(/&#160;/gi, ' ').replace(/&#x00A0;/gi, ' ').replace(/\u00A0/g, ' ');
  return textOnly.trim().length === 0;
}

/**
 * Entfernt abschließende Leerabsätze (z. B. <p></p>, <p><br></p>, <p>&nbsp;</p>, <p><br><br><br></p>)
 * am Ende des HTML-Strings.
 */
export function trimTrailingEmptyParagraphs(html: string): string {
  let s = (html || '').trim();
  if (!s) return s;
  const lastP = /<\s*p(\s[^>]*)?\s*>([\s\S]*?)<\s*\/\s*p\s*>\s*$/i;
  let prev = '';
  while (prev !== s) {
    prev = s;
    const match = s.match(lastP);
    if (!match) break;
    const fullMatch = match[0];
    const innerContent = match[2];
    if (!isParagraphContentEmpty(innerContent)) break;
    s = s.slice(0, -fullMatch.length).trim();
  }
  return s;
}

const BLANK_LINE_HTML = '<p><br></p>';

/**
 * Reduziert aufeinanderfolgende leere Absätze (überall im HTML) auf genau eine Leerzeile.
 * Die gespeicherte Abteilungs-Signatur kann z. B. durch TinyMCE viele <p>&nbsp;</p> oder
 * <p><span></span><br>...</p> enthalten – diese werden so gebündelt.
 */
export function collapseConsecutiveEmptyParagraphs(html: string): string {
  const s = (html || '').trim();
  if (!s) return s;
  const pRegex = /<\s*p(\s[^>]*)?\s*>([\s\S]*?)<\s*\/\s*p\s*>/gi;
  const matches: { index: number; full: string; empty: boolean }[] = [];
  let m: RegExpExecArray | null;
  while ((m = pRegex.exec(s)) !== null) {
    matches.push({
      index: m.index,
      full: m[0],
      empty: isParagraphContentEmpty(m[2]),
    });
  }
  if (matches.length === 0) return s;
  let result = '';
  let pos = 0;
  let i = 0;
  while (i < matches.length) {
    const cur = matches[i];
    if (cur.empty) {
      let j = i + 1;
      while (j < matches.length && matches[j].empty) j++;
      const lastInRun = matches[j - 1];
      result += s.slice(pos, cur.index) + BLANK_LINE_HTML;
      pos = lastInRun.index + lastInRun.full.length;
      i = j;
      continue;
    }
    result += s.slice(pos, cur.index + cur.full.length);
    pos = cur.index + cur.full.length;
    i++;
  }
  result += s.slice(pos);
  return result;
}

/**
 * Entfernt alle Leerabsätze unmittelbar vor <hr> und setzt genau eine Leerzeile davor.
 * @param expectedHrIndex - Optional: Nur kollabieren, wenn <hr> an dieser Position steht.
 */
export function collapseEmptyParagraphsBeforeHr(html: string, expectedHrIndex?: number): string {
  const hrMatch = html.match(/<\s*hr\s[\s\S]*?>|<\s*hr\s*\/?\s*>/i);
  if (!hrMatch || hrMatch.index == null) return html;
  if (expectedHrIndex != null && hrMatch.index !== expectedHrIndex) return html;
  const hrIdx = hrMatch.index;
  const beforeHr = html.slice(0, hrIdx);
  const hrTag = hrMatch[0];
  const afterHr = html.slice(hrIdx + hrTag.length);
  const trimmedBefore = trimTrailingEmptyParagraphs(beforeHr);
  return trimmedBefore + hrTag + afterHr;
}

/**
 * Prüft, ob der übergebene HTML-String leer ist bzw. nur leere Editor-Knoten enthält
 * (z. B. <p></p>, <p><br></p>). Wird beim Speichern und bei der Signatur-Auswahl genutzt.
 */
export function isEmptyEditorHtml(html: string): boolean {
  const s = (html || '').trim();
  if (!s) return true;
  // Inhalt ohne Tags prüfen – wenn nur Leerzeichen/Leerzeilen übrig sind, gilt als leer
  const textOnly = s.replace(/<[^>]*>/g, '').replace(/&nbsp;/gi, ' ').trim();
  return textOnly.length === 0;
}

export interface SignatureCompanyContext {
  name?: string | null;
  contactAddress?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
  contactWebsite?: string | null;
}

export interface SignatureUserContext {
  userName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
}

export interface SignaturePlaceholderContext {
  company?: SignatureCompanyContext | null;
  user?: SignatureUserContext | null;
}

const COMPANY_PLACEHOLDERS: Record<string, keyof SignatureCompanyContext> = {
  companyName: 'name',
  companyAddress: 'contactAddress',
  companyPhone: 'contactPhone',
  companyEmail: 'contactEmail',
  companyWebsite: 'contactWebsite',
};

const USER_PLACEHOLDERS: Record<string, keyof SignatureUserContext> = {
  userName: 'userName',
  userFirstName: 'firstName',
  userLastName: 'lastName',
};

/**
 * Ersetzt Platzhalter im Format {{variableName}} im Template.
 * Fehlende oder unbekannte Platzhalter werden durch leeren String ersetzt.
 */
export function replaceSignaturePlaceholders(
  template: string,
  context: SignaturePlaceholderContext
): string {
  if (!template || typeof template !== 'string') return '';

  const company = context.company ?? null;
  const user = context.user ?? null;

  return template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
    if (COMPANY_PLACEHOLDERS[key] !== undefined) {
      if (!company) return '';
      const field = COMPANY_PLACEHOLDERS[key];
      const value = company[field];
      return value != null && value !== '' ? String(value) : '';
    }
    if (USER_PLACEHOLDERS[key] !== undefined) {
      if (!user) return '';
      const field = USER_PLACEHOLDERS[key];
      const value = user[field];
      return value != null && value !== '' ? String(value) : '';
    }
    return '';
  });
}
