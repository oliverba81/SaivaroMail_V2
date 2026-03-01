/**
 * Workflow-Validator: Validiert Workflows auf Zyklen, Erreichbarkeit und Struktur
 */

import type { WorkflowData } from './automation-engine';

/**
 * Validiert einen Workflow (Zyklen-Erkennung, etc.)
 */
export function validateWorkflow(workflow: WorkflowData): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Genau 1 Start-Block und mindestens 1 Aktion
  const startNodes = workflow.nodes.filter((n) => 
    n.type === 'workflowStartNode' || n.type.includes('Start')
  );
  const actionNodes = workflow.nodes.filter((n) => n.type.includes('Action'));

  if (startNodes.length === 0) {
    errors.push('Workflow muss genau einen Start-Block enthalten');
  }
  if (startNodes.length > 1) {
    errors.push('Workflow darf nur einen Start-Block enthalten');
  }
  if (actionNodes.length === 0) {
    errors.push('Workflow muss mindestens einen Action-Knoten enthalten');
  }

  // Alle Knoten-IDs müssen eindeutig sein
  const nodeIds = workflow.nodes.map((n) => n.id);
  const uniqueNodeIds = new Set(nodeIds);
  if (nodeIds.length !== uniqueNodeIds.size) {
    errors.push('Alle Knoten-IDs müssen eindeutig sein');
  }

  // Zyklen-Erkennung (einfache DFS)
  const visited = new Set<string>();
  const recStack = new Set<string>();

  function hasCycle(nodeId: string): boolean {
    if (recStack.has(nodeId)) {
      return true; // Zyklus gefunden
    }
    if (visited.has(nodeId)) {
      return false;
    }

    visited.add(nodeId);
    recStack.add(nodeId);

    const outgoingEdges = workflow.edges.filter((e) => e.source === nodeId);
    for (const edge of outgoingEdges) {
      if (hasCycle(edge.target)) {
        return true;
      }
    }

    recStack.delete(nodeId);
    return false;
  }

  for (const node of workflow.nodes) {
    if (!visited.has(node.id) && hasCycle(node.id)) {
      errors.push('Workflow enthält Zyklen (Endlosschleifen)');
      break;
    }
  }

  // Alle Knoten müssen verbunden sein (von Start-Block aus erreichbar)
  const reachable = new Set<string>();
  const startNodeIds = startNodes.map((n) => n.id);

  function markReachable(nodeId: string) {
      reachable.add(nodeId);
      const outgoingEdges = workflow.edges.filter((e) => e.source === nodeId);
      for (const edge of outgoingEdges) {
        if (!reachable.has(edge.target)) {
          markReachable(edge.target);
        }
      }
  }

  for (const startNodeId of startNodeIds) {
    markReachable(startNodeId);
  }

  const unreachableNodes = workflow.nodes.filter((n) => !reachable.has(n.id));
  if (unreachableNodes.length > 0) {
    errors.push(`Nicht erreichbare Knoten: ${unreachableNodes.map((n) => n.id).join(', ')}`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

