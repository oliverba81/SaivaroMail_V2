'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { 
  FiRefreshCw, 
  FiEdit, 
  FiCheckCircle, 
  FiStar, 
  FiAlertTriangle, 
  FiTrash2, 
  FiRotateCcw,
  FiMail,
  FiBriefcase,
  FiTag,
  FiPrinter,
  FiZap,
  FiHash,
  FiCornerUpLeft,
  FiPhone,
  FiChevronDown
} from 'react-icons/fi';
import { useToast } from '@/components/ToastProvider';
import TicketIdManagementModal from './TicketIdManagementModal';
import Modal from './Modal';

interface Email {
  id: string;
  read: boolean;
  completed?: boolean;
  deleted?: boolean;
  spam?: boolean;
  important?: boolean;
  type?: 'email' | 'phone_note';
  phoneNumber?: string;
  replyLock?: { userId: string; userName: string };
}

export type ReplyContextPayload = {
  kind: 'email' | 'phone_note';
  replyToId: string;
  replyType?: 'email' | 'phone_note';
};

interface EmailToolbarProps {
  selectedEmails: Set<string>;
  emails: Email[];
  selectedEmail?: Email | null;
  selectedEmailId?: string | null;
  customFilterId?: string | null;
  onMarkAsRead: (read: boolean) => void;
  onMarkAsCompleted: (completed: boolean) => void;
  onMarkAsSpam: (spam: boolean) => void;
  onMarkAsImportant: (important: boolean) => void;
  onDelete: () => void;
  onRestore?: () => void;
  onRefresh?: () => void;
  markingRead?: boolean;
  markingCompleted?: boolean;
  markingSpam?: boolean;
  markingImportant?: boolean;
  fetching?: boolean;
  onDepartmentChange?: () => void;
  /** Wenn gesetzt: Antworten öffnet Reply-Tab im rechten Bereich statt Navigation zu /emails/compose */
  onReply?: (context: ReplyContextPayload) => void;
  /** Wenn gesetzt: Neu E-Mail/Telefonnotiz öffnet Tab rechts statt Navigation zu /emails/compose */
  onNewCompose?: (kind: 'email' | 'phone_note') => void;
  /** Aktueller User – wenn gesetzt und E-Mail hat replyLock von anderem User: Antworten deaktivieren */
  currentUserId?: string | null;
}

// Neue Button Dropdown Komponente
function NewButtonDropdown({
  customFilterId,
  onNewCompose,
}: {
  customFilterId?: string | null;
  onNewCompose?: (kind: 'email' | 'phone_note') => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const baseHref = customFilterId ? `/emails?filterId=${customFilterId}` : "/emails";
  const phoneNoteHref = customFilterId ? `/emails?filterId=${customFilterId}` : "/emails";

  const handleSelect = (kind: 'email' | 'phone_note') => {
    if (onNewCompose) {
      onNewCompose(kind);
      setIsOpen(false);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="px-4 py-2.5 h-8 bg-[#2563EB] text-white rounded-lg text-sm font-medium cursor-pointer flex items-center gap-2 transition-colors hover:bg-[#1D4ED8]"
        title="Neue E-Mail oder Telefonnotiz erstellen"
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        <FiEdit size={16} className="text-white" />
        <span className="text-white">Neu...</span>
        <FiChevronDown size={14} className="text-white" />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-[9998]"
            onClick={() => setIsOpen(false)}
          />
          <div
            className="absolute top-full left-0 mt-1 bg-white border border-[#E5E7EB] rounded-lg shadow-lg z-[9999] min-w-[200px]"
            role="menu"
            aria-orientation="vertical"
          >
            {onNewCompose ? (
              <>
                <button
                  type="button"
                  onClick={() => handleSelect('email')}
                  className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-left text-gray-700 hover:bg-[#F3F4F6] transition-colors first:rounded-t-lg"
                  role="menuitem"
                >
                  <FiMail size={16} className="text-[#2563EB]" />
                  <span>E-Mail</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSelect('phone_note')}
                  className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-left text-gray-700 hover:bg-[#F3F4F6] transition-colors last:rounded-b-lg"
                  role="menuitem"
                >
                  <FiPhone size={16} className="text-[#2563EB]" />
                  <span>Telefonnotiz</span>
                </button>
              </>
            ) : (
              <>
                <Link
                  href={baseHref}
                  className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-[#F3F4F6] transition-colors first:rounded-t-lg"
                  role="menuitem"
                  onClick={() => setIsOpen(false)}
                >
                  <FiMail size={16} className="text-[#2563EB]" />
                  <span>E-Mail</span>
                </Link>
                <Link
                  href={phoneNoteHref}
                  className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-[#F3F4F6] transition-colors last:rounded-b-lg"
                  role="menuitem"
                  onClick={() => setIsOpen(false)}
                >
                  <FiPhone size={16} className="text-[#2563EB]" />
                  <span>Telefonnotiz</span>
                </Link>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// Antworten Button Dropdown Komponente
function ReplyButtonDropdown({
  selectedEmailId,
  selectedEmail,
  customFilterId,
  onReply,
  currentUserId,
}: {
  selectedEmailId?: string | null;
  selectedEmail?: Email | null;
  customFilterId?: string | null;
  onReply?: (context: ReplyContextPayload) => void;
  currentUserId?: string | null;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const isLockedByOther = Boolean(
    selectedEmail?.replyLock &&
    currentUserId &&
    selectedEmail.replyLock.userId !== currentUserId
  );
  const lockedByName = selectedEmail?.replyLock?.userName;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const isPhoneNote = selectedEmail?.type === 'phone_note';
  const isDisabled = !selectedEmailId || !selectedEmail || isLockedByOther;

  const handleReply = (context: ReplyContextPayload) => {
    if (onReply) {
      onReply(context);
      setIsOpen(false);
    }
  };

  // Wenn Telefonnotiz: Dropdown, sonst normaler Link oder Button
  if (isPhoneNote) {
    const emailReplyHref = customFilterId ? `/emails?filterId=${customFilterId}` : "/emails";
    const phoneNoteReplyHref = customFilterId ? `/emails?filterId=${customFilterId}` : "/emails";

    return (
      <div className="relative" ref={dropdownRef}>
        <button
          type="button"
          onClick={() => !isDisabled && setIsOpen(!isOpen)}
          disabled={isDisabled}
          className={`px-4 py-2.5 h-8 border border-[#E5E7EB] rounded-lg text-sm font-medium flex items-center gap-2 transition-colors ${
            isDisabled
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed opacity-50'
              : 'bg-white text-[#2563EB] cursor-pointer hover:bg-[#F3F4F6]'
          }`}
          title={isLockedByOther ? `Wird von ${lockedByName || 'einem anderen Benutzer'} beantwortet` : isDisabled ? 'Bitte wählen Sie eine Telefonnotiz aus' : 'Antworten auf Telefonnotiz'}
          aria-haspopup="true"
          aria-expanded={isOpen}
        >
          <FiCornerUpLeft size={16} className={isDisabled ? 'text-gray-400' : 'text-[#2563EB]'} />
          <span>Antworten</span>
          <FiChevronDown size={14} className={isDisabled ? 'text-gray-400' : 'text-[#2563EB]'} />
        </button>

        {isOpen && !isDisabled && (
          <>
            <div
              className="fixed inset-0 z-[9998]"
              onClick={() => setIsOpen(false)}
            />
            <div
              className="absolute top-full left-0 mt-1 bg-white border border-[#E5E7EB] rounded-lg shadow-lg z-[9999] min-w-[220px]"
              role="menu"
              aria-orientation="vertical"
            >
              {onReply ? (
                <>
                  <button
                    type="button"
                    className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-[#F3F4F6] transition-colors first:rounded-t-lg w-full text-left"
                    role="menuitem"
                    onClick={() => handleReply({ kind: 'phone_note', replyToId: selectedEmailId!, replyType: 'email' })}
                  >
                    <FiMail size={16} className="text-[#2563EB]" />
                    <span>Per E-Mail antworten</span>
                  </button>
                  <button
                    type="button"
                    className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-[#F3F4F6] transition-colors last:rounded-b-lg w-full text-left"
                    role="menuitem"
                    onClick={() => handleReply({ kind: 'phone_note', replyToId: selectedEmailId!, replyType: 'phone_note' })}
                  >
                    <FiPhone size={16} className="text-[#2563EB]" />
                    <span>Per Telefonnotiz antworten</span>
                  </button>
                </>
              ) : (
                <>
                  <Link
                    href={emailReplyHref}
                    className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-[#F3F4F6] transition-colors first:rounded-t-lg"
                    role="menuitem"
                    onClick={() => setIsOpen(false)}
                  >
                    <FiMail size={16} className="text-[#2563EB]" />
                    <span>Per E-Mail antworten</span>
                  </Link>
                  <Link
                    href={phoneNoteReplyHref}
                    className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-[#F3F4F6] transition-colors last:rounded-b-lg"
                    role="menuitem"
                    onClick={() => setIsOpen(false)}
                  >
                    <FiPhone size={16} className="text-[#2563EB]" />
                    <span>Per Telefonnotiz antworten</span>
                  </Link>
                </>
              )}
            </div>
          </>
        )}
      </div>
    );
  }

  // Normale E-Mail: Dropdown "Als E-Mail antworten" / "Als Notiz antworten", sonst Link
  const replyHref = selectedEmailId && selectedEmail
    ? (customFilterId ? `/emails?filterId=${customFilterId}` : "/emails")
    : '#';

  if (onReply && selectedEmailId && selectedEmail) {
    return (
      <div className="relative" ref={dropdownRef}>
        <button
          type="button"
          onClick={() => !isLockedByOther && setIsOpen(!isOpen)}
          disabled={isLockedByOther}
          className={`px-4 py-2.5 h-8 border border-[#E5E7EB] rounded-lg text-sm font-medium flex items-center gap-2 transition-colors ${
            isLockedByOther ? 'bg-gray-100 text-gray-400 cursor-not-allowed opacity-70' : 'bg-white text-[#2563EB] cursor-pointer hover:bg-[#F3F4F6]'
          }`}
          title={isLockedByOther ? `Wird von ${lockedByName || 'einem anderen Benutzer'} beantwortet` : 'Antworten (E-Mail oder Notiz)'}
          aria-haspopup="true"
          aria-expanded={isOpen}
        >
          <FiCornerUpLeft size={16} className={isLockedByOther ? 'text-gray-400' : 'text-[#2563EB]'} />
          <span>Antworten</span>
          <FiChevronDown size={14} className={isLockedByOther ? 'text-gray-400' : 'text-[#2563EB]'} />
        </button>

        {isOpen && !isLockedByOther && (
          <>
            <div
              className="fixed inset-0 z-[9998]"
              onClick={() => setIsOpen(false)}
            />
            <div
              className="absolute top-full left-0 mt-1 bg-white border border-[#E5E7EB] rounded-lg shadow-lg z-[9999] min-w-[220px]"
              role="menu"
              aria-orientation="vertical"
            >
              <button
                type="button"
                className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-[#F3F4F6] transition-colors first:rounded-t-lg w-full text-left"
                role="menuitem"
                onClick={() => handleReply({ kind: 'email', replyToId: selectedEmailId!, replyType: 'email' })}
              >
                <FiMail size={16} className="text-[#2563EB]" />
                <span>Als E-Mail antworten</span>
              </button>
              <button
                type="button"
                className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-[#F3F4F6] transition-colors last:rounded-b-lg w-full text-left"
                role="menuitem"
                onClick={() => handleReply({ kind: 'email', replyToId: selectedEmailId!, replyType: 'phone_note' })}
              >
                <FiPhone size={16} className="text-[#2563EB]" />
                <span>Als Notiz antworten</span>
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <Link
      href={replyHref}
      className={`px-4 py-2.5 h-8 border border-[#E5E7EB] rounded-lg text-sm font-medium flex items-center gap-2 transition-colors ${
        selectedEmailId && selectedEmail
          ? 'bg-white text-[#2563EB] cursor-pointer hover:bg-[#F3F4F6]'
          : 'bg-gray-100 text-gray-400 cursor-not-allowed opacity-50'
      }`}
      onClick={(e) => {
        if (!selectedEmailId || !selectedEmail) {
          e.preventDefault();
        }
      }}
      title={isLockedByOther ? `Wird von ${lockedByName || 'einem anderen Benutzer'} beantwortet` : selectedEmailId && selectedEmail ? 'Auf E-Mail antworten' : 'Bitte wählen Sie eine E-Mail aus'}
    >
      <FiCornerUpLeft size={16} className={selectedEmailId && selectedEmail ? 'text-[#2563EB]' : 'text-gray-400'} />
      <span>Antworten</span>
    </Link>
  );
}

export default function EmailToolbar({
  selectedEmails,
  emails,
  selectedEmail,
  selectedEmailId,
  customFilterId,
  onMarkAsRead,
  onMarkAsCompleted,
  onMarkAsSpam,
  onMarkAsImportant,
  onDelete,
  onRestore,
  onRefresh,
  markingRead = false,
  markingCompleted = false,
  markingSpam = false,
  markingImportant = false,
  fetching = false,
  onDepartmentChange,
  onReply,
  onNewCompose,
  currentUserId,
}: EmailToolbarProps) {
  const toast = useToast();
  const [showMoreDropdown, setShowMoreDropdown] = useState(false);
  const [showDepartmentModal, setShowDepartmentModal] = useState(false);
  const [showThemeModal, setShowThemeModal] = useState(false);
  const [showTicketIdModal, setShowTicketIdModal] = useState(false);
  const [departments, setDepartments] = useState<any[]>([]);
  const [themes, setThemes] = useState<any[]>([]);
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
  const [selectedThemeId, setSelectedThemeId] = useState<string | null>(null);
  const [loadingDepartments, setLoadingDepartments] = useState(false);
  const [savingDepartments, setSavingDepartments] = useState(false);
  const [loadingThemes, setLoadingThemes] = useState(false);
  const [savingTheme, setSavingTheme] = useState(false);
  const [showWorkflowModal, setShowWorkflowModal] = useState(false);
  const [workflows, setWorkflows] = useState<any[]>([]);
  const [loadingWorkflows, setLoadingWorkflows] = useState(false);
  const [executingWorkflow, setExecutingWorkflow] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Schließe Dropdown beim Klicken außerhalb
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowMoreDropdown(false);
      }
    };

    if (showMoreDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showMoreDropdown]);

  // Lade Abteilungen beim Öffnen des Modals
  useEffect(() => {
    if (showDepartmentModal) {
      loadDepartments();
      loadCurrentDepartments();
    }
  }, [showDepartmentModal]);

  // Lade Themes beim Öffnen des Modals
  useEffect(() => {
    if (showThemeModal) {
      loadThemes();
      loadCurrentTheme();
    }
  }, [showThemeModal]);

  // Lade manuelle Workflows beim Öffnen des Modals
  useEffect(() => {
    if (showWorkflowModal) {
      loadManualWorkflows();
    }
  }, [showWorkflowModal]);

  const loadDepartments = async () => {
    try {
      setLoadingDepartments(true);
      const token = localStorage.getItem('mailclient_token');
      if (!token) return;

      const response = await fetch('/api/departments', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setDepartments(data.departments || []);
      }
    } catch (err) {
      console.error('Fehler beim Laden der Abteilungen:', err);
    } finally {
      setLoadingDepartments(false);
    }
  };

  const loadCurrentDepartments = async () => {
    // Wenn eine einzelne E-Mail ausgewählt ist, lade ihre Abteilungen
    if (selectedEmail && selectedEmailId) {
      try {
        const token = localStorage.getItem('mailclient_token');
        if (!token) return;

        const response = await fetch(`/api/emails/${selectedEmailId}/departments`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          setSelectedDepartments(data.departments?.map((d: any) => d.id) || []);
        }
      } catch (err) {
        console.error('Fehler beim Laden der E-Mail-Abteilungen:', err);
        setSelectedDepartments([]);
      }
    } else {
      // Bei Bulk-Aktionen: Leere Auswahl
      setSelectedDepartments([]);
    }
  };

  const loadManualWorkflows = async () => {
    try {
      setLoadingWorkflows(true);
      const token = localStorage.getItem('mailclient_token');
      if (!token) return;

      const response = await fetch('/api/automation-rules', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        // Filtere nur Workflows mit manuellem Trigger
        const manualWorkflows = (data.rules || []).filter((rule: any) => 
          rule.triggerType === 'manual' && rule.isActive
        );
        setWorkflows(manualWorkflows);
      }
    } catch (err) {
      console.error('Fehler beim Laden der Workflows:', err);
    } finally {
      setLoadingWorkflows(false);
    }
  };

  const handleExecuteWorkflow = async (workflowId: string) => {
    try {
      setExecutingWorkflow(workflowId);
      const token = localStorage.getItem('mailclient_token');
      if (!token) {
        toast.showError('Nicht angemeldet');
        return;
      }

      // Bestimme die E-Mail-ID
      const emailId = selectedEmailId && selectedEmail
        ? selectedEmailId
        : selectedEmails.size === 1
        ? Array.from(selectedEmails)[0]
        : null;

      if (!emailId) {
        toast.showWarning('Bitte wählen Sie eine E-Mail aus');
        return;
      }

      const response = await fetch(`/api/automation-rules/${workflowId}/execute`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          emailId: emailId,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Fehler beim Ausführen des Workflows');
      }

      const data = await response.json();
      setShowWorkflowModal(false);
      if (onRefresh) {
        onRefresh();
      }
      toast.showSuccess(`Workflow erfolgreich ausgeführt!${data.results?.executedActions?.length ? ` ${data.results.executedActions.length} Aktion(en) ausgeführt.` : ''}`);
    } catch (err: any) {
      console.error('Fehler beim Ausführen des Workflows:', err);
      toast.showError(err.message || 'Fehler beim Ausführen des Workflows');
    } finally {
      setExecutingWorkflow(null);
    }
  };

  const loadThemes = async () => {
    try {
      setLoadingThemes(true);
      const token = localStorage.getItem('mailclient_token');
      if (!token) return;

      const response = await fetch('/api/themes', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setThemes(data.themes || []);
      }
    } catch (err) {
      console.error('Fehler beim Laden der Themes:', err);
    } finally {
      setLoadingThemes(false);
    }
  };

  const loadCurrentTheme = async () => {
    // Wenn eine einzelne E-Mail ausgewählt ist, lade ihr aktuelles Theme
    if (selectedEmail && selectedEmailId) {
      // Prüfe ob selectedEmail ein theme-Objekt hat
      const emailWithTheme = emails.find(e => e.id === selectedEmailId);
      if (emailWithTheme && (emailWithTheme as any).theme) {
        setSelectedThemeId((emailWithTheme as any).theme.id);
      } else if (emailWithTheme && (emailWithTheme as any).themeId) {
        setSelectedThemeId((emailWithTheme as any).themeId);
      } else {
        setSelectedThemeId(null);
      }
    } else {
      // Für Bulk-Aktionen: Keine Vorauswahl
      setSelectedThemeId(null);
    }
  };

  const handleSaveTheme = async () => {
    try {
      setSavingTheme(true);
      const token = localStorage.getItem('mailclient_token');
      if (!token) {
        toast.showError('Nicht angemeldet');
        return;
      }

      const emailIds = selectedEmailId && selectedEmail
        ? [selectedEmailId]
        : Array.from(selectedEmails);

      if (emailIds.length === 0) {
        return;
      }

      // Aktualisiere alle ausgewählten E-Mails
      const promises = emailIds.map(async (emailId) => {
        const response = await fetch(`/api/emails/${emailId}`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            themeId: selectedThemeId || null,
          }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Fehler beim Speichern des Themes');
        }

        return response.json();
      });

      await Promise.all(promises);

      setShowThemeModal(false);
      toast.showSuccess('Thema erfolgreich zugewiesen');
      if (onRefresh) {
        onRefresh();
      }
    } catch (err: any) {
      console.error('Fehler beim Speichern des Themes:', err);
      toast.showError(err.message || 'Fehler beim Speichern des Themes');
    } finally {
      setSavingTheme(false);
    }
  };

  const handleSaveDepartments = async () => {
    try {
      setSavingDepartments(true);
      const token = localStorage.getItem('mailclient_token');
      if (!token) return;

      // Bestimme die E-Mail-IDs, die aktualisiert werden sollen
      const emailIds: string[] = [];
      if (selectedEmail && selectedEmailId) {
        emailIds.push(selectedEmailId);
      } else if (selectedEmails.size > 0) {
        emailIds.push(...Array.from(selectedEmails));
      }

      if (emailIds.length === 0) {
        return;
      }

      // Aktualisiere alle ausgewählten E-Mails
      const promises = emailIds.map(async (emailId) => {
        const response = await fetch(`/api/emails/${emailId}/departments`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            departmentIds: selectedDepartments,
          }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Fehler beim Speichern der Abteilungen');
        }

        return response.json();
      });

      await Promise.all(promises);

      setShowDepartmentModal(false);
      toast.showSuccess('Abteilungen erfolgreich zugewiesen');
      if (onDepartmentChange) {
        onDepartmentChange();
      }
      if (onRefresh) {
        onRefresh();
      }
    } catch (err: any) {
      console.error('Fehler beim Speichern der Abteilungen:', err);
      toast.showError(err.message || 'Fehler beim Speichern der Abteilungen');
    } finally {
      setSavingDepartments(false);
    }
  };

  // Im alten Design: Buttons arbeiten mit selectedEmail (eine E-Mail), nicht mit Bulk-Aktionen
  // Wenn selectedEmail vorhanden ist, verwende diese, sonst verwende Bulk-Aktionen
  const hasSelection = selectedEmailId && selectedEmail ? true : selectedEmails.size > 0;

  const handleMarkAsRead = () => {
    if (selectedEmail) {
      // Alte Funktionalität: Toggle read/unread für die ausgewählte E-Mail
      onMarkAsRead(!selectedEmail.read);
    } else if (selectedEmails.size > 0) {
      // Bulk-Aktion: Markiere alle als gelesen
      onMarkAsRead(true);
    }
  };

  const handleMarkAsUnread = () => {
    if (selectedEmail) {
      onMarkAsRead(false);
    } else if (selectedEmails.size > 0) {
      onMarkAsRead(false);
    }
  };

  const handleMarkAsCompleted = () => {
    if (selectedEmail) {
      // Toggle completed für die ausgewählte E-Mail
      onMarkAsCompleted(!selectedEmail.completed);
    } else if (selectedEmails.size > 0) {
      // Bulk-Aktion: Markiere alle als erledigt
      onMarkAsCompleted(true);
    }
  };

  const handleMarkAsImportant = () => {
    if (selectedEmail) {
      // Alte Funktionalität: Toggle important für die ausgewählte E-Mail
      onMarkAsImportant(!selectedEmail.important);
    } else if (selectedEmails.size > 0) {
      // Bulk-Aktion: Markiere alle als wichtig
      onMarkAsImportant(true);
    }
  };

  const handleMarkAsSpam = () => {
    if (selectedEmail) {
      // Alte Funktionalität: Toggle spam für die ausgewählte E-Mail
      onMarkAsSpam(!selectedEmail.spam);
    } else if (selectedEmails.size > 0) {
      // Bulk-Aktion: Markiere alle als Spam
      onMarkAsSpam(true);
    }
  };

  const handleDelete = () => {
    if (selectedEmail || selectedEmails.size > 0) {
      onDelete();
    }
  };

  return (
    <div className="px-5 py-3 border-b border-[#E5E7EB] flex items-center gap-3 flex-wrap bg-white">
      {/* Refresh Button - Icon only */}
      {onRefresh && (
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!fetching) {
              onRefresh();
            }
          }}
          disabled={fetching}
          className="p-2.5 w-11 h-8 border border-[#E5E7EB] bg-white rounded-lg cursor-pointer flex items-center justify-center transition-colors hover:bg-[#F3F4F6] disabled:opacity-50 disabled:cursor-not-allowed"
          title="E-Mails abrufen"
        >
          <FiRefreshCw className="text-[#2563EB]" size={18} />
        </button>
      )}

      {/* Neu... Dropdown Button */}
      <NewButtonDropdown customFilterId={customFilterId} onNewCompose={onNewCompose} />

      {/* Antworten Button - Dropdown wenn Telefonnotiz, sonst normaler Link; bei onReply: Callback statt Navigation */}
      <ReplyButtonDropdown
        selectedEmailId={selectedEmailId}
        selectedEmail={selectedEmail}
        customFilterId={customFilterId}
        onReply={onReply}
        currentUserId={currentUserId}
      />

      {/* Erledigen Button - Text Button */}
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (hasSelection && !markingRead && !markingSpam && !markingImportant) {
            handleMarkAsCompleted();
          }
        }}
        disabled={!hasSelection || markingRead || markingCompleted || markingSpam || markingImportant}
        className="px-4 py-2.5 h-8 border border-[#E5E7EB] bg-white rounded-lg cursor-pointer flex items-center gap-2 text-[#2563EB] font-medium transition-colors hover:bg-[#F3F4F6] disabled:opacity-50 disabled:cursor-not-allowed"
        title={selectedEmail ? (selectedEmail.completed ? 'Als nicht erledigt markieren' : 'Als erledigt markieren') : 'Als erledigt markieren'}
      >
        {markingCompleted ? (
          <span className="spinner" style={{ width: '14px', height: '14px', borderWidth: '2px' }}></span>
        ) : (
          <>
            <FiCheckCircle size={16} className="text-[#10B981]" />
            <span>Erledigen</span>
          </>
        )}
      </button>

      {/* Wichtig Button - Icon only */}
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (hasSelection && !markingRead && !markingSpam && !markingImportant) {
            handleMarkAsImportant();
          }
        }}
        disabled={!hasSelection || markingRead || markingCompleted || markingSpam || markingImportant}
        className="p-2.5 w-11 h-8 border border-[#E5E7EB] bg-white rounded-lg cursor-pointer flex items-center justify-center transition-colors hover:bg-[#F3F4F6] disabled:opacity-50 disabled:cursor-not-allowed"
        title={selectedEmail ? (selectedEmail.important ? 'Wichtig-Markierung entfernen' : 'Als wichtig markieren') : 'Als wichtig markieren'}
      >
        {markingImportant ? (
          <span className="spinner" style={{ width: '14px', height: '14px', borderWidth: '2px' }}></span>
        ) : (
          <FiStar 
            className={selectedEmail?.important ? 'text-[#FBBF24] fill-[#FBBF24]' : 'text-[#6B7280]'} 
            size={18} 
          />
        )}
      </button>

      {/* Spam Button - Icon only */}
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (hasSelection && !markingRead && !markingSpam && !markingImportant) {
            handleMarkAsSpam();
          }
        }}
        disabled={!hasSelection || markingRead || markingCompleted || markingSpam || markingImportant}
        className="p-2.5 w-11 h-8 border border-[#E5E7EB] bg-white rounded-lg cursor-pointer flex items-center justify-center transition-colors hover:bg-[#F3F4F6] disabled:opacity-50 disabled:cursor-not-allowed"
        title={selectedEmail ? (selectedEmail.spam ? 'Spam-Markierung entfernen' : 'Als Spam markieren') : 'Als Spam markieren'}
      >
        {markingSpam ? (
          <span className="spinner" style={{ width: '14px', height: '14px', borderWidth: '2px' }}></span>
        ) : (
          <FiAlertTriangle 
            className={selectedEmail?.spam ? 'text-[#DC2626]' : 'text-[#6B7280]'} 
            size={18} 
          />
        )}
      </button>

      {/* Löschen/Wiederherstellen Button - Icon only */}
      {selectedEmail?.deleted ? (
        onRestore ? (
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (hasSelection && !markingRead && !markingSpam && !markingImportant) {
                onRestore();
              }
            }}
            disabled={!hasSelection || markingRead || markingCompleted || markingSpam || markingImportant}
            className="p-2.5 w-11 h-8 border border-[#E5E7EB] bg-white rounded-lg cursor-pointer flex items-center justify-center transition-colors hover:bg-[#F3F4F6] disabled:opacity-50 disabled:cursor-not-allowed"
            title="E-Mail wiederherstellen"
          >
            <FiRotateCcw className="text-[#28a745]" size={18} />
          </button>
        ) : null
      ) : (
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (hasSelection && !markingRead && !markingSpam && !markingImportant) {
              handleDelete();
            }
          }}
          disabled={!hasSelection || markingRead || markingCompleted || markingSpam || markingImportant}
          className="p-2.5 w-11 h-8 border border-[#E5E7EB] bg-white rounded-lg cursor-pointer flex items-center justify-center transition-colors hover:bg-[#F3F4F6] disabled:opacity-50 disabled:cursor-not-allowed"
          title="Löschen"
        >
          <FiTrash2 className="text-[#DC2626]" size={18} />
        </button>
      )}

      {/* Mehr Dropdown */}
      <div className="relative ml-auto" ref={dropdownRef}>
        <button
          onClick={() => setShowMoreDropdown(!showMoreDropdown)}
          disabled={!hasSelection}
          className="px-4 py-2.5 h-8 border border-[#E5E7EB] bg-white rounded-lg cursor-pointer flex items-center gap-2 transition-colors hover:bg-[#F3F4F6] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span>⋮</span>
          <span>Mehr</span>
        </button>

        {showMoreDropdown && (
          <div className="absolute right-0 top-full mt-1 bg-white min-w-[220px] shadow-[0px_8px_16px_rgba(0,0,0,0.1)] rounded-lg z-[100] border border-[#E5E7EB]">
            <button
              onClick={() => {
                handleMarkAsRead();
                setShowMoreDropdown(false);
              }}
              disabled={!hasSelection || markingRead || markingCompleted || markingSpam || markingImportant}
              className="w-full flex justify-start items-center gap-2 px-4 py-3 border-none bg-transparent text-left rounded-none transition-colors hover:bg-[#F3F4F6] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FiMail size={16} />
              <span>Gelesen markieren</span>
            </button>
            <button
              onClick={() => {
                handleMarkAsUnread();
                setShowMoreDropdown(false);
              }}
              disabled={!hasSelection || markingRead || markingCompleted || markingSpam || markingImportant}
              className="w-full flex justify-start items-center gap-2 px-4 py-3 border-none bg-transparent text-left rounded-none transition-colors hover:bg-[#F3F4F6] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FiMail size={16} />
              <span>Ungelesen markieren</span>
            </button>
            <button
              onClick={() => {
                setShowMoreDropdown(false);
                setShowDepartmentModal(true);
              }}
              disabled={!hasSelection}
              className="w-full flex justify-start items-center gap-2 px-4 py-3 border-none bg-transparent text-left rounded-none transition-colors hover:bg-[#F3F4F6] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FiBriefcase size={16} />
              <span>Abteilung verschieben</span>
            </button>
            <button
              onClick={() => {
                setShowMoreDropdown(false);
                setShowThemeModal(true);
              }}
              disabled={!hasSelection}
              className="w-full flex justify-start items-center gap-2 px-4 py-3 border-none bg-transparent text-left rounded-none transition-colors hover:bg-[#F3F4F6] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FiTag size={16} />
              <span>Thema zuweisen</span>
            </button>
            <button
              onClick={() => {
                setShowMoreDropdown(false);
                setShowTicketIdModal(true);
              }}
              disabled={!hasSelection}
              className="w-full flex justify-start items-center gap-2 px-4 py-3 border-none bg-transparent text-left rounded-none transition-colors hover:bg-[#F3F4F6] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FiHash size={16} />
              <span>Ticket-ID verwalten</span>
            </button>
            <button
              onClick={() => {
                // TODO: Implementiere Drucken
                window.print();
                setShowMoreDropdown(false);
              }}
              disabled={!hasSelection}
              className="w-full flex justify-start items-center gap-2 px-4 py-3 border-none bg-transparent text-left rounded-none transition-colors hover:bg-[#F3F4F6] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FiPrinter size={16} />
              <span>Drucken</span>
            </button>
            <div className="border-t border-[#E5E7EB] my-1"></div>
            <button
              onClick={() => {
                setShowMoreDropdown(false);
                setShowWorkflowModal(true);
              }}
              disabled={!hasSelection || (selectedEmails.size > 1 && !selectedEmailId)}
              className="w-full flex justify-start items-center gap-2 px-4 py-3 border-none bg-transparent text-left rounded-none transition-colors hover:bg-[#F3F4F6] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FiZap size={16} style={{ color: '#8B5CF6' }} />
              <span>Workflow ausführen</span>
            </button>
          </div>
        )}
      </div>

      {/* Abteilungs-Modal */}
      <Modal
        isOpen={showDepartmentModal}
        onClose={() => setShowDepartmentModal(false)}
        title="Abteilung verschieben"
        maxWidth="md"
      >
        <p className="text-sm text-[#6B7280] mb-4">
                {selectedEmail && selectedEmailId
                  ? 'Wählen Sie die Abteilungen für diese E-Mail aus:'
                  : `Wählen Sie die Abteilungen für ${selectedEmails.size} E-Mail${selectedEmails.size > 1 ? 's' : ''} aus:`}
              </p>

              {loadingDepartments ? (
                <div className="flex items-center justify-center py-8">
                  <div className="spinner" style={{ width: '24px', height: '24px' }}></div>
                </div>
              ) : departments.length === 0 ? (
                <p className="text-[#6B7280] py-4">Keine Abteilungen verfügbar.</p>
              ) : (
                <div className="max-h-64 overflow-y-auto mb-4">
                  {departments.map((department) => {
                    const isChecked = selectedDepartments.includes(department.id);
                    return (
                      <label
                        key={department.id}
                        className="flex items-start gap-3 p-3 rounded-lg hover:bg-[#F3F4F6] cursor-pointer transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedDepartments([...selectedDepartments, department.id]);
                            } else {
                              setSelectedDepartments(selectedDepartments.filter(id => id !== department.id));
                            }
                          }}
                          className="mt-1 w-4 h-4 cursor-pointer"
                        />
                        <div className="flex-1">
                          <div className="font-medium text-[#1F2937]">
                            <FiBriefcase size={16} className="inline mr-1" />
                            {department.name}
                          </div>
                          {department.description && (
                            <div className="text-sm text-[#6B7280] mt-1">
                              {department.description}
                            </div>
                          )}
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowDepartmentModal(false)}
                  className="px-4 py-2 border border-[#E5E7EB] bg-white rounded-lg text-sm font-medium text-[#1F2937] hover:bg-[#F3F4F6] transition-colors"
                  disabled={savingDepartments}
                >
                  Abbrechen
                </button>
                <button
                  onClick={handleSaveDepartments}
                  disabled={savingDepartments || loadingDepartments}
                  className="px-4 py-2 bg-[#2563EB] text-white rounded-lg text-sm font-medium hover:bg-[#1D4ED8] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {savingDepartments ? 'Speichere...' : 'Speichern'}
                </button>
              </div>
      </Modal>

      {/* Theme-Modal */}
      <Modal
        isOpen={showThemeModal}
        onClose={() => setShowThemeModal(false)}
        title="Thema zuweisen"
        maxWidth="md"
      >
        <p className="text-sm text-[#6B7280] mb-4">
          {selectedEmail && selectedEmailId
            ? 'Wählen Sie ein Thema für diese E-Mail aus:'
            : `Wählen Sie ein Thema für ${selectedEmails.size} E-Mail${selectedEmails.size > 1 ? 's' : ''} aus:`}
        </p>

        {loadingThemes ? (
          <div className="flex items-center justify-center py-8">
            <div className="spinner" style={{ width: '24px', height: '24px' }}></div>
          </div>
        ) : themes.length === 0 ? (
          <p className="text-[#6B7280] py-4">Keine Themes verfügbar.</p>
        ) : (
          <div className="max-h-64 overflow-y-auto mb-4">
            <label
              className="flex items-start gap-3 p-3 rounded-lg hover:bg-[#F3F4F6] cursor-pointer transition-colors"
            >
              <input
                type="radio"
                name="theme"
                checked={selectedThemeId === null}
                onChange={() => setSelectedThemeId(null)}
                className="mt-1 w-4 h-4 cursor-pointer"
              />
              <div className="flex-1">
                <div className="font-medium text-[#1F2937]">
                  Kein Thema
                </div>
              </div>
            </label>
            {themes.map((theme) => {
              const isChecked = selectedThemeId === theme.id;
              return (
                <label
                  key={theme.id}
                  className="flex items-start gap-3 p-3 rounded-lg hover:bg-[#F3F4F6] cursor-pointer transition-colors"
                >
                  <input
                    type="radio"
                    name="theme"
                    checked={isChecked}
                    onChange={() => setSelectedThemeId(theme.id)}
                    className="mt-1 w-4 h-4 cursor-pointer"
                  />
                  <div className="flex-1 flex items-center gap-2">
                    {theme.color && (
                      <div
                        className="w-4 h-4 rounded"
                        style={{ backgroundColor: theme.color }}
                      />
                    )}
                    <div className="font-medium text-[#1F2937]">
                      {theme.name}
                    </div>
                  </div>
                </label>
              );
            })}
          </div>
        )}

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={() => setShowThemeModal(false)}
            className="px-4 py-2 border border-[#E5E7EB] bg-white rounded-lg text-sm font-medium text-[#1F2937] hover:bg-[#F3F4F6] transition-colors"
            disabled={savingTheme}
          >
            Abbrechen
          </button>
          <button
            onClick={handleSaveTheme}
            disabled={savingTheme || loadingThemes}
            className="px-4 py-2 bg-[#2563EB] text-white rounded-lg text-sm font-medium hover:bg-[#1D4ED8] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {savingTheme ? 'Speichere...' : 'Speichern'}
          </button>
        </div>
      </Modal>

      {/* Workflow-Modal */}
      {showWorkflowModal && (
        <>
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              zIndex: 9998,
            }}
            onClick={() => setShowWorkflowModal(false)}
          />
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 9999,
              pointerEvents: 'none',
            }}
          >
            <div
              className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full mx-4"
              style={{ pointerEvents: 'auto' }}
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-xl font-semibold mb-4 text-[#1F2937]">
                Workflow ausführen
              </h2>
              <p className="text-sm text-[#6B7280] mb-4">
                {selectedEmail && selectedEmailId
                  ? 'Wählen Sie einen Workflow aus, der für diese E-Mail ausgeführt werden soll:'
                  : 'Wählen Sie einen Workflow aus, der für die ausgewählte E-Mail ausgeführt werden soll:'}
              </p>

              {loadingWorkflows ? (
                <div className="flex items-center justify-center py-8">
                  <div className="spinner" style={{ width: '24px', height: '24px' }}></div>
                </div>
              ) : workflows.length === 0 ? (
                <p className="text-[#6B7280] py-4">Keine manuellen Workflows verfügbar.</p>
              ) : (
                <div className="max-h-64 overflow-y-auto mb-4">
                  {workflows.map((workflow) => {
                    const isExecuting = executingWorkflow === workflow.id;
                    return (
                      <button
                        key={workflow.id}
                        onClick={() => handleExecuteWorkflow(workflow.id)}
                        disabled={isExecuting || !!executingWorkflow}
                        className="w-full flex items-start gap-3 p-3 rounded-lg hover:bg-[#F3F4F6] cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-left"
                      >
                        <FiZap 
                          size={20} 
                          style={{ 
                            color: '#8B5CF6',
                            flexShrink: 0,
                            marginTop: '2px'
                          }} 
                        />
                        <div className="flex-1">
                          <div className="font-medium text-[#1F2937]">
                            {workflow.name}
                          </div>
                          {workflow.description && (
                            <div className="text-sm text-[#6B7280] mt-1">
                              {workflow.description}
                            </div>
                          )}
                        </div>
                        {isExecuting && (
                          <div className="spinner" style={{ width: '16px', height: '16px', flexShrink: 0 }}></div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowWorkflowModal(false)}
                  className="px-4 py-2 border border-[#E5E7EB] bg-white rounded-lg text-sm font-medium text-[#1F2937] hover:bg-[#F3F4F6] transition-colors"
                  disabled={!!executingWorkflow}
                >
                  Abbrechen
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Ticket-ID Verwaltungs-Modal */}
      <TicketIdManagementModal
        isOpen={showTicketIdModal}
        onClose={() => setShowTicketIdModal(false)}
        selectedEmailIds={selectedEmailId && selectedEmail ? [selectedEmailId] : Array.from(selectedEmails)}
        onSuccess={() => {
          if (onRefresh) {
            onRefresh();
          }
        }}
      />
    </div>
  );
}

