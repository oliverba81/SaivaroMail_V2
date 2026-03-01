/**
 * Ersetzt E-Mail-Variablen in einem String
 * Unterstützte Variablen:
 * - {{subject}} - E-Mail-Betreff
 * - {{from}} - Absender-E-Mail
 * - {{fromName}} - Absender-Name (falls vorhanden)
 * - {{to}} - Empfänger-E-Mail
 * - {{body}} - E-Mail-Inhalt
 * - {{date}} - Empfangsdatum
 * - {{id}} - E-Mail-ID
 */
export interface EmailData {
  id?: string;
  subject?: string;
  fromEmail?: string;
  fromName?: string;
  toEmail?: string;
  body?: string;
  createdAt?: Date;
}

export function replaceEmailVariables(
  template: string,
  emailData: EmailData
): string {
  let result = template;

  // {{subject}}
  result = result.replace(/\{\{subject\}\}/g, emailData.subject || '');

  // {{from}}
  result = result.replace(/\{\{from\}\}/g, emailData.fromEmail || '');

  // {{fromName}}
  result = result.replace(/\{\{fromName\}\}/g, emailData.fromName || emailData.fromEmail || '');

  // {{to}}
  result = result.replace(/\{\{to\}\}/g, emailData.toEmail || '');

  // {{body}}
  result = result.replace(/\{\{body\}\}/g, emailData.body || '');

  // {{date}}
  if (emailData.createdAt) {
    const dateStr = emailData.createdAt.toLocaleString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    result = result.replace(/\{\{date\}\}/g, dateStr);
  } else {
    result = result.replace(/\{\{date\}\}/g, '');
  }

  // {{id}}
  result = result.replace(/\{\{id\}\}/g, emailData.id || '');

  return result;
}

/**
 * Validiert, ob ein String gültige E-Mail-Variablen enthält
 */
export function validateEmailVariables(template: string): {
  valid: boolean;
  invalidVariables: string[];
} {
  const validVariables = [
    'subject',
    'from',
    'fromName',
    'to',
    'body',
    'date',
    'id',
  ];

  const variablePattern = /\{\{(\w+)\}\}/g;
  const foundVariables: string[] = [];
  let match;

  while ((match = variablePattern.exec(template)) !== null) {
    foundVariables.push(match[1]);
  }

  const invalidVariables = foundVariables.filter(
    (v) => !validVariables.includes(v)
  );

  return {
    valid: invalidVariables.length === 0,
    invalidVariables,
  };
}



