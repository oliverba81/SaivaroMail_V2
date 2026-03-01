/**
 * Zentrale Definitionen für Standard-Abteilungen
 * Wird von API-Routen, Frontend-Komponenten und anderen Services verwendet
 */

export interface DepartmentDefinition {
  name: string;
  description: string;
}

/**
 * Standard-Firmenabteilungen
 */
export const BUSINESS_DEPARTMENTS: DepartmentDefinition[] = [
  { 
    name: 'Geschäftsführung', 
    description: 'Strategische Leitung und Geschäftsführung des Unternehmens' 
  },
  { 
    name: 'Buchhaltung', 
    description: 'Finanzen, Rechnungswesen und Controlling' 
  },
  { 
    name: 'Marketing', 
    description: 'Marketing, Werbung und Öffentlichkeitsarbeit' 
  },
  { 
    name: 'Einkauf', 
    description: 'Beschaffung und Lieferantenmanagement' 
  },
  { 
    name: 'Logistik', 
    description: 'Lager, Versand und Distribution' 
  },
  { 
    name: 'Kundenservice', 
    description: 'Kundenbetreuung und Support' 
  },
];

/**
 * Private Abteilungen für familiäre E-Mail-Nutzung
 */
export const PRIVATE_DEPARTMENTS: DepartmentDefinition[] = [
  { 
    name: 'Familie', 
    description: 'Zentrale Abteilung für familiäre E-Mail-Kommunikation und gemeinsame Nachrichten' 
  },
  { 
    name: 'Elternteil 1', 
    description: 'Persönliche E-Mail-Abteilung für Elternteil 1' 
  },
  { 
    name: 'Elternteil 2', 
    description: 'Persönliche E-Mail-Abteilung für Elternteil 2' 
  },
  { 
    name: 'Kind 1', 
    description: 'Persönliche E-Mail-Abteilung für Kind 1' 
  },
  { 
    name: 'Kind 2', 
    description: 'Persönliche E-Mail-Abteilung für Kind 2' 
  },
  { 
    name: 'Kind 3', 
    description: 'Persönliche E-Mail-Abteilung für Kind 3' 
  },
];
