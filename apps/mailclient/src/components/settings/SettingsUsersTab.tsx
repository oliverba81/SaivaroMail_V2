'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ToastProvider';
import { useConfirm } from '@/components/ConfirmDialog';
import UserManagement from '@/components/UserManagement';
import UserForm from '@/components/UserForm';
import { FiPlus } from 'react-icons/fi';

interface Department {
  id: string;
  name: string;
  description?: string;
}

interface EmailFilterOption {
  id: string;
  name: string;
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
  visibleFilterIds?: string[];
}

interface UserFormData {
  username: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: string;
  status: string;
  departments: Department[];
  visibleFilterIds: string[];
}

interface SettingsUsersTabProps {
  onError?: (error: string) => void;
  onBack?: () => void;
  toast?: ReturnType<typeof useToast>;
  router?: ReturnType<typeof useRouter>;
  users?: User[];
  onUsersChange?: (users: User[]) => void;
  companyFilters?: EmailFilterOption[];
}

const INITIAL_USER_FORM_DATA: UserFormData = {
  username: '',
  email: '',
  password: '',
  firstName: '',
  lastName: '',
  role: 'user',
  status: 'active',
  departments: [],
  visibleFilterIds: [],
};

export default function SettingsUsersTab({
  onError,
  onBack,
  toast: toastProp,
  router: routerProp,
  users: usersProp,
  onUsersChange,
  companyFilters = [],
}: SettingsUsersTabProps) {
  const router = routerProp || useRouter();
  const toast = toastProp || useToast();
  const { confirm } = useConfirm();
  const [users, setUsers] = useState<User[]>(usersProp || []);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [showUserForm, setShowUserForm] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [userFormData, setUserFormData] = useState<UserFormData>(INITIAL_USER_FORM_DATA);
  const [submittingUser, setSubmittingUser] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loadingDepartments, setLoadingDepartments] = useState(false);

  // Lade Users, wenn nicht als Props übergeben
  const loadUsers = useCallback(async (silent = false) => {
    try {
      setLoadingUsers(true);
      const token = localStorage.getItem('mailclient_token');
      const response = await fetch('/api/users', {
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

      if (response.status === 403) {
        if (!silent) {
          const errorMsg = 'Nur Administratoren können Benutzer verwalten';
          if (onError) {
            onError(errorMsg);
          }
        }
        setUsers([]);
        return;
      }

      // Prüfe, ob die Antwort JSON ist
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        if (!silent) {
          const errorMsg = 'Server-Fehler: Die API hat keine JSON-Antwort zurückgegeben';
          if (onError) {
            onError(errorMsg);
          }
          console.error('Ungültige Antwort von /api/users:', text.substring(0, 200));
        }
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        if (!silent) {
          const errorMessage = data.error || 'Fehler beim Laden der Benutzer';
          const errorDetails = data.details ? `: ${data.details}` : '';
          const errorMsg = `${errorMessage}${errorDetails}`;
          if (onError) {
            onError(errorMsg);
          }
          console.error('Fehler beim Laden der Benutzer:', data);
        }
        return;
      }

      const loadedUsers = data.users || [];
      setUsers(loadedUsers);
      if (onUsersChange) {
        onUsersChange(loadedUsers);
      }
    } catch (err: any) {
      if (!silent) {
        // Prüfe, ob es ein JSON-Parse-Fehler ist
        if (err.message && err.message.includes('JSON')) {
          const errorMsg = 'Server-Fehler: Die API hat keine gültige JSON-Antwort zurückgegeben. Bitte prüfen Sie die Server-Logs.';
          if (onError) {
            onError(errorMsg);
          }
          console.error('JSON-Parse-Fehler beim Laden der Benutzer:', err);
        } else {
          const errorMessage = err.message || 'Fehler beim Laden der Benutzer';
          if (onError) {
            onError(errorMessage);
          }
          console.error('Fehler beim Laden der Benutzer:', err);
        }
      }
    } finally {
      setLoadingUsers(false);
    }
  }, [router, onError, onUsersChange]);

  // Lade Departments
  const loadDepartments = useCallback(async () => {
    try {
      setLoadingDepartments(true);
      const token = localStorage.getItem('mailclient_token');
      const response = await fetch('/api/departments', {
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

      const data = await response.json();

      if (!response.ok) {
        console.error('Fehler beim Laden der Abteilungen:', data.error);
        setDepartments([]);
        return;
      }

      setDepartments(data.departments || []);
    } catch (err: any) {
      console.error('Fehler beim Laden der Abteilungen:', err);
      setDepartments([]);
    } finally {
      setLoadingDepartments(false);
    }
  }, [router]);

  // Lade Users und Departments beim Mount, wenn nicht als Props übergeben
  useEffect(() => {
    if (!usersProp || usersProp.length === 0) {
      loadUsers();
    }
    loadDepartments();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Keyboard Shortcut: Ctrl+N / Cmd+N
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'n' && !showUserForm) {
        e.preventDefault();
        setShowUserForm(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showUserForm]);

  const handleSubmitUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (onError) {
      onError('');
    }
    setSubmittingUser(true);

    try {
      const token = localStorage.getItem('mailclient_token');
      const url = editingUser
        ? `/api/users/${editingUser.id}`
        : '/api/users';
      const method = editingUser ? 'PATCH' : 'POST';

      const body: any = {
        username: userFormData.username,
        email: userFormData.email,
        firstName: userFormData.firstName || undefined,
        lastName: userFormData.lastName || undefined,
        role: userFormData.role,
        status: userFormData.status,
        departmentIds: userFormData.departments?.map(d => d.id) || [],
        visibleFilterIds: Array.isArray(userFormData.visibleFilterIds) ? userFormData.visibleFilterIds : [],
      };

      // Nur Passwort senden, wenn es gesetzt ist (bei Update) oder bei neuem User
      if (userFormData.password || !editingUser) {
        if (!userFormData.password && !editingUser) {
          const errorMsg = 'Passwort ist erforderlich';
          if (onError) {
            onError(errorMsg);
          }
          setSubmittingUser(false);
          return;
        }
        if (userFormData.password) {
          body.password = userFormData.password;
        }
      }

      const response = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (response.status === 401) {
        localStorage.removeItem('mailclient_token');
        localStorage.removeItem('mailclient_user');
        router.push('/login');
        return;
      }

      if (response.status === 403) {
        const errorMsg = 'Nur Administratoren können Benutzer verwalten';
        if (onError) {
          onError(errorMsg);
        }
        setSubmittingUser(false);
        return;
      }

      // Prüfe, ob die Antwort JSON ist
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        const errorMsg = 'Server-Fehler: Die API hat keine JSON-Antwort zurückgegeben';
        if (onError) {
          onError(errorMsg);
        }
        console.error('Ungültige Antwort von /api/users:', text.substring(0, 200));
        setSubmittingUser(false);
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        const errorMessage = data.error || 'Fehler beim Speichern des Benutzers';
        const errorDetails = data.details ? `: ${data.details}` : '';
        const errorMsg = `${errorMessage}${errorDetails}`;
        if (onError) {
          onError(errorMsg);
        }
        console.error('Fehler beim Speichern des Benutzers:', data);
        setSubmittingUser(false);
        return;
      }

      // Formular zurücksetzen und Liste neu laden
      setUserFormData(INITIAL_USER_FORM_DATA);
      setShowUserForm(false);
      setEditingUser(null);
      await loadUsers();
      toast.showSuccess('Benutzer erfolgreich gespeichert!');
    } catch (err: any) {
      const errorMsg = 'Fehler beim Speichern des Benutzers';
      if (onError) {
        onError(errorMsg);
      }
    } finally {
      setSubmittingUser(false);
    }
  };

  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setUserFormData({
      username: user.username,
      email: user.email,
      password: '', // Passwort nicht anzeigen
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      role: user.role,
      status: user.status,
      departments: user.departments || [],
      visibleFilterIds: Array.isArray(user.visibleFilterIds) ? user.visibleFilterIds : [],
    });
    setShowUserForm(true);
  };

  const handleDeleteUser = async (userId: string) => {
    if (!(await confirm({ message: 'Möchten Sie diesen Benutzer wirklich löschen?', variant: 'danger', confirmLabel: 'Löschen' }))) {
      return;
    }

    try {
      const token = localStorage.getItem('mailclient_token');
      const response = await fetch(`/api/users/${userId}`, {
        method: 'DELETE',
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

      if (response.status === 403) {
        const errorMsg = 'Nur Administratoren können Benutzer löschen';
        if (onError) {
          onError(errorMsg);
        }
        return;
      }

      if (!response.ok) {
        const data = await response.json();
        const errorMsg = data.error || 'Fehler beim Löschen des Benutzers';
        if (onError) {
          onError(errorMsg);
        }
        return;
      }

      await loadUsers();
      toast.showSuccess('Benutzer erfolgreich gelöscht!');
    } catch (err: any) {
      const errorMsg = 'Fehler beim Löschen des Benutzers';
      if (onError) {
        onError(errorMsg);
      }
    }
  };

  const handleCancelUser = () => {
    setShowUserForm(false);
    setEditingUser(null);
    setUserFormData(INITIAL_USER_FORM_DATA);
    if (onBack) {
      onBack();
    }
  };

  return (
    <>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1.5rem',
        }}
      >
        <h2 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#333' }}>
          Benutzer verwalten
        </h2>
        {!showUserForm && (
          <button
            onClick={() => setShowUserForm(true)}
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <FiPlus size={16} />
            <span>Neuer Benutzer</span>
          </button>
        )}
      </div>

      {showUserForm ? (
        <UserForm
          user={editingUser}
          formData={userFormData as any}
          onFormDataChange={(data) => {
            setUserFormData({
              username: data.username,
              email: data.email,
              password: data.password || '',
              firstName: data.firstName || '',
              lastName: data.lastName || '',
              role: data.role,
              status: data.status,
              departments: data.departments || [],
              visibleFilterIds: data.visibleFilterIds ?? [],
            });
          }}
          submitting={submittingUser}
          onSubmit={handleSubmitUser}
          onCancel={handleCancelUser}
          departments={departments}
          loadingDepartments={loadingDepartments}
          companyFilters={companyFilters}
        />
      ) : (
        <UserManagement
          users={users}
          loading={loadingUsers}
          onEdit={handleEditUser}
          onDelete={handleDeleteUser}
          onCreateNew={() => setShowUserForm(true)}
        />
      )}
    </>
  );
}

