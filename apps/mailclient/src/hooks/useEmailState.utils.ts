/**
 * Hilfsfunktionen und Konstanten für useEmailState (ausgelagert für Parse-Zeit und Wartbarkeit).
 */
import { safeLocalStorage } from '@/utils/browser-compat';

export const defaultTableColumns = [
  { id: 'checkbox', label: '', visible: true, order: 0 },
  { id: 'attachment', label: 'Anhang', visible: true, order: 1 },
  { id: 'important', label: 'Wichtig', visible: true, order: 2 },
  { id: 'spam', label: 'Spam', visible: true, order: 3 },
  { id: 'deleted', label: 'Gelöscht', visible: true, order: 4 },
  { id: 'subject', label: 'Betreff', visible: true, order: 5 },
  { id: 'participants', label: 'Beteiligte', visible: true, order: 6 },
  { id: 'date', label: 'Datum', visible: true, order: 7 },
  { id: 'from_cb', label: 'Von (CB)', visible: true, order: 8 },
  { id: 'recipient', label: 'Empfänger...', visible: true, order: 9 },
  { id: 'theme', label: 'Thema', visible: true, order: 10, width: '120px' },
  { id: 'department', label: 'Abteilung', visible: true, order: 11, width: '150px' },
];

export const formatDateForTable = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  return `${day}.${month}.${year} ${hours}:${minutes}`;
};

export const formatDateForPreview = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleString('de-DE', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const FILTER_STORAGE_KEY = 'mailclient_lastFilter';
export const CUSTOM_FILTER_STORAGE_KEY = 'mailclient_lastCustomFilter';

export const saveFilterToStorage = (filter: string) => {
  if (filter && filter !== 'all') {
    safeLocalStorage.setItem(FILTER_STORAGE_KEY, filter);
    safeLocalStorage.removeItem(CUSTOM_FILTER_STORAGE_KEY);
  } else {
    safeLocalStorage.removeItem(FILTER_STORAGE_KEY);
  }
};

export const saveCustomFilterToStorage = (filterId: string | null) => {
  if (filterId) {
    safeLocalStorage.setItem(CUSTOM_FILTER_STORAGE_KEY, filterId);
    safeLocalStorage.removeItem(FILTER_STORAGE_KEY);
  } else {
    safeLocalStorage.removeItem(CUSTOM_FILTER_STORAGE_KEY);
  }
};
