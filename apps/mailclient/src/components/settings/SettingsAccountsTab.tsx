'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ToastProvider';
import { useConfirm } from '@/components/ConfirmDialog';
import EmailAccountList from '@/components/EmailAccountList';
import EmailAccountForm from '@/components/EmailAccountForm';
import { FiPlus } from 'react-icons/fi';

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
    folder?: string;
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

interface FormData {
  name: string;
  email: string;
  imapHost: string;
  imapPort: string;
  imapUsername: string;
  imapPassword: string;
  imapFolder: string;
  imapSecurity: 'ssl' | 'starttls';
  smtpHost: string;
  smtpPort: string;
  smtpUsername: string;
  smtpPassword: string;
  smtpSecurity: 'ssl' | 'starttls';
  isActive: boolean;
}

interface TestResults {
  imap?: { success: boolean; message: string; emailCount?: number };
  smtp?: { success: boolean; message: string };
}

interface SettingsAccountsTabProps {
  onError?: (error: string) => void;
  onBack?: () => void;
  toast?: ReturnType<typeof useToast>;
  router?: ReturnType<typeof useRouter>;
  accounts?: EmailAccount[];
  onAccountsChange?: (accounts: EmailAccount[]) => void;
}

const INITIAL_FORM_DATA: FormData = {
  name: '',
  email: '',
  imapHost: '',
  imapPort: '993',
  imapUsername: '',
  imapPassword: '',
  imapFolder: 'INBOX',
  imapSecurity: 'ssl',
  smtpHost: '',
  smtpPort: '587',
  smtpUsername: '',
  smtpPassword: '',
  smtpSecurity: 'starttls',
  isActive: true,
};

export default function SettingsAccountsTab({
  onError,
  onBack,
  toast: toastProp,
  router: routerProp,
  accounts: accountsProp,
  onAccountsChange,
}: SettingsAccountsTabProps) {
  const router = routerProp || useRouter();
  const toast = toastProp || useToast();
  const { confirm } = useConfirm();
  const [accounts, setAccounts] = useState<EmailAccount[]>(accountsProp || []);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingAccount, setEditingAccount] = useState<EmailAccount | null>(null);
  const [formData, setFormData] = useState<FormData>(INITIAL_FORM_DATA);
  const [submitting, setSubmitting] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResults, setTestResults] = useState<TestResults | null>(null);

  // Lade Accounts, wenn nicht als Props übergeben
  const loadAccounts = useCallback(async () => {
    try {
      setLoading(true);
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
        const errorMsg = data.error || 'Fehler beim Laden der Konten';
        if (onError) {
          onError(errorMsg);
        }
        return;
      }

      const loadedAccounts = data.accounts || [];
      setAccounts(loadedAccounts);
      if (onAccountsChange) {
        onAccountsChange(loadedAccounts);
      }
    } catch (err: any) {
      const errorMsg = 'Fehler beim Laden der Konten';
      if (onError) {
        onError(errorMsg);
      }
    } finally {
      setLoading(false);
    }
  }, [router, onError, onAccountsChange]);

  // Lade Accounts beim Mount, wenn nicht als Props übergeben
  useEffect(() => {
    if (!accountsProp || accountsProp.length === 0) {
      loadAccounts();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Keyboard Shortcut: Ctrl+N / Cmd+N
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'n' && !showForm) {
        e.preventDefault();
        setShowForm(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showForm]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (onError) {
      onError('');
    }
    setSubmitting(true);

    try {
      const token = localStorage.getItem('mailclient_token');
      const url = editingAccount
        ? `/api/email-accounts/${editingAccount.id}`
        : '/api/email-accounts';
      const method = editingAccount ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          imapHost: formData.imapHost || null,
          imapPort: formData.imapPort ? parseInt(formData.imapPort) : null,
          imapUsername: formData.imapUsername || null,
          imapPassword: formData.imapPassword || null,
          imapFolder: formData.imapFolder || 'INBOX',
          imapSsl: formData.imapSecurity === 'ssl',
          smtpHost: formData.smtpHost || null,
          smtpPort: formData.smtpPort ? parseInt(formData.smtpPort) : null,
          smtpUsername: formData.smtpUsername || null,
          smtpPassword: formData.smtpPassword || null,
          smtpSsl: formData.smtpSecurity === 'ssl',
          smtpTls: formData.smtpSecurity === 'starttls',
          isActive: formData.isActive,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMsg = data.error || 'Fehler beim Speichern des Kontos';
        if (onError) {
          onError(errorMsg);
        }
        return;
      }

      // Formular zurücksetzen und Liste neu laden
      setFormData(INITIAL_FORM_DATA);
      setShowForm(false);
      setEditingAccount(null);
      await loadAccounts();
      toast.showSuccess('Konto erfolgreich gespeichert!');
    } catch (err: any) {
      const errorMsg = 'Fehler beim Speichern des Kontos';
      if (onError) {
        onError(errorMsg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async (account: EmailAccount) => {
    // Lade vollständige Kontodaten inkl. Passwörter
    try {
      const token = localStorage.getItem('mailclient_token');
      const response = await fetch(`/api/email-accounts/${account.id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const data = await response.json();
        const errorMsg = data.error || 'Fehler beim Laden der Kontodaten';
        if (onError) {
          onError(errorMsg);
        }
        return;
      }

      const data = await response.json();
      const fullAccount = data.account;

      setEditingAccount(fullAccount);
      setTestResults(null);
      
      // Bestimme Security-Modus basierend auf SSL/TLS-Einstellungen
      const imapSecurity = fullAccount.imap.ssl !== false ? 'ssl' : 'starttls';
      const smtpSecurity = fullAccount.smtp.ssl === true ? 'ssl' : 'starttls';
      
      setFormData({
        name: fullAccount.name,
        email: fullAccount.email,
        imapHost: fullAccount.imap.host || '',
        imapPort: fullAccount.imap.port?.toString() || (imapSecurity === 'ssl' ? '993' : '143'),
        imapUsername: fullAccount.imap.username || '',
        imapPassword: fullAccount.imap.password || '',
        imapFolder: fullAccount.imap.folder || 'INBOX',
        imapSecurity: imapSecurity,
        smtpHost: fullAccount.smtp.host || '',
        smtpPort: fullAccount.smtp.port?.toString() || (smtpSecurity === 'ssl' ? '465' : '587'),
        smtpUsername: fullAccount.smtp.username || '',
        smtpPassword: fullAccount.smtp.password || '',
        smtpSecurity: smtpSecurity,
        isActive: fullAccount.isActive !== false,
      });
      setShowForm(true);
    } catch (err: any) {
      const errorMsg = 'Fehler beim Laden der Kontodaten';
      if (onError) {
        onError(errorMsg);
      }
    }
  };

  const handleDelete = async (accountId: string) => {
    if (!(await confirm({ message: 'Möchten Sie dieses E-Mail-Konto wirklich löschen?', variant: 'danger', confirmLabel: 'Löschen' }))) {
      return;
    }

    try {
      const token = localStorage.getItem('mailclient_token');
      const response = await fetch(`/api/email-accounts/${accountId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const data = await response.json();
        const errorMsg = data.error || 'Fehler beim Löschen des Kontos';
        if (onError) {
          onError(errorMsg);
        }
        return;
      }

      await loadAccounts();
      toast.showSuccess('Konto erfolgreich gelöscht!');
    } catch (err: any) {
      const errorMsg = 'Fehler beim Löschen des Kontos';
      if (onError) {
        onError(errorMsg);
      }
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingAccount(null);
    setTestResults(null);
    setFormData(INITIAL_FORM_DATA);
    if (onBack) {
      onBack();
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResults(null);
    if (onError) {
      onError('');
    }

    // Validierung: Mindestens IMAP oder SMTP muss ausgefüllt sein
    const hasImap = formData.imapHost && formData.imapUsername && formData.imapPassword;
    const hasSmtp = formData.smtpHost && formData.smtpUsername && formData.smtpPassword;

    if (!hasImap && !hasSmtp) {
      const errorMsg = 'Bitte geben Sie mindestens IMAP- oder SMTP-Daten an';
      if (onError) {
        onError(errorMsg);
      }
      setTesting(false);
      return;
    }

    try {
      const response = await fetch('/api/email-accounts/test-connection', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imapHost: formData.imapHost || null,
          imapPort: formData.imapPort ? parseInt(formData.imapPort) : null,
          imapUsername: formData.imapUsername || null,
          imapPassword: formData.imapPassword || null,
          imapSsl: formData.imapSecurity === 'ssl',
          imapStartTls: formData.imapSecurity === 'starttls',
          smtpHost: formData.smtpHost || null,
          smtpPort: formData.smtpPort ? parseInt(formData.smtpPort) : null,
          smtpUsername: formData.smtpUsername || null,
          smtpPassword: formData.smtpPassword || null,
          smtpSsl: formData.smtpSecurity === 'ssl',
          smtpStartTls: formData.smtpSecurity === 'starttls',
          isActive: formData.isActive,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMsg = data.error || 'Fehler beim Verbindungstest';
        if (onError) {
          onError(errorMsg);
        }
        return;
      }

      setTestResults(data.results || {});
    } catch (err: any) {
      const errorMsg = 'Fehler beim Verbindungstest';
      if (onError) {
        onError(errorMsg);
      }
    } finally {
      setTesting(false);
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
          E-Mail Konten verwalten
        </h2>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <FiPlus size={16} />
            <span>Neues Konto</span>
          </button>
        )}
      </div>

      {showForm ? (
        <EmailAccountForm
          formData={formData}
          onFormDataChange={setFormData}
          editingAccount={editingAccount}
          submitting={submitting}
          testing={testing}
          testResults={testResults}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          onTestConnection={handleTestConnection}
        />
      ) : (
        <EmailAccountList
          accounts={accounts}
          loading={loading}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onCreateNew={() => setShowForm(true)}
        />
      )}
    </>
  );
}

