'use client';

import { useState, useEffect } from 'react';

interface TableColumn {
  id: string;
  label: string;
  visible: boolean;
  order: number;
  width?: string | number;
}

interface TableColumnManagerProps {
  columns: TableColumn[];
  onColumnsChange: (columns: TableColumn[]) => void;
  onClose: () => void;
}

export default function TableColumnManager({
  columns,
  onColumnsChange,
  onClose,
}: TableColumnManagerProps) {
  // Entferne die alte redundante Spalte 'participants_detailed' beim Initialisieren
  const filteredColumns = columns.filter(col => col.id !== 'participants_detailed');
  const [localColumns, setLocalColumns] = useState<TableColumn[]>(filteredColumns);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  
  // Aktualisiere lokale Spalten, wenn sich columns ändert (ohne participants_detailed)
  useEffect(() => {
    const filtered = columns.filter(col => col.id !== 'participants_detailed');
    setLocalColumns(filtered);
  }, [columns]);

  const toggleVisibility = (columnId: string) => {
    setLocalColumns(prev =>
      prev.map(col =>
        col.id === columnId ? { ...col, visible: !col.visible } : col
      )
    );
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

    setLocalColumns(prev => {
      const sorted = [...prev].sort((a, b) => a.order - b.order);
      const newColumns = [...sorted];
      const draggedColumn = newColumns[draggedIndex];
      newColumns.splice(draggedIndex, 1);
      newColumns.splice(dropIndex, 0, draggedColumn);

      return newColumns.map((col, i) => ({ ...col, order: i }));
    });

    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleSave = () => {
    // Entferne die alte redundante Spalte 'participants_detailed' vor dem Speichern
    const cleanedColumns = localColumns.filter(col => col.id !== 'participants_detailed');
    onColumnsChange(cleanedColumns);
    onClose();
  };

  const sortedColumns = [...localColumns].sort((a, b) => a.order - b.order);

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
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
          maxWidth: '600px',
          maxHeight: '80vh',
          overflow: 'auto',
          position: 'relative',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: '600', margin: 0 }}>Spalten verwalten</h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '1.5rem',
              cursor: 'pointer',
              color: '#6c757d',
            }}
          >
            ×
          </button>
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          {sortedColumns.map((col, index) => {
            const isDragged = draggedIndex === index;
            const isDragOver = dragOverIndex === index;
            
            return (
              <div
                key={col.id}
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, index)}
                onDragEnd={handleDragEnd}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem',
                  padding: '0.75rem',
                  borderBottom: '1px solid #e9ecef',
                  cursor: 'move',
                  backgroundColor: isDragOver ? '#e7f3ff' : isDragged ? '#f0f0f0' : 'transparent',
                  opacity: isDragged ? 0.5 : 1,
                  transition: 'background-color 0.2s ease',
                }}
              >
                <span
                  style={{
                    fontSize: '1.25rem',
                    color: '#6c757d',
                    cursor: 'grab',
                  }}
                  title="Ziehen zum Verschieben"
                >
                  ⋮⋮
                </span>
                <input
                  type="checkbox"
                  checked={col.visible}
                  onChange={() => toggleVisibility(col.id)}
                  onClick={(e) => e.stopPropagation()}
                  style={{ cursor: 'pointer' }}
                />
                <span style={{ flex: 1, fontWeight: col.visible ? '500' : '400', color: col.visible ? '#333' : '#6c757d' }}>
                  {col.label || col.id}
                </span>
                <input
                  type="text"
                  value={col.width || ''}
                  onChange={(e) => {
                    const value = e.target.value.trim();
                    setLocalColumns(prev =>
                      prev.map(c =>
                        c.id === col.id ? { ...c, width: value ? (isNaN(Number(value)) ? value : `${value}px`) : undefined } : c
                      )
                    );
                  }}
                  onClick={(e) => e.stopPropagation()}
                  placeholder="Auto"
                  style={{
                    width: '80px',
                    padding: '0.25rem 0.5rem',
                    fontSize: '0.875rem',
                    border: '1px solid #ced4da',
                    borderRadius: '4px',
                  }}
                  title="Breite (z.B. 100px, 20%, auto)"
                />
              </div>
            );
          })}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
          <button onClick={onClose} className="btn btn-secondary">
            Abbrechen
          </button>
          <button onClick={handleSave} className="btn btn-primary">
            Speichern
          </button>
        </div>
      </div>
    </div>
  );
}

