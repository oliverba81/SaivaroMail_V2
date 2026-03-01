/**
 * Condition-Evaluator: Evaluiert Bedingungen gegen E-Mail-Daten und filtert E-Mails
 */

import type { EmailDataForAutomation, WorkflowData, WorkflowNode } from './automation-engine';

/** Einzelne Bedingungsregel (field, operator, value) */
export interface ConditionRule {
  field: string;
  operator: string;
  value?: string;
}

/**
 * Evaluiert eine einzelne Bedingungsregel gegen E-Mail-Daten
 */
function evaluateSingleCondition(
  condition: ConditionRule | { field?: string; operator?: string; value?: string },
  emailData: EmailDataForAutomation
): boolean {
  try {
    if (!condition || typeof condition !== 'object' || !condition.field || !condition.operator) {
      return true;
    }
    if (!emailData) {
      return true;
    }

    const field = condition.field;
    const operator = condition.operator;
    const value = condition.value ?? '';

    let emailValue: string = '';

    switch (field) {
      case 'subject':
        emailValue = emailData.subject || '';
        break;
      case 'from':
        emailValue = emailData.fromEmail || '';
        if (emailValue) {
          const emailMatch = emailValue.match(/<([^>]+)>/) || emailValue.match(/([^\s<>]+@[^\s<>]+)/);
          emailValue = emailMatch ? emailMatch[1] : emailValue;
        }
        break;
      case 'to':
        emailValue = emailData.toEmail || '';
        break;
      case 'body':
        emailValue = emailData.body || '';
        break;
      case 'phone_number':
        emailValue = emailData.phoneNumber || '';
        break;
      case 'type':
        emailValue = emailData.type || 'email';
        break;
      case 'urgency':
        emailValue = emailData.urgency || '';
        break;
      case 'themeId':
      case 'theme':
        emailValue = emailData.themeId || '';
        break;
      case 'read':
        emailValue = emailData.read === true ? 'true' : 'false';
        break;
      case 'completed':
        emailValue = emailData.completed === true ? 'true' : 'false';
        break;
      case 'hasAttachment':
        emailValue = emailData.hasAttachment === true ? 'true' : 'false';
        break;
      default:
        return true;
    }

    const strEmail = String(emailValue ?? '');
    const compareValue = String(value ?? '').toLowerCase();

    // Operatoren, die keinen Wert brauchen
    if (operator === 'isEmpty' || operator === 'isNotEmpty') {
      const isEmpty = strEmail.trim() === '';
      return operator === 'isEmpty' ? isEmpty : !isEmpty;
    }

    // notEquals
    if (operator === 'notEquals') {
      if (field === 'read' || field === 'completed' || field === 'hasAttachment') {
        const boolVal = value.toLowerCase() === 'true' || value === 'yes' || value === '1';
        const actual = field === 'read' ? emailData.read : field === 'completed' ? emailData.completed : emailData.hasAttachment;
        return actual !== boolVal;
      }
      if (field === 'to') {
        const addresses = strEmail
          .split(',')
          .map(addr => {
            const m = addr.match(/<([^>]+)>/) || addr.match(/([^\s<>]+@[^\s<>]+)/);
            return m ? m[1].trim().toLowerCase() : addr.trim().toLowerCase();
          })
          .filter(addr => addr && addr.includes('@'));
        return !addresses.some(addr => addr === compareValue);
      }
      if (field === 'type') {
        return (emailData.type || 'email') !== value;
      }
      return strEmail.toLowerCase() !== compareValue;
    }

    // matchesRegex (Wert = Regex-String)
    if (operator === 'matchesRegex') {
      try {
        const regex = new RegExp(value, 'i');
        return regex.test(strEmail);
      } catch {
        return false;
      }
    }

    const emailValueLower = strEmail.toLowerCase();

    switch (operator) {
      case 'contains':
        return emailValueLower.includes(compareValue);
      case 'equals':
      case 'is':
        if (field === 'to') {
          const addresses = strEmail
            .split(',')
            .map(addr => {
              const m = addr.match(/<([^>]+)>/) || addr.match(/([^\s<>]+@[^\s<>]+)/);
              return m ? m[1].trim().toLowerCase() : addr.trim().toLowerCase();
            })
            .filter(addr => addr && addr.includes('@'));
          return addresses.some(addr => addr === compareValue);
        }
        if (field === 'type') {
          return (emailData.type || 'email') === value;
        }
        if (field === 'urgency') {
          return (emailData.urgency || '') === value;
        }
        if (field === 'themeId' || field === 'theme') {
          return (emailData.themeId || '') === value;
        }
        if (field === 'read' || field === 'completed' || field === 'hasAttachment') {
          const boolVal = value.toLowerCase() === 'true' || value === 'yes' || value === '1';
          const actual = field === 'read' ? emailData.read : field === 'completed' ? emailData.completed : emailData.hasAttachment;
          return actual === boolVal;
        }
        return emailValueLower === compareValue;
      case 'startsWith':
        return emailValueLower.startsWith(compareValue);
      case 'endsWith':
        return emailValueLower.endsWith(compareValue);
      case 'notContains':
        return !emailValueLower.includes(compareValue);
      default:
        return true;
    }
  } catch (error: any) {
    console.error('[AutomationEngine] Fehler beim Auswerten der Bedingung:', error);
    return true;
  }
}

/**
 * Evaluiert eine Bedingung gegen E-Mail-Daten (einzelne Regel oder conditions-Array + combineMode)
 */
export function evaluateCondition(
  condition: any,
  emailData: EmailDataForAutomation
): boolean {
  try {
    if (!condition || typeof condition !== 'object') {
      return true;
    }
    if (!emailData) {
      return true;
    }

    // Mehrfachbedingungen (Phase 2): conditions-Array + combineMode
    const conditions = condition.conditions;
    if (Array.isArray(conditions) && conditions.length > 0) {
      const combineMode = (condition.combineMode || 'and') as 'and' | 'or';
      const results = conditions.map((c: ConditionRule) => evaluateSingleCondition(c, emailData));
      return combineMode === 'and' ? results.every(Boolean) : results.some(Boolean);
    }

    // Einzelbedingung (rückwärtskompatibel)
    return evaluateSingleCondition(condition, emailData);
  } catch (error: any) {
    console.error('[AutomationEngine] Fehler beim Auswerten der Bedingung:', error);
    return true;
  }
}

/**
 * Filtert E-Mails basierend auf Workflow-Bedingungen (Condition-Nodes)
 */
export function filterEmailsByWorkflowConditions(
  emails: EmailDataForAutomation[],
  workflowData: WorkflowData
): EmailDataForAutomation[] {
  // Finde Start-Block
  const startNode = workflowData.nodes.find((n) => 
    n.type === 'workflowStartNode' || n.type.includes('Start')
  );
  
  if (!startNode) {
    // Wenn kein Start-Block gefunden, werden alle E-Mails zurückgegeben
    return emails;
  }

  // Finde Condition-Nodes, die direkt vom Start-Block erreichbar sind
  const conditionNodes = workflowData.edges
    .filter((e) => e.source === startNode.id)
    .map((e) => workflowData.nodes.find((n) => n.id === e.target))
    .filter((n): n is WorkflowNode => n !== undefined && n.type.includes('Condition'));

  if (conditionNodes.length === 0) {
    // Wenn keine Condition-Nodes vorhanden, werden alle E-Mails zurückgegeben
    return emails;
  }

  // Filtere E-Mails: Alle Condition-Nodes müssen erfüllt sein (AND-Logik)
  return emails.filter((email) => {
    return conditionNodes.every((conditionNode) => {
      return evaluateCondition(conditionNode.data, email);
    });
  });
}

