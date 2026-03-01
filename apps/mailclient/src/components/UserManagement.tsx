'use client';

import { FiUsers, FiPlus, FiEdit, FiTrash2 } from 'react-icons/fi';

interface Department {
  id: string;
  name: string;
  description?: string;
}

interface User {
  id: string;
  username: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role: string;
  status: string;
  lastLoginAt?: string;
  createdAt?: string;
  updatedAt?: string;
  departments?: Department[];
}

interface UserManagementProps {
  users: User[];
  loading: boolean;
  onEdit: (user: User) => void;
  onDelete: (userId: string) => void;
  onCreateNew: () => void;
}

export default function UserManagement({
  users,
  loading,
  onEdit,
  onDelete,
  onCreateNew,
}: UserManagementProps) {
  if (loading) {
    return (
      <div className="empty-state">
        <div className="spinner" style={{ margin: '0 auto' }}></div>
        <p style={{ marginTop: '1rem', color: '#6c757d' }}>Lade Benutzer...</p>
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <FiUsers size={48} style={{ color: '#6c757d' }} />
        </div>
        <div className="empty-state-title">Keine Benutzer</div>
        <div className="empty-state-text">
          Erstellen Sie den ersten Benutzer für dieses Konto.
        </div>
        <button
          onClick={onCreateNew}
          className="btn btn-primary"
          style={{ marginTop: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
        >
          <FiPlus size={16} />
          <span>Neuen Benutzer anlegen</span>
        </button>
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

  const getRoleBadge = (role: string) => {
    if (role === 'admin') {
      return <span className="badge badge-danger">Admin</span>;
    }
    return <span className="badge badge-secondary">Benutzer</span>;
  };

  const getStatusBadge = (status: string) => {
    if (status === 'active') {
      return <span className="badge badge-success">Aktiv</span>;
    }
    return <span className="badge badge-warning">Inaktiv</span>;
  };

  return (
    <div className="card" style={{ padding: 0 }}>
      <div style={{ padding: '1rem', borderBottom: '1px solid #e9ecef', backgroundColor: '#f8f9fa' }}>
        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '600' }}>
          Benutzer ({users.length})
        </h3>
      </div>
      <div>
        {users.map((user) => (
          <div
            key={user.id}
            style={{
              padding: '1.5rem',
              borderBottom: '1px solid #e9ecef',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
            }}
          >
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '600' }}>
                  {user.firstName || user.lastName
                    ? `${user.firstName || ''} ${user.lastName || ''}`.trim()
                    : user.username}
                </h4>
                {getRoleBadge(user.role)}
                {getStatusBadge(user.status)}
              </div>
              <p style={{ margin: '0 0 0.5rem 0', color: '#6c757d' }}>
                <strong>Benutzername:</strong> {user.username}
              </p>
              <p style={{ margin: '0 0 0.5rem 0', color: '#6c757d' }}>
                <strong>E-Mail:</strong> {user.email || '-'}
              </p>
              {user.departments && user.departments.length > 0 && (
                <div style={{ margin: '0 0 0.5rem 0' }}>
                  <strong style={{ color: '#6c757d', fontSize: '0.875rem' }}>Abteilungen:</strong>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', marginTop: '0.25rem' }}>
                    {user.departments.map((dept) => (
                      <span
                        key={dept.id}
                        className="badge badge-secondary"
                        style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                      >
                        {dept.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <div style={{ fontSize: '0.875rem', color: '#6c757d' }}>
                <div>
                  <strong>Letzter Login:</strong> {formatDate(user.lastLoginAt)}
                </div>
                <div>
                  <strong>Erstellt:</strong> {formatDate(user.createdAt)}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={() => onEdit(user)}
                className="btn btn-secondary"
                style={{ padding: '0.5rem 1rem', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              >
                <FiEdit size={16} />
                <span>Bearbeiten</span>
              </button>
              <button
                onClick={() => onDelete(user.id)}
                className="btn btn-danger"
                style={{ padding: '0.5rem 1rem', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              >
                <FiTrash2 size={16} />
                <span>Löschen</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

