export interface AchievementEntry {
  name: string;
  achieved: boolean;
  unlockTime: number; // Unix timestamp
}

export interface GameAchievements {
  gameId: string;
  achievements: AchievementEntry[];
  lastModified: Date;
  directory: string; // Path to the directory containing this game's achievements
}

export interface DirectoryConfig {
  path: string;
  name: string;
}

// Hydra API types
export interface HydraAchievement {
  name: string;
  hidden: boolean;
  icon: string;
  icongray: string;
  displayName: string;
  description: string;
  points: number;
}

export interface HydraGameAchievements {
  gameId: string;
  achievements: HydraAchievement[];
}
