import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { AchievementMonitor, AchievementUnlocker, UnlockOptions } from '../utils';
import { Jimp } from "jimp";
import { DEFAULT_PATHS } from '../constants';
import { HydraAPI } from '../utils/hydra-api';
import { SteamAPI } from '../utils/steam-api';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isDev = process.env.NODE_ENV === 'development';

let mainWindow: BrowserWindow;
let lastExportTime = 0;
const EXPORT_COOLDOWN = 2000; // 2 seconds

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 740,
    frame: false, // Remove default title bar
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(() => {
  createWindow();

  // Start achievement monitoring
  const monitor = new AchievementMonitor(DEFAULT_PATHS, (games) => {
    // Send updated achievements to renderer
    if (mainWindow) {
      mainWindow.webContents.send('achievements-update', games);
    }
  });
  monitor.startMonitoring();

  // Handle request for achievements
  ipcMain.on('request-achievements', () => {
    if (mainWindow) {
      const games = monitor.getCurrentAchievements();
      mainWindow.webContents.send('achievements-update', games);
    }
  });

  // Handle get game name
  ipcMain.handle('get-game-name', async (event, gameId) => {
    try {
      const response = await fetch(`https://store.steampowered.com/api/appdetails?appids=${gameId}`);
      const data = await response.json();
      if (data[gameId] && data[gameId].success) {
        return data[gameId].data.name;
      }
      return gameId;
    } catch (error) {
      console.error('Error fetching game name:', error);
      return gameId;
    }
  });

  // Handle get game names
  ipcMain.handle('get-game-names', async (event, gameIds: string[]) => {
    const names: Record<string, string> = {};
    for (const gameId of gameIds) {
      try {
        const response = await fetch(`https://store.steampowered.com/api/appdetails?appids=${gameId}`);
        const data = await response.json();
        if (data[gameId] && data[gameId].success) {
          names[gameId] = data[gameId].data.name;
        } else {
          names[gameId] = gameId;
        }
      } catch (error) {
        console.error(`Error fetching game name for ${gameId}:`, error);
        names[gameId] = gameId;
      }
    }
    return names;
  });

  // Handle Steam game search
  ipcMain.handle('search-steam-games', async (event, query: string) => {
    try {
      const url = `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(query)}&l=english&cc=us&snr=1_4_4__12`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch search results');
      const data = await response.json();
      const partialResults = data.items.slice(0, 15).map((item: any) => ({
        id: parseInt(item.id),
        name: item.name,
        achievementsTotal: 0
      }));
      return partialResults;
    } catch (error) {
      console.error('Error searching Steam games:', error);
      throw error;
    }
  });

  // Handle get game achievements
  ipcMain.handle('get-game-achievements', async (event, gameId: string) => {
    try {
      // Load settings to determine which API to use
      const userDataPath = app.getPath('userData');
      const settingsPath = path.join(userDataPath, 'settings.json');
      let settings: any = {};
      if (fs.existsSync(settingsPath)) {
        const settingsData = fs.readFileSync(settingsPath, 'utf-8');
        settings = JSON.parse(settingsData);
      }

      const selectedApi = settings.selectedApi || 'hydra';
      const steamApiKey = settings.steamApiKey || '';
      const language = settings.language || 'en-US';

      // Map language codes to Steam API format
      const steamLanguageMap: Record<string, string> = {
        'en-US': 'english',
        'pt-BR': 'portuguese',
        'fr-FR': 'french',
        'it-IT': 'italian',
        'de-DE': 'german',
        'es-ES': 'spanish',
        'ru-RU': 'russian',
        'ja-JP': 'japanese',
        'zh-CN': 'schinese',
        'pl-PL': 'polish',
        'uk-UA': 'ukrainian',
      };
      const steamLanguage = steamLanguageMap[language] || 'english';

      let achievements;
      if (selectedApi === 'steam' && steamApiKey) {
        achievements = await SteamAPI.getGameAchievements(parseInt(gameId), steamApiKey, steamLanguage);
      } else {
        // Map app language codes to Hydra API language codes
        const hydraLanguageMap: Record<string, string> = {
          'en-US': 'en',
          'es-ES': 'es',
          'ru-RU': 'ru',
          'pt-BR': 'pt',
        };
        const hydraLanguage = hydraLanguageMap[language] || 'en';
        const hydraResult = await HydraAPI.getGameAchievements(gameId, hydraLanguage);
        achievements = hydraResult.achievements;
      }

      return { gameId, achievements };
    } catch (error) {
      console.error(`Error fetching achievements for game ${gameId}:`, error);
      throw error;
    }
  });

  // Handle export achievements
  ipcMain.handle('export-achievements', async (event, gameId: string) => {
    const now = Date.now();
    if (now - lastExportTime < EXPORT_COOLDOWN) {
      return { success: false, message: 'Export is on cooldown. Please wait.' };
    }

    try {
      // Select directory
      const result = await dialog.showOpenDialog(mainWindow, {
        title: 'Select directory to export achievements',
        properties: ['openDirectory']
      });

      if (result.canceled || !result.filePaths.length) {
        return { success: false, message: 'Export cancelled' };
      }

      const exportDir = result.filePaths[0];
      const imagesDir = path.join(exportDir, 'images');

      // Create images directory
      if (!fs.existsSync(imagesDir)) {
        fs.mkdirSync(imagesDir, { recursive: true });
      }

      // Load settings for language
      const userDataPath = app.getPath('userData');
      const settingsPath = path.join(userDataPath, 'settings.json');
      let exportSettings: any = {};
      if (fs.existsSync(settingsPath)) {
        const exportSettingsData = fs.readFileSync(settingsPath, 'utf-8');
        exportSettings = JSON.parse(exportSettingsData);
      }
      const exportLanguage = exportSettings.language || 'en-US';
      const hydraLanguageMap: Record<string, string> = {
        'en-US': 'en',
        'es-ES': 'es',
        'ru-RU': 'ru',
        'pt-BR': 'pt',
      };
      const hydraLanguage = hydraLanguageMap[exportLanguage] || 'en';

      // Fetch achievements
      const gameAchievements = await HydraAPI.getGameAchievements(gameId, hydraLanguage);

      // Prepare JSON data
      const jsonData = gameAchievements.achievements.map((ach, index) => ({
        name: ach.name,
        displayName: ach.displayName,
        description: ach.description,
        hidden: ach.hidden ? 1 : 0,
        icon: `images/${index + 1}.jpg`,
        icongray: `images/${index + 1}_gray.jpg`
      }));

      // Download and save images
      for (let i = 0; i < gameAchievements.achievements.length; i++) {
        const ach = gameAchievements.achievements[i];
        const index = i + 1;

        // Send progress
        if (mainWindow) {
          mainWindow.webContents.send('export-progress', {
            current: index,
            total: gameAchievements.achievements.length,
            name: ach.displayName,
            icon: ach.icon
          });
        }

        // Download normal icon
        const normalResponse = await fetch(ach.icon);
        if (normalResponse.ok) {
          const buffer = await normalResponse.arrayBuffer();
          const normalBuffer = Buffer.from(buffer);
          fs.writeFileSync(path.join(imagesDir, `${index}.jpg`), normalBuffer);

          // Generate gray icon from normal icon using Jimp
          try {
            const image = await Jimp.read(normalBuffer);
            image.greyscale();
            const grayBuffer = await image.getBuffer('image/jpeg');
            fs.writeFileSync(path.join(imagesDir, `${index}_gray.jpg`), grayBuffer);
          } catch (error) {
            console.error(`Error generating gray icon for ${ach.displayName}:`, error);
            // Fallback: try to download gray icon if generation fails
            const grayResponse = await fetch(ach.icongray);
            if (grayResponse.ok) {
              const grayBuffer = await grayResponse.arrayBuffer();
              fs.writeFileSync(path.join(imagesDir, `${index}_gray.jpg`), Buffer.from(grayBuffer));
            }
          }
        }
      }

      // Save JSON
      fs.writeFileSync(path.join(exportDir, 'achievements.json'), JSON.stringify(jsonData, null, 2));

      lastExportTime = now;
      return { success: true };
    } catch (error) {
      console.error('Error exporting achievements:', error);
      return { success: false, message: error.message };
    }
  });

  // Handle reload achievements from file
  ipcMain.handle('reload-achievements', async (event, gameId: string, basePath: string) => {
    try {
      const { AchievementParser } = await import('../utils');
      const filePath = path.join(basePath, gameId, 'achievements.ini');
      const achievements = AchievementParser.parseAchievementFile(filePath);
      return { gameId, achievements };
    } catch (error) {
      console.error(`Error reloading achievements for game ${gameId}:`, error);
      throw error;
    }
  });

  // Handle unlock achievements
  ipcMain.handle('unlock-achievements', async (event, options: UnlockOptions) => {
    try {
      await AchievementUnlocker.unlockAchievements(options);

      // After successful unlock, refresh achievements to show the changes
      const games = monitor.getCurrentAchievements();
      if (mainWindow) {
        mainWindow.webContents.send('achievements-update', games);
      }

      return { success: true };
    } catch (error) {
      console.error('Error unlocking achievements:', error);
      throw error;
    }
  });

  // Cleanup on app quit
  app.on('before-quit', () => {
    monitor.stopMonitoring();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Handle save settings
ipcMain.handle('save-settings', async (event, settings: any) => {
  try {
    const userDataPath = app.getPath('userData');
    const settingsPath = path.join(userDataPath, 'settings.json');
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
    return { success: true };
  } catch (error) {
    console.error('Error saving settings:', error);
    throw error;
  }
});

// Handle load settings
ipcMain.handle('load-settings', async () => {
  try {
    const userDataPath = app.getPath('userData');
    const settingsPath = path.join(userDataPath, 'settings.json');
    if (fs.existsSync(settingsPath)) {
      const settingsData = fs.readFileSync(settingsPath, 'utf-8');
      return JSON.parse(settingsData);
    }
    return {};
  } catch (error) {
    console.error('Error loading settings:', error);
    return {};
  }
});

// Handle request to open external links in user's default browser
ipcMain.handle('open-external', async (event, url: string) => {
  try {
    await shell.openExternal(url);
    return { success: true };
  } catch (error) {
    console.error('Failed to open external URL:', url, error);
    return { success: false, error: error.message };
  }
});

// Handle window controls
ipcMain.handle('minimize-window', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.handle('maximize-window', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMain.handle('close-window', () => {
  if (mainWindow) mainWindow.close();
});
