'use client';

import dynamic from 'next/dynamic';
import ValidatedInput from './ValidatedInput';
import Select from './Select';
import Button from './Button';
import Card from './Card';
import { validateRequired } from '@/utils/validation';

import { useState } from 'react';

const SignatureEditor = dynamic(
  () => import('./SignatureEditor').then((m) => m.default),
  { ssr: false }
);

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
  departmentUsageCount?: number;
  smtp?: { host?: string; username?: string };
}

interface Department {
  id?: string;
  name: string;
  description?: string;
  managerId?: string;
  emailAccountId?: string;
  isActive?: boolean;
  signature?: string | null;
  signaturePlain?: string | null;
  signatureEnabled?: boolean;
}

interface DepartmentFormProps {
  department: Department | null;
  formData: Department;
  onFormDataChange: (data: Department) => void;
  submitting: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
  users: Manager[];
  loadingUsers: boolean;
  emailAccounts: EmailAccount[];
  loadingEmailAccounts: boolean;
}

export default function DepartmentForm({
  department,
  formData,
  onFormDataChange,
  submitting,
  onSubmit,
  onCancel,
  users,
  loadingUsers,
  emailAccounts,
  loadingEmailAccounts,
}: DepartmentFormProps) {
  const [activateDirectly, setActivateDirectly] = useState(false);
  const isClassic = false; // Verwende moderne Tailwind-Klassen

  const handleChange = (field: keyof Department, value: string | boolean) => {
    onFormDataChange({
      ...formData,
      [field]: value,
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Wenn "Abteilung direkt aktivieren" aktiviert ist, setze isActive = true
    if (activateDirectly && formData.emailAccountId) {
      handleChange('isActive', true);
    }
    
    // Warte kurz, damit State aktualisiert wird, dann onSubmit aufrufen
    setTimeout(() => {
      onSubmit(e);
    }, 0);
  };

  // Filter: Nur aktive E-Mail-Konten mit SMTP-Daten
  // Außerdem: E-Mail-Konten, die bereits einer anderen Abteilung zugeordnet sind, ausschließen
  // (außer wenn es die aktuelle Abteilung ist, die bearbeitet wird)
  const availableEmailAccounts = emailAccounts.filter((account) => {
    if (!account.isActive || !account.smtp?.host || !account.smtp?.username) {
      return false;
    }
    
    // Wenn ein E-Mail-Konto bereits einer Abteilung zugeordnet ist, nur anzeigen wenn es die aktuelle Abteilung ist
    const usageCount = typeof account.departmentUsageCount === 'number' 
      ? account.departmentUsageCount 
      : parseInt(account.departmentUsageCount || '0', 10);
    
    if (usageCount > 0) {
      // Wenn die Abteilung bearbeitet wird und dieses Konto bereits zugewiesen ist, anzeigen
      if (department && department.emailAccountId === account.id) {
        return true;
      }
      // Sonst nicht anzeigen (bereits zugewiesen)
      return false;
    }
    
    return true;
  });

  return (
    <Card>
      <h2 className="text-xl font-semibold mb-6">
        {department ? 'Abteilung bearbeiten' : 'Neue Abteilung erstellen'}
      </h2>
      <form onSubmit={handleSubmit}>
        <div className={isClassic ? undefined : 'flex flex-col gap-6'} style={isClassic ? { display: 'flex', flexDirection: 'column', gap: '1.5rem' } : undefined}>
          <div>
            <ValidatedInput
              type="text"
              id="name"
              value={formData.name}
              onChange={(value) => handleChange('name', value)}
              validator={(value) => validateRequired(value, 'Name der Abteilung')}
              required
              label="Name der Abteilung"
              placeholder="z.B. Vertrieb, IT, Personal"
            />
          </div>

          <div>
            <label htmlFor="description" className={isClassic ? undefined : 'block mb-2 text-sm font-semibold text-gray-700'} style={isClassic ? { display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: '#333' } : undefined}>
              Beschreibung
            </label>
            <textarea
              id="description"
              value={formData.description || ''}
              onChange={(e) => handleChange('description', e.target.value)}
              className={isClassic ? 'input' : 'w-full px-3 py-3 border border-gray-300 rounded-md text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent'}
              placeholder="Optionale Beschreibung der Abteilung"
              rows={4}
              style={{ resize: 'vertical' }}
            />
          </div>

          <div>
            <label className={isClassic ? undefined : 'flex items-center gap-2 cursor-pointer'} style={isClassic ? { display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' } : undefined}>
              <input
                type="checkbox"
                checked={formData.signatureEnabled ?? false}
                onChange={(e) => handleChange('signatureEnabled', e.target.checked)}
                className={isClassic ? undefined : 'cursor-pointer'}
                style={isClassic ? { cursor: 'pointer' } : undefined}
              />
              <span className={isClassic ? undefined : 'font-semibold text-gray-800'} style={isClassic ? { fontWeight: '600', color: '#333' } : undefined}>
                Signatur beim Beantworten verwenden
              </span>
            </label>
          </div>

          {(formData.signatureEnabled ?? false) && (
            <>
              <div>
                <label htmlFor="signature" className={isClassic ? undefined : 'block mb-2 text-sm font-semibold text-gray-700'} style={isClassic ? { display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: '#333' } : undefined}>
                  Signatur (HTML)
                </label>
                <p className={isClassic ? undefined : 'mb-1 text-xs text-gray-500'} style={isClassic ? { marginBottom: '0.25rem', fontSize: '0.75rem', color: '#6c757d' } : undefined}>
                  Wird bei Antworten auf formatierte E-Mails verwendet.
                </p>
                <SignatureEditor
                  value={formData.signature ?? ''}
                  onChange={(html) => handleChange('signature', html)}
                  placeholder="Signatur (HTML) – Platzhalter siehe unten"
                  disabled={!formData.signatureEnabled}
                  minHeight="120px"
                />
              </div>
              <div>
                <label htmlFor="signaturePlain" className={isClassic ? undefined : 'block mb-2 text-sm font-semibold text-gray-700'} style={isClassic ? { display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: '#333' } : undefined}>
                  Signatur (Plain-Text)
                </label>
                <p className={isClassic ? undefined : 'mb-1 text-xs text-gray-500'} style={isClassic ? { marginBottom: '0.25rem', fontSize: '0.75rem', color: '#6c757d' } : undefined}>
                  Für reine Text-E-Mails.
                </p>
                <textarea
                  id="signaturePlain"
                  value={formData.signaturePlain ?? ''}
                  onChange={(e) => handleChange('signaturePlain', e.target.value)}
                  className={isClassic ? 'input' : 'w-full px-3 py-3 border border-gray-300 rounded-md text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent'}
                  placeholder="Signaturtext (Platzhalter siehe unten)"
                  rows={4}
                  style={{ resize: 'vertical' }}
                />
              </div>
              <p className={isClassic ? undefined : 'mt-1 text-sm text-gray-500'} style={isClassic ? { marginTop: '0.25rem', fontSize: '0.875rem', color: '#6c757d' } : undefined}>
                Wird beim Beantworten unter dem Antworttext eingefügt, wenn das Häkchen gesetzt ist. Sie können Platzhalter verwenden (siehe unten).
              </p>
              <p className={isClassic ? undefined : 'mt-1 text-xs text-gray-500'} style={isClassic ? { marginTop: '0.25rem', fontSize: '0.75rem', color: '#6c757d' } : undefined}>
                Verfügbare Platzhalter: {'{{companyName}}'}, {'{{companyAddress}}'}, {'{{companyPhone}}'}, {'{{companyEmail}}'}, {'{{companyWebsite}}'}, {'{{userName}}'}, {'{{userFirstName}}'}, {'{{userLastName}}'}.
              </p>
            </>
          )}

          <div>
            {loadingUsers ? (
              <div className={isClassic ? undefined : 'p-2 text-gray-500'} style={isClassic ? { padding: '0.5rem', color: '#6c757d' } : undefined}>Lade Benutzer...</div>
            ) : (
              <Select
                id="managerId"
                value={formData.managerId || ''}
                onChange={(e) => handleChange('managerId', e.target.value)}
                label="Manager (optional)"
              >
                <option value="">Kein Manager</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.firstName || user.lastName
                      ? `${user.firstName || ''} ${user.lastName || ''}`.trim()
                      : user.username}
                    {user.email && ` (${user.email})`}
                  </option>
                ))}
              </Select>
            )}
          </div>

          <div>
            <label htmlFor="emailAccountId" className={isClassic ? undefined : 'block mb-2 text-sm font-semibold text-gray-700'} style={isClassic ? { display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: '#333' } : undefined}>
              E-Mail-Konto {activateDirectly && <span className={isClassic ? undefined : 'text-danger'} style={isClassic ? { color: '#dc3545' } : undefined}>*</span>}
            </label>
            {loadingEmailAccounts ? (
              <div className={isClassic ? undefined : 'p-2 text-gray-500'} style={isClassic ? { padding: '0.5rem', color: '#6c757d' } : undefined}>Lade E-Mail-Konten...</div>
            ) : availableEmailAccounts.length === 0 ? (
              <div className={isClassic ? undefined : 'p-2 text-danger'} style={isClassic ? { padding: '0.5rem', color: '#dc3545' } : undefined}>
                ⚠️ Keine aktiven E-Mail-Konten mit SMTP-Daten verfügbar. Bitte erstellen Sie zuerst ein E-Mail-Konto.
              </div>
            ) : (
              <>
                <Select
                  id="emailAccountId"
                  value={formData.emailAccountId || ''}
                  onChange={(e) => {
                    handleChange('emailAccountId', e.target.value);
                    if (!e.target.value) {
                      setActivateDirectly(false);
                    }
                  }}
                  required={activateDirectly}
                >
                  <option value="">Kein E-Mail-Konto auswählen</option>
                  {availableEmailAccounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name} ({account.email})
                    </option>
                  ))}
                </Select>
              </>
            )}
          </div>

          {formData.emailAccountId && (
            <div>
              <label className={isClassic ? undefined : 'flex items-center gap-2 cursor-pointer'} style={isClassic ? { display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' } : undefined}>
                <input
                  type="checkbox"
                  checked={activateDirectly}
                  onChange={(e) => setActivateDirectly(e.target.checked)}
                  className={isClassic ? undefined : 'cursor-pointer'}
                  style={isClassic ? { cursor: 'pointer' } : undefined}
                />
                <span className={isClassic ? undefined : 'font-semibold text-gray-800'} style={isClassic ? { fontWeight: '600', color: '#333' } : undefined}>Abteilung direkt aktivieren</span>
              </label>
              <p className={isClassic ? undefined : 'mt-1 text-sm text-gray-500'} style={isClassic ? { marginTop: '0.25rem', fontSize: '0.875rem', color: '#6c757d' } : undefined}>
                Die Abteilung wird nach dem Speichern automatisch aktiviert.
              </p>
            </div>
          )}

          <div className={isClassic ? undefined : 'flex gap-2 justify-end mt-4'} style={isClassic ? { display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1rem' } : undefined}>
            <Button
              type="button"
              onClick={onCancel}
              variant="secondary"
              disabled={submitting}
            >
              Abbrechen
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={submitting}
            >
              {submitting ? 'Speichere...' : department ? 'Aktualisieren' : 'Erstellen'}
            </Button>
          </div>
        </div>
      </form>
    </Card>
  );
}

