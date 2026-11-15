'use client';

import * as React from 'react';
import { ThemeProvider as NextThemesProvider } from 'next-themes';
import type { SupportedLanguage } from '@/types/domain';

interface UIPreferencesContextValue {
  language: SupportedLanguage;
  setLanguage: (lang: SupportedLanguage) => void;
  toggleLanguage: () => void;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebar: () => void;
}

const UIPreferencesContext = React.createContext<UIPreferencesContextValue | undefined>(undefined);

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = React.useState<SupportedLanguage>('en');
  const [sidebarCollapsed, setSidebarCollapsedState] = React.useState(false);

  React.useEffect(() => {
    try {
      const savedLang = window.localStorage.getItem('learnmate-lang');
      if (savedLang === 'en' || savedLang === 'bn') {
        setLanguageState(savedLang);
      }
      const savedSidebar = window.localStorage.getItem('learnmate-sidebar-collapsed');
      if (savedSidebar === 'true') {
        setSidebarCollapsedState(true);
      }
    } catch {
      // Ignore storage access errors in restricted frames
    }
  }, []);

  const setLanguage = React.useCallback((lang: SupportedLanguage) => {
    setLanguageState(lang);
    try {
      window.localStorage.setItem('learnmate-lang', lang);
      document.documentElement.lang = lang;
    } catch {
      // Ignore storage write errors
    }
  }, []);

  const toggleLanguage = React.useCallback(() => {
    setLanguage(language === 'en' ? 'bn' : 'en');
  }, [language, setLanguage]);

  const setSidebarCollapsed = React.useCallback((collapsed: boolean) => {
    setSidebarCollapsedState(collapsed);
    try {
      window.localStorage.setItem('learnmate-sidebar-collapsed', String(collapsed));
    } catch {
      // Ignore storage write errors
    }
  }, []);

  const toggleSidebar = React.useCallback(() => {
    setSidebarCollapsed(!sidebarCollapsed);
  }, [sidebarCollapsed, setSidebarCollapsed]);

  const value = React.useMemo(
    () => ({
      language,
      setLanguage,
      toggleLanguage,
      sidebarCollapsed,
      setSidebarCollapsed,
      toggleSidebar,
    }),
    [language, setLanguage, toggleLanguage, sidebarCollapsed, setSidebarCollapsed, toggleSidebar],
  );

  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <UIPreferencesContext.Provider value={value}>{children}</UIPreferencesContext.Provider>
    </NextThemesProvider>
  );
}

export function useUIPreferences(): UIPreferencesContextValue {
  const ctx = React.useContext(UIPreferencesContext);
  if (!ctx) {
    throw new Error('useUIPreferences must be used within AppProviders');
  }
  return ctx;
}
