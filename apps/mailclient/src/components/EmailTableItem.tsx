'use client';

import { FiPaperclip, FiPhone, FiMail, FiMessageSquare } from 'react-icons/fi';
import { getDisplayFromParsed } from '@/utils/email-helpers';
import { normalizePhoneNumberForTel, formatPhoneNumberForDisplay } from '@/utils/phone-utils';

interface Email {
  id: string;
  subject: string;
  from: string;
  to: string[];
  date: string;
  read: boolean;
  deleted?: boolean;
  spam?: boolean;
  important?: boolean;
  body?: string;
  hasAttachment?: boolean;
  themeId?: string | null;
  theme?: {
    id: string;
    name: string;
    color: string | null;
  } | null;
  departmentId?: string | null;
  department?: {
    id: string;
    name: string;
  } | null;
  assignedDepartments?: Array<{
    id: string;
    name: string;
  }>;
  type?: 'email' | 'phone_note';
  phoneNumber?: string;
  hasNotes?: boolean;
  lastNotePreview?: {
    content: string;
    userName: string;
    createdAt: string;
  };
  isSent?: boolean;
}

interface TableColumn {
  id: string;
  label: string;
  visible: boolean;
  order: number;
  width?: string | number;
}

interface EmailTableItemProps {
  email: Email;
  isSelected: boolean;
  onSelect: (emailId: string, e: React.MouseEvent) => void;
  onClick: (emailId: string) => void;
  formatDate: (dateString: string) => string;
  isActive?: boolean;
  columns: TableColumn[];
  onContextMenu?: (emailId: string, x: number, y: number) => void;
  virtualRow?: any; // Virtual row data from @tanstack/react-virtual
  measureElement?: (element: HTMLElement | null) => void; // Measure function for virtualization
}

export default function EmailTableItem({
  email,
  isSelected,
  onSelect,
  onClick,
  formatDate,
  isActive,
  columns,
  onContextMenu,
  virtualRow,
  measureElement,
}: EmailTableItemProps) {
  // Parse Absender-Name und E-Mail-Adresse
  const fromParsed = getDisplayFromParsed(email);
  
  // Lokale Funktion zum Parsen von E-Mail-Strings
  const parseFrom = (emailStr: string): { name: string; email: string } => {
    const emailMatch = emailStr.match(/^(.+?)\s*<(.+?)>$/);
    if (emailMatch) {
      return {
        name: emailMatch[1].trim(),
        email: emailMatch[2].trim(),
      };
    }
    return {
      name: emailStr || '',
      email: emailStr || '',
    };
  };
  
  // Parse Empfänger
  const toEmails = Array.isArray(email.to) ? email.to : (email.to ? [email.to] : []);
  const toDisplay = toEmails.length > 0 ? toEmails[0] : '';
  const toParsed = toDisplay ? parseFrom(toDisplay) : { name: '', email: '' };

  // Sortiere Spalten nach order
  const sortedColumns = [...columns].filter(col => col.visible).sort((a, b) => a.order - b.order);

  const getColumnWidth = (columnId: string): { width?: string; minWidth?: string; maxWidth?: string } => {
    const col = columns.find(c => c.id === columnId);
    if (col?.width) {
      const width = typeof col.width === 'number' ? `${col.width}px` : col.width;
      return { width, minWidth: width, maxWidth: width };
    }
    
    // Standardbreiten für verschiedene Spaltentypen (muss mit Header übereinstimmen)
    switch (columnId) {
      case 'checkbox':
        return { width: '40px', minWidth: '40px', maxWidth: '40px' };
      case 'attachment':
        return { width: '50px', minWidth: '50px', maxWidth: '50px' };
      case 'important':
      case 'spam':
      case 'deleted':
        return { width: '60px', minWidth: '60px', maxWidth: '60px' };
      case 'date':
        return { width: '140px', minWidth: '120px', maxWidth: '160px' };
      case 'theme':
        return { width: '120px', minWidth: '100px', maxWidth: '150px' };
      case 'subject':
        return { width: 'auto', minWidth: '200px' };
      case 'participants':
        return { width: 'auto', minWidth: '180px' };
      case 'from_cb':
      case 'recipient':
        return { width: 'auto', minWidth: '120px', maxWidth: '180px' };
      case 'department':
        return { width: 'auto', minWidth: '150px' };
      default:
        return { width: 'auto', minWidth: '100px' };
    }
  };

  const getResponsiveClass = (columnId: string) => {
    if (columnId === 'checkbox' || columnId === 'subject' || columnId === 'participants' || columnId === 'date') {
      return 'col-essential';
    } else if (columnId === 'from_cb' || columnId === 'recipient') {
      return 'col-medium';
    } else {
      return 'col-large';
    }
  };

  const renderCell = (columnId: string) => {
    const widthStyle = getColumnWidth(columnId);
    const responsiveClass = getResponsiveClass(columnId);
    switch (columnId) {
      case 'checkbox':
        return (
          <td key={columnId} className={`table-cell-${columnId} ${responsiveClass}`} style={{ ...widthStyle, padding: '0.25rem', textAlign: 'center' }}>
            <input
              type="checkbox"
              checked={isSelected}
              onClick={(e) => onSelect(email.id, e)}
              onChange={() => {}}
              style={{
                width: '16px',
                height: '16px',
                cursor: 'pointer',
              }}
            />
          </td>
        );
      
      case 'important':
        return (
          <td key={columnId} className={`table-cell-${columnId} ${responsiveClass}`} style={{ ...widthStyle, padding: '0.25rem', textAlign: 'center' }}>
            {email.important ? (
              <span style={{ fontSize: '1rem', color: '#ffc107' }} title="Wichtig">⭐</span>
            ) : (
              <span style={{ color: '#e9ecef' }}>-</span>
            )}
          </td>
        );
      
      case 'spam':
        return (
          <td key={columnId} className={`table-cell-${columnId} ${responsiveClass}`} style={{ ...widthStyle, padding: '0.25rem', textAlign: 'center' }}>
            {email.spam ? (
              <span style={{ fontSize: '1rem' }} title="Spam">🚫</span>
            ) : (
              <span style={{ color: '#e9ecef' }}>-</span>
            )}
          </td>
        );
      
      case 'deleted':
        return (
          <td key={columnId} className={`table-cell-${columnId} ${responsiveClass}`} style={{ ...widthStyle, padding: '0.25rem', textAlign: 'center' }}>
            {email.deleted ? (
              <span style={{ fontSize: '1rem', opacity: 0.7 }} title="Gelöscht">🗑️</span>
            ) : (
              <span style={{ color: '#e9ecef' }}>-</span>
            )}
          </td>
        );
      
      case 'attachment':
        return (
          <td key={columnId} className={`table-cell-${columnId} ${responsiveClass}`} style={{ ...widthStyle, padding: '0.25rem', textAlign: 'center' }}>
            {email.hasAttachment ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', color: '#6c757d' }} title="Hat Anhang">
                <FiPaperclip size={16} />
              </span>
            ) : (
              <span style={{ color: '#e9ecef' }}>-</span>
            )}
          </td>
        );
      
      case 'subject':
        return (
          <td key={columnId} className={`table-cell-${columnId} ${responsiveClass}`} style={{ ...widthStyle, padding: '0.25rem' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                overflow: 'hidden',
                fontWeight: email.read ? '500' : '600',
                color: email.read ? '#6c757d' : '#333',
                fontSize: '0.9rem',
              }}
              title={email.subject || '(Kein Betreff)'}
            >
              {email.type === 'phone_note' ? (
                <FiPhone size={14} style={{ color: '#2563EB', flexShrink: 0, marginRight: '0.5rem' }} title="Telefonnotiz" />
              ) : (
                <FiMail size={14} style={{ color: email.isSent ? '#DC2626' : '#6B7280', flexShrink: 0, marginRight: '0.5rem' }} title={email.isSent ? 'Gesendet' : 'E-Mail'} />
              )}
              {email.hasAttachment && (
                <span style={{ flexShrink: 0, marginRight: '0.5rem' }} title="Hat Anhang" aria-label="Hat Anhang">
                  <FiPaperclip size={14} style={{ color: '#6c757d' }} />
                </span>
              )}
              {email.hasNotes && (
                <span
                  style={{ flexShrink: 0, marginRight: '0.5rem' }}
                  title={
                    email.lastNotePreview
                      ? `${email.lastNotePreview.userName}, ${new Date(email.lastNotePreview.createdAt).toLocaleString('de-DE')}: ${email.lastNotePreview.content}${email.lastNotePreview.content.length >= 80 ? '…' : ''}`
                      : 'Hat Kommentare'
                  }
                  aria-label="Hat Kommentare"
                >
                  <FiMessageSquare size={14} style={{ color: '#CA8A04' }} />
                </span>
              )}
              <span style={{ minWidth: 0, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {email.subject || '(Kein Betreff)'}
              </span>
            </div>
          </td>
        );
      
      case 'participants':
        return (
          <td key={columnId} className={`table-cell-${columnId} ${responsiveClass}`} style={{ ...widthStyle, padding: '0.25rem' }}>
            <div
              style={{
                fontSize: '0.9rem',
                color: '#333',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              title={fromParsed.isPhoneNote && fromParsed.phoneNumber 
                ? `Telefonnummer: ${formatPhoneNumberForDisplay(fromParsed.phoneNumber)}`
                : `${fromParsed.name} <${fromParsed.email || ''}>`}
            >
              {fromParsed.isPhoneNote && fromParsed.phoneNumber ? (
                <a
                  href={`tel:${normalizePhoneNumberForTel(fromParsed.phoneNumber)}`}
                  onClick={(e) => e.stopPropagation()}
                  className="text-[#2563EB] hover:underline flex items-center gap-1"
                  title={`Anrufen: ${formatPhoneNumberForDisplay(fromParsed.phoneNumber)}`}
                >
                  <FiPhone size={14} className="text-[#2563EB]" />
                  {formatPhoneNumberForDisplay(fromParsed.phoneNumber)}
                </a>
              ) : (
                <>
                  {fromParsed.name} {fromParsed.email && fromParsed.email !== fromParsed.name && `<${fromParsed.email}>`}
                </>
              )}
            </div>
          </td>
        );
      
      case 'date':
        return (
          <td key={columnId} className={`table-cell-${columnId} ${responsiveClass}`} style={{ ...widthStyle, padding: '0.25rem', textAlign: 'left' }}>
            <div
              style={{
                color: '#6c757d',
                fontSize: '0.85rem',
                whiteSpace: 'nowrap',
              }}
            >
              {formatDate(email.date)}
            </div>
          </td>
        );
      
      case 'from_cb':
        return (
          <td key={columnId} className={`table-cell-${columnId} ${responsiveClass}`} style={{ ...widthStyle, padding: '0.25rem' }}>
            <div
              style={{
                fontSize: '0.85rem',
                color: '#6c757d',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              title={fromParsed.isPhoneNote && fromParsed.phoneNumber 
                ? `Telefonnummer: ${formatPhoneNumberForDisplay(fromParsed.phoneNumber)}`
                : fromParsed.name}
            >
              {fromParsed.isPhoneNote && fromParsed.phoneNumber ? (
                <span className="flex items-center gap-1 truncate">
                  <FiPhone size={12} className="text-[#2563EB]" />
                  <span className="truncate">
                    {formatPhoneNumberForDisplay(fromParsed.phoneNumber).length > 15 
                      ? formatPhoneNumberForDisplay(fromParsed.phoneNumber).substring(0, 15) + '...' 
                      : formatPhoneNumberForDisplay(fromParsed.phoneNumber)}
                  </span>
                </span>
              ) : (
                <span className="truncate">
                  {fromParsed.name.length > 15 ? fromParsed.name.substring(0, 15) + '...' : fromParsed.name}
                </span>
              )}
            </div>
          </td>
        );
      
      case 'recipient':
        return (
          <td key={columnId} className={`table-cell-${columnId} ${responsiveClass}`} style={{ ...widthStyle, padding: '0.25rem' }}>
            <div
              style={{
                fontSize: '0.85rem',
                color: '#6c757d',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              title={toParsed.email || toDisplay}
            >
              {toParsed.email ? (toParsed.email.length > 15 ? toParsed.email.substring(0, 15) + '...' : toParsed.email) : (toDisplay.length > 15 ? toDisplay.substring(0, 15) + '...' : toDisplay)}
            </div>
          </td>
        );
      
      case 'participants_detailed':
        return (
          <td key={columnId} className={`table-cell-${columnId} ${responsiveClass}`} style={{ ...widthStyle, padding: '0.25rem' }}>
            <div
              style={{
                fontSize: '0.85rem',
                color: '#6c757d',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              title={fromParsed.isPhoneNote && fromParsed.phoneNumber 
                ? `Telefonnummer: ${formatPhoneNumberForDisplay(fromParsed.phoneNumber)}`
                : `${fromParsed.name} <${fromParsed.email || ''}>`}
            >
              {fromParsed.name.length > 20 ? fromParsed.name.substring(0, 20) + '...' : fromParsed.name}
            </div>
          </td>
        );
      
      case 'theme':
        return (
          <td key={columnId} className={`table-cell-${columnId} ${responsiveClass}`} style={{ ...widthStyle, padding: '0.25rem', textAlign: 'left' }}>
            {email.theme ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontSize: '0.85rem',
                }}
                title={email.theme.name}
              >
                {email.theme.color && (
                  <div
                    style={{
                      width: '12px',
                      height: '12px',
                      borderRadius: '3px',
                      backgroundColor: email.theme.color,
                      border: '1px solid #ddd',
                      flexShrink: 0,
                    }}
                  />
                )}
                <span
                  style={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    color: '#333',
                  }}
                >
                  {email.theme.name}
                </span>
              </div>
            ) : (
              <span style={{ color: '#e9ecef', fontSize: '0.85rem' }}>-</span>
            )}
          </td>
        );
      
      case 'department':
        // Für gesendete E-Mails: Zeige departmentId/department (Priorität)
        if (email.departmentId || email.department) {
          const departmentName = email.department?.name || 'Unbekannt';
          return (
            <td key={columnId} className={`table-cell-${columnId} ${responsiveClass}`} style={{ ...widthStyle, padding: '0.25rem', textAlign: 'left' }}>
              <span
                style={{
                  display: 'inline-block',
                  padding: '0.25rem 0.5rem',
                  borderRadius: '4px',
                  fontSize: '0.75rem',
                  fontWeight: '500',
                  backgroundColor: '#e3f2fd',
                  color: '#1976d2',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  maxWidth: '100%',
                }}
                title={`Gesendet aus: ${departmentName}`}
              >
                🏢 {departmentName}
              </span>
            </td>
          );
        }
        // Für empfangene E-Mails: Zeige assignedDepartments (falls vorhanden)
        const assignedDepts = email.assignedDepartments || [];
        return (
          <td key={columnId} className={`table-cell-${columnId} ${responsiveClass}`} style={{ ...widthStyle, padding: '0.25rem', textAlign: 'left' }}>
            {assignedDepts.length > 0 ? (
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '0.25rem',
                  fontSize: '0.85rem',
                }}
                title={assignedDepts.map(d => d.name).join(', ')}
              >
                {assignedDepts.map((dept) => (
                  <span
                    key={dept.id}
                    style={{
                      display: 'inline-block',
                      padding: '0.125rem 0.375rem',
                      backgroundColor: '#e7f3ff',
                      color: '#007bff',
                      borderRadius: '3px',
                      fontSize: '0.75rem',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      maxWidth: '100%',
                    }}
                  >
                    🏢 {dept.name}
                  </span>
                ))}
              </div>
            ) : (
              <span style={{ fontSize: '0.85rem', color: '#999' }}>-</span>
            )}
          </td>
        );
      
      default:
        return null;
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onContextMenu) {
      onContextMenu(email.id, e.clientX, e.clientY);
    }
  };

  const trRef = (element: HTMLTableRowElement | null) => {
    if (measureElement && element) {
      measureElement(element);
    }
  };

  return (
    <tr
      ref={trRef}
      data-index={virtualRow?.index}
      className={`email-table-item ${email.read ? 'read' : 'unread'} ${isActive ? 'active' : ''}`}
      onClick={() => onClick(email.id)}
      onContextMenu={handleContextMenu}
      style={{
        cursor: 'pointer',
        backgroundColor: isActive ? '#e7f3ff' : (email.read ? 'white' : '#f0f7ff'),
        borderBottom: '1px solid #e9ecef',
        transition: 'background-color 0.2s ease',
      }}
      onMouseEnter={(e) => {
        if (!isActive) {
          e.currentTarget.style.backgroundColor = email.read ? '#f8f9fa' : '#e6f2ff';
        }
      }}
      onMouseLeave={(e) => {
        if (!isActive) {
          e.currentTarget.style.backgroundColor = email.read ? 'white' : '#f0f7ff';
        }
      }}
    >
      {sortedColumns.map(col => renderCell(col.id))}
    </tr>
  );
}
