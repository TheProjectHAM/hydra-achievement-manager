import fs from 'fs';
import path from 'path';
import { AchievementEntry, GameAchievements } from './types';

export class AchievementParser {
  /**
   * Parses a single achievement.ini file
   */
  static parseAchievementFile(filePath: string): AchievementEntry[] {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const achievements: AchievementEntry[] = [];
      const lines = content.split('\n').map(line => line.trim());

      let currentAchievement: Partial<AchievementEntry> | null = null;

      for (const line of lines) {
        if (line.startsWith('[') && line.endsWith(']')) {
          // New achievement section
          if (currentAchievement && currentAchievement.name) {
            achievements.push(currentAchievement as AchievementEntry);
          }
          currentAchievement = {
            name: line.slice(1, -1),
            achieved: false,
            unlockTime: 0,
          };
        } else if (line.includes('=')) {
          const [key, value] = line.split('=').map(s => s.trim());
          if (currentAchievement) {
            if (key === 'Achieved') {
              currentAchievement.achieved = value === '1';
            } else if (key === 'UnlockTime') {
              currentAchievement.unlockTime = parseInt(value, 10);
            }
          }
        }
      }

      // Add the last achievement
      if (currentAchievement && currentAchievement.name) {
        achievements.push(currentAchievement as AchievementEntry);
      }

      return achievements;
    } catch (error) {
      console.error(`Error parsing achievement file ${filePath}:`, error);
      return [];
    }
  }

  /**
   * Parses all achievement files in a directory structure
   */
  static parseDirectory(directoryPath: string): GameAchievements[] {
    const games: GameAchievements[] = [];

    try {
      const entries = fs.readdirSync(directoryPath, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const gameId = entry.name;
          let achievementFile: string;

          // Special handling for OnlineFix directory structure
          if (path.basename(directoryPath) === 'OnlineFix') {
            achievementFile = path.join(directoryPath, gameId, 'Stats', 'achievements.ini');
          } else {
            achievementFile = path.join(directoryPath, gameId, 'achievements.ini');
          }

          if (fs.existsSync(achievementFile)) {
            const achievements = this.parseAchievementFile(achievementFile);
            console.log(`Found ${achievements.length} achievements for game ${gameId}`);
            if (achievements.length > 0) {
              const stats = fs.statSync(achievementFile);
              games.push({
                gameId,
                achievements,
                lastModified: stats.mtime,
                directory: directoryPath,
              });
            }
          }
        }
      }
    } catch (error) {
      console.error(`Error parsing directory ${directoryPath}:`, error);
    }

    return games;
  }

  /**
   * Parses multiple directories
   */
  static parseDirectories(directoryPaths: string[]): GameAchievements[] {
    const allGames: GameAchievements[] = [];

    for (const dirPath of directoryPaths) {
      if (fs.existsSync(dirPath)) {
        const games = this.parseDirectory(dirPath);
        allGames.push(...games);
      } else {
        console.warn(`Directory ${dirPath} does not exist, skipping...`);
      }
    }

    return allGames;
  }
}
