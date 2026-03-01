'use client';

import { useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ToastProvider';
import { FiPlus, FiEdit2, FiTrash2, FiUser } from 'react-icons/fi';
import ContactFormModal, { type ContactFormData } from './ContactFormModal';

export interface ContactPhone {
  id?: string;
  label?: string | null;
  number: string;
  sortOrder?: number;
}
export interface ContactEmail {
  id?: string;
  label?: string | null;
  email: string;
  sortOrder?: number;
}
export interface ContactAddress {
  id?: string;
  label?: string | null;
  street?: string | null;
  postalCode?: string | null;
  city?: string | null;
  country?: string | null;
  sortOrder?: number;
}
export interface Contact {
  id: string;
  companyId?: string;
  firstName?: string | null;
  lastName?: string | null;
  companyName?: string | null;
  salutation?: 'du' | 'sie';
  formalTitle?: string | null;
  notes?: string | null;
  birthday?: string | null;
  avatarUrl?: string | null;
  customerNumber?: string | null;
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
  phones: ContactPhone[];
  emails: ContactEmail[];
  addresses: ContactAddress[];
}

interface SettingsContactsTabProps {
  contacts: Contact[];
  onContactsChange: (contacts: Contact[]) => void;
  onBack: () => void;
  toast: ReturnType<typeof useToast>;
  router: ReturnType<typeof useRouter>;
  onError: (msg: string) => void;
}

function getDisplayName(c: Contact): string {
  const name = [c.firstName, c.lastName].filter(Boolean).join(' ').trim();
  return name || c.companyName || '—';
}

function getPrimaryEmail(c: Contact): string {
  const e = c.emails && c.emails[0];
  return e?.email || '—';
}

function getPrimaryPhone(c: Contact): string {
  const p = c.phones && c.phones[0];
  return p?.number || '—';
}

export default function SettingsContactsTab({
  contacts,
  onContactsChange,
  onBack: _onBack,
  toast,
  router,
  onError,
}: SettingsContactsTabProps) {
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const filteredContacts = useMemo(() => {
    if (!search.trim()) return contacts;
    const q = search.trim().toLowerCase();
    return contacts.filter((c) => {
      const name = getDisplayName(c).toLowerCase();
      const company = (c.companyName || '').toLowerCase();
      const email = getPrimaryEmail(c).toLowerCase();
      const phone = getPrimaryPhone(c).toLowerCase();
      const customer = (c.customerNumber || '').toLowerCase();
      return (
        name.includes(q) ||
        company.includes(q) ||
        email.includes(q) ||
        phone.includes(q) ||
        customer.includes(q)
      );
    });
  }, [contacts, search]);

  const getToken = useCallback(() => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('mailclient_token');
  }, []);

  const loadContacts = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    try {
      setLoading(true);
      const res = await fetch('/api/contacts', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        localStorage.removeItem('mailclient_token');
        localStorage.removeItem('mailclient_user');
        router.push('/login');
        return;
      }
      if (!res.ok) {
        onError('Fehler beim Laden der Kontakte');
        return;
      }
      const data = await res.json();
      onContactsChange(data.contacts || []);
    } catch (err) {
      onError('Fehler beim Laden der Kontakte');
    } finally {
      setLoading(false);
    }
  }, [getToken, router, onContactsChange, onError]);

  const handleOpenNew = () => {
    setEditingContact(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (c: Contact) => {
    setEditingContact(c);
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setEditingContact(null);
  };

  const handleSave = useCallback(
    async (data: ContactFormData, contactId?: string | null) => {
      const token = getToken();
      if (!token) {
        router.push('/login');
        throw new Error('Nicht angemeldet');
      }

      const payload = {
        firstName: data.firstName.trim() || null,
        lastName: data.lastName.trim() || null,
        companyName: data.companyName.trim() || null,
        customerNumber: data.customerNumber.trim() || null,
        salutation: data.salutation,
        formalTitle: data.formalTitle || null,
        notes: data.notes.trim() || null,
        birthday: data.birthday || null,
        avatarUrl: data.avatarUrl.trim() || null,
        tags: data.tags || [],
        phones: data.phones.filter((p) => p.number.trim()).map((p, i) => ({
          label: p.label.trim() || null,
          number: p.number.trim(),
          sortOrder: i,
        })),
        emails: data.emails.filter((e) => e.email.trim()).map((e, i) => ({
          label: e.label.trim() || null,
          email: e.email.trim(),
          sortOrder: i,
        })),
        addresses: data.addresses.map((a, i) => ({
          label: a.label.trim() || null,
          street: a.street.trim() || null,
          postalCode: a.postalCode.trim() || null,
          city: a.city.trim() || null,
          country: a.country.trim() || null,
          sortOrder: i,
        })),
      };

      const url = contactId ? `/api/contacts/${contactId}` : '/api/contacts';
      const method = contactId ? 'PATCH' : 'POST';
      const response = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (response.status === 401) {
        localStorage.removeItem('mailclient_token');
        localStorage.removeItem('mailclient_user');
        router.push('/login');
        throw new Error('Nicht angemeldet');
      }

      const resData = await response.json();
      if (!response.ok) {
        throw new Error(resData.error || 'Fehler beim Speichern');
      }

      toast.showSuccess(contactId ? 'Kontakt aktualisiert' : 'Kontakt erstellt');
      await loadContacts();
    },
    [getToken, router, toast, loadContacts]
  );

  const handleDelete = useCallback(
    async (id: string) => {
      const token = getToken();
      if (!token) {
        router.push('/login');
        return;
      }
      const response = await fetch(`/api/contacts/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.status === 401) {
        localStorage.removeItem('mailclient_token');
        localStorage.removeItem('mailclient_user');
        router.push('/login');
        return;
      }
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        toast.showError(data.error || 'Fehler beim Löschen');
        setDeleteConfirmId(null);
        return;
      }
      toast.showSuccess('Kontakt gelöscht');
      setDeleteConfirmId(null);
      await loadContacts();
    },
    [getToken, router, toast, loadContacts]
  );

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center', marginBottom: '1.5rem' }}>
        <input
          type="search"
          className="input"
          placeholder="Name, E-Mail, Telefon, Firma …"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ minWidth: '220px', maxWidth: '400px' }}
          aria-label="Kontakte durchsuchen"
        />
        <button type="button" className="btn btn-primary" onClick={handleOpenNew}>
          <FiPlus size={18} className="inline mr-2" />
          Neuer Kontakt
        </button>
      </div>

      {loading ? (
        <p>Kontakte werden geladen…</p>
      ) : filteredContacts.length === 0 ? (
        <p className="text-gray-500">
          {search.trim() ? 'Keine Kontakte passen zur Suche.' : 'Noch keine Kontakte. Legen Sie einen an.'}
        </p>
      ) : (
        <div className="card" style={{ overflow: 'auto' }}>
          <table className="table contacts-table" style={{ width: '100%', minWidth: '600px' }}>
            <thead>
              <tr>
                <th style={{ width: 48, textAlign: 'left' }} aria-label="Profilbild" />
                <th style={{ textAlign: 'left' }}>Name</th>
                <th style={{ textAlign: 'left' }}>Firma</th>
                <th style={{ textAlign: 'left' }}>E-Mail</th>
                <th style={{ textAlign: 'left' }}>Telefon</th>
                <th style={{ textAlign: 'left' }}>Kundennr.</th>
                <th style={{ width: 120, textAlign: 'left' }}>Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {filteredContacts.map((c) => (
                <tr key={c.id}>
                  <td>
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: '50%',
                        overflow: 'hidden',
                        backgroundColor: '#eee',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {c.avatarUrl ? (
                        <img
                          src={c.avatarUrl}
                          alt=""
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      ) : (
                        <FiUser size={20} color="#999" />
                      )}
                    </div>
                  </td>
                  <td>{getDisplayName(c)}</td>
                  <td>{c.companyName || '—'}</td>
                  <td>{getPrimaryEmail(c)}</td>
                  <td>{getPrimaryPhone(c)}</td>
                  <td>{c.customerNumber || '—'}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleOpenEdit(c)}
                        title="Kontakt bearbeiten"
                        aria-label="Kontakt bearbeiten"
                      >
                        <FiEdit2 size={16} />
                      </button>
                      {deleteConfirmId === c.id ? (
                        <>
                          <span className="text-sm text-gray-600">Löschen?</span>
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            onClick={() => handleDelete(c.id)}
                            title="Löschen bestätigen"
                          >
                            Ja
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => setDeleteConfirmId(null)}
                            title="Abbrechen"
                          >
                            Nein
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => setDeleteConfirmId(c.id)}
                          title="Kontakt löschen"
                          aria-label="Kontakt löschen"
                        >
                          <FiTrash2 size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ContactFormModal
        isOpen={modalOpen}
        onClose={handleCloseModal}
        contact={editingContact ?? undefined}
        contactId={editingContact?.id ?? undefined}
        onSave={handleSave}
      />
    </div>
  );
}
