'use client';

import { useState, useEffect, useRef, memo } from 'react';
import { FiSettings } from 'react-icons/fi';
import Button from './Button';

interface EmailSearchBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  filter: 'all' | 'read' | 'unread';
  onFilterChange: (filter: 'all' | 'read' | 'unread') => void;
  unreadCount: number;
  onFetchEmails: () => void;
  fetching: boolean;
  onReset: () => void;
  searchFields?: string[];
  onSearchFieldsChange?: (fields: string[]) => void;
}

export type SearchField = 'subject' | 'from' | 'to' | 'body' | 'phone' | 'notes';

const availableSearchFields: { id: SearchField; label: string }[] = [
  { id: 'subject', label: 'Betreff' },
  { id: 'from', label: 'Absender' },
  { id: 'to', label: 'Empfänger' },
  { id: 'body', label: 'Inhalt' },
  { id: 'phone', label: 'Telefonnummer' },
  { id: 'notes', label: 'Kommentare' },
];

function EmailSearchBar({
  searchQuery,
  onSearchChange,
  filter: _filter,
  onFilterChange: _onFilterChange,
  unreadCount: _unreadCount,
  onFetchEmails: _onFetchEmails,
  fetching: _fetching,
  onReset: _onReset,
  searchFields = ['subject', 'from', 'body'],
  onSearchFieldsChange,
}: EmailSearchBarProps) {
  const [showSearchOptions, setShowSearchOptions] = useState(false);
  const [localSearchFields, setLocalSearchFields] = useState<string[]>(searchFields);
  const [popupPosition, setPopupPosition] = useState<{ top: number; left: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // Lokaler State für die Sucheingabe (wird nicht sofort an Parent weitergegeben)
  const [localSearchQuery, setLocalSearchQuery] = useState(searchQuery);
  const [showHint, setShowHint] = useState(false);
  const hintTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setLocalSearchFields(searchFields);
  }, [searchFields]);

  // Synchronisiere lokalen State mit Parent-Prop (wenn von außen geändert, z.B. durch Reset)
  useEffect(() => {
    setLocalSearchQuery(searchQuery);
  }, [searchQuery]);

  const handleFieldToggle = (fieldId: SearchField) => {
    const newFields = localSearchFields.includes(fieldId)
      ? localSearchFields.filter(f => f !== fieldId)
      : [...localSearchFields, fieldId];
    
    setLocalSearchFields(newFields);
    if (onSearchFieldsChange) {
      onSearchFieldsChange(newFields);
    }
  };

  // Suche ausführen (bei Button-Klick oder Enter)
  const handleSearch = () => {
    // Stelle sicher, dass searchFields auch aktualisiert werden, wenn sie geändert wurden
    if (onSearchFieldsChange && JSON.stringify(localSearchFields) !== JSON.stringify(searchFields)) {
      onSearchFieldsChange(localSearchFields);
    }
    onSearchChange(localSearchQuery);
  };


  return (
    <div className="flex items-center gap-2 w-full">
      {/* Suchfeld mit Clear-Button */}
      <div className="relative inline-block"
        onMouseEnter={() => {
          // Zeige Hint nach 500ms Hover
          hintTimeoutRef.current = setTimeout(() => {
            setShowHint(true);
          }, 500);
        }}
        onMouseLeave={() => {
          // Verstecke Hint sofort beim Verlassen
          if (hintTimeoutRef.current) {
            clearTimeout(hintTimeoutRef.current);
            hintTimeoutRef.current = null;
          }
          setShowHint(false);
        }}
      >
        <input
          ref={inputRef}
          type="text"
          placeholder={localSearchQuery.length > 0 && localSearchQuery.length < 3 ? "Mindestens 3 Zeichen eingeben..." : "Suche..."}
          value={localSearchQuery}
          onChange={(e) => {
            setLocalSearchQuery(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleSearch();
            } else if (e.key === 'Escape') {
              // ESC-Taste löscht die Suche
              setLocalSearchQuery('');
              onSearchChange('');
            }
          }}
          className={`w-[250px] px-3 py-1 h-8 ${localSearchQuery.length > 0 ? 'pr-8' : 'pr-3'} border rounded text-sm bg-white text-gray-800 outline-none transition-colors focus:ring-2 focus:ring-primary focus:border-transparent ${localSearchQuery.length > 0 && localSearchQuery.length < 3 ? 'border-warning focus:ring-warning' : 'border-gray-300'}`}
        />
        {/* Hint-Tooltip */}
        {showHint && (
          <div className="absolute bottom-full left-0 mb-2 bg-gray-800 text-white px-3 py-2 rounded text-xs whitespace-nowrap z-[10000] shadow-lg pointer-events-none">
            Mindestens 3 Zeichen eingeben, dann Enter drücken
            <div className="absolute top-full left-4 w-0 h-0 border-l-[6px] border-r-[6px] border-t-[6px] border-l-transparent border-r-transparent border-t-gray-800" />
          </div>
        )}
        {/* Clear-Button (X) */}
        {localSearchQuery.length > 0 && (
          <button
            ref={buttonRef}
            type="button"
            onClick={() => {
              setLocalSearchQuery('');
              onSearchChange('');
              // Focus zurück zum Input nach dem Löschen
              setTimeout(() => {
                if (inputRef.current) {
                  inputRef.current.focus();
                }
              }, 0);
            }}
            onMouseDown={(e) => {
              e.preventDefault(); // Verhindert, dass das Input den Focus verliert
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 bg-transparent border-none cursor-pointer p-1 flex items-center justify-center text-gray-500 text-base leading-none transition-colors hover:text-danger"
            title="Suche löschen (ESC)"
          >
            ✕
          </button>
        )}
      </div>
      {localSearchQuery.length > 0 && localSearchQuery.length < 3 && (
        <span className="text-xs text-warning ml-2">
          Mindestens 3 Zeichen
        </span>
      )}
      
      {/* Suchen-Button */}
      <Button
        onClick={handleSearch}
        variant="primary"
        className="flex-shrink-0 px-4 py-2 text-sm rounded"
        title="Suchen (Enter)"
      >
        🔍 Suchen
      </Button>
      
      {/* Suchoptionen-Button */}
      <div className="relative">
        <button
          ref={buttonRef}
          onClick={() => {
            if (buttonRef.current) {
              const rect = buttonRef.current.getBoundingClientRect();
              setPopupPosition({
                top: rect.bottom + 4,
                left: rect.left,
              });
            }
            setShowSearchOptions(!showSearchOptions);
          }}
          className="inline-flex items-center gap-2 px-3 py-1 h-8 rounded-md text-sm font-medium cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 bg-secondary hover:bg-secondary-hover text-white min-w-[36px] flex items-center justify-center"
          title="Suchoptionen"
        >
          <FiSettings size={16} />
        </button>

        {/* Popup für Suchoptionen */}
        {showSearchOptions && popupPosition && (
          <>
            <div
              className="fixed inset-0 z-[9998]"
              onClick={() => {
                setShowSearchOptions(false);
                setPopupPosition(null);
              }}
            />
            <div
              className="fixed bg-white border border-gray-200 rounded shadow-md p-4 min-w-[200px] z-[9999]"
              style={{
                top: `${popupPosition.top}px`,
                left: `${popupPosition.left}px`,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-3 font-semibold text-sm text-gray-800">
                Durchsuchbare Felder:
              </div>
              <div className="flex flex-col gap-2">
                {availableSearchFields.map((field) => (
                  <label
                    key={field.id}
                    className="flex items-center gap-2 cursor-pointer text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={localSearchFields.includes(field.id)}
                      onChange={() => handleFieldToggle(field.id)}
                      className="cursor-pointer"
                    />
                    <span>{field.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// Memoize die Komponente, um unnötige Re-Renders zu vermeiden
// searchQuery wird nicht verglichen, damit die Komponente bei jeder Eingabe neu rendert
// aber andere Props werden verglichen, um unnötige Re-Renders zu vermeiden
export default memo(EmailSearchBar);

