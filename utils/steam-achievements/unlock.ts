import path from 'path';
import { AchievementEntry } from './types';
import { AchievementWriter } from './writer';
import { UnlockMode } from '../../components/GlobalTimestampManager';
import { Timestamp, TimeFormat } from '../../types';

export interface UnlockOptions {
  gameId: string;
  selectedPath: string;
  achievements: Array<{
    name: string;
    completed: boolean;
    timestamp: Timestamp;
  }>;
  mode: UnlockMode;
  customTimestamp: Timestamp | null;
  timeFormat: TimeFormat;
}

export class AchievementUnlocker {
  /**
   * Processes achievements for unlocking
   */
  static processAchievements(options: UnlockOptions): AchievementEntry[] {
    const { achievements, mode, customTimestamp, timeFormat } = options;

    return achievements
      .filter(ach => ach.completed)
      .map(ach => {
        let unlockTime = 0;

        // If achievement has a timestamp, use it
        if (ach.timestamp.day && ach.timestamp.month && ach.timestamp.year &&
            ach.timestamp.hour && ach.timestamp.minute) {
          unlockTime = AchievementWriter.timestampToUnix(ach.timestamp);
        } else {
          // Use global timestamp manager value
          unlockTime = this.getGlobalTimestamp(mode, customTimestamp, timeFormat);
        }

        return {
          name: ach.name,
          achieved: true,
          unlockTime: unlockTime
        };
      });
  }

  /**
   * Gets timestamp based on global mode
   */
  private static getGlobalTimestamp(mode: UnlockMode, customTimestamp: Timestamp | null, timeFormat: TimeFormat): number {
    let timestamp: Timestamp;

    switch (mode) {
      case 'current':
        const now = new Date();
        timestamp = {
          day: String(now.getDate()).padStart(2, '0'),
          month: String(now.getMonth() + 1).padStart(2, '0'),
          year: String(now.getFullYear()),
          minute: String(now.getMinutes()).padStart(2, '0'),
          hour: '',
        };
        if (timeFormat === '12h') {
          const hour12 = now.getHours() % 12 || 12;
          timestamp.hour = String(hour12).padStart(2, '0');
          timestamp.ampm = now.getHours() >= 12 ? 'PM' : 'AM';
        } else {
          timestamp.hour = String(now.getHours()).padStart(2, '0');
        }
        break;

      case 'random':
        const past = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
        const randomDate = new Date(past.getTime() + Math.random() * (Date.now() - past.getTime()));
        timestamp = {
          day: String(randomDate.getDate()).padStart(2, '0'),
          month: String(randomDate.getMonth() + 1).padStart(2, '0'),
          year: String(randomDate.getFullYear()),
          minute: String(randomDate.getMinutes()).padStart(2, '0'),
          hour: '',
        };
        if (timeFormat === '12h') {
          const hour12 = randomDate.getHours() % 12 || 12;
          timestamp.hour = String(hour12).padStart(2, '0');
          timestamp.ampm = randomDate.getHours() >= 12 ? 'PM' : 'AM';
        } else {
          timestamp.hour = String(randomDate.getHours()).padStart(2, '0');
        }
        break;

      case 'custom':
        timestamp = customTimestamp || { day: '', month: '', year: '', hour: '', minute: '' };
        break;

      default:
        timestamp = { day: '', month: '', year: '', hour: '', minute: '' };
    }

    return AchievementWriter.timestampToUnix(timestamp);
  }

  /**
   * Performs the unlock operation
   */
  static async unlockAchievements(options: UnlockOptions): Promise<void> {
    const { gameId, selectedPath } = options;

    // Process achievements
    const achievementEntries = this.processAchievements(options);

    // Create file path
    const filePath = path.join(selectedPath, gameId, 'achievements.ini');

    // Delete old file
    AchievementWriter.deleteOldFile(filePath);

    // Write new file
    AchievementWriter.writeAchievementFile(filePath, achievementEntries);
  }
}
