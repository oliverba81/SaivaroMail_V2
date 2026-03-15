'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FiChevronDown, FiImage } from 'react-icons/fi';

const MAX_DROPDOWN_ITEMS = 8;

interface ExternalContentBannerProps {
  domains: string[];
  sender?: string;
  onShowForThisMessage: () => void;
  onAllowDomain: (domain: string) => void;
  onAllowSender?: (sender: string) => void;
  onAllowAllDomains?: (domains: string[]) => void;
  onOpenSettings?: () => void;
  saving?: boolean;
}

export default function ExternalContentBanner({
  domains,
  sender,
  onShowForThisMessage,
  onAllowDomain,
  onAllowSender,
  onAllowAllDomains,
  onOpenSettings,
  saving = false,
}: ExternalContentBannerProps) {
  const router = useRouter();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };

    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [dropdownOpen]);

  const handleOpenSettings = () => {
    setDropdownOpen(false);
    if (onOpenSettings) {
      onOpenSettings();
    } else {
      router.push('/emails/settings');
    }
  };

  const handleShowForThisMessage = () => {
    setDropdownOpen(false);
    onShowForThisMessage();
  };

  const handleAllowDomain = (domain: string) => {
    setDropdownOpen(false);
    onAllowDomain(domain);
  };

  const handleAllowSender = () => {
    if (!sender || !onAllowSender) return;
    if (!sender.includes('@')) return;
    setDropdownOpen(false);
    onAllowSender(sender);
  };

  const handleAllowAllDomains = () => {
    if (!onAllowAllDomains || domains.length === 0) return;
    setDropdownOpen(false);
    onAllowAllDomains(domains);
  };

  const domainItems = domains.slice(0, MAX_DROPDOWN_ITEMS);
  const hasMoreDomains = domains.length > MAX_DROPDOWN_ITEMS;
  const showAllowAll = domains.length >= 2;

  return (
    <div
      ref={dropdownRef}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '0.5rem',
        padding: '0.5rem 0.75rem',
        backgroundColor: '#fef9c3',
        border: '1px solid #facc15',
        borderRadius: '4px',
        marginBottom: '0.75rem',
        fontSize: '0.875rem',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: 0 }}>
        <FiImage size={16} style={{ color: '#a16207', flexShrink: 0 }} />
        <span style={{ color: '#713f12' }}>
          Zum Schutz Ihrer Privatsphäre wurden externe Inhalte blockiert.
        </span>
      </div>

      <div style={{ position: 'relative', flexShrink: 0 }}>
        <button
          type="button"
          onClick={() => setDropdownOpen(!dropdownOpen)}
          disabled={saving}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.25rem',
            padding: '0.25rem 0.5rem',
            fontSize: '0.8rem',
            backgroundColor: '#fde047',
            border: '1px solid #eab308',
            borderRadius: '4px',
            cursor: saving ? 'not-allowed' : 'pointer',
            color: '#713f12',
            opacity: saving ? 0.7 : 1,
          }}
          aria-haspopup="true"
          aria-expanded={dropdownOpen}
        >
          Optionen
          <FiChevronDown size={14} />
        </button>

        {dropdownOpen && (
          <>
            <div
              style={{
                position: 'fixed',
                inset: 0,
                zIndex: 9998,
              }}
              onClick={() => setDropdownOpen(false)}
              aria-hidden="true"
            />
            <div
              style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                marginTop: '2px',
                backgroundColor: '#fff',
                border: '1px solid #e5e7eb',
                borderRadius: '6px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                zIndex: 9999,
                minWidth: '260px',
                maxHeight: '320px',
                overflowY: 'auto',
              }}
              role="menu"
            >
              <button
                type="button"
                onClick={handleShowForThisMessage}
                style={{
                  display: 'block',
                  width: '100%',
                  padding: '0.5rem 0.75rem',
                  textAlign: 'left',
                  fontSize: '0.8rem',
                  border: 'none',
                  backgroundColor: 'transparent',
                  cursor: 'pointer',
                  color: '#374151',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f3f4f6';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                Externe Inhalte in dieser Nachricht anzeigen
              </button>

              {domainItems.map((domain) => (
                <button
                  key={domain}
                  type="button"
                  onClick={() => handleAllowDomain(domain)}
                  disabled={saving}
                  style={{
                    display: 'block',
                    width: '100%',
                    padding: '0.5rem 0.75rem',
                    textAlign: 'left',
                    fontSize: '0.8rem',
                    border: 'none',
                    backgroundColor: 'transparent',
                    cursor: saving ? 'not-allowed' : 'pointer',
                    color: '#374151',
                    borderTop: '1px solid #e5e7eb',
                  }}
                  onMouseEnter={(e) => {
                    if (!saving) e.currentTarget.style.backgroundColor = '#f3f4f6';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  Externe Inhalte erlauben von {domain}
                </button>
              ))}

              {sender && sender.includes('@') && onAllowSender && (
                <button
                  type="button"
                  onClick={handleAllowSender}
                  disabled={saving}
                  style={{
                    display: 'block',
                    width: '100%',
                    padding: '0.5rem 0.75rem',
                    textAlign: 'left',
                    fontSize: '0.8rem',
                    border: 'none',
                    backgroundColor: 'transparent',
                    cursor: saving ? 'not-allowed' : 'pointer',
                    color: '#374151',
                    borderTop: '1px solid #e5e7eb',
                  }}
                  onMouseEnter={(e) => {
                    if (!saving) e.currentTarget.style.backgroundColor = '#f3f4f6';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  Externe Inhalte erlauben von {sender}
                </button>
              )}

              {showAllowAll && onAllowAllDomains && (
                <button
                  type="button"
                  onClick={handleAllowAllDomains}
                  disabled={saving}
                  style={{
                    display: 'block',
                    width: '100%',
                    padding: '0.5rem 0.75rem',
                    textAlign: 'left',
                    fontSize: '0.8rem',
                    border: 'none',
                    backgroundColor: 'transparent',
                    cursor: saving ? 'not-allowed' : 'pointer',
                    color: '#374151',
                    borderTop: '1px solid #e5e7eb',
                  }}
                  onMouseEnter={(e) => {
                    if (!saving) e.currentTarget.style.backgroundColor = '#f3f4f6';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  Externe Inhalte erlauben von {domains.length} oben aufgeführten Quellen
                </button>
              )}

              <button
                type="button"
                onClick={handleOpenSettings}
                style={{
                  display: 'block',
                  width: '100%',
                  padding: '0.5rem 0.75rem',
                  textAlign: 'left',
                  fontSize: '0.8rem',
                  border: 'none',
                  backgroundColor: 'transparent',
                  cursor: 'pointer',
                  color: '#6b7280',
                  borderTop: '1px solid #e5e7eb',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f3f4f6';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                Optionen für externe Inhalte bearbeiten…
              </button>

              {hasMoreDomains && (
                <div
                  style={{
                    padding: '0.5rem 0.75rem',
                    fontSize: '0.75rem',
                    color: '#6b7280',
                    borderTop: '1px solid #e5e7eb',
                  }}
                >
                  Weitere Domains in den Einstellungen hinzufügen
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
