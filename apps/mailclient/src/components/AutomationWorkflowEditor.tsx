'use client';

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ToastProvider';
import {
  ReactFlow,
  Node,
  Edge,
  addEdge,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  Connection,
  ReactFlowProvider,
  EdgeProps,
  EdgeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  FiBriefcase,
  FiCheckCircle,
  FiFilter,
  FiMail,
  FiPlay,
  FiSave,
  FiSend,
  FiStar,
  FiTag,
  FiX,
  FiXCircle,
  FiZap,
} from 'react-icons/fi';
import { nodeTypes } from './AutomationWorkflowEditor/nodes';
import { CustomEdge } from './AutomationWorkflowEditor/edges';

interface WorkflowNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: {
    label?: string;
    [key: string]: any;
  };
}

interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
}

interface WorkflowData {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  viewport?: { x: number; y: number; zoom: number };
}

interface AutomationWorkflowEditorProps {
  initialWorkflow?: WorkflowData;
  onSave: (workflow: WorkflowData) => void;
  onCancel: () => void;
}

function WorkflowEditorContent({
  initialWorkflow,
  onSave,
  onCancel,
}: {
  initialWorkflow?: WorkflowData;
  onSave: (workflow: WorkflowData) => void;
  onCancel: () => void;
}) {
  const toast = useToast();
  const initialNodes = useMemo(() => {
    // Wenn kein Workflow vorhanden oder keine Knoten, erstelle einen Start-Knoten
    if (!initialWorkflow?.nodes || initialWorkflow.nodes.length === 0) {
      return [
        {
          id: 'workflowStartNode-1',
          type: 'startNode',
          position: { x: 250, y: 100 },
          data: {
            label: 'Start',
            type: 'workflowStartNode',
          },
        },
      ];
    }
    
    // Konvertiere bestehende Knoten
    const convertedNodes = initialWorkflow.nodes.map((n) => {
      let nodeType = 'actionNode';
      let originalType = n.type;
      
      // Migration: Konvertiere alte Trigger-Knoten zu Start-Blöcken
      if (n.type.includes('Trigger') || n.type.includes('trigger') || n.type === 'workflowStartNode') {
        nodeType = 'startNode';
        originalType = 'workflowStartNode';
      } else if (n.type.includes('Condition') || n.type.includes('condition')) {
        nodeType = 'conditionNode';
      } else if (n.type.includes('Department') || n.type.includes('department') || n.type === 'departmentNode') {
        nodeType = 'departmentNode';
        originalType = 'departmentNode';
      }
      
      const nodeData: any = { ...n.data, type: originalType }; // Original-Typ speichern
      // Entferne triggerType aus nodeData (nicht mehr benötigt für Start-Block)
      if (nodeData.triggerType) {
        delete nodeData.triggerType;
      }
      
      // Stelle sicher, dass actionType für Action-Knoten gesetzt ist
      if (nodeType === 'actionNode' && !nodeData.actionType) {
        // Versuche actionType aus type zu extrahieren
        if (originalType === 'assignDepartmentAction') {
          nodeData.actionType = 'assign_department';
        } else if (originalType.includes('Action')) {
          nodeData.actionType = originalType.replace('Action', '').toLowerCase().replace(/([A-Z])/g, '_$1').toLowerCase();
        }
      }
      
      return {
        id: n.id,
        type: nodeType,
        position: n.position,
        data: nodeData,
      };
    });
    
    // Prüfe, ob bereits ein Start-Knoten vorhanden ist
    const hasStartNode = convertedNodes.some((n) => n.type === 'startNode');
    
    // Wenn kein Start-Knoten vorhanden, füge einen hinzu
    if (!hasStartNode) {
      return [
        {
          id: 'workflowStartNode-1',
          type: 'startNode',
          position: { x: 250, y: 100 },
          data: {
            label: 'Start',
            type: 'workflowStartNode',
          },
        },
        ...convertedNodes,
      ];
    }
    
    return convertedNodes;
  }, [initialWorkflow]);

  const initialEdges = useMemo(() => {
    if (!initialWorkflow?.edges) return [];
    return initialWorkflow.edges.map((e) => ({
      id: e.id || `edge-${e.source}-${e.target}-${Date.now()}`,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle,
      targetHandle: e.targetHandle,
      deletable: true,
    }));
  }, [initialWorkflow]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  
  // Stelle sicher, dass immer ein Start-Knoten vorhanden ist
  useEffect(() => {
    const hasStartNode = nodes.some((n) => n.type === 'startNode');
    
    if (!hasStartNode) {
      // Finde die beste Position für den Start-Knoten (oberhalb aller anderen Knoten oder Standard-Position)
      let startY = 100;
      if (nodes.length > 0) {
        const minY = Math.min(...nodes.map((n) => n.position.y));
        startY = Math.max(50, minY - 150);
      }
      
      const startNode = {
        id: `workflowStartNode-${Date.now()}`,
        type: 'startNode',
        position: { x: 250, y: startY },
        data: {
          label: 'Start',
          type: 'workflowStartNode',
        },
      };
      
      setNodes((nds) => {
        // Prüfe nochmal, ob inzwischen ein Start-Knoten hinzugefügt wurde
        if (nds.some((n) => n.type === 'startNode')) {
          return nds;
        }
        return [startNode, ...nds];
      });
    }
  }, [nodes.length, setNodes]); // Reagiere auf Änderungen der Knoten-Anzahl
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<Edge | null>(null);
  const [nodeConfig, setNodeConfig] = useState<any>({});
  const reactFlowInstanceRef = useRef<any>(null);
  const [themes, setThemes] = useState<Array<{ id: string; name: string; color: string | null }>>([]);
  const [loadingThemes, setLoadingThemes] = useState(false);
  const [departments, setDepartments] = useState<Array<{ id: string; name: string }>>([]);
  const [loadingDepartments, setLoadingDepartments] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1.0);
  const router = useRouter();


  const onConnect = useCallback(
    (params: Connection) => {
      setEdges((eds) => addEdge({ ...params, deletable: true }, eds));
    },
    [setEdges]
  );

  const onEdgesDelete = useCallback(
    (deleted: Edge[]) => {
      // onEdgesChange wird automatisch aufgerufen, aber wir müssen hier die Auswahl zurücksetzen
      if (selectedEdge && deleted.find((d) => d.id === selectedEdge.id)) {
        setSelectedEdge(null);
      }
    },
    [selectedEdge]
  );

  const handleEdgeDelete = useCallback(
    (edgeId: string) => {
      setEdges((eds) => eds.filter((e) => e.id !== edgeId));
      if (selectedEdge?.id === edgeId) {
        setSelectedEdge(null);
      }
    },
    [setEdges, selectedEdge]
  );

  const edgeTypes: EdgeTypes = useMemo(
    () => ({
      default: (props: EdgeProps) => <CustomEdge {...props} onDelete={handleEdgeDelete} />,
    }),
    [handleEdgeDelete]
  );

  const onEdgeClick = useCallback(
    (_event: React.MouseEvent, edge: Edge) => {
      setSelectedEdge(edge);
      setSelectedNode(null);
    },
    []
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const type = event.dataTransfer.getData('application/reactflow');
      if (!type || !reactFlowInstanceRef.current) return;

      const position = reactFlowInstanceRef.current.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const nodeType = type === 'workflowStartNode' ? 'startNode' 
        : type.includes('Condition') ? 'conditionNode' 
        : type.includes('Department') || type === 'departmentNode' ? 'departmentNode'
        : 'actionNode';
      const defaultData = getDefaultNodeData(type);
      
      const newNode = {
        id: `${type}-${Date.now()}`,
        type: nodeType,
        position,
        data: {
          label: getNodeLabel(type),
          type: type, // Original-Typ speichern
          // actionType wird aus defaultData übernommen, falls vorhanden
          ...defaultData,
          // Falls defaultData kein actionType hat, generiere es
          actionType: defaultData.actionType || (type.includes('Action') ? type.replace('Action', '').toLowerCase().replace(/([A-Z])/g, '_$1').toLowerCase() : undefined),
        },
      };

      setNodes((nds) => [...nds, newNode as any]);
    },
    [reactFlowInstanceRef, setNodes]
  );

  const getNodeLabel = (type: string): string => {
    const labels: Record<string, string> = {
      workflowStartNode: 'Start',
      emailCondition: 'Bedingung',
      setThemeAction: 'Thema setzen',
      setUrgencyAction: 'Dringlichkeit setzen',
      markImportantAction: 'Als wichtig markieren',
      markSpamAction: 'Als Spam markieren',
      forwardEmailAction: 'Weiterleiten',
      departmentNode: 'Abteilung',
      assignDepartmentAction: 'Abteilung zuweisen',
      markCompletedAction: 'Als erledigt markieren',
      markUncompletedAction: 'Als unerledigt markieren',
      markReadAction: 'Als gelesen markieren',
      markUnreadAction: 'Als ungelesen markieren',
      markReadAndCompletedAction: 'Als gelesen und erledigt markieren',
    };
    return labels[type] || type;
  };

  const getDefaultNodeData = (type: string): any => {
    if (type === 'workflowStartNode') {
      return {}; // Keine triggerType mehr für Start-Block
    }
    if (type === 'departmentNode') {
      return { departmentIds: [], departmentNames: [] };
    }
    if (type === 'setThemeAction') {
      return { actionType: 'set_theme' };
    }
    if (type === 'setUrgencyAction') {
      return { actionType: 'set_urgency' };
    }
    if (type === 'markImportantAction') {
      return { actionType: 'mark_important' };
    }
    if (type === 'markSpamAction') {
      return { actionType: 'mark_spam' };
    }
    if (type === 'forwardEmailAction') {
      return { actionType: 'forward' };
    }
    if (type === 'assignDepartmentAction') {
      return { actionType: 'assign_department' };
    }
    if (type === 'markCompletedAction') return { actionType: 'mark_completed' };
    if (type === 'markUncompletedAction') return { actionType: 'mark_uncompleted' };
    if (type === 'markReadAction') return { actionType: 'mark_read' };
    if (type === 'markUnreadAction') return { actionType: 'mark_unread' };
    if (type === 'markReadAndCompletedAction') return { actionType: 'mark_read_and_completed' };
    return {};
  };

  const onNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
    const nodeData = node.data as any || {};
    // Stelle sicher, dass actionType gesetzt ist, wenn es ein Action-Knoten ist
    if (node.type === 'actionNode' && !nodeData.actionType && nodeData.type) {
      // Versuche actionType aus type zu extrahieren
      if (nodeData.type === 'assignDepartmentAction') {
        nodeData.actionType = 'assign_department';
      } else if (nodeData.type.includes('Action')) {
        nodeData.actionType = nodeData.type.replace('Action', '').toLowerCase().replace(/([A-Z])/g, '_$1').toLowerCase();
      }
    }
    // Debug-Logging
    console.log('[onNodeClick] Node clicked:', {
      nodeType: node.type,
      nodeDataType: nodeData.type,
      nodeDataActionType: nodeData.actionType,
      fullNodeData: nodeData
    });
    setNodeConfig({ ...nodeData, actionType: nodeData.actionType || (nodeData.type === 'assignDepartmentAction' ? 'assign_department' : undefined) });
  }, []);

  // Lade Themen beim Mount
  useEffect(() => {
    const loadThemes = async () => {
      try {
        setLoadingThemes(true);
        const token = localStorage.getItem('mailclient_token');
        if (!token) {
          return;
        }

        const response = await fetch('/api/themes', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.status === 401) {
          localStorage.removeItem('mailclient_token');
          localStorage.removeItem('mailclient_user');
          router.push('/login');
          return;
        }

        if (response.ok) {
          const data = await response.json();
          setThemes(data.themes || []);
        }
      } catch (err) {
        console.error('Fehler beim Laden der Themen:', err);
      } finally {
        setLoadingThemes(false);
      }
    };

    loadThemes();
  }, [router]);

  // Lade Abteilungen beim Mount
  useEffect(() => {
    const loadDepartments = async () => {
      try {
        setLoadingDepartments(true);
        const token = localStorage.getItem('mailclient_token');
        if (!token) return;

        const response = await fetch('/api/departments?includeInactive=false', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.status === 401) {
          localStorage.removeItem('mailclient_token');
          localStorage.removeItem('mailclient_user');
          router.push('/login');
          return;
        }

        if (response.ok) {
          const data = await response.json();
          // Filtere nur aktive Abteilungen (zusätzliche Sicherheit)
          setDepartments((data.departments || [])
            .filter((d: any) => d.isActive === true)
            .map((d: any) => ({
              id: d.id,
              name: d.name,
            })));
        }
      } catch (err) {
        console.error('Fehler beim Laden der Abteilungen:', err);
      } finally {
        setLoadingDepartments(false);
      }
    };

    loadDepartments();
  }, [router]);

  const updateNodeData = useCallback(
    (nodeId: string, data: any) => {
      setNodes((nds) =>
        nds.map((node) =>
          node.id === nodeId ? { ...node, data: { ...node.data, ...data } } : node
        )
      );
      setNodeConfig({ ...nodeConfig, ...data });
    },
    [setNodes, nodeConfig]
  );

  const deleteNode = useCallback(
    (nodeId: string) => {
      setNodes((nds) => nds.filter((n) => n.id !== nodeId));
      setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
      if (selectedNode?.id === nodeId) {
        setSelectedNode(null);
      }
    },
    [setNodes, setEdges, selectedNode]
  );

  const handleSave = () => {
    // Validierung: Genau 1 Start-Block und mindestens 1 Aktion
    const startNodes = nodes.filter((n) => n.type === 'startNode');
    const hasAction = nodes.some((n) => n.type === 'actionNode');

    if (startNodes.length === 0) {
      toast.showWarning('Workflow muss genau einen Start-Block enthalten');
      return;
    }

    if (startNodes.length > 1) {
      toast.showWarning('Workflow darf nur einen Start-Block enthalten');
      return;
    }

    if (!hasAction) {
      toast.showWarning('Workflow muss mindestens einen Action-Knoten enthalten');
      return;
    }

    const workflowData: WorkflowData = {
      nodes: nodes.map((n) => {
        const nodeData = { ...n.data };
        // Entferne triggerType aus nodeData (nicht mehr benötigt)
        delete nodeData.triggerType;
        
        // Bestimme den korrekten Typ für den gespeicherten Workflow
        let savedType: string;
        if (n.type === 'startNode') {
          savedType = 'workflowStartNode';
        } else if (n.type === 'conditionNode') {
          savedType = n.data.type || 'emailCondition';
        } else {
          // Für Action-Knoten: verwende den Typ aus data.type oder den actionType
          savedType = n.data.type || n.data.actionType || 'actionNode';
        }
        
        return {
          id: n.id,
          type: savedType,
          position: n.position,
          data: {
            ...nodeData,
            label: nodeData.label || getNodeLabel(savedType),
          },
        };
      }),
      edges: edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        sourceHandle: e.sourceHandle,
        targetHandle: e.targetHandle,
      })),
      viewport: reactFlowInstanceRef.current?.getViewport() || { x: 0, y: 0, zoom: 1 },
    };

    onSave(workflowData);
  };

  return (
    <div style={{ display: 'flex', height: '100%', width: '100%', gap: '1rem', overflow: 'hidden' }}>
      {/* Sidebar mit verfügbaren Knoten */}
      <div
        style={{
          width: '250px',
          borderRight: '1px solid #dee2e6',
          padding: '1rem',
          overflowY: 'auto',
          backgroundColor: '#f8f9fa',
        }}
      >
        <h3 style={{ marginTop: 0, marginBottom: '1rem' }}>Knoten hinzufügen</h3>

        <div style={{ marginBottom: '1.5rem' }}>
          <h4 style={{ fontSize: '0.875rem', color: '#6c757d', marginBottom: '0.5rem' }}>Trigger</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('application/reactflow', 'workflowStartNode');
              }}
              style={{
                padding: '0.75rem',
                border: '1px solid #dee2e6',
                borderRadius: '6px',
                backgroundColor: 'white',
                cursor: 'grab',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#e9ecef';
                e.currentTarget.style.cursor = 'grab';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'white';
              }}
            >
              <FiPlay />
              <span>Start</span>
            </div>
          </div>
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <h4 style={{ fontSize: '0.875rem', color: '#6c757d', marginBottom: '0.5rem' }}>Bedingungen</h4>
          <div
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData('application/reactflow', 'emailCondition');
            }}
            style={{
              padding: '0.75rem',
              border: '1px solid #dee2e6',
              borderRadius: '6px',
              backgroundColor: 'white',
              cursor: 'grab',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#e9ecef';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'white';
            }}
          >
            <FiFilter />
            <span>E-Mail-Bedingung</span>
          </div>
        </div>


        <div>
          <h4 style={{ fontSize: '0.875rem', color: '#6c757d', marginBottom: '0.5rem' }}>Aktionen</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {[
              { type: 'setThemeAction', label: 'Thema setzen', icon: <FiTag /> },
              { type: 'setUrgencyAction', label: 'Dringlichkeit setzen', icon: <FiZap /> },
              { type: 'markImportantAction', label: 'Als wichtig markieren', icon: <FiStar /> },
              { type: 'markSpamAction', label: 'Als Spam markieren', icon: <FiX /> },
              { type: 'forwardEmailAction', label: 'Weiterleiten', icon: <FiSend /> },
              { type: 'assignDepartmentAction', label: 'Abteilung zuweisen', icon: <FiBriefcase /> },
              { type: 'markCompletedAction', label: 'Als erledigt markieren', icon: <FiCheckCircle /> },
              { type: 'markUncompletedAction', label: 'Als unerledigt markieren', icon: <FiCheckCircle /> },
              { type: 'markReadAction', label: 'Als gelesen markieren', icon: <FiMail /> },
              { type: 'markUnreadAction', label: 'Als ungelesen markieren', icon: <FiMail /> },
              { type: 'markReadAndCompletedAction', label: 'Als gelesen und erledigt markieren', icon: <FiCheckCircle /> },
            ].map((item) => (
              <div
                key={item.type}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('application/reactflow', item.type);
                }}
                style={{
                  padding: '0.75rem',
                  border: '1px solid #dee2e6',
                  borderRadius: '6px',
                  backgroundColor: 'white',
                  cursor: 'grab',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#e9ecef';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'white';
                }}
              >
                {item.icon}
                <span>{item.label.replace(/^[^\s]+\s/, '')}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Canvas */}
      <div style={{ flex: 1, position: 'relative', border: '1px solid #dee2e6', backgroundColor: '#f8f9fa' }}>
        <div
          style={{
            padding: '1rem',
            borderBottom: '1px solid #dee2e6',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: 'white',
          }}
        >
          <h3 style={{ margin: 0 }}>Workflow-Editor</h3>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={handleSave}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <FiSave />
              Speichern
            </button>
            <button
              onClick={onCancel}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <FiXCircle />
              Abbrechen
            </button>
          </div>
        </div>

        <div style={{ width: '100%', height: 'calc(100% - 65px)' }}>
          <ReactFlow
            nodes={nodes}
            edges={edges.map((edge) => ({
              ...edge,
              type: 'default',
              deletable: true,
              selected: selectedEdge?.id === edge.id,
            }))}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onEdgesDelete={onEdgesDelete}
            onEdgeClick={onEdgeClick}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onNodeClick={onNodeClick}
            onPaneClick={() => {
              setSelectedNode(null);
              setSelectedEdge(null);
            }}
            onInit={(instance) => {
              if (instance) {
                reactFlowInstanceRef.current = instance;
                // Setze initialen Zoom auf 100%
                instance.setViewport({ x: 0, y: 0, zoom: 1.0 });
                setZoomLevel(1.0);
              }
            }}
            onMove={(_event, viewport) => {
              if (viewport) {
                setZoomLevel(viewport.zoom);
              }
            }}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            defaultViewport={{ x: 0, y: 0, zoom: 1.0 }}
            attributionPosition="bottom-left"
            deleteKeyCode="Delete"
          >
            <Background />
            <Controls />
            <MiniMap
              nodeColor={(node) => {
                if (node.type === 'startNode') return '#007bff';
                if (node.type === 'conditionNode') return '#ffc107';
                if (node.type === 'departmentNode') return '#17a2b8';
                return '#28a745';
              }}
              style={{ backgroundColor: '#f8f9fa' }}
            />
            {/* Zoom-Anzeige unten rechts */}
            <div
              style={{
                position: 'absolute',
                bottom: '20px',
                right: '20px',
                padding: '0.5rem 0.75rem',
                backgroundColor: 'rgba(255, 255, 255, 0.9)',
                border: '1px solid #dee2e6',
                borderRadius: '6px',
                fontSize: '0.875rem',
                fontWeight: '500',
                color: '#495057',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                zIndex: 10,
              }}
            >
              {Math.round(zoomLevel * 100)}%
            </div>
          </ReactFlow>
        </div>
      </div>

      {/* Konfigurations-Panel */}
      {selectedNode && (
        <div
          style={{
            width: '300px',
            borderLeft: '1px solid #dee2e6',
            padding: '1rem',
            overflowY: 'auto',
            backgroundColor: 'white',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0 }}>Knoten konfigurieren</h3>
            <button
              onClick={() => {
                deleteNode(selectedNode.id);
                setSelectedNode(null);
              }}
              style={{
                padding: '0.25rem 0.5rem',
                backgroundColor: '#dc3545',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              <FiX />
            </button>
          </div>
          <NodeConfigurationPanel
            node={selectedNode}
            config={nodeConfig}
            onUpdate={(data) => updateNodeData(selectedNode.id, data)}
            themes={themes}
            loadingThemes={loadingThemes}
            departments={departments}
            loadingDepartments={loadingDepartments}
          />
        </div>
      )}
      {selectedEdge && !selectedNode && (
        <div
          style={{
            width: '300px',
            borderLeft: '1px solid #dee2e6',
            padding: '1rem',
            overflowY: 'auto',
            backgroundColor: 'white',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0 }}>Verbindung</h3>
            <button
              onClick={() => {
                setEdges((eds) => eds.filter((e) => e.id !== selectedEdge.id));
                setSelectedEdge(null);
              }}
              style={{
                padding: '0.25rem 0.5rem',
                backgroundColor: '#dc3545',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.375rem',
                fontSize: '0.75rem',
              }}
            >
              <FiX style={{ fontSize: '0.875rem' }} />
              Verbindung trennen
            </button>
          </div>
          <div style={{ fontSize: '0.875rem', color: '#6c757d' }}>
            <p>Von: <strong>{selectedEdge.source}</strong></p>
            <p>Zu: <strong>{selectedEdge.target}</strong></p>
            <p style={{ marginTop: '1rem', fontSize: '0.75rem' }}>
              Tipp: Sie können die Verbindung auch mit der Entf-Taste löschen.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function NodeConfigurationPanel({
  node,
  config,
  onUpdate,
  themes,
  loadingThemes,
  departments,
  loadingDepartments,
}: {
  node: Node;
  config: any;
  onUpdate: (data: any) => void;
  themes: Array<{ id: string; name: string; color: string | null }>;
  loadingThemes: boolean;
  departments?: Array<{ id: string; name: string }>;
  loadingDepartments?: boolean;
}) {
  const handleChange = (field: string, value: any) => {
    onUpdate({ [field]: value });
  };

  // Debug: Log node info
  console.log('[NodeConfigurationPanel] Node info:', {
    nodeType: node.type,
    nodeData: node.data,
    config: config
  });

  const nodeData = node.data as any;
  const actionType = config.actionType || nodeData?.actionType || nodeData?.type;

  // Prüfe assignDepartmentAction auch außerhalb von actionNode, falls der Knoten nicht richtig erkannt wird
  if (nodeData?.type === 'assignDepartmentAction' || actionType === 'assign_department' || actionType === 'assignDepartmentAction') {
    console.log('[NodeConfig] assignDepartmentAction matched (outside actionNode check)!', { nodeData, actionType, config, nodeType: node.type });
    return (
      <div>
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: '500' }}>Abteilung</label>
          {loadingDepartments ? (
            <div style={{ padding: '0.5rem', color: '#6c757d' }}>Lade Abteilungen...</div>
          ) : departments && departments.length > 0 ? (
            <select
              value={config.departmentId || ''}
              onChange={(e) => {
                const selectedDept = departments.find(d => d.id === e.target.value);
                handleChange('departmentId', e.target.value);
                if (selectedDept) {
                  handleChange('departmentName', selectedDept.name);
                }
              }}
              style={{ width: '100%', padding: '0.5rem', border: '1px solid #dee2e6', borderRadius: '4px' }}
            >
              <option value="">Abteilung auswählen</option>
              {departments.map((dept) => (
                <option key={dept.id} value={dept.id}>
                  {dept.name}
                </option>
              ))}
            </select>
          ) : (
            <div style={{ padding: '0.5rem', color: '#dc3545' }}>
              ⚠️ Keine aktiven Abteilungen verfügbar. Bitte erstellen Sie zuerst eine aktive Abteilung mit E-Mail-Konto.
            </div>
          )}
        </div>
      </div>
    );
  }

  if (node.type === 'startNode') {
    return (
      <div>
        <p style={{ color: '#6c757d', fontSize: '0.875rem' }}>
          Der Start-Block markiert den Beginn des Workflows. Der Trigger-Typ wird auf Workflow-Ebene definiert.
        </p>
      </div>
    );
  }

  if (node.type === 'conditionNode') {
    const conditions = Array.isArray(config.conditions) ? config.conditions : null;
    const useMultiple = conditions && conditions.length > 0;
    const combineMode = config.combineMode || 'and';

    const fieldOptions = [
      { value: 'subject', label: 'Betreff' },
      { value: 'from', label: 'Von' },
      { value: 'to', label: 'An' },
      { value: 'body', label: 'Inhalt' },
      { value: 'type', label: 'Typ' },
      { value: 'phone_number', label: 'Telefonnummer' },
      { value: 'urgency', label: 'Dringlichkeit' },
      { value: 'themeId', label: 'Thema' },
      { value: 'read', label: 'Lesestatus' },
      { value: 'completed', label: 'Erledigt-Status' },
      { value: 'hasAttachment', label: 'Anhang' },
    ];
    const operatorOptions = [
      { value: 'contains', label: 'Enthält' },
      { value: 'equals', label: 'Gleich' },
      { value: 'startsWith', label: 'Beginnt mit' },
      { value: 'endsWith', label: 'Endet mit' },
      { value: 'notContains', label: 'Enthält nicht' },
      { value: 'isEmpty', label: 'Ist leer' },
      { value: 'isNotEmpty', label: 'Ist nicht leer' },
      { value: 'notEquals', label: 'Ungleich' },
      { value: 'matchesRegex', label: 'Entspricht RegEx' },
    ];

    const renderValueInput = (rule: { field?: string; operator?: string; value?: string }, onChangeValue: (v: string) => void) => {
      const field = rule.field || '';
      const operator = rule.operator || '';
      const value = rule.value ?? '';
      const needsNoValue = operator === 'isEmpty' || operator === 'isNotEmpty';
      if (needsNoValue) return null;
      if (field === 'type') {
        return (
          <select value={value} onChange={(e) => onChangeValue(e.target.value)} style={{ flex: 1, padding: '0.5rem', border: '1px solid #dee2e6', borderRadius: '4px' }}>
            <option value="">Auswählen...</option>
            <option value="email">E-Mail</option>
            <option value="phone_note">Telefonnotiz</option>
          </select>
        );
      }
      if (field === 'urgency') {
        return (
          <select value={value} onChange={(e) => onChangeValue(e.target.value)} style={{ flex: 1, padding: '0.5rem', border: '1px solid #dee2e6', borderRadius: '4px' }}>
            <option value="">Auswählen...</option>
            <option value="low">Niedrig</option>
            <option value="medium">Mittel</option>
            <option value="high">Hoch</option>
          </select>
        );
      }
      if (field === 'themeId') {
        return (
          <select value={value} onChange={(e) => onChangeValue(e.target.value)} style={{ flex: 1, padding: '0.5rem', border: '1px solid #dee2e6', borderRadius: '4px' }}>
            <option value="">Auswählen...</option>
            {(themes || []).map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        );
      }
      if (field === 'read') {
        return (
          <select value={value} onChange={(e) => onChangeValue(e.target.value)} style={{ flex: 1, padding: '0.5rem', border: '1px solid #dee2e6', borderRadius: '4px' }}>
            <option value="">Auswählen...</option>
            <option value="true">Gelesen</option>
            <option value="false">Ungelesen</option>
          </select>
        );
      }
      if (field === 'completed') {
        return (
          <select value={value} onChange={(e) => onChangeValue(e.target.value)} style={{ flex: 1, padding: '0.5rem', border: '1px solid #dee2e6', borderRadius: '4px' }}>
            <option value="">Auswählen...</option>
            <option value="true">Erledigt</option>
            <option value="false">Unerledigt</option>
          </select>
        );
      }
      if (field === 'hasAttachment') {
        return (
          <select value={value} onChange={(e) => onChangeValue(e.target.value)} style={{ flex: 1, padding: '0.5rem', border: '1px solid #dee2e6', borderRadius: '4px' }}>
            <option value="">Auswählen...</option>
            <option value="true">Hat Anhang</option>
            <option value="false">Kein Anhang</option>
          </select>
        );
      }
      return (
        <input
          type="text"
          value={value}
          onChange={(e) => onChangeValue(e.target.value)}
          style={{ flex: 1, padding: '0.5rem', border: '1px solid #dee2e6', borderRadius: '4px' }}
          placeholder={operator === 'matchesRegex' ? 'Regulärer Ausdruck...' : 'Wert eingeben...'}
        />
      );
    };

    const singleConditionPanel = (
      <>
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: '500' }}>Feld</label>
          <select
            value={config.field || ''}
            onChange={(e) => handleChange('field', e.target.value)}
            style={{ width: '100%', padding: '0.5rem', border: '1px solid #dee2e6', borderRadius: '4px' }}
          >
            <option value="">Auswählen...</option>
            {fieldOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: '500' }}>Operator</label>
          <select
            value={config.operator || ''}
            onChange={(e) => handleChange('operator', e.target.value)}
            style={{ width: '100%', padding: '0.5rem', border: '1px solid #dee2e6', borderRadius: '4px' }}
          >
            <option value="">Auswählen...</option>
            {operatorOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        {((config.operator !== 'isEmpty' && config.operator !== 'isNotEmpty') || !config.operator) && (
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: '500' }}>Wert</label>
            {renderValueInput(config, (v) => handleChange('value', v))}
          </div>
        )}
      </>
    );

    const multipleConditionsPanel = (
      <>
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: '500' }}>Verknüpfung</label>
          <select
            value={combineMode}
            onChange={(e) => handleChange('combineMode', e.target.value)}
            style={{ width: '100%', padding: '0.5rem', border: '1px solid #dee2e6', borderRadius: '4px' }}
          >
            <option value="and">Alle Bedingungen müssen erfüllt sein (AND)</option>
            <option value="or">Mindestens eine muss erfüllt sein (OR)</option>
          </select>
        </div>
        <div style={{ marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: '500' }}>Bedingungen</div>
        {(conditions || []).map((rule: { field?: string; operator?: string; value?: string }, idx: number) => (
          <div key={idx} style={{ marginBottom: '1rem', padding: '0.75rem', border: '1px solid #e9ecef', borderRadius: '4px', backgroundColor: '#f8f9fa' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.75rem', color: '#6c757d' }}>Bedingung {idx + 1}</span>
              <button type="button" onClick={() => {
                const next = (conditions as any[]).filter((_, i) => i !== idx);
                onUpdate(next.length > 0 ? { conditions: next, combineMode } : { conditions: undefined, combineMode: undefined, field: '', operator: '', value: '' });
              }} style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Entfernen</button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
              <select value={rule.field || ''} onChange={(e) => {
                const next = (conditions as any[]).map((r, i) => i === idx ? { ...r, field: e.target.value } : r);
                onUpdate({ conditions: next });
              }} style={{ flex: '0 0 100px', padding: '0.5rem', border: '1px solid #dee2e6', borderRadius: '4px' }}>
                {fieldOptions.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <select value={rule.operator || ''} onChange={(e) => {
                const next = (conditions as any[]).map((r, i) => i === idx ? { ...r, operator: e.target.value } : r);
                onUpdate({ conditions: next });
              }} style={{ flex: '0 0 120px', padding: '0.5rem', border: '1px solid #dee2e6', borderRadius: '4px' }}>
                {operatorOptions.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              {renderValueInput(rule, (v) => {
                const next = (conditions as any[]).map((r, i) => i === idx ? { ...r, value: v } : r);
                onUpdate({ conditions: next });
              })}
            </div>
          </div>
        ))}
        <button type="button" onClick={() => {
          const base = (conditions && conditions.length > 0) ? conditions : [{ field: config.field || 'subject', operator: config.operator || 'contains', value: config.value ?? '' }];
          const single = base.length === 1 && !conditions;
          const newConditions = single ? [base[0], { field: 'subject', operator: 'contains', value: '' }] : [...base, { field: 'subject', operator: 'contains', value: '' }];
          onUpdate({ conditions: newConditions, combineMode: combineMode || 'and', ...(single ? { field: undefined, operator: undefined, value: undefined } : {}) });
        }} style={{ padding: '0.5rem 0.75rem', fontSize: '0.875rem', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Bedingung hinzufügen</button>
      </>
    );

    return (
      <div>
        {useMultiple ? multipleConditionsPanel : singleConditionPanel}
        {!useMultiple && (
          <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #dee2e6' }}>
            <button type="button" onClick={() => {
              const rule = { field: config.field || 'subject', operator: config.operator || 'contains', value: config.value ?? '' };
              onUpdate({ conditions: [rule, { field: 'subject', operator: 'contains', value: '' }], combineMode: 'and', field: undefined, operator: undefined, value: undefined });
            }} style={{ padding: '0.5rem 0.75rem', fontSize: '0.875rem', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Mehrere Bedingungen (AND/OR) verwenden</button>
          </div>
        )}
        {useMultiple && (
          <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #dee2e6' }}>
            <button type="button" onClick={() => {
              const first = (conditions as any[])[0];
              onUpdate({ conditions: undefined, combineMode: undefined, field: first?.field || 'subject', operator: first?.operator || 'contains', value: first?.value ?? '' });
            }} style={{ padding: '0.5rem 0.75rem', fontSize: '0.875rem', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Nur eine Bedingung</button>
          </div>
        )}
      </div>
    );
  }

  if (node.type === 'actionNode') {
    const nodeData = node.data as any;
    // Prüfe actionType in dieser Reihenfolge: config -> node.data.actionType -> node.data.type
    const actionType = config.actionType || nodeData?.actionType || nodeData?.type;
    
    // Debug für assignDepartmentAction - IMMER loggen wenn es ein actionNode ist
    console.log('[NodeConfig] actionNode Debug:', {
      nodeType: node.type,
      nodeDataType: nodeData?.type,
      nodeDataActionType: nodeData?.actionType,
      configActionType: config.actionType,
      resolvedActionType: actionType,
      config: config,
      nodeData: nodeData,
      isAssignDepartment: nodeData?.type === 'assignDepartmentAction' || nodeData?.actionType === 'assign_department' || actionType === 'assign_department' || actionType === 'assignDepartmentAction'
    });

    // Prüfe assignDepartmentAction als ERSTE Bedingung, damit es nicht übersehen wird
    if (nodeData?.type === 'assignDepartmentAction' || actionType === 'assign_department' || actionType === 'assignDepartmentAction') {
      console.log('[NodeConfig] assignDepartmentAction matched!', { nodeData, actionType, config });
      return (
        <div>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: '500' }}>Abteilung</label>
            {loadingDepartments ? (
              <div style={{ padding: '0.5rem', color: '#6c757d' }}>Lade Abteilungen...</div>
            ) : departments && departments.length > 0 ? (
              <select
                value={config.departmentId || ''}
                onChange={(e) => {
                  const selectedDept = departments.find(d => d.id === e.target.value);
                  handleChange('departmentId', e.target.value);
                  if (selectedDept) {
                    handleChange('departmentName', selectedDept.name);
                  }
                }}
                style={{ width: '100%', padding: '0.5rem', border: '1px solid #dee2e6', borderRadius: '4px' }}
              >
                <option value="">Abteilung auswählen</option>
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    {dept.name}
                  </option>
                ))}
              </select>
            ) : (
              <div style={{ padding: '0.5rem', color: '#dc3545' }}>
                ⚠️ Keine aktiven Abteilungen verfügbar. Bitte erstellen Sie zuerst eine aktive Abteilung mit E-Mail-Konto.
              </div>
            )}
          </div>
        </div>
      );
    }

    if (actionType === 'set_theme' || actionType === 'setThemeAction') {
      const selectedTheme = themes.find((t) => t.id === config.themeId);
      
      return (
        <div>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: '500' }}>Thema</label>
            {loadingThemes ? (
              <div style={{ padding: '0.5rem', color: '#6c757d', fontSize: '0.875rem' }}>Lade Themen...</div>
            ) : (
              <select
                value={config.themeId || ''}
                onChange={(e) => {
                  const themeId = e.target.value;
                  const theme = themes.find((t) => t.id === themeId);
                  handleChange('themeId', themeId);
                  if (theme) {
                    handleChange('themeName', theme.name);
                  }
                }}
                style={{ width: '100%', padding: '0.5rem', border: '1px solid #dee2e6', borderRadius: '4px' }}
              >
                <option value="">Auswählen...</option>
                {themes.map((theme) => (
                  <option key={theme.id} value={theme.id}>
                    {theme.name} {theme.color && `(${theme.color})`}
                  </option>
                ))}
              </select>
            )}
          </div>
          {selectedTheme && (
            <div style={{ 
              padding: '0.5rem', 
              backgroundColor: '#f8f9fa', 
              borderRadius: '4px',
              fontSize: '0.875rem',
              color: '#6c757d'
            }}>
              Ausgewählt: <strong>{selectedTheme.name}</strong>
              {selectedTheme.color && (
                <span style={{ 
                  display: 'inline-block',
                  width: '16px',
                  height: '16px',
                  backgroundColor: selectedTheme.color,
                  borderRadius: '2px',
                  marginLeft: '0.5rem',
                  verticalAlign: 'middle',
                  border: '1px solid #dee2e6'
                }} />
              )}
            </div>
          )}
        </div>
      );
    }

    if (actionType === 'set_urgency' || actionType === 'setUrgencyAction') {
      return (
        <div>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: '500' }}>Dringlichkeit</label>
            <select
              value={config.urgency || ''}
              onChange={(e) => handleChange('urgency', e.target.value)}
              style={{ width: '100%', padding: '0.5rem', border: '1px solid #dee2e6', borderRadius: '4px' }}
            >
              <option value="">Auswählen...</option>
              <option value="low">Niedrig</option>
              <option value="medium">Mittel</option>
              <option value="high">Hoch</option>
            </select>
          </div>
        </div>
      );
    }

    if (actionType === 'forward' || actionType === 'forwardEmailAction') {
      return (
        <div>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: '500' }}>An (E-Mail)</label>
            <input
              type="email"
              value={config.to || ''}
              onChange={(e) => handleChange('to', e.target.value)}
              style={{ width: '100%', padding: '0.5rem', border: '1px solid #dee2e6', borderRadius: '4px' }}
              placeholder="empfaenger@example.com"
            />
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: '500' }}>Betreff</label>
            <input
              type="text"
              value={config.subject || '{{subject}}'}
              onChange={(e) => handleChange('subject', e.target.value)}
              style={{ width: '100%', padding: '0.5rem', border: '1px solid #dee2e6', borderRadius: '4px' }}
              placeholder="{{subject}}"
            />
            <div style={{ fontSize: '0.75rem', color: '#6c757d', marginTop: '0.25rem' }}>
              Verfügbare Variablen: {'{{subject}}'}, {'{{from}}'}, {'{{to}}'}, {'{{body}}'}, {'{{date}}'}
            </div>
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: '500' }}>Inhalt</label>
            <textarea
              value={config.body || '{{body}}'}
              onChange={(e) => handleChange('body', e.target.value)}
              style={{ width: '100%', padding: '0.5rem', border: '1px solid #dee2e6', borderRadius: '4px', minHeight: '100px' }}
              placeholder="{{body}}"
            />
          </div>
        </div>
      );
    }


    return (
      <div>
        <p style={{ color: '#6c757d', fontSize: '0.875rem' }}>Keine zusätzliche Konfiguration erforderlich für diese Aktion.</p>
      </div>
    );
  }

  return (
    <div>
      <p style={{ color: '#6c757d', fontSize: '0.875rem' }}>Keine Konfiguration verfügbar für diesen Knoten-Typ.</p>
    </div>
  );
}

export default function AutomationWorkflowEditor({
  initialWorkflow,
  onSave,
  onCancel,
}: AutomationWorkflowEditorProps) {
  return (
    <ReactFlowProvider>
      <WorkflowEditorContent
        initialWorkflow={initialWorkflow}
        onSave={onSave}
        onCancel={onCancel}
      />
    </ReactFlowProvider>
  );
}
