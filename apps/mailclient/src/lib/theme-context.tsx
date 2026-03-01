'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'classic' | 'modern';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  isHydrated: boolean; // Wichtig für SSR: zeigt an, ob Theme geladen wurde
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = 'mailclient_theme';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Default: 'classic' für SSR (verhindert Hydration-Mismatch)
  const [theme, setThemeState] = useState<Theme>('classic');
  const [isHydrated, setIsHydrated] = useState(false);

  // Lade Theme aus localStorage nur client-side (nach Hydration)
  useEffect(() => {
    try {
      const storedTheme = localStorage.getItem(THEME_STORAGE_KEY) as Theme | null;
      if (storedTheme === 'classic' || storedTheme === 'modern') {
        setThemeState(storedTheme);
        updateBodyClass(storedTheme);
      } else {
        // Default: classic
        setThemeState('classic');
        updateBodyClass('classic');
      }
    } catch (error) {
      console.error('Fehler beim Laden des Themes:', error);
      setThemeState('classic');
      updateBodyClass('classic');
    } finally {
      setIsHydrated(true);
    }
  }, []);

  const updateBodyClass = (newTheme: Theme) => {
    if (typeof document !== 'undefined') {
      document.body.classList.remove('theme-classic', 'theme-modern');
      document.body.classList.add(`theme-${newTheme}`);
    }
  };

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    updateBodyClass(newTheme);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, newTheme);
    } catch (error) {
      console.error('Fehler beim Speichern des Themes:', error);
    }
  };

  const toggleTheme = () => {
    const newTheme = theme === 'classic' ? 'modern' : 'classic';
    setTheme(newTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme, isHydrated }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}


