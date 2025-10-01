import fs from 'fs';
import path from 'path';
import { AchievementParser } from './parser';
import { GameAchievements, DirectoryConfig } from './types';

export class AchievementMonitor {
  private watchers: fs.FSWatcher[] = [];
  private directories: DirectoryConfig[] = [];
  private onChangeCallback?: (games: GameAchievements[]) => void;

  constructor(paths: string[], onChange?: (games: GameAchievements[]) => void) {
    this.setDirectories(paths);
    this.onChangeCallback = onChange;
  }

  /**
   * Starts monitoring all configured directories
   */
  startMonitoring(): void {
    console.log('Starting achievement monitoring...');

    for (const dir of this.directories) {
      this.watchDirectory(dir);
    }

    // Log initial achievements
    const initialGames = this.getCurrentAchievements();
    console.log('Initial achievements found:', initialGames);
  }

  /**
   * Stops monitoring
   */
  stopMonitoring(): void {
    console.log('Stopping achievement monitoring...');
    this.watchers.forEach(watcher => watcher.close());
    this.watchers = [];
  }

  /**
   * Watches a single directory for changes
   */
  private watchDirectory(dirConfig: DirectoryConfig): void {
    try {
      // Check if directory exists
      if (!fs.existsSync(dirConfig.path)) {
        console.warn(`Directory ${dirConfig.path} does not exist, skipping...`);
        return;
      }

      const watcher = fs.watch(dirConfig.path, { recursive: true }, (eventType, filename) => {
        if (filename && filename.endsWith('achievements.ini')) {
          console.log(`Achievement file changed: ${filename} in ${dirConfig.name}`);
          this.handleFileChange();
        }
      });

      this.watchers.push(watcher);
      console.log(`Monitoring ${dirConfig.name}: ${dirConfig.path}`);
    } catch (error) {
      console.error(`Error setting up watch for ${dirConfig.path}:`, error);
    }
  }

  /**
   * Handles file change events
   */
  private handleFileChange(): void {
    if (this.onChangeCallback) {
      const games = AchievementParser.parseDirectories(this.directories.map(d => d.path));
      this.onChangeCallback(games);
    }
  }

  /**
   * Gets current achievements from all directories
   */
  getCurrentAchievements(): GameAchievements[] {
    return AchievementParser.parseDirectories(this.directories.map(d => d.path));
  }

  /**
   * Gets the list of monitored directories
   */
  getDirectories(): DirectoryConfig[] {
    return [...this.directories];
  }

  /**
   * Sets the directories to monitor
   */
  setDirectories(paths: string[]): void {
    this.directories = paths.map(path => ({
      path,
      name: path.split(/[/\\]/).pop() || 'Unknown'
    }));
  }

  /**
   * Restarts monitoring with new directories
   */
  restartMonitoring(): void {
    this.stopMonitoring();
    this.startMonitoring();
  }
}
