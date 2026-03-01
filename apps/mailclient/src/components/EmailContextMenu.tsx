'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FiMessageSquare } from 'react-icons/fi';
import { useToast } from '@/components/ToastProvider';

interface AutomationRule {
  id: string;
  name: string;
  description?: string;
  priority: number;
}

interface EmailContextMenuProps {
  emailId: string;
  x: number;
  y: number;
  onClose: () => void;
  onRefresh?: () => void;
  onAddNote?: (emailId: string) => void;
}

export default function EmailContextMenu({
  emailId,
  x,
  y,
  onClose,
  onRefresh,
  onAddNote,
}: EmailContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const toast = useToast();
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [applyingRuleId, setApplyingRuleId] = useState<string | null>(null);

  useEffect(() => {
    loadManualRules();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  const loadManualRules = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('mailclient_token');
      if (!token) {
        router.push('/login');
        return;
      }

      const response = await fetch('/api/automation-rules?trigger_type=manual&is_active=true', {
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
      }
    } catch (error) {
      console.error('Fehler beim Laden der Workflows:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExecuteRule = async (ruleId: string) => {
    try {
      setApplyingRuleId(ruleId);
      const token = localStorage.getItem('mailclient_token');
      if (!token) {
        router.push('/login');
        return;
      }

      const response = await fetch(`/api/automation-rules/${ruleId}/execute`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ emailId }),
      });

      if (response.status === 401) {
        localStorage.removeItem('mailclient_token');
        localStorage.removeItem('mailclient_user');
        router.push('/login');
        return;
      }

      if (response.ok) {
        const data = await response.json();
        toast.showSuccess(`Workflow '${rules.find(r => r.id === ruleId)?.name}' erfolgreich ausgeführt! ${data.executedActions?.length || 0} Aktion(en) durchgeführt.`);
        onClose();
        // E-Mail-Liste neu laden, um Änderungen zu sehen
        if (onRefresh) {
          onRefresh();
        } else {
          window.location.reload();
        }
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unbekannter Fehler' }));
        toast.showError('Fehler beim Ausführen des Workflows: ' + (errorData.error || 'Unbekannter Fehler'));
      }
    } catch (error: any) {
      console.error('Fehler beim Ausführen des Workflows:', error);
      toast.showError('Fehler beim Ausführen des Workflows: ' + error.message);
    } finally {
      setApplyingRuleId(null);
    }
  };

  return (
    <div
      ref={menuRef}
      style={{
        position: 'fixed',
        top: `${y}px`,
        left: `${x}px`,
        backgroundColor: 'white',
        border: '1px solid #dee2e6',
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        zIndex: 1000,
        minWidth: '250px',
        maxWidth: '350px',
        maxHeight: '400px',
        overflowY: 'auto',
        padding: '0.5rem 0',
      }}
    >
      {onAddNote && (
        <button
          type="button"
          onClick={() => {
            onClose();
            onAddNote(emailId);
          }}
          style={{
            width: '100%',
            padding: '0.75rem 1rem',
            border: 'none',
            backgroundColor: 'transparent',
            textAlign: 'left',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontSize: '0.875rem',
            color: '#333',
            borderBottom: '1px solid #f0f0f0',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#f8f9fa';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          <FiMessageSquare size={16} style={{ color: '#28a745', flexShrink: 0 }} />
          <span>Kommentar hinzufügen</span>
        </button>
      )}

      <div style={{ padding: '0.5rem 1rem', borderBottom: '1px solid #dee2e6', marginBottom: '0.5rem' }}>
        <div style={{ fontSize: '0.875rem', fontWeight: '600', color: '#333', marginBottom: '0.25rem' }}>
          🤖 Manuelle Workflows
        </div>
        <div style={{ fontSize: '0.75rem', color: '#6c757d' }}>
          Wählen Sie einen Workflow zum Ausführen
        </div>
      </div>

      {loading ? (
        <div style={{ padding: '1rem', textAlign: 'center', color: '#6c757d', fontSize: '0.875rem' }}>
          Lade Workflows...
        </div>
      ) : rules.length === 0 ? (
        <div style={{ padding: '1rem', textAlign: 'center', color: '#6c757d', fontSize: '0.875rem' }}>
          Keine manuellen Workflows vorhanden
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {rules.map((rule) => {
            const isApplying = applyingRuleId === rule.id;
            return (
              <button
                key={rule.id}
                onClick={() => handleExecuteRule(rule.id)}
                disabled={isApplying || applyingRuleId !== null}
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  border: 'none',
                  backgroundColor: 'transparent',
                  textAlign: 'left',
                  cursor: isApplying || applyingRuleId !== null ? 'wait' : 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.25rem',
                  fontSize: '0.875rem',
                  color: isApplying || applyingRuleId !== null ? '#6c757d' : '#333',
                  borderBottom: '1px solid #f0f0f0',
                }}
                onMouseEnter={(e) => {
                  if (!isApplying && applyingRuleId === null) {
                    e.currentTarget.style.backgroundColor = '#f8f9fa';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {isApplying ? (
                    <>
                      <span>⏳</span>
                      <span style={{ fontWeight: '500' }}>Wird ausgeführt...</span>
                    </>
                  ) : (
                    <>
                      <span>▶️</span>
                      <span style={{ fontWeight: '500' }}>{rule.name}</span>
                    </>
                  )}
                </div>
                {rule.description && (
                  <div style={{ fontSize: '0.75rem', color: '#6c757d', paddingLeft: '1.75rem' }}>
                    {rule.description}
                  </div>
                )}
                <div style={{ fontSize: '0.75rem', color: '#6c757d', paddingLeft: '1.75rem' }}>
                  Priorität: {rule.priority}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

