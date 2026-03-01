'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ToastProvider';
import { useConfirm } from '@/components/ConfirmDialog';
import DepartmentManagement from '@/components/DepartmentManagement';
import DepartmentForm from '@/components/DepartmentForm';
import DepartmentRestoreModal from '@/components/DepartmentRestoreModal';
import { BUSINESS_DEPARTMENTS, PRIVATE_DEPARTMENTS } from '@/lib/department-constants';
import { isEmptyEditorHtml } from '@/utils/signature-placeholders';
import { FiPlus } from 'react-icons/fi';

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

interface DepartmentFormData {
  name: string;
  description: string;
  managerId: string;
  emailAccountId: string;
  isActive: boolean;
  signature: string;
  signaturePlain: string;
  signatureEnabled: boolean;
}

interface SettingsDepartmentsTabProps {
  onError?: (error: string) => void;
  onBack?: () => void;
  toast?: ReturnType<typeof useToast>;
  router?: ReturnType<typeof useRouter>;
  departments?: Department[];
  onDepartmentsChange?: (departments: Department[]) => void;
}

const INITIAL_DEPARTMENT_FORM_DATA: DepartmentFormData = {
  name: '',
  description: '',
  managerId: '',
  emailAccountId: '',
  isActive: false,
  signature: '',
  signaturePlain: '',
  signatureEnabled: false,
};

export default function SettingsDepartmentsTab({
  onError,
  onBack,
  toast: toastProp,
  router: routerProp,
  departments: departmentsProp,
  onDepartmentsChange,
}: SettingsDepartmentsTabProps) {
  const router = routerProp || useRouter();
  const toast = toastProp || useToast();
  const { confirm } = useConfirm();
  const [departments, setDepartments] = useState<Department[]>(departmentsProp || []);
  const [loadingDepartments, setLoadingDepartments] = useState(false);
  const [showDepartmentForm, setShowDepartmentForm] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);
  const [departmentFormData, setDepartmentFormData] = useState<DepartmentFormData>(INITIAL_DEPARTMENT_FORM_DATA);
  const [submittingDepartment, setSubmittingDepartment] = useState(false);
  const [emailAccounts, setEmailAccounts] = useState<EmailAccount[]>([]);
  const [loadingEmailAccounts, setLoadingEmailAccounts] = useState(false);
  const [users, setUsers] = useState<Manager[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  
  // State für Modal-Verwaltung
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [restoreModalDepartments, setRestoreModalDepartments] = useState<Array<{name: string, description: string}>>([]);
  const [restoreModalType, setRestoreModalType] = useState<'business' | 'private' | null>(null);
  const [restoringDepartments, setRestoringDepartments] = useState(false);

  // Lade Departments, wenn nicht als Props übergeben
  const loadDepartments = useCallback(async () => {
    try {
      setLoadingDepartments(true);
      const token = localStorage.getItem('mailclient_token');
      // Als Admin alle Abteilungen laden (auch inaktive)
      const response = await fetch('/api/departments?includeInactive=true', {
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
        const errorMsg = 'Nur Administratoren können Abteilungen verwalten';
        if (onError) {
          onError(errorMsg);
        }
        setDepartments([]);
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        const errorMsg = data.error || 'Fehler beim Laden der Abteilungen';
        if (onError) {
          onError(errorMsg);
        }
        return;
      }

      const loadedDepartments = data.departments || [];
      setDepartments(loadedDepartments);
      if (onDepartmentsChange) {
        onDepartmentsChange(loadedDepartments);
      }
    } catch (err: any) {
      const errorMsg = 'Fehler beim Laden der Abteilungen';
      if (onError) {
        onError(errorMsg);
      }
    } finally {
      setLoadingDepartments(false);
    }
  }, [router, onError, onDepartmentsChange]);

  // Lade Email Accounts
  const loadEmailAccountsForDepartments = useCallback(async () => {
    try {
      setLoadingEmailAccounts(true);
      const token = localStorage.getItem('mailclient_token');
      const response = await fetch('/api/email-accounts', {
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
        console.error('Fehler beim Laden der E-Mail-Konten:', data.error);
        setEmailAccounts([]);
        return;
      }

      // Filter: Nur aktive Konten mit SMTP-Daten
      const filteredAccounts = (data.accounts || []).filter((acc: any) => 
        acc.isActive && acc.smtp?.host && acc.smtp?.username
      );

      setEmailAccounts(filteredAccounts);
    } catch (err: any) {
      console.error('Fehler beim Laden der E-Mail-Konten:', err);
      setEmailAccounts([]);
    } finally {
      setLoadingEmailAccounts(false);
    }
  }, [router]);

  // Lade Users (für Manager-Auswahl)
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
          console.warn('Nur Administratoren können Benutzer verwalten');
        }
        setUsers([]);
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        if (!silent) {
          console.error('Fehler beim Laden der Benutzer:', data.error);
        }
        setUsers([]);
        return;
      }

      setUsers(data.users || []);
    } catch (err: any) {
      if (!silent) {
        console.error('Fehler beim Laden der Benutzer:', err);
      }
      setUsers([]);
    } finally {
      setLoadingUsers(false);
    }
  }, [router]);

  // Immer alle Abteilungen (inkl. inaktive) laden, wenn der Tab gemountet wird –
  // die Parent-Liste enthält nur aktive Abteilungen und wäre unvollständig.
  useEffect(() => {
    loadDepartments();
    loadEmailAccountsForDepartments();
    loadUsers(true); // Silent, um Fehler zu vermeiden
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Keyboard Shortcut: Ctrl+N / Cmd+N
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'n' && !showDepartmentForm) {
        e.preventDefault();
        setShowDepartmentForm(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showDepartmentForm]);

  const handleSubmitDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (onError) {
      onError('');
    }
    setSubmittingDepartment(true);

    try {
      const token = localStorage.getItem('mailclient_token');
      const url = editingDepartment
        ? `/api/departments/${editingDepartment.id}`
        : '/api/departments';
      const method = editingDepartment ? 'PATCH' : 'POST';

      const body: any = {
        name: departmentFormData.name.trim(),
        description: departmentFormData.description?.trim() || undefined,
        managerId: departmentFormData.managerId || undefined,
        emailAccountId: departmentFormData.emailAccountId || undefined,
        isActive: departmentFormData.isActive || false,
        signature: isEmptyEditorHtml(departmentFormData.signature ?? '') ? null : (departmentFormData.signature?.trim() || null),
        signaturePlain: departmentFormData.signaturePlain?.trim() || null,
        signatureEnabled: departmentFormData.signatureEnabled ?? false,
      };

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
        const errorMsg = 'Nur Administratoren können Abteilungen verwalten';
        if (onError) {
          onError(errorMsg);
        }
        setSubmittingDepartment(false);
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        const errorMsg = data.error || 'Fehler beim Speichern der Abteilung';
        if (onError) {
          onError(errorMsg);
        }
        return;
      }

      // Formular zurücksetzen und Liste neu laden
      setDepartmentFormData(INITIAL_DEPARTMENT_FORM_DATA);
      setShowDepartmentForm(false);
      setEditingDepartment(null);
      await loadDepartments();
      toast.showSuccess('Abteilung erfolgreich gespeichert!');
    } catch (err: any) {
      const errorMsg = 'Fehler beim Speichern der Abteilung';
      if (onError) {
        onError(errorMsg);
      }
    } finally {
      setSubmittingDepartment(false);
    }
  };

  const handleEditDepartment = (department: Department) => {
    setEditingDepartment(department);
    setDepartmentFormData({
      name: department.name,
      description: department.description || '',
      managerId: department.managerId || '',
      emailAccountId: department.emailAccountId || department.emailAccount?.id || '',
      isActive: department.isActive || false,
      signature: department.signature ?? '',
      signaturePlain: department.signaturePlain ?? '',
      signatureEnabled: department.signatureEnabled ?? false,
    });
    setShowDepartmentForm(true);
  };

  const handleDeleteDepartment = async (departmentId: string) => {
    if (!(await confirm({ message: 'Möchten Sie diese Abteilung wirklich löschen?', variant: 'danger', confirmLabel: 'Löschen' }))) {
      return;
    }

    try {
      const token = localStorage.getItem('mailclient_token');
      const response = await fetch(`/api/departments/${departmentId}`, {
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
        const errorMsg = 'Nur Administratoren können Abteilungen löschen';
        if (onError) {
          onError(errorMsg);
        }
        return;
      }

      if (!response.ok) {
        const data = await response.json();
        const errorMsg = data.error || 'Fehler beim Löschen der Abteilung';
        if (onError) {
          onError(errorMsg);
        }
        return;
      }

      await loadDepartments();
      toast.showSuccess('Abteilung erfolgreich gelöscht!');
    } catch (err: any) {
      const errorMsg = 'Fehler beim Löschen der Abteilung';
      if (onError) {
        onError(errorMsg);
      }
    }
  };

  const handleCancelDepartment = () => {
    setShowDepartmentForm(false);
    setEditingDepartment(null);
    setDepartmentFormData(INITIAL_DEPARTMENT_FORM_DATA);
    if (onBack) {
      onBack();
    }
  };

  const handleToggleDepartmentActive = async (departmentId: string, isActive: boolean) => {
    try {
      const token = localStorage.getItem('mailclient_token');
      const response = await fetch(`/api/departments/${departmentId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ isActive }),
      });

      if (response.status === 401) {
        localStorage.removeItem('mailclient_token');
        localStorage.removeItem('mailclient_user');
        router.push('/login');
        return;
      }

      if (response.status === 403) {
        const errorMsg = 'Nur Administratoren können Abteilungen aktivieren/deaktivieren';
        if (onError) {
          onError(errorMsg);
        }
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        const errorMsg = data.error || 'Fehler beim Aktivieren/Deaktivieren der Abteilung';
        if (onError) {
          onError(errorMsg);
        }
        return;
      }

      await loadDepartments();
      toast.showSuccess(`Abteilung erfolgreich ${isActive ? 'aktiviert' : 'deaktiviert'}!`);
    } catch (err: any) {
      const errorMsg = 'Fehler beim Aktivieren/Deaktivieren der Abteilung';
      if (onError) {
        onError(errorMsg);
      }
    }
  };

  const handleCreateDefaultDepartments = async () => {
    if (onError) {
      onError('');
    }
    
    try {
      const token = localStorage.getItem('mailclient_token');
      const response = await fetch('/api/departments/default', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.status === 401) {
        localStorage.removeItem('mailclient_token');
        localStorage.removeItem('mailclient_user');
        router.push('/login');
        return;
      }

      if (response.status === 403) {
        const errorMsg = 'Nur Administratoren können Standard-Abteilungen erstellen';
        if (onError) {
          onError(errorMsg);
        }
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        const errorMsg = data.error || 'Fehler beim Erstellen der Standard-Abteilungen';
        if (onError) {
          onError(errorMsg);
        }
        return;
      }

      // Liste neu laden
      await loadDepartments();
      
      if (data.created > 0) {
        toast.showSuccess(`${data.created} Standard-Abteilung(en) erfolgreich erstellt!${data.skipped > 0 ? ` ${data.skipped} waren bereits vorhanden.` : ''}`);
      } else {
        toast.showInfo('Alle Standard-Abteilungen sind bereits vorhanden.');
      }
    } catch (err: any) {
      const errorMsg = 'Fehler beim Erstellen der Standard-Abteilungen';
      if (onError) {
        onError(errorMsg);
      }
    }
  };

  const handleRestoreBusinessDepartments = () => {
    if (onError) {
      onError('');
    }

    // Berechne fehlende Standard-Firmenabteilungen im Frontend
    const existingNames = departments.map(d => d.name);
    const missingDepartments = BUSINESS_DEPARTMENTS.filter(
      dept => !existingNames.includes(dept.name)
    );

    if (missingDepartments.length === 0) {
      toast.showInfo('Alle Firmen-Abteilungen sind bereits vorhanden.');
      return;
    }

    // Öffne Modal mit fehlenden Abteilungen
    setRestoreModalDepartments(missingDepartments);
    setRestoreModalType('business');
    setShowRestoreModal(true);
  };

  const handleRestorePrivateDepartments = () => {
    if (onError) {
      onError('');
    }

    // Berechne fehlende private Abteilungen im Frontend
    const existingNames = departments.map(d => d.name);
    const missingDepartments = PRIVATE_DEPARTMENTS.filter(
      dept => !existingNames.includes(dept.name)
    );

    if (missingDepartments.length === 0) {
      toast.showInfo('Alle privaten Abteilungen sind bereits vorhanden.');
      return;
    }

    // Öffne Modal mit fehlenden Abteilungen
    setRestoreModalDepartments(missingDepartments);
    setRestoreModalType('private');
    setShowRestoreModal(true);
  };

  const handleConfirmRestore = async () => {
    if (!restoreModalType) return;

    setRestoringDepartments(true);
    if (onError) {
      onError('');
    }

    try {
      const token = localStorage.getItem('mailclient_token');
      const response = await fetch(`/api/departments/default?type=${restoreModalType}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.status === 401) {
        localStorage.removeItem('mailclient_token');
        localStorage.removeItem('mailclient_user');
        router.push('/login');
        return;
      }

      if (response.status === 403) {
        const errorMsg = 'Nur Administratoren können Standard-Abteilungen erstellen';
        if (onError) {
          onError(errorMsg);
        }
        toast.showError(errorMsg);
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        const errorMsg = data.error || 'Fehler beim Erstellen der Abteilungen';
        if (onError) {
          onError(errorMsg);
        }
        toast.showError(errorMsg);
        return;
      }

      // Modal schließen und Liste neu laden
      setShowRestoreModal(false);
      setRestoreModalDepartments([]);
      setRestoreModalType(null);
      await loadDepartments();

      if (data.created > 0) {
        toast.showSuccess(`${data.created} Abteilung(en) erfolgreich erstellt!${data.skipped > 0 ? ` ${data.skipped} waren bereits vorhanden.` : ''}`);
      } else {
        toast.showInfo('Alle Abteilungen sind bereits vorhanden.');
      }
    } catch (err: any) {
      const errorMsg = 'Fehler beim Erstellen der Abteilungen';
      if (onError) {
        onError(errorMsg);
      }
      toast.showError(errorMsg);
    } finally {
      setRestoringDepartments(false);
    }
  };

  const handleCancelRestore = () => {
    setShowRestoreModal(false);
    setRestoreModalDepartments([]);
    setRestoreModalType(null);
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
          Abteilungen verwalten
        </h2>
        {!showDepartmentForm && (
          <button
            onClick={() => setShowDepartmentForm(true)}
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <FiPlus size={16} />
            <span>Neue Abteilung</span>
          </button>
        )}
      </div>

      {showDepartmentForm ? (
        <DepartmentForm
          department={editingDepartment}
          formData={departmentFormData}
          onFormDataChange={(data) =>
            setDepartmentFormData({
              name: data.name ?? '',
              description: data.description ?? '',
              managerId: data.managerId ?? '',
              emailAccountId: data.emailAccountId ?? '',
              isActive: data.isActive ?? false,
              signature: data.signature ?? '',
              signaturePlain: data.signaturePlain ?? '',
              signatureEnabled: data.signatureEnabled ?? false,
            })
          }
          submitting={submittingDepartment}
          onSubmit={handleSubmitDepartment}
          onCancel={handleCancelDepartment}
          users={users}
          loadingUsers={loadingUsers}
          emailAccounts={emailAccounts}
          loadingEmailAccounts={loadingEmailAccounts}
        />
      ) : (
        <DepartmentManagement
          departments={departments}
          loading={loadingDepartments}
          onEdit={handleEditDepartment}
          onDelete={handleDeleteDepartment}
          onCreateNew={() => setShowDepartmentForm(true)}
          onCreateDefaults={handleCreateDefaultDepartments}
          onToggleActive={handleToggleDepartmentActive}
          onRestoreBusinessDefaults={handleRestoreBusinessDepartments}
          onRestorePrivateDefaults={handleRestorePrivateDepartments}
        />
      )}

      {showRestoreModal && (
        <DepartmentRestoreModal
          departments={restoreModalDepartments}
          onConfirm={handleConfirmRestore}
          onCancel={handleCancelRestore}
          loading={restoringDepartments}
        />
      )}
    </>
  );
}

