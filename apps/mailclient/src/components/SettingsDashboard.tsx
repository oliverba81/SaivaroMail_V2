'use client';

import { useState, type ReactNode } from 'react';
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
import Card from './Card';

const DEFAULT_CARD_ORDER = ['accounts', 'general', 'filters', 'themes', 'automation', 'users', 'departments', 'contacts'] as const;

interface SettingsDashboardProps {
  onCategoryClick: (category: string) => void;
  cardOrder?: string[];
  onCardOrderChange?: (order: string[]) => void;
}

interface CategoryCard {
  id: string;
  title: string;
  description: string;
  icon: ReactNode;
}

export default function SettingsDashboard({
  onCategoryClick,
  cardOrder,
  onCardOrderChange,
}: SettingsDashboardProps) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const categories: CategoryCard[] = [
    {
      id: 'accounts',
      title: 'E-Mail Konten',
      description: 'IMAP/SMTP-Konten verwalten und konfigurieren',
      icon: <FiMail size={32} />,
    },
    {
      id: 'general',
      title: 'Allgemeine Einstellungen',
      description: 'Abruf-Intervalle und grundlegende Optionen',
      icon: <FiSettings size={32} />,
    },
    {
      id: 'filters',
      title: 'Filter',
      description: 'E-Mail-Filter und automatische Organisation',
      icon: <FiSearch size={32} />,
    },
    {
      id: 'themes',
      title: 'Themen',
      description: 'E-Mail-Themen und Kategorien verwalten',
      icon: <FiTag size={32} />,
    },
    {
      id: 'automation',
      title: 'Automatisierung',
      description: 'Workflows und Automatisierungsregeln',
      icon: <FiZap size={32} />,
    },
    {
      id: 'users',
      title: 'Benutzer',
      description: 'Benutzerverwaltung und Berechtigungen',
      icon: <FiUsers size={32} />,
    },
    {
      id: 'departments',
      title: 'Abteilungen',
      description: 'Abteilungen und Organisationsstruktur',
      icon: <FiBriefcase size={32} />,
    },
    {
      id: 'contacts',
      title: 'Kontakte',
      description: 'Kontakte verwalten (Telefon, E-Mail, Anschriften)',
      icon: <FiBook size={32} />,
    },
  ];

  // Sortiere Kategorien nach cardOrder (DEFAULT_CARD_ORDER wenn nicht gesetzt)
  const effectiveOrder = cardOrder ?? [...DEFAULT_CARD_ORDER];
  const sortedCategories = [...categories].sort((a, b) => {
    const indexA = effectiveOrder.indexOf(a.id);
    const indexB = effectiveOrder.indexOf(b.id);
    if (indexA === -1 && indexB === -1) return 0;
    if (indexA === -1) return 1;
    if (indexB === -1) return -1;
    return indexA - indexB;
  });

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

    const newOrder = [...sortedCategories];
    const draggedCategory = newOrder[draggedIndex];
    newOrder.splice(draggedIndex, 1);
    newOrder.splice(dropIndex, 0, draggedCategory);

    const newCardOrder = newOrder.map((c) => c.id);
    if (onCardOrderChange) {
      onCardOrderChange(newCardOrder);
    }

    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  // Grid-Klassen
  const gridClasses = 'grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-6 mb-8';

  return (
    <div className={gridClasses}>
      {sortedCategories.map((category, index) => {
        return (
          <Card
            key={category.id}
            className={`relative overflow-hidden border transition-all hover:-translate-y-1 hover:shadow-lg cursor-grab min-h-[200px] ${
              dragOverIndex === index ? 'border-primary border-2' : 'border-gray-200'
            } ${draggedIndex === index ? 'opacity-50' : ''}`}
            onClick={() => onCategoryClick(category.id)}
          >
            <div
              draggable
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, index)}
              onDragEnd={handleDragEnd}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onCategoryClick(category.id);
                }
              }}
              aria-label={`${category.title} öffnen`}
              className="flex flex-col h-full"
            >
              <div className="mb-4 flex items-center justify-center w-16 h-16 rounded-xl bg-gradient-to-br from-blue-50 to-blue-100 text-primary">
                {category.icon}
              </div>
              <div className="text-lg font-semibold text-gray-800 mb-2">
                {category.title}
              </div>
              <div className="text-sm text-gray-500 mb-4 leading-relaxed">
                {category.description}
              </div>
            </div>
            {/* Hover-Effekt Linie oben */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary to-primary-hover transform scale-x-0 transition-transform duration-300 group-hover:scale-x-100" />
          </Card>
        );
      })}
    </div>
  );
}

