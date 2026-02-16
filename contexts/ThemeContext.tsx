import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import { DateFormat, TimeFormat, SidebarGameScale } from '../types';

export type Theme =
  | 'light'
  | 'dark'
  | 'nord'
  | 'gruvbox'
  | 'tokyo-night'
  | 'everforest'
  | 'dracula'
  | 'catppuccin'
  | 'github-dark'
  | 'solarized-dark'
  | 'one-dark';
export type GamesViewMode = 'grid' | 'list';

const DEFAULT_SIDEBAR_WIDTH = 288;

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  sidebarWidth: number;
  setSidebarWidth: (width: number) => void;
  sidebarGameScale: SidebarGameScale;
  setSidebarGameScale: (scale: SidebarGameScale) => void;
  sidebarMarquee: boolean;
  setSidebarMarquee: (marquee: boolean) => void;
  dateFormat: DateFormat;
  setDateFormat: (format: DateFormat) => void;
  timeFormat: TimeFormat;
  setTimeFormat: (format: TimeFormat) => void;
  gamesViewMode: GamesViewMode;
  setGamesViewMode: (mode: GamesViewMode) => void;
  hideHiddenAchievements: boolean;
  setHideHiddenAchievements: (enabled: boolean) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<Theme>('dark');
  const [sidebarWidth, setSidebarWidthState] = useState<number>(DEFAULT_SIDEBAR_WIDTH);
  const [sidebarGameScale, setSidebarGameScaleState] = useState<SidebarGameScale>('md');
  const [sidebarMarquee, setSidebarMarqueeState] = useState<boolean>(false);
  const [dateFormat, setDateFormatState] = useState<DateFormat>('DD/MM/YYYY');
  const [timeFormat, setTimeFormatState] = useState<TimeFormat>('24h');
  const [gamesViewMode, setGamesViewModeState] = useState<GamesViewMode>('grid');
  const [hideHiddenAchievements, setHideHiddenAchievementsState] = useState<boolean>(true);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        if ((window as any).electronAPI) {
          const settings = await (window as any).electronAPI.loadSettings();
          if (settings.theme) setThemeState(settings.theme as Theme);
          if (settings.sidebarWidth) setSidebarWidthState(Number(settings.sidebarWidth));
          if (settings.sidebarGameScale) setSidebarGameScaleState(settings.sidebarGameScale);
          if (settings.sidebarMarquee !== undefined) setSidebarMarqueeState(settings.sidebarMarquee);
          if (settings.dateFormat) setDateFormatState(settings.dateFormat);
          if (settings.timeFormat) setTimeFormatState(settings.timeFormat);
          if (settings.gamesViewMode) setGamesViewModeState(settings.gamesViewMode);
          if (settings.hideHiddenAchievements !== undefined) {
            setHideHiddenAchievementsState(settings.hideHiddenAchievements);
          }
        } else {
          const savedTheme = localStorage.getItem('app_theme') as Theme | null;
          if (savedTheme) setThemeState(savedTheme);
          const savedSidebarWidth = localStorage.getItem('app_sidebar_width');
          if (savedSidebarWidth) setSidebarWidthState(Number(savedSidebarWidth));
          // ... (others fallbacks if needed)
        }
      } catch (error) {
        console.error('Error loading settings:', error);
      }
    };
    loadSettings();
  }, []);

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove(
      'light',
      'dark',
      'nord',
      'gruvbox',
      'tokyo-night',
      'everforest',
      'dracula',
      'catppuccin',
      'github-dark',
      'solarized-dark',
      'one-dark'
    );
    root.classList.add(theme);
  }, [theme]);

  const saveSettings = async (updates: Partial<ThemeContextType>) => {
    const currentSettings = {
      theme,
      sidebarWidth,
      sidebarGameScale,
      sidebarMarquee,
      dateFormat,
      timeFormat,
      gamesViewMode,
      hideHiddenAchievements,
      ...updates
    };

    try {
      if ((window as any).electronAPI) {
        await (window as any).electronAPI.saveSettings(currentSettings);
      } else {
        Object.entries(updates).forEach(([key, value]) => {
          localStorage.setItem(`app_${key}`, String(value));
        });
      }
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  };

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    saveSettings({ theme: newTheme } as any);
  };

  const setSidebarWidth = (newWidth: number) => {
    setSidebarWidthState(newWidth);
    saveSettings({ sidebarWidth: newWidth } as any);
  };

  const setSidebarGameScale = (newScale: SidebarGameScale) => {
    setSidebarGameScaleState(newScale);
    saveSettings({ sidebarGameScale: newScale } as any);
  };

  const setSidebarMarquee = (newMarquee: boolean) => {
    setSidebarMarqueeState(newMarquee);
    saveSettings({ sidebarMarquee: newMarquee } as any);
  };

  const setDateFormat = (newFormat: DateFormat) => {
    setDateFormatState(newFormat);
    saveSettings({ dateFormat: newFormat } as any);
  };

  const setTimeFormat = (newFormat: TimeFormat) => {
    setTimeFormatState(newFormat);
    saveSettings({ timeFormat: newFormat } as any);
  };

  const setGamesViewMode = (newMode: GamesViewMode) => {
    setGamesViewModeState(newMode);
    saveSettings({ gamesViewMode: newMode } as any);
  };

  const setHideHiddenAchievements = (enabled: boolean) => {
    setHideHiddenAchievementsState(enabled);
    saveSettings({ hideHiddenAchievements: enabled } as any);
  };

  return (
    <ThemeContext.Provider value={{
      theme, setTheme,
      sidebarWidth, setSidebarWidth,
      sidebarGameScale, setSidebarGameScale,
      sidebarMarquee, setSidebarMarquee,
      dateFormat, setDateFormat,
      timeFormat, setTimeFormat,
      gamesViewMode, setGamesViewMode,
      hideHiddenAchievements, setHideHiddenAchievements
    }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
