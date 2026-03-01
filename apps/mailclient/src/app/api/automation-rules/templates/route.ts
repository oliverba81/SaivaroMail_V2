import { NextRequest, NextResponse } from 'next/server';
import { extractTokenFromHeader, verifyToken } from '@/lib/auth';

/**
 * Hilfsfunktion: Tenant-Context und Auth extrahieren
 */
async function extractContext(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const token = extractTokenFromHeader(authHeader);

  if (!token) {
    return { error: 'Authorization-Token erforderlich', status: 401 };
  }

  const payload = verifyToken(token);

  if (!payload) {
    return { error: 'Ungültiger Token', status: 401 };
  }

  return { userId: payload.sub };
}

/**
 * GET /api/automation-rules/templates
 * Lädt Regel-Vorlagen
 */
export async function GET(request: NextRequest) {
  try {
    const context = await extractContext(request);
    if ('error' in context) {
      return NextResponse.json({ error: context.error }, { status: context.status });
    }

    // Vorgefertigte Vorlagen
    const templates = [
      {
        id: 'mark-important-from',
        name: 'E-Mails von Absender als wichtig markieren',
        description: 'Markiert alle E-Mails von einem bestimmten Absender als wichtig',
        category: 'Einfach',
        workflowData: {
          nodes: [
            {
              id: 'trigger-1',
              type: 'workflowStartNode',
              position: { x: 100, y: 100 },
              data: { label: 'Start' },
            },
            {
              id: 'condition-1',
              type: 'emailCondition',
              position: { x: 300, y: 100 },
              data: {
                label: 'Bedingung',
                field: 'from',
                operator: 'contains',
                value: '',
              },
            },
            {
              id: 'action-1',
              type: 'markImportantAction',
              position: { x: 500, y: 100 },
              data: { label: 'Als wichtig markieren', actionType: 'mark_important' },
            },
          ],
          edges: [
            { id: 'e1-2', source: 'trigger-1', target: 'condition-1' },
            { id: 'e2-3', source: 'condition-1', target: 'action-1' },
          ],
        },
      },
      {
        id: 'assign-theme-by-subject',
        name: 'Thema nach Betreff zuweisen',
        description: 'Weist E-Mails mit bestimmten Begriffen im Betreff ein Thema zu',
        category: 'Einfach',
        workflowData: {
          nodes: [
            {
              id: 'trigger-1',
              type: 'workflowStartNode',
              position: { x: 100, y: 100 },
              data: { label: 'Start' },
            },
            {
              id: 'condition-1',
              type: 'emailCondition',
              position: { x: 300, y: 100 },
              data: {
                label: 'Bedingung',
                field: 'subject',
                operator: 'contains',
                value: '',
              },
            },
            {
              id: 'action-1',
              type: 'setThemeAction',
              position: { x: 500, y: 100 },
              data: { label: 'Thema setzen', actionType: 'set_theme', themeId: '' },
            },
          ],
          edges: [
            { id: 'e1-2', source: 'trigger-1', target: 'condition-1' },
            { id: 'e2-3', source: 'condition-1', target: 'action-1' },
          ],
        },
      },
      {
        id: 'forward-by-domain',
        name: 'E-Mails von Domain weiterleiten',
        description: 'Leitet E-Mails von einer bestimmten Domain weiter',
        category: 'Erweitert',
        workflowData: {
          nodes: [
            {
              id: 'trigger-1',
              type: 'workflowStartNode',
              position: { x: 100, y: 100 },
              data: { label: 'Start' },
            },
            {
              id: 'condition-1',
              type: 'emailCondition',
              position: { x: 300, y: 100 },
              data: {
                label: 'Bedingung',
                field: 'from',
                operator: 'contains',
                value: '',
              },
            },
            {
              id: 'action-1',
              type: 'forwardEmailAction',
              position: { x: 500, y: 100 },
              data: {
                label: 'Weiterleiten',
                actionType: 'forward',
                to: '',
                subject: '{{subject}}',
                body: '{{body}}',
              },
            },
          ],
          edges: [
            { id: 'e1-2', source: 'trigger-1', target: 'condition-1' },
            { id: 'e2-3', source: 'condition-1', target: 'action-1' },
          ],
        },
      },
      {
        id: 'set-urgency-high',
        name: 'Hohe Dringlichkeit setzen',
        description: 'Setzt hohe Dringlichkeit für E-Mails mit bestimmten Begriffen',
        category: 'Einfach',
        workflowData: {
          nodes: [
            {
              id: 'trigger-1',
              type: 'workflowStartNode',
              position: { x: 100, y: 100 },
              data: { label: 'Start' },
            },
            {
              id: 'condition-1',
              type: 'emailCondition',
              position: { x: 300, y: 100 },
              data: {
                label: 'Bedingung',
                field: 'subject',
                operator: 'contains',
                value: '',
              },
            },
            {
              id: 'action-1',
              type: 'setUrgencyAction',
              position: { x: 500, y: 100 },
              data: { label: 'Dringlichkeit setzen', actionType: 'set_urgency', urgency: 'high' },
            },
          ],
          edges: [
            { id: 'e1-2', source: 'trigger-1', target: 'condition-1' },
            { id: 'e2-3', source: 'condition-1', target: 'action-1' },
          ],
        },
      },
    ];

    return NextResponse.json({ templates });
  } catch (error: any) {
    console.error('Fehler beim Laden der Vorlagen:', error);
    return NextResponse.json(
      { error: 'Fehler beim Laden der Vorlagen' },
      { status: 500 }
    );
  }
}

