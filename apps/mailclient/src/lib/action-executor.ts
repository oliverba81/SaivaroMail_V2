/**
 * Action-Executor: Führt Workflow-Aktionen aus
 */

import { PoolClient } from 'pg';
import type { WorkflowNode, EmailDataForAutomation } from './automation-engine';
import { logEmailEventWithClient } from './email-events';
import { replaceEmailVariables, EmailData } from './automation-variables';
import nodemailer from 'nodemailer';

/**
 * Ermittelt die Abteilung aus dem E-Mail-Kontext
 * Prüft: emails.department_id, email_departments, oder from_email gegen Abteilungs-E-Mail-Konten
 */
async function getDepartmentFromEmailContext(
  client: PoolClient,
  emailData: EmailDataForAutomation
): Promise<{ departmentId: string; emailAccountId: string } | null> {
  try {
    // 1. Prüfe emails.department_id (für gesendete E-Mails)
    if (emailData.id) {
      const emailDeptResult = await client.query(
        `SELECT department_id FROM emails WHERE id = $1 AND department_id IS NOT NULL`,
        [emailData.id]
      );
      
      if (emailDeptResult.rows.length > 0 && emailDeptResult.rows[0].department_id) {
        const departmentId = emailDeptResult.rows[0].department_id;
        // Lade E-Mail-Konto der Abteilung
        const deptResult = await client.query(
          `SELECT email_account_id FROM departments WHERE id = $1 AND is_active = true AND email_account_id IS NOT NULL`,
          [departmentId]
        );
        
        if (deptResult.rows.length > 0 && deptResult.rows[0].email_account_id) {
          return {
            departmentId,
            emailAccountId: deptResult.rows[0].email_account_id,
          };
        }
      }
    }

    // 2. Prüfe email_departments Tabelle (zugewiesene Abteilungen)
    if (emailData.id) {
      const emailDeptResult = await client.query(
        `SELECT d.id, d.email_account_id 
         FROM email_departments ed
         JOIN departments d ON ed.department_id = d.id
         WHERE ed.email_id = $1 AND d.is_active = true AND d.email_account_id IS NOT NULL
         LIMIT 1`,
        [emailData.id]
      );
      
      if (emailDeptResult.rows.length > 0) {
        return {
          departmentId: emailDeptResult.rows[0].id,
          emailAccountId: emailDeptResult.rows[0].email_account_id,
        };
      }
    }

    // 3. Prüfe from_email gegen Abteilungs-E-Mail-Konten
    if (emailData.fromEmail) {
      const fromEmailResult = await client.query(
        `SELECT d.id, d.email_account_id
         FROM departments d
         JOIN email_accounts ea ON d.email_account_id = ea.id
         WHERE ea.email = $1 AND d.is_active = true AND ea.is_active = true
         LIMIT 1`,
        [emailData.fromEmail]
      );
      
      if (fromEmailResult.rows.length > 0) {
        return {
          departmentId: fromEmailResult.rows[0].id,
          emailAccountId: fromEmailResult.rows[0].email_account_id,
        };
      }
    }

    return null;
  } catch (error: any) {
    console.error('[AutomationEngine] Fehler beim Ermitteln der Abteilung:', error);
    return null;
  }
}

/**
 * Führt eine Aktion aus
 */
export async function executeAction(
  client: PoolClient,
  companyId: string,
  actionNode: WorkflowNode,
  emailData: EmailDataForAutomation,
  userId: string
): Promise<{ success: boolean; actionName: string; error?: string }> {
  // Validierung der Eingabeparameter
  if (!actionNode || !actionNode.data) {
    return { success: false, actionName: 'Unbekannte Aktion', error: 'Action-Knoten oder Daten fehlen' };
  }
  
  // Validierung: emailData muss vorhanden sein
  if (!emailData || !emailData.id) {
    return { success: false, actionName: 'Unbekannte Aktion', error: 'E-Mail-Daten fehlen' };
  }
  
  // Validierung: userId muss vorhanden sein
  if (!userId) {
    return { success: false, actionName: 'Unbekannte Aktion', error: 'User-ID fehlt' };
  }
  
  // Validierung: companyId muss vorhanden sein
  if (!companyId) {
    return { success: false, actionName: 'Unbekannte Aktion', error: 'Company-ID fehlt' };
  }
  
  const actionType = actionNode.data.actionType || actionNode.type;

  try {
    switch (actionType) {
      case 'set_theme':
      case 'setThemeAction': {
        const themeId = actionNode.data.themeId;
        if (!themeId) {
          return { success: false, actionName: 'Thema setzen', error: 'Keine Theme-ID angegeben' };
        }

        // Validierung: Thema muss existieren und User gehören
        const themeCheck = await client.query(
          `SELECT id FROM email_themes WHERE id = $1 AND user_id = $2`,
          [themeId, userId]
        );

        if (themeCheck.rows.length === 0) {
          return { success: false, actionName: 'Thema setzen', error: 'Thema existiert nicht oder gehört nicht dem User' };
        }

        await client.query(
          `UPDATE emails SET theme_id = $1 WHERE id = $2`,
          [themeId, emailData.id]
        );

        const themeName = actionNode.data.themeName || 'Unbekannt';
        try {
          await logEmailEventWithClient(client, emailData.id, userId, 'theme_assigned', {
            themeId,
            themeName,
          });
        } catch (logError: any) {
          // Logging-Fehler sollten die Aktion nicht stoppen
          console.error(`[AutomationEngine] Fehler beim Protokollieren des Theme-Events:`, logError);
        }

        return { success: true, actionName: 'Thema setzen' };
      }

      case 'set_urgency':
      case 'setUrgencyAction': {
        const urgency = actionNode.data.urgency;
        if (!urgency || !['low', 'medium', 'high'].includes(urgency)) {
          return { success: false, actionName: 'Dringlichkeit setzen', error: 'Ungültige Dringlichkeit' };
        }

        await client.query(
          `UPDATE emails SET urgency = $1 WHERE id = $2`,
          [urgency, emailData.id]
        );

        try {
          await logEmailEventWithClient(client, emailData.id, userId, 'urgency_set', { urgency });
        } catch (logError: any) {
          // Logging-Fehler sollten die Aktion nicht stoppen
          console.error(`[AutomationEngine] Fehler beim Protokollieren des Urgency-Events:`, logError);
        }

        return { success: true, actionName: 'Dringlichkeit setzen' };
      }

      case 'mark_important':
      case 'markImportantAction': {
        await client.query(
          `UPDATE emails SET important_at = NOW() WHERE id = $1`,
          [emailData.id]
        );

        try {
          await logEmailEventWithClient(client, emailData.id, userId, 'marked_important', {});
        } catch (logError: any) {
          // Logging-Fehler sollten die Aktion nicht stoppen
          console.error(`[AutomationEngine] Fehler beim Protokollieren des Important-Events:`, logError);
        }

        return { success: true, actionName: 'Als wichtig markieren' };
      }

      case 'mark_spam':
      case 'markSpamAction': {
        await client.query(
          `UPDATE emails SET spam_at = NOW() WHERE id = $1`,
          [emailData.id]
        );

        try {
          await logEmailEventWithClient(client, emailData.id, userId, 'marked_spam', {});
        } catch (logError: any) {
          // Logging-Fehler sollten die Aktion nicht stoppen
          console.error(`[AutomationEngine] Fehler beim Protokollieren des Spam-Events:`, logError);
        }

        return { success: true, actionName: 'Als Spam markieren' };
      }

      case 'forward':
      case 'forwardEmailAction': {
        const to = actionNode.data.to;
        if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
          return { success: false, actionName: 'Weiterleiten', error: 'Ungültige E-Mail-Adresse' };
        }

        // Versuche Abteilung aus E-Mail-Kontext zu ermitteln
        const departmentContext = await getDepartmentFromEmailContext(client, emailData);
        
        let account: any = null;
        
        if (departmentContext) {
          // Verwende Abteilungs-E-Mail-Konto
          const accountResult = await client.query(
            `SELECT smtp_host, smtp_port, smtp_username, smtp_password, smtp_ssl, smtp_tls, email
             FROM email_accounts
             WHERE id = $1 AND is_active = true`,
            [departmentContext.emailAccountId]
          );

          if (accountResult.rows.length > 0) {
            account = accountResult.rows[0];
          }
        }

        // Fallback: User-E-Mail-Konto verwenden
        if (!account) {
          const accountResult = await client.query(
            `SELECT smtp_host, smtp_port, smtp_username, smtp_password, smtp_ssl, smtp_tls, email
             FROM email_accounts
             WHERE user_id = $1 AND is_active = true
             AND smtp_host IS NOT NULL 
             AND smtp_username IS NOT NULL 
             AND smtp_password IS NOT NULL
             LIMIT 1`,
            [userId]
          );

          if (accountResult.rows.length === 0) {
            return { success: false, actionName: 'Weiterleiten', error: 'Kein aktives E-Mail-Konto gefunden' };
          }

          account = accountResult.rows[0];
        }

        if (!account.smtp_host || !account.smtp_username || !account.smtp_password) {
          return { success: false, actionName: 'Weiterleiten', error: 'SMTP-Konfiguration unvollständig' };
        }

        // Variablen ersetzen
        const emailDataForVars: EmailData = {
          id: emailData.id,
          subject: emailData.subject,
          fromEmail: emailData.fromEmail,
          toEmail: emailData.toEmail,
          body: emailData.body,
          createdAt: emailData.createdAt,
        };

        const subject = replaceEmailVariables(
          actionNode.data.subject || '{{subject}}',
          emailDataForVars
        );
        const body = replaceEmailVariables(
          actionNode.data.body || '{{body}}',
          emailDataForVars
        );

        // E-Mail senden
        const transporter = nodemailer.createTransport({
          host: account.smtp_host,
          port: account.smtp_port || 587,
          secure: account.smtp_ssl === true,
          auth: {
            user: account.smtp_username,
            pass: account.smtp_password,
          },
          tls: {
            rejectUnauthorized: false,
          },
        });

        // Verwende E-Mail-Adresse aus Konto als Absender
        const senderEmail = account.email || account.smtp_username;
        
        await transporter.sendMail({
          from: senderEmail,
          to: to,
          subject: subject,
          text: body,
        });

        try {
          await logEmailEventWithClient(client, emailData.id, userId, 'forwarded', {
            to,
            subject,
          });
        } catch (logError: any) {
          // Logging-Fehler sollten die Aktion nicht stoppen
          console.error(`[AutomationEngine] Fehler beim Protokollieren des Forward-Events:`, logError);
        }

        return { success: true, actionName: 'Weiterleiten' };
      }

      case 'assign_department':
      case 'assignDepartmentAction': {
        const departmentId = actionNode.data.departmentId;
        if (!departmentId) {
          return { success: false, actionName: 'Abteilung zuweisen', error: 'Keine Abteilung angegeben' };
        }

        // Validierung: Abteilung muss existieren und zur gleichen Company gehören
        const deptCheck = await client.query(
          'SELECT id, name FROM departments WHERE id = $1 AND company_id = $2',
          [departmentId, companyId]
        );

        if (deptCheck.rows.length === 0) {
          return { success: false, actionName: 'Abteilung zuweisen', error: 'Abteilung existiert nicht oder gehört nicht zur Company' };
        }

        const departmentName = deptCheck.rows[0].name;

        // Prüfe, ob Zuweisung bereits existiert
        const existingCheck = await client.query(
          'SELECT 1 FROM email_departments WHERE email_id = $1 AND department_id = $2',
          [emailData.id, departmentId]
        );

        if (existingCheck.rows.length === 0) {
          // Füge Zuweisung hinzu
          await client.query(
            'INSERT INTO email_departments (email_id, department_id) VALUES ($1, $2)',
            [emailData.id, departmentId]
          );
        }

        try {
          await logEmailEventWithClient(client, emailData.id, userId, 'department_assigned', {
            departmentId,
            departmentName,
          });
        } catch (logError: any) {
          // Logging-Fehler sollten die Aktion nicht stoppen
          console.error(`[AutomationEngine] Fehler beim Protokollieren des Department-Assignment-Events:`, logError);
        }

        return { success: true, actionName: 'Abteilung zuweisen' };
      }

      case 'mark_completed':
      case 'markCompletedAction': {
        await client.query(
          `INSERT INTO email_completed_status (email_id, user_id, completed_at)
           VALUES ($1, $2, NOW())
           ON CONFLICT (email_id, user_id) 
           DO UPDATE SET completed_at = NOW(), updated_at = NOW()`,
          [emailData.id, userId]
        );
        try {
          await logEmailEventWithClient(client, emailData.id, userId, 'marked_completed', {});
        } catch (logError: any) {
          console.error(`[AutomationEngine] Fehler beim Protokollieren:`, logError);
        }
        return { success: true, actionName: 'Als erledigt markieren' };
      }

      case 'mark_uncompleted':
      case 'markUncompletedAction': {
        await client.query(
          `DELETE FROM email_completed_status WHERE email_id = $1 AND user_id = $2`,
          [emailData.id, userId]
        );
        try {
          await logEmailEventWithClient(client, emailData.id, userId, 'marked_uncompleted', {});
        } catch (logError: any) {
          console.error(`[AutomationEngine] Fehler beim Protokollieren:`, logError);
        }
        return { success: true, actionName: 'Als unerledigt markieren' };
      }

      case 'mark_read':
      case 'markReadAction': {
        await client.query(
          `INSERT INTO email_read_status (email_id, user_id, read_at)
           VALUES ($1, $2, NOW())
           ON CONFLICT (email_id, user_id) 
           DO UPDATE SET read_at = NOW(), updated_at = NOW()`,
          [emailData.id, userId]
        );
        try {
          await logEmailEventWithClient(client, emailData.id, userId, 'marked_read', {});
        } catch (logError: any) {
          console.error(`[AutomationEngine] Fehler beim Protokollieren:`, logError);
        }
        return { success: true, actionName: 'Als gelesen markieren' };
      }

      case 'mark_unread':
      case 'markUnreadAction': {
        await client.query(
          `DELETE FROM email_read_status WHERE email_id = $1 AND user_id = $2`,
          [emailData.id, userId]
        );
        try {
          await logEmailEventWithClient(client, emailData.id, userId, 'marked_unread', {});
        } catch (logError: any) {
          console.error(`[AutomationEngine] Fehler beim Protokollieren:`, logError);
        }
        return { success: true, actionName: 'Als ungelesen markieren' };
      }

      case 'mark_read_and_completed':
      case 'markReadAndCompletedAction': {
        await client.query(
          `INSERT INTO email_read_status (email_id, user_id, read_at)
           VALUES ($1, $2, NOW())
           ON CONFLICT (email_id, user_id) 
           DO UPDATE SET read_at = NOW(), updated_at = NOW()`,
          [emailData.id, userId]
        );
        await client.query(
          `INSERT INTO email_completed_status (email_id, user_id, completed_at)
           VALUES ($1, $2, NOW())
           ON CONFLICT (email_id, user_id) 
           DO UPDATE SET completed_at = NOW(), updated_at = NOW()`,
          [emailData.id, userId]
        );
        try {
          await logEmailEventWithClient(client, emailData.id, userId, 'marked_read', {});
          await logEmailEventWithClient(client, emailData.id, userId, 'marked_completed', {});
        } catch (logError: any) {
          console.error(`[AutomationEngine] Fehler beim Protokollieren:`, logError);
        }
        return { success: true, actionName: 'Als gelesen und erledigt markieren' };
      }

      default:
        return { success: false, actionName: 'Unbekannte Aktion', error: `Unbekannter Aktionstyp: ${actionType}` };
    }
  } catch (error: any) {
    return { success: false, actionName: actionType, error: error.message || 'Unbekannter Fehler' };
  }
}

