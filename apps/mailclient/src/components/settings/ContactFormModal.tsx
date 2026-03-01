'use client';

import { useState, useEffect, useRef } from 'react';
import { FiX, FiPlus, FiTrash2, FiUser, FiHelpCircle, FiUpload } from 'react-icons/fi';

export interface ContactFormPhone {
  id?: string;
  label: string;
  number: string;
  sortOrder: number;
}
export interface ContactFormEmail {
  id?: string;
  label: string;
  email: string;
  sortOrder: number;
}
export interface ContactFormAddress {
  id?: string;
  label: string;
  street: string;
  postalCode: string;
  city: string;
  country: string;
  sortOrder: number;
}

export interface ContactFormData {
  firstName: string;
  lastName: string;
  companyName: string;
  customerNumber: string;
  salutation: 'du' | 'sie';
  formalTitle: string;
  notes: string;
  birthday: string;
  avatarUrl: string;
  tags: string[];
  phones: ContactFormPhone[];
  emails: ContactFormEmail[];
  addresses: ContactFormAddress[];
}

export interface ContactFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** API-Kontakt zum Bearbeiten oder null für neu */
  contact?: any | null;
  contactId?: string | null;
  onSave: (data: ContactFormData, contactId?: string | null) => Promise<void>;
}

const emptyPhone = (): ContactFormPhone => ({ label: '', number: '', sortOrder: 0 });
const emptyEmail = (): ContactFormEmail => ({ label: '', email: '', sortOrder: 0 });
const emptyAddress = (): ContactFormAddress =>
  ({ label: '', street: '', postalCode: '', city: '', country: '', sortOrder: 0 });

const INITIAL_FORM: ContactFormData = {
  firstName: '',
  lastName: '',
  companyName: '',
  customerNumber: '',
  salutation: 'sie',
  formalTitle: '',
  notes: '',
  birthday: '',
  avatarUrl: '',
  tags: [],
  phones: [],
  emails: [],
  addresses: [],
};

function contactToFormData(c: any): ContactFormData {
  return {
    firstName: c.firstName ?? '',
    lastName: c.lastName ?? '',
    companyName: c.companyName ?? '',
    customerNumber: c.customerNumber ?? '',
    salutation: (c.salutation === 'du' ? 'du' : 'sie') as 'du' | 'sie',
    formalTitle: c.formalTitle ?? '',
    notes: c.notes ?? '',
    birthday: c.birthday ? String(c.birthday).slice(0, 10) : '',
    avatarUrl: c.avatarUrl ?? '',
    tags: Array.isArray(c.tags) ? c.tags : [],
    phones: (c.phones && c.phones.length) ? c.phones.map((p: any, i: number) => ({
      id: p.id,
      label: p.label ?? '',
      number: p.number ?? '',
      sortOrder: p.sortOrder ?? i,
    })) : [],
    emails: (c.emails && c.emails.length) ? c.emails.map((e: any, i: number) => ({
      id: e.id,
      label: e.label ?? '',
      email: e.email ?? '',
      sortOrder: e.sortOrder ?? i,
    })) : [],
    addresses: (c.addresses && c.addresses.length) ? c.addresses.map((a: any, i: number) => ({
      id: a.id,
      label: a.label ?? '',
      street: a.street ?? '',
      postalCode: a.postalCode ?? a.postal_code ?? '',
      city: a.city ?? '',
      country: a.country ?? '',
      sortOrder: a.sortOrder ?? i,
    })) : [],
  };
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ContactFormModal({
  isOpen,
  onClose,
  contact,
  contactId,
  onSave,
}: ContactFormModalProps) {
  const [form, setForm] = useState<ContactFormData>(INITIAL_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const avatarFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      if (contact) {
        setForm(contactToFormData(contact));
      } else {
        setForm(INITIAL_FORM);
      }
      setError('');
    }
  }, [isOpen, contact]);

  const handleAvatarFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setForm((prev) => ({ ...prev, avatarUrl: dataUrl }));
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  if (!isOpen) return null;

  const displayName =
    [form.firstName, form.lastName].filter(Boolean).join(' ').trim() || form.companyName?.trim();
  const addPhone = () => setForm((prev) => ({ ...prev, phones: [...prev.phones, emptyPhone()] }));
  const removePhone = (i: number) =>
    setForm((prev) => ({ ...prev, phones: prev.phones.filter((_, idx) => idx !== i) }));
  const setPhone = (i: number, field: keyof ContactFormPhone, value: string | number) =>
    setForm((prev) => ({
      ...prev,
      phones: prev.phones.map((p, idx) => (idx === i ? { ...p, [field]: value } : p)),
    }));

  const addEmail = () => setForm((prev) => ({ ...prev, emails: [...prev.emails, emptyEmail()] }));
  const removeEmail = (i: number) =>
    setForm((prev) => ({ ...prev, emails: prev.emails.filter((_, idx) => idx !== i) }));
  const setEmail = (i: number, field: keyof ContactFormEmail, value: string | number) =>
    setForm((prev) => ({
      ...prev,
      emails: prev.emails.map((e, idx) => (idx === i ? { ...e, [field]: value } : e)),
    }));

  const addAddress = () => setForm((prev) => ({ ...prev, addresses: [...prev.addresses, emptyAddress()] }));
  const removeAddress = (i: number) =>
    setForm((prev) => ({ ...prev, addresses: prev.addresses.filter((_, idx) => idx !== i) }));
  const setAddress = (i: number, field: keyof ContactFormAddress, value: string | number) =>
    setForm((prev) => ({
      ...prev,
      addresses: prev.addresses.map((a, idx) => (idx === i ? { ...a, [field]: value } : a)),
    }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!displayName) {
      setError('Bitte mindestens Vorname/Nachname oder Firma angeben.');
      return;
    }
    for (const e of form.emails) {
      if (e.email && !EMAIL_REGEX.test(e.email)) {
        setError('Bitte gültige E-Mail-Adressen eingeben.');
        return;
      }
    }
    setSaving(true);
    try {
      await onSave(form, contactId ?? undefined);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Fehler beim Speichern.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="modal-overlay"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        className="card"
        style={{
          width: '90%',
          maxWidth: '640px',
          maxHeight: '90vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '1rem 1.5rem',
            borderBottom: '1px solid #eee',
            flexShrink: 0,
          }}
        >
          <h2 style={{ margin: 0, fontSize: '1.25rem' }}>
            {contactId ? 'Kontakt bearbeiten' : 'Neuer Kontakt'}
          </h2>
          <button type="button" onClick={onClose} className="btn btn-ghost" aria-label="Schließen">
            <FiX size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
          <div style={{ overflowY: 'auto', padding: '1rem 1.5rem', flex: 1 }}>
            {error && (
              <div className="alert alert-error" style={{ marginBottom: '1rem' }} role="alert">
                {error}
              </div>
            )}

            {/* Profilbild */}
            <div style={{ marginBottom: '1rem' }}>
              <label className="block text-sm font-medium text-gray-700 mb-1">Profilbild</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                <div
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: '50%',
                    overflow: 'hidden',
                    backgroundColor: '#eee',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  {form.avatarUrl ? (
                    <img src={form.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <FiUser size={32} color="#999" />
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1, minWidth: 200 }}>
                  <input
                    type="file"
                    ref={avatarFileInputRef}
                    accept="image/jpeg,image/png,image/gif,image/webp"
                    onChange={handleAvatarFileChange}
                    style={{ display: 'none' }}
                    aria-hidden="true"
                  />
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => avatarFileInputRef.current?.click()}
                    style={{ alignSelf: 'flex-start' }}
                  >
                    <FiUpload size={16} className="inline mr-2" />
                    Bild hochladen
                  </button>
                  <input
                    type="text"
                    className="input"
                    placeholder="Oder URL zum Bild eingeben (optional)"
                    value={typeof form.avatarUrl === 'string' && !form.avatarUrl.startsWith('data:') ? form.avatarUrl : ''}
                    onChange={(e) => setForm((prev) => ({ ...prev, avatarUrl: e.target.value || '' }))}
                  />
                  {form.avatarUrl && (
                    <button
                      type="button"
                      className="btn btn-ghost"
                      style={{ alignSelf: 'flex-start', fontSize: '0.875rem', color: '#6b7280' }}
                      onClick={() => setForm((prev) => ({ ...prev, avatarUrl: '' }))}
                    >
                      Bild entfernen
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label className="block text-sm font-medium text-gray-700 mb-1">Anrede für Briefe</label>
              <select
                className="select"
                value={form.formalTitle}
                onChange={(e) => setForm((prev) => ({ ...prev, formalTitle: e.target.value }))}
              >
                <option value="">—</option>
                <option value="Herr">Herr</option>
                <option value="Frau">Frau</option>
                <option value="Divers">Divers</option>
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Vorname</label>
                <input
                  type="text"
                  className="input"
                  value={form.firstName}
                  onChange={(e) => setForm((prev) => ({ ...prev, firstName: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nachname</label>
                <input
                  type="text"
                  className="input"
                  value={form.lastName}
                  onChange={(e) => setForm((prev) => ({ ...prev, lastName: e.target.value }))}
                />
              </div>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label className="block text-sm font-medium text-gray-700 mb-1">Firma</label>
              <input
                type="text"
                className="input"
                value={form.companyName}
                onChange={(e) => setForm((prev) => ({ ...prev, companyName: e.target.value }))}
              />
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label className="block text-sm font-medium text-gray-700 mb-1">Kundennummer (optional)</label>
              <input
                type="text"
                className="input"
                value={form.customerNumber}
                onChange={(e) => setForm((prev) => ({ ...prev, customerNumber: e.target.value }))}
              />
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label className="block text-sm font-medium text-gray-700 mb-1" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                Anredeform
                <span title="Ob Sie den Kontakt mit Du oder Sie ansprechen (z. B. in E-Mails)." style={{ cursor: 'help' }} aria-label="Hinweis: Ob Sie den Kontakt mit Du oder Sie ansprechen.">
                  <FiHelpCircle size={14} color="#6b7280" />
                </span>
              </label>
              <select
                className="select"
                value={form.salutation}
                onChange={(e) => setForm((prev) => ({ ...prev, salutation: e.target.value as 'du' | 'sie' }))}
              >
                <option value="sie">Sie</option>
                <option value="du">Du</option>
              </select>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label className="block text-sm font-medium text-gray-700 mb-1">Geburtstag</label>
              <input
                type="date"
                className="input"
                value={form.birthday}
                onChange={(e) => setForm((prev) => ({ ...prev, birthday: e.target.value }))}
              />
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notiz</label>
              <textarea
                className="input"
                rows={3}
                value={form.notes}
                onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
              />
            </div>

            {/* Telefon */}
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <label className="text-sm font-medium text-gray-700">Telefonnummern</label>
                <button type="button" className="btn btn-secondary btn-sm" onClick={addPhone}>
                  <FiPlus size={14} className="inline mr-1" /> Hinzufügen
                </button>
              </div>
              {form.phones.map((p, i) => (
                <div key={i} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', alignItems: 'center' }}>
                  <input
                    type="text"
                    className="input"
                    placeholder="Bezeichnung (z. B. mobil)"
                    value={p.label}
                    onChange={(e) => setPhone(i, 'label', e.target.value)}
                    style={{ width: '120px' }}
                  />
                  <input
                    type="text"
                    className="input"
                    placeholder="Nummer"
                    value={p.number}
                    onChange={(e) => setPhone(i, 'number', e.target.value)}
                    style={{ flex: 1 }}
                  />
                  <button type="button" onClick={() => removePhone(i)} className="btn btn-ghost" aria-label="Entfernen">
                    <FiTrash2 size={18} />
                  </button>
                </div>
              ))}
            </div>

            {/* E-Mail */}
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <label className="text-sm font-medium text-gray-700">E-Mail-Adressen</label>
                <button type="button" className="btn btn-secondary btn-sm" onClick={addEmail}>
                  <FiPlus size={14} className="inline mr-1" /> Hinzufügen
                </button>
              </div>
              {form.emails.map((e, i) => (
                <div key={i} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', alignItems: 'center' }}>
                  <input
                    type="text"
                    className="input"
                    placeholder="Bezeichnung"
                    value={e.label}
                    onChange={(ev) => setEmail(i, 'label', ev.target.value)}
                    style={{ width: '120px' }}
                  />
                  <input
                    type="email"
                    className="input"
                    placeholder="E-Mail"
                    value={e.email}
                    onChange={(ev) => setEmail(i, 'email', ev.target.value)}
                    style={{ flex: 1 }}
                  />
                  <button type="button" onClick={() => removeEmail(i)} className="btn btn-ghost" aria-label="Entfernen">
                    <FiTrash2 size={18} />
                  </button>
                </div>
              ))}
            </div>

            {/* Adressen */}
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <label className="text-sm font-medium text-gray-700">Anschriften</label>
                <button type="button" className="btn btn-secondary btn-sm" onClick={addAddress}>
                  <FiPlus size={14} className="inline mr-1" /> Hinzufügen
                </button>
              </div>
              {form.addresses.map((a, i) => (
                <div key={i} style={{ border: '1px solid #eee', borderRadius: 8, padding: '0.75rem', marginBottom: '0.5rem' }}>
                  <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', alignItems: 'center' }}>
                    <input
                      type="text"
                      className="input"
                      placeholder="Bezeichnung"
                      value={a.label}
                      onChange={(ev) => setAddress(i, 'label', ev.target.value)}
                      style={{ width: '120px' }}
                    />
                    <button type="button" onClick={() => removeAddress(i)} className="btn btn-ghost" aria-label="Adresse entfernen">
                      <FiTrash2 size={18} />
                    </button>
                  </div>
                  <input
                    type="text"
                    className="input"
                    placeholder="Straße"
                    value={a.street}
                    onChange={(ev) => setAddress(i, 'street', ev.target.value)}
                    style={{ marginBottom: '0.5rem' }}
                  />
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input
                      type="text"
                      className="input"
                      placeholder="PLZ"
                      value={a.postalCode}
                      onChange={(ev) => setAddress(i, 'postalCode', ev.target.value)}
                      style={{ width: '80px' }}
                    />
                    <input
                      type="text"
                      className="input"
                      placeholder="Ort"
                      value={a.city}
                      onChange={(ev) => setAddress(i, 'city', ev.target.value)}
                      style={{ flex: 1 }}
                    />
                    <input
                      type="text"
                      className="input"
                      placeholder="Land"
                      value={a.country}
                      onChange={(ev) => setAddress(i, 'country', ev.target.value)}
                      style={{ width: '100px' }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '0.5rem',
              padding: '1rem 1.5rem',
              borderTop: '1px solid #eee',
              flexShrink: 0,
            }}
          >
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Abbrechen
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Speichern…' : 'Speichern'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
