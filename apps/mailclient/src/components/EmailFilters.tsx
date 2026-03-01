'use client';

import { useState, useEffect } from 'react';
import { useToast } from '@/components/ToastProvider';
import { useConfirm } from '@/components/ConfirmDialog';
import { FiPlus, FiSearch, FiEdit, FiCopy, FiTrash2, FiMail, FiCheckCircle, FiAlertTriangle, FiSend } from 'react-icons/fi';
import { FilterIcon, FILTER_ICON_OPTIONS } from '@/components/FilterIcon';

interface EmailFilter {
  id: string;
  name: string;
  icon: string;
  rules: {
    field: 'from' | 'to' | 'subject' | 'body' | 'status' | 'theme' | 'department' | 'completedStatus' | 'type' | 'phone_number' | 'hasNotes' | 'hasAttachments';
    operator: 'contains' | 'equals' | 'startsWith' | 'endsWith' | 'is';
    value: string;
  }[];
  showCount?: boolean;
}

interface EmailTheme {
  id: string;
  name: string;
  color: string | null;
}

interface Department {
  id: string;
  name: string;
  description?: string;
}

interface EmailFiltersProps {
  filters: EmailFilter[];
  onFiltersChange: (filters: EmailFilter[]) => void;
  onSave: () => void;
  saving: boolean;
}

export default function EmailFilters({
  filters,
  onFiltersChange,
  onSave: _onSave,
  saving: _saving,
}: EmailFiltersProps) {
  const toast = useToast();
  const { confirm } = useConfirm();
  const [editingFilter, setEditingFilter] = useState<EmailFilter | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [themes, setThemes] = useState<EmailTheme[]>([]);
  const [loadingThemes, setLoadingThemes] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loadingDepartments, setLoadingDepartments] = useState(false);
  const [savingFilter, setSavingFilter] = useState(false);
  const [iconPickerOpen, setIconPickerOpen] = useState(false);

  const addFilter = () => {
    const newFilter: EmailFilter = {
      id: `filter-${Date.now()}`,
      name: '',
      icon: 'search',
      rules: [
        {
          field: 'subject',
          operator: 'contains',
          value: '',
        },
      ],
      showCount: false,
    };
    setEditingFilter(newFilter);
  };

  const deleteFilter = async (id: string) => {
    if (await confirm({ message: 'Möchten Sie diesen Filter wirklich löschen?', variant: 'danger', confirmLabel: 'Löschen' })) {
      const newFilters = filters.filter((f) => f.id !== id);
      
      // Aktualisiere lokalen State
      onFiltersChange(newFilters);
      
      if (editingFilter?.id === id) {
        setEditingFilter(null);
      }
      
      // Speichere direkt in der Datenbank (wie bei handleSaveEdit)
      setSavingFilter(true);
      try {
        const token = localStorage.getItem('mailclient_token');
        if (!token) {
          toast.showError('Nicht angemeldet. Bitte melden Sie sich erneut an.');
          setSavingFilter(false);
          return;
        }

        const response = await fetch('/api/settings', {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            emailFilters: newFilters.map(f => ({
              ...f,
              showCount: f.showCount === true ? true : false,
            })),
          }),
        });

        if (response.status === 401) {
          localStorage.removeItem('mailclient_token');
          localStorage.removeItem('mailclient_user');
          toast.showError('Session abgelaufen. Bitte melden Sie sich erneut an.');
          setSavingFilter(false);
          return;
        }

        const data = await response.json();

        if (!response.ok) {
          toast.showError(data.error || 'Fehler beim Löschen des Filters');
          setSavingFilter(false);
          return;
        }

        // Löst ein Event aus, um die Sidebar zu aktualisieren
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('filtersUpdated'));
        }, 100);
        
        toast.showSuccess('Filter erfolgreich gelöscht!');
      } catch (err: any) {
        console.error('Fehler beim Löschen des Filters:', err);
        toast.showError('Fehler beim Löschen des Filters');
      } finally {
        setSavingFilter(false);
      }
    }
  };

  const handleEdit = (filter: EmailFilter) => {
    setEditingFilter({ 
      ...filter,
      showCount: filter.showCount === true ? true : false
    });
  };

  const handleDuplicate = (filter: EmailFilter) => {
    const duplicatedFilter: EmailFilter = {
      ...filter,
      id: `filter-${Date.now()}`,
      name: `${filter.name} (Kopie)`,
    };
    setEditingFilter(duplicatedFilter);
  };

  const handleSaveEdit = async () => {
    if (!editingFilter) return;

    if (!editingFilter.name.trim()) {
      toast.showError('Bitte geben Sie einen Filter-Namen ein.');
      return;
    }

    if (editingFilter.rules.length === 0) {
      toast.showError('Bitte geben Sie mindestens einen Workflow ein.');
      return;
    }

    // Validiere jeden Workflow
    for (const rule of editingFilter.rules) {
      if (rule.field === 'status') {
        // Für Status-Filter: Wert muss ein JSON-Array mit mindestens einem Element sein
        if (!rule.value || rule.value.trim() === '') {
          toast.showError('Bitte wählen Sie mindestens einen Status aus.');
          return;
        }
        try {
          const statuses = JSON.parse(rule.value);
          if (!Array.isArray(statuses) || statuses.length === 0) {
            toast.showError('Bitte wählen Sie mindestens einen Status aus.');
            return;
          }
        } catch {
          // Rückwärtskompatibilität: einzelner Wert
          if (!rule.value.trim()) {
            toast.showError('Bitte wählen Sie mindestens einen Status aus.');
            return;
          }
        }
      } else if (rule.field === 'theme') {
        // Für Themen-Filter: Wert muss ein JSON-Array mit mindestens einem Element sein
        if (!rule.value || rule.value.trim() === '') {
          toast.showError('Bitte wählen Sie mindestens ein Thema aus.');
          return;
        }
        try {
          const themeIds = JSON.parse(rule.value);
          if (!Array.isArray(themeIds) || themeIds.length === 0) {
            toast.showError('Bitte wählen Sie mindestens ein Thema aus.');
            return;
          }
        } catch {
          // Rückwärtskompatibilität: einzelner Wert
          if (!rule.value.trim()) {
            toast.showError('Bitte wählen Sie mindestens ein Thema aus.');
            return;
          }
        }
      } else if (rule.field === 'department') {
        // Für Abteilungs-Filter: Wert muss ein JSON-Array mit mindestens einem Element sein
        if (!rule.value || rule.value.trim() === '') {
          toast.showError('Bitte wählen Sie mindestens eine Abteilung aus.');
          return;
        }
        try {
          const departmentIds = JSON.parse(rule.value);
          if (!Array.isArray(departmentIds) || departmentIds.length === 0) {
            toast.showError('Bitte wählen Sie mindestens eine Abteilung aus.');
            return;
          }
        } catch {
          // Rückwärtskompatibilität: einzelner Wert
          if (!rule.value.trim()) {
            toast.showError('Bitte wählen Sie mindestens eine Abteilung aus.');
            return;
          }
        }
      } else if (rule.field === 'type') {
        // Für Typ-Filter: Wert muss 'email' oder 'phone_note' sein
        if (!rule.value || (rule.value !== 'email' && rule.value !== 'phone_note')) {
          toast.showError('Bitte wählen Sie einen Typ aus.');
          return;
        }
      } else if (rule.field === 'phone_number') {
        // Für Telefonnummer-Filter: Wert muss nicht leer sein
        if (!rule.value || !rule.value.trim()) {
          toast.showError('Bitte geben Sie eine Telefonnummer ein.');
          return;
        }
      } else if (rule.field === 'hasNotes') {
        // Für Kommentar-Filter: Wert muss 'yes' oder 'no' sein
        if (!rule.value || (rule.value !== 'yes' && rule.value !== 'no')) {
          toast.showError('Bitte wählen Sie „Hat Kommentare“ oder „Ohne Kommentare“.');
          return;
        }
      } else if (rule.field === 'hasAttachments') {
        // Für Anhänge-Filter: Wert muss 'yes' oder 'no' sein
        if (!rule.value || (rule.value !== 'yes' && rule.value !== 'no')) {
          toast.showError('Bitte wählen Sie „Mit Anhängen“ oder „Ohne Anhänge“.');
          return;
        }
      } else {
        // Für Text-Filter: Wert muss nicht leer sein
        if (!rule.value || !rule.value.trim()) {
          toast.showError('Bitte geben Sie einen Wert für den Workflow ein.');
          return;
        }
      }
    }

    const existingIndex = filters.findIndex((f) => f.id === editingFilter.id);
    // Stelle sicher, dass showCount explizit gesetzt ist (true oder false, nie undefined)
    const filterToSave: EmailFilter = {
      ...editingFilter,
      showCount: editingFilter.showCount === true ? true : false,
    };
    
    // Aktualisiere lokalen State
    let updatedFilters: EmailFilter[];
    if (existingIndex >= 0) {
      // Filter aktualisieren - verwende das gesamte Objekt, nicht nur Updates
      updatedFilters = filters.map((f) => (f.id === editingFilter.id ? filterToSave : f));
    } else {
      // Neuer Filter
      updatedFilters = [...filters, filterToSave];
    }
    
    // Aktualisiere lokalen State
    onFiltersChange(updatedFilters);
    
    // Speichere direkt in der Datenbank
    setSavingFilter(true);
    try {
      const token = localStorage.getItem('mailclient_token');
      if (!token) {
        toast.showError('Nicht angemeldet. Bitte melden Sie sich erneut an.');
        setSavingFilter(false);
        return;
      }

      const response = await fetch('/api/settings', {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          emailFilters: updatedFilters.map(f => ({
            ...f,
            showCount: f.showCount === true ? true : false,
          })),
        }),
      });

      if (response.status === 401) {
        localStorage.removeItem('mailclient_token');
        localStorage.removeItem('mailclient_user');
        toast.showError('Session abgelaufen. Bitte melden Sie sich erneut an.');
        setSavingFilter(false);
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        toast.showError(data.error || 'Fehler beim Speichern des Filters');
        setSavingFilter(false);
        return;
      }

      // Löst ein Event aus, um die Sidebar zu aktualisieren
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('filtersUpdated'));
      }, 100);
      
      setEditingFilter(null);
    } catch (err: any) {
      console.error('Fehler beim Speichern des Filters:', err);
      toast.showError('Fehler beim Speichern des Filters');
    } finally {
      setSavingFilter(false);
    }
  };

  const handleCancelEdit = () => {
    setIconPickerOpen(false);
    setEditingFilter(null);
  };

  const addRule = () => {
    if (!editingFilter) return;
    setEditingFilter({
      ...editingFilter,
      rules: [
        ...editingFilter.rules,
        {
          field: 'subject',
          operator: 'contains',
          value: '',
        },
      ],
    });
  };

  const updateRule = (ruleIndex: number, updates: Partial<EmailFilter['rules'][0]>) => {
    if (!editingFilter) return;
    const newRules = [...editingFilter.rules];
    newRules[ruleIndex] = { ...newRules[ruleIndex], ...updates };
    setEditingFilter({ ...editingFilter, rules: newRules });
  };

  const deleteRule = (ruleIndex: number) => {
    if (!editingFilter) return;
    if (editingFilter.rules.length <= 1) {
      toast.showWarning('Ein Filter muss mindestens einen Workflow haben.');
      return;
    }
    const newRules = editingFilter.rules.filter((_, i) => i !== ruleIndex);
    setEditingFilter({ ...editingFilter, rules: newRules });
  };

  // Drag & Drop Handler
  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    const newFilters = [...filters];
    const draggedFilter = newFilters[draggedIndex];
    newFilters.splice(draggedIndex, 1);
    newFilters.splice(dropIndex, 0, draggedFilter);
    onFiltersChange(newFilters);

    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  // Lade Themen beim Mount
  useEffect(() => {
    const loadThemes = async () => {
      try {
        setLoadingThemes(true);
        const token = localStorage.getItem('mailclient_token');
        if (!token) {
          console.warn('Kein Token gefunden, kann Themen nicht laden');
          return;
        }

        const response = await fetch('/api/themes', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.status === 401) {
          console.warn('Nicht autorisiert, kann Themen nicht laden');
          return;
        }

        if (!response.ok) {
          const data = await response.json();
          console.error('Fehler beim Laden der Themen:', data.error);
          return;
        }

        const data = await response.json();
        setThemes(data.themes || []);
      } catch (err) {
        console.error('Fehler beim Laden der Themen:', err);
      } finally {
        setLoadingThemes(false);
      }
    };

    loadThemes();
  }, []);

  // Lade Abteilungen beim Mount
  useEffect(() => {
    const loadDepartments = async () => {
      try {
        setLoadingDepartments(true);
        const token = localStorage.getItem('mailclient_token');
        if (!token) {
          console.warn('Kein Token gefunden, kann Abteilungen nicht laden');
          return;
        }

        const response = await fetch('/api/departments', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.status === 401) {
          console.warn('Nicht autorisiert, kann Abteilungen nicht laden');
          return;
        }

        if (response.status === 403) {
          // User ist kein Admin, kann Abteilungen nicht sehen
          console.warn('Keine Berechtigung, kann Abteilungen nicht laden');
          setDepartments([]);
          return;
        }

        if (!response.ok) {
          const data = await response.json();
          console.error('Fehler beim Laden der Abteilungen:', data.error);
          return;
        }

        const data = await response.json();
        setDepartments(data.departments || []);
      } catch (err) {
        console.error('Fehler beim Laden der Abteilungen:', err);
      } finally {
        setLoadingDepartments(false);
      }
    };

    loadDepartments();
  }, []);

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '600' }}>
          E-Mail-Filter
        </h2>
        <button
          onClick={addFilter}
          className="btn btn-primary"
          style={{ fontSize: '0.875rem', padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
        >
          <FiPlus size={16} />
          <span>Filter hinzufügen</span>
        </button>
      </div>

      {filters.length === 0 && !editingFilter ? (
        <div className="empty-state">
          <div className="empty-state-icon" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <FiSearch size={48} style={{ color: '#6c757d' }} />
          </div>
          <div className="empty-state-title">Keine Filter vorhanden</div>
          <div className="empty-state-text">
            Erstellen Sie Filter, um E-Mails automatisch zu organisieren.
          </div>
          <button
            onClick={addFilter}
            className="btn btn-primary"
            style={{ marginTop: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <FiPlus size={16} />
            <span>Ersten Filter erstellen</span>
          </button>
        </div>
      ) : (
        <>
          {/* Filter-Liste */}
          {filters.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.5rem' }}>
              {filters.map((filter, index) => {
                const isEditing = editingFilter && editingFilter.id === filter.id;
                
                if (isEditing) {
                  // Inline-Bearbeitungsformular
                  return (
                    <div
                      key={filter.id}
                      style={{
                        padding: '1.5rem',
                        border: '2px solid #007bff',
                        borderRadius: '8px',
                        backgroundColor: '#f8f9fa',
                      }}
                    >
                      <h3 style={{ marginTop: 0, marginBottom: '1rem', fontSize: '1.125rem', fontWeight: '600' }}>
                        Filter bearbeiten
                      </h3>

              <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.875rem', fontWeight: '600', color: '#6c757d', marginRight: '0.25rem' }}>Symbol:</span>
                  <button
                    type="button"
                    onClick={() => setIconPickerOpen(true)}
                    style={{
                      padding: '0.5rem 0.75rem',
                      border: '1px solid #ddd',
                      borderRadius: '6px',
                      background: '#fff',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                    }}
                    title="Symbol auswählen"
                  >
                    <FilterIcon icon={editingFilter.icon} size={22} style={{ color: '#6c757d' }} />
                    <span style={{ fontSize: '0.875rem', color: '#6c757d' }}>Symbol wählen</span>
                  </button>
                </div>
                <input
                  type="text"
                  value={editingFilter.name}
                  onChange={(e) => setEditingFilter({ ...editingFilter, name: e.target.value })}
                  className="input"
                  placeholder="Filter-Name (z.B. Wichtig, Arbeit)"
                  style={{ flex: 1, minWidth: '200px' }}
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.875rem' }}>
                  <input
                    type="checkbox"
                    checked={editingFilter.showCount === true}
                    onChange={(e) => setEditingFilter({ ...editingFilter, showCount: e.target.checked })}
                    style={{ cursor: 'pointer' }}
                  />
                  <span>Mail-Anzahl in Klammern nach dem Filternamen anzeigen</span>
                </label>
              </div>

              <div style={{ marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: '600', color: '#6c757d' }}>
                Workflows:
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem' }}>
                {editingFilter.rules.map((rule, ruleIndex) => (
                  <div
                    key={ruleIndex}
                    style={{
                      display: 'flex',
                      gap: '0.5rem',
                      alignItems: 'center',
                      padding: '0.75rem',
                      backgroundColor: 'white',
                      borderRadius: '4px',
                      border: '1px solid #e9ecef',
                    }}
                  >
                    <select
                      value={rule.field}
                      onChange={(e) => {
                        const newField = e.target.value as EmailFilter['rules'][0]['field'];
                        const newValue = newField === 'completedStatus' ? (rule.value || 'all') : (newField === 'hasNotes' || newField === 'hasAttachments') ? ((rule.value === 'yes' || rule.value === 'no') ? rule.value : 'yes') : rule.value;
                        updateRule(ruleIndex, {
                          field: newField,
                          operator: (newField === 'status' || newField === 'theme' || newField === 'department' || newField === 'completedStatus' || newField === 'type' || newField === 'hasNotes' || newField === 'hasAttachments') ? 'is' : rule.operator === 'is' ? 'contains' : rule.operator,
                          value: newValue,
                        });
                      }}
                      className="select"
                      style={{ flex: '0 0 120px' }}
                    >
                      <option value="from">Von</option>
                      <option value="to">An</option>
                      <option value="subject">Betreff</option>
                      <option value="body">Inhalt</option>
                      <option value="status">Status</option>
                      <option value="completedStatus">Erledigt-Status</option>
                      <option value="theme">Thema</option>
                      <option value="department">Abteilung</option>
                      <option value="type">Typ</option>
                      <option value="phone_number">Telefonnummer</option>
                      <option value="hasNotes">Kommentare</option>
                      <option value="hasAttachments">Anhänge</option>
                    </select>
                    {rule.field === 'type' ? (
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <label style={{ fontSize: '0.75rem', fontWeight: '600', color: '#6c757d' }}>
                          Typ auswählen:
                        </label>
                        <select
                          value={rule.value || 'email'}
                          onChange={(e) => updateRule(ruleIndex, { value: e.target.value })}
                          className="select"
                          style={{ flex: 1 }}
                        >
                          <option value="email">E-Mail</option>
                          <option value="phone_note">Telefonnotiz</option>
                        </select>
                      </div>
                    ) : rule.field === 'hasNotes' ? (
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <label style={{ fontSize: '0.75rem', fontWeight: '600', color: '#6c757d' }}>
                          Kommentare:
                        </label>
                        <select
                          value={rule.value || 'yes'}
                          onChange={(e) => updateRule(ruleIndex, { value: e.target.value })}
                          className="select"
                          style={{ flex: 1 }}
                        >
                          <option value="yes">Hat Kommentare</option>
                          <option value="no">Ohne Kommentare</option>
                        </select>
                      </div>
                    ) : rule.field === 'hasAttachments' ? (
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <label style={{ fontSize: '0.75rem', fontWeight: '600', color: '#6c757d' }}>
                          Anhänge:
                        </label>
                        <select
                          value={rule.value || 'yes'}
                          onChange={(e) => updateRule(ruleIndex, { value: e.target.value })}
                          className="select"
                          style={{ flex: 1 }}
                        >
                          <option value="yes">Mit Anhängen</option>
                          <option value="no">Ohne Anhänge</option>
                        </select>
                      </div>
                    ) : rule.field === 'phone_number' ? (
                      <>
                        <select
                          value={rule.operator}
                          onChange={(e) =>
                            updateRule(ruleIndex, {
                              operator: e.target.value as EmailFilter['rules'][0]['operator'],
                            })
                          }
                          className="select"
                          style={{ flex: '0 0 150px' }}
                        >
                          <option value="contains">enthält</option>
                          <option value="equals">ist gleich</option>
                          <option value="startsWith">beginnt mit</option>
                          <option value="endsWith">endet mit</option>
                        </select>
                        <input
                          type="text"
                          value={rule.value}
                          onChange={(e) =>
                            updateRule(ruleIndex, { value: e.target.value })
                          }
                          className="input"
                          placeholder="Telefonnummer eingeben..."
                          style={{ flex: 1 }}
                        />
                      </>
                    ) : rule.field === 'status' ? (
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '0.5rem', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: '600', color: '#6c757d', marginBottom: '0.25rem' }}>
                          Status auswählen:
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
                          {['ungelesen', 'gelesen', 'gelöscht', 'spam', 'gesendet'].map((status) => {
                            // Parse den aktuellen Wert als JSON-Array, falls vorhanden
                            let selectedStatuses: string[] = [];
                            try {
                              if (rule.value) {
                                selectedStatuses = JSON.parse(rule.value);
                              }
                            } catch {
                              // Falls kein JSON, versuche als einzelnen Wert zu behandeln (für Rückwärtskompatibilität)
                              if (rule.value) {
                                selectedStatuses = [rule.value];
                              }
                            }
                            const isChecked = selectedStatuses.includes(status);
                            
                            return (
                              <label
                                key={status}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.5rem',
                                  cursor: 'pointer',
                                  fontSize: '0.875rem',
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={(e) => {
                                    let newStatuses: string[] = [];
                                    try {
                                      if (rule.value) {
                                        newStatuses = JSON.parse(rule.value);
                                      }
                                    } catch {
                                      if (rule.value) {
                                        newStatuses = [rule.value];
                                      }
                                    }
                                    
                                    if (e.target.checked) {
                                      // Status hinzufügen
                                      if (!newStatuses.includes(status)) {
                                        newStatuses.push(status);
                                      }
                                    } else {
                                      // Status entfernen
                                      newStatuses = newStatuses.filter(s => s !== status);
                                    }
                                    
                                    updateRule(ruleIndex, { 
                                      value: newStatuses.length > 0 ? JSON.stringify(newStatuses) : '' 
                                    });
                                  }}
                                  style={{ cursor: 'pointer' }}
                                />
                                <span style={{ 
                                  textTransform: 'capitalize',
                                  color: isChecked ? '#007bff' : '#333'
                                }}>
                                  {status === 'ungelesen' ? (
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                      <FiMail size={14} style={{ color: '#2563EB' }} />
                                      <span>Ungelesen</span>
                                    </span>
                                  ) : status === 'gelesen' ? (
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                      <FiCheckCircle size={14} style={{ color: '#10B981' }} />
                                      <span>Gelesen</span>
                                    </span>
                                  ) : status === 'gelöscht' ? (
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                      <FiTrash2 size={14} style={{ color: '#DC2626' }} />
                                      <span>Gelöscht</span>
                                    </span>
                                  ) : status === 'spam' ? (
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                      <FiAlertTriangle size={14} style={{ color: '#DC2626' }} />
                                      <span>Spam</span>
                                    </span>
                                  ) : status === 'gesendet' ? (
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                      <FiSend size={14} style={{ color: '#2563EB' }} />
                                      <span>Gesendet</span>
                                    </span>
                                  ) : status}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    ) : rule.field === 'completedStatus' ? (
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <label style={{ fontSize: '0.75rem', fontWeight: '600', color: '#6c757d' }}>
                          Erledigt-Status:
                        </label>
                        <select
                          value={rule.value || 'all'}
                          onChange={(e) => updateRule(ruleIndex, { value: e.target.value })}
                          className="select"
                          style={{ flex: 1 }}
                        >
                          <option value="all">Alle</option>
                          <option value="completed">Nur erledigte</option>
                          <option value="uncompleted">Nur unerledigte</option>
                        </select>
                      </div>
                    ) : rule.field === 'theme' ? (
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '0.5rem', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: '600', color: '#6c757d', marginBottom: '0.25rem' }}>
                          Themen auswählen:
                        </div>
                        {loadingThemes ? (
                          <div style={{ fontSize: '0.875rem', color: '#6c757d' }}>Lade Themen...</div>
                        ) : themes.length === 0 ? (
                          <div style={{ fontSize: '0.875rem', color: '#6c757d' }}>Keine Themen vorhanden</div>
                        ) : (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
                            {themes.map((theme) => {
                              // Parse den aktuellen Wert als JSON-Array, falls vorhanden
                              let selectedThemes: string[] = [];
                              try {
                                if (rule.value) {
                                  selectedThemes = JSON.parse(rule.value);
                                }
                              } catch {
                                // Falls kein JSON, versuche als einzelnen Wert zu behandeln
                                if (rule.value) {
                                  selectedThemes = [rule.value];
                                }
                              }
                              const isChecked = selectedThemes.includes(theme.id);
                              
                              return (
                                <label
                                  key={theme.id}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    cursor: 'pointer',
                                    fontSize: '0.875rem',
                                  }}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={(e) => {
                                      let newThemes: string[] = [];
                                      try {
                                        if (rule.value) {
                                          newThemes = JSON.parse(rule.value);
                                        }
                                      } catch {
                                        if (rule.value) {
                                          newThemes = [rule.value];
                                        }
                                      }
                                      
                                      if (e.target.checked) {
                                        // Thema hinzufügen
                                        if (!newThemes.includes(theme.id)) {
                                          newThemes.push(theme.id);
                                        }
                                      } else {
                                        // Thema entfernen
                                        newThemes = newThemes.filter(t => t !== theme.id);
                                      }
                                      
                                      updateRule(ruleIndex, { 
                                        value: newThemes.length > 0 ? JSON.stringify(newThemes) : '' 
                                      });
                                    }}
                                    style={{ cursor: 'pointer' }}
                                  />
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    {theme.color && (
                                      <div
                                        style={{
                                          width: '16px',
                                          height: '16px',
                                          borderRadius: '3px',
                                          backgroundColor: theme.color,
                                          border: '1px solid #ddd',
                                          flexShrink: 0,
                                        }}
                                      />
                                    )}
                                    <span style={{ 
                                      color: isChecked ? '#007bff' : '#333'
                                    }}>
                                      {theme.name}
                                    </span>
                                  </div>
                                </label>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    ) : rule.field === 'department' ? (
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '0.5rem', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: '600', color: '#6c757d', marginBottom: '0.25rem' }}>
                          Abteilungen auswählen:
                        </div>
                        {loadingDepartments ? (
                          <div style={{ fontSize: '0.875rem', color: '#6c757d' }}>Lade Abteilungen...</div>
                        ) : departments.length === 0 ? (
                          <div style={{ fontSize: '0.875rem', color: '#6c757d' }}>Keine Abteilungen vorhanden</div>
                        ) : (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
                            {departments.map((department) => {
                              // Parse den aktuellen Wert als JSON-Array, falls vorhanden
                              let selectedDepartments: string[] = [];
                              try {
                                if (rule.value) {
                                  selectedDepartments = JSON.parse(rule.value);
                                }
                              } catch {
                                // Falls kein JSON, versuche als einzelnen Wert zu behandeln
                                if (rule.value) {
                                  selectedDepartments = [rule.value];
                                }
                              }
                              const isChecked = selectedDepartments.includes(department.id);
                              
                              return (
                                <label
                                  key={department.id}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    cursor: 'pointer',
                                    fontSize: '0.875rem',
                                  }}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={(e) => {
                                      let newDepartments: string[] = [];
                                      try {
                                        if (rule.value) {
                                          newDepartments = JSON.parse(rule.value);
                                        }
                                      } catch {
                                        if (rule.value) {
                                          newDepartments = [rule.value];
                                        }
                                      }
                                      
                                      if (e.target.checked) {
                                        // Abteilung hinzufügen
                                        if (!newDepartments.includes(department.id)) {
                                          newDepartments.push(department.id);
                                        }
                                      } else {
                                        // Abteilung entfernen
                                        newDepartments = newDepartments.filter(d => d !== department.id);
                                      }
                                      
                                      updateRule(ruleIndex, { 
                                        value: newDepartments.length > 0 ? JSON.stringify(newDepartments) : '' 
                                      });
                                    }}
                                    style={{ cursor: 'pointer' }}
                                  />
                                  <span style={{ 
                                    color: isChecked ? '#007bff' : '#333'
                                  }}>
                                    🏢 {department.name}
                                  </span>
                                </label>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    ) : (
                      <>
                        <select
                          value={rule.operator}
                          onChange={(e) =>
                            updateRule(ruleIndex, {
                              operator: e.target.value as EmailFilter['rules'][0]['operator'],
                            })
                          }
                          className="select"
                          style={{ flex: '0 0 150px' }}
                        >
                          <option value="contains">enthält</option>
                          <option value="equals">ist gleich</option>
                          <option value="startsWith">beginnt mit</option>
                          <option value="endsWith">endet mit</option>
                        </select>
                        <input
                          type="text"
                          value={rule.value}
                          onChange={(e) =>
                            updateRule(ruleIndex, { value: e.target.value })
                          }
                          className="input"
                          placeholder="Wert eingeben..."
                          style={{ flex: 1 }}
                        />
                      </>
                    )}
                    {editingFilter.rules.length > 1 && (
                      <button
                        onClick={() => deleteRule(ruleIndex)}
                        className="btn btn-danger"
                        style={{ fontSize: '0.875rem', padding: '0.5rem' }}
                        title="Workflow löschen"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
                <button
                  onClick={addRule}
                  className="btn btn-secondary"
                  style={{ fontSize: '0.875rem', padding: '0.5rem 1rem', alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                >
                  <FiPlus size={16} />
                  <span>Workflow hinzufügen</span>
                </button>
              </div>

                      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                        <button
                          onClick={handleCancelEdit}
                          className="btn btn-secondary"
                          style={{ fontSize: '0.875rem', padding: '0.5rem 1rem' }}
                        >
                          Abbrechen
                        </button>
                        <button
                          onClick={handleSaveEdit}
                          disabled={savingFilter}
                          className="btn btn-primary"
                          style={{ fontSize: '0.875rem', padding: '0.5rem 1rem' }}
                        >
                          {savingFilter ? (
                            <>
                              <div className="spinner" style={{ width: '14px', height: '14px', borderWidth: '2px', marginRight: '0.5rem', display: 'inline-block' }}></div>
                              Speichern...
                            </>
                          ) : (
                            'Speichern'
                          )}
                        </button>
                      </div>
                    </div>
                  );
                }
                
                // Normale Filter-Anzeige
                return (
                  <div
                    key={filter.id}
                    draggable={!editingFilter}
                    onDragStart={() => !editingFilter && handleDragStart(index)}
                    onDragOver={(e) => !editingFilter && handleDragOver(e, index)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => !editingFilter && handleDrop(e, index)}
                    onDragEnd={handleDragEnd}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '1rem',
                      padding: '1rem',
                      border: '1px solid #e9ecef',
                      borderRadius: '8px',
                      backgroundColor: dragOverIndex === index ? '#e7f3ff' : draggedIndex === index ? '#f0f0f0' : '#fff',
                      cursor: editingFilter ? 'default' : 'move',
                      opacity: draggedIndex === index ? 0.5 : 1,
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <div style={{ 
                      fontSize: '1.25rem', 
                      cursor: editingFilter ? 'default' : 'grab',
                      userSelect: 'none',
                    }}>
                      ⋮⋮
                    </div>
                    <div style={{ fontSize: '1.5rem', flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                      <FilterIcon icon={filter.icon} size={24} style={{ color: '#6c757d' }} />
                    </div>
                    <div style={{ flex: 1, fontWeight: '500' }}>
                      {filter.name || 'Unbenannter Filter'}
                    </div>
                    <div style={{ fontSize: '0.875rem', color: '#6c757d' }}>
                      {filter.rules.length} {filter.rules.length === 1 ? 'Workflow' : 'Workflows'}
                    </div>
                    <button
                      onClick={() => handleEdit(filter)}
                      className="btn btn-secondary"
                      style={{ fontSize: '0.875rem', padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                      disabled={!!editingFilter}
                    >
                      <FiEdit size={16} />
                      <span>Bearbeiten</span>
                    </button>
                    <button
                      onClick={() => handleDuplicate(filter)}
                      className="btn btn-secondary"
                      style={{ fontSize: '0.875rem', padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                      disabled={!!editingFilter}
                    >
                      <FiCopy size={16} />
                      <span>Duplizieren</span>
                    </button>
                    <button
                      onClick={() => deleteFilter(filter.id)}
                      className="btn btn-danger"
                      style={{ fontSize: '0.875rem', padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                      disabled={!!editingFilter}
                    >
                      <FiTrash2 size={16} />
                      <span>Löschen</span>
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Neuer Filter - Inline-Formular am Ende */}
          {editingFilter && !filters.find(f => f.id === editingFilter.id) && (
            <div style={{
              padding: '1.5rem',
              border: '2px solid #007bff',
              borderRadius: '8px',
              backgroundColor: '#f8f9fa',
              marginBottom: '1.5rem',
            }}>
              <h3 style={{ marginTop: 0, marginBottom: '1rem', fontSize: '1.125rem', fontWeight: '600' }}>
                Neuer Filter
              </h3>

              <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.875rem', fontWeight: '600', color: '#6c757d', marginRight: '0.25rem' }}>Symbol:</span>
                  <button
                    type="button"
                    onClick={() => setIconPickerOpen(true)}
                    style={{
                      padding: '0.5rem 0.75rem',
                      border: '1px solid #ddd',
                      borderRadius: '6px',
                      background: '#fff',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                    }}
                    title="Symbol auswählen"
                  >
                    <FilterIcon icon={editingFilter.icon} size={22} style={{ color: '#6c757d' }} />
                    <span style={{ fontSize: '0.875rem', color: '#6c757d' }}>Symbol wählen</span>
                  </button>
                </div>
                <input
                  type="text"
                  value={editingFilter.name}
                  onChange={(e) => setEditingFilter({ ...editingFilter, name: e.target.value })}
                  className="input"
                  placeholder="Filter-Name (z.B. Wichtig, Arbeit)"
                  style={{ flex: 1, minWidth: '200px' }}
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.875rem' }}>
                  <input
                    type="checkbox"
                    checked={editingFilter.showCount === true}
                    onChange={(e) => setEditingFilter({ ...editingFilter, showCount: e.target.checked })}
                    style={{ cursor: 'pointer' }}
                  />
                  <span>Mail-Anzahl in Klammern nach dem Filternamen anzeigen</span>
                </label>
              </div>

              <div style={{ marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: '600', color: '#6c757d' }}>
                Workflows:
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem' }}>
                {editingFilter.rules.map((rule, ruleIndex) => (
                  <div
                    key={ruleIndex}
                    style={{
                      display: 'flex',
                      gap: '0.5rem',
                      alignItems: 'center',
                      padding: '0.75rem',
                      backgroundColor: 'white',
                      borderRadius: '4px',
                      border: '1px solid #e9ecef',
                    }}
                  >
                    <select
                      value={rule.field}
                      onChange={(e) => {
                        const newField = e.target.value as EmailFilter['rules'][0]['field'];
                        const newValue = newField === 'completedStatus' ? (rule.value || 'all') : (newField === 'hasNotes' || newField === 'hasAttachments') ? ((rule.value === 'yes' || rule.value === 'no') ? rule.value : 'yes') : rule.value;
                        updateRule(ruleIndex, {
                          field: newField,
                          operator: (newField === 'status' || newField === 'theme' || newField === 'department' || newField === 'completedStatus' || newField === 'type' || newField === 'hasNotes' || newField === 'hasAttachments') ? 'is' : rule.operator === 'is' ? 'contains' : rule.operator,
                          value: newValue,
                        });
                      }}
                      className="select"
                      style={{ flex: '0 0 120px' }}
                    >
                      <option value="from">Von</option>
                      <option value="to">An</option>
                      <option value="subject">Betreff</option>
                      <option value="body">Inhalt</option>
                      <option value="status">Status</option>
                      <option value="completedStatus">Erledigt-Status</option>
                      <option value="theme">Thema</option>
                      <option value="department">Abteilung</option>
                      <option value="type">Typ</option>
                      <option value="phone_number">Telefonnummer</option>
                      <option value="hasNotes">Kommentare</option>
                      <option value="hasAttachments">Anhänge</option>
                    </select>
                    {rule.field === 'type' ? (
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <label style={{ fontSize: '0.75rem', fontWeight: '600', color: '#6c757d' }}>
                          Typ auswählen:
                        </label>
                        <select
                          value={rule.value || 'email'}
                          onChange={(e) => updateRule(ruleIndex, { value: e.target.value })}
                          className="select"
                          style={{ flex: 1 }}
                        >
                          <option value="email">E-Mail</option>
                          <option value="phone_note">Telefonnotiz</option>
                        </select>
                      </div>
                    ) : rule.field === 'phone_number' ? (
                      <>
                        <select
                          value={rule.operator}
                          onChange={(e) =>
                            updateRule(ruleIndex, {
                              operator: e.target.value as EmailFilter['rules'][0]['operator'],
                            })
                          }
                          className="select"
                          style={{ flex: '0 0 150px' }}
                        >
                          <option value="contains">enthält</option>
                          <option value="equals">ist gleich</option>
                          <option value="startsWith">beginnt mit</option>
                          <option value="endsWith">endet mit</option>
                        </select>
                        <input
                          type="text"
                          value={rule.value}
                          onChange={(e) =>
                            updateRule(ruleIndex, { value: e.target.value })
                          }
                          className="input"
                          placeholder="Telefonnummer eingeben..."
                          style={{ flex: 1 }}
                        />
                      </>
                    ) : rule.field === 'hasNotes' ? (
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <label style={{ fontSize: '0.75rem', fontWeight: '600', color: '#6c757d' }}>
                          Kommentare:
                        </label>
                        <select
                          value={rule.value || 'yes'}
                          onChange={(e) => updateRule(ruleIndex, { value: e.target.value })}
                          className="select"
                          style={{ flex: 1 }}
                        >
                          <option value="yes">Hat Kommentare</option>
                          <option value="no">Ohne Kommentare</option>
                        </select>
                      </div>
                    ) : rule.field === 'hasAttachments' ? (
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <label style={{ fontSize: '0.75rem', fontWeight: '600', color: '#6c757d' }}>
                          Anhänge:
                        </label>
                        <select
                          value={rule.value || 'yes'}
                          onChange={(e) => updateRule(ruleIndex, { value: e.target.value })}
                          className="select"
                          style={{ flex: 1 }}
                        >
                          <option value="yes">Mit Anhängen</option>
                          <option value="no">Ohne Anhänge</option>
                        </select>
                      </div>
                    ) : rule.field === 'status' ? (
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '0.5rem', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: '600', color: '#6c757d', marginBottom: '0.25rem' }}>
                          Status auswählen:
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
                          {['ungelesen', 'gelesen', 'gelöscht', 'spam', 'gesendet'].map((status) => {
                            let selectedStatuses: string[] = [];
                            try {
                              if (rule.value) {
                                selectedStatuses = JSON.parse(rule.value);
                              }
                            } catch {
                              if (rule.value) {
                                selectedStatuses = [rule.value];
                              }
                            }
                            const isChecked = selectedStatuses.includes(status);
                            
                            return (
                              <label
                                key={status}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.5rem',
                                  cursor: 'pointer',
                                  fontSize: '0.875rem',
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={(e) => {
                                    let newStatuses: string[] = [];
                                    try {
                                      if (rule.value) {
                                        newStatuses = JSON.parse(rule.value);
                                      }
                                    } catch {
                                      if (rule.value) {
                                        newStatuses = [rule.value];
                                      }
                                    }
                                    
                                    if (e.target.checked) {
                                      if (!newStatuses.includes(status)) {
                                        newStatuses.push(status);
                                      }
                                    } else {
                                      newStatuses = newStatuses.filter(s => s !== status);
                                    }
                                    
                                    updateRule(ruleIndex, { 
                                      value: newStatuses.length > 0 ? JSON.stringify(newStatuses) : '' 
                                    });
                                  }}
                                  style={{ cursor: 'pointer' }}
                                />
                                <span style={{ 
                                  textTransform: 'capitalize',
                                  color: isChecked ? '#007bff' : '#333'
                                }}>
                                  {status === 'ungelesen' ? (
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                      <FiMail size={14} style={{ color: '#2563EB' }} />
                                      <span>Ungelesen</span>
                                    </span>
                                  ) : status === 'gelesen' ? (
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                      <FiCheckCircle size={14} style={{ color: '#10B981' }} />
                                      <span>Gelesen</span>
                                    </span>
                                  ) : status === 'gelöscht' ? (
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                      <FiTrash2 size={14} style={{ color: '#DC2626' }} />
                                      <span>Gelöscht</span>
                                    </span>
                                  ) : status === 'spam' ? (
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                      <FiAlertTriangle size={14} style={{ color: '#DC2626' }} />
                                      <span>Spam</span>
                                    </span>
                                  ) : status === 'gesendet' ? (
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                      <FiSend size={14} style={{ color: '#2563EB' }} />
                                      <span>Gesendet</span>
                                    </span>
                                  ) : status}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    ) : rule.field === 'completedStatus' ? (
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <label style={{ fontSize: '0.75rem', fontWeight: '600', color: '#6c757d' }}>
                          Erledigt-Status:
                        </label>
                        <select
                          value={rule.value || 'all'}
                          onChange={(e) => updateRule(ruleIndex, { value: e.target.value })}
                          className="select"
                          style={{ flex: 1 }}
                        >
                          <option value="all">Alle</option>
                          <option value="completed">Nur erledigte</option>
                          <option value="uncompleted">Nur unerledigte</option>
                        </select>
                      </div>
                    ) : rule.field === 'theme' ? (
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '0.5rem', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: '600', color: '#6c757d', marginBottom: '0.25rem' }}>
                          Themen auswählen:
                        </div>
                        {loadingThemes ? (
                          <div style={{ fontSize: '0.875rem', color: '#6c757d' }}>Lade Themen...</div>
                        ) : themes.length === 0 ? (
                          <div style={{ fontSize: '0.875rem', color: '#6c757d' }}>Keine Themen vorhanden</div>
                        ) : (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
                            {themes.map((theme) => {
                              let selectedThemes: string[] = [];
                              try {
                                if (rule.value) {
                                  selectedThemes = JSON.parse(rule.value);
                                }
                              } catch {
                                if (rule.value) {
                                  selectedThemes = [rule.value];
                                }
                              }
                              const isChecked = selectedThemes.includes(theme.id);
                              
                              return (
                                <label
                                  key={theme.id}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    cursor: 'pointer',
                                    fontSize: '0.875rem',
                                  }}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={(e) => {
                                      let newThemes: string[] = [];
                                      try {
                                        if (rule.value) {
                                          newThemes = JSON.parse(rule.value);
                                        }
                                      } catch {
                                        if (rule.value) {
                                          newThemes = [rule.value];
                                        }
                                      }
                                      
                                      if (e.target.checked) {
                                        if (!newThemes.includes(theme.id)) {
                                          newThemes.push(theme.id);
                                        }
                                      } else {
                                        newThemes = newThemes.filter(t => t !== theme.id);
                                      }
                                      
                                      updateRule(ruleIndex, { 
                                        value: newThemes.length > 0 ? JSON.stringify(newThemes) : '' 
                                      });
                                    }}
                                    style={{ cursor: 'pointer' }}
                                  />
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    {theme.color && (
                                      <div
                                        style={{
                                          width: '16px',
                                          height: '16px',
                                          borderRadius: '3px',
                                          backgroundColor: theme.color,
                                          border: '1px solid #ddd',
                                          flexShrink: 0,
                                        }}
                                      />
                                    )}
                                    <span style={{ 
                                      color: isChecked ? '#007bff' : '#333'
                                    }}>
                                      {theme.name}
                                    </span>
                                  </div>
                                </label>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    ) : rule.field === 'department' ? (
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '0.5rem', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: '600', color: '#6c757d', marginBottom: '0.25rem' }}>
                          Abteilungen auswählen:
                        </div>
                        {loadingDepartments ? (
                          <div style={{ fontSize: '0.875rem', color: '#6c757d' }}>Lade Abteilungen...</div>
                        ) : departments.length === 0 ? (
                          <div style={{ fontSize: '0.875rem', color: '#6c757d' }}>Keine Abteilungen vorhanden</div>
                        ) : (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
                            {departments.map((department) => {
                              let selectedDepartments: string[] = [];
                              try {
                                if (rule.value) {
                                  selectedDepartments = JSON.parse(rule.value);
                                }
                              } catch {
                                if (rule.value) {
                                  selectedDepartments = [rule.value];
                                }
                              }
                              const isChecked = selectedDepartments.includes(department.id);
                              
                              return (
                                <label
                                  key={department.id}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    cursor: 'pointer',
                                    fontSize: '0.875rem',
                                  }}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={(e) => {
                                      let newDepartments: string[] = [];
                                      try {
                                        if (rule.value) {
                                          newDepartments = JSON.parse(rule.value);
                                        }
                                      } catch {
                                        if (rule.value) {
                                          newDepartments = [rule.value];
                                        }
                                      }
                                      
                                      if (e.target.checked) {
                                        if (!newDepartments.includes(department.id)) {
                                          newDepartments.push(department.id);
                                        }
                                      } else {
                                        newDepartments = newDepartments.filter(d => d !== department.id);
                                      }
                                      
                                      updateRule(ruleIndex, { 
                                        value: newDepartments.length > 0 ? JSON.stringify(newDepartments) : '' 
                                      });
                                    }}
                                    style={{ cursor: 'pointer' }}
                                  />
                                  <span style={{ 
                                    color: isChecked ? '#007bff' : '#333'
                                  }}>
                                    🏢 {department.name}
                                  </span>
                                </label>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    ) : (
                      <>
                        <select
                          value={rule.operator}
                          onChange={(e) =>
                            updateRule(ruleIndex, {
                              operator: e.target.value as EmailFilter['rules'][0]['operator'],
                            })
                          }
                          className="select"
                          style={{ flex: '0 0 150px' }}
                        >
                          <option value="contains">enthält</option>
                          <option value="equals">ist gleich</option>
                          <option value="startsWith">beginnt mit</option>
                          <option value="endsWith">endet mit</option>
                        </select>
                        <input
                          type="text"
                          value={rule.value}
                          onChange={(e) =>
                            updateRule(ruleIndex, { value: e.target.value })
                          }
                          className="input"
                          placeholder="Wert eingeben..."
                          style={{ flex: 1 }}
                        />
                      </>
                    )}
                    {editingFilter.rules.length > 1 && (
                      <button
                        onClick={() => deleteRule(ruleIndex)}
                        className="btn btn-danger"
                        style={{ fontSize: '0.875rem', padding: '0.5rem' }}
                        title="Workflow löschen"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
                <button
                  onClick={addRule}
                  className="btn btn-secondary"
                  style={{ fontSize: '0.875rem', padding: '0.5rem 1rem', alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                >
                  <FiPlus size={16} />
                  <span>Workflow hinzufügen</span>
                </button>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                <button
                  onClick={handleCancelEdit}
                  className="btn btn-secondary"
                  style={{ fontSize: '0.875rem', padding: '0.5rem 1rem' }}
                >
                  Abbrechen
                </button>
                <button
                  onClick={handleSaveEdit}
                  disabled={savingFilter}
                  className="btn btn-primary"
                  style={{ fontSize: '0.875rem', padding: '0.5rem 1rem' }}
                >
                  {savingFilter ? (
                    <>
                      <div className="spinner" style={{ width: '14px', height: '14px', borderWidth: '2px', marginRight: '0.5rem', display: 'inline-block' }}></div>
                      Speichern...
                    </>
                  ) : (
                    'Speichern'
                  )}
                </button>
              </div>
            </div>
          )}

        </>
      )}

      {/* Symbol-Auswahl Popup */}
      {iconPickerOpen && editingFilter && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="icon-picker-title"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(0,0,0,0.4)',
          }}
          onClick={() => setIconPickerOpen(false)}
        >
          <div
            style={{
              backgroundColor: '#fff',
              borderRadius: '12px',
              padding: '1.5rem',
              maxWidth: '360px',
              width: '90%',
              boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="icon-picker-title" style={{ margin: '0 0 1rem', fontSize: '1.125rem', fontWeight: '600' }}>
              Symbol auswählen
            </h3>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: '0.5rem',
                marginBottom: '1rem',
              }}
            >
              {FILTER_ICON_OPTIONS.map(({ id, Icon, label }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    setEditingFilter({ ...editingFilter, icon: id });
                    setIconPickerOpen(false);
                  }}
                  title={label}
                  style={{
                    padding: '0.75rem',
                    border: editingFilter.icon === id ? '2px solid #007bff' : '1px solid #ddd',
                    borderRadius: '8px',
                    background: editingFilter.icon === id ? '#e7f1ff' : '#fff',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icon size={24} style={{ color: '#6c757d' }} />
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setIconPickerOpen(false)}
              className="btn btn-secondary"
              style={{ width: '100%', fontSize: '0.875rem' }}
            >
              Schließen
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

