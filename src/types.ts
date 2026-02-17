import { ReactNode } from 'react';

export type ApiSource = 'steam' | 'hydra';

export type SidebarGameScale = 'sm' | 'md' | 'lg';

export type DateFormat = 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD';
export type TimeFormat = '24h' | '12h';
export type GamesViewMode = 'grid' | 'list';

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
      onMaximizeChange: (callback: (maximized: boolean) => void) => void;
      onAchievementsUpdate: (callback: (games: any[]) => void) => void;
      requestAchievements: () => void;
      getGameName: (gameId: string) => Promise<string>;
      getGameNames: (gameIds: string[]) => Promise<Record<string, string>>;
      searchSteamGames: (query: string) => Promise<SteamSearchResult[]>;
      getGameAchievements: (gameId: string) => Promise<{ gameId: string; achievements: any[] }>;
      reloadAchievements: (gameId: string, basePath: string) => Promise<{ gameId: string; achievements: any[] }>;
      unlockAchievements: (options: any) => Promise<{ success: boolean }>;
      createAchievementsBackup: (outputPath: string, selectedGameIds?: string[], includeSettings?: boolean) => Promise<{ outputPath: string; gamesCount: number; hasSettings: boolean }>;
      previewAchievementsRestore: (backupPath: string) => Promise<any>;
      applyAchievementsRestore: (
        backupPath: string,
        selectedIndices?: number[],
        gameConflictResolutions?: Array<{ index: number; strategy: "backup" | "current" | "cancel" }>,
        restoreSettings?: boolean,
        settingsStrategy?: "backup" | "current" | "merge"
      ) => Promise<any>;
    };
  }
}

export interface Achievement {
  internalName: string;
  displayName: string;
  description: string;
  icon: string;
  percent?: number;
  hidden?: boolean;
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

export interface AchievementEntry {
  name: string;
  achieved: boolean;
  unlockTime: number;
}

export interface GameAchievements {
  gameId: string;
  achievements: AchievementEntry[];
  lastModified: Date | number;
  directory: string;
}

export interface Game {
  id: number;
  name: string;
  achievementsCurrent: number;
  achievementsTotal: number;
  source?: 'hydra' | 'steam'; // Source of the game data
}

// Steam Integration Types
export interface SteamGame {
  gameId: string;
  name: string;
  achievementsTotal: number;
  achievementsCurrent: number;
  source: string;
}

export interface SteamAchievementData {
  name: string;
  displayName: string;
  description: string;
  achieved: boolean;
  unlockTime: number;
  icon: string;
  iconGray: string;
  percent?: number;
  hidden?: boolean;
}

export interface SteamUserInfo {
  userId: string;
  userName: string;
}
