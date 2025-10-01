import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import { DateFormat, TimeFormat, SidebarGameScale } from '../types';

export type Theme = 'light' | 'dark';

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
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<Theme>('dark');
  const [sidebarWidth, setSidebarWidthState] = useState<number>(DEFAULT_SIDEBAR_WIDTH);
  const [sidebarGameScale, setSidebarGameScaleState] = useState<SidebarGameScale>('md');
  const [sidebarMarquee, setSidebarMarqueeState] = useState<boolean>(false);
  const [dateFormat, setDateFormatState] = useState<DateFormat>('DD/MM/YYYY');
  const [timeFormat, setTimeFormatState] = useState<TimeFormat>('24h');

  useEffect(() => {
    const loadSettings = async () => {
      try {
        if ((window as any).electronAPI) {
          const settings = await (window as any).electronAPI.loadSettings();

          const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;

          if (settings.theme) {
            setThemeState(settings.theme);
          } else if (prefersDark) {
            setThemeState('dark');
          } else {
            setThemeState('light');
          }

          if (settings.sidebarWidth) setSidebarWidthState(Number(settings.sidebarWidth));
          if (settings.sidebarGameScale) setSidebarGameScaleState(settings.sidebarGameScale);
          if (settings.sidebarMarquee !== undefined) setSidebarMarqueeState(settings.sidebarMarquee);
          if (settings.dateFormat) setDateFormatState(settings.dateFormat);
          if (settings.timeFormat) setTimeFormatState(settings.timeFormat);
        } else {
          // Fallback to localStorage for development
          const savedTheme = localStorage.getItem('app_theme') as Theme | null;
          const savedSidebarWidth = localStorage.getItem('app_sidebar_width');
          const savedSidebarGameScale = localStorage.getItem('app_sidebar_game_scale') as SidebarGameScale | null;
          const savedSidebarMarquee = localStorage.getItem('app_sidebar_marquee');
          const savedDateFormat = localStorage.getItem('app_date_format') as DateFormat | null;
          const savedTimeFormat = localStorage.getItem('app_time_format') as TimeFormat | null;

          const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;

          if (savedTheme) {
            setThemeState(savedTheme);
          } else if (prefersDark) {
            setThemeState('dark');
          } else {
            setThemeState('light');
          }

          if (savedSidebarWidth) setSidebarWidthState(Number(savedSidebarWidth));
          if (savedSidebarGameScale) setSidebarGameScaleState(savedSidebarGameScale);
          if (savedSidebarMarquee) setSidebarMarqueeState(JSON.parse(savedSidebarMarquee));
          if (savedDateFormat) setDateFormatState(savedDateFormat);
          if (savedTimeFormat) setTimeFormatState(savedTimeFormat);
        }
      } catch (error) {
        console.error('Error loading settings:', error);
      }
    };

    loadSettings();
  }, []);

  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  const setSidebarWidth = async (newWidth: number) => {
    setSidebarWidthState(newWidth);

    const currentSettings = {
      theme,
      sidebarWidth: newWidth,
      sidebarGameScale,
      sidebarMarquee,
      dateFormat,
      timeFormat,
    };

    try {
      if ((window as any).electronAPI) {
        await (window as any).electronAPI.saveSettings(currentSettings);
      } else {
        // Fallback for dev mode
        localStorage.setItem('app_sidebar_width', String(newWidth));
      }
    } catch (error) {
      console.error('Error saving sidebar width:', error);
    }
  };

  const setTheme = (newTheme: Theme) => setThemeState(newTheme);
  const setSidebarGameScale = (newScale: SidebarGameScale) => setSidebarGameScaleState(newScale);
  const setSidebarMarquee = (newMarquee: boolean) => setSidebarMarqueeState(newMarquee);
  const setDateFormat = (newFormat: DateFormat) => setDateFormatState(newFormat);
  const setTimeFormat = (newFormat: TimeFormat) => setTimeFormatState(newFormat);

  return (
    <ThemeContext.Provider value={{
      theme, setTheme,
      sidebarWidth, setSidebarWidth,
      sidebarGameScale, setSidebarGameScale,
      sidebarMarquee, setSidebarMarquee,
      dateFormat, setDateFormat,
      timeFormat, setTimeFormat
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
