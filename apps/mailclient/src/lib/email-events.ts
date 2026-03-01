import { PoolClient } from 'pg';
import { getTenantDbClient } from './tenant-db-client';

export type EmailEventType =
  | 'received'
  | 'read'
  | 'unread'
  | 'marked_read'
  | 'marked_unread'
  | 'deleted'
  | 'restored'
  | 'marked_important'
  | 'marked_spam'
  | 'marked_completed'
  | 'marked_uncompleted'
  | 'theme_assigned'
  | 'urgency_set'
  | 'department_assigned'
  | 'department_removed'
  | 'forwarded'
  | 'automation_triggered'
  | 'automation_applied'
  | 'automation_rule_activated'
  | 'automation_rule_deactivated'
  | 'ticket_assigned'
  | 'ticket_reused'
  | 'conversation_created';

export interface EmailEventData {
  [key: string]: any;
  themeId?: string;
  themeName?: string;
  urgency?: 'low' | 'medium' | 'high';
  to?: string;
  subject?: string;
  ruleId?: string;
  ruleName?: string;
  actionType?: string;
  departmentId?: string;
  departmentName?: string;
}

/**
 * Protokolliert ein Event für eine E-Mail
 * Verhindert Duplikate innerhalb von 1 Sekunde (gleicher Typ, gleiche E-Mail, gleicher User)
 */
export async function logEmailEvent(
  companyId: string,
  emailId: string,
  userId: string,
  eventType: EmailEventType,
  eventData: EmailEventData = {}
): Promise<void> {
  const client = await getTenantDbClient(companyId);

  try {
    // Prüfe, ob innerhalb der letzten 5 Sekunden bereits ein Event mit gleichem Typ existiert
    const recentEvent = await client.query(
      `SELECT id, created_at FROM email_events 
       WHERE email_id = $1 AND user_id = $2 AND event_type = $3 
       AND created_at > NOW() - INTERVAL '5 seconds'
       ORDER BY created_at DESC
       LIMIT 1`,
      [emailId, userId, eventType]
    );

    // Wenn kein Duplikat gefunden wurde, erstelle neues Event
    if (recentEvent.rows.length === 0) {
      await client.query(
        `INSERT INTO email_events (email_id, user_id, event_type, event_data, created_at)
         VALUES ($1, $2, $3, $4, NOW())
         RETURNING id, created_at`,
        [emailId, userId, eventType, JSON.stringify(eventData)]
      );
    } else {
      console.log(`Event ${eventType} für E-Mail ${emailId} wurde bereits vor kurzem protokolliert, überspringe Duplikat`);
    }
  } finally {
    client.release();
  }
}

/**
 * Lädt alle Events für eine E-Mail (chronologisch sortiert)
 */
export async function getEmailEvents(
  companyId: string,
  emailId: string,
  userId: string,
  limit: number = 100,
  sort: 'asc' | 'desc' = 'desc'
): Promise<Array<{
  id: string;
  emailId: string;
  userId: string;
  userName?: string;
  userEmail?: string;
  eventType: EmailEventType;
  eventData: EmailEventData;
  createdAt: Date;
}>> {
  const client = await getTenantDbClient(companyId);

  try {
    const result = await client.query(
      `SELECT 
         ee.id, 
         ee.email_id, 
         ee.user_id, 
         ee.event_type, 
         ee.event_data, 
         ee.created_at,
         COALESCE(
           NULLIF(TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))), ''),
           u.username,
           u.email,
           'Unbekannt'
         ) as user_name,
         u.email as user_email
       FROM email_events ee
       LEFT JOIN users u ON ee.user_id = u.id
       WHERE ee.email_id = $1 AND ee.user_id = $2
       ORDER BY ee.created_at ${sort.toUpperCase()}
       LIMIT $3`,
      [emailId, userId, limit]
    );

    return result.rows.map((row) => {
      // event_data kann ein JSON-String oder bereits ein Objekt sein
      let eventData = row.event_data || {};
      if (typeof eventData === 'string') {
        try {
          eventData = JSON.parse(eventData);
        } catch (e) {
          console.error('Fehler beim Parsen von event_data:', e);
          eventData = {};
        }
      }
      
      return {
        id: row.id,
        emailId: row.email_id,
        userId: row.user_id,
        userName: row.user_name || undefined,
        userEmail: row.user_email || undefined,
        eventType: row.event_type as EmailEventType,
        eventData: eventData,
        createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
      };
    });
  } finally {
    client.release();
  }
}

/**
 * Protokolliert ein Event direkt mit einem Client (für Transaktionen)
 */
export async function logEmailEventWithClient(
  client: PoolClient,
  emailId: string,
  userId: string,
  eventType: EmailEventType,
  eventData: EmailEventData = {}
): Promise<void> {
  await client.query(
    `INSERT INTO email_events (email_id, user_id, event_type, event_data, created_at)
     VALUES ($1, $2, $3, $4, NOW())`,
    [emailId, userId, eventType, JSON.stringify(eventData)]
  );
}

