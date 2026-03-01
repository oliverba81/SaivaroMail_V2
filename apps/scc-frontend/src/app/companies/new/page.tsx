'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import type { CompanyStatus } from '@saivaro/shared';

export default function NewCompanyPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    plan: 'basic',
    status: 'active' as CompanyStatus,
    metadata: '',
    contactAddress: '',
    contactPhone: '',
    contactEmail: '',
    contactWebsite: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Slug aus Name generieren, falls nicht angegeben
      let slug = formData.slug.trim();
      if (!slug) {
        slug = formData.name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '');
      }

      // Metadata parsen (falls JSON)
      let metadata: Record<string, any> | undefined;
      if (formData.metadata.trim()) {
        try {
          metadata = JSON.parse(formData.metadata);
        } catch {
          metadata = { notes: formData.metadata };
        }
      }

      const response = await api.post('/companies', {
        name: formData.name.trim(),
        slug,
        plan: formData.plan,
        status: formData.status,
        metadata,
        contactAddress: formData.contactAddress.trim() || undefined,
        contactPhone: formData.contactPhone.trim() || undefined,
        contactEmail: formData.contactEmail.trim() || undefined,
        contactWebsite: formData.contactWebsite.trim() || undefined,
      });

      // Erfolgreich erstellt → zur Detail-Seite
      router.push(`/companies/${response.data.id}`);
    } catch (err: any) {
      setError(
        err.response?.data?.message ||
          err.response?.data?.error ||
          'Fehler beim Erstellen der Company. Bitte versuchen Sie es erneut.',
      );
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  return (
    <div className="container">
      <button
        className="btn btn-primary"
        onClick={() => router.push('/companies')}
        style={{ marginBottom: '1rem' }}
      >
        ← Zurück
      </button>

      <div className="card">
        <h1>Neue Company erstellen</h1>

        {error && (
          <div
            style={{
              padding: '0.75rem',
              backgroundColor: '#f8d7da',
              color: '#721c24',
              borderRadius: '4px',
              marginBottom: '1rem',
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div>
            <label htmlFor="name" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>
              Name *
            </label>
            <input
              type="text"
              id="name"
              name="name"
              className="input"
              value={formData.name}
              onChange={handleChange}
              required
              placeholder="z. B. Acme Corporation"
            />
          </div>

          <div>
            <label htmlFor="slug" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>
              Slug
            </label>
            <input
              type="text"
              id="slug"
              name="slug"
              className="input"
              value={formData.slug}
              onChange={handleChange}
              placeholder="wird automatisch generiert, falls leer"
              pattern="[a-z0-9-]+"
              title="Nur Kleinbuchstaben, Zahlen und Bindestriche"
            />
            <small style={{ color: '#666', fontSize: '0.85rem' }}>
              Wird automatisch aus dem Namen generiert, falls leer. Nur Kleinbuchstaben, Zahlen und
              Bindestriche erlaubt.
            </small>
          </div>

          <div>
            <label htmlFor="plan" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>
              Plan *
            </label>
            <select
              id="plan"
              name="plan"
              className="input"
              value={formData.plan}
              onChange={handleChange}
              required
            >
              <option value="basic">Basic</option>
              <option value="premium">Premium</option>
              <option value="enterprise">Enterprise</option>
            </select>
          </div>

          <div>
            <label htmlFor="status" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>
              Status *
            </label>
            <select
              id="status"
              name="status"
              className="input"
              value={formData.status}
              onChange={handleChange}
              required
            >
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          <hr style={{ margin: '1.5rem 0', border: 'none', borderTop: '1px solid #dee2e6' }} />
          <h2 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>Firmenkontakt (für Signatur-Platzhalter)</h2>
          <p style={{ color: '#666', fontSize: '0.9rem', marginBottom: '1rem' }}>
            Diese Angaben werden im Mailclient für die Signatur-Platzhalter verwendet (z. B. {'{{companyAddress}}'}).
          </p>

          <div>
            <label htmlFor="contactAddress" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>
              Firmenadresse
            </label>
            <input
              type="text"
              id="contactAddress"
              name="contactAddress"
              className="input"
              value={formData.contactAddress}
              onChange={handleChange}
              placeholder="z. B. Musterstraße 1, 12345 Stadt"
            />
          </div>

          <div>
            <label htmlFor="contactPhone" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>
              Telefon
            </label>
            <input
              type="text"
              id="contactPhone"
              name="contactPhone"
              className="input"
              value={formData.contactPhone}
              onChange={handleChange}
              placeholder="z. B. +49 123 456789"
            />
          </div>

          <div>
            <label htmlFor="contactEmail" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>
              E-Mail (Kontakt)
            </label>
            <input
              type="email"
              id="contactEmail"
              name="contactEmail"
              className="input"
              value={formData.contactEmail}
              onChange={handleChange}
              placeholder="z. B. info@firma.de"
            />
          </div>

          <div>
            <label htmlFor="contactWebsite" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>
              Website
            </label>
            <input
              type="url"
              id="contactWebsite"
              name="contactWebsite"
              className="input"
              value={formData.contactWebsite}
              onChange={handleChange}
              placeholder="z. B. https://www.firma.de"
            />
          </div>

          <hr style={{ margin: '1.5rem 0', border: 'none', borderTop: '1px solid #dee2e6' }} />

          <div>
            <label htmlFor="metadata" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>
              Metadata (optional)
            </label>
            <textarea
              id="metadata"
              name="metadata"
              className="input"
              value={formData.metadata}
              onChange={handleChange}
              rows={4}
              placeholder='JSON-Format: {"key": "value"} oder einfacher Text'
              style={{ fontFamily: 'monospace', fontSize: '0.9rem' }}
            />
            <small style={{ color: '#666', fontSize: '0.85rem' }}>
              Optional: JSON-Objekt oder einfacher Text. Wird als Metadata gespeichert.
            </small>
          </div>

          <div style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem' }}>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Wird erstellt...' : 'Company erstellen'}
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => router.push('/companies')}
              disabled={loading}
              style={{ backgroundColor: '#6c757d', color: 'white' }}
            >
              Abbrechen
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}




