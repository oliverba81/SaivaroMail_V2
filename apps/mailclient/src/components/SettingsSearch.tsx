'use client';

import { useState, useEffect, useRef } from 'react';
import { FiSearch, FiX } from 'react-icons/fi';

interface SettingsSearchProps {
  onSearch: (query: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
}

export default function SettingsSearch({
  onSearch,
  placeholder = 'Einstellungen durchsuchen...',
  autoFocus = false,
}: SettingsSearchProps) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      onSearch(query);
    }, 300);

    return () => clearTimeout(timer);
  }, [query, onSearch]);

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  return (
    <div
      style={{
        position: 'relative',
        marginBottom: '1.5rem',
      }}
    >
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%',
          padding: '0.75rem 1rem 0.75rem 2.5rem',
          border: '1px solid #ddd',
          borderRadius: '8px',
          fontSize: '0.9rem',
          transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
        }}
        onFocus={(e) => {
          e.target.style.borderColor = '#007bff';
          e.target.style.boxShadow = '0 0 0 3px rgba(0, 123, 255, 0.1)';
        }}
        onBlur={(e) => {
          e.target.style.borderColor = '#ddd';
          e.target.style.boxShadow = 'none';
        }}
      />
      <FiSearch
        style={{
          position: 'absolute',
          left: '0.75rem',
          top: '50%',
          transform: 'translateY(-50%)',
          color: '#6c757d',
        }}
        size={18}
      />
      {query && (
        <button
          onClick={() => {
            setQuery('');
            onSearch('');
          }}
          style={{
            position: 'absolute',
            right: '0.75rem',
            top: '50%',
            transform: 'translateY(-50%)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: '1.25rem',
            color: '#6c757d',
            padding: '0.25rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          aria-label="Suche zurücksetzen"
        >
          <FiX size={18} />
        </button>
      )}
    </div>
  );
}



