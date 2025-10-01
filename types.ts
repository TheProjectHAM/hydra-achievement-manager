import { ReactNode } from 'react';

export type ApiSource = 'steam' | 'hydra';

export type SidebarGameScale = 'sm' | 'md' | 'lg';

export type DateFormat = 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD';
export type TimeFormat = '24h' | '12h';

export interface Tab {
  id: string;
  label: string;
  icon: ReactNode;
}

export interface SteamSearchResult {
  id: number;
  name: string;
  achievementsTotal: number;
}

declare global {
  interface Window {
    electronAPI?: {
      minimize: () => Promise<void>;
      maximize: () => Promise<void>;
      close: () => Promise<void>;
      onAchievementsUpdate: (callback: (games: any[]) => void) => void;
      requestAchievements: () => void;
      getGameName: (gameId: string) => Promise<string>;
      getGameNames: (gameIds: string[]) => Promise<Record<string, string>>;
      searchSteamGames: (query: string) => Promise<SteamSearchResult[]>;
      getGameAchievements: (gameId: string) => Promise<{ gameId: string; achievements: any[] }>;
      reloadAchievements: (gameId: string, basePath: string) => Promise<{ gameId: string; achievements: any[] }>;
      unlockAchievements: (options: any) => Promise<{ success: boolean }>;
    };
  }
}

export interface Achievement {
  internalName: string;
  displayName: string;
  description: string;
  icon: string;
}

export interface Timestamp {
  day: string;
  month: string;
  year: string;
  hour: string;
  minute: string;
  ampm?: 'AM' | 'PM';
}

export interface AchievementStatus {
  completed: boolean;
  timestamp: Timestamp;
}

export interface Game {
  id: number;
  name: string;
  achievementsCurrent: number;
  achievementsTotal: number;
}