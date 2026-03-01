'use client';

import ValidatedInput from './ValidatedInput';
import Input from './Input';
import Button from './Button';
import Card from './Card';
import { validateEmail, validatePort, validateRequired, validateHost } from '@/utils/validation';
import { FiAlertTriangle, FiMail, FiCheckCircle, FiXCircle, FiWifi, FiSave } from 'react-icons/fi';

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

interface EmailAccountFormProps {
  formData: FormData;
  onFormDataChange: (data: FormData) => void;
  editingAccount: EmailAccount | null;
  submitting: boolean;
  testing: boolean;
  testResults: TestResults | null;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
  onTestConnection: () => void;
}

export default function EmailAccountForm({
  formData,
  onFormDataChange,
  editingAccount,
  submitting,
  testing,
  testResults,
  onSubmit,
  onCancel,
  onTestConnection,
}: EmailAccountFormProps) {
  const isClassic = false; // Verwende moderne Tailwind-Klassen
  
  const updateFormData = (updates: Partial<FormData>) => {
    onFormDataChange({ ...formData, ...updates });
  };

  return (
    <Card>
      <h2 className="text-xl font-semibold mb-6">
        {editingAccount ? 'Konto bearbeiten' : 'Neues E-Mail-Konto'}
      </h2>
      <form onSubmit={onSubmit}>
        {/* Allgemeine Informationen */}
        <div className={isClassic ? undefined : 'mb-8'} style={isClassic ? { marginBottom: '2rem' } : undefined}>
          <h3 className={isClassic ? undefined : 'text-base font-semibold text-gray-800 mb-4'} style={isClassic ? { marginBottom: '1rem', fontSize: '1rem', fontWeight: '600', color: '#333' } : undefined}>
            Allgemeine Informationen
          </h3>
          <div className={isClassic ? undefined : 'mb-4'} style={isClassic ? { marginBottom: '1rem' } : undefined}>
            <ValidatedInput
              type="text"
              value={formData.name}
              onChange={(value) => updateFormData({ name: value })}
              validator={(value) => validateRequired(value, 'Kontoname')}
              required
              label="Kontoname"
              placeholder="z.B. Geschäftlich, Privat"
            />
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <ValidatedInput
              type="email"
              value={formData.email}
              onChange={(value) => updateFormData({ email: value })}
              validator={validateEmail}
              required
              label="E-Mail-Adresse"
              placeholder="ihre@email.de"
            />
          </div>
        </div>

        {/* IMAP-Einstellungen */}
        <div style={{ marginBottom: '2rem' }}>
          <h3 style={{ marginBottom: '1rem', fontSize: '1rem', fontWeight: '600', color: '#333' }}>
            IMAP-Einstellungen (E-Mails empfangen)
          </h3>
          <div className={isClassic ? undefined : 'grid grid-cols-2 gap-4 mb-4'} style={isClassic ? { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' } : undefined}>
            <div>
              <ValidatedInput
                type="text"
                value={formData.imapHost}
                onChange={(value) => updateFormData({ imapHost: value })}
                validator={(value) => value ? validateHost(value) : { isValid: true }}
                label="IMAP-Server"
                placeholder="imap.example.com"
              />
            </div>
            <div>
              <ValidatedInput
                type="number"
                value={formData.imapPort}
                onChange={(value) => updateFormData({ imapPort: value })}
                validator={(value) => value ? validatePort(value) : { isValid: true }}
                label="Port"
                placeholder="993"
              />
            </div>
          </div>
          <div className={isClassic ? undefined : 'mb-4'} style={isClassic ? { marginBottom: '1rem' } : undefined}>
            <Input
              type="text"
              value={formData.imapUsername}
              onChange={(e) => updateFormData({ imapUsername: e.target.value })}
              label="Benutzername:"
              placeholder="Ihr IMAP-Benutzername"
            />
          </div>
          <div className={isClassic ? undefined : 'mb-4'} style={isClassic ? { marginBottom: '1rem' } : undefined}>
            <Input
              type="password"
              value={formData.imapPassword}
              onChange={(e) => updateFormData({ imapPassword: e.target.value })}
              label="Passwort:"
              placeholder="Ihr IMAP-Passwort"
            />
          </div>
          <div className={isClassic ? undefined : 'mb-4'} style={isClassic ? { marginBottom: '1rem' } : undefined}>
            <Input
              type="text"
              value={formData.imapFolder}
              onChange={(e) => updateFormData({ imapFolder: e.target.value })}
              label="IMAP-Ordner:"
              placeholder="INBOX"
            />
            <small className={isClassic ? undefined : 'block mt-1 text-sm text-gray-500'} style={isClassic ? { display: 'block', marginTop: '0.25rem', color: '#6c757d', fontSize: '0.875rem' } : undefined}>
              Standard: INBOX (andere Ordner z.B. "INBOX/Archiv", "INBOX/Sent")
            </small>
          </div>
          <div className={isClassic ? undefined : 'mb-4'} style={isClassic ? { marginBottom: '1rem' } : undefined}>
            <label className={isClassic ? 'input-label' : 'block mb-2 text-sm font-semibold text-gray-700'}>Verschlüsselung:</label>
            <div className={isClassic ? undefined : 'flex gap-4 mt-2'} style={isClassic ? { display: 'flex', gap: '1rem', marginTop: '0.5rem' } : undefined}>
              <label className={isClassic ? undefined : 'flex items-center gap-2 cursor-pointer'} style={isClassic ? { display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' } : undefined}>
                <input
                  type="radio"
                  name="imapSecurity"
                  value="ssl"
                  checked={formData.imapSecurity === 'ssl'}
                  onChange={() => {
                    updateFormData({ imapSecurity: 'ssl', imapPort: '993' });
                  }}
                />
                <span>SSL (Port 993)</span>
              </label>
              <label className={isClassic ? undefined : 'flex items-center gap-2 cursor-pointer'} style={isClassic ? { display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' } : undefined}>
                <input
                  type="radio"
                  name="imapSecurity"
                  value="starttls"
                  checked={formData.imapSecurity === 'starttls'}
                  onChange={() => {
                    updateFormData({ imapSecurity: 'starttls', imapPort: '143' });
                  }}
                />
                <span>STARTTLS (Port 143)</span>
              </label>
            </div>
          </div>
        </div>

        {/* SMTP-Einstellungen */}
        <div className={isClassic ? undefined : 'mb-8'} style={isClassic ? { marginBottom: '2rem' } : undefined}>
          <h3 className={isClassic ? undefined : 'text-base font-semibold text-gray-800 mb-4'} style={isClassic ? { marginBottom: '1rem', fontSize: '1rem', fontWeight: '600', color: '#333' } : undefined}>
            SMTP-Einstellungen (E-Mails senden)
          </h3>
          <div className={isClassic ? undefined : 'grid grid-cols-2 gap-4 mb-4'} style={isClassic ? { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' } : undefined}>
            <div>
              <ValidatedInput
                type="text"
                value={formData.smtpHost}
                onChange={(value) => updateFormData({ smtpHost: value })}
                validator={(value) => value ? validateHost(value) : { isValid: true }}
                label="SMTP-Server"
                placeholder="smtp.example.com"
              />
            </div>
            <div>
              <ValidatedInput
                type="number"
                value={formData.smtpPort}
                onChange={(value) => updateFormData({ smtpPort: value })}
                validator={(value) => value ? validatePort(value) : { isValid: true }}
                label="Port"
                placeholder="587"
              />
            </div>
          </div>
          <div className={isClassic ? undefined : 'mb-4'} style={isClassic ? { marginBottom: '1rem' } : undefined}>
            <Input
              type="text"
              value={formData.smtpUsername}
              onChange={(e) => updateFormData({ smtpUsername: e.target.value })}
              label="Benutzername:"
              placeholder="Ihr SMTP-Benutzername"
            />
          </div>
          <div className={isClassic ? undefined : 'mb-4'} style={isClassic ? { marginBottom: '1rem' } : undefined}>
            <Input
              type="password"
              value={formData.smtpPassword}
              onChange={(e) => updateFormData({ smtpPassword: e.target.value })}
              label="Passwort:"
              placeholder="Ihr SMTP-Passwort"
            />
          </div>
          <div className={isClassic ? undefined : 'mb-4'} style={isClassic ? { marginBottom: '1rem' } : undefined}>
            <label className={isClassic ? 'input-label' : 'block mb-2 text-sm font-semibold text-gray-700'}>Verschlüsselung:</label>
            <div className={isClassic ? undefined : 'flex gap-4 mt-2'} style={isClassic ? { display: 'flex', gap: '1rem', marginTop: '0.5rem' } : undefined}>
              <label className={isClassic ? undefined : 'flex items-center gap-2 cursor-pointer'} style={isClassic ? { display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' } : undefined}>
                <input
                  type="radio"
                  name="smtpSecurity"
                  value="ssl"
                  checked={formData.smtpSecurity === 'ssl'}
                  onChange={() => {
                    updateFormData({ smtpSecurity: 'ssl', smtpPort: '465' });
                  }}
                />
                <span>SSL (Port 465)</span>
              </label>
              <label className={isClassic ? undefined : 'flex items-center gap-2 cursor-pointer'} style={isClassic ? { display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' } : undefined}>
                <input
                  type="radio"
                  name="smtpSecurity"
                  value="starttls"
                  checked={formData.smtpSecurity === 'starttls'}
                  onChange={() => {
                    updateFormData({ smtpSecurity: 'starttls', smtpPort: '587' });
                  }}
                />
                <span>STARTTLS (Port 587)</span>
              </label>
            </div>
          </div>
        </div>

        {/* Aktiv/Inaktiv-Einstellung */}
        <div className={isClassic ? undefined : 'mb-8 p-4 bg-gray-50 rounded-lg'} style={isClassic ? { marginBottom: '2rem', padding: '1rem', backgroundColor: '#f8f9fa', borderRadius: '6px' } : undefined}>
          <h3 className={isClassic ? undefined : 'text-base font-semibold text-gray-800 mb-4'} style={isClassic ? { marginBottom: '1rem', fontSize: '1rem', fontWeight: '600', color: '#333' } : undefined}>
            Konto-Status
          </h3>
          <div className={isClassic ? undefined : 'mb-4'} style={isClassic ? { marginBottom: '1rem' } : undefined}>
            <label className={isClassic ? undefined : 'flex items-center gap-2 cursor-pointer'} style={isClassic ? { display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' } : undefined}>
              <input
                type="checkbox"
                checked={formData.isActive}
                onChange={(e) => updateFormData({ isActive: e.target.checked })}
              />
              <span className={isClassic ? undefined : 'font-medium'} style={isClassic ? { fontWeight: '500' } : undefined}>Konto aktiv (E-Mails werden abgerufen)</span>
            </label>
            {!formData.isActive && (
              <p className={isClassic ? undefined : 'mt-2 text-sm text-gray-500 ml-7'} style={isClassic ? { marginTop: '0.5rem', fontSize: '0.875rem', color: '#6c757d', marginLeft: '1.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' } : undefined}>
                <FiAlertTriangle size={16} style={{ color: '#F59E0B' }} />
                <span>Inaktive Konten werden nicht für den E-Mail-Abruf verwendet.</span>
              </p>
            )}
          </div>
        </div>

        {/* Test-Ergebnisse anzeigen */}
        {testResults && (
          <div className={isClassic ? undefined : 'mb-6 p-4 bg-gray-50 rounded-lg'} style={isClassic ? { marginBottom: '1.5rem', padding: '1rem', backgroundColor: '#f8f9fa', borderRadius: '6px' } : undefined}>
            <h4 className={isClassic ? undefined : 'mb-3 text-sm font-semibold'} style={isClassic ? { marginBottom: '0.75rem', fontSize: '0.95rem', fontWeight: '600' } : undefined}>
              Verbindungstest-Ergebnisse:
            </h4>
            {testResults.imap && (
              <div
                className={isClassic ? undefined : `mb-2 p-3 rounded ${testResults.imap.success ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}
                style={isClassic ? {
                  marginBottom: '0.5rem',
                  padding: '0.75rem',
                  borderRadius: '4px',
                  backgroundColor: testResults.imap.success ? '#d4edda' : '#f8d7da',
                  color: testResults.imap.success ? '#155724' : '#721c24',
                  border: `1px solid ${testResults.imap.success ? '#c3e6cb' : '#f5c6cb'}`,
                } : undefined}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <strong>IMAP:</strong>
                  {testResults.imap.success ? (
                    <FiCheckCircle size={16} style={{ color: '#10B981' }} />
                  ) : (
                    <FiXCircle size={16} style={{ color: '#DC2626' }} />
                  )}
                  <span>{testResults.imap.message}</span>
                </div>
                {testResults.imap.success && testResults.imap.emailCount !== undefined && (
                  <div className={isClassic ? undefined : 'mt-2 text-sm font-semibold'} style={isClassic ? { marginTop: '0.5rem', fontSize: '0.9rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.5rem' } : undefined}>
                    <FiMail size={16} style={{ color: '#2563EB' }} />
                    <span>{testResults.imap.emailCount} E-Mail{testResults.imap.emailCount !== 1 ? 's' : ''} zum Abrufen verfügbar</span>
                  </div>
                )}
              </div>
            )}
            {testResults.smtp && (
              <div
                className={isClassic ? undefined : `p-3 rounded ${testResults.smtp.success ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}
                style={isClassic ? {
                  padding: '0.75rem',
                  borderRadius: '4px',
                  backgroundColor: testResults.smtp.success ? '#d4edda' : '#f8d7da',
                  color: testResults.smtp.success ? '#155724' : '#721c24',
                  border: `1px solid ${testResults.smtp.success ? '#c3e6cb' : '#f5c6cb'}`,
                } : undefined}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <strong>SMTP:</strong>
                  {testResults.smtp.success ? (
                    <FiCheckCircle size={16} style={{ color: '#10B981' }} />
                  ) : (
                    <FiXCircle size={16} style={{ color: '#DC2626' }} />
                  )}
                  <span>{testResults.smtp.message}</span>
                </div>
              </div>
            )}
          </div>
        )}

        <div className={isClassic ? undefined : 'flex gap-2 justify-end'} style={isClassic ? { display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' } : undefined}>
          <Button
            type="button"
            onClick={onCancel}
            variant="secondary"
          >
            Abbrechen
          </Button>
          <Button
            type="button"
            onClick={onTestConnection}
            disabled={testing}
            variant="primary"
            className={isClassic ? undefined : 'bg-cyan-600 hover:bg-cyan-700'}
            style={isClassic ? {
              backgroundColor: '#17a2b8',
              color: 'white',
              opacity: testing ? 0.6 : 1,
            } : undefined}
          >
            {testing ? (
              <>
                <div className="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }}></div>
                <span>Teste Verbindung...</span>
              </>
            ) : (
              <>
                <FiWifi size={16} />
                <span>Verbindung testen</span>
              </>
            )}
          </Button>
          <Button
            type="submit"
            disabled={submitting}
            variant="primary"
          >
            {submitting ? (
              <>
                <div className="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }}></div>
                <span>Wird gespeichert...</span>
              </>
            ) : (
              <>
                <FiSave size={16} />
                <span>{editingAccount ? 'Aktualisieren' : 'Erstellen'}</span>
              </>
            )}
          </Button>
        </div>
      </form>
    </Card>
  );
}

