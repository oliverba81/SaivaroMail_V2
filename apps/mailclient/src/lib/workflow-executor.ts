/**
 * Workflow-Executor: Führt Workflows aus (Orchestrierung von Conditions und Actions)
 */

import type { AutomationWorkflow, EmailDataForAutomation, ExecutionResult, TriggerType } from './automation-engine';
import { getTenantDbClient } from './tenant-db-client';
import { validateWorkflow } from './workflow-validator';
import { evaluateCondition } from './condition-evaluator';
import { executeAction } from './action-executor';
import { logEmailEventWithClient } from './email-events';
import { getCompanyConfig } from './company-config';
import { classifyEmailSpam, SpamClassificationResult } from './ai-spam-classifier';
import type { CompanyConfig } from './company-config';

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

    // Lade CompanyConfig einmalig für diesen Workflow-Lauf (für AI-Entscheidungen)
    const companyConfig = await getCompanyConfig(client);

    // Execution-Context für diesen Lauf (z.B. Spam-Infos, Caching)
    const executionContext: {
      spam: SpamClassificationResult | null;
    } = {
      spam: null,
    };

    const isWhitelistedSender = (
      fromEmail: string | undefined,
      whitelist: string[] | undefined
    ): boolean => {
      if (!fromEmail || !whitelist || whitelist.length === 0) return false;
      const email = fromEmail.toLowerCase().trim();
      const atIndex = email.lastIndexOf('@');
      const domain = atIndex !== -1 ? email.substring(atIndex + 1) : '';

      return whitelist.some((raw) => {
        const entry = String(raw).toLowerCase().trim();
        if (!entry) return false;
        if (entry.startsWith('@')) {
          const dom = entry.slice(1);
          return domain === dom || email.endsWith(`@${dom}`);
        }
        if (entry.includes('@')) {
          return email === entry;
        }
        // Nur Domain ohne @
        return domain === entry || email.endsWith(`@${entry}`);
      });
    };

    // Folge den Edges zu Condition-, Spam- und Action-Knoten
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
        let conditionMet: boolean | null = null;
        if (node.type.includes('Condition')) {
          try {
            conditionMet = evaluateCondition(node.data, emailData);
          } catch (conditionError: any) {
            // Fehler bei Bedingungsauswertung: Bedingung als nicht erfüllt betrachten (fail-safe)
            console.error(
              `[AutomationEngine] Fehler beim Auswerten der Bedingung für Knoten ${nodeId}:`,
              conditionError
            );
            conditionMet = false;
          }
        }

        // Spam-Entscheidungsknoten: Spam-Check (Whitelist + AI) und entlang Ja/Nein verzweigen
        if (node.type === 'spamDecisionNode') {
          try {
            if (!executionContext.spam) {
              const whitelisted = isWhitelistedSender(
                emailData.fromEmail,
                (companyConfig as CompanyConfig).spamSenderWhitelist
              );

              if (whitelisted) {
                executionContext.spam = {
                  isSpam: false,
                  score: 0,
                  reason: 'Absender steht auf der Spam-Whitelist.',
                  provider: companyConfig.aiProvider,
                  fromCache: false,
                };
              } else {
                executionContext.spam = await classifyEmailSpam(companyConfig, emailData);
              }
            }

            const isSpam = executionContext.spam.isSpam;

            // Wähle nur die Kanten, deren sourceHandle zum Ergebnis passt
            const matchingEdges = workflow.workflowData.edges
              .filter((e) => e.source === nodeId)
              .filter((e) => {
                if (isSpam) {
                  return !e.sourceHandle || e.sourceHandle === 'yes';
                }
                return !e.sourceHandle || e.sourceHandle === 'no';
              })
              .sort((a, b) => {
                const targetNodeA = workflow.workflowData.nodes.find((n) => n.id === a.target);
                const targetNodeB = workflow.workflowData.nodes.find((n) => n.id === b.target);

                const yA = targetNodeA?.position?.y ?? 0;
                const yB = targetNodeB?.position?.y ?? 0;

                if (yA !== yB) return yA - yB;

                const xA = targetNodeA?.position?.x ?? 0;
                const xB = targetNodeB?.position?.x ?? 0;
                return xA - xB;
              });

            if (matchingEdges.length === 0) {
              // Kein passender Ausgang – Pfad endet hier
              return;
            }

            for (const edge of matchingEdges) {
              try {
                await processNode(edge.target);
              } catch (nodeError: any) {
                console.error(
                  `[AutomationEngine] Fehler beim Verarbeiten des Folgeknotens ${edge.target} nach Spam-Entscheidung:`,
                  nodeError
                );
              }
            }

            // Spam-Knoten hat seine Arbeit erledigt; reguläres Edge-Processing überspringen
            return;
          } catch (spamError: any) {
            const msg =
              spamError?.message ||
              'Unbekannter Fehler bei der Spam-Entscheidung, Standard: kein Spam, Pfad Nein.';
            console.error(`[AutomationEngine] Fehler beim Spam-Check für Knoten ${nodeId}:`, msg);
            error = msg;
            // Bei Fehler: Standard-Entscheidung "kein Spam" und normale Edge-Logik (ohne sourceHandle-Filter) weiterlaufen lassen
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
              workflow.userId,
              executionContext
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
        // Bestimme ausgehende Edges abhängig vom Knotentyp (Condition mit Ja/Nein, sonst alle)
        const allEdges = workflow.workflowData.edges.filter((e) => e.source === nodeId);

        const sortEdges = (edgesToSort: typeof allEdges) => {
          return edgesToSort.sort((a, b) => {
            const targetNodeA = workflow.workflowData.nodes.find((n) => n.id === a.target);
            const targetNodeB = workflow.workflowData.nodes.find((n) => n.id === b.target);

            const yA = targetNodeA?.position?.y ?? 0;
            const yB = targetNodeB?.position?.y ?? 0;

            if (yA !== yB) {
              return yA - yB;
            }

            const xA = targetNodeA?.position?.x ?? 0;
            const xB = targetNodeB?.position?.x ?? 0;
            return xA - xB;
          });
        };

        let outgoingEdges = allEdges;

        if (node.type.includes('Condition')) {
          const yesEdges = allEdges.filter((e) => e.sourceHandle === 'yes');
          const noEdges = allEdges.filter((e) => e.sourceHandle === 'no');
          const legacyEdges = allEdges.filter((e) => !e.sourceHandle);

          if (conditionMet === true) {
            if (yesEdges.length > 0) {
              outgoingEdges = sortEdges(yesEdges);
            } else if (legacyEdges.length > 0) {
              outgoingEdges = sortEdges(legacyEdges);
            } else {
              // Kein sinnvoller True-Pfad definiert
              return;
            }
          } else if (conditionMet === false) {
            if (noEdges.length > 0) {
              outgoingEdges = sortEdges(noEdges);
            } else {
              // Keine passenden Nein-Kanten: Pfad endet wie bisher
              return;
            }
          } else {
            // Sollte nicht vorkommen, aber zur Sicherheit: alle Edges wie bisher
            outgoingEdges = sortEdges(allEdges);
          }
        } else {
          // Nicht-Condition-Knoten: alle ausgehenden Edges verwenden
          outgoingEdges = sortEdges(allEdges);
        }

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

