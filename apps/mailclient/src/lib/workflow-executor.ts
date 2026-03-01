/**
 * Workflow-Executor: Führt Workflows aus (Orchestrierung von Conditions und Actions)
 */

import type { AutomationWorkflow, EmailDataForAutomation, ExecutionResult, TriggerType } from './automation-engine';
import { getTenantDbClient } from './tenant-db-client';
import { validateWorkflow } from './workflow-validator';
import { evaluateCondition } from './condition-evaluator';
import { executeAction } from './action-executor';
import { logEmailEventWithClient } from './email-events';

/**
 * Führt eine Automatisierungsregel aus
 */
export async function executeWorkflow(
  companyId: string,
  workflow: AutomationWorkflow,
  emailData: EmailDataForAutomation,
  _triggerType: TriggerType,
  dryRun: boolean = false
): Promise<ExecutionResult> {
  const startTime = Date.now();
  const executedActions: string[] = [];
  let error: string | undefined;

  const client = await getTenantDbClient(companyId);

  try {
    // Validierung der Eingabeparameter
    if (!workflow.workflowData || !workflow.workflowData.nodes || !workflow.workflowData.edges) {
      return {
        success: false,
        executedActions: [],
        error: 'Workflow-Daten fehlen oder sind ungültig',
        executionTimeMs: Date.now() - startTime,
      };
    }

    // Workflow validieren
    const validation = validateWorkflow(workflow.workflowData);
    if (!validation.valid) {
      return {
        success: false,
        executedActions: [],
        error: `Workflow ungültig: ${validation.errors.join(', ')}`,
        executionTimeMs: Date.now() - startTime,
      };
    }

    if (dryRun) {
      return {
        success: true,
        executedActions: ['Dry-Run: Workflow validiert'],
        executionTimeMs: Date.now() - startTime,
      };
    }

    // Workflow ausführen: Starte beim Start-Block
    // Der Trigger-Typ wird bereits auf Regel-Ebene geprüft (getActiveRules filtert)
    const startNode = workflow.workflowData.nodes.find((n) => 
      n.type === 'workflowStartNode' || n.type.includes('Start')
    );

    if (!startNode) {
      return {
        success: false,
        executedActions: [],
        error: `Kein Start-Block im Workflow gefunden`,
        executionTimeMs: Date.now() - startTime,
      };
    }

    // Folge den Edges zu Condition- und Action-Knoten
    // Verwende ein Set, um bereits verarbeitete Knoten zu tracken (verhindert Endlosschleifen bei fehlerhaften Workflows)
    const visitedNodes = new Set<string>();
    
    const processNode = async (nodeId: string): Promise<void> => {
      try {
        // Verhindere Endlosschleifen (sollte durch Validierung verhindert werden, aber sicherheitshalber)
        if (visitedNodes.has(nodeId)) {
          console.warn(`[AutomationEngine] Knoten ${nodeId} wurde bereits verarbeitet, überspringe (möglicher Zyklus)`);
          return;
        }
        visitedNodes.add(nodeId);

        const node = workflow.workflowData.nodes.find((n) => n.id === nodeId);
        if (!node) {
          console.warn(`[AutomationEngine] Knoten ${nodeId} nicht gefunden im Workflow`);
          return;
        }

        // Condition-Knoten: Bedingung evaluieren
        if (node.type.includes('Condition')) {
          try {
            const conditionMet = evaluateCondition(node.data, emailData);
            if (!conditionMet) {
              return; // Bedingung nicht erfüllt, stoppe hier
            }
          } catch (conditionError: any) {
            // Fehler bei Bedingungsauswertung: Bedingung als nicht erfüllt betrachten (fail-safe)
            console.error(`[AutomationEngine] Fehler beim Auswerten der Bedingung für Knoten ${nodeId}:`, conditionError);
            return;
          }
        }

        // Action-Knoten: Aktion ausführen
        if (node.type.includes('Action')) {
          try {
            const result = await executeAction(
              client,
              companyId,
              node,
              emailData,
              workflow.userId
            );
            if (result.success) {
              executedActions.push(result.actionName);
            } else {
              // Fehler bei Aktion: Fehler protokollieren, aber Workflow fortsetzen (falls weitere Aktionen folgen)
              error = result.error || 'Unbekannter Fehler bei Aktion';
              console.error(`[AutomationEngine] Aktion fehlgeschlagen für Knoten ${nodeId}:`, error);
              // Wirft keinen Fehler mehr, sondern protokolliert nur - Workflow kann fortgesetzt werden
              // Wenn Aktion kritisch ist, sollte der Workflow-Designer das berücksichtigen
            }
          } catch (actionError: any) {
            // Unerwarteter Fehler bei Aktion: protokollieren und fortsetzen
            error = actionError.message || 'Unbekannter Fehler bei Aktion';
            console.error(`[AutomationEngine] Unerwarteter Fehler bei Aktion für Knoten ${nodeId}:`, actionError);
            // Workflow wird fortgesetzt, aber Fehler wird protokolliert
          }
        }

        // Folge zu nächsten Knoten (auch wenn vorherige Aktion fehlgeschlagen ist)
        // Sortiere Edges nach Y-Position der Zielknoten (von oben nach unten)
        const outgoingEdges = workflow.workflowData.edges
          .filter((e) => e.source === nodeId)
          .sort((a, b) => {
            // Finde Zielknoten für beide Edges
            const targetNodeA = workflow.workflowData.nodes.find((n) => n.id === a.target);
            const targetNodeB = workflow.workflowData.nodes.find((n) => n.id === b.target);
            
            // Sortiere nach Y-Position (von oben nach unten)
            const yA = targetNodeA?.position?.y ?? 0;
            const yB = targetNodeB?.position?.y ?? 0;
            
            if (yA !== yB) {
              return yA - yB; // Aufsteigend nach Y (oben zuerst)
            }
            
            // Bei gleicher Y-Position: sortiere nach X (links zuerst)
            const xA = targetNodeA?.position?.x ?? 0;
            const xB = targetNodeB?.position?.x ?? 0;
            return xA - xB;
          });
        
        for (const edge of outgoingEdges) {
          try {
            await processNode(edge.target);
          } catch (nodeError: any) {
            // Fehler bei Verarbeitung eines Folgeknotens: protokollieren, aber weiter machen
            console.error(`[AutomationEngine] Fehler beim Verarbeiten des Folgeknotens ${edge.target}:`, nodeError);
            // Weiter mit nächstem Edge
          }
        }
      } catch (nodeError: any) {
        // Unerwarteter Fehler beim Verarbeiten des Knotens: protokollieren
        console.error(`[AutomationEngine] Unerwarteter Fehler beim Verarbeiten des Knotens ${nodeId}:`, nodeError);
        error = nodeError.message || 'Unbekannter Fehler beim Verarbeiten des Knotens';
        // Fehler wird protokolliert, aber Workflow wird nicht komplett gestoppt
      }
    };

    // Starte Workflow beim Start-Block
    try {
      await processNode(startNode.id);
    } catch (startError: any) {
      // Fehler beim Starten des Workflows: protokollieren
      console.error(`[AutomationEngine] Fehler beim Starten des Workflows:`, startError);
      error = startError.message || 'Fehler beim Starten des Workflows';
    }

    // Regel-Statistiken aktualisieren (nur bei Erfolg)
    await client.query(
      `UPDATE automation_rules 
       SET execution_count = execution_count + 1, 
           last_executed_at = NOW()
       WHERE id = $1`,
      [workflow.id]
    ).catch((dbError) => {
      // DB-Fehler sollten die Ausführung nicht stoppen
      console.error(`[AutomationEngine] Fehler beim Aktualisieren der Regel-Statistiken:`, dbError);
    });

    // Event protokollieren (nur bei Erfolg)
    await logEmailEventWithClient(client, emailData.id, workflow.userId, 'automation_applied', {
      ruleId: workflow.id,
      ruleName: workflow.name,
    }).catch((logError) => {
      // Logging-Fehler sollten die Ausführung nicht stoppen
      console.error(`[AutomationEngine] Fehler beim Protokollieren des Events:`, logError);
    });

    return {
      success: true,
      executedActions,
      executionTimeMs: Date.now() - startTime,
    };
  } catch (err: any) {
    error = err.message || 'Unbekannter Fehler';
    console.error(`[AutomationEngine] Fehler beim Ausführen des Workflows ${workflow.id}:`, err);
    return {
      success: false,
      executedActions,
      error,
      executionTimeMs: Date.now() - startTime,
    };
  } finally {
    client.release();
  }
}

