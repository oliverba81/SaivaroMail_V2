'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import type { Company } from '@saivaro/shared';
import { CompanyStatus, ProvisioningStatus } from '@saivaro/shared';

type SortField = 'name' | 'slug' | 'status' | 'plan' | 'createdAt';
type SortDirection = 'asc' | 'desc';

const CACHE_TTL_MS = 45 * 1000; // 45 Sekunden
let companiesCache: { data: Company[]; timestamp: number } | null = null;

export default function CompaniesPage() {
  const router = useRouter();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<CompanyStatus | 'all'>('all');
  const [planFilter, setPlanFilter] = useState<string>('all');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    // Prüfe, ob User eingeloggt ist
    const token = localStorage.getItem('scc_token');
    const userStr = localStorage.getItem('scc_user');
    
    if (!token) {
      router.push('/login');
      return;
    }

    if (userStr) {
      try {
        setUser(JSON.parse(userStr));
      } catch (e) {
        console.error('Fehler beim Parsen der Benutzerdaten:', e);
      }
    }

    const now = Date.now();
    if (companiesCache && now - companiesCache.timestamp < CACHE_TTL_MS) {
      setCompanies(companiesCache.data);
      setLoading(false);
      setError('');
      return;
    }
    loadCompanies();
  }, [router]);

  const loadCompanies = async () => {
    try {
      const response = await api.get('/companies');
      const data = response.data as Company[];
      setCompanies(data);
      setError(''); // Fehler zurücksetzen bei Erfolg
      companiesCache = { data, timestamp: Date.now() };
    } catch (err: any) {
      console.error('Fehler beim Laden der Companies:', err);
      console.error('Response:', err.response?.data);
      console.error('Status:', err.response?.status);
      
      let errorMessage = 'Fehler beim Laden der Companies';
      
      if (err.response) {
        // Server hat geantwortet
        if (err.response.status === 401) {
          errorMessage = 'Nicht autorisiert. Bitte melden Sie sich erneut an.';
          // Token entfernen und zum Login weiterleiten
          localStorage.removeItem('scc_token');
          localStorage.removeItem('scc_user');
          router.push('/login');
          return;
        } else if (err.response.status === 404) {
          errorMessage = 'API-Endpoint nicht gefunden. Bitte prüfen Sie, ob der SCC-Backend-Server läuft.';
        } else if (err.response.data?.error) {
          errorMessage = err.response.data.error;
        } else if (err.response.data?.message) {
          errorMessage = err.response.data.message;
        } else {
          errorMessage = `Server-Fehler (Status: ${err.response.status})`;
        }
      } else if (err.request) {
        // Anfrage wurde gesendet, aber keine Antwort erhalten
        errorMessage = 'Keine Verbindung zum Server. Bitte prüfen Sie, ob der SCC-Backend-Server auf http://localhost:3001 läuft.';
      } else {
        // Fehler beim Erstellen der Anfrage
        errorMessage = err.message || 'Unbekannter Fehler';
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('scc_token');
    localStorage.removeItem('scc_user');
    router.push('/login');
  };

  const getStatusBadge = (status: CompanyStatus | string) => {
    const badges: Record<string, string> = {
      [CompanyStatus.ACTIVE]: 'badge-success',
      [CompanyStatus.SUSPENDED]: 'badge-warning',
      [CompanyStatus.INACTIVE]: 'badge-danger',
    };
    return badges[status] || 'badge-info';
  };

  const getProvisioningBadge = (status?: ProvisioningStatus | string) => {
    if (!status) return null;
    const badges: Record<string, string> = {
      [ProvisioningStatus.READY]: 'badge-success',
      [ProvisioningStatus.PROVISIONING]: 'badge-warning',
      [ProvisioningStatus.PENDING]: 'badge-info',
      [ProvisioningStatus.FAILED]: 'badge-danger',
    };
    return badges[status] || 'badge-info';
  };

  // Gefilterte und sortierte Companies
  const filteredAndSortedCompanies = useMemo(() => {
    let filtered = companies;

    // Suche
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (c) =>
          c.name.toLowerCase().includes(query) ||
          c.slug.toLowerCase().includes(query) ||
          c.plan.toLowerCase().includes(query),
      );
    }

    // Status-Filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter((c) => c.status === statusFilter);
    }

    // Plan-Filter
    if (planFilter !== 'all') {
      filtered = filtered.filter((c) => c.plan === planFilter);
    }

    // Sortierung
    filtered = [...filtered].sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortField) {
        case 'name':
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        case 'slug':
          aValue = a.slug.toLowerCase();
          bValue = b.slug.toLowerCase();
          break;
        case 'status':
          aValue = a.status;
          bValue = b.status;
          break;
        case 'plan':
          aValue = a.plan;
          bValue = b.plan;
          break;
        case 'createdAt':
          aValue = new Date(a.createdAt).getTime();
          bValue = new Date(b.createdAt).getTime();
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [companies, searchQuery, statusFilter, planFilter, sortField, sortDirection]);

  // Pagination
  const totalPages = Math.ceil(filteredAndSortedCompanies.length / itemsPerPage);
  const paginatedCompanies = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredAndSortedCompanies.slice(start, start + itemsPerPage);
  }, [filteredAndSortedCompanies, currentPage]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
    setCurrentPage(1);
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return '↕️';
    return sortDirection === 'asc' ? '↑' : '↓';
  };

  if (loading) {
    return (
      <div className="container">
        <p>Lade...</p>
      </div>
    );
  }

  return (
    <div className="container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1>Companies ({filteredAndSortedCompanies.length})</h1>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {user?.role === 'super_admin' && (
            <button className="btn" onClick={() => router.push('/maintenance')}>
              Wartung
            </button>
          )}
          <button className="btn btn-primary" onClick={() => router.push('/companies/new')}>
            Neue Company
          </button>
          <button className="btn btn-danger" onClick={handleLogout}>
            Abmelden
          </button>
        </div>
      </div>

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

      {/* Filter und Suche */}
      <div className="card" style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '1rem', alignItems: 'end' }}>
          <div>
            <label htmlFor="search" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>
              Suche
            </label>
            <input
              type="text"
              id="search"
              className="input"
              placeholder="Nach Name, Slug oder Plan suchen..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>
          <div>
            <label htmlFor="statusFilter" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>
              Status
            </label>
            <select
              id="statusFilter"
              className="input"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as CompanyStatus | 'all');
                setCurrentPage(1);
              }}
            >
              <option value="all">Alle</option>
              <option value={CompanyStatus.ACTIVE}>Active</option>
              <option value={CompanyStatus.SUSPENDED}>Suspended</option>
              <option value={CompanyStatus.INACTIVE}>Inactive</option>
            </select>
          </div>
          <div>
            <label htmlFor="planFilter" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>
              Plan
            </label>
            <select
              id="planFilter"
              className="input"
              value={planFilter}
              onChange={(e) => {
                setPlanFilter(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="all">Alle</option>
              <option value="basic">Basic</option>
              <option value="premium">Premium</option>
              <option value="enterprise">Enterprise</option>
            </select>
          </div>
        </div>
      </div>

      <div className="card">
        {companies.length === 0 ? (
          <p>Keine Companies gefunden.</p>
        ) : filteredAndSortedCompanies.length === 0 ? (
          <p>Keine Companies entsprechen den Filtern.</p>
        ) : (
          <>
            <table className="table">
              <thead>
                <tr>
                  <th style={{ cursor: 'pointer' }} onClick={() => handleSort('name')}>
                    Name {getSortIcon('name')}
                  </th>
                  <th style={{ cursor: 'pointer' }} onClick={() => handleSort('slug')}>
                    Slug {getSortIcon('slug')}
                  </th>
                  <th style={{ cursor: 'pointer' }} onClick={() => handleSort('status')}>
                    Status {getSortIcon('status')}
                  </th>
                  <th style={{ cursor: 'pointer' }} onClick={() => handleSort('plan')}>
                    Plan {getSortIcon('plan')}
                  </th>
                  <th>DB-Status</th>
                  <th>Aktionen</th>
                </tr>
              </thead>
              <tbody>
                {paginatedCompanies.map((company) => (
                <tr key={company.id}>
                  <td>{company.name}</td>
                  <td>{company.slug}</td>
                  <td>
                    <span className={`badge ${getStatusBadge(company.status)}`}>
                      {company.status}
                    </span>
                  </td>
                  <td>{company.plan}</td>
                  <td>
                    {company.dbConfig ? (
                      <span className={`badge ${getProvisioningBadge(company.dbConfig.provisioningStatus)}`}>
                        {company.dbConfig.provisioningStatus}
                      </span>
                    ) : (
                      <span className="badge badge-info">Nicht provisioniert</span>
                    )}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <button
                        className="btn btn-primary"
                        onClick={() => router.push(`/companies/${company.id}`)}
                      >
                        Details
                      </button>
                      <button
                        className="btn"
                        style={{ backgroundColor: '#6c757d', color: 'white' }}
                        onClick={() => router.push(`/companies/${company.id}/edit`)}
                      >
                        Bearbeiten
                      </button>
                      <a
                        href={`http://localhost:3010?company=${encodeURIComponent(company.slug)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn"
                        style={{ 
                          backgroundColor: '#28a745', 
                          color: 'white', 
                          textDecoration: 'none',
                          display: 'inline-block'
                        }}
                        title={`Mailclient für ${company.name} öffnen`}
                      >
                        Mailclient
                      </a>
                      {company.dbConfig?.provisioningStatus === 'ready' && (
                        <button
                          className="btn"
                          onClick={() => router.push(`/companies/${company.id}/database`)}
                          style={{ 
                            backgroundColor: '#007bff', 
                            color: 'white',
                            marginLeft: '0.5rem'
                          }}
                          title="Datenbank-Interface öffnen"
                        >
                          📊 DB
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            {totalPages > 1 && (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: '0.5rem',
                  marginTop: '1rem',
                  paddingTop: '1rem',
                  borderTop: '1px solid #ddd',
                }}
              >
                <button
                  className="btn"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  style={{ backgroundColor: '#6c757d', color: 'white' }}
                >
                  ← Zurück
                </button>
                <span style={{ padding: '0 1rem' }}>
                  Seite {currentPage} von {totalPages}
                </span>
                <button
                  className="btn"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  style={{ backgroundColor: '#6c757d', color: 'white' }}
                >
                  Weiter →
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

