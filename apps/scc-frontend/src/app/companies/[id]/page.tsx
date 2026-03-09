'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import api from '@/lib/api';
import type { Company } from '@saivaro/shared';
import { formatDate } from '@saivaro/shared';
import StorageUsage from '@/components/StorageUsage';

export default function CompanyDetailPage() {
  const router = useRouter();
  const params = useParams();
  const companyId = params.id as string;
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [provisioning, setProvisioning] = useState(false);
  const [tenantUsers, setTenantUsers] = useState<any[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [showCreateUserForm, setShowCreateUserForm] = useState(false);
  const [creatingUser, setCreatingUser] = useState(false);
  const [newUserData, setNewUserData] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    role: 'user',
  });
  const [userPasswords, setUserPasswords] = useState<Record<string, string>>({});
  const [systemLogs, setSystemLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [logsPage, setLogsPage] = useState(1);
  const [logsLimit] = useState(50);
  const [logsTotal, setLogsTotal] = useState(0);
  const [logTypeFilter, setLogTypeFilter] = useState<string>('');
  const [features, setFeatures] = useState({ audioFeatures: false });
  const [savingFeatures, setSavingFeatures] = useState(false);
  const [featuresError, setFeaturesError] = useState('');

  // Funktion zum Generieren eines zufälligen Passworts
  const generateRandomPassword = (): string => {
    const length = 12;
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < length; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return password;
  };

  useEffect(() => {
    const token = localStorage.getItem('scc_token');
    if (!token) {
      router.push('/login');
      return;
    }

    loadCompany();
  }, [companyId, router]);

  useEffect(() => {
    if (company?.dbConfig && !loading && companyId) {
      loadTenantUsers();
    }
  }, [company?.id, company?.dbConfig?.id, loading]);

  useEffect(() => {
    if (company?.id && company?.dbConfig?.provisioningStatus === 'ready') {
      loadSystemLogs();
    }
  }, [company?.id, company?.dbConfig?.provisioningStatus, logsPage, logTypeFilter]);

  const loadCompany = async () => {
    try {
      const response = await api.get(`/companies/${companyId}`);
      setCompany(response.data);
      // Lade Feature-Flags
      const metadata = response.data?.metadata as Record<string, any> | null;
      const featuresData = metadata?.features || {};
      // audioFeatures aktiviert beide Funktionen, für Rückwärtskompatibilität prüfe auch die alten Flags
      const audioFeatures = featuresData.audioFeatures ??
        (featuresData.textToSpeech && featuresData.emailSummary) ??
        false;
      setFeatures({
        audioFeatures: audioFeatures,
      });
    } catch (err: any) {
      console.error('Fehler beim Laden der Company:', err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadTenantUsers = async () => {
    if (!company?.dbConfig || !companyId) {
      return;
    }

    setLoadingUsers(true);
    try {
      const response = await api.get(`/companies/${companyId}/tenant-users`);

      const users = response.data?.users || [];
      setTenantUsers(users);

      // Passwörter aus Response setzen (werden jetzt vom Backend mitgeliefert)
      const passwords: Record<string, string> = {};
      users.forEach((user: any) => {
        const password = user.password;
        if (typeof password === 'string' && password) {
          passwords[user.id] = password;
        }
      });

      setUserPasswords((prev) => ({ ...prev, ...passwords }));
    } catch (err: any) {
      console.error('Fehler beim Laden der Tenant-User:', err);
      setTenantUsers([]);
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleDeactivateUser = async (userId: string, userEmail: string) => {
    if (!confirm(`Möchten Sie den User "${userEmail}" wirklich deaktivieren?`)) {
      return;
    }

    try {
      await api.patch(`/companies/${companyId}/tenant-users/${userId}`, {
        status: 'inactive',
      });
      alert('User wurde deaktiviert.');
      await loadTenantUsers();
    } catch (err: any) {
      alert(err.response?.data?.error || err.response?.data?.message || 'Fehler beim Deaktivieren des Users');
    }
  };

  const handleActivateUser = async (userId: string, _userEmail: string) => {
    try {
      await api.patch(`/companies/${companyId}/tenant-users/${userId}`, {
        status: 'active',
      });
      alert('User wurde aktiviert.');
      await loadTenantUsers();
    } catch (err: any) {
      alert(err.response?.data?.error || err.response?.data?.message || 'Fehler beim Aktivieren des Users');
    }
  };

  const handleDeleteUser = async (userId: string, userEmail: string) => {
    if (
      !confirm(
        `Möchten Sie den User "${userEmail}" wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden!`
      )
    ) {
      return;
    }

    try {
      await api.delete(`/companies/${companyId}/tenant-users/${userId}`);
      alert('User wurde gelöscht.');
      setUserPasswords((prev) => {
        const newState = { ...prev };
        delete newState[userId];
        return newState;
      });
      await loadTenantUsers();
    } catch (err: any) {
      alert(err.response?.data?.error || err.response?.data?.message || 'Fehler beim Löschen des Users');
    }
  };

  const loadSystemLogs = async () => {
    if (!companyId) return;

    setLoadingLogs(true);
    try {
      const queryParams: Record<string, string | number> = {
        limit: logsLimit,
        offset: (logsPage - 1) * logsLimit,
      };
      if (logTypeFilter) {
        queryParams.logType = logTypeFilter;
      }

      const response = await api.get(`/system-logs/companies/${companyId}/logs`, {
        params: queryParams,
      });
      setSystemLogs(response.data.logs || []);
      setLogsTotal(response.data.total || 0);
    } catch (err: any) {
      console.error('Fehler beim Laden der System-Logs:', err);
      setSystemLogs([]);
      setLogsTotal(0);
    } finally {
      setLoadingLogs(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company?.dbConfig || !companyId) return;

    setCreatingUser(true);
    try {
      const userDataToSend = {
        ...newUserData,
        email: newUserData.email || 'admin@localhost',
      };
      const response = await api.post(`/companies/${companyId}/tenant-users`, userDataToSend);
      if (response.data.password) {
        setUserPasswords((prev) => ({
          ...prev,
          [response.data.id]: response.data.password,
        }));
      }
      alert('User erfolgreich erstellt!');
      setShowCreateUserForm(false);
      const randomPassword = generateRandomPassword();
      setNewUserData({
        email: 'admin@localhost',
        password: randomPassword,
        firstName: 'Admin',
        lastName: 'User',
        role: 'admin',
      });
      await loadTenantUsers();
    } catch (err: any) {
      const code = err.code || err.response?.status;
      const msg = err.message || err.response?.data?.message || String(err.response?.data);
      console.error(`[Tenant-User] Fehler: ${msg} (code: ${code})`);

      const errorMessage = err.response?.data?.message || err.message || '';
      if (
        typeof errorMessage === 'string' &&
        (errorMessage.includes('existiert bereits') || errorMessage.includes('bereits existiert'))
      ) {
        setShowCreateUserForm(false);
        await loadTenantUsers();
        return;
      }

      let displayMessage = 'Fehler beim Erstellen des Users';

      if (err.response?.data) {
        const data = err.response.data;

        if (Array.isArray(data.message)) {
          displayMessage = data.message.join('\n');
        } else if (data.message) {
          displayMessage = data.message;
        } else if (data.error) {
          displayMessage = data.error;
        } else {
          displayMessage = JSON.stringify(data, null, 2);
        }
      } else if (err.message) {
        displayMessage = err.message;
      }

      alert(displayMessage);
    } finally {
      setCreatingUser(false);
    }
  };

  const handleProvision = async () => {
    if (!confirm('Möchten Sie wirklich eine DB für diese Company provisionieren?')) {
      return;
    }

    setProvisioning(true);
    try {
      await api.post(`/companies/${companyId}/provision-db`, {
        plan: company?.plan || 'basic',
        dbServerType: 'shared',
      });

      await new Promise((resolve) => setTimeout(resolve, 1000));

      const companyResponse = await api.get(`/companies/${companyId}`);
      setCompany(companyResponse.data);

      let attempts = 0;
      const maxAttempts = 20;
      let currentCompany = companyResponse.data;

      while (attempts < maxAttempts && currentCompany?.dbConfig?.provisioningStatus !== 'ready') {
        await new Promise((resolve) => setTimeout(resolve, 500));
        const updatedResponse = await api.get(`/companies/${companyId}`);
        currentCompany = updatedResponse.data;
        setCompany(currentCompany);
        attempts++;
      }

      if (currentCompany?.dbConfig) {
        await loadTenantUsers();
      }

      alert('Provisionierung abgeschlossen!');
    } catch (err: any) {
      console.error('Provisionierung Fehler:', err);
      const msg = err.response?.data?.message || err.response?.data?.error || err.message || 'Fehler bei der Provisionierung';
      alert(msg);
    } finally {
      setProvisioning(false);
    }
  };

  const handleDelete = async () => {
    if (!company) return;
    if (
      !confirm(
        `Möchten Sie die Company "${company.name}" wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden!`
      )
    ) {
      return;
    }

    try {
      await api.delete(`/companies/${companyId}`);
      alert('Company wurde gelöscht.');
      router.push('/companies');
    } catch (err: any) {
      alert(err.response?.data?.error || 'Fehler beim Löschen der Company');
    }
  };

  const handleSaveFeatures = async () => {
    setSavingFeatures(true);
    setFeaturesError('');
    try {
      await api.patch(`/companies/${companyId}/features`, {
        audioFeatures: features.audioFeatures,
      });
      alert('Features erfolgreich aktualisiert');
      await loadCompany();
    } catch (err: any) {
      const errorMessage =
        err.response?.data?.error || err.response?.data?.message || 'Fehler beim Speichern der Features';
      setFeaturesError(errorMessage);
      alert(errorMessage);
    } finally {
      setSavingFeatures(false);
    }
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
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        <button className="btn btn-primary" onClick={() => router.push('/companies')}>
          ← Zurück
        </button>
        <button
          className="btn"
          style={{ backgroundColor: '#6c757d', color: 'white' }}
          onClick={() => router.push(`/companies/${company.id}/edit`)}
        >
          Bearbeiten
        </button>
      </div>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
          <div>
            <h1>{company.name}</h1>
            <p style={{ color: '#666', marginTop: '0.5rem' }}>ID: {company.id}</p>
          </div>
          <div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
              <a
                href={`http://localhost:3010?company=${encodeURIComponent(company.slug)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary"
                style={{ textDecoration: 'none', display: 'inline-block' }}
                title={`Mailclient für ${company.name} (funktioniert ohne Subdomain-Setup)`}
              >
                → Mailclient öffnen
              </a>
              <a
                href={`http://${company.slug}.localhost:3010`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn"
                style={{ textDecoration: 'none', display: 'inline-block', backgroundColor: '#6c757d', color: 'white' }}
                title={`Alternativ per Subdomain (erfordert hosts-Eintrag)`}
              >
                (Subdomain)
              </a>
            </div>
            <p style={{ fontSize: '0.85rem', color: '#666', marginTop: '0.25rem' }}>
              <code style={{ backgroundColor: '#f0f0f0', padding: '0.2rem 0.4rem', borderRadius: '3px' }}>localhost:3010?company={company.slug}</code>
              {' oder '}
              <code style={{ backgroundColor: '#f0f0f0', padding: '0.2rem 0.4rem', borderRadius: '3px' }}>{company.slug}.localhost:3010</code>
            </p>
          </div>
        </div>

        <h2 style={{ marginTop: '2rem', marginBottom: '1rem' }}>Details</h2>
        <table className="table">
          <tbody>
            <tr>
              <td>
                <strong>Name</strong>
              </td>
              <td>{company.name}</td>
            </tr>
            <tr>
              <td>
                <strong>Slug</strong>
              </td>
              <td>{company.slug}</td>
            </tr>
            <tr>
              <td>
                <strong>Status</strong>
              </td>
              <td>{company.status}</td>
            </tr>
            <tr>
              <td>
                <strong>Plan</strong>
              </td>
              <td>{company.plan}</td>
            </tr>
            <tr>
              <td>
                <strong>Erstellt am</strong>
              </td>
              <td>{formatDate(company.createdAt)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2>Datenbank-Konfiguration</h2>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {company.dbConfig?.provisioningStatus === 'ready' && (
              <button
                className="btn"
                onClick={() => router.push(`/companies/${company.id}/database`)}
                style={{ backgroundColor: '#28a745', color: 'white', marginRight: '0.5rem' }}
                title="Datenbank-Interface öffnen"
              >
                📊 Datenbank öffnen
              </button>
            )}
            <button
              className="btn btn-primary"
              onClick={handleProvision}
              disabled={provisioning}
              title={company.dbConfig ? 'DB-Config für lokale Entwicklung aktualisieren' : 'DB provisionieren'}
            >
              {provisioning ? 'Provisionierung läuft...' : company.dbConfig ? 'DB-Config aktualisieren' : 'DB provisionieren'}
            </button>
            <button className="btn btn-danger" onClick={handleDelete}>
              Company löschen
            </button>
          </div>
        </div>

        {company.dbConfig ? (
          <table className="table">
            <tbody>
              <tr>
                <td>
                  <strong>Host</strong>
                </td>
                <td>{company.dbConfig.dbHost}</td>
              </tr>
              <tr>
                <td>
                  <strong>Port</strong>
                </td>
                <td>{company.dbConfig.dbPort}</td>
              </tr>
              <tr>
                <td>
                  <strong>Datenbank</strong>
                </td>
                <td>{company.dbConfig.dbName}</td>
              </tr>
              <tr>
                <td>
                  <strong>User</strong>
                </td>
                <td>{company.dbConfig.dbUser}</td>
              </tr>
              <tr>
                <td>
                  <strong>SSL Mode</strong>
                </td>
                <td>{company.dbConfig.dbSslMode}</td>
              </tr>
              <tr>
                <td>
                  <strong>Provisionierungs-Status</strong>
                </td>
                <td>{company.dbConfig.provisioningStatus}</td>
              </tr>
              <tr>
                <td>
                  <strong>Health-Status</strong>
                </td>
                <td>{company.dbConfig.healthStatus}</td>
              </tr>
            </tbody>
          </table>
        ) : (
          <p style={{ color: '#666' }}>Keine DB-Konfiguration vorhanden. Bitte DB provisionieren.</p>
        )}
      </div>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ margin: 0 }}>Features</h2>
          <button
            className="btn btn-primary"
            onClick={handleSaveFeatures}
            disabled={savingFeatures}
            style={{ fontSize: '0.9rem', padding: '0.4rem 0.8rem' }}
          >
            {savingFeatures ? 'Speichern...' : 'Speichern'}
          </button>
        </div>

        {featuresError && (
          <div
            style={{
              padding: '0.75rem',
              backgroundColor: '#f8d7da',
              color: '#721c24',
              borderRadius: '4px',
              marginBottom: '1rem',
            }}
          >
            {featuresError}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <input
              type="checkbox"
              id="feature-audioFeatures"
              checked={features.audioFeatures}
              onChange={(e) => setFeatures({ ...features, audioFeatures: e.target.checked })}
              style={{ width: '18px', height: '18px', cursor: 'pointer' }}
            />
            <label
              htmlFor="feature-audioFeatures"
              style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '0.5rem' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <strong>Audio-Features aktivieren</strong>
                <span
                  style={{
                    padding: '0.25rem 0.5rem',
                    borderRadius: '4px',
                    fontSize: '0.85rem',
                    backgroundColor: features.audioFeatures ? '#28a745' : '#6c757d',
                    color: 'white',
                  }}
                >
                  {features.audioFeatures ? 'Aktiviert' : 'Deaktiviert'}
                </span>
              </div>
              <div style={{ fontSize: '0.85rem', color: '#666', marginTop: '0.25rem', marginLeft: '1.75rem' }}>
                Aktiviert: E-Mail als Audio vorlesen und E-Mail-Zusammenfassung als Audio
              </div>
            </label>
          </div>
        </div>
      </div>

      {company.dbConfig && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 style={{ margin: 0 }}>Webclient-Logindaten</h2>
            <button
              className="btn btn-primary"
              onClick={() => {
                if (!showCreateUserForm) {
                  const randomPassword = generateRandomPassword();
                  setNewUserData({
                    email: 'admin@localhost',
                    password: randomPassword,
                    firstName: 'Admin',
                    lastName: 'User',
                    role: 'admin',
                  });
                }
                setShowCreateUserForm(!showCreateUserForm);
              }}
              style={{ fontSize: '0.9rem', padding: '0.4rem 0.8rem' }}
            >
              {showCreateUserForm ? 'Abbrechen' : '+ Test-User erstellen'}
            </button>
          </div>

          {showCreateUserForm && (
            <div
              style={{
                padding: '1rem',
                backgroundColor: '#f8f9fa',
                borderRadius: '4px',
                marginBottom: '1rem',
              }}
            >
              <h3 style={{ marginTop: 0, marginBottom: '1rem', fontSize: '1.1rem' }}>Neuen Test-User erstellen</h3>
              <form onSubmit={handleCreateUser}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.9rem', fontWeight: '500' }}>
                      Benutzername *
                    </label>
                    <input
                      type="text"
                      value="admin"
                      readOnly
                      style={{
                        width: '100%',
                        padding: '0.5rem',
                        border: '1px solid #ddd',
                        borderRadius: '4px',
                        backgroundColor: '#f0f0f0',
                        cursor: 'not-allowed',
                      }}
                    />
                    <input type="hidden" value={newUserData.email || 'admin@localhost'} name="email" />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.9rem', fontWeight: '500' }}>
                      Passwort * (wird automatisch generiert)
                    </label>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <input
                        type="text"
                        value={newUserData.password}
                        readOnly
                        style={{
                          flex: 1,
                          padding: '0.5rem',
                          border: '1px solid #ddd',
                          borderRadius: '4px',
                          backgroundColor: '#fff3cd',
                          fontFamily: 'monospace',
                          fontWeight: '500',
                          color: '#856404',
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const newPassword = generateRandomPassword();
                          setNewUserData({ ...newUserData, password: newPassword });
                        }}
                        style={{
                          padding: '0.5rem 0.75rem',
                          fontSize: '0.85rem',
                          backgroundColor: '#6c757d',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                        }}
                        title="Neues Passwort generieren"
                      >
                        🔄 Neu
                      </button>
                    </div>
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.9rem', fontWeight: '500' }}>
                      Vorname
                    </label>
                    <input
                      type="text"
                      value={newUserData.firstName}
                      onChange={(e) => setNewUserData({ ...newUserData, firstName: e.target.value })}
                      style={{ width: '100%', padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px' }}
                      placeholder="Max"
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.9rem', fontWeight: '500' }}>
                      Nachname
                    </label>
                    <input
                      type="text"
                      value={newUserData.lastName}
                      onChange={(e) => setNewUserData({ ...newUserData, lastName: e.target.value })}
                      style={{ width: '100%', padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px' }}
                      placeholder="Mustermann"
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.9rem', fontWeight: '500' }}>
                      Rolle
                    </label>
                    <select
                      value={newUserData.role}
                      onChange={(e) => setNewUserData({ ...newUserData, role: e.target.value })}
                      style={{ width: '100%', padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px' }}
                    >
                      <option value="user">User</option>
                      <option value="admin">Admin</option>
                      <option value="viewer">Viewer</option>
                    </select>
                  </div>
                </div>
                <button type="submit" className="btn btn-primary" disabled={creatingUser} style={{ fontSize: '0.9rem' }}>
                  {creatingUser ? 'Erstelle...' : 'User erstellen'}
                </button>
              </form>
            </div>
          )}

          {loadingUsers ? (
            <p style={{ color: '#666' }}>Lade User-Daten...</p>
          ) : tenantUsers.length > 0 ? (
            <table className="table">
              <thead>
                <tr>
                  <th>Benutzername</th>
                  <th>Passwort</th>
                  <th>Aktionen</th>
                </tr>
              </thead>
              <tbody>
                {tenantUsers.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <code
                          style={{
                            backgroundColor: '#e7f3ff',
                            padding: '0.4rem 0.6rem',
                            borderRadius: '4px',
                            fontSize: '0.9rem',
                            fontWeight: '500',
                            color: '#0066cc',
                            border: '1px solid #b3d9ff',
                          }}
                        >
                          {user.username || user.email}
                        </code>
                        <button
                          onClick={async () => {
                            try {
                              const usernameToCopy = user.username || user.email;
                              await navigator.clipboard.writeText(usernameToCopy);
                              alert(`Benutzername "${usernameToCopy}" wurde kopiert!`);
                            } catch (err) {
                              alert('Fehler beim Kopieren');
                            }
                          }}
                          style={{
                            padding: '0.3rem 0.6rem',
                            fontSize: '0.85rem',
                            backgroundColor: '#007bff',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontWeight: '500',
                          }}
                          title="Benutzername kopieren"
                        >
                          📋 Kopieren
                        </button>
                      </div>
                    </td>
                    <td>
                      {(() => {
                        const password = user.password || userPasswords[user.id];
                        return password ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <code
                              style={{
                                backgroundColor: '#fff3cd',
                                padding: '0.4rem 0.6rem',
                                borderRadius: '4px',
                                fontSize: '0.9rem',
                                fontWeight: '500',
                                color: '#856404',
                                border: '1px solid #ffc107',
                                fontFamily: 'monospace',
                                letterSpacing: '0.1em',
                              }}
                            >
                              {'*'.repeat(typeof password === 'string' ? password.length : 0)}
                            </code>
                            <button
                              onClick={async () => {
                                try {
                                  await navigator.clipboard.writeText(typeof password === 'string' ? password : '');
                                  alert('Passwort wurde kopiert!');
                                } catch (err) {
                                  alert('Fehler beim Kopieren');
                                }
                              }}
                              style={{
                                padding: '0.3rem 0.6rem',
                                fontSize: '0.85rem',
                                backgroundColor: '#007bff',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontWeight: '500',
                              }}
                              title="Passwort kopieren"
                            >
                              📋 Kopieren
                            </button>
                          </div>
                        ) : (
                          <span style={{ color: '#999', fontSize: '0.9rem' }}>Nicht verfügbar</span>
                        );
                      })()}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        {user.status === 'active' ? (
                          <button
                            className="btn"
                            style={{
                              fontSize: '0.85rem',
                              padding: '0.25rem 0.5rem',
                              backgroundColor: '#ffc107',
                              color: '#000',
                              border: 'none',
                            }}
                            onClick={() => handleDeactivateUser(user.id, user.email)}
                            title="User deaktivieren"
                          >
                            Deaktivieren
                          </button>
                        ) : (
                          <button
                            className="btn"
                            style={{
                              fontSize: '0.85rem',
                              padding: '0.25rem 0.5rem',
                              backgroundColor: '#28a745',
                              color: 'white',
                              border: 'none',
                            }}
                            onClick={() => handleActivateUser(user.id, user.email)}
                            title="User aktivieren"
                          >
                            Aktivieren
                          </button>
                        )}
                        <button
                          className="btn btn-danger"
                          style={{ fontSize: '0.85rem', padding: '0.25rem 0.5rem' }}
                          onClick={() => handleDeleteUser(user.id, user.email)}
                          title="User löschen"
                        >
                          Löschen
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div
              style={{
                padding: '1rem',
                backgroundColor: '#fff3cd',
                borderRadius: '4px',
                border: '1px solid #ffc107',
              }}
            >
              <p style={{ margin: 0, color: '#856404' }}>
                <strong>Hinweis:</strong> Keine User in der Tenant-Datenbank gefunden. Bitte erstellen Sie einen
                Test-User über den Button oben.
              </p>
            </div>
          )}
        </div>
      )}

      {company.dbConfig && company.dbConfig.provisioningStatus === 'ready' && (
        <>
          <StorageUsage companyId={companyId} />

          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ margin: 0 }}>System-Logs</h2>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <select
                  value={logTypeFilter}
                  onChange={(e) => {
                    setLogTypeFilter(e.target.value);
                    setLogsPage(1);
                  }}
                  style={{
                    padding: '0.4rem 0.8rem',
                    fontSize: '0.9rem',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                  }}
                >
                  <option value="">Alle Log-Typen</option>
                  <option value="cron_job">Cron-Jobs</option>
                  <option value="automation">Automatisierungen</option>
                  <option value="email_event">E-Mail-Events</option>
                </select>
                <button
                  className="btn"
                  onClick={loadSystemLogs}
                  disabled={loadingLogs}
                  style={{ fontSize: '0.9rem', padding: '0.4rem 0.8rem' }}
                >
                  {loadingLogs ? 'Lädt...' : '🔄 Aktualisieren'}
                </button>
              </div>
            </div>

            {loadingLogs ? (
              <p style={{ color: '#666' }}>Lade Logs...</p>
            ) : systemLogs.length > 0 ? (
              <>
                <div style={{ marginBottom: '1rem', color: '#666', fontSize: '0.9rem' }}>{logsTotal} Einträge insgesamt</div>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Zeitpunkt</th>
                      <th>Log-Typ</th>
                      <th>Details</th>
                      <th>Status</th>
                      <th>Ausführungszeit</th>
                      <th>Fehler</th>
                    </tr>
                  </thead>
                  <tbody>
                    {systemLogs.map((log) => (
                      <tr key={log.id}>
                        <td>
                          <div style={{ fontSize: '0.85rem' }}>{formatDate(log.timestamp)}</div>
                          {log.completedAt && (
                            <div style={{ fontSize: '0.75rem', color: '#666' }}>
                              Beendet: {formatDate(log.completedAt)}
                            </div>
                          )}
                        </td>
                        <td>
                          <span
                            style={{
                              padding: '0.25rem 0.5rem',
                              borderRadius: '4px',
                              fontSize: '0.85rem',
                              backgroundColor:
                                log.logType === 'cron_job' ? '#e7f3ff' : log.logType === 'automation' ? '#d1ecf1' : '#f0f0f0',
                              color:
                                log.logType === 'cron_job' ? '#0066cc' : log.logType === 'automation' ? '#0c5460' : '#333',
                            }}
                          >
                            {log.logType === 'cron_job' ? '🔄 Cron-Job' : log.logType === 'automation' ? '⚙️ Automatisierung' : '📧 E-Mail-Event'}
                          </span>
                        </td>
                        <td>
                          {log.logType === 'cron_job' && (
                            <>
                              <div style={{ fontSize: '0.85rem', fontWeight: '500' }}>
                                {log.jobType === 'scheduled_trigger' ? 'Scheduled Trigger' : 'E-Mail-Abruf'}
                              </div>
                              <code
                                style={{
                                  fontSize: '0.75rem',
                                  backgroundColor: '#f0f0f0',
                                  padding: '0.1rem 0.3rem',
                                  borderRadius: '3px',
                                }}
                              >
                                {log.jobKey}
                              </code>
                              {log.processedItems != null && (
                                <div style={{ fontSize: '0.75rem', color: '#666', marginTop: '0.25rem' }}>
                                  {log.processedItems} Items
                                </div>
                              )}
                            </>
                          )}
                          {log.logType === 'automation' && (
                            <>
                              <div style={{ fontSize: '0.85rem', fontWeight: '500' }}>
                                Regel: {log.ruleId?.substring(0, 8)}...
                              </div>
                              <div style={{ fontSize: '0.75rem', color: '#666' }}>Trigger: {log.triggerType}</div>
                              {log.executedActions &&
                                Array.isArray(log.executedActions) &&
                                log.executedActions.length > 0 && (
                                  <div style={{ fontSize: '0.75rem', color: '#666', marginTop: '0.25rem' }}>
                                    {log.executedActions.length} Aktion(en)
                                  </div>
                                )}
                            </>
                          )}
                          {log.logType === 'email_event' && (
                            <>
                              <div style={{ fontSize: '0.85rem', fontWeight: '500' }}>{log.eventType}</div>
                              <div style={{ fontSize: '0.75rem', color: '#666' }}>
                                E-Mail: {log.emailId?.substring(0, 8)}...
                              </div>
                            </>
                          )}
                        </td>
                        <td>
                          <span
                            style={{
                              padding: '0.25rem 0.5rem',
                              borderRadius: '4px',
                              fontSize: '0.85rem',
                              fontWeight: '500',
                              backgroundColor:
                                log.status === 'success'
                                  ? '#d4edda'
                                  : log.status === 'failed'
                                    ? '#f8d7da'
                                    : log.status === 'running'
                                      ? '#fff3cd'
                                      : '#e9ecef',
                              color:
                                log.status === 'success'
                                  ? '#155724'
                                  : log.status === 'failed'
                                    ? '#721c24'
                                    : log.status === 'running'
                                      ? '#856404'
                                      : '#495057',
                            }}
                          >
                            {log.status === 'success'
                              ? '✓ Erfolg'
                              : log.status === 'failed'
                                ? '✗ Fehler'
                                : log.status === 'running'
                                  ? '⏳ Läuft'
                                  : log.status || '-'}
                          </span>
                        </td>
                        <td>{log.executionTimeMs ? `${log.executionTimeMs}ms` : '-'}</td>
                        <td>
                          {log.errorMessage ? (
                            <span style={{ color: '#dc3545', fontSize: '0.85rem' }}>{log.errorMessage}</span>
                          ) : (
                            '-'
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginTop: '1rem',
                  }}
                >
                  <button
                    className="btn"
                    onClick={() => setLogsPage((p) => Math.max(1, p - 1))}
                    disabled={logsPage === 1 || loadingLogs}
                  >
                    ← Zurück
                  </button>
                  <span style={{ color: '#666' }}>
                    Seite {logsPage} ({(logsPage - 1) * logsLimit + 1}-
                    {Math.min(logsPage * logsLimit, logsTotal)} von {logsTotal})
                  </span>
                  <button
                    className="btn"
                    onClick={() => setLogsPage((p) => p + 1)}
                    disabled={logsPage * logsLimit >= logsTotal || loadingLogs}
                  >
                    Weiter →
                  </button>
                </div>
              </>
            ) : (
              <p style={{ color: '#666' }}>Keine Logs gefunden.</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
