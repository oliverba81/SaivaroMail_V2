'use client';

import ValidatedInput from './ValidatedInput';
import Input from './Input';
import Select from './Select';
import Button from './Button';
import Card from './Card';
import { validateEmail, validateRequired, validatePassword } from '@/utils/validation';

interface Department {
  id: string;
  name: string;
  description?: string;
}

interface CompanyFilterOption {
  id: string;
  name: string;
}

interface User {
  id?: string;
  username: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role: string;
  status: string;
  password?: string;
  departments?: Department[];
  visibleFilterIds?: string[];
}

interface UserFormProps {
  user: User | null;
  formData: User;
  onFormDataChange: (data: User) => void;
  submitting: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
  departments: Department[];
  loadingDepartments: boolean;
  companyFilters?: CompanyFilterOption[];
}

export default function UserForm({
  user,
  formData,
  onFormDataChange,
  submitting,
  onSubmit,
  onCancel,
  departments,
  loadingDepartments,
  companyFilters = [],
}: UserFormProps) {
  const isClassic = false; // Verwende moderne Tailwind-Klassen
  
  const handleChange = (field: keyof User, value: string) => {
    onFormDataChange({
      ...formData,
      [field]: value,
    });
  };

  const handleDepartmentChange = (departmentId: string, checked: boolean) => {
    const currentDeptIds = formData.departments?.map(d => d.id) || [];
    let newDeptIds: string[];

    if (checked) {
      newDeptIds = [...currentDeptIds, departmentId];
    } else {
      newDeptIds = currentDeptIds.filter(id => id !== departmentId);
    }

    const selectedDepartments = departments.filter(d => newDeptIds.includes(d.id));

    onFormDataChange({
      ...formData,
      departments: selectedDepartments,
    });
  };

  const handleFilterVisibilityChange = (filterId: string, checked: boolean) => {
    const currentIds = formData.visibleFilterIds ?? [];
    const newIds = checked
      ? [...currentIds, filterId]
      : currentIds.filter(id => id !== filterId);
    onFormDataChange({
      ...formData,
      visibleFilterIds: newIds,
    });
  };

  return (
    <Card>
      <h2 className="text-xl font-semibold mb-6">
        {user ? 'Benutzer bearbeiten' : 'Neuen Benutzer erstellen'}
      </h2>
      <form onSubmit={onSubmit}>
        <div className={isClassic ? undefined : 'flex flex-col gap-6'} style={isClassic ? { display: 'flex', flexDirection: 'column', gap: '1.5rem' } : undefined}>
          <div>
            <ValidatedInput
              type="text"
              id="username"
              value={formData.username}
              onChange={(value) => handleChange('username', value)}
              validator={(value) => validateRequired(value, 'Benutzername')}
              required
              label="Benutzername"
              placeholder="benutzername"
            />
          </div>

          <div>
            <ValidatedInput
              type="email"
              id="email"
              value={formData.email}
              onChange={(value) => handleChange('email', value)}
              validator={validateEmail}
              required
              label="E-Mail"
              placeholder="benutzer@example.com"
            />
          </div>

          <div>
            <ValidatedInput
              type="password"
              id="password"
              value={formData.password || ''}
              onChange={(value) => handleChange('password', value)}
              validator={(value) => {
                if (!user && !value) {
                  return { isValid: false, error: 'Passwort ist erforderlich' };
                }
                if (value && value.length < 8) {
                  return validatePassword(value);
                }
                return { isValid: true };
              }}
              required={!user}
              label={`Passwort ${user ? '(leer lassen, um nicht zu ändern)' : ''}`}
              placeholder="••••••••"
            />
          </div>

          <div className={isClassic ? undefined : 'grid grid-cols-2 gap-4'} style={isClassic ? { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' } : undefined}>
            <Input
              type="text"
              id="firstName"
              value={formData.firstName || ''}
              onChange={(e) => handleChange('firstName', e.target.value)}
              label="Vorname"
              placeholder="Max"
            />
            <Input
              type="text"
              id="lastName"
              value={formData.lastName || ''}
              onChange={(e) => handleChange('lastName', e.target.value)}
              label="Nachname"
              placeholder="Mustermann"
            />
          </div>

          <div className={isClassic ? undefined : 'grid grid-cols-2 gap-4'} style={isClassic ? { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' } : undefined}>
            <Select
              id="role"
              value={formData.role}
              onChange={(e) => handleChange('role', e.target.value)}
              required
              label="Rolle *"
            >
              <option value="user">Benutzer</option>
              <option value="admin">Administrator</option>
            </Select>
            <Select
              id="status"
              value={formData.status}
              onChange={(e) => handleChange('status', e.target.value)}
              required
              label="Status *"
            >
              <option value="active">Aktiv</option>
              <option value="inactive">Inaktiv</option>
            </Select>
          </div>

          <div>
            <label className={isClassic ? undefined : 'block mb-2 text-sm font-semibold text-gray-700'} style={isClassic ? { display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: '#333' } : undefined}>
              Abteilungen
            </label>
            {loadingDepartments ? (
              <div className={isClassic ? undefined : 'p-2 text-gray-500'} style={isClassic ? { padding: '0.5rem', color: '#6c757d' } : undefined}>Lade Abteilungen...</div>
            ) : departments.length === 0 ? (
              <div className={isClassic ? undefined : 'p-2 text-gray-500'} style={isClassic ? { padding: '0.5rem', color: '#6c757d' } : undefined}>
                Keine Abteilungen verfügbar. Erstellen Sie zuerst Abteilungen.
              </div>
            ) : (
              <div className={isClassic ? undefined : 'border border-gray-200 rounded-md p-3 max-h-[200px] overflow-y-auto bg-white'} style={isClassic ? { 
                border: '1px solid #dee2e6', 
                borderRadius: '4px', 
                padding: '0.75rem',
                maxHeight: '200px',
                overflowY: 'auto',
                backgroundColor: '#fff'
              } : undefined}>
                {departments.map((dept) => {
                  const isChecked = formData.departments?.some(d => d.id === dept.id) || false;
                  return (
                    <label
                      key={dept.id}
                      className={isClassic ? undefined : 'flex items-start gap-2 p-2 cursor-pointer rounded transition-colors hover:bg-gray-50'}
                      style={isClassic ? {
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '0.5rem',
                        padding: '0.5rem',
                        cursor: 'pointer',
                        borderRadius: '4px',
                        transition: 'background-color 0.2s',
                      } : undefined}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => handleDepartmentChange(dept.id, e.target.checked)}
                        className={isClassic ? undefined : 'mt-1 cursor-pointer'}
                        style={isClassic ? { marginTop: '0.25rem', cursor: 'pointer' } : undefined}
                      />
                      <div className={isClassic ? undefined : 'flex-1'} style={isClassic ? { flex: 1 } : undefined}>
                        <div className={isClassic ? undefined : 'font-medium text-gray-800'} style={isClassic ? { fontWeight: '500', color: '#333' } : undefined}>{dept.name}</div>
                        {dept.description && (
                          <div className={isClassic ? undefined : 'text-sm text-gray-500 mt-1'} style={isClassic ? { fontSize: '0.875rem', color: '#6c757d', marginTop: '0.25rem' } : undefined}>
                            {dept.description}
                          </div>
                        )}
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          {companyFilters.length > 0 && (
            <div>
              <label className={isClassic ? undefined : 'block mb-2 text-sm font-semibold text-gray-700'} style={isClassic ? { display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: '#333' } : undefined}>
                Sichtbare Filter in der Seitenleiste
              </label>
              <p className={isClassic ? undefined : 'text-sm text-gray-500 mb-2'} style={isClassic ? { fontSize: '0.875rem', color: '#6c757d', marginBottom: '0.5rem' } : undefined}>
                Wählen Sie, welche Filter dieser Benutzer in der linken Menüleiste sehen soll.
              </p>
              <div className={isClassic ? undefined : 'border border-gray-200 rounded-md p-3 max-h-[200px] overflow-y-auto bg-white'} style={isClassic ? { border: '1px solid #dee2e6', borderRadius: '4px', padding: '0.75rem', maxHeight: '200px', overflowY: 'auto', backgroundColor: '#fff' } : undefined}>
                {companyFilters.map((filter) => {
                  const isChecked = (formData.visibleFilterIds ?? []).includes(filter.id);
                  return (
                    <label
                      key={filter.id}
                      className={isClassic ? undefined : 'flex items-center gap-2 p-2 cursor-pointer rounded transition-colors hover:bg-gray-50'}
                      style={isClassic ? { display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem', cursor: 'pointer', borderRadius: '4px' } : undefined}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => handleFilterVisibilityChange(filter.id, e.target.checked)}
                        className={isClassic ? undefined : 'cursor-pointer'}
                        style={isClassic ? { cursor: 'pointer' } : undefined}
                      />
                      <span className={isClassic ? undefined : 'font-medium text-gray-800'} style={isClassic ? { fontWeight: '500', color: '#333' } : undefined}>{filter.name}</span>
                    </label>
                  );
                })}
              </div>
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
              {submitting ? 'Speichere...' : user ? 'Aktualisieren' : 'Erstellen'}
            </Button>
          </div>
        </div>
      </form>
    </Card>
  );
}

