'use client';

import { useState } from 'react';
import { BUSINESS_DEPARTMENTS, PRIVATE_DEPARTMENTS } from '@/lib/department-constants';
import { FiBriefcase, FiPlus, FiAlertTriangle, FiEdit, FiTrash2, FiInfo, FiZap, FiUsers, FiHelpCircle, FiCheckCircle, FiXCircle, FiChevronDown } from 'react-icons/fi';

interface Manager {
  id: string;
  username: string;
  email: string;
  firstName?: string;
  lastName?: string;
}

interface EmailAccount {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  usageCount?: number;
}

interface Department {
  id: string;
  name: string;
  description?: string;
  managerId?: string;
  manager?: Manager | null;
  isActive?: boolean;
  emailAccountId?: string;
  emailAccount?: EmailAccount | null;
  signature?: string | null;
  signaturePlain?: string | null;
  signatureEnabled?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

interface DepartmentManagementProps {
  departments: Department[];
  loading: boolean;
  onEdit: (department: Department) => void;
  onDelete: (departmentId: string) => void;
  onCreateNew: () => void;
  onCreateDefaults?: () => void;
  onToggleActive?: (departmentId: string, isActive: boolean) => Promise<void>;
  onRestoreBusinessDefaults?: () => void;
  onRestorePrivateDefaults?: () => void;
}

export default function DepartmentManagement({
  departments,
  loading,
  onEdit,
  onDelete,
  onCreateNew,
  onCreateDefaults,
  onToggleActive,
  onRestoreBusinessDefaults,
  onRestorePrivateDefaults,
}: DepartmentManagementProps) {
  const [togglingDepartmentId, setTogglingDepartmentId] = useState<string | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  if (loading) {
    return (
      <div className="empty-state">
        <div className="spinner" style={{ margin: '0 auto' }}></div>
        <p style={{ marginTop: '1rem', color: '#6c757d' }}>Lade Abteilungen...</p>
      </div>
    );
  }

  if (departments.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <FiBriefcase size={48} style={{ color: '#6c757d' }} />
        </div>
        <div className="empty-state-title">Keine Abteilungen</div>
        <div className="empty-state-text">
          Erstellen Sie die erste Abteilung für diese Firma.
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.5rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          {onCreateDefaults && (
            <button
              onClick={onCreateDefaults}
              className="btn btn-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <FiZap size={16} style={{ color: '#F59E0B' }} />
              <span>Standard-Abteilungen hinzufügen</span>
            </button>
          )}
          <button
            onClick={onCreateNew}
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <FiPlus size={16} />
            <span>Neue Abteilung anlegen</span>
          </button>
        </div>
      </div>
    );
  }

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Prüfe, welche Standard-Abteilungen fehlen
  const existingNames = departments.map(d => d.name);
  const missingBusinessDepartments = BUSINESS_DEPARTMENTS.filter(
    dept => !existingNames.includes(dept.name)
  );
  const missingPrivateDepartments = PRIVATE_DEPARTMENTS.filter(
    dept => !existingNames.includes(dept.name)
  );

  return (
    <div className="card" style={{ padding: 0 }}>
      <div style={{ padding: '1rem', borderBottom: '1px solid #e9ecef', backgroundColor: '#f8f9fa', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '600' }}>
          Abteilungen ({departments.length})
        </h3>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {onRestoreBusinessDefaults && (
            <button
              onClick={onRestoreBusinessDefaults}
              disabled={missingBusinessDepartments.length === 0}
              style={{ 
                fontSize: '0.8125rem', 
                padding: '0.375rem 0.75rem', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '0.375rem',
                backgroundColor: 'transparent',
                border: '1px solid #dee2e6',
                borderRadius: '4px',
                color: missingBusinessDepartments.length === 0 ? '#adb5bd' : '#6c757d',
                cursor: missingBusinessDepartments.length === 0 ? 'not-allowed' : 'pointer',
                opacity: missingBusinessDepartments.length === 0 ? 0.5 : 1,
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                if (missingBusinessDepartments.length > 0) {
                  e.currentTarget.style.backgroundColor = '#f8f9fa';
                  e.currentTarget.style.borderColor = '#ced4da';
                  e.currentTarget.style.color = '#495057';
                }
              }}
              onMouseLeave={(e) => {
                if (missingBusinessDepartments.length > 0) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.borderColor = '#dee2e6';
                  e.currentTarget.style.color = '#6c757d';
                }
              }}
              title={missingBusinessDepartments.length === 0 ? 'Alle Firmen-Abteilungen sind bereits vorhanden' : `Fehlende Firmen-Abteilungen wiederherstellen (${missingBusinessDepartments.length})`}
            >
              <FiBriefcase size={16} style={{ color: '#10B981' }} />
              <span>Fehlende Firmen-Abteilungen wiederherstellen</span>
            </button>
          )}
          {onRestorePrivateDefaults && (
            <button
              onClick={onRestorePrivateDefaults}
              disabled={missingPrivateDepartments.length === 0}
              style={{ 
                fontSize: '0.8125rem', 
                padding: '0.375rem 0.75rem', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '0.375rem',
                backgroundColor: 'transparent',
                border: '1px solid #dee2e6',
                borderRadius: '4px',
                color: missingPrivateDepartments.length === 0 ? '#adb5bd' : '#6c757d',
                cursor: missingPrivateDepartments.length === 0 ? 'not-allowed' : 'pointer',
                opacity: missingPrivateDepartments.length === 0 ? 0.5 : 1,
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                if (missingPrivateDepartments.length > 0) {
                  e.currentTarget.style.backgroundColor = '#f8f9fa';
                  e.currentTarget.style.borderColor = '#ced4da';
                  e.currentTarget.style.color = '#495057';
                }
              }}
              onMouseLeave={(e) => {
                if (missingPrivateDepartments.length > 0) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.borderColor = '#dee2e6';
                  e.currentTarget.style.color = '#6c757d';
                }
              }}
              title={missingPrivateDepartments.length === 0 ? 'Alle privaten Abteilungen sind bereits vorhanden' : `Private Abteilungen hinzufügen (${missingPrivateDepartments.length})`}
            >
              <FiUsers size={16} style={{ color: '#6c757d' }} />
              <span>Private Abteilungen hinzufügen</span>
            </button>
          )}
        </div>
      </div>
      <div>
        {departments.map((department) => (
          <div
            key={department.id}
            style={{
              padding: '0.75rem 1rem',
              borderBottom: '1px solid #e9ecef',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem', flexWrap: 'wrap' }}>
                <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: '600' }}>
                  {department.name}
                </h4>
                <span
                  style={{
                    padding: '0.15rem 0.4rem',
                    borderRadius: '4px',
                    fontSize: '0.7rem',
                    fontWeight: '600',
                    backgroundColor: department.isActive ? '#d4edda' : '#f8d7da',
                    color: department.isActive ? '#155724' : '#721c24',
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {department.isActive ? (
                      <>
                        <FiCheckCircle size={14} style={{ color: '#10B981' }} />
                        <span>Aktiv</span>
                      </>
                    ) : (
                      <>
                        <FiXCircle size={14} style={{ color: '#DC2626' }} />
                        <span>Inaktiv</span>
                      </>
                    )}
                  </span>
                </span>
                {!department.emailAccountId && (
                  <span
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.15rem 0.4rem',
                      borderRadius: '4px',
                      fontSize: '0.7rem',
                      backgroundColor: '#fff3cd',
                      color: '#856404',
                    }}
                    title="Diese Abteilung benötigt ein E-Mail-Konto, um aktiviert zu werden"
                  >
                    <FiAlertTriangle size={14} />
                    <span>Kein E-Mail-Konto</span>
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', fontSize: '0.8rem', color: '#6c757d', alignItems: 'center' }}>
                {department.description && (
                  <span style={{ color: '#6c757d' }}>
                    {department.description}
                  </span>
                )}
                {department.manager && (
                  <span>
                    <strong>Manager:</strong>{' '}
                    {department.manager.firstName || department.manager.lastName
                      ? `${department.manager.firstName || ''} ${department.manager.lastName || ''}`.trim()
                      : department.manager.username}
                  </span>
                )}
                {department.emailAccount ? (
                  <span>
                    <strong>E-Mail:</strong>{' '}
                    <span style={{ color: department.emailAccount.isActive ? '#28a745' : '#dc3545' }}>
                      {department.emailAccount.name}
                    </span>
                  </span>
                ) : (
                  <span style={{ color: '#dc3545', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <FiAlertTriangle size={14} />
                    <strong>Kein E-Mail-Konto</strong>
                  </span>
                )}
                <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                  Erstellt: {formatDate(department.createdAt)}
                </span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0, marginLeft: '1rem' }}>
              {onToggleActive && (
                <button
                  onClick={async () => {
                    if (togglingDepartmentId === department.id) return;
                    setTogglingDepartmentId(department.id);
                    try {
                      await onToggleActive(department.id, !department.isActive);
                    } finally {
                      setTogglingDepartmentId(null);
                    }
                  }}
                  disabled={togglingDepartmentId === department.id || !department.emailAccountId}
                  className={department.isActive ? 'btn btn-warning' : 'btn btn-success'}
                  style={{ 
                    padding: '0.35rem 0.7rem', 
                    fontSize: '0.75rem',
                    opacity: !department.emailAccountId ? 0.5 : 1,
                    cursor: !department.emailAccountId ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                  }}
                  title={!department.emailAccountId ? 'Bitte weisen Sie zuerst ein E-Mail-Konto zu' : ''}
                >
                  {togglingDepartmentId === department.id ? (
                    <span>...</span>
                  ) : department.isActive ? (
                    <FiXCircle size={16} />
                  ) : (
                    <FiCheckCircle size={16} style={{ color: '#10B981' }} />
                  )}
                  <span>{togglingDepartmentId === department.id ? '...' : department.isActive ? 'Deaktivieren' : 'Aktivieren'}</span>
                </button>
              )}
              <button
                onClick={() => onEdit(department)}
                className="btn btn-secondary"
                style={{ padding: '0.35rem 0.7rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
              >
                <FiEdit size={14} />
                <span>Bearbeiten</span>
              </button>
              <button
                onClick={() => onDelete(department.id)}
                className="btn btn-danger"
                style={{ padding: '0.35rem 0.7rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
              >
                <FiTrash2 size={14} />
                <span>Löschen</span>
              </button>
            </div>
          </div>
        ))}
      </div>
      
      {/* Erklärungssektion */}
      <div style={{ 
        borderTop: '1px solid #e9ecef', 
        padding: '1.5rem', 
        backgroundColor: '#f8f9fa' 
      }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          cursor: 'pointer',
          marginBottom: showExplanation ? '1rem' : 0,
        }}
        onClick={() => setShowExplanation(!showExplanation)}
        >
          <h4 style={{ 
            margin: 0, 
            fontSize: '0.95rem', 
            fontWeight: '600', 
            color: '#495057',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}>
            <FiInfo size={18} style={{ color: '#2563EB' }} />
            <span>Was sind Abteilungen? - Erklärung für Einsteiger</span>
          </h4>
          <FiChevronDown size={20} style={{ 
            color: '#6c757d',
            transition: 'transform 0.2s ease',
            transform: showExplanation ? 'rotate(180deg)' : 'rotate(0deg)',
          }} />
        </div>
        
        {showExplanation && (
          <div style={{ 
            animation: 'fadeIn 0.3s ease',
            color: '#495057',
            lineHeight: '1.6',
          }}>
            <div style={{ marginBottom: '1.5rem' }}>
              <h5 style={{ 
                margin: '0 0 0.75rem 0', 
                fontSize: '0.9rem', 
                fontWeight: '600',
                color: '#333',
              }}>
                Was sind Abteilungen?
              </h5>
              <p style={{ 
                margin: 0, 
                fontSize: '0.875rem',
                color: '#6c757d',
              }}>
                Abteilungen sind organisatorische Einheiten in Ihrem E-Mail-System, die helfen, E-Mails zu strukturieren und zuzuordnen. 
                Sie können Abteilungen für verschiedene Bereiche Ihres Unternehmens (z.B. Buchhaltung, Marketing) oder für private Zwecke 
                (z.B. Familie, einzelne Familienmitglieder) erstellen.
              </p>
            </div>
            
            <div style={{ marginBottom: '1.5rem' }}>
              <h5 style={{ 
                margin: '0 0 0.75rem 0', 
                fontSize: '0.9rem', 
                fontWeight: '600',
                color: '#333',
              }}>
                Wofür werden Abteilungen verwendet?
              </h5>
              <ul style={{ 
                margin: 0, 
                paddingLeft: '1.25rem',
                fontSize: '0.875rem',
                color: '#6c757d',
              }}>
                <li style={{ marginBottom: '0.5rem' }}>
                  <strong>E-Mail-Zuordnung:</strong> E-Mails können bestimmten Abteilungen zugeordnet werden, um die Übersicht zu behalten.
                </li>
                <li style={{ marginBottom: '0.5rem' }}>
                  <strong>Organisation:</strong> Strukturieren Sie Ihre E-Mail-Kommunikation nach Bereichen oder Personen.
                </li>
                <li style={{ marginBottom: '0.5rem' }}>
                  <strong>Filterung:</strong> Filtern Sie E-Mails nach Abteilungen, um schnell die gewünschten Nachrichten zu finden.
                </li>
                <li style={{ marginBottom: '0.5rem' }}>
                  <strong>Automatisierung:</strong> Automatische Regeln können E-Mails basierend auf Abteilungen verarbeiten.
                </li>
              </ul>
            </div>
            
            <div>
              <h5 style={{ 
                margin: '0 0 0.75rem 0', 
                fontSize: '0.9rem', 
                fontWeight: '600',
                color: '#333',
              }}>
                Häufig gestellte Fragen (FAQ)
              </h5>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ 
                  padding: '0.75rem',
                  backgroundColor: '#fff',
                  borderRadius: '4px',
                  border: '1px solid #e9ecef',
                }}>
                  <div style={{ 
                    fontWeight: '600', 
                    fontSize: '0.875rem',
                    color: '#333',
                    marginBottom: '0.5rem',
                  }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <FiHelpCircle size={16} style={{ color: '#2563EB' }} />
                      <span>Muss ich Abteilungen verwenden?</span>
                    </span>
                  </div>
                  <div style={{ 
                    fontSize: '0.8125rem',
                    color: '#6c757d',
                  }}>
                    Nein, Abteilungen sind optional. Sie können das System auch ohne Abteilungen nutzen, 
                    aber sie helfen bei der besseren Organisation Ihrer E-Mails.
                  </div>
                </div>
                
                <div style={{ 
                  padding: '0.75rem',
                  backgroundColor: '#fff',
                  borderRadius: '4px',
                  border: '1px solid #e9ecef',
                }}>
                  <div style={{ 
                    fontWeight: '600', 
                    fontSize: '0.875rem',
                    color: '#333',
                    marginBottom: '0.5rem',
                  }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <FiHelpCircle size={16} style={{ color: '#2563EB' }} />
                      <span>Wie viele Abteilungen kann ich erstellen?</span>
                    </span>
                  </div>
                  <div style={{ 
                    fontSize: '0.8125rem',
                    color: '#6c757d',
                  }}>
                    Sie können so viele Abteilungen erstellen, wie Sie benötigen. Es gibt keine feste Obergrenze.
                  </div>
                </div>
                
                <div style={{ 
                  padding: '0.75rem',
                  backgroundColor: '#fff',
                  borderRadius: '4px',
                  border: '1px solid #e9ecef',
                }}>
                  <div style={{ 
                    fontWeight: '600', 
                    fontSize: '0.875rem',
                    color: '#333',
                    marginBottom: '0.5rem',
                  }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <FiHelpCircle size={16} style={{ color: '#2563EB' }} />
                      <span>Was bedeutet "Aktiv" und "Inaktiv"?</span>
                    </span>
                  </div>
                  <div style={{ 
                    fontSize: '0.8125rem',
                    color: '#6c757d',
                  }}>
                    Nur aktive Abteilungen können für neue E-Mails verwendet werden. Inaktive Abteilungen 
                    bleiben erhalten, werden aber nicht mehr in Auswahlmenüs angezeigt.
                  </div>
                </div>
                
                <div style={{ 
                  padding: '0.75rem',
                  backgroundColor: '#fff',
                  borderRadius: '4px',
                  border: '1px solid #e9ecef',
                }}>
                  <div style={{ 
                    fontWeight: '600', 
                    fontSize: '0.875rem',
                    color: '#333',
                    marginBottom: '0.5rem',
                  }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <FiHelpCircle size={16} style={{ color: '#2563EB' }} />
                      <span>Warum benötigt eine Abteilung ein E-Mail-Konto?</span>
                    </span>
                  </div>
                  <div style={{ 
                    fontSize: '0.8125rem',
                    color: '#6c757d',
                  }}>
                    Ein E-Mail-Konto ist erforderlich, damit die Abteilung E-Mails senden und empfangen kann. 
                    Ohne zugewiesenes E-Mail-Konto kann die Abteilung nicht aktiviert werden.
                  </div>
                </div>
                
                <div style={{ 
                  padding: '0.75rem',
                  backgroundColor: '#fff',
                  borderRadius: '4px',
                  border: '1px solid #e9ecef',
                }}>
                  <div style={{ 
                    fontWeight: '600', 
                    fontSize: '0.875rem',
                    color: '#333',
                    marginBottom: '0.5rem',
                  }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <FiHelpCircle size={16} style={{ color: '#2563EB' }} />
                      <span>Was ist der Unterschied zwischen Firmen- und privaten Abteilungen?</span>
                    </span>
                  </div>
                  <div style={{ 
                    fontSize: '0.8125rem',
                    color: '#6c757d',
                  }}>
                    Firmen-Abteilungen (z.B. Buchhaltung, Marketing) sind für geschäftliche Zwecke gedacht. 
                    Private Abteilungen (z.B. Familie, Elternteil 1) sind für den privaten Gebrauch innerhalb 
                    einer Familie oder für einzelne Personen konzipiert.
                  </div>
                </div>
                
                <div style={{ 
                  padding: '0.75rem',
                  backgroundColor: '#fff',
                  borderRadius: '4px',
                  border: '1px solid #e9ecef',
                }}>
                  <div style={{ 
                    fontWeight: '600', 
                    fontSize: '0.875rem',
                    color: '#333',
                    marginBottom: '0.5rem',
                  }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <FiHelpCircle size={16} style={{ color: '#2563EB' }} />
                      <span>Kann ich eine Abteilung später löschen?</span>
                    </span>
                  </div>
                  <div style={{ 
                    fontSize: '0.8125rem',
                    color: '#6c757d',
                  }}>
                    Ja, Sie können Abteilungen jederzeit löschen. Beachten Sie, dass zugeordnete E-Mails 
                    dann nicht mehr dieser Abteilung zugeordnet sind.
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

