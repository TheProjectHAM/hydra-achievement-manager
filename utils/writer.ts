import fs from 'fs';
import path from 'path';
import { AchievementEntry } from './types';

export class AchievementWriter {
  /**
   * Converts timestamp object to Unix timestamp
   */
  static timestampToUnix(timestamp: { day: string; month: string; year: string; hour: string; minute: string; ampm?: string }): number {
    if (!timestamp.day || !timestamp.month || !timestamp.year || !timestamp.hour || !timestamp.minute) {
      return 0;
    }

    const date = new Date(
      parseInt(timestamp.year),
      parseInt(timestamp.month) - 1, // Month is 0-indexed
      parseInt(timestamp.day),
      timestamp.ampm ? (timestamp.ampm === 'PM' ? parseInt(timestamp.hour) + 12 : parseInt(timestamp.hour)) % 24 : parseInt(timestamp.hour),
      parseInt(timestamp.minute)
    );

    return Math.floor(date.getTime() / 1000);
  }

  /**
   * Writes achievements to an ini file
   */
  static writeAchievementFile(filePath: string, achievements: AchievementEntry[]): void {
    // Ensure directory exists
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    let content = '';

    for (const achievement of achievements) {
      content += `[${achievement.name}]\n`;
      content += `Achieved=${achievement.achieved ? '1' : '0'}\n`;
      content += `UnlockTime=${achievement.unlockTime}\n`;
      content += '\n';
    }

    fs.writeFileSync(filePath, content, 'utf-8');
  }

  /**
   * Deletes the old achievement file if it exists
   */
  static deleteOldFile(filePath: string): void {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
}
