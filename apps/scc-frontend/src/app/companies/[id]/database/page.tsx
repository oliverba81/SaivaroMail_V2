'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import api from '@/lib/api';

interface QueryResult {
  columns: string[];
  rows: any[];
  rowCount: number;
  executionTimeMs: number;
  limited?: boolean;
}

interface Table {
  tableName: string;
  columnCount: number;
}

interface View {
  viewName: string;
}

interface Sequence {
  sequenceName: string;
}

interface DbFunction {
  functionName: string;
  routineType: string;
}

interface DatabaseInfo {
  postgresVersion: string;
  databaseSizeBytes: number;
  databaseSize: string;
  databaseName: string;
}

export default function DatabasePage() {
  const router = useRouter();
  const params = useParams();
  const companyId = params.id as string;
  const [tables, setTables] = useState<Table[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('SELECT * FROM users LIMIT 10');
  const [queryHistory, setQueryHistory] = useState<string[]>([]);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [executing, setExecuting] = useState(false);
  const [error, setError] = useState('');
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [tableStructure, setTableStructure] = useState<any>(null);
  const [tableData, setTableData] = useState<any>(null);
  const [tableIndexes, setTableIndexes] = useState<any[]>([]);
  const [tableForeignKeys, setTableForeignKeys] = useState<any[]>([]);
  const [tableConstraints, setTableConstraints] = useState<any[]>([]);
  const [tableStats, setTableStats] = useState<any>(null);
  const [views, setViews] = useState<View[]>([]);
  const [sequences, setSequences] = useState<Sequence[]>([]);
  const [functions, setFunctions] = useState<DbFunction[]>([]);
  const [databaseInfo, setDatabaseInfo] = useState<DatabaseInfo | null>(null);
  const [activeTab, setActiveTab] = useState<'query' | 'structure' | 'data'>('query');
  const [structureTab, setStructureTab] = useState<'columns' | 'indexes' | 'foreignKeys' | 'constraints' | 'stats'>('columns');
  const [sidebarTab, setSidebarTab] = useState<'tables' | 'views' | 'sequences' | 'functions'>('tables');
  const [connectionStatus, setConnectionStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');
  const [bookmarks, setBookmarks] = useState<string[]>([]);
  const [tableDataFilter, setTableDataFilter] = useState('');
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(new Set());
  const [isMobile, setIsMobile] = useState(false);
  const queryInputRef = useRef<HTMLTextAreaElement>(null);
  const undoStack = useRef<string[]>([]);
  const redoStack = useRef<string[]>([]);

  useEffect(() => {
    const token = localStorage.getItem('scc_token');
    if (!token) {
      router.push('/login');
      return;
    }

    loadTables();
    loadQueryHistory();
    loadBookmarks();
    loadDatabaseInfo();
    loadViews();
    loadSequences();
    loadFunctions();

    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, [companyId, router]);

  const handleExecuteQuery = async () => {
    if (!query.trim()) {
      setError('Bitte geben Sie eine Query ein');
      return;
    }

    setExecuting(true);
    setError('');
    setResult(null);

    try {
      const response = await api.post(`/companies/${companyId}/execute-query`, {
        query: query.trim(),
        limit: 1000,
        timeout: 30,
      });
      setResult(response.data);
      saveQueryToHistory(query);
    } catch (err: any) {
      console.error('Fehler beim Ausführen der Query:', err);
      const errorMessage =
        err.response?.data?.message ||
        (typeof err.response?.data === 'string' ? err.response.data : null) ||
        err.message ||
        'Fehler beim Ausführen der Query';
      setError(errorMessage);
    } finally {
      setExecuting(false);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleExecuteQuery();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        handleRedo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [query, companyId]);

  const handleUndo = () => {
    if (undoStack.current.length > 0) {
      redoStack.current.push(query);
      const previous = undoStack.current.pop();
      if (previous) {
        setQuery(previous);
      }
    }
  };

  const handleRedo = () => {
    if (redoStack.current.length > 0) {
      undoStack.current.push(query);
      const next = redoStack.current.pop();
      if (next) {
        setQuery(next);
      }
    }
  };

  const handleQueryChange = (newQuery: string) => {
    undoStack.current.push(query);
    redoStack.current = [];
    if (undoStack.current.length > 50) {
      undoStack.current.shift();
    }
    setQuery(newQuery);
  };

  const loadTables = async () => {
    try {
      const response = await api.get(`/companies/${companyId}/tables`);
      setTables(response.data);
      setError('');
    } catch (err: any) {
      console.error('Fehler beim Laden der Tabellen:', err);
      const errorData = err.response?.data;
      let errorMessage = 'Fehler beim Laden der Tabellen';
      if (errorData) {
        if (typeof errorData === 'string') {
          errorMessage = errorData;
        } else if (errorData.message) {
          errorMessage = errorData.message;
        } else if (errorData.error?.message) {
          errorMessage = errorData.error.message;
        }
      }
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const loadViews = async () => {
    try {
      const response = await api.get(`/companies/${companyId}/views`);
      setViews(response.data);
    } catch (err: any) {
      console.error('Fehler beim Laden der Views:', err);
    }
  };

  const loadSequences = async () => {
    try {
      const response = await api.get(`/companies/${companyId}/sequences`);
      setSequences(response.data);
    } catch (err: any) {
      console.error('Fehler beim Laden der Sequences:', err);
    }
  };

  const loadFunctions = async () => {
    try {
      const response = await api.get(`/companies/${companyId}/functions`);
      setFunctions(response.data);
    } catch (err: any) {
      console.error('Fehler beim Laden der Functions:', err);
    }
  };

  const loadDatabaseInfo = async () => {
    try {
      const response = await api.get(`/companies/${companyId}/database-info`);
      setDatabaseInfo(response.data);
      setConnectionStatus('connected');
      setError('');
    } catch (err: any) {
      console.error('Fehler beim Laden der DB-Info:', err);
      setConnectionStatus('disconnected');
      const errorData = err.response?.data;
      let errorMessage = 'Fehler beim Laden der Datenbank-Informationen';
      if (errorData) {
        if (typeof errorData === 'string') {
          errorMessage = errorData;
        } else if (errorData.message) {
          errorMessage = errorData.message;
        } else if (errorData.error?.message) {
          errorMessage = errorData.error.message;
        }
      }
      setError(errorMessage);
    }
  };

  const loadQueryHistory = () => {
    const history = localStorage.getItem(`query_history_${companyId}`);
    if (history) {
      try {
        const parsed = JSON.parse(history);
        setQueryHistory(parsed);
      } catch (e) {
        console.error('Fehler beim Laden der Query-History:', e);
      }
    }
  };

  const saveQueryToHistory = (queryText: string) => {
    const trimmed = queryText.trim();
    if (!trimmed) return;

    const history = [...queryHistory];
    const index = history.indexOf(trimmed);
    if (index > -1) {
      history.splice(index, 1);
    }
    history.unshift(trimmed);
    const limited = history.slice(0, 20);
    setQueryHistory(limited);
    localStorage.setItem(`query_history_${companyId}`, JSON.stringify(limited));
  };

  const loadBookmarks = () => {
    const saved = localStorage.getItem(`query_bookmarks_${companyId}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setBookmarks(parsed);
      } catch (e) {
        console.error('Fehler beim Laden der Bookmarks:', e);
      }
    }
  };

  const saveBookmark = () => {
    const trimmed = query.trim();
    if (!trimmed) {
      alert('Bitte geben Sie eine Query ein, die gespeichert werden soll');
      return;
    }

    if (!bookmarks.includes(trimmed)) {
      const newBookmarks = [...bookmarks, trimmed];
      setBookmarks(newBookmarks);
      localStorage.setItem(`query_bookmarks_${companyId}`, JSON.stringify(newBookmarks));
      alert('Query wurde als Bookmark gespeichert');
    } else {
      alert('Diese Query ist bereits als Bookmark gespeichert');
    }
  };

  const deleteBookmark = (bookmark: string) => {
    const newBookmarks = bookmarks.filter((b) => b !== bookmark);
    setBookmarks(newBookmarks);
    localStorage.setItem(`query_bookmarks_${companyId}`, JSON.stringify(newBookmarks));
  };

  const copyCellValue = async (value: any) => {
    try {
      await navigator.clipboard.writeText(String(value || ''));
    } catch (err) {
      console.error('Fehler beim Kopieren:', err);
    }
  };

  const handleExplainQuery = async () => {
    if (!query.trim()) {
      setError('Bitte geben Sie eine Query ein');
      return;
    }

    setExecuting(true);
    setError('');

    try {
      const response = await api.post(`/companies/${companyId}/explain-query`, {
        query: query.trim(),
      });

      const planWindow = window.open('', '_blank', 'width=800,height=600');
      if (planWindow) {
        planWindow.document.write(`
          <html>
            <head><title>Query Plan</title></head>
            <body style="font-family: monospace; padding: 20px; white-space: pre-wrap;">
              <h2>EXPLAIN ANALYZE Ergebnis</h2>
              <pre>${response.data.queryPlan}</pre>
            </body>
          </html>
        `);
      } else {
        alert(`Query Plan:\n\n${response.data.queryPlan}`);
      }
    } catch (err: any) {
      console.error('Fehler beim EXPLAIN:', err);
      setError(err.response?.data?.message || err.message || 'Fehler beim EXPLAIN');
    } finally {
      setExecuting(false);
    }
  };

  const handleTableClick = async (tableName: string) => {
    setSelectedTable(tableName);
    setActiveTab('structure');
    setStructureTab('columns');
    setTableStructure(null);
    setTableData(null);
    setTableIndexes([]);
    setTableForeignKeys([]);
    setTableConstraints([]);
    setTableStats(null);

    try {
      const [structureResponse, dataResponse] = await Promise.all([
        api.get(`/companies/${companyId}/tables/${tableName}`),
        api.get(`/companies/${companyId}/tables/${tableName}/data?page=0&limit=50`),
      ]);
      setTableStructure(structureResponse.data);
      setTableData(dataResponse.data);

      if (structureResponse.data && structureResponse.data.length > 0) {
        setVisibleColumns(new Set(structureResponse.data.map((col: any) => col.columnName)));
      }
    } catch (err: any) {
      console.error('Fehler beim Laden der Tabellendaten:', err);
      setError(err.response?.data?.message || 'Fehler beim Laden der Tabellendaten');
    }
  };

  // API-Pfad: Backend nutzt "foreign-keys", nicht "foreignKeys"
  const getMetadataApiPath = (type: 'indexes' | 'foreignKeys' | 'constraints' | 'stats') =>
    type === 'foreignKeys' ? 'foreign-keys' : type;

  const loadTableMetadata = async (
    tableName: string,
    type: 'indexes' | 'foreignKeys' | 'constraints' | 'stats'
  ) => {
    try {
      const apiPath = getMetadataApiPath(type);
      const response = await api.get(`/companies/${companyId}/tables/${tableName}/${apiPath}`);
      if (type === 'indexes') {
        setTableIndexes(response.data);
      } else if (type === 'foreignKeys') {
        setTableForeignKeys(response.data);
      } else if (type === 'constraints') {
        setTableConstraints(response.data);
      } else if (type === 'stats') {
        setTableStats(response.data);
      }
    } catch (err: any) {
      console.error(`Fehler beim Laden der ${type}:`, err);
    }
  };

  const handleStructureTabChange = (tab: 'columns' | 'indexes' | 'foreignKeys' | 'constraints' | 'stats') => {
    setStructureTab(tab);
    if (selectedTable) {
      if (tab === 'indexes' && tableIndexes.length === 0) {
        loadTableMetadata(selectedTable, 'indexes');
      } else if (tab === 'foreignKeys' && tableForeignKeys.length === 0) {
        loadTableMetadata(selectedTable, 'foreignKeys');
      } else if (tab === 'constraints' && tableConstraints.length === 0) {
        loadTableMetadata(selectedTable, 'constraints');
      } else if (tab === 'stats' && !tableStats) {
        loadTableMetadata(selectedTable, 'stats');
      }
    }
  };

  const handleExportCSV = () => {
    if (!result) return;

    const headers = result.columns.join(',');
    const rows = result.rows.map((row) =>
      result.columns
        .map((col) => {
          const value = row[col];
          if (value === null || value === undefined) return '';
          if (typeof value === 'string' && value.includes(',')) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return String(value);
        })
        .join(',')
    );
    const csv = [headers, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `query_result_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportJSON = () => {
    if (!result) return;

    const json = JSON.stringify(result.rows, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `query_result_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFormatQuery = () => {
    let formatted = query
      .replace(/\s+/g, ' ')
      .replace(/\s*,\s*/g, ', ')
      .replace(/\s*\(\s*/g, ' (')
      .replace(/\s*\)\s*/g, ') ')
      .trim();

    formatted = formatted
      .replace(/\bSELECT\b/gi, '\nSELECT')
      .replace(/\bFROM\b/gi, '\nFROM')
      .replace(/\bWHERE\b/gi, '\nWHERE')
      .replace(/\bORDER BY\b/gi, '\nORDER BY')
      .replace(/\bGROUP BY\b/gi, '\nGROUP BY')
      .replace(/\bLIMIT\b/gi, '\nLIMIT')
      .trim();

    setQuery(formatted);
  };

  const isDangerousQuery = (queryText: string): boolean => {
    const dangerous = ['DROP', 'TRUNCATE', 'DELETE', 'UPDATE', 'ALTER', 'CREATE', 'INSERT'];
    const upper = queryText.toUpperCase().trim();
    return dangerous.some((cmd) => upper.startsWith(cmd));
  };

  const handleExecuteWithWarning = () => {
    if (isDangerousQuery(query)) {
      if (!confirm('Diese Query enthält gefährliche Befehle. Möchten Sie wirklich fortfahren?')) {
        return;
      }
    }
    handleExecuteQuery();
  };

  if (loading) {
    return (
      <div className="container">
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
          <button className="btn btn-primary" onClick={() => router.push(`/companies/${companyId}`)}>
            ← Zurück
          </button>
        </div>
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <div style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>⏳</div>
          <p>Lade Datenbank-Interface...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', alignItems: 'center' }}>
        <button className="btn btn-primary" onClick={() => router.push(`/companies/${companyId}`)}>
          ← Zurück
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ color: '#666' }}>Companies</span>
            <span>/</span>
            <span style={{ color: '#666' }}>{companyId.substring(0, 8)}...</span>
            <span>/</span>
            <span>Datenbank</span>
          </div>
          <h1 style={{ margin: '0.5rem 0 0 0' }}>Datenbank-Interface</h1>
        </div>
        {connectionStatus === 'connected' && databaseInfo && (
          <div style={{ fontSize: '0.85rem', color: '#28a745', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <span>●</span> Verbunden
          </div>
        )}
        {connectionStatus === 'disconnected' && (
          <div style={{ fontSize: '0.85rem', color: '#dc3545', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <span>●</span> Nicht verbunden
          </div>
        )}
      </div>

      {databaseInfo && (
        <div className="card" style={{ marginBottom: '1rem', padding: '0.75rem', fontSize: '0.85rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            <div>
              <strong>Datenbank:</strong> {databaseInfo.databaseName}
            </div>
            <div>
              <strong>Größe:</strong> {databaseInfo.databaseSize}
            </div>
            <div>
              <strong>PostgreSQL:</strong> {databaseInfo.postgresVersion.split(' ')[0]} {databaseInfo.postgresVersion.split(' ')[1]}
            </div>
            <div>
              <strong>Tabellen:</strong> {tables.length}
            </div>
          </div>
        </div>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : '250px 1fr',
          gap: '1rem',
          height: isMobile ? 'auto' : 'calc(100vh - 150px)',
        }}
      >
        {/* Sidebar */}
        <div className="card" style={{ overflow: 'auto' }}>
          <div
            style={{
              display: 'flex',
              gap: '0.5rem',
              marginBottom: '1rem',
              borderBottom: '1px solid #ddd',
              paddingBottom: '0.5rem',
            }}
          >
            <button
              onClick={() => setSidebarTab('tables')}
              style={{
                padding: '0.4rem 0.8rem',
                fontSize: '0.85rem',
                backgroundColor: sidebarTab === 'tables' ? '#007bff' : 'transparent',
                color: sidebarTab === 'tables' ? 'white' : '#007bff',
                border: '1px solid #007bff',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              Tabellen
            </button>
            <button
              onClick={() => setSidebarTab('views')}
              style={{
                padding: '0.4rem 0.8rem',
                fontSize: '0.85rem',
                backgroundColor: sidebarTab === 'views' ? '#007bff' : 'transparent',
                color: sidebarTab === 'views' ? 'white' : '#007bff',
                border: '1px solid #007bff',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              Views
            </button>
            <button
              onClick={() => setSidebarTab('sequences')}
              style={{
                padding: '0.4rem 0.8rem',
                fontSize: '0.85rem',
                backgroundColor: sidebarTab === 'sequences' ? '#007bff' : 'transparent',
                color: sidebarTab === 'sequences' ? 'white' : '#007bff',
                border: '1px solid #007bff',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              Sequences
            </button>
            <button
              onClick={() => setSidebarTab('functions')}
              style={{
                padding: '0.4rem 0.8rem',
                fontSize: '0.85rem',
                backgroundColor: sidebarTab === 'functions' ? '#007bff' : 'transparent',
                color: sidebarTab === 'functions' ? 'white' : '#007bff',
                border: '1px solid #007bff',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              Functions
            </button>
          </div>

          {sidebarTab === 'tables' && (
            <>
              <h2 style={{ marginTop: 0, fontSize: '1.1rem', marginBottom: '1rem' }}>Tabellen ({tables.length})</h2>
              {tables.length === 0 ? (
                <p style={{ color: '#666', fontSize: '0.9rem' }}>Keine Tabellen gefunden</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {tables.map((table) => (
                    <button
                      key={table.tableName}
                      onClick={() => handleTableClick(table.tableName)}
                      style={{
                        padding: '0.5rem',
                        textAlign: 'left',
                        backgroundColor: selectedTable === table.tableName ? '#e7f3ff' : 'transparent',
                        border: '1px solid #ddd',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '0.9rem',
                      }}
                    >
                      <div style={{ fontWeight: '600' }}>{table.tableName}</div>
                      <div style={{ fontSize: '0.8rem', color: '#666' }}>{table.columnCount} Spalten</div>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}

          {sidebarTab === 'views' && (
            <>
              <h2 style={{ marginTop: 0, fontSize: '1.1rem', marginBottom: '1rem' }}>Views ({views.length})</h2>
              {views.length === 0 ? (
                <p style={{ color: '#666', fontSize: '0.9rem' }}>Keine Views gefunden</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {views.map((view) => (
                    <div
                      key={view.viewName}
                      style={{
                        padding: '0.5rem',
                        border: '1px solid #ddd',
                        borderRadius: '4px',
                        fontSize: '0.9rem',
                      }}
                    >
                      <div style={{ fontWeight: '600' }}>{view.viewName}</div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {sidebarTab === 'sequences' && (
            <>
              <h2 style={{ marginTop: 0, fontSize: '1.1rem', marginBottom: '1rem' }}>Sequences ({sequences.length})</h2>
              {sequences.length === 0 ? (
                <p style={{ color: '#666', fontSize: '0.9rem' }}>Keine Sequences gefunden</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {sequences.map((seq) => (
                    <div
                      key={seq.sequenceName}
                      style={{
                        padding: '0.5rem',
                        border: '1px solid #ddd',
                        borderRadius: '4px',
                        fontSize: '0.9rem',
                      }}
                    >
                      <div style={{ fontWeight: '600' }}>{seq.sequenceName}</div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {sidebarTab === 'functions' && (
            <>
              <h2 style={{ marginTop: 0, fontSize: '1.1rem', marginBottom: '1rem' }}>Functions ({functions.length})</h2>
              {functions.length === 0 ? (
                <p style={{ color: '#666', fontSize: '0.9rem' }}>Keine Functions gefunden</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {functions.map((func) => (
                    <div
                      key={func.functionName}
                      style={{
                        padding: '0.5rem',
                        border: '1px solid #ddd',
                        borderRadius: '4px',
                        fontSize: '0.9rem',
                      }}
                    >
                      <div style={{ fontWeight: '600' }}>{func.functionName}</div>
                      <div style={{ fontSize: '0.8rem', color: '#666' }}>{func.routineType}</div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Hauptbereich */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', overflow: 'hidden' }}>
          {/* SQL-Editor */}
          <div className="card" style={{ flex: '0 0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.1rem' }}>SQL-Query</h2>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  className="btn"
                  onClick={handleFormatQuery}
                  style={{ fontSize: '0.85rem', padding: '0.4rem 0.8rem' }}
                  title="Query formatieren"
                >
                  Format
                </button>
                <button
                  className="btn"
                  onClick={handleExplainQuery}
                  disabled={executing}
                  style={{ fontSize: '0.85rem', padding: '0.4rem 0.8rem' }}
                  title="EXPLAIN ANALYZE"
                >
                  EXPLAIN
                </button>
                <button
                  className="btn btn-primary"
                  onClick={handleExecuteWithWarning}
                  disabled={executing}
                >
                  {executing ? (
                    <>
                      <span style={{ marginRight: '0.5rem' }}>⏳</span>
                      Ausführen...
                    </>
                  ) : (
                    'Ausführen (Ctrl+Enter)'
                  )}
                </button>
              </div>
            </div>
            <textarea
              ref={queryInputRef}
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              style={{
                width: '100%',
                minHeight: '150px',
                fontFamily: 'monospace',
                fontSize: '0.9rem',
                padding: '0.75rem',
                border: error ? '2px solid #dc3545' : '1px solid #ddd',
                borderRadius: '4px',
                resize: 'vertical',
              }}
              placeholder="SELECT * FROM users LIMIT 10"
            />
            <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', display: 'flex', gap: '1rem' }}>
              {queryHistory.length > 0 && (
                <div>
                  <strong>History:</strong>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', marginTop: '0.25rem' }}>
                    {queryHistory.slice(0, 5).map((hist, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleQueryChange(hist)}
                        style={{
                          padding: '0.25rem 0.5rem',
                          fontSize: '0.8rem',
                          backgroundColor: '#f0f0f0',
                          border: '1px solid #ddd',
                          borderRadius: '3px',
                          cursor: 'pointer',
                        }}
                        title={hist}
                      >
                        {hist.substring(0, 30)}...
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {bookmarks.length > 0 && (
                <div>
                  <strong>Bookmarks:</strong>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', marginTop: '0.25rem' }}>
                    {bookmarks.map((bookmark, idx) => (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <button
                          onClick={() => handleQueryChange(bookmark)}
                          style={{
                            padding: '0.25rem 0.5rem',
                            fontSize: '0.8rem',
                            backgroundColor: '#fff3cd',
                            border: '1px solid #ffc107',
                            borderRadius: '3px',
                            cursor: 'pointer',
                          }}
                          title={bookmark}
                        >
                          {bookmark.substring(0, 30)}...
                        </button>
                        <button
                          onClick={() => deleteBookmark(bookmark)}
                          style={{
                            padding: '0.25rem',
                            fontSize: '0.8rem',
                            backgroundColor: '#f8d7da',
                            border: '1px solid #dc3545',
                            borderRadius: '3px',
                            cursor: 'pointer',
                          }}
                          title="Bookmark löschen"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <button
                onClick={saveBookmark}
                style={{
                  padding: '0.25rem 0.5rem',
                  fontSize: '0.8rem',
                  backgroundColor: '#d4edda',
                  border: '1px solid #28a745',
                  borderRadius: '3px',
                  cursor: 'pointer',
                }}
                title="Aktuelle Query als Bookmark speichern"
              >
                ⭐ Bookmark speichern
              </button>
            </div>
          </div>

          {error && (
            <div
              className="card"
              style={{
                backgroundColor: '#f8d7da',
                color: '#721c24',
                padding: '1rem',
                borderRadius: '4px',
              }}
            >
              <strong>Fehler:</strong> {error}
            </div>
          )}

          {result && (
            <div className="card" style={{ flex: '1 1 auto', overflow: 'auto' }}>
              <div
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}
              >
                <div>
                  <h2 style={{ margin: 0, fontSize: '1.1rem' }}>Ergebnisse</h2>
                  <div
                    style={{
                      fontSize: '0.85rem',
                      color: '#666',
                      marginTop: '0.25rem',
                      display: 'flex',
                      gap: '1rem',
                      flexWrap: 'wrap',
                    }}
                  >
                    <span>
                      <strong>{result.rowCount.toLocaleString()}</strong> Zeilen
                    </span>
                    <span>
                      <strong>{result.executionTimeMs}ms</strong> Ausführungszeit
                    </span>
                    {result.limited && (
                      <span style={{ color: '#ffc107' }}>⚠️ Limitierte Ergebnisse (max. 1000 Zeilen)</span>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    className="btn"
                    onClick={handleExportCSV}
                    style={{ fontSize: '0.85rem', padding: '0.4rem 0.8rem' }}
                  >
                    Export CSV
                  </button>
                  <button
                    className="btn"
                    onClick={handleExportJSON}
                    style={{ fontSize: '0.85rem', padding: '0.4rem 0.8rem' }}
                  >
                    Export JSON
                  </button>
                </div>
              </div>
              {result.rows.length > 0 ? (
                <div>
                  <div style={{ marginBottom: '0.5rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <input
                      type="text"
                      placeholder="Filter Ergebnisse..."
                      value={tableDataFilter}
                      onChange={(e) => setTableDataFilter(e.target.value)}
                      style={{
                        flex: 1,
                        padding: '0.4rem',
                        border: '1px solid #ddd',
                        borderRadius: '4px',
                        fontSize: '0.85rem',
                      }}
                    />
                  </div>
                  <div style={{ overflow: 'auto', maxHeight: '500px' }}>
                    <table className="table" style={{ fontSize: '0.85rem' }}>
                      <thead>
                        <tr>
                          {result.columns.map((col) => (
                            <th
                              key={col}
                              style={{
                                position: 'sticky',
                                top: 0,
                                backgroundColor: '#f8f9fa',
                                cursor: 'pointer',
                              }}
                              onClick={() => {
                                const sorted = [...result.rows].sort((a, b) => {
                                  const aVal = a[col];
                                  const bVal = b[col];
                                  if (aVal === null || aVal === undefined) return 1;
                                  if (bVal === null || bVal === undefined) return -1;
                                  return String(aVal).localeCompare(String(bVal));
                                });
                                setResult({ ...result, rows: sorted });
                              }}
                            >
                              {col} ↕️
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {result.rows
                          .filter((row) => {
                            if (!tableDataFilter) return true;
                            const filter = tableDataFilter.toLowerCase();
                            return result.columns.some((col) =>
                              String(row[col] || '').toLowerCase().includes(filter)
                            );
                          })
                          .map((row, idx) => (
                            <tr key={idx}>
                              {result.columns.map((col) => (
                                <td
                                  key={col}
                                  onClick={() => copyCellValue(row[col])}
                                  style={{ cursor: 'pointer', position: 'relative' }}
                                  title="Klicken zum Kopieren"
                                >
                                  {row[col] === null || row[col] === undefined ? (
                                    <span style={{ color: '#999' }}>NULL</span>
                                  ) : (
                                    String(row[col])
                                  )}
                                </td>
                              ))}
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <p style={{ color: '#666' }}>Keine Ergebnisse</p>
              )}
            </div>
          )}

          {selectedTable && (
            <div className="card" style={{ flex: '1 1 auto', overflow: 'auto' }}>
              <div
                style={{
                  display: 'flex',
                  gap: '0.5rem',
                  marginBottom: '1rem',
                  borderBottom: '1px solid #ddd',
                  paddingBottom: '0.5rem',
                }}
              >
                <button
                  onClick={() => setActiveTab('structure')}
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: activeTab === 'structure' ? '#007bff' : 'transparent',
                    color: activeTab === 'structure' ? 'white' : '#007bff',
                    border: '1px solid #007bff',
                    borderRadius: '4px',
                    cursor: 'pointer',
                  }}
                >
                  Struktur
                </button>
                <button
                  onClick={() => setActiveTab('data')}
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: activeTab === 'data' ? '#007bff' : 'transparent',
                    color: activeTab === 'data' ? 'white' : '#007bff',
                    border: '1px solid #007bff',
                    borderRadius: '4px',
                    cursor: 'pointer',
                  }}
                >
                  Daten
                </button>
              </div>
              <h2 style={{ marginTop: 0, fontSize: '1.1rem' }}>Tabelle: {selectedTable}</h2>

              {activeTab === 'structure' && (
                <div>
                  <div
                    style={{
                      display: 'flex',
                      gap: '0.5rem',
                      marginBottom: '1rem',
                      borderBottom: '1px solid #ddd',
                      paddingBottom: '0.5rem',
                    }}
                  >
                    <button
                      onClick={() => handleStructureTabChange('columns')}
                      style={{
                        padding: '0.4rem 0.8rem',
                        fontSize: '0.85rem',
                        backgroundColor: structureTab === 'columns' ? '#007bff' : 'transparent',
                        color: structureTab === 'columns' ? 'white' : '#007bff',
                        border: '1px solid #007bff',
                        borderRadius: '4px',
                        cursor: 'pointer',
                      }}
                    >
                      Spalten
                    </button>
                    <button
                      onClick={() => handleStructureTabChange('indexes')}
                      style={{
                        padding: '0.4rem 0.8rem',
                        fontSize: '0.85rem',
                        backgroundColor: structureTab === 'indexes' ? '#007bff' : 'transparent',
                        color: structureTab === 'indexes' ? 'white' : '#007bff',
                        border: '1px solid #007bff',
                        borderRadius: '4px',
                        cursor: 'pointer',
                      }}
                    >
                      Indizes
                    </button>
                    <button
                      onClick={() => handleStructureTabChange('foreignKeys')}
                      style={{
                        padding: '0.4rem 0.8rem',
                        fontSize: '0.85rem',
                        backgroundColor: structureTab === 'foreignKeys' ? '#007bff' : 'transparent',
                        color: structureTab === 'foreignKeys' ? 'white' : '#007bff',
                        border: '1px solid #007bff',
                        borderRadius: '4px',
                        cursor: 'pointer',
                      }}
                    >
                      Foreign Keys
                    </button>
                    <button
                      onClick={() => handleStructureTabChange('constraints')}
                      style={{
                        padding: '0.4rem 0.8rem',
                        fontSize: '0.85rem',
                        backgroundColor: structureTab === 'constraints' ? '#007bff' : 'transparent',
                        color: structureTab === 'constraints' ? 'white' : '#007bff',
                        border: '1px solid #007bff',
                        borderRadius: '4px',
                        cursor: 'pointer',
                      }}
                    >
                      Constraints
                    </button>
                    <button
                      onClick={() => handleStructureTabChange('stats')}
                      style={{
                        padding: '0.4rem 0.8rem',
                        fontSize: '0.85rem',
                        backgroundColor: structureTab === 'stats' ? '#007bff' : 'transparent',
                        color: structureTab === 'stats' ? 'white' : '#007bff',
                        border: '1px solid #007bff',
                        borderRadius: '4px',
                        cursor: 'pointer',
                      }}
                    >
                      Statistiken
                    </button>
                  </div>

                  {structureTab === 'columns' && tableStructure && (
                    <table className="table" style={{ fontSize: '0.85rem' }}>
                      <thead>
                        <tr>
                          <th>Spalte</th>
                          <th>Typ</th>
                          <th>Länge</th>
                          <th>Nullable</th>
                          <th>Default</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tableStructure.map((col: any, idx: number) => (
                          <tr key={idx}>
                            <td>{col.columnName}</td>
                            <td>{col.dataType}</td>
                            <td>{col.characterMaximumLength || '-'}</td>
                            <td>{col.isNullable ? 'Ja' : 'Nein'}</td>
                            <td>{col.columnDefault || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}

                  {structureTab === 'indexes' && (
                    <div>
                      {tableIndexes.length === 0 ? (
                        <p style={{ color: '#666' }}>Lade Indizes...</p>
                      ) : (
                        <table className="table" style={{ fontSize: '0.85rem' }}>
                          <thead>
                            <tr>
                              <th>Index-Name</th>
                              <th>Definition</th>
                            </tr>
                          </thead>
                          <tbody>
                            {tableIndexes.map((idx: any, index: number) => (
                              <tr key={index}>
                                <td>{idx.indexName}</td>
                                <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                                  {idx.indexDefinition}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}

                  {structureTab === 'foreignKeys' && (
                    <div>
                      {tableForeignKeys.length === 0 ? (
                        <p style={{ color: '#666' }}>Lade Foreign Keys...</p>
                      ) : (
                        <table className="table" style={{ fontSize: '0.85rem' }}>
                          <thead>
                            <tr>
                              <th>Constraint-Name</th>
                              <th>Spalte</th>
                              <th>Referenz-Tabelle</th>
                              <th>Referenz-Spalte</th>
                            </tr>
                          </thead>
                          <tbody>
                            {tableForeignKeys.map((fk: any, index: number) => (
                              <tr key={index}>
                                <td>{fk.constraintName}</td>
                                <td>{fk.columnName}</td>
                                <td>{fk.foreignTableName}</td>
                                <td>{fk.foreignColumnName}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}

                  {structureTab === 'constraints' && (
                    <div>
                      {tableConstraints.length === 0 ? (
                        <p style={{ color: '#666' }}>Lade Constraints...</p>
                      ) : (
                        <table className="table" style={{ fontSize: '0.85rem' }}>
                          <thead>
                            <tr>
                              <th>Constraint-Name</th>
                              <th>Typ</th>
                            </tr>
                          </thead>
                          <tbody>
                            {tableConstraints.map((constraint: any, index: number) => (
                              <tr key={index}>
                                <td>{constraint.constraintName}</td>
                                <td>{constraint.constraintType}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}

                  {structureTab === 'stats' && (
                    <div>
                      {!tableStats ? (
                        <p style={{ color: '#666' }}>Lade Statistiken...</p>
                      ) : (
                        <table className="table" style={{ fontSize: '0.85rem' }}>
                          <tbody>
                            <tr>
                              <td>
                                <strong>Zeilenanzahl</strong>
                              </td>
                              <td>{tableStats.rowCount?.toLocaleString() ?? '-'}</td>
                            </tr>
                            <tr>
                              <td>
                                <strong>Tabellengröße</strong>
                              </td>
                              <td>{tableStats.tableSize ?? '-'}</td>
                            </tr>
                            <tr>
                              <td>
                                <strong>Gesamtgröße (mit Indizes)</strong>
                              </td>
                              <td>{tableStats.totalSize ?? '-'}</td>
                            </tr>
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'data' && tableData && (
                <div>
                  <div
                    style={{
                      marginBottom: '0.5rem',
                      display: 'flex',
                      gap: '0.5rem',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                    }}
                  >
                    <div style={{ fontSize: '0.85rem', color: '#666' }}>
                      {tableData.total} Zeilen insgesamt (Seite {tableData.page + 1} von {tableData.totalPages})
                    </div>
                    {tableStructure && (
                      <div style={{ marginLeft: 'auto', fontSize: '0.85rem' }}>
                        <strong>Spalten:</strong>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', marginTop: '0.25rem' }}>
                          {tableStructure.map((col: any) => {
                            const isVisible = visibleColumns.has(col.columnName);
                            return (
                              <label
                                key={col.columnName}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.25rem',
                                  padding: '0.25rem 0.5rem',
                                  backgroundColor: isVisible ? '#e7f3ff' : '#f0f0f0',
                                  border: '1px solid #ddd',
                                  borderRadius: '3px',
                                  cursor: 'pointer',
                                  fontSize: '0.8rem',
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={isVisible}
                                  onChange={(e) => {
                                    const newVisible = new Set(visibleColumns);
                                    if (e.target.checked) {
                                      newVisible.add(col.columnName);
                                    } else {
                                      newVisible.delete(col.columnName);
                                    }
                                    setVisibleColumns(newVisible);
                                  }}
                                />
                                {col.columnName}
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                  <div style={{ marginBottom: '0.5rem' }}>
                    <input
                      type="text"
                      placeholder="Filter Tabellendaten..."
                      value={tableDataFilter}
                      onChange={(e) => setTableDataFilter(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '0.4rem',
                        border: '1px solid #ddd',
                        borderRadius: '4px',
                        fontSize: '0.85rem',
                      }}
                    />
                  </div>
                  <div style={{ overflow: 'auto', maxHeight: '400px' }}>
                    <table className="table" style={{ fontSize: '0.85rem' }}>
                      <thead>
                        <tr>
                          {tableData.rows?.length > 0 &&
                            Object.keys(tableData.rows[0])
                              .filter((col) => visibleColumns.size === 0 || visibleColumns.has(col))
                              .map((col) => (
                                <th
                                  key={col}
                                  style={{ cursor: 'pointer' }}
                                  onClick={() => {
                                    const sorted = [...(tableData.rows || [])].sort((a, b) => {
                                      const aVal = a[col];
                                      const bVal = b[col];
                                      if (aVal === null || aVal === undefined) return 1;
                                      if (bVal === null || bVal === undefined) return -1;
                                      return String(aVal).localeCompare(String(bVal));
                                    });
                                    setTableData({ ...tableData, rows: sorted });
                                  }}
                                >
                                  {col} ↕️
                                </th>
                              ))}
                        </tr>
                      </thead>
                      <tbody>
                        {(tableData.rows || [])
                          .filter((row: any) => {
                            if (!tableDataFilter) return true;
                            const filter = tableDataFilter.toLowerCase();
                            return Object.values(row).some((val: any) =>
                              String(val || '').toLowerCase().includes(filter)
                            );
                          })
                          .map((row: any, idx: number) => (
                            <tr key={idx}>
                              {Object.entries(row)
                                .filter(([col]) => visibleColumns.size === 0 || visibleColumns.has(col))
                                .map(([col, val]: [string, any]) => (
                                  <td
                                    key={col}
                                    onClick={() => copyCellValue(val)}
                                    style={{ cursor: 'pointer' }}
                                    title="Klicken zum Kopieren"
                                  >
                                    {val === null || val === undefined ? (
                                      <span style={{ color: '#999' }}>NULL</span>
                                    ) : (
                                      String(val)
                                    )}
                                  </td>
                                ))}
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
