'use client';

import { SkeletonList } from './Skeleton';
import { FiMail, FiEdit, FiTrash2, FiPlus } from 'react-icons/fi';

interface EmailAccount {
  id: string;
  name: string;
  email: string;
  imap: {
    host?: string;
    port?: number;
    username?: string;
    password?: string;
    ssl?: boolean;
  };
  smtp: {
    host?: string;
    port?: number;
    username?: string;
    password?: string;
    ssl?: boolean;
    tls?: boolean;
  };
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface EmailAccountListProps {
  accounts: EmailAccount[];
  loading: boolean;
  onEdit: (account: EmailAccount) => void;
  onDelete: (accountId: string) => void;
  onCreateNew: () => void;
}

export default function EmailAccountList({
  accounts,
  loading,
  onEdit,
  onDelete,
  onCreateNew,
}: EmailAccountListProps) {
  if (loading) {
    return (
      <div className="empty-state">
        <SkeletonList count={3} />
      </div>
    );
  }

  if (accounts.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <FiMail size={48} style={{ color: '#6c757d' }} />
        </div>
        <div className="empty-state-title">Keine E-Mail-Konten</div>
        <div className="empty-state-text">
          Legen Sie Ihr erstes IMAP/SMTP-Konto an, um E-Mails zu empfangen und zu senden.
        </div>
          <button
            onClick={onCreateNew}
            className="btn btn-primary"
            style={{ marginTop: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <FiPlus size={16} />
            <span>Neues Konto anlegen</span>
          </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {accounts.map((account) => (
        <div
          key={account.id}
          className="card"
          style={{
            padding: '1.5rem',
            transition: 'all 0.2s ease',
            border: '1px solid #e9ecef',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <div
                  style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '12px',
                    background: 'linear-gradient(135deg, #e7f3ff 0%, #cfe2ff 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.5rem',
                    flexShrink: 0,
                  }}
                >
                  <FiMail size={24} style={{ color: '#2563EB' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                    <h4 style={{ margin: 0, fontSize: '1.125rem', fontWeight: '600', color: '#333' }}>
                      {account.name}
                    </h4>
                    {account.isActive ? (
                      <span
                        className="badge badge-success"
                        style={{
                          fontSize: '0.75rem',
                          padding: '0.25rem 0.5rem',
                          borderRadius: '12px',
                        }}
                      >
                        Aktiv
                      </span>
                    ) : (
                      <span
                        className="badge badge-warning"
                        style={{
                          fontSize: '0.75rem',
                          padding: '0.25rem 0.5rem',
                          borderRadius: '12px',
                        }}
                      >
                        Inaktiv
                      </span>
                    )}
                  </div>
                  <p style={{ margin: 0, color: '#6c757d', fontSize: '0.9rem' }}>{account.email}</p>
                </div>
              </div>
              <div
                style={{
                  display: 'flex',
                  gap: '1.5rem',
                  fontSize: '0.875rem',
                  color: '#6c757d',
                  marginTop: '0.75rem',
                  paddingTop: '0.75rem',
                  borderTop: '1px solid #f0f0f0',
                }}
              >
                {account.imap.host && (
                  <div>
                    <strong style={{ color: '#333', marginRight: '0.25rem' }}>IMAP:</strong>
                    {account.imap.host}:{account.imap.port || 993}
                  </div>
                )}
                {account.smtp.host && (
                  <div>
                    <strong style={{ color: '#333', marginRight: '0.25rem' }}>SMTP:</strong>
                    {account.smtp.host}:{account.smtp.port || 587}
                  </div>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
              <button
                onClick={() => onEdit(account)}
                className="btn btn-secondary"
                style={{
                  padding: '0.5rem 1rem',
                  fontSize: '0.875rem',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
              >
                <FiEdit size={16} />
                <span>Bearbeiten</span>
              </button>
              <button
                onClick={() => onDelete(account.id)}
                className="btn btn-danger"
                style={{
                  padding: '0.5rem 1rem',
                  fontSize: '0.875rem',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
              >
                <FiTrash2 size={16} />
                <span>Löschen</span>
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

