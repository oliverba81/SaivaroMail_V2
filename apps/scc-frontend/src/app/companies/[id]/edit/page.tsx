'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import api from '@/lib/api';
import type { Company, CompanyStatus } from '@saivaro/shared';

export default function EditCompanyPage() {
  const router = useRouter();
  const params = useParams();
  const companyId = params.id as string;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [company, setCompany] = useState<Company | null>(null);
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

  useEffect(() => {
    const token = localStorage.getItem('scc_token');
    if (!token) {
      router.push('/login');
      return;
    }

    loadCompany();
  }, [companyId, router]);

  const loadCompany = async () => {
    try {
      const response = await api.get(`/companies/${companyId}`);
      const companyData = response.data;
      setCompany(companyData);
      setFormData({
        name: companyData.name || '',
        slug: companyData.slug || '',
        plan: companyData.plan || 'basic',
        status: companyData.status || 'active',
        metadata: companyData.metadata
          ? JSON.stringify(companyData.metadata, null, 2)
          : '',
        contactAddress: companyData.contactAddress ?? '',
        contactPhone: companyData.contactPhone ?? '',
        contactEmail: companyData.contactEmail ?? '',
        contactWebsite: companyData.contactWebsite ?? '',
      });
    } catch (err: any) {
      setError(err.response?.data?.error || 'Fehler beim Laden der Company');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);

    try {
      // Metadata parsen (falls JSON)
      let metadata: Record<string, any> | undefined;
      if (formData.metadata.trim()) {
        try {
          metadata = JSON.parse(formData.metadata);
        } catch {
          metadata = { notes: formData.metadata };
        }
      }

      await api.patch(`/companies/${companyId}`, {
        name: formData.name.trim(),
        slug: formData.slug.trim(),
        plan: formData.plan,
        status: formData.status,
        metadata,
        contactAddress: formData.contactAddress.trim() || undefined,
        contactPhone: formData.contactPhone.trim() || undefined,
        contactEmail: formData.contactEmail.trim() || undefined,
        contactWebsite: formData.contactWebsite.trim() || undefined,
      });

      // Erfolgreich aktualisiert → zur Detail-Seite
      router.push(`/companies/${companyId}`);
    } catch (err: any) {
      setError(
        err.response?.data?.message ||
          err.response?.data?.error ||
          'Fehler beim Aktualisieren der Company. Bitte versuchen Sie es erneut.',
      );
    } finally {
      setSaving(false);
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

  if (loading) {
    return (
      <div className="container">
        <p>Lade...</p>
      </div>
    );
  }

  if (!company) {
    return (
      <div className="container">
        <p>Company nicht gefunden.</p>
      </div>
    );
  }

  return (
    <div className="container">
      <button
        className="btn btn-primary"
        onClick={() => router.push(`/companies/${companyId}`)}
        style={{ marginBottom: '1rem' }}
      >
        ← Zurück
      </button>

      <div className="card">
        <h1>Company bearbeiten</h1>
        <p style={{ color: '#666', marginBottom: '1.5rem' }}>ID: {company.id}</p>

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
            />
          </div>

          <div>
            <label htmlFor="slug" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>
              Slug *
            </label>
            <input
              type="text"
              id="slug"
              name="slug"
              className="input"
              value={formData.slug}
              onChange={handleChange}
              required
              pattern="[a-z0-9-]+"
              title="Nur Kleinbuchstaben, Zahlen und Bindestriche"
            />
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
            Diese Angaben werden im Mailclient für die Signatur-Platzhalter {'{{companyName}}'}, {'{{companyAddress}}'}, {'{{companyPhone}}'}, {'{{companyEmail}}'}, {'{{companyWebsite}}'} verwendet.
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
              rows={6}
              style={{ fontFamily: 'monospace', fontSize: '0.9rem' }}
              placeholder='JSON-Format: {"key": "value"}'
            />
          </div>

          <div style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem' }}>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Wird gespeichert...' : 'Änderungen speichern'}
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => router.push(`/companies/${companyId}`)}
              disabled={saving}
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
