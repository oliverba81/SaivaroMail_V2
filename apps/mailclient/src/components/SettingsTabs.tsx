'use client';

import { 
  FiMail, 
  FiSettings, 
  FiSearch, 
  FiTag, 
  FiZap, 
  FiUsers, 
  FiBriefcase,
  FiBook
} from 'react-icons/fi';

type SettingsTab = 'accounts' | 'general' | 'filters' | 'themes' | 'automation' | 'users' | 'departments' | 'contacts';

interface SettingsTabsProps {
  activeTab: SettingsTab;
  onTabChange: (tab: SettingsTab) => void;
}

export default function SettingsTabs({ activeTab, onTabChange }: SettingsTabsProps) {
  const tabButtonClasses = (tab: SettingsTab) => {
    const base = 'px-6 py-3 border-none bg-transparent cursor-pointer -mb-0.5 transition-colors';
    const active = activeTab === tab
      ? 'border-b-2 border-primary text-primary font-semibold'
      : 'border-b-2 border-transparent text-gray-500 font-normal hover:text-gray-700';
    return `${base} ${active}`;
  };

  return (
    <div className="flex gap-2 mb-6 border-b-2 border-gray-200">
      <button
        onClick={() => onTabChange('accounts')}
        className={tabButtonClasses('accounts')}
      >
        <FiMail size={16} className="inline mr-2" />
        E-Mail Konten
      </button>
      <button
        onClick={() => onTabChange('general')}
        className={tabButtonClasses('general')}
      >
        <FiSettings size={16} className="inline mr-2" />
        Allgemein
      </button>
      <button
        onClick={() => onTabChange('filters')}
        className={tabButtonClasses('filters')}
      >
        <FiSearch size={16} className="inline mr-2" />
        Filter
      </button>
      <button
        onClick={() => onTabChange('themes')}
        className={tabButtonClasses('themes')}
      >
        <FiTag size={16} className="inline mr-2" />
        Themen
      </button>
      <button
        onClick={() => onTabChange('automation')}
        className={tabButtonClasses('automation')}
      >
        <FiZap size={16} className="inline mr-2" />
        Automatisierung
      </button>
      <button
        onClick={() => onTabChange('users')}
        className={tabButtonClasses('users')}
      >
        <FiUsers size={16} className="inline mr-2" />
        Benutzer
      </button>
      <button
        onClick={() => onTabChange('departments')}
        className={tabButtonClasses('departments')}
      >
        <FiBriefcase size={16} className="inline mr-2" />
        Abteilungen
      </button>
      <button
        onClick={() => onTabChange('contacts')}
        className={tabButtonClasses('contacts')}
      >
        <FiBook size={16} className="inline mr-2" />
        Kontakte
      </button>
    </div>
  );
}

