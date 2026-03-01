'use client';

import {
  FiSearch,
  FiMail,
  FiTag,
  FiBriefcase,
  FiStar,
  FiInbox,
  FiZap,
  FiBookmark,
  FiFolder,
  FiHash,
  FiSend,
  FiCheckCircle,
  FiAlertTriangle,
} from 'react-icons/fi';

/** Verfügbare Filter-Icons (Feather-Icons, einheitlich in der App) */
export const FILTER_ICON_OPTIONS = [
  { id: 'search', Icon: FiSearch, label: 'Suche' },
  { id: 'mail', Icon: FiMail, label: 'Mail' },
  { id: 'tag', Icon: FiTag, label: 'Thema' },
  { id: 'briefcase', Icon: FiBriefcase, label: 'Arbeit' },
  { id: 'star', Icon: FiStar, label: 'Wichtig' },
  { id: 'inbox', Icon: FiInbox, label: 'Posteingang' },
  { id: 'zap', Icon: FiZap, label: 'Automatisierung' },
  { id: 'bookmark', Icon: FiBookmark, label: 'Lesezeichen' },
  { id: 'folder', Icon: FiFolder, label: 'Ordner' },
  { id: 'hash', Icon: FiHash, label: 'Ticket' },
  { id: 'send', Icon: FiSend, label: 'Gesendet' },
  { id: 'check', Icon: FiCheckCircle, label: 'Erledigt' },
  { id: 'alert', Icon: FiAlertTriangle, label: 'Hinweis' },
] as const;

export type FilterIconId = (typeof FILTER_ICON_OPTIONS)[number]['id'];

const ICON_MAP = Object.fromEntries(
  FILTER_ICON_OPTIONS.map(({ id, Icon }) => [id, Icon])
) as Record<string, React.ComponentType<{ size?: number; style?: React.CSSProperties; className?: string }>>;

const DEFAULT_ICON = FiSearch;

interface FilterIconProps {
  icon: string;
  size?: number;
  style?: React.CSSProperties;
  className?: string;
}

/** Zeigt das passende Symbol für einen Filter (Feather-Icon). Leere/ungültige Werte → Suche. */
export function FilterIcon({ icon, size = 20, style, className }: FilterIconProps) {
  const normalized = (icon || '').toLowerCase().trim();
  const ResolvedIcon =
    ICON_MAP[normalized] ||
    (normalized === '🔍' ? FiSearch : null) ||
    DEFAULT_ICON;
  return <ResolvedIcon size={size} style={style} className={className} />;
}
