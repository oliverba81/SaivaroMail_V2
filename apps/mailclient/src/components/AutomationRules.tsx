'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { FiDownload, FiPlus, FiStar, FiTag, FiArrowRight } from 'react-icons/fi';
import { useConfirm } from '@/components/ConfirmDialog';

const AutomationWorkflowEditor = dynamic(() => import('./AutomationWorkflowEditor'), { ssr: false });

interface AutomationRule {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  priority: number;
  triggerType: 'incoming' | 'outgoing' | 'manual' | 'scheduled' | 'email_updated';
  executionCount: number;
  lastExecutedAt?: string;
  createdAt: string;
  updatedAt: string;
  departmentIds?: string[];
}

export default function AutomationRules() {
  const router = useRouter();
  const { confirm } = useConfirm();
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showEditor, setShowEditor] = useState(false);
  const [editingRule, setEditingRule] = useState<AutomationRule | null>(null);
  const [ruleFormData, setRuleFormData] = useState({
    name: '',
    description: '',
    isActive: true,
    priority: 0,
    triggerType: 'incoming' as 'incoming' | 'outgoing' | 'manual' | 'scheduled' | 'email_updated',
    triggerConfig: {} as any,
    workflowData: { nodes: [], edges: [] } as any,
    departmentIds: [] as string[],
  });
  const [_departments, setDepartments] = useState<any[]>([]);
  const [_loadingDepartments, setLoadingDepartments] = useState(false);
  const [userDepartments, setUserDepartments] = useState<string[]>([]);

  const loadRules = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('mailclient_token');
      const response = await fetch('/api/automation-rules', {
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
        setRules(data.rules || []);
      } else {
        setError('Fehler beim Laden der Workflows');
      }
    } catch (err: any) {
      setError('Fehler beim Laden der Workflows: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRules();
    loadDepartments();
    loadUserDepartments();
  }, []);

  const loadDepartments = async () => {
    try {
      setLoadingDepartments(true);
      const token = localStorage.getItem('mailclient_token');
      if (!token) return;

      const response = await fetch('/api/departments', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setDepartments(data.departments || []);
      }
    } catch (err) {
      console.error('Fehler beim Laden der Abteilungen:', err);
    } finally {
      setLoadingDepartments(false);
    }
  };

  const loadUserDepartments = async () => {
    try {
      const token = localStorage.getItem('mailclient_token');
      if (!token) return;

      const response = await fetch('/api/users/me/departments', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setUserDepartments(data.departmentIds || []);
      }
    } catch (err) {
      console.error('Fehler beim Laden der Benutzer-Abteilungen:', err);
    }
  };

  const handleToggleActive = async (ruleId: string, currentStatus: boolean) => {
    try {
      const token = localStorage.getItem('mailclient_token');
      const response = await fetch(`/api/automation-rules/${ruleId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ isActive: !currentStatus }),
      });

      if (response.ok) {
        await loadRules();
      } else {
        setError('Fehler beim Ändern des Status');
      }
    } catch (err: any) {
      setError('Fehler beim Ändern des Status: ' + err.message);
    }
  };

  const handleDelete = async (ruleId: string) => {
    if (!(await confirm({ message: 'Möchten Sie diesen Workflow wirklich löschen?', variant: 'danger', confirmLabel: 'Löschen' }))) {
      return;
    }

    try {
      const token = localStorage.getItem('mailclient_token');
      const response = await fetch(`/api/automation-rules/${ruleId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        await loadRules();
      } else {
        setError('Fehler beim Löschen des Workflows');
      }
    } catch (err: any) {
      setError('Fehler beim Löschen des Workflows: ' + err.message);
    }
  };

  const handleDuplicate = async (ruleId: string) => {
    try {
      const token = localStorage.getItem('mailclient_token');
      const response = await fetch(`/api/automation-rules/${ruleId}/duplicate`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });

      if (response.ok) {
        await loadRules();
      } else {
        setError('Fehler beim Duplizieren des Workflows');
      }
    } catch (err: any) {
      setError('Fehler beim Duplizieren des Workflows: ' + err.message);
    }
  };

  const handleExport = async (ruleId: string, ruleName: string) => {
    try {
      const token = localStorage.getItem('mailclient_token');
      const response = await fetch(`/api/automation-rules/${ruleId}/export`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `rule-${ruleName.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.json`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        setError('Fehler beim Exportieren des Workflows');
      }
    } catch (err: any) {
      setError('Fehler beim Exportieren des Workflows: ' + err.message);
    }
  };

  const handleImport = async (file: File) => {
    try {
      const text = await file.text();
      const importData = JSON.parse(text);

      setRuleFormData({
        name: importData.name || '',
        description: importData.description || '',
        isActive: importData.isActive !== false,
        priority: importData.priority || 0,
        triggerType: importData.triggerType || 'incoming',
        triggerConfig: importData.triggerConfig || {},
        workflowData: importData.workflowData || { nodes: [], edges: [] },
        departmentIds: Array.isArray(importData.departmentIds) ? importData.departmentIds : [],
      });

      setShowEditor(true);
      setEditingRule(null);
    } catch (err: any) {
      setError('Fehler beim Importieren des Workflows: ' + err.message);
    }
  };

  const handleLoadTemplate = async (templateId: string) => {
    try {
      const token = localStorage.getItem('mailclient_token');
      const response = await fetch('/api/automation-rules/templates', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        const template = data.templates.find((t: any) => t.id === templateId);
        if (template) {
          setRuleFormData({
            name: template.name,
            description: template.description || '',
            isActive: true,
            priority: 0,
            triggerType: 'incoming',
            triggerConfig: {},
            workflowData: template.workflowData,
            departmentIds: Array.isArray(template.departmentIds) ? template.departmentIds : [],
          });
          setShowEditor(true);
          setEditingRule(null);
        }
      } else {
        setError('Fehler beim Laden der Vorlage');
      }
    } catch (err: any) {
      setError('Fehler beim Laden der Vorlage: ' + err.message);
    }
  };

  const handleSaveRule = async (workflowData: any) => {
    try {
      // Extrahiere Abteilungen aus den Workflow-Knoten
      const departmentNodes = workflowData.nodes?.filter((node: any) => 
        node.type === 'departmentNode' || node.data?.type === 'departmentNode'
      ) || [];
      
      // Sammle alle Abteilungs-IDs aus den Knoten
      const departmentIds: string[] = [];
      departmentNodes.forEach((node: any) => {
        const ids = node.data?.departmentIds || [];
        departmentIds.push(...ids);
      });
      
      // Entferne Duplikate
      const uniqueDepartmentIds = [...new Set(departmentIds)];

      const token = localStorage.getItem('mailclient_token');
      const url = editingRule
        ? `/api/automation-rules/${editingRule.id}`
        : '/api/automation-rules';
      const method = editingRule ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...ruleFormData,
          workflowData,
          departmentIds: uniqueDepartmentIds,
        }),
      });

      if (response.ok) {
        await loadRules();
        setShowEditor(false);
        setEditingRule(null);
        setRuleFormData({
          name: '',
          description: '',
          isActive: true,
          priority: 0,
          triggerType: 'incoming',
          triggerConfig: {},
          workflowData: { nodes: [], edges: [] },
          departmentIds: [],
        });
      } else {
        const data = await response.json();
        setError(data.error || 'Fehler beim Speichern des Workflows');
      }
    } catch (err: any) {
      setError('Fehler beim Speichern des Workflows: ' + err.message);
    }
  };

  const handleEditClick = async (rule: AutomationRule) => {
    try {
      const token = localStorage.getItem('mailclient_token');
      const response = await fetch(`/api/automation-rules/${rule.id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setEditingRule(data);
        // Wenn Abteilungen vorhanden sind, aber keine Department-Knoten im Workflow, erstelle Knoten
        let workflowData = data.workflowData || { nodes: [], edges: [] };
        if (data.departmentIds && data.departmentIds.length > 0) {
          const hasDepartmentNode = workflowData.nodes?.some((node: any) => 
            node.type === 'departmentNode' || node.data?.type === 'departmentNode'
          );
          
          if (!hasDepartmentNode) {
            // Lade Abteilungen, um Namen zu bekommen
            const deptResponse = await fetch('/api/departments', {
              headers: {
                Authorization: `Bearer ${localStorage.getItem('mailclient_token')}`,
              },
            });
            const deptData = await deptResponse.json();
            const deptNames = (deptData.departments || [])
              .filter((d: any) => data.departmentIds.includes(d.id))
              .map((d: any) => d.name);
            
            // Erstelle Department-Knoten
            const departmentNode = {
              id: `departmentNode-${Date.now()}`,
              type: 'departmentNode',
              position: { x: 250, y: 250 },
              data: {
                label: 'Abteilung',
                type: 'departmentNode',
                departmentIds: data.departmentIds,
                departmentNames: deptNames,
              },
            };
            
            workflowData = {
              ...workflowData,
              nodes: [...(workflowData.nodes || []), departmentNode],
            };
          }
        }
        
        setRuleFormData({
          name: data.name,
          description: data.description || '',
          isActive: data.isActive,
          priority: data.priority,
          triggerType: data.triggerType,
          triggerConfig: data.triggerConfig || {},
          workflowData,
          departmentIds: data.departmentIds || [],
        });
        setShowEditor(true);
      } else {
        setError('Fehler beim Laden des Workflows');
      }
    } catch (err: any) {
      setError('Fehler beim Laden des Workflows: ' + err.message);
    }
  };

  const getTriggerTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      incoming: 'E-Mail-Eingang',
      outgoing: 'E-Mail-Ausgang',
      manual: 'Manuell',
      scheduled: 'Zeitgesteuert',
      email_updated: 'E-Mail-Update',
    };
    return labels[type] || type;
  };

  if (loading) {
    return <div>Lade Workflows...</div>;
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2 style={{ margin: 0 }}>Automatisierungs-Workflows</h2>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <label
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#17a2b8',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <FiDownload size={16} />
            <span>Importieren</span>
            <input
              type="file"
              accept=".json"
              style={{ display: 'none' }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  handleImport(file);
                }
              }}
            />
          </label>
          <button
            onClick={() => {
              setEditingRule(null);
              setRuleFormData({
                name: '',
                description: '',
                isActive: true,
                priority: 0,
                triggerType: 'incoming',
                triggerConfig: {},
                workflowData: { nodes: [], edges: [] },
                departmentIds: [],
              });
              setShowEditor(true);
            }}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <FiPlus size={16} />
            <span>Neuer Workflow</span>
          </button>
        </div>
      </div>

      {error && (
        <div style={{ padding: '1rem', backgroundColor: '#f8d7da', color: '#721c24', borderRadius: '4px', marginBottom: '1rem' }}>
          {error}
        </div>
      )}

      {rules.length === 0 ? (
        <div style={{ padding: '2rem', textAlign: 'center', color: '#6c757d' }}>
          <p>Noch keine Workflows vorhanden.</p>
          <p>Erstellen Sie Ihren ersten Automatisierungs-Workflow, um E-Mails automatisch zu verarbeiten.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {rules
            .filter((rule) => {
              // Wenn der Workflow keine Abteilungen hat, wird er immer angezeigt
              if (!rule.departmentIds || rule.departmentIds.length === 0) {
                return true;
              }

              // Wenn der Workflow Abteilungen hat, prüfe ob der Benutzer mindestens eine davon hat
              const ruleDeptIdsAsStrings = rule.departmentIds.map(id => String(id));
              const userDeptIdsAsStrings = userDepartments.map(id => String(id));

              return ruleDeptIdsAsStrings.some(deptId => userDeptIdsAsStrings.includes(deptId));
            })
            .map((rule) => (
            <div
              key={rule.id}
              style={{
                padding: '1.5rem',
                border: '1px solid #dee2e6',
                borderRadius: '8px',
                backgroundColor: 'white',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <h3 style={{ margin: 0 }}>{rule.name}</h3>
                    <span
                      style={{
                        padding: '0.25rem 0.5rem',
                        backgroundColor: rule.isActive ? '#d4edda' : '#f8d7da',
                        color: rule.isActive ? '#155724' : '#721c24',
                        borderRadius: '4px',
                        fontSize: '0.875rem',
                      }}
                    >
                      {rule.isActive ? 'Aktiv' : 'Inaktiv'}
                    </span>
                    <span
                      style={{
                        padding: '0.25rem 0.5rem',
                        backgroundColor: '#e7f3ff',
                        color: '#004085',
                        borderRadius: '4px',
                        fontSize: '0.875rem',
                      }}
                    >
                      Priorität: {rule.priority}
                    </span>
                  </div>
                  {rule.description && (
                    <p style={{ margin: '0.5rem 0', color: '#6c757d' }}>{rule.description}</p>
                  )}
                  <div style={{ display: 'flex', gap: '1rem', fontSize: '0.875rem', color: '#6c757d' }}>
                    <span>Trigger: {getTriggerTypeLabel(rule.triggerType)}</span>
                    <span>Ausführungen: {rule.executionCount}</span>
                    {rule.lastExecutedAt && (
                      <span>Letzte Ausführung: {new Date(rule.lastExecutedAt).toLocaleString('de-DE')}</span>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    onClick={() => handleToggleActive(rule.id, rule.isActive)}
                    style={{
                      padding: '0.5rem 1rem',
                      backgroundColor: rule.isActive ? '#6c757d' : '#28a745',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                    }}
                  >
                    {rule.isActive ? 'Deaktivieren' : 'Aktivieren'}
                  </button>
                  <button
                    onClick={() => handleEditClick(rule)}
                    style={{
                      padding: '0.5rem 1rem',
                      backgroundColor: '#007bff',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                    }}
                  >
                    Bearbeiten
                  </button>
                  <button
                    onClick={() => handleDuplicate(rule.id)}
                    style={{
                      padding: '0.5rem 1rem',
                      backgroundColor: '#17a2b8',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                    }}
                  >
                    Duplizieren
                  </button>
                  <button
                    onClick={() => handleExport(rule.id, rule.name)}
                    style={{
                      padding: '0.5rem 1rem',
                      backgroundColor: '#28a745',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                    }}
                  >
                    Exportieren
                  </button>
                  <button
                    onClick={() => handleDelete(rule.id)}
                    style={{
                      padding: '0.5rem 1rem',
                      backgroundColor: '#dc3545',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                    }}
                  >
                    Löschen
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showEditor && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'white',
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            <div style={{ padding: '1.5rem', borderBottom: '1px solid #dee2e6' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h2 style={{ margin: 0 }}>{editingRule ? 'Workflow bearbeiten' : 'Neuen Workflow erstellen'}</h2>
                <button
                  onClick={() => {
                    setShowEditor(false);
                    setEditingRule(null);
                    setRuleFormData({
                      name: '',
                      description: '',
                      isActive: true,
                      priority: 0,
                      triggerType: 'incoming',
                      triggerConfig: {},
                      workflowData: { nodes: [], edges: [] },
                      departmentIds: [],
                    });
                  }}
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: '#6c757d',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                  }}
                >
                  ✕ Schließen
                </button>
              </div>
              {!editingRule && (
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}>Aus Vorlage erstellen:</label>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <button
                      onClick={() => handleLoadTemplate('mark-important-from')}
                      style={{
                        padding: '0.5rem 1rem',
                        backgroundColor: '#f8f9fa',
                        border: '1px solid #dee2e6',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '0.875rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                      }}
                    >
                      <FiStar size={16} style={{ color: '#FBBF24' }} />
                      <span>Als wichtig markieren</span>
                    </button>
                    <button
                      onClick={() => handleLoadTemplate('assign-theme-by-subject')}
                      style={{
                        padding: '0.5rem 1rem',
                        backgroundColor: '#f8f9fa',
                        border: '1px solid #dee2e6',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '0.875rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                      }}
                    >
                      <FiTag size={16} style={{ color: '#2563EB' }} />
                      <span>Thema zuweisen</span>
                    </button>
                    <button
                      onClick={() => handleLoadTemplate('forward-by-domain')}
                      style={{
                        padding: '0.5rem 1rem',
                        backgroundColor: '#f8f9fa',
                        border: '1px solid #dee2e6',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '0.875rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                      }}
                    >
                      <FiArrowRight size={16} style={{ color: '#2563EB' }} />
                      <span>Weiterleiten</span>
                    </button>
                    <button
                      onClick={() => handleLoadTemplate('set-urgency-high')}
                      style={{
                        padding: '0.5rem 1rem',
                        backgroundColor: '#f8f9fa',
                        border: '1px solid #dee2e6',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '0.875rem',
                      }}
                    >
                      ⚡ Dringlichkeit setzen
                    </button>
                  </div>
                </div>
              )}
              <div style={{ marginTop: '1rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: '200px' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}>Name *</label>
                  <input
                    type="text"
                    value={ruleFormData.name}
                    onChange={(e) => setRuleFormData({ ...ruleFormData, name: e.target.value })}
                    style={{ width: '100%', padding: '0.5rem', border: '1px solid #dee2e6', borderRadius: '4px' }}
                    placeholder="Workflow-Name"
                  />
                </div>
                <div style={{ flex: 1, minWidth: '200px' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}>Beschreibung</label>
                  <input
                    type="text"
                    value={ruleFormData.description}
                    onChange={(e) => setRuleFormData({ ...ruleFormData, description: e.target.value })}
                    style={{ width: '100%', padding: '0.5rem', border: '1px solid #dee2e6', borderRadius: '4px' }}
                    placeholder="Optionale Beschreibung"
                  />
                </div>
                <div style={{ minWidth: '150px' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}>Priorität</label>
                  <input
                    type="number"
                    value={ruleFormData.priority}
                    onChange={(e) => setRuleFormData({ ...ruleFormData, priority: parseInt(e.target.value) || 0 })}
                    style={{ width: '100%', padding: '0.5rem', border: '1px solid #dee2e6', borderRadius: '4px' }}
                    min="-1000"
                    max="1000"
                  />
                </div>
                <div style={{ minWidth: '150px' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}>Trigger-Typ</label>
                  <select
                    value={ruleFormData.triggerType}
                    onChange={(e) => setRuleFormData({ ...ruleFormData, triggerType: e.target.value as any })}
                    style={{ width: '100%', padding: '0.5rem', border: '1px solid #dee2e6', borderRadius: '4px' }}
                  >
                    <option value="incoming">E-Mail-Eingang</option>
                    <option value="outgoing">E-Mail-Ausgang</option>
                    <option value="manual">Manuell</option>
                    <option value="scheduled">Zeitgesteuert</option>
                    <option value="email_updated">E-Mail-Update</option>
                  </select>
                </div>
              </div>
            </div>
            <div style={{ flex: 1, overflow: 'hidden', height: '100%', display: 'flex', flexDirection: 'column' }}>
              <AutomationWorkflowEditor
                initialWorkflow={ruleFormData.workflowData}
                onSave={handleSaveRule}
                onCancel={() => {
                  setShowEditor(false);
                  setEditingRule(null);
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

